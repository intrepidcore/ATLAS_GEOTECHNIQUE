#!/usr/bin/env python3
"""
P1 — Simulation Séquentielle Gaussienne (SGS)
=============================================
Artefact P1 — Réponse directe aux §3.6 et §4.4 du POINTS_REVISION_PROCHAINE_ITERATION_V2.md.

Le krigeage produit l'espérance conditionnelle E[Z(x)|data] — LISSE, sous-estime les extrêmes.
SGS produit des réalisations équiprobables qui REPRODUISENT la variabilité et la distribution.

Motivation scientifique :
  - VBS : skewness = 2.41 → intervalles normaux non valides (PICP 87% au lieu de 95%)
  - CBR : range 0-132% → krigeage sous-estime la Dépression de la Lama et les Vertisols
  - 50 réalisations → P10/P50/P90 → intervalles non-paramétriques vrais

Workflow :
  1. Charger sondages (lon, lat, valeur) depuis DB
  2. Log-transform si paramètre asymétrique (VBS, CBR, EG)
  3. Fitter le variogramme (Spherical) via gstools
  4. Générer N réalisations conditionnelles SRF
  5. Back-transform si log
  6. Stocker P10/P50/P90 dans atlas.ai_interpolation_values avec method='sgs_p10/p50/p90'

Usage :
    python scripts/sgs_interpolation.py \
        --database-url postgres://atlas:atlas@host.docker.internal:5433/atlas_clean \
        --param vbs \
        --horizon h1 \
        --n-realizations 50

Référence :
    Deutsch, C.V. & Journel, A.G. (1998). GSLIB: Geostatistical Software Library.
    Chilès, J.P. & Delfiner, P. (2012). Geostatistics, 2nd ed. Wiley.
    gstools : https://gstools.readthedocs.io/

⚠️  ATTENTION — PORTAGE EN AVAL (2026-07-03) ⚠️
================================================
La logique de `run_sgs()` (fit du variogramme sphérique §"Fitter le
variogramme" + conditioning trick de Journel-Huijbregts §"Générer N
réalisations") a été PORTÉE dans le dépôt IntrepidCore/lcpi :

    D:\lcpi\python-orchestrator\atlas_pack\sgs.py
    (fonctions fit_spherical_variogram / simulate_conditional_field)

Ce portage sert le contrat `AtlasPack.draw_realizations` du Scenario
Compiler (SDD-Scenario-Compiler-v1 §2.1, roadmap S18). Il a retiré l'accès
PostgreSQL (les deux modules ne se testent PAS ensemble en CI — aucun lien
automatisé entre ce script et le portage) et a rendu explicites les
paramètres de repli du variogramme dégénéré (`len_scale=120km` etc., ici
codés en dur pour le VBS aux lignes ~253-258 de `run_sgs()` — dans le
portage, ce sont des arguments nommés, PAS un défaut silencieusement
appliqué à tout paramètre).

**Si vous modifiez la logique de `run_sgs()` ci-dessous (autre modèle de
variogramme, autre générateur que gstools SRF/RandMeth, autre technique que
le conditioning trick, changement des constantes de repli), le portage
`atlas_pack/sgs.py` divergera silencieusement tant qu'il n'est pas mis à
jour en miroir.** Il n'y a aucun garde-fou automatique (pas de CI
cross-dépôt) — c'est une dette de synchronisation manuelle assumée,
documentée côté portage également.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np
import psycopg2
from psycopg2.extras import execute_values

try:
    import gstools as gs
    HAS_GSTOOLS = True
except ImportError:
    HAS_GSTOOLS = False
    print("[FATAL] gstools non disponible. Installer : pip install gstools")
    sys.exit(1)

DB_DEFAULT = os.environ.get("DATABASE_URL",
                            "postgresql://atlas:atlas@host.docker.internal:5433/atlas_clean")

HORIZON_DEPTH = {'h1': 1.0, 'h2': 1.5, 'h3': 2.0}

# Paramètres → log-transform (asymétrie élevée, valeurs >= 0)
LOG_TRANSFORM_PARAMS = {'vbs', 'cbr_95', 'eg'}

# Clamp physique [min, max] par paramètre
CLAMP_MAP = {
    'vbs':     (0.0,  20.0),
    'cbr_95':  (0.0, 150.0),
    'eg':      (0.0,  20.0),
    'ip':      (0.0,  80.0),
    'wl':      (20.0, 120.0),
    'wp':      (10.0,  60.0),
    'gamma_d': (1.0,   2.5),
    'w_opt':   (5.0,  35.0),
}


def load_training_data(conn, param: str, horizon: str) -> Optional[Tuple[np.ndarray, np.ndarray, np.ndarray]]:
    """Charge (x_utm, y_utm, val) pour un paramètre/horizon."""
    depth = HORIZON_DEPTH.get(horizon)
    if depth is None:
        return None

    cur = conn.cursor()

    if param == 'vbs':
        sql = """
        SELECT ST_X(ST_Transform(s.geom,25231))::float8,
               ST_Y(ST_Transform(s.geom,25231))::float8,
               ev.vbs::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%s
        JOIN atlas.essais_vbs ev ON ev.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND ev.vbs IS NOT NULL AND s.geom IS NOT NULL
        """
    elif param == 'ip':
        sql = """
        SELECT ST_X(ST_Transform(s.geom,25231))::float8,
               ST_Y(ST_Transform(s.geom,25231))::float8,
               COALESCE(ea.ip_generated,(ea.wl-ea.wp))::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%s
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id=e.id
        WHERE s.deleted_at IS NULL
          AND COALESCE(ea.ip_generated,(ea.wl-ea.wp)) IS NOT NULL AND s.geom IS NOT NULL
        """
    elif param == 'wl':
        sql = """
        SELECT ST_X(ST_Transform(s.geom,25231))::float8,
               ST_Y(ST_Transform(s.geom,25231))::float8, ea.wl::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%s
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND ea.wl IS NOT NULL AND s.geom IS NOT NULL
        """
    elif param == 'wp':
        sql = """
        SELECT ST_X(ST_Transform(s.geom,25231))::float8,
               ST_Y(ST_Transform(s.geom,25231))::float8, ea.wp::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%s
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND ea.wp IS NOT NULL AND s.geom IS NOT NULL
        """
    elif param == 'eg':
        sql = """
        SELECT ST_X(ST_Transform(s.geom,25231))::float8,
               ST_Y(ST_Transform(s.geom,25231))::float8, epg.cg::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%s
        JOIN atlas.essais_potentiel_gonflement epg ON epg.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND epg.cg IS NOT NULL AND s.geom IS NOT NULL
        """
    elif param == 'cbr_95':
        # CBR : essai d'appui unique, profondeurs 0.25-0.65m (pas stratifié H1/H2/H3)
        # On prend TOUS les essais CBR95 sans filtre depth_m (décision hors roadmap 2026-06-07)
        # 339 sondages géocodés → moyenne par sondage si plusieurs échantillons
        sql = """
        SELECT ST_X(ST_Transform(s.geom,25231))::float8,
               ST_Y(ST_Transform(s.geom,25231))::float8,
               AVG(ec.cbr_pct)::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id
        JOIN atlas.essais_cbr ec ON ec.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND ec.cbr_pct IS NOT NULL
          AND ec.compactage_pct=95 AND s.geom IS NOT NULL
        GROUP BY s.id, s.geom
        """
        # Ignorer le paramètre depth pour cbr_95
        cur.execute(sql)
        rows = cur.fetchall()
        if len(rows) < 10:
            print(f"[SKIP] N={len(rows)} < 10")
            return None
        data = np.array(rows, dtype=np.float64)
        data = data[np.isfinite(data).all(axis=1)]
        x = data[:, 0]; y = data[:, 1]; v = data[:, 2]
        print(f"  Données chargées (CBR sans depth): N={len(v)}, moy={v.mean():.3f}, std={v.std():.3f}")
        return x, y, v
    else:
        return None

    try:
        cur.execute(sql, (depth,))
        rows = cur.fetchall()
    except Exception as ex:
        conn.rollback()
        print(f"[WARN] {ex}")
        return None

    if len(rows) < 10:
        print(f"[SKIP] N={len(rows)} < 10")
        return None

    data = np.array(rows, dtype=np.float64)
    data = data[np.isfinite(data).all(axis=1)]
    x = data[:, 0]
    y = data[:, 1]
    v = data[:, 2]
    print(f"  Données chargées: N={len(v)}, moy={v.mean():.3f}, std={v.std():.3f}")
    return x, y, v


def load_grid(conn) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """Charge toutes les mailles avec leurs coordonnées UTM31.
    Retourne les maille_id (UUID) pour l'INSERT dans ai_interpolation_values.
    """
    cur = conn.cursor()
    cur.execute("""
    SELECT id::text,
           ST_X(ST_Transform(ST_Centroid(geom), 25231))::float8,
           ST_Y(ST_Transform(ST_Centroid(geom), 25231))::float8
    FROM atlas.mailles
    WHERE code IS NOT NULL
    ORDER BY code
    """)
    rows = cur.fetchall()
    maille_ids = [r[0] for r in rows]   # UUID strings
    gx = np.array([r[1] for r in rows], dtype=np.float64)
    gy = np.array([r[2] for r in rows], dtype=np.float64)
    print(f"  Grille chargée: {len(maille_ids)} mailles")
    return gx, gy, maille_ids


def run_sgs(
    x_cond: np.ndarray, y_cond: np.ndarray, val_cond: np.ndarray,
    grid_x: np.ndarray, grid_y: np.ndarray,
    n_realizations: int = 50,
    seed_base: int = 42,
    log_transform: bool = False,
) -> np.ndarray:
    """
    Simulation Séquentielle Gaussienne (SGS) avec gstools.

    Retourne : matrice (n_realizations, n_grid) des réalisations.
    """
    # Log-transform
    if log_transform:
        val_tf = np.log1p(val_cond)
    else:
        val_tf = val_cond.copy()

    # Fitter le variogramme expérimental
    bin_edges = np.linspace(0, 300_000, 20)  # 0 à 300 km, 20 lags
    try:
        bin_center, gamma, counts = gs.vario_estimate(
            (x_cond, y_cond), val_tf, bin_edges,
            estimator='matheron',
        )
        # Enlever les lags sans données
        valid_bins = counts > 2
        bin_center = bin_center[valid_bins]
        gamma = gamma[valid_bins]
    except Exception as ex:
        print(f"  [WARN] Estimation variogramme échouée: {ex} → utilisation paramètres par défaut")
        bin_center = np.array([50000, 100000, 150000, 200000])
        gamma = np.full(4, np.var(val_tf) * 0.7)

    # Fitter le modèle sphérique
    data_var = float(np.var(val_tf))
    model = gs.Spherical(dim=2)
    try:
        model.fit_variogram(bin_center, gamma, nugget=True)
        print(f"  Variogramme fit: len_scale={model.len_scale/1000:.1f}km, "
              f"var={model.var:.4f}, nugget={model.nugget:.4f}")
    except Exception as ex:
        print(f"  [WARN] Fit variogramme échoué: {ex}")

    # Garde-fou : si var ≈ 0, le fit est dégénéré (nugget absorbe tout)
    # → forcer les paramètres issus des variogrammes KED connus
    if model.var < data_var * 0.05:
        print(f"  [WARN] Variogramme dégénéré (var={model.var:.6f} << data_var={data_var:.4f})")
        print(f"         → Paramètres KED forcés: len_scale=120km, var=0.8*data_var, nugget=0.2*data_var")
        model.var = data_var * 0.8
        model.len_scale = 120_000.0   # 120 km (plage VBS KED ≈ 80-220 km)
        model.nugget = data_var * 0.2
    print(f"  Variogramme final: len_scale={model.len_scale/1000:.1f}km, "
          f"var={model.var:.4f}, nugget={model.nugget:.4f}")

    # Krigeage conditionnel ordinaire (base pour SGS)
    try:
        krige = gs.krige.Ordinary(
            model,
            cond_pos=(x_cond, y_cond),
            cond_val=val_tf,
        )
        field_krige, _ = krige((grid_x, grid_y))
    except Exception as ex:
        print(f"  [WARN] Krigeage ordinaire échoué: {ex}")
        field_krige = np.full(len(grid_x), np.mean(val_tf))

    # SGS : N réalisations conditionnelles — Turr-Christakos conditioning trick
    # Décision architecturale (hors roadmap, documentée 2026-06-07) :
    # On utilise gs.SRF avec générateur 'RandMeth' (scalaire, dim=2) et NON VectorField
    # VectorField retourne shape (2, n_grid) pour champs vectoriels — inadapté ici.
    # RandMeth est le générateur standard gstools pour champs scalaires aléatoires.
    realizations = np.zeros((n_realizations, len(grid_x)))
    n_grid = len(grid_x)

    # Générateur scalaire : RandMeth (défaut gstools pour dim=2, champ scalaire)
    srf = gs.SRF(model, mean=0.0)   # mean=0 : on travaille en résidus de krigeage

    n_ok, n_fail = 0, 0
    for i in range(n_realizations):
        try:
            seed = seed_base + i
            # 1. Réalisation non-conditionnelle sur la grille complète
            field_unc_grid = srf((grid_x, grid_y), seed=seed)
            field_unc_grid = np.asarray(field_unc_grid).ravel()[:n_grid]

            # 2. Même réalisation évaluée aux points de conditionnement
            field_unc_at_cond = srf((x_cond, y_cond), seed=seed)
            field_unc_at_cond = np.asarray(field_unc_at_cond).ravel()

            # 3. Kriger la réalisation non-conditionnelle depuis les points cond → grille
            try:
                krige_unc = gs.krige.Ordinary(
                    model,
                    cond_pos=(x_cond, y_cond),
                    cond_val=field_unc_at_cond,
                )
                field_krige_unc, _ = krige_unc((grid_x, grid_y))
                field_krige_unc = np.asarray(field_krige_unc).ravel()[:n_grid]
            except Exception as e2:
                field_krige_unc = np.full(n_grid, float(np.mean(field_unc_at_cond)))

            # 4. Conditioning trick : Z_cond = Z_krige_data + (Z_unc_grid - Z_krige_unc)
            field_cond = field_krige + (field_unc_grid - field_krige_unc)

            # 5. Back-transform si log
            if log_transform:
                field_cond = np.expm1(field_cond)

            realizations[i] = field_cond
            n_ok += 1

        except Exception as ex:
            # Fallback : réalisation = krigeage déterministe (sans incertitude)
            if n_fail == 0:
                print(f"  [WARN] Réalisation {i} échouée: {ex}")
            if log_transform:
                realizations[i] = np.expm1(field_krige)
            else:
                realizations[i] = field_krige.copy()
            n_fail += 1

        if (i + 1) % 10 == 0:
            print(f"  Réalisations: {i+1}/{n_realizations} (ok={n_ok}, fail={n_fail})", flush=True)

    print(f"  Bilan: {n_ok} réalisations valides / {n_realizations} total")

    return realizations


def store_sgs_results(conn, param: str, horizon: str,
                      realizations: np.ndarray, grid_codes: List[str],
                      n_realizations: int, log_transform: bool) -> None:
    """
    Stocke P10/P50/P90 dans atlas.ai_interpolation_values.
    method = 'sgs_p10' / 'sgs_p50' / 'sgs_p90'
    """
    n_grid = len(grid_codes)
    assert realizations.shape == (n_realizations, n_grid), \
        f"Shape mismatch: {realizations.shape} vs ({n_realizations}, {n_grid})"

    p10 = np.percentile(realizations, 10, axis=0)
    p50 = np.percentile(realizations, 50, axis=0)
    p90 = np.percentile(realizations, 90, axis=0)

    clamp_min, clamp_max = CLAMP_MAP.get(param, (0, 1e9))
    p10 = np.clip(p10, clamp_min, clamp_max)
    p50 = np.clip(p50, clamp_min, clamp_max)
    p90 = np.clip(p90, clamp_min, clamp_max)

    # Variance inter-réalisations (incertitude SGS)
    var_sgs = np.var(realizations, axis=0)

    cur = conn.cursor()
    now = datetime.now(timezone.utc)
    run_id = str(uuid.uuid4())

    # Enregistrer le run
    cur.execute("""
    INSERT INTO atlas.ai_interpolation_runs
      (id, run_type, parameter_id, method, model_version, status, metrics, created_at, meta)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        run_id, 'sgs',
        f"{param}_ked_{horizon}",
        'sgs_gstools',
        f"sgs-v1-{n_realizations}real",
        'finished',
        psycopg2.extras.Json({
            'n_realizations': n_realizations,
            'log_transform': log_transform,
            'param': param,
            'horizon': horizon,
            'p10_mean': float(p10.mean()),
            'p50_mean': float(p50.mean()),
            'p90_mean': float(p90.mean()),
        }),
        now,
        psycopg2.extras.Json({'script': 'sgs_interpolation', 'horizon': horizon}),
    ))

    # Superseder les anciennes valeurs SGS
    for pct_method in ['sgs_p10', 'sgs_p50', 'sgs_p90']:
        cur.execute("""
        UPDATE atlas.ai_interpolation_values
        SET is_superseded = true
        WHERE parameter_id = %s AND method = %s
          AND COALESCE(is_superseded, false) = false
        """, (f"{param}_ked_{horizon}", pct_method))

    # Insérer P10/P50/P90
    # Schéma réel : maille_id (UUID), value (pas predicted_value), method, parameter_id
    for pct_label, pct_arr in [('sgs_p10', p10), ('sgs_p50', p50), ('sgs_p90', p90)]:
        rows = [
            (str(uuid.uuid4()), f"{param}_ked_{horizon}", grid_codes[i],
             pct_label, float(pct_arr[i]), float(var_sgs[i]), run_id, False, now)
            for i in range(n_grid)
            if np.isfinite(pct_arr[i])
        ]
        execute_values(cur, """
        INSERT INTO atlas.ai_interpolation_values
          (id, parameter_id, maille_id, method, value, variance,
           run_id, is_superseded, created_at)
        VALUES %s
        ON CONFLICT DO NOTHING
        """, rows, page_size=2000)

    conn.commit()
    print(f"  ✅ Stocké SGS {param}/{horizon}: P50_moy={p50.mean():.3f}")


def main():
    ap = argparse.ArgumentParser(description="P1 — SGS Simulation Séquentielle Gaussienne")
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument("--param", required=True, choices=list(CLAMP_MAP.keys()) + ['cbr_95'],
                    help="Paramètre à simuler")
    ap.add_argument("--horizon", default="h1", choices=["h1", "h2", "h3"])
    ap.add_argument("--n-realizations", type=int, default=50,
                    help="Nombre de réalisations SGS (recommandé: 50-100)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--no-log-transform", action="store_true",
                    help="Désactiver log-transform même pour paramètres asymétriques")
    args = ap.parse_args()

    log_transform = (args.param in LOG_TRANSFORM_PARAMS) and not args.no_log_transform
    print(f"\n{'═'*60}")
    print(f"SGS — {args.param.upper()} {args.horizon.upper()}")
    print(f"  N réalisations = {args.n_realizations}")
    print(f"  Log-transform  = {log_transform}")
    print(f"{'═'*60}")

    conn = psycopg2.connect(args.database_url)

    # Chargement données
    print("\n1. Chargement données conditionnelles...")
    result = load_training_data(conn, args.param, args.horizon)
    if result is None:
        print("[FATAL] Données insuffisantes")
        conn.close()
        return 1
    x_cond, y_cond, val_cond = result

    print("\n2. Chargement grille...")
    gx, gy, gcodes = load_grid(conn)

    print(f"\n3. Simulation SGS ({args.n_realizations} réalisations)...")
    realizations = run_sgs(
        x_cond, y_cond, val_cond,
        gx, gy,
        n_realizations=args.n_realizations,
        seed_base=args.seed,
        log_transform=log_transform,
    )

    print(f"\n4. Stockage P10/P50/P90...")
    store_sgs_results(conn, args.param, args.horizon,
                      realizations, gcodes, args.n_realizations, log_transform)

    conn.close()

    print(f"\n{'═'*60}")
    print(f"✅ SGS terminé: {args.param}/{args.horizon}")
    print(f"   P10={np.percentile(realizations, 10):.3f}")
    print(f"   P50={np.percentile(realizations, 50):.3f}")
    print(f"   P90={np.percentile(realizations, 90):.3f}")
    print(f"{'═'*60}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
