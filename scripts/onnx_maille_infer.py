#!/usr/bin/env python3
"""
Inférence ONNX pour une maille — appelé par api-infer (stdin JSON → stdout JSON).

Entrée (JSON) :
  { "features": { ... MailleFeatures ... }, "charge_kpa": 150.0 }

Sortie : même structure métier que build_prediction (api-geo) quand le modèle est chargé.

Variables :
  ATLAS_ONNX_MAILLE_MODEL_PATH — chemin vers le fichier .onnx
  ATLAS_ONNX_FEATURE_ORDER — optionnel, liste JSON des clés dans l'ordre des entrées du modèle
  ATLAS_ONNX_MANIFEST_PATH — optionnel, JSON { "feature_order", "n_features", "model_version" } (écrit par train_catboost_export_onnx.py)
  ATLAS_ONNX_MODEL_VERSION — surcharge la version renvoyée dans la prédiction

Validation : la taille du vecteur d’entrées doit correspondre à la 2e dimension du tenseur ONNX (ou à n_features du manifest) ; sinon exit 4.
"""
from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, List, Optional, Tuple


def _load_manifest(path: str) -> Optional[Dict[str, Any]]:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def _expected_feature_count(sess: Any, manifest: Optional[Dict[str, Any]]) -> Tuple[Optional[int], str]:
    if manifest:
        nf = manifest.get("n_features")
        if nf is not None:
            try:
                return int(nf), "manifest"
            except (TypeError, ValueError):
                pass
        fo = manifest.get("feature_order")
        if isinstance(fo, list):
            return len(fo), "manifest.feature_order"
    inp0 = sess.get_inputs()[0]
    shape = inp0.shape
    # (batch, n) or (n,) ou symboles str
    if isinstance(shape, (list, tuple)) and len(shape) >= 2:
        d1 = shape[1]
        if isinstance(d1, int) and d1 > 0:
            return d1, "onnx_input.shape[1]"
    if isinstance(shape, (list, tuple)) and len(shape) == 1:
        d0 = shape[0]
        if isinstance(d0, int) and d0 > 0:
            return d0, "onnx_input.shape[0]"
    return None, "unknown"


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as e:
        print(json.dumps({"error": "invalid_json", "detail": str(e)}), file=sys.stderr)
        return 1

    model_path = (os.environ.get("ATLAS_ONNX_MAILLE_MODEL_PATH") or "").strip()
    if not model_path or not os.path.isfile(model_path):
        print(
            json.dumps(
                {
                    "error": "onnx_model_missing",
                    "detail": "Set ATLAS_ONNX_MAILLE_MODEL_PATH to a trained .onnx file "
                         "(export CatBoost / sklearn avec dimensions compatibles).",
                }
            ),
            file=sys.stderr,
        )
        return 2

    try:
        import numpy as np
        import onnxruntime as ort
    except ImportError as e:
        print(json.dumps({"error": "deps_missing", "detail": str(e)}), file=sys.stderr)
        return 3

    feats: Dict[str, Any] = payload.get("features") or {}

    manifest: Optional[Dict[str, Any]] = None
    man_path = (os.environ.get("ATLAS_ONNX_MANIFEST_PATH") or "").strip()
    if man_path and os.path.isfile(man_path):
        manifest = _load_manifest(man_path)
    if manifest is None:
        alt = os.path.splitext(model_path)[0] + "_manifest.json"
        if os.path.isfile(alt):
            manifest = _load_manifest(alt)

    order_raw = os.environ.get("ATLAS_ONNX_FEATURE_ORDER", "").strip()
    if order_raw:
        keys: List[str] = json.loads(order_raw)
    elif manifest and isinstance(manifest.get("feature_order"), list):
        keys = [str(k) for k in manifest["feature_order"]]
    else:
        keys = [
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

    row: List[float] = []
    missing_keys: List[str] = []
    for k in keys:
        v = feats.get(k)
        if v is None:
            missing_keys.append(k)
            row.append(0.0)
        elif isinstance(v, bool):
            row.append(1.0 if v else 0.0)
        else:
            try:
                row.append(float(v))
            except (TypeError, ValueError):
                missing_keys.append(k)
                row.append(0.0)

    sess = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    exp_n, exp_src = _expected_feature_count(sess, manifest)
    if exp_n is not None and len(row) != exp_n:
        print(
            json.dumps(
                {
                    "error": "onnx_feature_dim_mismatch",
                    "detail": f"Built {len(row)} features ({exp_src} expects {exp_n}). "
                    f"Check ATLAS_ONNX_FEATURE_ORDER or manifest. Missing/zero-filled keys sample: {missing_keys[:5]}",
                }
            ),
            file=sys.stderr,
        )
        return 4

    x = np.array([row], dtype=np.float32)
    inp = sess.get_inputs()[0].name
    out = sess.run(None, {inp: x})
    y = float(np.asarray(out[0]).ravel()[0])

    charge = payload.get("charge_kpa")
    try:
        charge_f = float(charge) if charge is not None else 150.0
    except (TypeError, ValueError):
        charge_f = 150.0

    risk_score = max(0.0, min(100.0, y))
    bearing_capacity_kpa: float = max(60.0, 220.0 - (risk_score * 1.1))
    settlement_risk = ((charge_f / bearing_capacity_kpa) * 100.0) if bearing_capacity_kpa else 0.0
    settlement_risk = max(0.0, min(100.0, settlement_risk))
    dc = float(feats.get("data_confidence_score") or 50)
    confidence = max(0.1, min(0.95, dc / 100.0))

    mv_default = "api-infer-onnx-v1"
    if manifest and manifest.get("model_version"):
        mv_default = str(manifest["model_version"])
    mv_env = (os.environ.get("ATLAS_ONNX_MODEL_VERSION") or "").strip()
    out_j = {
        "model_version": mv_env or mv_default,
        "risk_score": round(risk_score, 2),
        "rga_class": (
            "tres_fort"
            if risk_score >= 80
            else "fort"
            if risk_score >= 60
            else "moyen"
            if risk_score >= 40
            else "faible"
        ),
        "norme_appliquee": "ONNX supervised (Atlas)",
        "facteurs_determinants": ["modele_onnx"],
        "data_confidence": int(dc),
        "estimated_bearing_capacity_kpa": round(bearing_capacity_kpa, 2),
        "estimated_settlement_risk_pct": round(settlement_risk, 2),
        "confidence": round(confidence * 100.0, 2),
    }
    print(json.dumps(out_j))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
