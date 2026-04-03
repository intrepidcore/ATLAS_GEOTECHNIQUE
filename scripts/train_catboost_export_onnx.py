#!/usr/bin/env python3
"""
Entraînement CatBoost (cible score RGA proxy) → export ONNX + manifest JSON pour api-infer / onnx_maille_infer.

Aligné sur les mêmes clés de features que `onnx_maille_infer.py` (vues `v_maille_features_ai`).

Usage :
  pip install -r scripts/requirements-atlas-ml.txt
  # Optionnel pour export ONNX : pip install onnx
  python scripts/train_catboost_export_onnx.py --database-url $DATABASE_URL --out-dir ./models/maille_onnx

  # Enregistrer la version dans atlas.ai_models_registry et l’activer :
  python scripts/train_catboost_export_onnx.py ... --register-db --activate

Sortie :
  <out-dir>/maille_risk.onnx
  <out-dir>/maille_risk_manifest.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple

import numpy as np
import psycopg2
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

try:
    from catboost import CatBoostRegressor, Pool
except ImportError:
    CatBoostRegressor = None  # type: ignore
    Pool = None  # type: ignore

# Ordre identique au défaut de onnx_maille_infer.py (sérialisation MailleFeatures api-geo).
FEATURE_ORDER: List[str] = [
    "n_sondages",
    "vbs_moyen",
    "ip_moyen",
    "gonflement_cg_moyen",
    "profondeur_max_m",
    "pct_in_lama",
    "dsm_altitude_moy_m",
    "dist_riviere_m",
    "dist_surface_eau_m",
    "data_confidence_score",
]


def _require_db(url: str) -> None:
    if not url.strip():
        sys.exit("DATABASE_URL ou --database-url requis pour l’entraînement")


def rule_based_risk_row(feat: Dict[str, Any]) -> float:
    """Même logique que build_prediction (api-geo) — cible d’apprentissage déterministe."""
    vbs = float(feat.get("vbs_moyen") or 7.0)
    ip = float(feat.get("ip_moyen") or 25.0)
    cg = float(feat.get("gonflement_cg_moyen") or 4.0)
    pct_lama = float(feat.get("pct_in_lama") or 0.0)
    in_zone = bool(feat.get("in_zone_rga_tres_fort"))

    vbs_score = 100.0 if vbs >= 8.0 else 75.0 if vbs >= 5.0 else 50.0 if vbs >= 2.5 else 25.0
    ip_score = 100.0 if ip >= 50.0 else 75.0 if ip >= 35.0 else 45.0 if ip >= 20.0 else 20.0
    cg_score = 100.0 if cg >= 10.0 else 60.0 if cg >= 5.0 else 30.0
    risk = (vbs_score * 0.45) + (ip_score * 0.30) + (cg_score * 0.15)
    if pct_lama >= 25.0 or in_zone:
        risk += 10.0
    return float(max(0.0, min(100.0, risk)))


def load_xy(cur) -> Tuple[np.ndarray, np.ndarray]:
    cols = ",\n          ".join(
        [
            "v.n_sondages::float8",
            "v.vbs_moyen::float8",
            "v.ip_moyen::float8",
            "v.gonflement_cg_moyen::float8",
            "v.profondeur_max_m::float8",
            "v.pct_in_lama::float8",
            "v.dsm_altitude_moy_m::float8",
            "v.dist_riviere_m::float8",
            "v.dist_surface_eau_m::float8",
            "v.data_confidence_score::float8",
            "(v.in_zone_rga_tres_fort = 1) AS in_zone_rga_tres_fort",
        ]
    )
    cur.execute(
        f"""
        SELECT
          {cols}
        FROM atlas.v_maille_features_ai v
        """
    )
    X_list: List[List[float]] = []
    y_list: List[float] = []
    for row in cur.fetchall():
        (
            n_sond,
            vbs,
            ip,
            cg,
            prof,
            pct,
            dsm,
            riv,
            eau,
            dc,
            in_zone,
        ) = row
        feat = {
            "n_sondages": float(n_sond or 0),
            "vbs_moyen": vbs,
            "ip_moyen": ip,
            "gonflement_cg_moyen": cg,
            "profondeur_max_m": prof,
            "pct_in_lama": pct,
            "dsm_altitude_moy_m": dsm,
            "dist_riviere_m": riv,
            "dist_surface_eau_m": eau,
            "data_confidence_score": float(dc or 0),
            "in_zone_rga_tres_fort": bool(in_zone),
        }
        xs = [
            float(feat["n_sondages"]),
            float(feat["vbs_moyen"] or 0.0),
            float(feat["ip_moyen"] or 0.0),
            float(feat["gonflement_cg_moyen"] or 0.0),
            float(feat["profondeur_max_m"] or 0.0),
            float(feat["pct_in_lama"] or 0.0),
            float(feat["dsm_altitude_moy_m"] or 0.0),
            float(feat["dist_riviere_m"] or 0.0),
            float(feat["dist_surface_eau_m"] or 0.0),
            float(feat["data_confidence_score"] or 0.0),
        ]
        X_list.append(xs)
        y_list.append(rule_based_risk_row(feat))
    return np.array(X_list, dtype=np.float64), np.array(y_list, dtype=np.float64)


def register_model(
    conn,
    model_key: str,
    version: str,
    onnx_uri: str,
    feature_order: Sequence[str],
    training_metrics: Dict[str, Any],
    activate: bool,
) -> None:
    with conn.cursor() as cur:
        if activate:
            cur.execute(
                """
                UPDATE atlas.ai_models_registry SET is_active = false WHERE model_key = %s
                """,
                (model_key,),
            )
        cur.execute(
            """
            INSERT INTO atlas.ai_models_registry (
              id, model_key, version, framework, onnx_uri, feature_order, training_metrics, is_active
            )
            VALUES (%s::uuid, %s, %s, 'catboost_onnx', %s, %s::jsonb, %s::jsonb, %s)
            ON CONFLICT (model_key, version) DO UPDATE SET
              onnx_uri = EXCLUDED.onnx_uri,
              feature_order = EXCLUDED.feature_order,
              training_metrics = EXCLUDED.training_metrics,
              is_active = EXCLUDED.is_active
            """,
            (
                str(uuid.uuid4()),
                model_key,
                version,
                onnx_uri,
                json.dumps(list(feature_order)),
                json.dumps(training_metrics),
                activate,
            ),
        )
    conn.commit()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""))
    p.add_argument("--out-dir", default=os.environ.get("ATLAS_ONNX_OUT_DIR", "./models/maille_onnx"))
    p.add_argument("--model-key", default="maille_rga_onnx")
    p.add_argument("--model-version", default="catboost_onnx_mailles_v1")
    p.add_argument("--register-db", action="store_true")
    p.add_argument("--activate", action="store_true", help="Marque cette version active (désactive les autres du même model_key)")
    p.add_argument(
        "--onnx-uri-prefix",
        default="",
        help="Préfixe URI en base + nom fichier (ex. file:///app/models). Vide = file:// + chemin absolu local.",
    )
    args = p.parse_args()

    if CatBoostRegressor is None:
        print("catboost requis: pip install catboost", file=sys.stderr)
        return 3

    db_url = args.database_url.strip()
    _require_db(db_url)

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            X, y = load_xy(cur)
    finally:
        conn.close()

    if X.shape[0] < 32:
        print(f"Jeux trop petit: n={X.shape[0]} (min 32 recommandé)", file=sys.stderr)
        if X.shape[0] < 8:
            return 2

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    train_pool = Pool(X_train, y_train)
    test_pool = Pool(X_test, y_test)

    model = CatBoostRegressor(
        depth=6,
        iterations=400,
        learning_rate=0.06,
        loss_function="RMSE",
        verbose=False,
        random_seed=42,
    )
    model.fit(train_pool, eval_set=test_pool, early_stopping_rounds=40)

    y_pred = model.predict(X_test)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = float(r2_score(y_test, y_pred))
    metrics = {
        "n_total": int(X.shape[0]),
        "n_train": int(X_train.shape[0]),
        "n_test": int(X_test.shape[0]),
        "rmse_holdout": rmse,
        "r2_holdout": r2,
        "feature_order": FEATURE_ORDER,
        "target": "rule_based_risk_v0_clone",
    }

    os.makedirs(args.out_dir, exist_ok=True)
    base = os.path.join(args.out_dir, "maille_risk")
    onnx_path = base + ".onnx"
    manifest_path = base + "_manifest.json"

    try:
        model.save_model(onnx_path, format="onnx")
    except Exception as e:
        print(
            json.dumps({"error": "onnx_export_failed", "detail": str(e)}),
            file=sys.stderr,
        )
        print("Astuce: pip install onnx && vérifier catboost>=1.2", file=sys.stderr)
        return 4

    manifest = {
        "model_key": args.model_key,
        "model_version": args.model_version,
        "feature_order": FEATURE_ORDER,
        "n_features": len(FEATURE_ORDER),
        "onnx_file": os.path.basename(onnx_path),
        "training_metrics": metrics,
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(json.dumps({"ok": True, "onnx": onnx_path, "manifest": manifest_path, "metrics": metrics}))

    if args.register_db:
        if args.onnx_uri_prefix.strip():
            uri = args.onnx_uri_prefix.rstrip("/") + "/" + os.path.basename(onnx_path)
        else:
            uri = Path(onnx_path).resolve().as_uri()
        conn2 = psycopg2.connect(db_url)
        try:
            register_model(
                conn2,
                args.model_key,
                args.model_version,
                uri,
                FEATURE_ORDER,
                metrics,
                args.activate,
            )
        finally:
            conn2.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
