#!/usr/bin/env python3
"""
Génère un SVG variogramme : courbe théorique γ(h) (modèle sphérique par défaut)
à partir de nugget / sill / range_m dans atlas.ai_variograms, plus un encart métadonnées.
"""
from __future__ import annotations

import argparse
import json
import math
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


def spherical_gamma(h: float, nugget: float, sill: float, range_m: float) -> float:
    """Modèle sphérique : γ(h) = nugget + C × (1.5 h/a − 0.5 (h/a)³) pour h ≤ a ; plateau sill au-delà."""
    c = max(0.0, float(sill) - float(nugget))
    a = float(range_m)
    if a <= 0:
        return float(nugget) + c
    h = max(0.0, float(h))
    if h >= a:
        return float(nugget) + c
    t = h / a
    return float(nugget) + c * (1.5 * t - 0.5 * t**3)


def make_svg_text_table(title: str, rows: list[tuple]) -> str:
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
        svg_lines.append(
            '<text x="24" y="96" fill="#fca5a5" font-size="18" font-family="Segoe UI, Arial">No variogram data</text>'
        )
    else:
        svg_lines.append(
            '<text x="24" y="62" fill="#94a3b8" font-size="12" font-family="Consolas, monospace">created_at | model_type | loo_rmse | fit_quality</text>'
        )
        for i, (created_at, model_type, loo_rmse, fit_quality) in enumerate(rows[:10]):
            y = y0 + (i + 1) * line_h
            fq = json.dumps(fit_quality or {}, ensure_ascii=False)[:95]
            rmse = "null" if loo_rmse is None else f"{float(loo_rmse):.4f}"
            txt = f"{created_at} | {model_type or 'n/a'} | {rmse} | {fq}"
            color = "#e2e8f0" if i == 0 else "#cbd5e1"
            svg_lines.append(
                f'<text x="24" y="{y}" fill="{color}" font-size="12" font-family="Consolas, monospace">{esc(txt)}</text>'
            )
    svg_lines.append("</svg>")
    return "".join(svg_lines)


def make_svg_curve(
    title: str,
    parameter_id: str,
    horizon: str | None,
    nugget: float,
    sill: float,
    range_m: float,
    model_type: str | None,
    loo_rmse: float | None,
    rows_sample: list[tuple],
) -> str:
    w, h = 900, 480
    pad_l, pad_r, pad_t, pad_b = 72, 40, 56, 72
    plot_w = w - pad_l - pad_r
    plot_h = h - pad_t - pad_b
    ymax = max(float(sill) * 1.15, 1e-6)
    xmax = max(float(range_m) * 1.5, 1.0)

    n_pt = 100
    hs = [xmax * i / (n_pt - 1) for i in range(n_pt)]
    gam = [spherical_gamma(x, nugget, sill, range_m) for x in hs]

    def xpix(xv: float) -> float:
        return pad_l + (xv / xmax) * plot_w

    def ypix(gv: float) -> float:
        return pad_t + plot_h - (gv / ymax) * plot_h

    path_d = "M " + " L ".join(f"{xpix(hs[i]):.2f},{ypix(gam[i]):.2f}" for i in range(n_pt))

    sill_line_y = ypix(float(sill))
    range_line_x = xpix(float(range_m))

    meta_lines = []
    if rows_sample:
        ca, mt, lr, _fq = rows_sample[0][:4]
        lr_s = "null" if lr is None else f"{float(lr):.4f}"
        meta_lines.append(f"Dernière ligne: {ca} | {mt or 'n/a'} | LOO RMSE {lr_s}")

    sub = f"{parameter_id}" + (f" — {horizon}" if horizon else "")
    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
        '<rect x="0" y="0" width="100%" height="100%" fill="#0f172a"/>',
        f'<text x="24" y="36" fill="#e2e8f0" font-size="20" font-family="Segoe UI, Arial">{esc(title)}</text>',
        f'<text x="24" y="54" fill="#94a3b8" font-size="12" font-family="Segoe UI, Arial">{esc(sub)}</text>',
        f'<text x="24" y="70" fill="#64748b" font-size="11" font-family="Consolas, monospace">model={esc(model_type or "?")} | nugget={nugget:.4f} sill={sill:.4f} range_m={range_m:.2f} | LOO_RMSE={loo_rmse if loo_rmse is not None else "null"}</text>',
        f'<rect x="{pad_l}" y="{pad_t}" width="{plot_w}" height="{plot_h}" fill="#020617" stroke="#334155" stroke-width="1" rx="4"/>',
        f'<line x1="{pad_l}" y1="{sill_line_y}" x2="{pad_l + plot_w}" y2="{sill_line_y}" stroke="#475569" stroke-width="1" stroke-dasharray="4 3"/>',
        f'<text x="{pad_l + plot_w - 4}" y="{sill_line_y - 4}" fill="#94a3b8" font-size="10" text-anchor="end">sill</text>',
        f'<line x1="{range_line_x}" y1="{pad_t}" x2="{range_line_x}" y2="{pad_t + plot_h}" stroke="#475569" stroke-width="1" stroke-dasharray="4 3"/>',
        f'<text x="{range_line_x + 4}" y="{pad_t + 14}" fill="#94a3b8" font-size="10">range</text>',
        f'<path d="{path_d}" fill="none" stroke="#38bdf8" stroke-width="2"/>',
        f'<text x="{pad_l}" y="{h - 28}" fill="#94a3b8" font-size="11" font-family="Segoe UI, Arial">Distance h (m)</text>',
        f'<text x="18" y="{pad_t + plot_h / 2}" fill="#94a3b8" font-size="11" font-family="Segoe UI, Arial" transform="rotate(-90 18 {pad_t + plot_h / 2})">γ(h)</text>',
    ]
    if meta_lines:
        svg.append(f'<text x="24" y="{h - 12}" fill="#64748b" font-size="10" font-family="Consolas, monospace">{esc(meta_lines[0])}</text>')
    svg.append("</svg>")
    return "".join(svg)


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
                SELECT created_at::text, model_type, loo_rmse, fit_quality,
                       nugget, sill, range_m
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
                SELECT created_at::text, model_type, loo_rmse, fit_quality,
                       nugget, sill, range_m
                FROM atlas.ai_variograms
                WHERE parameter_id = %s
                ORDER BY created_at DESC
                LIMIT 12
                """,
                (args.parameter_id,),
            )
        rows = cur.fetchall()
        if not rows and args.horizon:
            # Fallback : chercher le variogramme parent (sans filtre horizon)
            cur.execute(
                """
                SELECT created_at::text, model_type, loo_rmse, fit_quality,
                       nugget, sill, range_m
                FROM atlas.ai_variograms
                WHERE parameter_id = %s
                  AND nugget IS NOT NULL AND sill IS NOT NULL AND range_m IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 12
                """,
                (args.parameter_id,),
            )
            rows = cur.fetchall()
        if not rows:
            svg = make_svg_text_table(
                f"Variogram - {args.parameter_id} {args.horizon or ''}".strip(), []
            )
            print(json.dumps({"svg": svg, "rows": 0}, ensure_ascii=False))
            return 0

        r0 = rows[0]
        created_at, model_type, loo_rmse, fit_quality, nugget, sill, range_m = (
            r0[0],
            r0[1],
            r0[2],
            r0[3],
            r0[4],
            r0[5],
            r0[6],
        )

        can_curve = (
            nugget is not None
            and sill is not None
            and range_m is not None
            and math.isfinite(float(nugget))
            and math.isfinite(float(sill))
            and math.isfinite(float(range_m))
            and float(range_m) > 0
            and float(sill) >= float(nugget)
        )

        title = "Variogramme théorique (sphérique)"
        if can_curve:
            svg = make_svg_curve(
                title,
                args.parameter_id,
                args.horizon,
                float(nugget),
                float(sill),
                float(range_m),
                model_type,
                float(loo_rmse) if loo_rmse is not None else None,
                rows,
            )
        else:
            svg = make_svg_text_table(
                f"Variogram - {args.parameter_id} (métadonnées incomplètes pour courbe)".strip(),
                [(created_at, model_type, loo_rmse, fit_quality)],
            )
        print(json.dumps({"svg": svg, "rows": len(rows)}, ensure_ascii=False))
        return 0
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
