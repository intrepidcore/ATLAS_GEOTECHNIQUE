import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
from sqlalchemy import create_engine, text


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Export a global XLSX: one row per 2km maille having at least one thematic value. "
            "Reads run index.json to determine the list of thematics, then queries Postgres directly."
        )
    )
    parser.add_argument("run_dir", help="Path to the export run folder (contains index.json)")
    parser.add_argument(
        "--pgurl",
        default="postgresql+psycopg2://atlas:atlas@localhost:5432/atlas_clean",
        help="SQLAlchemy Postgres URL",
    )
    parser.add_argument(
        "--min-sondages",
        type=int,
        default=None,
        help="Optional filter: only keep mailles with n_sondages >= N",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Output XLSX path (default: <run_dir>/thematic_maille_matrix.xlsx)",
    )

    args = parser.parse_args()

    run_dir = Path(args.run_dir)
    index_path = run_dir / "index.json"
    with index_path.open("r", encoding="utf-8") as f:
        index: Dict[str, Any] = json.load(f)

    thematics = sorted({e.get("thematic") for e in index.get("exports", []) if isinstance(e, dict) and e.get("thematic")})
    if not thematics:
        raise SystemExit("No thematics found in index.json exports[]")

    out_path = Path(args.out) if args.out else (run_dir / "thematic_maille_matrix.xlsx")

    safe_cols: List[str] = []
    for t in thematics:
        if not isinstance(t, str):
            continue
        safe_cols.append(t)

    if not safe_cols:
        raise SystemExit("No valid thematics")

    select_exprs = [
        "s.code AS maille_code",
        "COALESCE(a2.adm1_name, m.adm1_name) AS adm1_name",
        "m.adm2_name AS adm2_name",
        "m.adm3_name AS adm3_name",
    ]

    has_any_exprs: List[str] = []
    for col in safe_cols:
        if col == "n_sondages":
            select_exprs.append("(COALESCE(s.n_sondages, 0) > 0) AS has_data_n_sondages")
            has_any_exprs.append("COALESCE(s.n_sondages, 0) > 0")
        else:
            select_exprs.append(f"(s.\"{col}\" IS NOT NULL) AS has_data_{col}")
            has_any_exprs.append(f"s.\"{col}\" IS NOT NULL")

    where_parts = ["(" + " OR ".join(has_any_exprs) + ")"]
    if args.min_sondages is not None:
        where_parts.append("COALESCE(m.n_sondages, 0) >= :min_sondages")

    sql = f"""
        SELECT
            {',\n            '.join(select_exprs)}
        FROM mailles_geotechnique_stats_wgs84 s
        JOIN atlas.mailles m ON m.code = s.code
        LEFT JOIN adm2_tg a2 ON a2.name = m.adm2_name
        WHERE {' AND '.join(where_parts)}
        ORDER BY s.code
    """

    engine = create_engine(args.pgurl)
    with engine.begin() as conn:
        df = pd.read_sql(text(sql), conn, params={"min_sondages": args.min_sondages})

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(out_path, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="mailles_2km")

    print(f"[OK] Wrote {len(df)} rows to: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
