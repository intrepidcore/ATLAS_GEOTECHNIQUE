#!/usr/bin/env python3
"""
Vérifie tous les invariants du manifest seed contre une base de données.
Conforme au CONTRAT_SEED_DUMP_v2.md §7.2

Usage:
    python verify_invariants.py --manifest data/db/backups/atlas_desktop_seed.dump.json \
                                --db-url "postgres://atlas:atlas@localhost:5433/atlas_clean"

    # Vérifier uniquement les invariants critiques
    python verify_invariants.py --manifest ... --db-url ... --severity critical

    # Sortie JSON (pour CI)
    python verify_invariants.py --manifest ... --db-url ... --json

Exit codes:
    0 : tous les invariants critiques passent
    1 : au moins un invariant critique échoue
    2 : erreur de configuration/connexion
"""

import json
import sys
import argparse
import time
from datetime import datetime
from typing import Any

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 requis — pip install psycopg2-binary", file=sys.stderr)
    sys.exit(2)


# ── Couleurs terminal ────────────────────────────────────────────────────────
class C:
    GREEN  = "\033[92m"
    RED    = "\033[91m"
    YELLOW = "\033[93m"
    CYAN   = "\033[96m"
    BOLD   = "\033[1m"
    RESET  = "\033[0m"

def ok(s):   return f"{C.GREEN}✅ {s}{C.RESET}"
def fail(s): return f"{C.RED}❌ {s}{C.RESET}"
def warn(s): return f"{C.YELLOW}⚠️  {s}{C.RESET}"
def info(s): return f"{C.CYAN}ℹ  {s}{C.RESET}"


# ── Vérification d'un invariant ──────────────────────────────────────────────
def check_invariant(cursor, inv: dict) -> dict:
    """Exécute la requête d'un invariant et retourne le résultat."""
    t0 = time.monotonic()
    try:
        cursor.execute(inv["query"])
        result = cursor.fetchone()
        value = result[0] if result else None
    except Exception as e:
        return {
            "id"     : inv["id"],
            "passed" : False,
            "error"  : str(e),
            "value"  : None,
            "duration_ms": int((time.monotonic() - t0) * 1000),
        }

    duration_ms = int((time.monotonic() - t0) * 1000)

    # Conversion booléen PostgreSQL
    if isinstance(value, str) and value in ("t", "f"):
        value = value == "t"

    passed = True
    reason = None

    if "expected_value" in inv:
        exp = inv["expected_value"]
        if value != exp:
            passed = False
            reason = f"attendu={exp}, obtenu={value}"

    if "expected_min" in inv and value is not None:
        if value < inv["expected_min"]:
            passed = False
            reason = f"min={inv['expected_min']}, obtenu={value}"

    if "expected_max" in inv and value is not None:
        if value > inv["expected_max"]:
            passed = False
            reason = f"max={inv['expected_max']}, obtenu={value}"

    return {
        "id"         : inv["id"],
        "description": inv["description"],
        "severity"   : inv["severity"],
        "passed"     : passed,
        "value"      : value,
        "reason"     : reason,
        "duration_ms": duration_ms,
    }


# ── Point d'entrée ───────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Vérifie les invariants du seed Atlas")
    parser.add_argument("--manifest", required=True, help="Chemin du manifest JSON")
    parser.add_argument("--db-url",   required=True, help="URL PostgreSQL")
    parser.add_argument("--severity", default="all",
                        choices=["all", "critical", "high", "medium"],
                        help="Filtre par sévérité minimale")
    parser.add_argument("--json",  action="store_true", help="Sortie JSON machine-readable")
    parser.add_argument("--timeout", type=int, default=300, help="Timeout par requête (s)")
    args = parser.parse_args()

    # ── Lecture manifest ─────────────────────────────────────────────────────
    try:
        with open(args.manifest, encoding="utf-8") as f:
            manifest = json.load(f)
    except Exception as e:
        print(f"ERROR: impossible de lire le manifest: {e}", file=sys.stderr)
        sys.exit(2)

    seed_id      = manifest["identity"]["seed_id"]
    seed_version = manifest["identity"]["seed_version"]
    invariants   = manifest.get("invariants", [])

    # Filtre sévérité
    SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    min_sev = SEVERITY_ORDER.get(args.severity, 99)
    if args.severity != "all":
        invariants = [i for i in invariants
                      if SEVERITY_ORDER.get(i["severity"], 99) <= min_sev]

    if not args.json:
        print(f"\n{C.BOLD}Atlas Seed Invariant Checker{C.RESET}")
        print(f"  Seed    : {seed_id} v{seed_version}")
        print(f"  DB URL  : {args.db_url[:40]}...")
        print(f"  Tests   : {len(invariants)} invariants")
        print(f"  Filtre  : {args.severity}")
        print()

    # ── Connexion DB ─────────────────────────────────────────────────────────
    try:
        conn = psycopg2.connect(args.db_url, connect_timeout=10)
        conn.set_session(readonly=True)
        cursor = conn.cursor()
        if not args.json:
            print(info("Connexion DB OK"))
    except Exception as e:
        print(f"ERROR: connexion DB échouée: {e}", file=sys.stderr)
        sys.exit(2)

    # ── Vérification de chaque invariant ─────────────────────────────────────
    results = []
    for inv in invariants:
        result = check_invariant(cursor, inv)
        results.append(result)

        if not args.json:
            status = ok(f"[{result['id']}] {inv['description']}: {result['value']} ({result['duration_ms']}ms)")
            if not result["passed"]:
                if result.get("error"):
                    status = fail(f"[{result['id']}] {inv['description']}: ERREUR — {result['error']}")
                else:
                    status = fail(f"[{result['id']}] {inv['description']}: {result['reason']} ({result['duration_ms']}ms)")
            print(status)

    cursor.close()
    conn.close()

    # ── Synthèse ─────────────────────────────────────────────────────────────
    failures = [r for r in results if not r["passed"]]
    critical_failures = [r for r in failures
                         if r.get("severity") == "critical" or
                            next((i["severity"] for i in manifest.get("invariants", [])
                                  if i["id"] == r["id"]), "") == "critical"]

    if args.json:
        output = {
            "seed_id"          : seed_id,
            "seed_version"     : seed_version,
            "checked_at"       : datetime.utcnow().isoformat() + "Z",
            "total"            : len(results),
            "passed"           : len(results) - len(failures),
            "failed"           : len(failures),
            "critical_failures": len(critical_failures),
            "results"          : results,
        }
        print(json.dumps(output, indent=2, default=str))
    else:
        print()
        if not failures:
            print(ok(f"Tous les {len(results)} invariants validés ✅"))
        else:
            print(fail(f"{len(failures)} invariant(s) échoué(s), {len(critical_failures)} critique(s)"))
            for f_ in failures:
                sev = next((i["severity"] for i in manifest.get("invariants", [])
                            if i["id"] == f_["id"]), "?")
                print(f"  • [{f_['id']}] [{sev.upper()}] {f_.get('description', '')}: {f_.get('reason') or f_.get('error')}")

    sys.exit(0 if not critical_failures else 1)


if __name__ == "__main__":
    main()
