#!/usr/bin/env python3
"""
run_ked_new_params_horizons.py
KED (Kriging with External Drift) pour les parametres V11 :
  rd_mpa   : resistance dynamique penetrometre (essais_penetrometre)
  cbr_95   : CBR @ 95% Proctor (essais_cbr, n_coups=55)
  gamma_d  : densite seche max OPM (essais_proctor, kN/m3 -> g/cm3)
  w_opt    : teneur en eau optimale OPM (essais_proctor)
  em_mpa   : module pressiometrique Em (essais_pressiometre)
  pl_mpa   : pression limite Pl (essais_pressiometre)

Stratification par h_canon (H1/H2/H3) au lieu de depth_m fixe.
Suit exactement le meme pattern que run_ked_vbs_ip_wl_wp_horizons.py.

Usage:
  python run_ked_new_params_horizons.py --database-url postgresql://... --kinds rd_mpa,cbr_95
  python run_ked_new_params_horizons.py --database-url postgresql://... --kinds all
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import psycopg2
from psycopg2.extras import execute_batch
from pykrige.ok import OrdinaryKriging
from sklearn.metrics import mean_absolute_error, mean_squared_error

DB_DEFAULT = os.environ.get("DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean")

# Horizons canoniques -> (label, h_canon_key, depth_m_ref)
HORIZONS: List[Tuple[str, str, float]] = [
    ("h1", "H1", 0.5),
    ("h2", "H2", 1.25),
    ("h3", "H3", 2.0),
]


def json_safe(obj: Any) -> str:
    def scrub(x: Any) -> Any:
        if isinstance(x, float):
            return None if (math.isnan(x) or math.isinf(x)) else x
        if isinstance(x, dict):
            return {k: scrub(v) for k, v in x.items()}
        if isinstance(x, (list, tuple)):
            return [scrub(v) for v in x]
        return x
    return json.dumps(scrub(obj), allow_nan=False)


def _extract_ok_params(ok_obj) -> Dict[str, Optional[float]]:
    try:
        params = ok_obj.variogram_model_parameters
        if params is not None and len(params) >= 3:
            partial_sill = float(params[0])
            rng = float(params[1])
            nugget = float(params[2])
            sill = partial_sill + nugget
            rng_m = rng * 111000.0 if rng < 10 else rng
            return {"nugget": nugget, "sill": sill, "range_m": rng_m}
    except Exception:
        pass
    return {}


def fallback_kriging(x, y, values, gx, gy):
    models = ("spherical", "exponential", "gaussian", "linear")
    for m in models:
        try:
            ok = OrdinaryKriging(
                x, y, values,
                variogram_model=m,
                nlags=15, weight=True,
                verbose=False, enable_plotting=False,
                coordinates_type="geographic",
            )
            z, ss = ok.execute("points", gx, gy)
            zv = np.asarray(z, dtype=np.float64).ravel()
            sv = np.asarray(ss, dtype=np.float64).ravel()
            if np.isfinite(zv).sum() > 0:
                return zv, sv, m, _extract_ok_params(ok)
        except Exception:
            continue
    return np.full(gx.shape[0], np.nan), np.full(gx.shape[0], np.nan), "spherical", {}


def loo_rmse_residual(x, y, resid) -> Dict[str, float]:
    n = len(resid)
    if n < 6:
        return {"rmse": float("nan"), "mae": float("nan"), "n": float(n)}
    preds, truths = [], []
    for i in range(n):
        mask = np.ones(n, dtype=bool); mask[i] = False
        try:
            ok = OrdinaryKriging(x[mask], y[mask], resid[mask],
                                 variogram_model="spherical",
                                 verbose=False, enable_plotting=False,
                                 coordinates_type="geographic")
            z, _ = ok.execute("points", np.array([x[i]]), np.array([y[i]]))
            preds.append(float(z[0])); truths.append(float(resid[i]))
        except Exception:
            continue
    if len(preds) < 4:
        return {"rmse": float("nan"), "mae": float("nan"), "n": float(n)}
    p = np.array(preds); t = np.array(truths)
    return {
        "rmse": float(np.sqrt(mean_squared_error(t, p))),
        "mae": float(mean_absolute_error(t, p)),
        "n": float(n),
    }


@dataclass(frozen=True)
class NewParamCfg:
    kind: str         # rd_mpa | cbr_95 | gamma_d | w_opt | em_mpa | pl_mpa
    source_table: str
    join_sql: str      # JOIN fragment (alias = np_tbl)
    value_sql: str     # SQL expression for the value (float)
    where_sql: str     # SQL predicate
    physical_min: float
    physical_max: float
    unit: str
    category: str = "geotech"
    min_pts: int = 10


# Catalogue des nouveaux parametres V11
NEW_PARAM_CONFIGS: List[NewParamCfg] = [
    NewParamCfg(
        kind="rd_mpa",
        source_table="essais_penetrometre",
        join_sql="JOIN atlas.essais_penetrometre np_tbl ON np_tbl.echantillon_id = e.id",
        value_sql="np_tbl.rd_mpa::float8",
        # Rd > 50 MPa (cuirasse/laterite profonde) est physiquement possible
        # Rd de 100+ MPa mesure sur TOH_PD3/LOGOTE confirme dans CSV source
        where_sql="np_tbl.rd_mpa IS NOT NULL AND np_tbl.rd_mpa > 0 AND np_tbl.rd_mpa <= 120",
        physical_min=0.0,
        physical_max=120.0,
        unit="MPa",
        category="geotech",
        min_pts=10,
    ),
    NewParamCfg(
        kind="cbr_95",
        source_table="essais_cbr",
        # n_coups=55 = 95% Proctor (ASTM D1557 std modifie)
        join_sql="JOIN atlas.essais_cbr np_tbl ON np_tbl.echantillon_id = e.id AND np_tbl.n_coups = 55",
        value_sql="np_tbl.cbr_pct::float8",
        where_sql="np_tbl.cbr_pct IS NOT NULL AND np_tbl.cbr_pct >= 0",
        physical_min=0.0,
        physical_max=100.0,
        unit="%",
        category="portance",
        min_pts=10,
    ),
    NewParamCfg(
        kind="gamma_d",
        source_table="essais_proctor",
        join_sql="JOIN atlas.essais_proctor np_tbl ON np_tbl.echantillon_id = e.id",
        # gamma_d_max stocke en kN/m3 (× 10 lors import), convertir en g/cm3 (÷ 10)
        # DB range: [17.4, 23.3] kN/m3 → [1.74, 2.33] g/cm3 — all valid
        value_sql="(np_tbl.gamma_d_max / 10.0)::float8",
        where_sql="np_tbl.gamma_d_max IS NOT NULL AND np_tbl.gamma_d_max BETWEEN 14 AND 25",
        physical_min=1.4,
        physical_max=2.5,
        unit="g/cm3",
        category="compacite",
        min_pts=10,
    ),
    NewParamCfg(
        kind="w_opt",
        source_table="essais_proctor",
        join_sql="JOIN atlas.essais_proctor np_tbl ON np_tbl.echantillon_id = e.id",
        # Colonne reelle : w_opt (pas w_opt_pct)
        value_sql="np_tbl.w_opt::float8",
        where_sql="np_tbl.w_opt IS NOT NULL AND np_tbl.w_opt BETWEEN 0 AND 50",
        physical_min=0.0,
        physical_max=50.0,
        unit="%",
        category="compacite",
        min_pts=10,
    ),
    NewParamCfg(
        kind="em_mpa",
        source_table="essais_pressiometre",
        join_sql="JOIN atlas.essais_pressiometre np_tbl ON np_tbl.echantillon_id = e.id",
        value_sql="np_tbl.em_mpa::float8",
        where_sql="np_tbl.em_mpa IS NOT NULL AND np_tbl.em_mpa > 0",
        physical_min=0.0,
        physical_max=200.0,
        unit="MPa",
        category="geotech",
        min_pts=5,  # donnees rares
    ),
    NewParamCfg(
        kind="pl_mpa",
        source_table="essais_pressiometre",
        join_sql="JOIN atlas.essais_pressiometre np_tbl ON np_tbl.echantillon_id = e.id",
        value_sql="np_tbl.pl_mpa::float8",
        where_sql="np_tbl.pl_mpa IS NOT NULL AND np_tbl.pl_mpa > 0",
        physical_min=0.0,
        physical_max=5.0,
        unit="MPa",
        category="geotech",
        min_pts=5,
    ),
]

KIND_MAP: Dict[str, NewParamCfg] = {c.kind: c for c in NEW_PARAM_CONFIGS}


def ensure_param(cur, pid: str, cfg: NewParamCfg) -> None:
    cur.execute("SELECT 1 FROM atlas.ai_parameter_catalog WHERE parameter_id=%s LIMIT 1", (pid,))
    if cur.fetchone():
        return
    cur.execute(
        """
        INSERT INTO atlas.ai_parameter_catalog
          (parameter_id, category, source, unit, interpolation_enabled,
           prediction_enabled, is_active, source_table, physical_min, physical_max,
           depth_stratified, is_derived, derived_from, min_pts_stratified, min_pts_rk)
        VALUES
          (%s, %s, 'interpolation', %s, TRUE, FALSE, TRUE,
           %s, %s, %s, TRUE, FALSE, '{}'::text[], %s, %s)
        ON CONFLICT (parameter_id) DO NOTHING
        """,
        (pid, cfg.category, cfg.unit, cfg.source_table,
         cfg.physical_min, cfg.physical_max, cfg.min_pts, cfg.min_pts * 2),
    )


def _has_contexte_view(cur) -> bool:
    cur.execute(
        "SELECT 1 FROM pg_matviews WHERE schemaname='atlas' AND matviewname='v_contexte_geologique' LIMIT 1"
    )
    return cur.fetchone() is not None


def load_grid(cur) -> List[Tuple[str, float, float, str]]:
    if _has_contexte_view(cur):
        cur.execute("""
            SELECT v.maille_id,
              ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8,
              ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8,
              v.contexte_complet
            FROM atlas.v_contexte_geologique v
            JOIN atlas.mailles m ON m.id::text = v.maille_id
        """)
    else:
        cur.execute("""
            SELECT m.id::text,
              ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8,
              ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8,
              COALESCE(up.type_sol, 'UNKNOWN')
            FROM atlas.mailles m
            LEFT JOIN LATERAL (
              SELECT p.type_sol FROM atlas.unites_pedologiques p
              WHERE ST_Contains(p.geom, ST_PointOnSurface(m.geom)) LIMIT 1
            ) up ON TRUE
        """)
    return [(str(a), float(b), float(c), str(d or "UNKNOWN")) for a, b, c, d in cur.fetchall()]


def load_training_points(
    cur, cfg: NewParamCfg, h_canon: str
) -> List[Tuple[str, float, float, float, str]]:
    """
    Charge les points d'entrainement pour un horizon canonique.
    Filtre par e.h_canon = h_canon ('H1'|'H2'|'H3').
    """
    ctx_join = """LEFT JOIN LATERAL (
        SELECT p.type_sol FROM atlas.unites_pedologiques p
        WHERE ST_Contains(p.geom, ST_PointOnSurface(m.geom)) LIMIT 1
    ) up ON TRUE"""
    ctx_col = "COALESCE(up.type_sol, s.type_sol, 'UNKNOWN') AS contexte"

    query = f"""
        SELECT
          m.id::text AS maille_id,
          ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lon,
          ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lat,
          {cfg.value_sql} AS val,
          {ctx_col}
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id = s.id
        {cfg.join_sql}
        JOIN atlas.mailles m ON m.code = s.maille_code
        {ctx_join}
        WHERE s.deleted_at IS NULL
          AND e.h_canon = %s
          AND {cfg.where_sql}
    """
    cur.execute(query, (h_canon,))
    out = []
    for row in cur.fetchall():
        mid, lon, lat, val, tsol = row
        if val is None:
            continue
        try:
            flon, flat, fval = float(lon), float(lat), float(val)
        except (TypeError, ValueError):
            continue
        if not (math.isfinite(flon) and math.isfinite(flat) and math.isfinite(fval)):
            continue
        out.append((str(mid), flon, flat, fval, str(tsol or "UNKNOWN")))
    return out


def compute_pedological_priors(vals, contexts, global_mean: float):
    priors: Dict[str, float] = {}
    counts: Dict[str, int] = {}
    for ts in set(contexts):
        sel = [vals[i] for i in range(len(vals)) if contexts[i] == ts]
        if sel:
            priors[ts] = float(np.mean(sel))
            counts[ts] = len(sel)
    return priors, counts


def run_one(conn, horizon_label: str, h_canon: str, depth_m_ref: float, cfg: NewParamCfg):
    """KED runner pour un (parametre, horizon)."""
    param_id = f"{cfg.kind}_ked_{horizon_label}"
    cur = conn.cursor()
    ensure_param(cur, param_id, cfg)

    train = load_training_points(cur, cfg, h_canon)
    if len(train) < cfg.min_pts:
        print(f"  [{param_id}] SKIP — seulement {len(train)} pts (min={cfg.min_pts})")
        cur.close()
        return {"ok": False, "parameter": param_id, "reason": "insufficient_training_points",
                "n_train": len(train)}

    mids = [r[0] for r in train]
    x    = np.array([r[1] for r in train], dtype=np.float64)
    y    = np.array([r[2] for r in train], dtype=np.float64)
    vals = np.array([r[3] for r in train], dtype=np.float64)
    ctx_train = [r[4] for r in train]

    grid = load_grid(cur)
    gx   = np.array([r[1] for r in grid], dtype=np.float64)
    gy   = np.array([r[2] for r in grid], dtype=np.float64)
    gmids = [r[0] for r in grid]
    ctx_grid = [r[3] for r in grid]

    global_mean = float(np.mean(vals))
    priors, counts = compute_pedological_priors(vals, ctx_train, global_mean)

    drift_train = np.array([priors.get(ts, global_mean) for ts in ctx_train], dtype=np.float64)
    drift_grid  = np.array([priors.get(ts, global_mean) for ts in ctx_grid],  dtype=np.float64)
    drift_method = "pedological_prior"

    residuals = vals - drift_train
    z_res, z_var, model_used, ok_params = fallback_kriging(x, y, residuals, gx, gy)
    z_pred = np.clip(z_res + drift_grid, cfg.physical_min, cfg.physical_max)

    var_base = float(np.nanvar(vals)) if np.isfinite(np.nanvar(vals)) else 1.0
    confidence = (1.0 / (1.0 + (z_var / max(var_base, 1e-6)))) * 100.0

    loo = loo_rmse_residual(x, y, residuals)
    run_id = str(uuid.uuid4())
    variogram_id = str(uuid.uuid4())
    method_tag = f"ked_{drift_method}"

    cur.execute(
        """
        INSERT INTO atlas.ai_interpolation_runs
          (id, run_type, parameter_id, method, model_version, status, metrics,
           started_at, finished_at, zone_id, kriging_domain_id)
        VALUES
          (%s, 'kriging', %s, %s, 'v2', 'finished', %s::jsonb, now(), now(), NULL, NULL)
        """,
        (run_id, param_id, method_tag, json_safe({
            "horizon_label": horizon_label,
            "h_canon": h_canon,
            "depth_m_ref": depth_m_ref,
            "param_kind": cfg.kind,
            "source_table": cfg.source_table,
            "n_train": int(len(vals)),
            "n_grid": int(len(gmids)),
            "loo_residual": loo,
            "model_used": model_used,
            "drift_method": drift_method,
            "global_mean": global_mean,
        })),
    )

    cur.execute(
        """
        INSERT INTO atlas.ai_variograms
          (id, parameter_id, zone_id, model_type, range_m, sill, nugget,
           anisotropy_ratio, anisotropy_angle_deg, fit_quality, created_at,
           kriging_domain_id, loo_rmse)
        VALUES
          (%s, %s, NULL, %s, %s, %s, %s, NULL, NULL, %s::jsonb, now(), NULL, %s)
        """,
        (variogram_id, param_id, model_used,
         ok_params.get("range_m"), ok_params.get("sill"), ok_params.get("nugget"),
         json_safe({"horizon_label": horizon_label, "h_canon": h_canon, "model": model_used}),
         None if not math.isfinite(float(loo.get("rmse", float("nan")))) else float(loo["rmse"])),
    )

    cur.execute("DELETE FROM atlas.ai_interpolation_values WHERE parameter_id = %s", (param_id,))
    rows = [
        (str(uuid.uuid4()), mid, param_id,
         float(z_pred[i]) if math.isfinite(float(z_pred[i])) else None,
         max(0.0, float(z_var[i])) if math.isfinite(float(z_var[i])) else None,
         float(confidence[i]) if math.isfinite(float(confidence[i])) else None,
         method_tag, variogram_id, run_id)
        for i, mid in enumerate(gmids)
    ]
    execute_batch(
        cur,
        """
        INSERT INTO atlas.ai_interpolation_values
          (id, maille_id, zone_id, kriging_domain_id, parameter_id, value,
           variance, confidence, method, variogram_id, run_id, created_at)
        VALUES (%s::uuid, %s::uuid, NULL, NULL, %s, %s, %s, %s, %s, %s::uuid, %s::uuid, now())
        """,
        rows, page_size=1000,
    )

    # Persist priors
    horizon_key = horizon_label.upper()
    cur.execute("DELETE FROM atlas.pedological_drift_priors WHERE parameter_id=%s AND horizon_label=%s",
                (param_id, horizon_key))
    prior_rows = [
        (param_id, horizon_key, depth_m_ref, ts, float(v), int(counts.get(ts, 0)))
        for ts, v in priors.items()
    ]
    if prior_rows:
        execute_batch(
            cur,
            """
            INSERT INTO atlas.pedological_drift_priors
              (parameter_id, horizon_label, depth_m, type_sol, drift_value, n_points,
               computed_at, source_label)
            VALUES (%s, %s, %s, %s, %s, %s, now(), 'run_ked_new_params_horizons.py')
            """,
            prior_rows, page_size=200,
        )

    conn.commit()
    cur.close()

    print(f"  OK [{param_id}] n_train={len(vals)} n_grid={len(gmids)} "
          f"LOO-RMSE={loo.get('rmse', float('nan')):.4f} model={model_used}")
    return {
        "ok": True, "parameter": param_id, "horizon": horizon_key,
        "h_canon": h_canon, "depth_m_ref": depth_m_ref,
        "n_train": int(len(vals)), "n_grid": int(len(gmids)),
        "loo_residual_rmse": loo.get("rmse"), "variogram_model": model_used,
        "run_id": run_id,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="KED V11 — nouveaux parametres geotechniques")
    parser.add_argument("--database-url", default=DB_DEFAULT)
    parser.add_argument(
        "--kinds", default="all",
        help="Virgule-separated list: rd_mpa,cbr_95,gamma_d,w_opt,em_mpa,pl_mpa ou 'all'"
    )
    parser.add_argument(
        "--horizons", default="h1,h2,h3",
        help="Horizons a calculer (h1,h2,h3)"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Afficher les configs sans executer les calculs")
    args = parser.parse_args()

    # Selection des parametres
    if args.kinds.lower() == "all":
        selected_kinds = list(KIND_MAP.keys())
    else:
        selected_kinds = [k.strip() for k in args.kinds.split(",")]

    selected_horizons = [h.strip().lower() for h in args.horizons.split(",")]
    horizon_map = {lbl: (hc, dm) for lbl, hc, dm in HORIZONS}

    print(f"=== KED Nouveaux Parametres V11 ===")
    print(f"Parametres : {selected_kinds}")
    print(f"Horizons   : {selected_horizons}")
    print(f"DB         : {args.database_url[:40]}...")

    if args.dry_run:
        for kind in selected_kinds:
            if kind not in KIND_MAP:
                print(f"  [WARN] Parametre inconnu : {kind}")
                continue
            cfg = KIND_MAP[kind]
            for hl in selected_horizons:
                if hl not in horizon_map:
                    continue
                hc, dm = horizon_map[hl]
                pid = f"{kind}_ked_{hl}"
                print(f"  DRY-RUN : {pid} | table={cfg.source_table} | "
                      f"h_canon={hc} | range=[{cfg.physical_min},{cfg.physical_max}] {cfg.unit}")
        return 0

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False

    results = []
    errors  = []

    for kind in selected_kinds:
        if kind not in KIND_MAP:
            print(f"  [WARN] Parametre inconnu : {kind} — skip")
            continue
        cfg = KIND_MAP[kind]
        for hl in selected_horizons:
            if hl not in horizon_map:
                print(f"  [WARN] Horizon inconnu : {hl} — skip")
                continue
            hc, dm = horizon_map[hl]
            print(f"\n--- {kind} horizon {hl.upper()} (h_canon={hc}) ---")
            try:
                r = run_one(conn, hl, hc, dm, cfg)
                results.append(r)
            except Exception as exc:
                print(f"  ERR [{kind} {hl}] : {exc}", file=sys.stderr)
                try:
                    conn.rollback()
                except Exception:
                    pass
                errors.append({"kind": kind, "horizon": hl, "error": str(exc)})

    conn.close()

    print(f"\n=== BILAN ===")
    ok_count = sum(1 for r in results if r.get("ok"))
    skip_count = sum(1 for r in results if not r.get("ok"))
    print(f"  Reussis : {ok_count}")
    print(f"  Ignores (pas assez de pts) : {skip_count}")
    print(f"  Erreurs : {len(errors)}")
    for r in results:
        if r.get("ok"):
            rmse = r.get("loo_residual_rmse")
            rmse_s = f"{rmse:.4f}" if rmse and math.isfinite(rmse) else "N/A"
            print(f"  OK  {r['parameter']:<30} n_train={r['n_train']:4d} LOO-RMSE={rmse_s}")
    for r in errors:
        print(f"  ERR {r['kind']}_{r['horizon']} : {r['error']}")

    return len(errors)


if __name__ == "__main__":
    sys.exit(main())
