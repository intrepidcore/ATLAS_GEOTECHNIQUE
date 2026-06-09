#!/usr/bin/env python3
"""
regeocod_fuzzy_v1.py — Re-géocodage Fuzzy-Regex des sondages invalides
========================================================================
Traite les sondages avec location_mode IN ('fallback_default', NULL, 'unknown')
en extrayant la localité depuis le code/champs texte et en la matchant contre
atlas.adm3 via rapidfuzz.WRatio.

Stratégie à 3 niveaux :
  Score ≥ 85  → auto_apply  : centroïde ADM3 appliqué automatiquement
  Score 60–84 → propose     : insertion dans atlas.geocode_suggestions
  Score < 60  → manual_required : flag seulement, pas d'action

Référence : AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md — Phase 2 / Section 4.5
DB cible  : postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean (CONV-15)

Usage :
  python scripts/regeocod_fuzzy_v1.py                          # Lancement réel
  python scripts/regeocod_fuzzy_v1.py --dry-run                # Simulation
  python scripts/regeocod_fuzzy_v1.py --threshold-auto 90      # Seuil strict
  python scripts/regeocod_fuzzy_v1.py --source-filter V10_MASTER_2026
  python scripts/regeocod_fuzzy_v1.py --exclude-locked         # Skip adm_random_cell
  python scripts/regeocod_fuzzy_v1.py --status                 # Résumé des sondages
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERREUR: psycopg2-binary requis. Installer: pip install psycopg2-binary")
    sys.exit(1)

try:
    from rapidfuzz import fuzz, process as rfuzz_process
except ImportError:
    print("ERREUR: rapidfuzz requis. Installer: pip install rapidfuzz")
    sys.exit(1)

# ─── Constantes ──────────────────────────────────────────────────────────────

SCRIPTS_DIR  = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPTS_DIR.parent
LOGS_DIR     = PROJECT_ROOT / "logs"

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean",
)

DEFAULT_THRESHOLD_AUTO    = 85.0
DEFAULT_THRESHOLD_PROPOSE = 60.0

# Modes cibles — sondages à re-géocoder
TARGET_MODES = ("fallback_default", "unknown")

# ─── Logging ─────────────────────────────────────────────────────────────────

def setup_logging(dry_run: bool = False) -> logging.Logger:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    ts  = datetime.now().strftime("%Y%m%d_%H%M%S")
    tag = "_dryrun" if dry_run else ""
    log_path = LOGS_DIR / f"regeocode_fuzzy_{ts}{tag}.log"

    fmt = "%(asctime)s [%(levelname)-8s] %(message)s"
    logging.basicConfig(
        level=logging.INFO,
        format=fmt,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(log_path, encoding="utf-8"),
        ],
    )
    log = logging.getLogger("regeocod_fuzzy")
    log.info("Log : %s", log_path)
    return log


# ─── Extraction de localité ───────────────────────────────────────────────────

# Patterns ordonnés par priorité décroissante
_PATTERNS = [
    # Pattern EMPRUNT : LOCALITE_EMPRUNT_...
    re.compile(r"^([A-Z][A-Z0-9]+(?:_[A-Z0-9]+)?)_EMPRUNT_", re.IGNORECASE),
    # Pattern TYPE_NUM : LOCALITE_S12, LOCALITE_E3, LOCALITE_PD1, etc.
    re.compile(r"^([A-Z][A-Z0-9]+(?:_[A-Z0-9]+)?)_(?:S|E|PD|SC|SP|TAR|PUITS|T\d+_S|T\d+_P)\d*", re.IGNORECASE),
    # Pattern générique : premier segment avant underscore
]

_SUFFIXES_TO_STRIP = [
    "KOPE", "KOPÉ", "KOUE", "VILLE", "BOURG",
]


def extract_locality(sondage: dict[str, Any]) -> str:
    """
    Extrait le nom de localité le plus probable depuis les champs disponibles.
    Ordre de priorité : localite_key > localite_base > localite > code.
    """
    # 1. Champs dédiés
    for field in ("localite_key", "localite_base", "localite"):
        val = (sondage.get(field) or "").strip()
        if val:
            return val.upper()

    # 2. Extraction depuis le code
    code = (sondage.get("code") or "").strip().upper()
    if not code:
        return ""

    for pat in _PATTERNS:
        m = pat.match(code)
        if m:
            raw = m.group(1).replace("_", " ").strip()
            for suf in _SUFFIXES_TO_STRIP:
                raw = re.sub(rf"\b{suf}\b", "", raw, flags=re.IGNORECASE).strip()
            return raw

    # Fallback : premier segment avant _
    parts = code.split("_")
    return parts[0].strip()


# ─── Matching fuzzy ───────────────────────────────────────────────────────────

def match_to_adm3(
    locality: str,
    adm3_list: list[dict],
    threshold_auto: float,
    threshold_propose: float,
) -> dict[str, Any]:
    """
    Tente de matcher la localité contre atlas.adm3 via rapidfuzz.WRatio.

    Retourne :
        matched_adm3 (dict ou None), score (float),
        method ('exact'|'fuzzy_high'|'fuzzy_low'|'no_match'),
        action ('auto_apply'|'propose'|'manual_required')
    """
    if not locality or not adm3_list:
        return {"matched_adm3": None, "score": 0.0, "method": "no_match", "action": "manual_required"}

    names = [a["adm3_fr"] for a in adm3_list]

    # Match exact (insensible à la casse)
    for adm in adm3_list:
        n = adm["adm3_fr"].upper()
        if locality.upper() == n or locality.upper() in n or n in locality.upper():
            return {
                "matched_adm3": adm,
                "score": 100.0,
                "method": "exact",
                "action": "auto_apply",
            }

    # Fuzzy WRatio
    result = rfuzz_process.extractOne(locality, names, scorer=fuzz.WRatio)
    if result is None:
        return {"matched_adm3": None, "score": 0.0, "method": "no_match", "action": "manual_required"}

    best_name, score, _ = result
    matched_adm = next((a for a in adm3_list if a["adm3_fr"] == best_name), None)

    if score >= threshold_auto:
        method = "fuzzy_high"
        action = "auto_apply"
    elif score >= threshold_propose:
        method = "fuzzy_low"
        action = "propose"
    else:
        method = "no_match"
        action = "manual_required"

    return {
        "matched_adm3": matched_adm if action in ("auto_apply", "propose") else None,
        "score": float(score),
        "method": method,
        "action": action,
    }


# ─── DB helpers ──────────────────────────────────────────────────────────────

def connect(db_url: str):
    """Connexion psycopg2 avec retry."""
    for attempt in range(5):
        try:
            conn = psycopg2.connect(db_url)
            return conn
        except psycopg2.OperationalError as e:
            if attempt == 4:
                raise
            logging.warning("Connexion DB échouée (tentative %d/5): %s", attempt + 1, e)
            time.sleep(2 ** attempt)
    raise RuntimeError("Impossible de se connecter à la DB")


def load_adm3(cur) -> list[dict]:
    """Charge toute la table atlas.adm3 en mémoire."""
    cur.execute(
        """
        SELECT gid, adm3_fr, adm2_fr, adm1_fr,
               ST_AsText(ST_Centroid(geom)) AS centroid_wkt,
               ST_X(ST_Centroid(geom))      AS centroid_lon,
               ST_Y(ST_Centroid(geom))      AS centroid_lat
        FROM atlas.adm3
        ORDER BY adm3_fr
        """
    )
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in rows]


def load_sondages(cur, source_filter: Optional[str], exclude_locked: bool) -> list[dict]:
    """
    Charge les sondages cibles :
    - location_mode IN ('fallback_default', 'unknown') OU NULL
    - Optionnellement filtrés par source
    - Optionnellement exclut les adm_random_cell (--exclude-locked)
    """
    excluded_modes = list(TARGET_MODES) + (["adm_random_cell"] if exclude_locked else [])
    placeholders = ", ".join(["%s"] * len(excluded_modes))

    base_sql = f"""
        SELECT id, code, localite_key, localite_base, localite,
               adm3_name, adm2_name, adm1_name, source,
               location_mode, maille_code,
               ST_AsText(geom) AS geom_wkt
        FROM atlas.sondages
        WHERE deleted_at IS NULL
          AND (
              location_mode IN ('fallback_default', 'unknown')
              OR location_mode IS NULL
          )
          AND location_mode NOT IN ('exact', 'gps', 'manual', 'inferred')
    """

    params: list[Any] = []

    if source_filter:
        base_sql += " AND source = %s"
        params.append(source_filter)

    base_sql += " ORDER BY source, code"

    cur.execute(base_sql, params)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in rows]


def apply_geocode(cur, sondage_id: str, adm: dict, action: str, log: logging.Logger):
    """
    Applique le geocodage en DB. Triggers desactives en amont.
    """
    cur.execute(
        """
        UPDATE atlas.sondages
        SET
            geom          = ST_SetSRID(ST_MakePoint(%s, %s), 4326),
            adm3_id       = %s,
            adm3_name     = %s,
            adm2_name     = %s,
            adm1_name     = %s,
            location_mode = 'inferred',
            maille_code   = (
                SELECT m.code FROM atlas.mailles m
                WHERE ST_Contains(m.geom, ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 25231))
                LIMIT 1
            ),
            updated_at    = NOW()
        WHERE id = %s::uuid
          AND location_mode = 'fallback_default'
        """,
        (
            adm["centroid_lon"], adm["centroid_lat"],
            adm["gid"],
            adm["adm3_fr"], adm["adm2_fr"], adm["adm1_fr"],
            adm["centroid_lon"], adm["centroid_lat"],
            sondage_id,
        ),
    )
    log.debug("  -> applique ADM3 %s (%s) sur sondage %s", adm["adm3_fr"], action, sondage_id[:8])


def insert_suggestion(
    cur,
    sondage: dict,
    adm: dict,
    score: float,
    locality: str,
    log: logging.Logger,
):
    """Insère une suggestion dans atlas.geocode_suggestions."""
    cur.execute(
        """
        INSERT INTO atlas.geocode_suggestions
            (sondage_id, sondage_code, locality_extracted, fuzzy_score,
             proposed_adm3_id, proposed_adm3_name, proposed_adm2_name, proposed_adm1_name,
             proposed_geom, source_import, action)
        VALUES
            (%s::uuid, %s, %s, %s,
             %s, %s, %s, %s,
             ST_SetSRID(ST_MakePoint(%s, %s), 4326),
             %s, 'proposed')
        ON CONFLICT DO NOTHING
        """,
        (
            sondage["id"], sondage["code"], locality, score,
            adm["gid"], adm["adm3_fr"], adm["adm2_fr"], adm["adm1_fr"],
            adm["centroid_lon"], adm["centroid_lat"],
            sondage.get("source"),
        ),
    )
    log.debug("  → suggestion créée pour %s (score=%.1f, ADM3=%s)", sondage["code"], score, adm["adm3_fr"])


def flag_manual(cur, sondage: dict, locality: str, log: logging.Logger):
    """Insère un flag 'manual_required' dans atlas.geocode_suggestions."""
    cur.execute(
        """
        INSERT INTO atlas.geocode_suggestions
            (sondage_id, sondage_code, locality_extracted, fuzzy_score,
             source_import, action)
        VALUES
            (%s::uuid, %s, %s, 0.0, %s, 'manual_required')
        ON CONFLICT DO NOTHING
        """,
        (sondage["id"], sondage["code"], locality, sondage.get("source")),
    )
    log.debug("  → manual_required pour %s", sondage["code"])


# ─── Rapport CSV ─────────────────────────────────────────────────────────────

def write_csv_report(results: list[dict], dry_run: bool) -> Path:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    ts  = datetime.now().strftime("%Y%m%d_%H%M%S")
    tag = "_dryrun" if dry_run else ""
    csv_path = LOGS_DIR / f"regeocode_fuzzy_{ts}{tag}.csv"

    fieldnames = [
        "sondage_id", "code", "source", "locality_extracted",
        "matched_adm3", "score", "method", "action",
        "adm2", "adm1",
    ]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in results:
            adm = r.get("matched_adm3") or {}
            w.writerow({
                "sondage_id": r["sondage_id"],
                "code": r["code"],
                "source": r["source"],
                "locality_extracted": r["locality"],
                "matched_adm3": adm.get("adm3_fr", ""),
                "score": f"{r['score']:.1f}",
                "method": r["method"],
                "action": r["action"],
                "adm2": adm.get("adm2_fr", ""),
                "adm1": adm.get("adm1_fr", ""),
            })
    return csv_path


# ─── Main ─────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Re-géocodage fuzzy-regex des sondages Atlas Géotechnique du Togo",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--dry-run", action="store_true",
                   help="Simule sans appliquer aucune modification à la DB")
    p.add_argument("--threshold-auto", type=float, default=DEFAULT_THRESHOLD_AUTO,
                   help=f"Score minimum pour application automatique (défaut: {DEFAULT_THRESHOLD_AUTO})")
    p.add_argument("--threshold-propose", type=float, default=DEFAULT_THRESHOLD_PROPOSE,
                   help=f"Score minimum pour proposition (défaut: {DEFAULT_THRESHOLD_PROPOSE})")
    p.add_argument("--source-filter", type=str,
                   help="Filtrer par source d'import (ex: V10_MASTER_2026)")
    p.add_argument("--exclude-locked", action="store_true",
                   help="Ne pas modifier les sondages adm_random_cell (déjà verrouillés)")
    p.add_argument("--status", action="store_true",
                   help="Affiche les statistiques actuelles et quitte")
    p.add_argument("--database-url", default=DB_URL,
                   help=f"URL PostgreSQL (défaut: {DB_URL})")
    return p.parse_args()


def print_status(conn) -> None:
    """Affiche les statistiques actuelles des sondages."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT location_mode, COUNT(*) AS n
            FROM atlas.sondages
            WHERE deleted_at IS NULL
            GROUP BY location_mode
            ORDER BY n DESC
            """
        )
        rows = cur.fetchall()

        print("\n── Sondages par location_mode ──────────────────")
        for mode, n in rows:
            tag = " ← CIBLE" if mode in TARGET_MODES or mode is None else ""
            print(f"  {str(mode):<25} : {n:>4}{tag}")

        cur.execute(
            """
            SELECT COUNT(*) FROM atlas.sondages
            WHERE geom = ST_SetSRID(ST_MakePoint(1, 8.6), 4326)
              AND deleted_at IS NULL
            """
        )
        n_fallback = cur.fetchone()[0]
        print(f"\n  POINT(1 8.6) encore présents     : {n_fallback}")

        cur.execute("SELECT COUNT(*) FROM atlas.geocode_suggestions WHERE action = 'proposed'")
        n_prop = cur.fetchone()[0]
        print(f"  Suggestions en attente (proposed): {n_prop}")
        print("────────────────────────────────────────────────\n")


def main() -> int:
    args  = parse_args()
    log    = setup_logging(dry_run=args.dry_run)
    db_url = args.database_url
    conn   = connect(db_url)

    if args.status:
        print_status(conn)
        conn.close()
        return 0

    log.info("Mode        : %s", "DRY-RUN" if args.dry_run else "RÉEL")
    log.info("Seuil auto  : %.0f%%", args.threshold_auto)
    log.info("Seuil propoz: %.0f%%", args.threshold_propose)
    log.info("Source filtr: %s", args.source_filter or "(toutes)")
    log.info("Excl. locked: %s", args.exclude_locked)

    with conn.cursor() as cur:
        log.info("Chargement atlas.adm3...")
        adm3_list = load_adm3(cur)
        log.info("  %d cantons chargés", len(adm3_list))

        log.info("Chargement sondages cibles...")
        sondages = load_sondages(cur, args.source_filter, args.exclude_locked)
        log.info("  %d sondages à traiter", len(sondages))

    if not sondages:
        log.info("Aucun sondage à traiter — base déjà propre.")
        conn.close()
        return 0

    counts = {"auto_apply": 0, "propose": 0, "manual_required": 0, "error": 0}
    results: list[dict] = []

    with conn.cursor() as cur:
        # Desactiver les triggers pour eviter N refreshes MV (perf critique)
        if not args.dry_run:
            cur.execute("ALTER TABLE atlas.sondages DISABLE TRIGGER ALL")
            conn.commit()
            log.info("  Triggers desactives pour batch")

        for idx, sondage in enumerate(sondages, 1):
            locality = extract_locality(sondage)
            match    = match_to_adm3(
                locality, adm3_list,
                args.threshold_auto, args.threshold_propose,
            )

            action       = match["action"]
            matched_adm  = match["matched_adm3"]
            score        = match["score"]
            method       = match["method"]

            log.info(
                "[%d/%d] %-30s -> %-20s score=%.1f action=%s",
                idx, len(sondages),
                sondage["code"][:30], locality[:20], score, action,
            )

            results.append({
                "sondage_id": str(sondage["id"]),
                "code": sondage["code"],
                "source": sondage.get("source", ""),
                "locality": locality,
                "matched_adm3": matched_adm,
                "score": score,
                "method": method,
                "action": action,
            })

            counts[action] = counts.get(action, 0) + 1

            if args.dry_run:
                continue

            try:
                if action == "auto_apply" and matched_adm:
                    apply_geocode(cur, str(sondage["id"]), matched_adm, action, log)
                elif action == "propose" and matched_adm:
                    insert_suggestion(cur, sondage, matched_adm, score, locality, log)
                elif action == "manual_required":
                    flag_manual(cur, sondage, locality, log)

                # Commit par lot de 50
                if idx % 50 == 0:
                    conn.commit()
                    log.info("  Commit intermediaire (%d)", idx)

            except Exception as e:
                log.error("  ERREUR sur %s: %s", sondage["code"], e)
                counts["error"] += 1
                conn.rollback()

        if not args.dry_run:
            conn.commit()
            # Reactiver les triggers
            cur.execute("ALTER TABLE atlas.sondages ENABLE TRIGGER ALL")
            conn.commit()
            log.info("  Triggers reactives")
            # Rafraichir la MV une seule fois
            log.info("Refresh atlas.mv_mailles_geotech...")
            conn.autocommit = True
            cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech")
            conn.autocommit = False
            log.info("  MV rafraichie")

    # ── Rapport ──────────────────────────────────────────────────────────────
    csv_path = write_csv_report(results, args.dry_run)
    log.info("Rapport CSV : %s", csv_path)

    log.info("=" * 50)
    log.info("RESUME FINAL%s", " (DRY-RUN)" if args.dry_run else "")
    log.info("  Total traites      : %d", len(sondages))
    log.info("  Auto-appliques     : %d (score >= %.0f%%)", counts["auto_apply"], args.threshold_auto)
    log.info("  Proposes           : %d (score %.0f-%.0f%%)", counts["propose"], args.threshold_propose, args.threshold_auto)
    log.info("  Geocodage manuel   : %d (score < %.0f%%)", counts["manual_required"], args.threshold_propose)
    if counts["error"]:
        log.warning("  Erreurs            : %d", counts["error"])
    log.info("=" * 50)

    conn.close()
    return 0 if counts["error"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
