"""Temporary runbook DB checks — remove after use if desired."""
from __future__ import annotations

import os
import sys
from pathlib import Path

def load_env() -> None:
    p = Path(__file__).resolve().parent.parent / ".env"
    if not p.exists():
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


def main() -> None:
    load_env()
    import psycopg2

    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        print("No DATABASE_URL")
        sys.exit(2)
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    queries = [
        ("ai_interpolation_runs", "SELECT COUNT(*) FROM atlas.ai_interpolation_runs"),
        ("ai_interpolation_values", "SELECT COUNT(*) FROM atlas.ai_interpolation_values"),
        ("ai_prediction_runs", "SELECT COUNT(*) FROM atlas.ai_prediction_runs"),
        ("ai_maille_ml_values", "SELECT COUNT(*) FROM atlas.ai_maille_ml_values"),
        ("v_latest_ai_interpolation", "SELECT COUNT(*) FROM atlas.v_latest_ai_interpolation"),
        ("v_campaign_priority_score", "SELECT COUNT(*) FROM atlas.v_campaign_priority_score"),
    ]
    for name, sql in queries:
        try:
            cur.execute(sql)
            print(f"{name}:", cur.fetchone()[0])
        except Exception as e:
            print(f"{name}: ERROR", e)

    try:
        cur.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema='atlas' AND table_name='v_campaign_priority_score'
            ORDER BY ordinal_position
            """
        )
        cols = [r[0] for r in cur.fetchall()]
        print("v_campaign_priority_score columns:", cols)
    except Exception as e:
        print("columns check:", e)

    try:
        cur.execute(
            """
            SELECT method, created_at
            FROM atlas.ai_interpolation_runs
            ORDER BY created_at DESC
            LIMIT 5
            """
        )
        print("last 5 ai_interpolation_runs:", cur.fetchall())
    except Exception as e:
        print("runs sample:", e)

    try:
        cur.execute(
            """
            SELECT maille_id, variance
            FROM atlas.v_latest_ai_interpolation
            LIMIT 20
            """
        )
        rows = cur.fetchall()
        print("v_latest variance sample rows:", len(rows))
        if rows:
            vars_ = [float(r[1]) for r in rows if r[1] is not None]
            print("variance stats on sample:", {"n": len(vars_), "mean": sum(vars_) / len(vars_) if vars_ else None, "max": max(vars_) if vars_ else None})
    except Exception as e:
        print("variance sample:", e)

    try:
        cur.execute(
            """
            SELECT maille_id, norm_variance_v1, priority_score_v1
            FROM atlas.v_campaign_priority_score
            LIMIT 20
            """
        )
        print("v_campaign_priority_score sample:", len(cur.fetchall()), "rows")
    except Exception as e:
        print("campaign score sample:", e)

    try:
        cur.execute(
            """
            SELECT model_key, version, is_active, created_at
            FROM atlas.ai_models_registry
            ORDER BY created_at DESC
            LIMIT 5
            """
        )
        print("ai_models_registry:", cur.fetchall())
    except Exception as e:
        print("models:", e)

    for vname in (
        "v_latest_ai_interpolation",
        "v_campaign_priority_score",
        "v_maille_primary_kriging_domain",
    ):
        try:
            cur.execute(
                """
                SELECT EXISTS (
                  SELECT 1 FROM information_schema.views
                  WHERE table_schema = 'atlas' AND table_name = %s
                )
                """,
                (vname,),
            )
            print(f"view atlas.{vname} exists:", cur.fetchone()[0])
        except Exception as e:
            print(f"view {vname}:", e)

    cur.close()
    conn.close()
    print("OK")


def column_exists(cur, table: str, col: str) -> bool:
    cur.execute(
        """
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'atlas' AND table_name = %s AND column_name = %s
        )
        """,
        (table, col),
    )
    return cur.fetchone()[0]


def check_tables() -> None:
    load_env()
    import psycopg2

    url = os.environ.get("DATABASE_URL", "").strip()
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    for t in [
        "kriging_domains",
        "ai_variograms",
        "ai_models_registry",
        "ai_maille_ml_values",
        "ai_prediction_runs",
        "ai_interpolation_runs",
    ]:
        cur.execute(
            """
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema='atlas' AND table_name=%s
            )
            """,
            (t,),
        )
        print(t, cur.fetchone()[0])
    print("ai_interpolation_values.kriging_domain_id", column_exists(cur, "ai_interpolation_values", "kriging_domain_id"))
    cur.close()
    conn.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--tables":
        check_tables()
    else:
        main()
