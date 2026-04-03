#!/usr/bin/env python3
"""
Vérification bout-en-bout pipeline campagne Atlas (DB → scoring → ML/ONNX → API).

Usage (depuis atlas_reclone) :
  python scripts/verify_campaign_pipeline_stable.py
  python scripts/verify_campaign_pipeline_stable.py --run-pipeline
  python scripts/verify_campaign_pipeline_stable.py --retrain-ml

Variables (.env) :
  DATABASE_URL
  ATLAS_API_OPTI_URL       — ex. http://127.0.0.1:8003 (docker-compose)
  ATLAS_INTERNAL_SERVICE_TOKEN — même valeur api-geo / api-opti
  ATLAS_TEST_EMAIL / ATLAS_TEST_PASSWORD — optionnel ; sinon tests JWT api-geo ignorés
  API_GEO_BASE             — défaut http://127.0.0.1:8000
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent


def load_dotenv_file() -> None:
    p = REPO_ROOT / ".env"
    if not p.is_file():
        return
    try:
        from dotenv import load_dotenv

        load_dotenv(p)
    except ImportError:
        for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"\''))


def pg_conn():
    import psycopg2

    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise SystemExit("DATABASE_URL manquant")
    c = psycopg2.connect(url)
    c.autocommit = True
    return c


def view_exists(cur, name: str) -> bool:
    cur.execute(
        """
        SELECT EXISTS (
          SELECT 1 FROM information_schema.views
          WHERE table_schema = 'atlas' AND table_name = %s
        )
        """,
        (name,),
    )
    return cur.fetchone()[0]


def http_json(
    method: str,
    url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    body: Any = None,
    timeout: float = 120.0,
) -> Tuple[int, Any]:
    h = dict(headers or {})
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            status = resp.status
            try:
                return status, json.loads(raw) if raw else None
            except json.JSONDecodeError:
                return status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw) if raw else None
        except json.JSONDecodeError:
            return e.code, {"_raw": raw}


def main() -> int:
    load_dotenv_file()
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-pipeline", action="store_true", help="Exécute atlas_geostat_ml_pipeline.py")
    ap.add_argument("--retrain-ml", action="store_true", help="Relance train_catboost_export_onnx.py")
    ap.add_argument("--zone", default="DEPRESSION_LAMA_TG")
    args = ap.parse_args()

    report: Dict[str, Any] = {
        "step0_migrations_views": {},
        "step1_db_counts": {},
        "step2_pipeline": None,
        "step3_campaign_propagation": {},
        "step4_ml_registry": {},
        "step5_onnx": {},
        "step6_api": {},
        "step7_pool_depression": {},
        "anomalies": [],
    }

    conn = pg_conn()
    cur = conn.cursor()

    for v in (
        "v_latest_ai_interpolation",
        "v_campaign_priority_score",
        "v_maille_primary_kriging_domain",
    ):
        report["step0_migrations_views"][v] = view_exists(cur, v)
        if not report["step0_migrations_views"][v]:
            report["anomalies"].append(f"Vue atlas.{v} absente — appliquer migrations 157–161.")

    counts_sql = {
        "ai_interpolation_runs": "SELECT COUNT(*) FROM atlas.ai_interpolation_runs",
        "ai_interpolation_values": "SELECT COUNT(*) FROM atlas.ai_interpolation_values",
        "ai_prediction_runs": "SELECT COUNT(*) FROM atlas.ai_prediction_runs",
        "ai_maille_ml_values": "SELECT COUNT(*) FROM atlas.ai_maille_ml_values",
        "v_latest_ai_interpolation": "SELECT COUNT(*) FROM atlas.v_latest_ai_interpolation",
        "v_campaign_priority_score": "SELECT COUNT(*) FROM atlas.v_campaign_priority_score",
    }
    for key, sql in counts_sql.items():
        try:
            cur.execute(sql)
            report["step1_db_counts"][key] = cur.fetchone()[0]
        except Exception as e:
            report["step1_db_counts"][key] = None
            report["anomalies"].append(f"COUNT {key}: {e}")

    cur.execute(
        """
        SELECT method FROM atlas.ai_interpolation_runs
        ORDER BY created_at DESC LIMIT 5
        """
    )
    report["step1_db_counts"]["last_methods"] = [r[0] for r in cur.fetchall()]
    if "regression_kriging_catboost" not in report["step1_db_counts"]["last_methods"]:
        report["anomalies"].append(
            "Aucun run récent 'regression_kriging_catboost' dans les 5 derniers — lancer --run-pipeline."
        )

    cur.execute(
        """
        SELECT maille_id::text, variance::float8
        FROM atlas.v_latest_ai_interpolation
        WHERE parameter_id = 'vbs_avg' AND variance IS NOT NULL
        LIMIT 20
        """
    )
    vv = [float(r[1]) for r in cur.fetchall()]
    report["step1_db_counts"]["sample_variance_vbs_n"] = len(vv)
    if vv:
        report["step1_db_counts"]["sample_variance_mean"] = sum(vv) / len(vv)
        report["step1_db_counts"]["sample_variance_max"] = max(vv)

    cur.execute(
        """
        SELECT maille_id::text, norm_variance_v1::float8, priority_score_v1::float8, variance_kriging::float8
        FROM atlas.v_campaign_priority_score
        LIMIT 20
        """
    )
    report["step3_campaign_propagation"]["sample_rows"] = len(cur.fetchall())

    cur.execute(
        """
        SELECT COUNT(*)::bigint,
               AVG(variance_kriging)::float8,
               MAX(variance_kriging)::float8
        FROM atlas.v_campaign_priority_score
        WHERE variance_kriging IS NOT NULL
        """
    )
    report["step3_campaign_propagation"]["kriging_var_stats"] = cur.fetchone()

    cur.execute(
        """
        SELECT model_key, version, is_active
        FROM atlas.ai_models_registry
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 1
        """
    )
    row = cur.fetchone()
    report["step4_ml_registry"]["active"] = (
        {"model_key": row[0], "version": row[1], "is_active": row[2]} if row else None
    )
    if not row:
        report["anomalies"].append("Aucun modèle actif dans atlas.ai_models_registry.")

    cur.execute(
        "SELECT m.code FROM atlas.mailles m JOIN atlas.mailles_zones_etude mze ON mze.maille_id = m.id "
        "JOIN atlas.zones_etude z ON z.id = mze.zone_id WHERE z.code = %s LIMIT 1",
        (args.zone,),
    )
    rcode = cur.fetchone()
    sample_maille_code = rcode[0] if rcode else None

    cur.close()
    conn.close()

    if args.run_pipeline:
        r = subprocess.run(
            [sys.executable, str(REPO_ROOT / "scripts" / "atlas_geostat_ml_pipeline.py")],
            cwd=str(REPO_ROOT),
            env=os.environ.copy(),
        )
        report["step2_pipeline"] = {"exit_code": r.returncode}
        if r.returncode != 0:
            report["anomalies"].append("atlas_geostat_ml_pipeline.py a échoué.")

    if args.retrain_ml:
        r = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "scripts" / "train_catboost_export_onnx.py"),
                "--out-dir",
                str(REPO_ROOT / "models"),
                "--register-db",
                "--activate",
            ],
            cwd=str(REPO_ROOT),
            env=os.environ.copy(),
        )
        report["step5_onnx"]["retrain_exit"] = r.returncode
        if r.returncode != 0:
            report["anomalies"].append("train_catboost_export_onnx.py a échoué.")

    models_dir = REPO_ROOT / "models"
    onnx_p = models_dir / "maille_risk.onnx"
    man_p = models_dir / "maille_risk_manifest.json"
    report["step5_onnx"]["maille_risk_onnx_exists"] = onnx_p.is_file()
    report["step5_onnx"]["manifest_exists"] = man_p.is_file()
    if onnx_p.is_file() and man_p.is_file():
        env = os.environ.copy()
        env["ATLAS_ONNX_MAILLE_MODEL_PATH"] = str(onnx_p)
        env["ATLAS_ONNX_MANIFEST_PATH"] = str(man_p)
        proc = subprocess.run(
            [sys.executable, str(REPO_ROOT / "scripts" / "onnx_maille_infer.py")],
            cwd=str(REPO_ROOT),
            env=env,
            input=json.dumps(
                {
                    "features": {
                        "n_sondages": 1,
                        "vbs_moyen": 6,
                        "ip_moyen": 30,
                        "gonflement_cg_moyen": 5,
                        "profondeur_max_m": 10,
                        "pct_in_lama": 5,
                        "dsm_altitude_moy_m": 50,
                        "dist_riviere_m": 1000,
                        "dist_surface_eau_m": 2000,
                        "data_confidence_score": 60,
                    },
                    "charge_kpa": 150,
                }
            ).encode(),
            capture_output=True,
            timeout=60,
        )
        report["step5_onnx"]["infer_exit_code"] = proc.returncode
        if proc.returncode == 0:
            try:
                outj = json.loads(proc.stdout.decode())
                report["step5_onnx"]["model_version"] = outj.get("model_version")
                report["step5_onnx"]["risk_score"] = outj.get("risk_score")
            except json.JSONDecodeError:
                report["anomalies"].append("Sortie onnx_maille_infer non-JSON")
        else:
            report["anomalies"].append(
                f"onnx_maille_infer stderr: {proc.stderr.decode(errors='replace')[:500]}"
            )

    geo_base = os.environ.get("API_GEO_BASE", "http://127.0.0.1:8000").rstrip("/")
    opti_url = (os.environ.get("ATLAS_API_OPTI_URL") or "http://127.0.0.1:8003").rstrip(
        "/"
    )
    tok = (os.environ.get("ATLAS_INTERNAL_SERVICE_TOKEN") or "").strip()

    st, _ = http_json("GET", f"{geo_base}/healthz")
    report["step6_api"]["api_geo_healthz"] = st

    st_o, _ = http_json("GET", f"{opti_url}/healthz")
    report["step6_api"]["api_opti_healthz"] = st_o
    if st_o != 200:
        report["anomalies"].append(
            f"api-opti injoignable ({opti_url}/healthz). Démarrer le service (docker : port 8003)."
        )

    campaign_body = {
        "zone": args.zone,
        "budget": 6,
        "objectif": "gonflement",
        "mode": "exploration",
        "depression_hard_constraint": True,
        "relax_depression_pool": False,
    }
    campaign_body_full = {
        **campaign_body,
        "relax_depression_pool": True,
    }

    if st_o == 200 and not tok:
        report["anomalies"].append(
            "ATLAS_INTERNAL_SERVICE_TOKEN manquant — tests /internal/opti/campaign* non exécutés."
        )

    def check_campaign_payload(label: str, payload: Dict[str, Any]) -> None:
        if not tok or st_o != 200:
            return
        h = {"X-Internal-Token": tok, "Content-Type": "application/json"}
        code, data = http_json(
            "POST", f"{opti_url}/internal/opti/campaign/simple", headers=h, body=payload
        )
        report["step6_api"][f"{label}_simple_status"] = code
        if code == 200 and isinstance(data, dict):
            m = data.get("metrics") or {}
            for k in (
                "variance_reduction_ratio",
                "risk_capture",
                "priority_score_formula_version",
                "approx_travel_tour_km",
            ):
                if k not in m:
                    report["anomalies"].append(f"{label} simple: metrics.{k} manquant")
                elif m[k] is None and k != "priority_score_formula_version":
                    report["anomalies"].append(f"{label} simple: metrics.{k} null")
            if "alternatives" not in data:
                report["anomalies"].append(f"{label} simple: alternatives manquant")
            if "best_fitness" not in data:
                report["anomalies"].append(f"{label} simple: best_fitness top-level manquant")
            elif data["best_fitness"] is not None:
                report["anomalies"].append(
                    f"{label} simple: best_fitness devrait être null en heuristique"
                )
            if "best_fitness" not in m:
                report["anomalies"].append(f"{label} simple: metrics.best_fitness manquant")
        elif code == 404:
            report["anomalies"].append(
                f"{label} campaign/simple HTTP 404 — image api-opti probablement obsolète "
                f"(reconstruire: docker compose build api-opti && up -d api-opti)."
            )
        else:
            report["anomalies"].append(
                f"{label} campaign/simple HTTP {code}: {str(data)[:300]}"
            )

        code2, data2 = http_json(
            "POST", f"{opti_url}/internal/opti/campaign", headers=h, body=payload
        )
        report["step6_api"][f"{label}_ga_status"] = code2
        if code2 == 200 and isinstance(data2, dict):
            m2 = data2.get("metrics") or {}
            for k in (
                "variance_reduction_ratio",
                "risk_capture",
                "priority_score_formula_version",
                "approx_travel_tour_km",
            ):
                if k not in m2:
                    report["anomalies"].append(f"{label} ga: metrics.{k} manquant")
            alts = data2.get("alternatives")
            if not isinstance(alts, list) or len(alts) < 1:
                report["anomalies"].append(f"{label} ga: alternatives attendu (liste non vide)")
            if data2.get("best_fitness") is None:
                report["anomalies"].append(f"{label} ga: best_fitness null inattendu pour AG")
            if m2.get("best_fitness") is None:
                report["anomalies"].append(f"{label} ga: metrics.best_fitness null inattendu")
        elif code2 == 404:
            report["anomalies"].append(
                f"{label} campaign ga HTTP 404 — même remède que campaign/simple (rebuild api-opti)."
            )
        else:
            report["anomalies"].append(
                f"{label} campaign ga HTTP {code2}: {str(data2)[:300]}"
            )

    check_campaign_payload("depression_only", campaign_body)
    check_campaign_payload("full_zone", campaign_body_full)

    if tok and st_o == 200:
        h = {"X-Internal-Token": tok, "Content-Type": "application/json"}
        _, d_dep = http_json(
            "POST", f"{opti_url}/internal/opti/campaign/simple", headers=h, body=campaign_body
        )
        _, d_full = http_json(
            "POST",
            f"{opti_url}/internal/opti/campaign/simple",
            headers=h,
            body=campaign_body_full,
        )
        if isinstance(d_dep, dict) and isinstance(d_full, dict):
            pd = d_dep.get("pool_size")
            pf = d_full.get("pool_size")
            report["step7_pool_depression"]["pool_size_depression_only"] = pd
            report["step7_pool_depression"]["pool_size_full_zone"] = pf
            if isinstance(pd, int) and isinstance(pf, int) and pf < pd:
                report["anomalies"].append(
                    f"Pool full_zone < dépression: depression={pd} full={pf}"
                )

    email = os.environ.get("ATLAS_TEST_EMAIL", "").strip()
    password = os.environ.get("ATLAS_TEST_PASSWORD", "").strip()
    jwt: Optional[str] = os.environ.get("ATLAS_TEST_JWT", "").strip() or None
    if not jwt and email and password:
        st_l, login_data = http_json(
            "POST",
            f"{geo_base}/auth/login",
            body={"email": email, "password": password},
        )
        report["step6_api"]["auth_login"] = st_l
        if st_l == 200 and isinstance(login_data, dict):
            jwt = login_data.get("access_token")
        else:
            report["anomalies"].append("Login ATLAS_TEST_EMAIL échoué — tests façade api-geo ignorés.")

    if jwt and sample_maille_code:
        h = {"Authorization": f"Bearer {jwt}", "Content-Type": "application/json"}
        st_i, infer_j = http_json(
            "POST",
            f"{geo_base}/ai/infer/maille",
            headers=h,
            body={"maille_code": sample_maille_code},
        )
        report["step6_api"]["infer_maille_status"] = st_i
        if st_i == 200 and isinstance(infer_j, dict):
            pred = infer_j.get("prediction")
            if isinstance(pred, dict):
                prs = pred.get("predicted_risk_score")
                if prs is None and pred.get("risk_score") is None:
                    report["anomalies"].append(
                        "Inférence: prediction sans predicted_risk_score/risk_score"
                    )
            else:
                report["anomalies"].append("Inférence: prediction non-objet")
        else:
            report["anomalies"].append(f"/ai/infer/maille HTTP {st_i}: {str(infer_j)[:200]}")

        st_cs, _ = http_json(
            "POST",
            f"{geo_base}/ai/opti/campaign/simple",
            headers=h,
            body=campaign_body,
        )
        report["step6_api"]["geo_facade_campaign_simple"] = st_cs
        if st_cs != 200:
            report["anomalies"].append(
                f"Façade /ai/opti/campaign/simple HTTP {st_cs} (vérifier ATLAS_API_OPTI_URL + token interne)"
            )

        st_cg, _ = http_json(
            "POST",
            f"{geo_base}/ai/opti/campaign",
            headers=h,
            body=campaign_body,
        )
        report["step6_api"]["geo_facade_campaign_ga"] = st_cg
        if st_cg != 200:
            report["anomalies"].append(
                f"Façade /ai/opti/campaign HTTP {st_cg}"
            )
    elif not jwt:
        report["step6_api"]["jwt_skipped"] = (
            "Définir ATLAS_TEST_EMAIL+ATLAS_TEST_PASSWORD ou ATLAS_TEST_JWT pour tests api-geo JWT."
        )

    print(json.dumps(report, indent=2, default=str))
    return 1 if report["anomalies"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
