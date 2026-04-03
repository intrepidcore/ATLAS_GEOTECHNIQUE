#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os

import psycopg2

DB_DEFAULT = os.environ.get("DATABASE_URL", "postgresql://atlas:atlas@localhost:5432/atlas_clean")


def esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def make_svg(title: str, rows: list[tuple]) -> str:
    width, height = 900, 420
    y0 = 70
    line_h = 28
    svg_lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect x="0" y="0" width="100%" height="100%" fill="#0f172a"/>',
        f'<text x="24" y="38" fill="#e2e8f0" font-size="24" font-family="Segoe UI, Arial">{esc(title)}</text>',
        '<line x1="24" y1="48" x2="876" y2="48" stroke="#334155" stroke-width="1"/>',
    ]
    if not rows:
        svg_lines.append('<text x="24" y="96" fill="#fca5a5" font-size="18" font-family="Segoe UI, Arial">No variogram data</text>')
    else:
        svg_lines.append('<text x="24" y="62" fill="#94a3b8" font-size="12" font-family="Consolas, monospace">created_at | model_type | loo_rmse | fit_quality</text>')
        for i, (created_at, model_type, loo_rmse, fit_quality) in enumerate(rows[:10]):
            y = y0 + (i + 1) * line_h
            fq = json.dumps(fit_quality or {}, ensure_ascii=False)[:95]
            rmse = "null" if loo_rmse is None else f"{float(loo_rmse):.4f}"
            txt = f"{created_at} | {model_type or 'n/a'} | {rmse} | {fq}"
            color = "#e2e8f0" if i == 0 else "#cbd5e1"
            svg_lines.append(f'<text x="24" y="{y}" fill="{color}" font-size="12" font-family="Consolas, monospace">{esc(txt)}</text>')
    svg_lines.append("</svg>")
    return "".join(svg_lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument("--parameter-id", required=True)
    ap.add_argument("--horizon", default=None)
    args = ap.parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL required")

    conn = psycopg2.connect(args.database_url)
    cur = conn.cursor()
    try:
        if args.horizon:
            cur.execute(
                """
                SELECT created_at::text, model_type, loo_rmse, fit_quality
                FROM atlas.ai_variograms
                WHERE parameter_id = %s
                  AND LOWER(COALESCE(fit_quality->>'horizon_label','')) = LOWER(%s)
                ORDER BY created_at DESC
                LIMIT 12
                """,
                (args.parameter_id, args.horizon.upper()),
            )
        else:
            cur.execute(
                """
                SELECT created_at::text, model_type, loo_rmse, fit_quality
                FROM atlas.ai_variograms
                WHERE parameter_id = %s
                ORDER BY created_at DESC
                LIMIT 12
                """,
                (args.parameter_id,),
            )
        rows = cur.fetchall()
        svg = make_svg(f"Variogram - {args.parameter_id} {args.horizon or ''}".strip(), rows)
        print(json.dumps({"svg": svg, "rows": len(rows)}, ensure_ascii=False))
        return 0
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())

