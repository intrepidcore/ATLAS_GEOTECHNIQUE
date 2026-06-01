#!/usr/bin/env python3
"""
run_ked_new_params_horizons.py  — VERSION 2 (hierarchique corrige)
KED pour parametres V11 : rd_mpa, cbr_95, gamma_d, w_opt, em_mpa, pl_mpa.

Corrections v2 :
  - Drift HIERARCHICAL_5LEVELS quand v_contexte_geologique disponible (meme logique
    que run_ked_vbs_ip_wl_wp_horizons.py)
  - LOO-RMSE clip sur physical range -> evite RMSE > physical_max
  - Verbose stdout pour suivre l'avancement
  - Snapshot tag pour tracabilite avant/apres import de nouveaux sondages
  - Stratification par e.h_canon (H1/H2/H3) comme dans le reste du systeme

Usage:
  python run_ked_new_params_horizons.py --kinds all --horizons h1,h2,h3
  python run_ked_new_params_horizons.py --kinds rd_mpa,cbr_95 --horizons h1
  python run_ked_new_params_horizons.py --kinds all --snapshot-tag pre_trec_import
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import psycopg2
from psycopg2.extras import execute_batch
from pykrige.ok import OrdinaryKriging
from sklearn.metrics import mean_absolute_error, mean_squared_error

DB_DEFAULT = os.environ.get(
    "DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
)

# Horizons canoniques -> (label, h_canon_key, depth_m_ref)
HORIZONS: List[Tuple[str, str, float]] = [
    ("h1", "H1", 0.5),
    ("h2", "H2", 1.25),
    ("h3", "H3", 2.0),
]

SCRIPT_VERSION = "v2_hierarchical"


# ---------------------------------------------------------------------------
# Utilitaires JSON
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Variogramme / krigeage
# ---------------------------------------------------------------------------

def _extract_ok_params(ok_obj) -> Dict[str, Optional[float]]:
    try:
        params = ok_obj.variogram_model_parameters
        if params is not None and len(params) >= 3:
            partial_sill = float(params[0])
            rng          = float(params[1])
            nugget       = float(params[2])
            sill         = partial_sill + nugget
            rng_m        = rng * 111000.0 if rng < 10 else rng
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
            zv = np.asarray(z,  dtype=np.float64).ravel()
            sv = np.asarray(ss, dtype=np.float64).ravel()
            if np.isfinite(zv).sum() > 0:
                return zv, sv, m, _extract_ok_params(ok)
        except Exception:
            continue
    return (
        np.full(gx.shape[0], np.nan),
        np.full(gx.shape[0], np.nan),
        "spherical",
        {},
    )


def loo_rmse_residual(
    x, y, resid,
    physical_min: float = -1e9,
    physical_max: float =  1e9,
) -> Dict[str, float]:
    """
    LOO-RMSE sur les residus.
    Les predictions hors [physical_min, physical_max] sont clippees AVANT calcul
    pour eviter des RMSE impossibles (ex: rd_mpa H3 RMSE > physical_max=120).
    """
    n = len(resid)
    if n < 6:
        return {"rmse": float("nan"), "mae": float("nan"), "n": float(n)}
    preds, truths = [], []
    for i in range(n):
        mask = np.ones(n, dtype=bool)
        mask[i] = False
        try:
            ok = OrdinaryKriging(
                x[mask], y[mask], resid[mask],
                variogram_model="spherical",
                verbose=False, enable_plotting=False,
                coordinates_type="geographic",
            )
            z, _ = ok.execute("points", np.array([x[i]]), np.array([y[i]]))
            pred = float(np.clip(z[0], physical_min, physical_max))
            preds.append(pred)
            truths.append(float(resid[i]))
        except Exception:
            continue
    if len(preds) < 4:
        return {"rmse": float("nan"), "mae": float("nan"), "n": float(n)}
    p = np.array(preds)
    t = np.array(truths)
    return {
        "rmse": float(np.sqrt(mean_squared_error(t, p))),
        "mae":  float(mean_absolute_error(t, p)),
        "n":    float(n),
    }


# ---------------------------------------------------------------------------
# Derive hierarchique (identique a run_ked_vbs_ip_wl_wp_horizons.py)
# ---------------------------------------------------------------------------

def compute_hierarchical_prior(
    train_values: np.ndarray,
    train_contexts: List[str],
    min_pts: int = 5,
) -> Dict[str, float]:
    """
    Derive hierarchique 5 niveaux (ZONE|PEDO|RISQUE|GEO).
    Repli progressif jusqu'a la moyenne globale.
    """
    global_mean = float(np.mean(train_values))
    priors: Dict[str, float] = {}

    # Niveau 1 : contexte complet
    for ctx in set(train_contexts):
        idx = [i for i, c in enumerate(train_contexts) if c == ctx]
        if len(idx) >= min_pts:
            priors[ctx] = float(np.mean([train_values[i] for i in idx]))

    # Niveau 2 : zone + pedologie (2 premiers segments)
    for ctx in set(train_contexts):
        if ctx not in priors:
            parent = "|".join(ctx.split("|")[:2])
            idx = [i for i, c in enumerate(train_contexts) if c.startswith(parent)]
            if len(idx) >= min_pts:
                priors[ctx] = float(np.mean([train_values[i] for i in idx]))

    # Niveau 3 : pedologie seule (2e segment)
    for ctx in set(train_contexts):
        if ctx not in priors:
            parts = ctx.split("|")
            ped   = parts[1] if len(parts) > 1 else ctx
            idx   = [
                i for i, c in enumerate(train_contexts)
                if (c.split("|")[1] if len(c.split("|")) > 1 else c) == ped
            ]
            if len(idx) >= min_pts:
                priors[ctx] = float(np.mean([train_values[i] for i in idx]))
            else:
                priors[ctx] = global_mean   # repli ultime

    return priors


# ---------------------------------------------------------------------------
# Config parametres V11
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class NewParamCfg:
    kind: str
    source_table: str
    join_sql: str       # JOIN fragment (alias = np_tbl)
    value_sql: str      # SQL expression pour la valeur (float)
    where_sql: str      # predicat SQL
    physical_min: float
    physical_max: float
    unit: str
    category: str = "geotech"
    min_pts: int = 10


NEW_PARAM_CONFIGS: List[NewParamCfg] = [
    NewParamCfg(
        kind="rd_mpa",
        source_table="essais_penetrometre",
        join_sql="JOIN atlas.essais_penetrometre np_tbl ON np_tbl.echantillon_id = e.id",
        value_sql="np_tbl.rd_mpa::float8",
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
        min_pts=5,
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


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _has_contexte_view(cur) -> bool:
    cur.execute(
        "SELECT 1 FROM pg_matviews WHERE schemaname='atlas' "
        "AND matviewname='v_contexte_geologique' LIMIT 1"
    )
    return cur.fetchone() is not None


def ensure_param(cur, pid: str, cfg: NewParamCfg) -> None:
    cur.execute(
        "SELECT 1 FROM atlas.ai_parameter_catalog WHERE parameter_id=%s LIMIT 1",
        (pid,),
    )
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
        (
            pid, cfg.category, cfg.unit, cfg.source_table,
            cfg.physical_min, cfg.physical_max,
            cfg.min_pts, cfg.min_pts * 2,
        ),
    )


def load_grid(cur, use_hierarchical: bool) -> List[Tuple[str, float, float, str]]:
    if use_hierarchical:
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
    return [
        (str(a), float(b), float(c), str(d or "UNKNOWN"))
        for a, b, c, d in cur.fetchall()
    ]


def load_training_points(
    cur, cfg: NewParamCfg, h_canon: str, use_hierarchical: bool
) -> List[Tuple[str, float, float, float, str]]:
    """
    Charge les points d'entrainement pour un horizon canonique.
    Si use_hierarchical=True, joint v_contexte_geologique pour la derive 5 niveaux.
    """
    if use_hierarchical:
        ctx_join = "JOIN atlas.v_contexte_geologique vc ON vc.maille_id = m.id::text"
        ctx_col  = "COALESCE(vc.contexte_complet, 'UNKNOWN') AS contexte"
    else:
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
        mid, lon, lat, val, ctx = row
        if val is None:
            continue
        try:
            flon, flat, fval = float(lon), float(lat), float(val)
        except (TypeError, ValueError):
            continue
        if not (math.isfinite(flon) and math.isfinite(flat) and math.isfinite(fval)):
            continue
        out.append((str(mid), flon, flat, fval, str(ctx or "UNKNOWN")))
    return out


# ---------------------------------------------------------------------------
# Runner principal
# ---------------------------------------------------------------------------

def run_one(
    conn, horizon_label: str, h_canon: str, depth_m_ref: float,
    cfg: NewParamCfg, use_hierarchical: bool, snapshot_tag: Optional[str] = None,
):
    """KED runner pour un (parametre, horizon) — v2 hierarchique."""
    param_id = f"{cfg.kind}_ked_{horizon_label}"
    t0 = time.time()
    cur = conn.cursor()
    ensure_param(cur, param_id, cfg)

    print(f"  [LOAD] points d'entrainement {param_id} (h_canon={h_canon}) ...", flush=True)
    train = load_training_points(cur, cfg, h_canon, use_hierarchical)
    print(f"  [LOAD] {len(train)} points trouves", flush=True)

    if len(train) < cfg.min_pts:
        print(f"  [SKIP] {param_id} — {len(train)} pts < min={cfg.min_pts}", flush=True)
        cur.close()
        return {
            "ok": False, "parameter": param_id,
            "reason": "insufficient_training_points", "n_train": len(train),
        }

    mids       = [r[0] for r in train]
    x          = np.array([r[1] for r in train], dtype=np.float64)
    y          = np.array([r[2] for r in train], dtype=np.float64)
    vals       = np.array([r[3] for r in train], dtype=np.float64)
    ctx_train  = [r[4] for r in train]

    print(f"  [GRID] chargement de la grille ...", flush=True)
    grid  = load_grid(cur, use_hierarchical)
    gx    = np.array([r[1] for r in grid], dtype=np.float64)
    gy    = np.array([r[2] for r in grid], dtype=np.float64)
    gmids = [r[0] for r in grid]
    ctx_grid = [r[3] for r in grid]
    print(f"  [GRID] {len(grid)} mailles", flush=True)

    global_mean = float(np.mean(vals))
    print(f"  [DRIFT] methode={'hierarchical_5levels' if use_hierarchical else 'pedological_prior'} "
          f"| mean={global_mean:.4f} | contextes_uniques={len(set(ctx_train))}", flush=True)

    if use_hierarchical:
        priors = compute_hierarchical_prior(vals, ctx_train, min_pts=5)
        counts: Dict[str, int] = {
            ctx: sum(1 for c in ctx_train if c == ctx)
            for ctx in set(ctx_train)
        }
        drift_method = "hierarchical_5levels"
    else:
        priors = {}
        counts = {}
        for ts in sorted(set(ctx_train)):
            sel = [vals[i] for i in range(len(vals)) if ctx_train[i] == ts]
            if sel:
                priors[ts] = float(np.mean(sel))
                counts[ts] = len(sel)
        drift_method = "pedological_prior"

    drift_train = np.array([priors.get(c, global_mean) for c in ctx_train], dtype=np.float64)
    drift_grid  = np.array([priors.get(c, global_mean) for c in ctx_grid],  dtype=np.float64)
    residuals   = vals - drift_train

    print(f"  [KED] variogramme sur residus (n={len(residuals)}) ...", flush=True)
    z_res, z_var, model_used, ok_params = fallback_kriging(x, y, residuals, gx, gy)
    z_pred = np.clip(z_res + drift_grid, cfg.physical_min, cfg.physical_max)
    print(f"  [KED] modele={model_used} | range_m={ok_params.get('range_m', 'N/A')}", flush=True)

    var_base   = float(np.nanvar(vals)) if np.isfinite(np.nanvar(vals)) else 1.0
    confidence = (1.0 / (1.0 + (z_var / max(var_base, 1e-6)))) * 100.0

    print(f"  [LOO] calcul LOO-RMSE (n={len(residuals)} points) ...", flush=True)
    loo = loo_rmse_residual(
        x, y, residuals,
        physical_min=cfg.physical_min,
        physical_max=cfg.physical_max,
    )
    rmse_str = f"{loo['rmse']:.4f}" if math.isfinite(loo.get("rmse", float("nan"))) else "N/A"
    print(f"  [LOO] LOO-RMSE={rmse_str} | MAE={loo.get('mae', 'N/A')}", flush=True)

    run_id       = str(uuid.uuid4())
    variogram_id = str(uuid.uuid4())
    method_tag   = f"ked_{drift_method}"

    meta_payload = {
        "horizon_label":  horizon_label,
        "h_canon":        h_canon,
        "depth_m_ref":    depth_m_ref,
        "param_kind":     cfg.kind,
        "source_table":   cfg.source_table,
        "n_train":        int(len(vals)),
        "n_grid":         int(len(gmids)),
        "loo_residual":   loo,
        "model_used":     model_used,
        "drift_method":   drift_method,
        "drift_priors":   priors,
        "global_mean":    global_mean,
        "script_version": SCRIPT_VERSION,
    }
    if snapshot_tag:
        meta_payload["snapshot_tag"] = snapshot_tag

    print(f"  [DB] insert ai_interpolation_runs ...", flush=True)
    cur.execute(
        """
        INSERT INTO atlas.ai_interpolation_runs
          (id, run_type, parameter_id, method, model_version, status, metrics,
           started_at, finished_at, zone_id, kriging_domain_id)
        VALUES
          (%s, 'kriging', %s, %s, %s, 'finished', %s::jsonb, now(), now(), NULL, NULL)
        """,
        (run_id, param_id, method_tag, SCRIPT_VERSION, json_safe(meta_payload)),
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
        (
            variogram_id, param_id, model_used,
            ok_params.get("range_m"), ok_params.get("sill"), ok_params.get("nugget"),
            json_safe({"horizon_label": horizon_label, "h_canon": h_canon, "model": model_used}),
            None if not math.isfinite(float(loo.get("rmse", float("nan")))) else float(loo["rmse"]),
        ),
    )

    print(f"  [DB] suppression valeurs precedentes ...", flush=True)
    cur.execute(
        "DELETE FROM atlas.ai_interpolation_values WHERE parameter_id = %s",
        (param_id,),
    )

    rows = []
    for i, mid in enumerate(gmids):
        v = float(z_pred[i]) if math.isfinite(float(z_pred[i])) else None
        s = max(0.0, float(z_var[i])) if math.isfinite(float(z_var[i])) else None
        c = float(confidence[i]) if math.isfinite(float(confidence[i])) else None
        rows.append((str(uuid.uuid4()), mid, param_id, v, s, c, method_tag, variogram_id, run_id))

    print(f"  [DB] insert {len(rows)} valeurs interpolees ...", flush=True)
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

    # Persist priors dans pedological_drift_priors pour tracabilite
    horizon_key = horizon_label.upper()
    cur.execute(
        "DELETE FROM atlas.pedological_drift_priors "
        "WHERE parameter_id=%s AND horizon_label=%s",
        (param_id, horizon_key),
    )
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
            VALUES (%s, %s, %s, %s, %s, %s, now(),
                    'run_ked_new_params_horizons_v2')
            """,
            prior_rows, page_size=200,
        )

    conn.commit()
    cur.close()
    elapsed = time.time() - t0

    print(
        f"  [DONE] {param_id} | drift={drift_method} | n_train={len(vals)} "
        f"| n_grid={len(gmids)} | LOO-RMSE={rmse_str} | model={model_used} "
        f"| {elapsed:.1f}s",
        flush=True,
    )
    return {
        "ok":              True,
        "parameter":       param_id,
        "horizon":         horizon_key,
        "h_canon":         h_canon,
        "depth_m_ref":     depth_m_ref,
        "n_train":         int(len(vals)),
        "n_grid":          int(len(gmids)),
        "loo_rmse":        loo.get("rmse"),
        "variogram_model": model_used,
        "drift_method":    drift_method,
        "run_id":          run_id,
        "elapsed_s":       round(elapsed, 1),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="KED V11 — nouveaux parametres geotechniques (v2 hierarchique)"
    )
    parser.add_argument("--database-url", default=DB_DEFAULT)
    parser.add_argument(
        "--kinds", default="all",
        help="rd_mpa,cbr_95,gamma_d,w_opt,em_mpa,pl_mpa ou 'all'",
    )
    parser.add_argument(
        "--horizons", default="h1,h2,h3",
        help="Horizons : h1,h2,h3",
    )
    parser.add_argument(
        "--snapshot-tag", default=None,
        help="Tag de tracabilite stocke dans metrics.snapshot_tag (ex: pre_trec_import)",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    selected_kinds    = list(KIND_MAP.keys()) if args.kinds.lower() == "all" \
                        else [k.strip() for k in args.kinds.split(",")]
    selected_horizons = [h.strip().lower() for h in args.horizons.split(",")]
    horizon_map       = {lbl: (hc, dm) for lbl, hc, dm in HORIZONS}

    print("=" * 60)
    print(f"KED Nouveaux Parametres V11  [{SCRIPT_VERSION}]")
    print(f"  Parametres : {selected_kinds}")
    print(f"  Horizons   : {selected_horizons}")
    print(f"  DB         : {args.database_url[:55]}...")
    if args.snapshot_tag:
        print(f"  Snapshot   : {args.snapshot_tag}")
    print("=" * 60)

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
                print(
                    f"  DRY-RUN  {kind}_ked_{hl:<6} | table={cfg.source_table} "
                    f"| h_canon={hc} | range=[{cfg.physical_min},{cfg.physical_max}] {cfg.unit}"
                )
        return 0

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False

    # Detecter si la derive hierarchique est disponible
    cur = conn.cursor()
    use_hierarchical = _has_contexte_view(cur)
    cur.close()
    drift_label = "hierarchical_5levels" if use_hierarchical else "pedological_prior"
    print(f"\n  Mode derive : {drift_label} "
          f"({'v_contexte_geologique disponible' if use_hierarchical else 'fallback pedologique'})\n")

    results: List[Dict] = []
    errors:  List[Dict] = []

    for kind in selected_kinds:
        if kind not in KIND_MAP:
            print(f"\n[WARN] Parametre inconnu : {kind} — skip")
            continue
        cfg = KIND_MAP[kind]
        for hl in selected_horizons:
            if hl not in horizon_map:
                print(f"[WARN] Horizon inconnu : {hl} — skip")
                continue
            hc, dm = horizon_map[hl]
            print(f"\n{'='*55}")
            print(f"  {kind.upper()} horizon {hl.upper()} (h_canon={hc}, depth_ref={dm}m)")
            print(f"{'='*55}")
            t_start = time.time()
            try:
                r = run_one(
                    conn, hl, hc, dm, cfg, use_hierarchical,
                    snapshot_tag=args.snapshot_tag,
                )
                results.append(r)
            except Exception as exc:
                import traceback
                print(f"  [ERR] {kind} {hl} : {exc}", file=sys.stderr)
                traceback.print_exc(file=sys.stderr)
                try:
                    conn.rollback()
                except Exception:
                    pass
                errors.append({"kind": kind, "horizon": hl, "error": str(exc)})

    conn.close()

    # ---- Bilan final ----
    print(f"\n{'='*60}")
    print("BILAN FINAL")
    print(f"{'='*60}")
    ok_count   = sum(1 for r in results if r.get("ok"))
    skip_count = sum(1 for r in results if not r.get("ok"))
    print(f"  Reussis    : {ok_count}")
    print(f"  Ignores    : {skip_count}")
    print(f"  Erreurs    : {len(errors)}")
    print()
    print(f"  {'Parametre':<30} {'drift':<22} {'n_train':>7} {'LOO-RMSE':>10} {'Model':<12} {'t(s)':>6}")
    print(f"  {'-'*85}")
    for r in results:
        if r.get("ok"):
            rmse_s = f"{r['loo_rmse']:.4f}" if r.get("loo_rmse") and math.isfinite(r['loo_rmse']) else "N/A"
            print(
                f"  {r['parameter']:<30} {r.get('drift_method','?'):<22} "
                f"{r['n_train']:>7} {rmse_s:>10} {r.get('variogram_model','?'):<12} {r.get('elapsed_s',0):>6.1f}"
            )
        else:
            print(f"  {r['parameter']:<30} SKIP — {r.get('reason','?')}")
    for e in errors:
        print(f"  ERREUR  {e['kind']} {e['horizon']} : {e['error']}")

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
