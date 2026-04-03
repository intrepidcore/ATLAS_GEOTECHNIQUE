#!/usr/bin/env python3
"""
Repair missing AMESSEFE essais (Phase 0 -> Block 4 support) using canonical tables.

Why:
  The existing repair script used tabular assumptions for Excel structure.
  This script uses the canonical Excel parser `scripts/utils/amessefe_excel.py`
  and upserts into the canonical DB tables used by the thematic matrix:
    - essais_vbs (vbs)
    - essais_atterberg (ip_generated)
    - essais_potentiel_gonflement (cg)

Inputs:
  data/xlsx/audit_amessefe_essais_comparatif.xlsx (sheet "actions")

Output:
  Console summary + DB updates (idempotent via ON CONFLICT).
"""

from __future__ import annotations

import argparse
import time
import difflib
import uuid
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import pandas as pd
from sqlalchemy import create_engine, text

from utils.amessefe_excel import (
    load_vbs,
    load_limites,
    load_gonflement,
    STANDARD_DEPTHS,
)
from utils.normalize import normalize_localite


DEFAULT_PG = "postgresql+psycopg2://atlas:atlas@localhost:5432/atlas_clean"
AMESSEFE_SOURCE = "AMESSEFE Komi Yoan Freddy"
DB_SCHEMA = "atlas"
FUZZY_CUTOFF = 0.82


def _audit_actions_path(repo: Path) -> Path:
    candidates = [
        repo / "data" / "xlsx" / "audit_amessefe_essais_comparatif.xlsx",
        repo / "data" / "xlsx" / "audit_amessefe_v2.xlsx",
        repo / "data" / "xlsx" / "audit_amessefe_essais_comparatif.xlsx",
    ]
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError("No audit_amessefe_essais_comparatif.xlsx found in data/xlsx/")


def _get_sondage_map(conn, source_label: str) -> Dict[str, str]:
    """
    Map localite_norm -> sondage_id.
    We normalize the display fields from DB to the same canonical scheme used by Excel loaders.
    """
    rows = conn.execute(
        text(
            f"""
            SELECT
              id::text AS sondage_id,
              COALESCE(localite, localite_base, meta->>'localite', code) AS localite_raw
            FROM {DB_SCHEMA}.sondages
            WHERE source = :src AND deleted_at IS NULL
            """
        ),
        {"src": source_label},
    ).fetchall()

    mapping: Dict[str, str] = {}
    for sondage_id, localite_raw in rows:
        norm = normalize_localite(localite_raw)
        if norm:
            mapping[norm] = sondage_id
    return mapping


def _get_echantillon_map(conn, sondage_id: str, depths: Iterable[float]) -> Dict[float, str]:
    depths_list = list(depths)
    rows = conn.execute(
        text(
            f"""
            SELECT id::text AS echantillon_id, depth_m
            FROM {DB_SCHEMA}.echantillons
            WHERE sondage_id = :sid
              AND depth_m = ANY(CAST(:depths AS numeric[]))
            """
        ),
        {"sid": sondage_id, "depths": depths_list},
    ).fetchall()

    out: Dict[float, str] = {}
    for echantillon_id, depth_m in rows:
        if depth_m is None:
            continue
        out[float(depth_m)] = echantillon_id
    return out


def _chunked(lst: List[Tuple], chunk_size: int) -> Iterable[List[Tuple]]:
    for i in range(0, len(lst), chunk_size):
        yield lst[i : i + chunk_size]


def main() -> int:
    parser = argparse.ArgumentParser(description="Repair missing AMESSEFE essais into canonical tables")
    parser.add_argument("--pgurl", default=DEFAULT_PG)
    parser.add_argument(
        "--depths",
        default=None,
        help=f"Comma-separated depths (default: {STANDARD_DEPTHS})",
    )
    parser.add_argument("--limit-localites", type=int, default=None, help="Optional cap for testing")
    parser.add_argument(
        "--only-limites",
        action="store_true",
        help="Repair uniquement les essais Atterberg (wl/wp + ip_generated).",
    )
    parser.add_argument(
        "--skip-feature-refresh",
        action="store_true",
        help="Skip refresh_ai_maille_features_fast_for_codes (feature store).",
    )
    parser.add_argument(
        "--skip-mv-refresh",
        action="store_true",
        help="Skip REFRESH MATERIALIZED VIEW atlas.mv_mailles_geotech.",
    )
    parser.add_argument(
        "--feature-refresh-mode",
        choices=["auto", "full", "lightweight"],
        default="auto",
        help=(
            "Refresh strategy for ai_maille_features_fast. "
            "auto=try full and fallback lightweight, full=force full, lightweight=force lightweight."
        ),
    )
    parser.add_argument(
        "--feature-refresh-timeout-ms",
        type=int,
        default=120000,
        help="Statement timeout per feature-store batch in milliseconds.",
    )
    parser.add_argument(
        "--debug-localite",
        type=str,
        default=None,
        help="Debug: print computed wl/wp/ip + eid for this localite_norm.",
    )
    args = parser.parse_args()

    repo = Path(__file__).resolve().parent.parent
    audit_path = _audit_actions_path(repo)

    depths = STANDARD_DEPTHS
    if args.depths:
        depths = [float(x.strip()) for x in args.depths.split(",") if x.strip()]

    t0 = time.time()
    df_actions = pd.read_excel(audit_path, sheet_name="actions")

    # Column names: "localite_norm" and "action_suggeree" are stable across generator.
    df_actions = df_actions[df_actions["action_suggeree"] == "IMPORTER_ESSAIS"].copy()

    localite_norms: List[str] = sorted(set(df_actions["localite_norm"].dropna().astype(str).tolist()))
    if args.limit_localites is not None:
        localite_norms = localite_norms[: args.limit_localites]

    print(f"[INFO] audit: {len(localite_norms)} localite_norms to repair (IMPORTER_ESSAIS)")
    if not localite_norms and not args.only_limites:
        return 0

    # Load Excel canonical records once.
    # Mode accéléré pour P0: on peut ne charger que les limites (Atterberg).
    if args.only_limites:
        vbs_recs = []
        limites_recs = load_limites()
        gonf_recs = []
    else:
        vbs_recs = load_vbs()
        limites_recs = load_limites()
        gonf_recs = load_gonflement()

    vbs_by_loc: Dict[str, List] = {}
    for r in vbs_recs:
        if r.vbs is None:
            continue
        vbs_by_loc.setdefault(r.localite_norm, []).append(r)

    limites_by_loc: Dict[str, List] = {}
    for r in limites_recs:
        limites_by_loc.setdefault(r.localite_norm, []).append(r)

    gonf_by_loc: Dict[str, List] = {}
    for r in gonf_recs:
        if r.cg is None:
            continue
        gonf_by_loc.setdefault(r.localite_norm, []).append(r)

    # En mode P0 (atatterberg uniquement), on veut couvrir toutes les localités
    # présentes dans `limite.xlsx` (pas seulement l'audit).
    if args.only_limites:
        localite_norms = sorted(limites_by_loc.keys())
        if args.limit_localites is not None:
            localite_norms = localite_norms[: args.limit_localites]

        print(f"[INFO] only-limites mode: using {len(localite_norms)} localite_norms from limite.xlsx")
    else:
        # En mode complet, pour maximiser la croissance de couverture (P0b),
        # on traite toutes les localités disponibles dans les fichiers Excel
        # (évite de dépendre uniquement de l'audit IMPORTER_ESSAIS).
        localite_norms = sorted(set(vbs_by_loc.keys()) | set(limites_by_loc.keys()) | set(gonf_by_loc.keys()))
        if args.limit_localites is not None:
            localite_norms = localite_norms[: args.limit_localites]

        print(f"[INFO] full mode: using {len(localite_norms)} localite_norms from Excel (union)")

    vbs_keys = list(vbs_by_loc.keys())
    limites_keys = list(limites_by_loc.keys())
    gonf_keys = list(gonf_by_loc.keys())

    engine = create_engine(args.pgurl)
    total_vbs = 0
    total_ip = 0
    total_eg = 0
    affected_sondage_ids: set[str] = set()
    import_id = str(uuid.uuid4())

    def _coverage_counts(conn) -> Tuple[int, int, int]:
        """Counts distinct localities by non-null availability (AMESSEFE source)."""
        n_vbs = conn.execute(
            text(
                f"""
                SELECT COUNT(DISTINCT s.localite_key)
                FROM {DB_SCHEMA}.sondages s
                JOIN {DB_SCHEMA}.echantillons e ON e.sondage_id = s.id
                JOIN {DB_SCHEMA}.essais_vbs ev ON ev.echantillon_id = e.id
                WHERE s.source = :src
                  AND s.deleted_at IS NULL
                  AND ev.vbs IS NOT NULL
                """
            ),
            {"src": AMESSEFE_SOURCE},
        ).scalar_one()

        n_ip = conn.execute(
            text(
                f"""
                SELECT COUNT(DISTINCT s.localite_key)
                FROM {DB_SCHEMA}.sondages s
                JOIN {DB_SCHEMA}.echantillons e ON e.sondage_id = s.id
                JOIN {DB_SCHEMA}.essais_atterberg ea ON ea.echantillon_id = e.id
                WHERE s.source = :src
                  AND s.deleted_at IS NULL
                  AND ea.ip_generated IS NOT NULL
                """
            ),
            {"src": AMESSEFE_SOURCE},
        ).scalar_one()

        n_wl = conn.execute(
            text(
                f"""
                SELECT COUNT(*)
                FROM {DB_SCHEMA}.essais_atterberg ea
                JOIN {DB_SCHEMA}.echantillons e ON e.id = ea.echantillon_id
                JOIN {DB_SCHEMA}.sondages s ON s.id = e.sondage_id
                WHERE s.source = :src
                  AND s.deleted_at IS NULL
                  AND ea.wl IS NOT NULL
                """
            ),
            {"src": AMESSEFE_SOURCE},
        ).scalar_one()

        return int(n_vbs), int(n_ip), int(n_wl)

    with engine.connect() as conn:
        # We want the import itself to be rollback-safe (no régression de couverture).
        with conn.begin():
            n_vbs_before, n_ip_before, n_wl_before = _coverage_counts(conn)

        sondage_map = _get_sondage_map(conn, AMESSEFE_SOURCE)
        sondage_map_keys = list(sondage_map.keys())

        def _resolve_excel_key(
            loc_norm: str,
            available_keys: List[str],
            label: str,
        ) -> Tuple[str, Optional[float]]:
            """
            Resolve the normalized Excel key to use for vbs/limites/gonflement loaders.
            Returns (resolved_key, similarity_or_None).
            """
            if loc_norm in available_keys:
                return loc_norm, 1.0

            matches = difflib.get_close_matches(
                loc_norm,
                available_keys,
                n=1,
                cutoff=FUZZY_CUTOFF,
            )
            if not matches:
                return loc_norm, None
            matched = matches[0]
            ratio = difflib.SequenceMatcher(a=loc_norm, b=matched).ratio()
            if ratio < FUZZY_CUTOFF:
                return loc_norm, None

            # Only log when we actually used fuzzy matching (similarity < 1.0).
            conn.execute(
                text(
                    """
                    INSERT INTO atlas.import_coverage_log
                      (import_id, source_label, excel_localite_norm, db_localite_key, matched_db_localite_key, similarity, action_suggeree, notes)
                    VALUES
                      (:import_id, :src, :excel_loc, NULL, :matched_key, :sim, 'IMPORTER_ESSAIS', :note)
                    """
                ),
                {
                    "import_id": import_id,
                    "src": AMESSEFE_SOURCE,
                    "excel_loc": loc_norm,
                    "matched_key": matched,
                    "sim": float(ratio),
                    "note": f"fuzzy_excel_match:{label}",
                },
            )
            return matched, float(ratio)

        def _resolve_sondage_id(loc_norm: str) -> Tuple[Optional[str], Optional[str], Optional[float]]:
            """
            Returns: (resolved_loc_key, matched_db_loc_key, similarity)
            - If exact match: (loc_norm, loc_norm, 1.0)
            - If fuzzy match used: (loc_norm, matched_key, ratio)
            - If not found: (None, None, None)
            """
            sid = sondage_map.get(loc_norm)
            if sid:
                return loc_norm, loc_norm, 1.0

            matches = difflib.get_close_matches(loc_norm, sondage_map_keys, n=1, cutoff=FUZZY_CUTOFF)
            if not matches:
                return None, None, None
            matched = matches[0]
            ratio = difflib.SequenceMatcher(a=loc_norm, b=matched).ratio()
            if ratio < FUZZY_CUTOFF:
                return None, None, None
            return loc_norm, matched, float(ratio)

        for i, loc in enumerate(localite_norms, start=1):
            sid = sondage_map.get(loc)
            matched_db_loc: Optional[str] = None
            similarity: Optional[float] = None

            if not sid:
                _, matched_db_loc, similarity = _resolve_sondage_id(loc)
                if matched_db_loc:
                    sid = sondage_map[matched_db_loc]
                    # Logging fuzzy match
                    conn.execute(
                        text(
                            """
                            INSERT INTO atlas.import_coverage_log
                              (import_id, source_label, excel_localite_norm, db_localite_key, matched_db_localite_key, similarity, action_suggeree, notes)
                            VALUES
                              (:import_id, :src, :excel_loc, :db_loc, :matched_loc, :sim, 'IMPORTER_ESSAIS', 'fuzzy_match')
                            """
                        ),
                        {
                            "import_id": import_id,
                            "src": AMESSEFE_SOURCE,
                            "excel_loc": loc,
                            "db_loc": matched_db_loc,
                            "matched_loc": matched_db_loc,
                            "sim": similarity,
                        },
                    )
                else:
                    print(f"[WARN] ({i}/{len(localite_norms)}) sondage missing in DB for {loc}; skipping essais")
                continue

            e_map = _get_echantillon_map(conn, sid, depths)

            # If we end up inserting at least one assay for this locality, mark it.
            excel_limites_key, _ = _resolve_excel_key(loc, limites_keys, "limites")
            if not args.only_limites:
                # VBS
                excel_vbs_key, _ = _resolve_excel_key(loc, vbs_keys, "vbs")

                for rec in vbs_by_loc.get(excel_vbs_key, []):
                    if rec.depth_m not in e_map:
                        continue
                    eid = e_map[rec.depth_m]
                    if rec.vbs is None:
                        continue
                    res = conn.execute(
                        text(
                            f"""
                            INSERT INTO {DB_SCHEMA}.essais_vbs (echantillon_id, vbs, source_reference, created_at)
                            VALUES (:eid, :vbs, :src, now())
                            ON CONFLICT (echantillon_id) DO UPDATE SET
                              vbs = EXCLUDED.vbs,
                              source_reference = EXCLUDED.source_reference
                            RETURNING id::text
                            """
                        ),
                        {"eid": eid, "vbs": float(rec.vbs), "src": AMESSEFE_SOURCE},
                    ).fetchone()
                    if res:
                        total_vbs += 1
                        affected_sondage_ids.add(sid)

            # Limites (Atterberg) -> essais_atterberg.ip_generated
            for rec in limites_by_loc.get(excel_limites_key, []):
                if rec.depth_m not in e_map:
                    continue
                eid = e_map[rec.depth_m]
                # Keep rows only if at least one value exists.
                wl = rec.wl if rec.wl is not None else None
                wp = rec.wp if rec.wp is not None else None
                ip = rec.ip if rec.ip is not None else None
                # Tier-2 (derived) safety: if Excel doesn't provide IP, derive it.
                if ip is None and wl is not None and wp is not None:
                    ip = float(wl - wp)
                if wl is None and wp is None and ip is None:
                    continue
                if args.debug_localite and loc == args.debug_localite:
                    print(
                        f"[DEBUG] {loc} depth={rec.depth_m} eid={eid} wl={wl} wp={wp} ip={ip}"
                    )
                res = conn.execute(
                    text(
                        f"""
                        INSERT INTO {DB_SCHEMA}.essais_atterberg
                          (echantillon_id, wl, wp, ip_generated, source_reference, created_at)
                        VALUES (:eid, :wl, :wp, :ip, :src, now())
                        ON CONFLICT (echantillon_id) DO UPDATE SET
                          wl = COALESCE(EXCLUDED.wl, {DB_SCHEMA}.essais_atterberg.wl),
                          wp = COALESCE(EXCLUDED.wp, {DB_SCHEMA}.essais_atterberg.wp),
                          ip_generated = COALESCE(EXCLUDED.ip_generated, {DB_SCHEMA}.essais_atterberg.ip_generated),
                          source_reference = EXCLUDED.source_reference
                        RETURNING id::text
                        """
                    ),
                    {"eid": eid, "wl": wl, "wp": wp, "ip": ip, "src": AMESSEFE_SOURCE},
                ).fetchone()
                if res:
                    total_ip += 1
                    affected_sondage_ids.add(sid)

            if not args.only_limites:
                # Gonflement -> essais_potentiel_gonflement.cg
                excel_gonf_key, _ = _resolve_excel_key(loc, gonf_keys, "gonflement")

                for rec in gonf_by_loc.get(excel_gonf_key, []):
                    if rec.depth_m not in e_map:
                        continue
                    eid = e_map[rec.depth_m]
                    res = conn.execute(
                        text(
                            f"""
                            INSERT INTO {DB_SCHEMA}.essais_potentiel_gonflement
                              (echantillon_id, cg, cg_qual, type_sol, source_reference, created_at)
                            VALUES (:eid, :cg, :cg_qual, NULL, :src, now())
                            ON CONFLICT (echantillon_id) DO UPDATE SET
                              cg = EXCLUDED.cg,
                              cg_qual = COALESCE(EXCLUDED.cg_qual, {DB_SCHEMA}.essais_potentiel_gonflement.cg_qual),
                              source_reference = EXCLUDED.source_reference
                            RETURNING id::text
                            """
                        ),
                        {"eid": eid, "cg": float(rec.cg), "cg_qual": rec.cg_qual, "src": AMESSEFE_SOURCE},
                    ).fetchone()
                    if res:
                        total_eg += 1
                        affected_sondage_ids.add(sid)

        # Enforce Tier-2 coherence: IP = WL - WP when both exist.
        conn.execute(
            text(
                f"""
                UPDATE {DB_SCHEMA}.essais_atterberg
                SET ip_generated = (wl - wp)
                WHERE wl IS NOT NULL
                  AND wp IS NOT NULL
                  AND (ip_generated IS NULL OR ip_generated <> (wl - wp))
                """
            )
        )

        n_vbs_after, n_ip_after, n_wl_after = _coverage_counts(conn)
        delta_vbs = n_vbs_after - n_vbs_before
        delta_ip = n_ip_after - n_ip_before

        # Gate de non-régression (P0b AC)
        if delta_vbs < 0 or delta_ip < 0:
            raise RuntimeError(
                f"Coverage regression detected: delta_vbs={delta_vbs} delta_ip={delta_ip}. Rolling back."
            )

        # Import summary (useful even if this script is run standalone)
        # (We only record fuzzy match rows already inserted; counts help UI/reporting.)
        conn.execute(
            text(
                """
                INSERT INTO atlas.import_coverage_log (
                  import_id, source_label, excel_localite_norm, db_localite_key, matched_db_localite_key, similarity,
                  action_suggeree, notes,
                  n_sondages_before, n_sondages_after,
                  n_vbs_before, n_vbs_after,
                  n_ip_before, n_ip_after,
                  n_wl_wp_before, n_wl_wp_after,
                  delta_vbs, delta_ip
                )
                VALUES (
                  :import_id, :src, NULL, NULL, NULL, NULL,
                  'IMPORT_SUMMARY', 'repair_finished',
                  NULL, NULL,
                  :n_vbs_before, :n_vbs_after,
                  :n_ip_before, :n_ip_after,
                  :n_wl_before, :n_wl_after,
                  :delta_vbs, :delta_ip
                )
                """
            ),
            {
                "import_id": import_id,
                "src": AMESSEFE_SOURCE,
                "n_vbs_before": n_vbs_before,
                "n_vbs_after": n_vbs_after,
                "n_ip_before": n_ip_before,
                "n_ip_after": n_ip_after,
                "n_wl_before": n_wl_before,
                "n_wl_after": n_wl_after,
                "delta_vbs": delta_vbs,
                "delta_ip": delta_ip,
            },
        )

        # IMPORTANT:
        # Les INSERT/UPDATE ci-dessus ne sont pas enveloppés dans le `with conn.begin():`
        # (qui ne couvre que les métriques "before"). Sans commit explicite,
        # SQLAlchemy peut rollback au moment de la fermeture de la connexion.
        conn.commit()

    # Post-commit refresh (P0-T6): MV + feature store
    codes_list: List[str] = []
    with engine.connect() as conn2:
        if not args.skip_mv_refresh:
            conn2.execute(text(f"REFRESH MATERIALIZED VIEW {DB_SCHEMA}.mv_mailles_geotech;"))

        if (not args.skip_feature_refresh) and affected_sondage_ids:
            sid_list = list(affected_sondage_ids)
            codes = conn2.execute(
                text(
                    f"""
                    SELECT DISTINCT maille_code::text
                    FROM {DB_SCHEMA}.sondages
                    WHERE id = ANY(CAST(:sids AS uuid[]))
                      AND maille_code IS NOT NULL
                    """
                ),
                {"sids": sid_list},
            ).fetchall()
            codes_list = [r[0] for r in codes if r and r[0]]

    # Refresh feature store in small batches to avoid long blocking.
    # Petite taille de batch pour réduire la durée de chaque appel
    # (évite des timeouts/annulations sur st_clip lourd).
    if (not args.skip_feature_refresh) and codes_list:
        BATCH = 5
        for i in range(0, len(codes_list), BATCH):
            batch = codes_list[i : i + BATCH]
            if not batch:
                continue

            # Isolate each batch in its own connection to avoid poisoning the whole run
            # when PostgreSQL drops a backend for one heavy statement.
            with engine.connect() as conn3:
                try:
                    conn3.execute(
                        text(
                            """
                            SELECT atlas.refresh_ai_maille_features_fast_resilient_for_codes(
                              CAST(:codes AS text[]),
                              :mode,
                              :timeout_ms
                            )
                            """
                        ),
                        {
                            "codes": batch,
                            "mode": args.feature_refresh_mode,
                            "timeout_ms": max(int(args.feature_refresh_timeout_ms), 1000),
                        },
                    )
                    conn3.commit()
                except Exception as e:
                    conn3.rollback()
                    print(
                        f"[WARN] feature refresh batch failed in mode={args.feature_refresh_mode}: "
                        f"{batch} -> {e}. Retrying lightweight."
                    )
                    try:
                        conn3.execute(
                            text(
                                """
                                SELECT atlas.refresh_ai_maille_features_fast_lightweight_for_codes(
                                  CAST(:codes AS text[])
                                )
                                """
                            ),
                            {"codes": batch},
                        )
                        conn3.commit()
                    except Exception as e2:
                        conn3.rollback()
                        print(f"[WARN] lightweight retry failed for batch {batch}: {e2}")

    dt = time.time() - t0
    print(
        f"[OK] canonical repair done in {dt:.1f}s. "
        f"Inserted/updated: vbs={total_vbs}, limites/atterberg(ip)= {total_ip}, eg(gonflement)= {total_eg}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

