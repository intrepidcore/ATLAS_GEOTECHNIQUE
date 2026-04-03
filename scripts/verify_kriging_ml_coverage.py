#!/usr/bin/env python3
"""
Audit couverture kriging + ML (dernier run interpolation global, derniers runs ML par cible).

Schéma réel : atlas.ai_interpolation_values.parameter_id (pas parameter_name).
IL métier = ip_avg (indice de plasticité) dans ai_parameter_catalog.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def load_env() -> None:
    p = Path(__file__).resolve().parent.parent / ".env"
    if not p.is_file():
        return
    try:
        from dotenv import load_dotenv

        load_dotenv(p)
    except ImportError:
        pass
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        key = k.strip()
        val = v.strip().strip('"').strip("'")
        if not key or not val:
            continue
        prev = (os.environ.get(key) or "").strip()
        if not prev or key == "DATABASE_URL":
            os.environ[key] = val


def main() -> int:
    load_env()
    import argparse
    import psycopg2

    ap = argparse.ArgumentParser()
    ap.add_argument("--database-url", default=os.environ.get("DATABASE_URL", "").strip())
    args = ap.parse_args()
    url = (args.database_url or "").strip()
    if not url:
        u = os.environ.get("POSTGRES_USER", "atlas")
        p = os.environ.get("POSTGRES_PASSWORD", "atlas")
        d = os.environ.get("POSTGRES_DB", "atlas_clean")
        host = os.environ.get("POSTGRES_HOST", "127.0.0.1")
        port = os.environ.get("POSTGRES_PORT", "5432")
        url = f"postgres://{u}:{p}@{host}:{port}/{d}"

    conn = psycopg2.connect(url)
    conn.autocommit = True
    c = conn.cursor()

    # --- Étape 1 : 5 derniers runs interpolation
    c.execute(
        """
        SELECT id, created_at, method, parameter_id
        FROM atlas.ai_interpolation_runs
        ORDER BY created_at DESC
        LIMIT 5
        """
    )
    last_runs = c.fetchall()
    if not last_runs:
        print(json.dumps({"error": "aucun ai_interpolation_runs"}, indent=2))
        return 1

    run_id = last_runs[0][0]
    run_created = last_runs[0][1]
    run_method = last_runs[0][2]
    run_param = last_runs[0][3]

    # --- Étape 2 : paramètres distincts dans CE run
    c.execute(
        """
        SELECT DISTINCT parameter_id
        FROM atlas.ai_interpolation_values
        WHERE run_id = %s
        ORDER BY parameter_id
        """,
        (run_id,),
    )
    params_in_run = [r[0] for r in c.fetchall()]

    # --- Étape 3 : mailles Togo
    c.execute("SELECT COUNT(*)::bigint FROM atlas.mailles")
    total_mailles = int(c.fetchone()[0])

    # Cibles métier (ip_avg = « IL » catalogue)
    checklist = ["ip_avg", "wl_avg", "wp_avg", "eg_avg"]
    granulo_catalog = [
        "passant_80um_avg",
        "passant_2mm_avg",
        "passant_20mm_avg",
    ]
    granulo_in_run = [p for p in params_in_run if p.startswith("passant_")]

    def interp_stats(param: str) -> dict:
        c.execute(
            """
            SELECT COUNT(DISTINCT maille_id)::bigint,
                   COUNT(*) FILTER (WHERE variance IS NOT NULL)::bigint
            FROM atlas.ai_interpolation_values
            WHERE run_id = %s AND parameter_id = %s
            """,
            (run_id, param),
        )
        row = c.fetchone()
        n_m = int(row[0] or 0)
        n_var = int(row[1] or 0)
        full = n_m >= total_mailles if total_mailles else False
        return {
            "mailles_interpolees": n_m,
            "lignes_avec_variance": n_var,
            "couverture_complete": full,
        }

    # --- Étape 4–5 : kriging par paramètre
    all_params_to_check = sorted(
        set(checklist + granulo_catalog + granulo_in_run + params_in_run)
    )
    kriging_rows = []
    for p in all_params_to_check:
        st = interp_stats(p)
        kriging_rows.append(
            {
                "parametre": p,
                "mailles_interpolees": st["mailles_interpolees"],
                "variance_disponible_lignes": st["lignes_avec_variance"],
                "couverture_complete_oui_non": "oui" if st["couverture_complete"] else "non",
            }
        )

    # Sous-ensemble « focus » demandé par l’utilisateur
    focus_params = list(
        dict.fromkeys(
            checklist
            + granulo_in_run
            + [x for x in granulo_catalog if x in params_in_run or x in checklist]
        )
    )
    focus_table = [r for r in kriging_rows if r["parametre"] in focus_params]

    # --- Étape 6 : vue latest
    c.execute(
        """
        SELECT parameter_id, COUNT(*)::bigint
        FROM atlas.v_latest_ai_interpolation
        GROUP BY parameter_id
        ORDER BY parameter_id
        """
    )
    latest_counts = {str(a): int(b) for a, b in c.fetchall()}

    # --- ML : dernier run terminé par target_id parmi les paramètres d’intérêt
    ml_targets = list(
        dict.fromkeys(checklist + granulo_catalog + granulo_in_run + params_in_run)
    )
    ml_rows = []
    for tgt in ml_targets:
        c.execute(
            """
            SELECT id, created_at, model_version, status
            FROM atlas.ai_prediction_runs
            WHERE target_id = %s AND status = 'finished'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (tgt,),
        )
        pr = c.fetchone()
        if not pr:
            ml_rows.append(
                {
                    "parametre": tgt,
                    "prediction_run_id": None,
                    "mailles_ml": 0,
                    "couverture_complete": "non",
                    "note": "aucun run ML finished",
                }
            )
            continue
        pr_id = pr[0]
        c.execute(
            """
            SELECT COUNT(DISTINCT maille_id)::bigint,
                   COUNT(*) FILTER (WHERE p50 IS NOT NULL)::bigint
            FROM atlas.ai_maille_ml_values
            WHERE prediction_run_id = %s AND parameter_id = %s
            """,
            (pr_id, tgt),
        )
        row_ml = c.fetchone()
        nm = int(row_ml[0] or 0)
        np50 = int(row_ml[1] or 0)
        ml_rows.append(
            {
                "parametre": tgt,
                "prediction_run_id": str(pr_id),
                "run_created_at": pr[1].isoformat() if pr[1] else None,
                "model_version": pr[2],
                "mailles_ml": nm,
                "lignes_avec_p50": np50,
                "couverture_complete": "oui" if nm >= total_mailles else "non",
                "note": "ML : pas de variance kriging ; p50 = prédiction centrale.",
            }
        )

    # --- Kriging : dernier run **par** parameter_id (couverture métier réaliste)
    try:
        c.execute(
            """
            WITH last_per_param AS (
              SELECT DISTINCT ON (r.parameter_id)
                r.id AS run_id,
                r.parameter_id,
                r.created_at,
                r.method
              FROM atlas.ai_interpolation_runs r
              WHERE r.status = 'finished'
              ORDER BY r.parameter_id, r.created_at DESC
            )
            SELECT run_id, parameter_id, created_at, method FROM last_per_param
            ORDER BY parameter_id
            """
        )
        per_param_runs = c.fetchall()
    except Exception:
        c.execute(
            """
            WITH last_per_param AS (
              SELECT DISTINCT ON (r.parameter_id)
                r.id AS run_id,
                r.parameter_id,
                r.created_at,
                r.method
              FROM atlas.ai_interpolation_runs r
              ORDER BY r.parameter_id, r.created_at DESC
            )
            SELECT run_id, parameter_id, created_at, method FROM last_per_param
            ORDER BY parameter_id
            """
        )
        per_param_runs = c.fetchall()

    kriging_per_param = []
    for rid, pid, crt, meth in per_param_runs:
        c.execute(
            """
            SELECT COUNT(DISTINCT maille_id)::bigint,
                   COUNT(*) FILTER (WHERE variance IS NOT NULL)::bigint
            FROM atlas.ai_interpolation_values
            WHERE run_id = %s AND parameter_id = %s
            """,
            (rid, pid),
        )
        nm, nv = c.fetchone()
        nm = int(nm or 0)
        nv = int(nv or 0)
        kriging_per_param.append(
            {
                "parameter_id": pid,
                "run_id": str(rid),
                "run_created_at": crt.isoformat() if crt else None,
                "method": meth,
                "mailles_interpolees": nm,
                "lignes_avec_variance": nv,
                "couverture_complete": "oui" if nm >= total_mailles else "non",
            }
        )

    conn.close()

    out = {
        "total_mailles_togo": total_mailles,
        "ai_interpolation_runs_5_derniers": [
            {
                "id": str(r[0]),
                "created_at": r[1].isoformat() if r[1] else None,
                "method": r[2],
                "parameter_id": r[3],
            }
            for r in last_runs
        ],
        "kriging": {
            "dernier_run_global_chronologique": {
                "run_id": str(run_id),
                "run_created_at": run_created.isoformat() if run_created else None,
                "method": run_method,
                "run_parameter_id_catalog": run_param,
                "parametres_distincts_dans_ce_run": params_in_run,
            },
            "note_il": "il_avg inexistant dans le catalogue Atlas ; équivalent IP = ip_avg.",
            "note_run_unique": "Un run global ne contient souvent qu’un seul parameter_id ; voir kriging_dernier_run_par_parametre.",
            "tableau_synthetique_focus_dernier_run_global": focus_table,
            "tableau_croise_dernier_run_global": kriging_rows,
            "kriging_dernier_run_par_parametre": kriging_per_param,
        },
        "v_latest_ai_interpolation_counts": latest_counts,
        "ml_dernier_run_par_parametre": ml_rows,
        "synthese": {
            "kriging_parametres_complets": [
                r["parametre"]
                for r in kriging_rows
                if r["couverture_complete_oui_non"] == "oui" and r["mailles_interpolees"] > 0
            ],
            "kriging_parametres_partiels": [
                r["parametre"]
                for r in kriging_rows
                if r["mailles_interpolees"] > 0
                and r["couverture_complete_oui_non"] == "non"
            ],
            "kriging_parametres_absents_du_run": [
                r["parametre"]
                for r in kriging_rows
                if r["mailles_interpolees"] == 0 and r["parametre"] in params_in_run
            ],
            "kriging_hors_run_mais_dans_checklist": [
                p for p in checklist + granulo_catalog if p not in params_in_run
            ],
        },
    }

    # Réordonner synthèse : absents = pas dans le dernier run du tout
    out["synthese"]["parametres_absents_du_dernier_run_interpolation"] = [
        p for p in checklist + granulo_catalog if p not in params_in_run
    ]

    print(json.dumps(out, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
