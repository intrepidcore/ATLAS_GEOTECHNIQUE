#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple

# Traçabilité partagée (git hash, hyperparams, versions logicielles)
sys.path.insert(0, os.path.dirname(__file__))
try:
    from utils._run_traceability import build_version_tag, make_run_meta
except ImportError:
    def build_version_tag(p, h=None): return f"{p}-nogit-nohp"
    def make_run_meta(s, h, **kw): return {"script": s, "hyperparams": h}

import numpy as np
import psycopg2
from psycopg2.extras import execute_batch
from pykrige.ok import OrdinaryKriging
from sklearn.metrics import mean_absolute_error, mean_squared_error

DB_DEFAULT = os.environ.get("DATABASE_URL", "postgresql://atlas:atlas@localhost:5432/atlas_clean")
HORIZONS: List[Tuple[str, float]] = [("h1", 1.0), ("h2", 1.5), ("h3", 2.0)]


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
    """Extrait nugget/sill/range d'un objet OrdinaryKriging ajusté."""
    try:
        params = ok_obj.variogram_model_parameters
        if params is not None and len(params) >= 3:
            partial_sill = float(params[0])
            rng = float(params[1])
            nugget = float(params[2])
            sill = partial_sill + nugget
            # Coords géographiques → range en degrés, convertir en mètres
            if rng < 10:
                rng_m = rng * 111000.0
            else:
                rng_m = rng
            return {"nugget": nugget, "sill": sill, "range_m": rng_m}
    except Exception:
        pass
    return {}


def fallback_kriging(x, y, values, gx, gy) -> Tuple[np.ndarray, np.ndarray, str, Dict[str, Optional[float]]]:
    models: Sequence[str] = ("spherical", "exponential", "gaussian", "linear")
    for m in models:
        try:
            ok = OrdinaryKriging(
                x,
                y,
                values,
                variogram_model=m,
                nlags=15,
                weight=True,
                verbose=False,
                enable_plotting=False,
                coordinates_type="geographic",
            )
            z, ss = ok.execute("points", gx, gy)
            zv = np.asarray(z, dtype=np.float64).ravel()
            sv = np.asarray(ss, dtype=np.float64).ravel()
            if np.isfinite(zv).sum() > 0:
                vp = _extract_ok_params(ok)
                return zv, sv, m, vp
        except Exception:
            continue
    return np.full(gx.shape[0], np.nan), np.full(gx.shape[0], np.nan), "spherical", {}


def loo_rmse_residual(x, y, resid) -> Dict[str, float]:
    n = len(resid)
    if n < 6:
        return {"rmse": float("nan"), "mae": float("nan"), "n": float(n)}
    preds = []
    truths = []
    for i in range(n):
        mask = np.ones(n, dtype=bool)
        mask[i] = False
        try:
            ok = OrdinaryKriging(
                x[mask],
                y[mask],
                resid[mask],
                variogram_model="spherical",
                verbose=False,
                enable_plotting=False,
                coordinates_type="geographic",
            )
            z, _ = ok.execute("points", np.array([x[i]]), np.array([y[i]]))
            preds.append(float(z[0]))
            truths.append(float(resid[i]))
        except Exception:
            continue
    if len(preds) < 4:
        return {"rmse": float("nan"), "mae": float("nan"), "n": float(n)}
    p = np.array(preds)
    t = np.array(truths)
    return {
        "rmse": float(np.sqrt(mean_squared_error(t, p))),
        "mae": float(mean_absolute_error(t, p)),
        "n": float(n),
    }


@dataclass(frozen=True)
class KedParamCfg:
    kind: str  # vbs|ip|wl|wp
    source_table: str
    source_column_sql: str  # SQL expression for training value
    where_not_null_sql: str  # SQL predicate to filter training value
    physical_min: float
    physical_max: float
    unit: str


PARAMS: List[KedParamCfg] = [
    KedParamCfg(
        kind="vbs",
        source_table="essais_vbs",
        source_column_sql="ev.vbs",
        where_not_null_sql="ev.vbs IS NOT NULL",
        physical_min=0.0,
        physical_max=15.0,
        unit="g/100g",
    ),
    KedParamCfg(
        kind="ip",
        source_table="essais_atterberg",
        source_column_sql="COALESCE(ea.ip_generated, (ea.wl - ea.wp))",
        where_not_null_sql="COALESCE(ea.ip_generated, (ea.wl - ea.wp)) IS NOT NULL",
        physical_min=0.0,
        physical_max=100.0,
        unit="%",
    ),
    KedParamCfg(
        kind="wl",
        source_table="essais_atterberg",
        source_column_sql="ea.wl",
        where_not_null_sql="ea.wl IS NOT NULL",
        physical_min=0.0,
        physical_max=100.0,
        unit="%",
    ),
    KedParamCfg(
        kind="wp",
        source_table="essais_atterberg",
        source_column_sql="ea.wp",
        where_not_null_sql="ea.wp IS NOT NULL",
        physical_min=0.0,
        physical_max=100.0,
        unit="%",
    ),
    # CONV-01 : EG = potentiel_gonflement dans v_echantillons_essais,
    # mais pour le KED on joint directement essais_potentiel_gonflement.cg
    # car la vue n'est pas disponible dans le contexte de cette jointure avec depth_m.
    KedParamCfg(
        kind="eg",
        source_table="essais_potentiel_gonflement",
        source_column_sql="epg.cg",
        where_not_null_sql="epg.cg IS NOT NULL",
        physical_min=0.0,
        physical_max=20.0,
        unit="%",
    ),
]


def ensure_param(cur, pid: str, cfg: KedParamCfg) -> None:
    cur.execute("SELECT 1 FROM atlas.ai_parameter_catalog WHERE parameter_id=%s LIMIT 1", (pid,))
    if cur.fetchone():
        return

    # drift_strategy matches the existing KED pattern.
    cur.execute(
        """
        INSERT INTO atlas.ai_parameter_catalog
          (parameter_id, category, source, unit, interpolation_enabled, prediction_enabled, is_active,
           source_table, source_column, domain_type_pref, drift_strategy, physical_min, physical_max,
           depth_stratified, is_derived, derived_from)
        VALUES
          (%s, 'geotech', 'interpolation', %s, TRUE, FALSE, TRUE,
           %s, %s, 'pedologie', 'pedological_prior_residual_kriging', %s, %s,
           TRUE, FALSE, '{}'::text[])
        ON CONFLICT (parameter_id) DO NOTHING
        """,
        (
            pid,
            cfg.unit,
            cfg.source_table,
            # Store a stable column name when possible; else fallback to kind.
            # (The catalog is used mostly as an identifier for downstream selection.)
            ("vbs" if cfg.kind == "vbs" else (cfg.kind if cfg.kind in ("wl", "wp") else "ip_generated")),
            cfg.physical_min,
            cfg.physical_max,
        ),
    )


def _has_contexte_view(cur) -> bool:
    """Vérifie si atlas.v_contexte_geologique existe (BLOC A — dérive hiérarchique)."""
    cur.execute(
        """
        SELECT 1 FROM pg_matviews
        WHERE schemaname = 'atlas' AND matviewname = 'v_contexte_geologique'
        LIMIT 1
        """
    )
    return cur.fetchone() is not None


def load_grid(cur) -> List[Tuple[str, float, float, str]]:
    """
    Charge toutes les mailles avec leur contexte géologique.

    Si atlas.v_contexte_geologique existe (BLOC A), retourne le contexte_complet
    (5 niveaux : zone|pédologie|risque|géologie) comme clé de dérive.
    Sinon, repli sur type_sol pédologique seul (comportement historique).

    Retourne : liste de (maille_id, lon, lat, contexte)
    """
    if _has_contexte_view(cur):
        cur.execute(
            """
            SELECT
              v.maille_id,
              ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lon,
              ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lat,
              v.contexte_complet
            FROM atlas.v_contexte_geologique v
            JOIN atlas.mailles m ON m.id::text = v.maille_id
            """
        )
    else:
        cur.execute(
            """
            SELECT
              m.id::text AS maille_id,
              ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lon,
              ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lat,
              COALESCE(up.type_sol, 'UNKNOWN') AS type_sol
            FROM atlas.mailles m
            LEFT JOIN LATERAL (
              SELECT p.type_sol
              FROM atlas.unites_pedologiques p
              WHERE ST_Contains(p.geom, ST_PointOnSurface(m.geom))
              LIMIT 1
            ) up ON TRUE
            """
        )
    return [(str(a), float(b), float(c), str(d or "UNKNOWN")) for a, b, c, d in cur.fetchall()]


def load_hydro_lookup(cur) -> Dict[str, str]:
    """
    Charge la correspondance maille_id (UUID) → classe hydrogéologique.

    Utilise ST_Intersects sur le centroïde de chaque maille.
    Résultat mis en cache en mémoire — appeler une seule fois par session.

    Référence scientifique :
        Seed et al. (1962) "The swelling and shrinkage of clays", Géotechnique 12(4)
        L'état hydrique contrôle le gonflement libre EG autant que la minéralogie.
    """
    cur.execute("""
        SELECT
            m.id::text                                    AS maille_id,
            COALESCE(hg.libelle, 'INCONNU')               AS hydro_class
        FROM atlas.mailles m
        LEFT JOIN atlas.hydrogeologie hg
            ON ST_Intersects(ST_Centroid(m.geom), hg.geom)
        WHERE m.code IS NOT NULL
    """)
    rows = cur.fetchall()
    return {r[0]: r[1] for r in rows}


def compute_hierarchical_prior(
    train_values: "np.ndarray",
    train_contexts: List[str],
    min_pts: int = 5,
    hydro_lookup: Optional[Dict[str, str]] = None,
    train_maille_ids: Optional[List[str]] = None,
) -> Dict[str, float]:
    """
    Calcule les moyennes a priori par contexte géologique hiérarchique.

    Ordre de repli (du plus spécifique au plus général) :
      1. contexte_complet + HYDRO → 'ZONE|PEDO|RISQUE|GEO|HYDRO'
      2. zone + pédologie          → 'ZONE|PEDO'
      3. pédologie seule           → 2e segment du contexte
      4. hydrogéologie seule       → classe hydro (14 polygones) [NEW]
      5. moyenne nationale         → toujours disponible

    Règle : un contexte n'est utilisé que s'il regroupe >= min_pts sondages.

    Paramètres optionnels :
        hydro_lookup      : dict {maille_id → libelle_hydrogeo} depuis load_hydro_lookup()
        train_maille_ids  : liste des maille_id des sondages d'entraînement
                            (même longueur que train_values)

    Si hydro_lookup est None, le niveau 4 (hydro) est ignoré et on passe
    directement à la moyenne nationale → comportement identique à v1.

    Justification du niveau 4 (voir PROPOSITION_SCIENTIFIQUE_MODELES_RUPTURE.md §3.5) :
        L'hydrogéologie encode l'état hydrique régional. C'est un facteur
        aggravant du gonflement (pas un facteur causal), d'où sa position
        APRÈS les niveaux minéralogiques (PEDO, GEO) dans la hiérarchie.
        14 polygones = résolution grossière = pertinent seulement comme
        filet de sécurité avant la moyenne nationale aveugle.
    """
    global_mean = float(np.mean(train_values))
    priors: Dict[str, float] = {}

    # Précalcul : classe hydro des sondages d'entraînement (si fourni)
    if hydro_lookup and train_maille_ids:
        train_hydro = [hydro_lookup.get(mid, 'INCONNU') for mid in train_maille_ids]
    else:
        train_hydro = None

    # ── Niveau 1 : contexte complet (+ hydro si disponible) ─────────────────
    if train_hydro:
        # Enrichir la clé avec la classe hydro
        rich_contexts = [f"{ctx}|{h}" for ctx, h in zip(train_contexts, train_hydro)]
        for rctx in set(rich_contexts):
            idx = [i for i, c in enumerate(rich_contexts) if c == rctx]
            if len(idx) >= min_pts:
                priors[rctx] = float(np.mean([train_values[i] for i in idx]))
            # Aussi stocker sous la clé sans hydro pour la compatibilité niveau 2+
            ctx_base = '|'.join(rctx.split('|')[:4])
            if ctx_base not in priors:
                idx_base = [i for i, c in enumerate(train_contexts) if c == ctx_base]
                if len(idx_base) >= min_pts:
                    priors[ctx_base] = float(np.mean([train_values[i] for i in idx_base]))
    else:
        # Niveau 1 sans hydro (comportement v1)
        for ctx in set(train_contexts):
            idx = [i for i, c in enumerate(train_contexts) if c == ctx]
            if len(idx) >= min_pts:
                priors[ctx] = float(np.mean([train_values[i] for i in idx]))

    # ── Niveau 2 : zone + pédologie (2 premiers segments) ───────────────────
    for ctx in set(train_contexts):
        if ctx not in priors:
            parent = "|".join(ctx.split("|")[:2])
            idx = [i for i, c in enumerate(train_contexts) if c.startswith(parent)]
            if len(idx) >= min_pts:
                priors[ctx] = float(np.mean([train_values[i] for i in idx]))

    # ── Niveau 3 : pédologie seule (2e segment) ─────────────────────────────
    for ctx in set(train_contexts):
        if ctx not in priors:
            parts = ctx.split("|")
            ped = parts[1] if len(parts) > 1 else ctx
            idx = [
                i for i, c in enumerate(train_contexts)
                if (c.split("|")[1] if len(c.split("|")) > 1 else c) == ped
            ]
            if len(idx) >= min_pts:
                priors[ctx] = float(np.mean([train_values[i] for i in idx]))
            elif train_hydro:
                pass  # niveau 4 ci-dessous
            else:
                priors[ctx] = global_mean  # repli ultime (sans hydro)

    # ── Niveau 4 : hydrogéologie seule [NEW v2] ──────────────────────────────
    if train_hydro:
        for ctx in set(train_contexts):
            if ctx not in priors:
                # Trouver la classe hydro majoritaire parmi les sondages
                # ayant ce préfixe de contexte
                candidate_hydro = [
                    train_hydro[i] for i, c in enumerate(train_contexts) if c == ctx
                ]
                hydro_class = candidate_hydro[0] if candidate_hydro else 'INCONNU'

                if hydro_class != 'INCONNU':
                    idx_h = [i for i, h in enumerate(train_hydro) if h == hydro_class]
                    if len(idx_h) >= min_pts:
                        priors[ctx] = float(np.mean([train_values[i] for i in idx_h]))
                        continue

                priors[ctx] = global_mean  # ── Niveau 5 : nationale ──

    return priors


def load_training_points(
    cur, cfg: KedParamCfg, depth_m: float, use_hierarchical: bool = False
) -> List[Tuple[str, float, float, float, str]]:
    """
    Charge les points d'entraînement à une profondeur donnée.

    Si use_hierarchical=True (et v_contexte_geologique disponible) :
      le contexte retourné est contexte_complet (5 niveaux).
    Sinon : repli sur type_sol pédologique (comportement historique).
    """
    if use_hierarchical:
        ctx_join = "JOIN atlas.v_contexte_geologique vc ON vc.maille_id = m.id::text"
        ctx_col  = "COALESCE(vc.contexte_complet, 'UNKNOWN') AS contexte"
    else:
        ctx_join = """LEFT JOIN LATERAL (
              SELECT p.type_sol
              FROM atlas.unites_pedologiques p
              WHERE ST_Contains(p.geom, ST_PointOnSurface(m.geom))
              LIMIT 1
            ) up ON TRUE"""
        ctx_col  = "COALESCE(up.type_sol, s.type_sol, 'UNKNOWN') AS contexte"

    if cfg.kind == "vbs":
        cur.execute(
            f"""
            SELECT
              m.id::text AS maille_id,
              ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lon,
              ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lat,
              ev.vbs::float8 AS val,
              {ctx_col}
            FROM atlas.sondages s
            JOIN atlas.echantillons e ON e.sondage_id = s.id
            JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id
            JOIN atlas.mailles m ON m.code = s.maille_code
            {ctx_join}
            WHERE s.deleted_at IS NULL
              AND e.depth_m = %s
              AND {cfg.where_not_null_sql}
            """,
            (depth_m,),
        )
    elif cfg.kind == "eg":
        # CONV-01 : EG joint directement essais_potentiel_gonflement (colonne cg)
        # car la vue v_echantillons_essais ne joint pas depth_m correctement
        cur.execute(
            f"""
            SELECT
              m.id::text AS maille_id,
              ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lon,
              ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lat,
              epg.cg::float8 AS val,
              {ctx_col}
            FROM atlas.sondages s
            JOIN atlas.echantillons e ON e.sondage_id = s.id
            JOIN atlas.essais_potentiel_gonflement epg ON epg.echantillon_id = e.id
            JOIN atlas.mailles m ON m.code = s.maille_code
            {ctx_join}
            WHERE s.deleted_at IS NULL
              AND e.depth_m = %s
              AND epg.cg IS NOT NULL
            """,
            (depth_m,),
        )
    else:
        cur.execute(
            f"""
            SELECT
              m.id::text AS maille_id,
              ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lon,
              ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lat,
              {cfg.source_column_sql}::float8 AS val,
              {ctx_col}
            FROM atlas.sondages s
            JOIN atlas.echantillons e ON e.sondage_id = s.id
            JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id
            JOIN atlas.mailles m ON m.code = s.maille_code
            {ctx_join}
            WHERE s.deleted_at IS NULL
              AND e.depth_m = %s
              AND {cfg.where_not_null_sql}
            """,
            (depth_m,),
        )

    out = []
    for row in cur.fetchall():
        mid, lon, lat, val, tsol = row
        if val is None:
            continue
        if not (math.isfinite(float(lon)) and math.isfinite(float(lat)) and math.isfinite(float(val))):
            continue
        out.append((str(mid), float(lon), float(lat), float(val), str(tsol or "UNKNOWN")))
    return out


def run_one(
    conn,
    horizon_label: str,
    depth_m: float,
    cfg: KedParamCfg,
    grid_cache: List[Tuple[str, float, float, str]],
    use_hierarchical: bool = False,
    hydro_lookup: Optional[Dict[str, str]] = None,
    log_transform: bool = False,
):
    """
    KED runner pour un (paramètre, horizon).

    use_hierarchical=True  : utilise compute_hierarchical_prior (5 niveaux géologiques).
    use_hierarchical=False : comportement historique (type_sol pédologique seul).
    hydro_lookup           : dict {maille_id → classe_hydrogeo} depuis load_hydro_lookup().
                             Si fourni, active le niveau 4 de repli hydrogéologique.
                             Voir PROPOSITION_SCIENTIFIQUE_MODELES_RUPTURE.md §3.5.
    log_transform          : si True, applique log(val+1) avant krigeage et back-transforme
                             après. Recommandé pour VBS (skewness=2.41) et CBR (range 0-132%).
                             Voir POINTS_REVISION_PROCHAINE_ITERATION_V2.md §3.6 (A5).
    """
    t_start = datetime.now(timezone.utc)   # ← début réel pour durée tracée
    param_id = f"{cfg.kind}_ked_{horizon_label}"
    # Si log-transform actif, suffixe le parameter_id pour différencier des runs normaux
    if log_transform:
        param_id = f"{cfg.kind}_ked_log_{horizon_label}"
    cur = conn.cursor()
    ensure_param(cur, param_id, cfg)

    train = load_training_points(cur, cfg, depth_m, use_hierarchical=use_hierarchical)
    if len(train) < 10:
        cur.close()
        return {"ok": False, "parameter": param_id, "depth_m": depth_m, "reason": "insufficient_training_points", "n_train": len(train)}

    mids = [r[0] for r in train]
    x = np.array([r[1] for r in train], dtype=np.float64)
    y = np.array([r[2] for r in train], dtype=np.float64)
    vals_raw = np.array([r[3] for r in train], dtype=np.float64)

    # A5 — Log-transformation avant krigeage (pour paramètres asymétriques)
    if log_transform:
        vals = np.log1p(vals_raw)
        print(f"  [LOG-TRANSFORM] log(val+1) appliqué : {cfg.kind}/{horizon_label}", flush=True)
    else:
        vals = vals_raw
    ctx_train = [r[4] for r in train]

    gx = np.array([r[1] for r in grid_cache], dtype=np.float64)
    gy = np.array([r[2] for r in grid_cache], dtype=np.float64)
    gmids = [r[0] for r in grid_cache]
    ctx_grid = [r[3] for r in grid_cache]

    global_mean = float(np.mean(vals))

    if use_hierarchical:
        # Dérive hiérarchique (4 ou 5 niveaux selon présence du lookup hydro)
        priors = compute_hierarchical_prior(
            vals, ctx_train, min_pts=5,
            hydro_lookup=hydro_lookup,
            train_maille_ids=mids if hydro_lookup else None,
        )
        # Compter les points par contexte complet pour la traçabilité
        counts: Dict[str, int] = {}
        for ctx in set(ctx_train):
            counts[ctx] = sum(1 for c in ctx_train if c == ctx)
        drift_train = np.array([priors.get(c, global_mean) for c in ctx_train], dtype=np.float64)
        drift_grid  = np.array([priors.get(c, global_mean) for c in ctx_grid],  dtype=np.float64)
        drift_method = "hierarchical_5levels_hydro" if hydro_lookup else "hierarchical_5levels"
    else:
        # Dérive pédologique simple (comportement historique)
        priors = {}
        counts = {}
        for ts in sorted(set(ctx_train)):
            sel = [vals[i] for i in range(len(vals)) if ctx_train[i] == ts]
            if not sel:
                continue
            priors[ts] = float(np.mean(sel))
            counts[ts] = len(sel)
        drift_train = np.array([priors.get(ts, global_mean) for ts in ctx_train], dtype=np.float64)
        drift_grid  = np.array([priors.get(ts, global_mean) for ts in ctx_grid],  dtype=np.float64)
        drift_method = "pedological_prior"

    residuals = vals - drift_train
    z_res, z_var, model_used, ok_params = fallback_kriging(x, y, residuals, gx, gy)
    z_pred = z_res + drift_grid

    # A5 — Back-transformation si log-transform actif
    if log_transform:
        z_pred = np.expm1(z_pred)

    z_pred = np.clip(z_pred, cfg.physical_min, cfg.physical_max)

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
           started_at, finished_at, zone_id, kriging_domain_id, meta)
        VALUES
          (%s, 'kriging', %s, %s, %s, 'finished', %s::jsonb,
           %s, now(), NULL, NULL, %s::jsonb)
        """,
        (
            run_id,
            param_id,
            method_tag,
            build_version_tag("ked", {"drift_method": drift_method, "depth_m": depth_m, "kind": cfg.kind}),
            json_safe({
                "horizon_label": horizon_label,
                "depth_m": depth_m,
                "param_kind": cfg.kind,
                "n_train": int(len(vals)),
                "n_grid": int(len(gmids)),
                "loo_residual": loo,
                "model_used": model_used,
                "drift_method": drift_method,
                "global_mean": global_mean,
            }),
            t_start,
            json_safe(make_run_meta(
                script_name="run_ked_vbs_ip_wl_wp_horizons",
                hyperparams={
                    "drift_method": drift_method,
                    "depth_m": depth_m,
                    "param_kind": cfg.kind,
                    "horizon_label": horizon_label,
                    "use_hierarchical": use_hierarchical,
                },
                metrics={
                    "n_train": int(len(vals)),
                    "n_grid": int(len(gmids)),
                    "loo_rmse": loo.get("rmse") if isinstance(loo, dict) else None,
                },
                t_start=t_start,
            )),
        ),
    )

    cur.execute(
        """
        INSERT INTO atlas.ai_variograms
          (id, parameter_id, zone_id, model_type, range_m, sill, nugget, anisotropy_ratio, anisotropy_angle_deg, fit_quality, created_at, kriging_domain_id, loo_rmse)
        VALUES
          (%s, %s, NULL, %s, %s, %s, %s, NULL, NULL, %s::jsonb, now(), NULL, %s)
        """,
        (
            variogram_id,
            param_id,
            model_used,
            ok_params.get("range_m"),
            ok_params.get("sill"),
            ok_params.get("nugget"),
            json_safe({"horizon_label": horizon_label, "depth_m": depth_m, "param_kind": cfg.kind, "model": model_used}),
            None if not math.isfinite(float(loo.get("rmse", float("nan")))) else float(loo["rmse"]),
        ),
    )

    # Archiver les valeurs actives avant d'insérer la nouvelle génération (contrat is_superseded)
    cur.execute(
        """
        UPDATE atlas.ai_interpolation_values
           SET is_superseded = true
         WHERE parameter_id = %s
           AND COALESCE(is_superseded, false) = false
        """,
        (param_id,),
    )

    rows = []
    for i, mid in enumerate(gmids):
        rows.append(
            (
                str(uuid.uuid4()),
                mid,
                param_id,
                float(z_pred[i]) if math.isfinite(float(z_pred[i])) else None,
                # Clamp à 0 : PyKrige peut retourner des variances légèrement négatives
                # aux points d'entraînement (artefact inversion matricielle — voir doc PyKrige)
                max(0.0, float(z_var[i])) if math.isfinite(float(z_var[i])) else None,
                float(confidence[i]) if math.isfinite(float(confidence[i])) else None,
                method_tag,
                variogram_id,
                run_id,
            )
        )

    execute_batch(
        cur,
        """
        INSERT INTO atlas.ai_interpolation_values
          (id, maille_id, zone_id, kriging_domain_id, parameter_id, value, variance, confidence, method, variogram_id, run_id, created_at)
        VALUES
          (%s::uuid, %s::uuid, NULL, NULL, %s, %s, %s, %s, %s, %s::uuid, %s::uuid, now())
        """,
        rows,
        page_size=1000,
    )

    # Persist drift priors in pedological_drift_priors.
    horizon_key = horizon_label.upper()
    cur.execute("DELETE FROM atlas.pedological_drift_priors WHERE parameter_id=%s AND horizon_label=%s", (param_id, horizon_key))
    prior_rows = [
        (param_id, horizon_key, depth_m, ts, float(v), int(counts.get(ts, 0)))
        for ts, v in priors.items()
    ]
    if prior_rows:
        execute_batch(
            cur,
            """
            INSERT INTO atlas.pedological_drift_priors
              (parameter_id, horizon_label, depth_m, type_sol, drift_value, n_points, computed_at, source_label)
            VALUES
              (%s, %s, %s, %s, %s, %s, now(), 'run_ked_vbs_ip_wl_wp_horizons.py')
            """,
            prior_rows,
            page_size=200,
        )

    conn.commit()
    cur.close()

    return {
        "ok": True,
        "parameter": param_id,
        "horizon": horizon_key,
        "depth_m": depth_m,
        "param_kind": cfg.kind,
        "n_train": int(len(vals)),
        "n_grid": int(len(gmids)),
        "loo_residual_rmse": loo.get("rmse"),
        "variogram_model_used": model_used,
        "run_id": run_id,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Run KED VBS/IP/WL/WP for horizons H1/H2/H3")
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument("--kinds", default="vbs,ip,wl,wp", help="Comma-separated kinds: vbs,ip,wl,wp")
    ap.add_argument(
        "--hierarchical", action="store_true", default=False,
        help=(
            "BLOC A : utilise la dérive hiérarchique (4 niveaux : zones + pédologie + risque + géologie). "
            "Créer d'abord la vue : psql -f scripts/sql/create_contexte_geologique.sql"
        ),
    )
    ap.add_argument(
        "--use-hydro", action="store_true", default=False,
        help=(
            "Active le niveau 4 de repli hydrogéologique dans compute_hierarchical_prior. "
            "Nécessite --hierarchical et atlas.hydrogeologie renseignée. "
            "Voir PROPOSITION_SCIENTIFIQUE_MODELES_RUPTURE.md §3.5 pour la justification."
        ),
    )
    ap.add_argument(
        "--log-transform", action="store_true", default=False,
        help=(
            "A5 — Applique log(val+1) avant krigeage et expm1() après (back-transform). "
            "Recommandé pour VBS (skewness=2.41) et CBR (range 0-132%). "
            "Améliore la couverture des intervalles de prédiction (PICP 95%). "
            "Voir POINTS_REVISION_PROCHAINE_ITERATION_V2.md §3.6."
        ),
    )
    args = ap.parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL required")

    kinds_allowed = {x.strip() for x in args.kinds.split(",") if x.strip()}
    cfgs = [cfg for cfg in PARAMS if cfg.kind in kinds_allowed]
    if not cfgs:
        raise SystemExit("No ked kinds selected.")

    conn = psycopg2.connect(args.database_url)
    try:
        cur = conn.cursor()

        # Vérifier que la vue hiérarchique existe si demandée
        use_hierarchical = args.hierarchical
        if use_hierarchical and not _has_contexte_view(cur):
            raise SystemExit(
                "ERREUR : --hierarchical demandé mais atlas.v_contexte_geologique "
                "n'existe pas. Exécuter d'abord :\n"
                "  psql -v ON_ERROR_STOP=1 -f scripts/sql/create_contexte_geologique.sql"
            )

        # Charger le lookup hydrogéologique (optionnel — niveau 4 de repli)
        # Désactivé par défaut pour ne pas changer le comportement existant.
        # Activer avec --use-hydro quand la table atlas.hydrogeologie est complète.
        use_hydro = getattr(args, 'use_hydro', False)
        hydro_lookup: Optional[Dict[str, str]] = None
        if use_hierarchical and use_hydro:
            try:
                hydro_lookup = load_hydro_lookup(cur)
                print(f"Lookup hydrogéologique chargé : {len(hydro_lookup)} mailles", flush=True)
            except Exception as e:
                print(f"[WARN] Impossible de charger hydro_lookup ({e}) — niveau 4 désactivé", flush=True)

        drift_info = "hiérarchique 5 niveaux + hydro" if hydro_lookup else \
                     "hiérarchique 5 niveaux" if use_hierarchical else "pédologique simple"
        print(f"Dérive : {drift_info}", flush=True)

        grid_cache = load_grid(cur)
        cur.close()

        use_log = getattr(args, 'log_transform', False)
        if use_log:
            log_kinds = {'vbs', 'cbr_95', 'eg'}
            print(f"Log-transform activé pour : {log_kinds & kinds_allowed}", flush=True)

        out: List[Dict[str, Any]] = []
        for hz, depth in HORIZONS:
            for cfg in cfgs:
                # A5 : appliquer log-transform seulement aux paramètres asymétriques
                apply_log = use_log and cfg.kind in {'vbs', 'eg'}
                out.append(run_one(
                    conn, hz, depth, cfg, grid_cache,
                    use_hierarchical=use_hierarchical,
                    hydro_lookup=hydro_lookup,
                    log_transform=apply_log,
                ))
        print(json_safe({"runs": out}))
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())

