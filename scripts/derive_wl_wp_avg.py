"""
Derive _avg parameters from the average of KED horizons (h1, h2, h3).
Extended to cover: wl, wp, vbs, ip, eg, passant_80um, passant_2mm.

For each base parameter:
  {base}_avg = mean( {base}_ked_h1, {base}_ked_h2, {base}_ked_h3 ) per maille

The script first supersedes old non-KED-derived avg values, then inserts fresh derived ones.
It is idempotent: running twice produces the same result.
"""
import os
import sys
import psycopg2

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean",
)

# Full list of parameters to derive avg from their KED horizons
PARAMS_TO_DERIVE = [
    "wl",
    "wp",
    "vbs",
    "ip",
    "eg",
    "passant_80um",
    "passant_2mm",
]


def derive_avg(conn, base: str):
    avg_param = f"{base}_avg"
    h1, h2, h3 = [f"{base}_ked_h{i}" for i in range(1, 4)]

    cur = conn.cursor()

    # Step 1: Mark existing non-KED-derived avg as superseded (preserve traceability)
    cur.execute(
        """
        UPDATE atlas.ai_interpolation_values
        SET is_superseded = true
        WHERE parameter_id = %s
          AND method != 'derived_avg_from_ked'
          AND COALESCE(is_superseded, false) = false
        """,
        (avg_param,),
    )
    superseded = cur.rowcount

    # Step 2: Remove any existing derived_avg_from_ked to allow clean re-insert
    cur.execute(
        "DELETE FROM atlas.ai_interpolation_values WHERE parameter_id = %s AND method = 'derived_avg_from_ked'",
        (avg_param,),
    )

    # Step 3: Compute average across horizons per maille (weighted by availability)
    cur.execute(
        """
        INSERT INTO atlas.ai_interpolation_values
            (maille_id, parameter_id, value, method, is_superseded)
        SELECT
            v1.maille_id,
            %s,
            (COALESCE(v1.value, 0) + COALESCE(v2.value, 0) + COALESCE(v3.value, 0))
                / GREATEST(
                    (CASE WHEN v1.value IS NOT NULL THEN 1 ELSE 0 END
                   + CASE WHEN v2.value IS NOT NULL THEN 1 ELSE 0 END
                   + CASE WHEN v3.value IS NOT NULL THEN 1 ELSE 0 END)::double precision,
                    1.0
                  ),
            'derived_avg_from_ked',
            false
        FROM (
            SELECT maille_id, value FROM atlas.ai_interpolation_values
            WHERE parameter_id = %s AND COALESCE(is_superseded, false) = false
        ) v1
        LEFT JOIN (
            SELECT maille_id, value FROM atlas.ai_interpolation_values
            WHERE parameter_id = %s AND COALESCE(is_superseded, false) = false
        ) v2 ON v2.maille_id = v1.maille_id
        LEFT JOIN (
            SELECT maille_id, value FROM atlas.ai_interpolation_values
            WHERE parameter_id = %s AND COALESCE(is_superseded, false) = false
        ) v3 ON v3.maille_id = v1.maille_id
        WHERE (CASE WHEN v1.value IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN v2.value IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN v3.value IS NOT NULL THEN 1 ELSE 0 END) > 0
        """,
        (avg_param, h1, h2, h3),
    )

    rows = cur.rowcount
    conn.commit()
    cur.close()
    print(f"  {avg_param}: {superseded} superseded, {rows} rows inserted (derived_avg_from_ked)")
    return rows


def main():
    print(f"[derive_avg] Connecting to: {DB_URL.split('@')[-1]}")
    conn = psycopg2.connect(DB_URL)
    total = 0
    for base in PARAMS_TO_DERIVE:
        total += derive_avg(conn, base)
    conn.close()
    print(f"\nTotal: {total} rows derived across {len(PARAMS_TO_DERIVE)} parameters")
    return 0


if __name__ == "__main__":
    sys.exit(main())
