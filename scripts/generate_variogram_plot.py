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


DEGREES_TO_KM = 111.0  # approximation valable pour le Togo (7-11°N)


def spherical_gamma(h: float, nugget: float, sill: float, range_val: float) -> float:
    """Modèle sphérique : γ(h) = nugget + C × (1.5 h/a − 0.5 (h/a)³) pour h ≤ a ; plateau sill au-delà."""
    c = max(0.0, float(sill) - float(nugget))
    a = float(range_val)
    if a <= 0:
        return float(nugget) + c
    h = max(0.0, float(h))
    if h >= a:
        return float(nugget) + c
    t = h / a
    return float(nugget) + c * (1.5 * t - 0.5 * t**3)


def make_svg_placeholder(msg: str) -> str:
    w, h = 900, 200
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 {w} {h}">',
        '<rect x="0" y="0" width="100%" height="100%" fill="#0f172a"/>',
        f'<text x="24" y="36" fill="#e2e8f0" font-size="18" font-family="Segoe UI, Arial">Comparaison variogrammes</text>',
        f'<text x="24" y="70" fill="#fca5a5" font-size="14" font-family="Segoe UI, Arial">{esc(msg)}</text>',
        '</svg>',
    ]
    return '\n'.join(lines)


HORIZON_COLORS = {
    'h1': '#3B82F6',
    'h2': '#F59E0B',
    'h3': '#10B981',
}


def make_svg_multi(params_list: list) -> str:
    if not params_list:
        return make_svg_placeholder("Aucun variogramme disponible")

    valid = [p for p in params_list
             if p.get('nugget') is not None and p.get('sill') is not None
             and p.get('range_m') is not None]

    if not valid:
        return make_svg_placeholder(
            "Métadonnées manquantes pour tous les horizons.\n"
            "Relancer le pipeline KED pour calculer nugget/sill/portée."
        )

    w, h = 900, 480
    x_max = max(p['range_m'] / 1000 * 1.8 for p in valid if p.get('range_m'))
    y_max = max(float(p['sill']) * 1.15 for p in valid) if valid else 1.0
    x_max = max(x_max, 10.0)

    def xpix(v): return 72 + (v / x_max) * 788
    def ypix(v): return 408 - (v / y_max) * 352

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="100%" '
        f'viewBox="0 0 {w} {h}">',
        f'<rect x="0" y="0" width="100%" height="100%" fill="#0f172a"/>',
        f'<text x="24" y="36" fill="#e2e8f0" font-size="18" '
        f'font-family="Segoe UI, Arial">Comparaison variogrammes H1/H2/H3</text>',
        f'<text x="24" y="56" fill="#94a3b8" font-size="12" '
        f'font-family="Segoe UI, Arial">'
        f'{esc(valid[0]["parameter_id"].rsplit("_h",1)[0])}</text>',
        f'<rect x="72" y="56" width="788" height="352" fill="#020617" '
        f'stroke="#334155" stroke-width="1" rx="4"/>',
    ]

    for yi in [0.25, 0.5, 0.75, 1.0]:
        py = ypix(y_max * yi)
        lines.append(
            f'<line x1="72" y1="{py:.1f}" x2="860" y2="{py:.1f}" '
            f'stroke="#1E293B" stroke-width="1" stroke-dasharray="4 3"/>'
        )
        lines.append(
            f'<text x="68" y="{py+4:.1f}" fill="#64748b" font-size="10" '
            f'text-anchor="end">{y_max*yi:.3f}</text>'
        )

    for p in valid:
        horizon_raw = p.get('horizon_label', p['parameter_id'].split('_h')[-1])
        horizon_key = f'h{horizon_raw.lower().replace("h","")}'
        color = HORIZON_COLORS.get(horizon_key, '#94A3B8')
        label = f"H{horizon_raw.replace('h','').upper()}"

        range_km = float(p['range_m']) / 1000
        nugget = float(p['nugget'])
        sill = float(p['sill'])

        pts = []
        for xi in range(201):
            h_val = (xi / 200.0) * x_max * 1.05
            if h_val == 0:
                gamma = 0
            elif h_val <= range_km:
                t = h_val / range_km
                gamma = nugget + (sill - nugget) * (1.5*t - 0.5*t**3)
            else:
                gamma = sill
            pts.append(f'{xpix(h_val):.1f},{ypix(gamma):.1f}')

        path_d = 'M ' + ' L '.join(pts)
        lines.append(
            f'<path d="{path_d}" fill="none" stroke="{color}" '
            f'stroke-width="2.5" opacity="0.9"/>'
        )

        rx = xpix(range_km)
        lines.append(
            f'<line x1="{rx:.1f}" y1="56" x2="{rx:.1f}" y2="408" '
            f'stroke="{color}" stroke-width="1" stroke-dasharray="3 3" '
            f'opacity="0.5"/>'
        )

        sy = ypix(sill)
        lines.append(
            f'<line x1="72" y1="{sy:.1f}" x2="860" y2="{sy:.1f}" '
            f'stroke="{color}" stroke-width="1" stroke-dasharray="2 4" '
            f'opacity="0.4"/>'
        )

        lx = min(rx + 8, 840)
        loo = p.get('loo_rmse')
        loo_txt = f'LOO={loo:.2f}' if loo else ''
        lines.append(
            f'<text x="{lx:.1f}" y="{sy-4:.1f}" fill="{color}" '
            f'font-size="11" font-family="Segoe UI">'
            f'{label} {loo_txt}</text>'
        )

    lx_base, ly_base = 760, 380
    for i, p in enumerate(valid[:3]):
        horizon_raw = p.get('horizon_label', p['parameter_id'].split('_h')[-1])
        horizon_key = f'h{horizon_raw.lower().replace("h","")}'
        color = HORIZON_COLORS.get(horizon_key, '#94A3B8')
        label = f"H{horizon_raw.replace('h','').upper()}"
        ly = ly_base + i * 16
        lines += [
            f'<rect x="{lx_base}" y="{ly}" width="20" height="3" '
            f'fill="{color}" rx="1"/>',
            f'<text x="{lx_base+26}" y="{ly+4}" fill="{color}" '
            f'font-size="11" font-family="Segoe UI">{label}</text>',
        ]

    lines += [
        f'<text x="72" y="452" fill="#94a3b8" font-size="11" '
        f'font-family="Segoe UI, Arial">Distance h (km)</text>',
        f'<text x="18" y="232" fill="#94a3b8" font-size="11" '
        f'font-family="Segoe UI, Arial" transform="rotate(-90 18 232)">γ(h)</text>',
        '</svg>',
    ]
    return '\n'.join(lines)


def make_svg_text_table(title: str, rows: list[tuple]) -> str:
    width, height = 900, 420
    y0 = 70
    line_h = 28
    svg_lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 {width} {height}">',
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
    # Conversion en km pour l'affichage
    # range_m est en mètres dans la DB — convertir en km
    # Si range_m < 5, c'est probablement en degrés décimaux (ancien format)
    if range_m < 5:
        range_km = range_m * DEGREES_TO_KM  # degrés → km
    elif range_m > 1000:
        range_km = range_m / 1000.0  # mètres → km
    else:
        range_km = range_m / 1000.0  # mètres → km (valeurs 5-1000 = mètres)
    range_label = f"{range_km:.1f} km"

    w, h = 900, 480
    pad_l, pad_r, pad_t, pad_b = 72, 40, 56, 72
    plot_w = w - pad_l - pad_r
    plot_h = h - pad_t - pad_b
    ymax = max(float(sill) * 1.15, 1e-6)
    xmax = max(float(range_km) * 1.5, 0.1)

    n_pt = 200
    hs = [xmax * i / (n_pt - 1) for i in range(n_pt)]
    gam = [spherical_gamma(x, nugget, sill, range_km) for x in hs]

    def xpix(xv: float) -> float:
        return pad_l + (xv / xmax) * plot_w

    def ypix(gv: float) -> float:
        return pad_t + plot_h - (gv / ymax) * plot_h

    path_d = "M " + " L ".join(f"{xpix(hs[i]):.2f},{ypix(gam[i]):.2f}" for i in range(n_pt))

    sill_line_y = ypix(float(sill))
    range_line_x = xpix(float(range_km))

    meta_lines = []
    if rows_sample:
        ca, mt, lr, _fq = rows_sample[0][:4]
        lr_s = "null" if lr is None else f"{float(lr):.4f}"
        meta_lines.append(f"Dernière ligne: {ca} | {mt or 'n/a'} | LOO RMSE {lr_s}")

    sub = f"{parameter_id}" + (f" — {horizon}" if horizon else "")
    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 {w} {h}">',
        '<rect x="0" y="0" width="100%" height="100%" fill="#0f172a"/>',
        f'<text x="24" y="36" fill="#e2e8f0" font-size="20" font-family="Segoe UI, Arial">{esc(title)}</text>',
        f'<text x="24" y="54" fill="#94a3b8" font-size="12" font-family="Segoe UI, Arial">{esc(sub)}</text>',
        f'<text x="24" y="70" fill="#64748b" font-size="11" font-family="Consolas, monospace">model={esc(model_type or "?")} | nugget={nugget:.4f} sill={sill:.4f} range={range_label} | LOO_RMSE={loo_rmse if loo_rmse is not None else "null"}</text>',
        f'<rect x="{pad_l}" y="{pad_t}" width="{plot_w}" height="{plot_h}" fill="#020617" stroke="#334155" stroke-width="1" rx="4"/>',
        f'<line x1="{pad_l}" y1="{sill_line_y}" x2="{pad_l + plot_w}" y2="{sill_line_y}" stroke="#475569" stroke-width="1" stroke-dasharray="4 3"/>',
        f'<text x="{pad_l + plot_w - 4}" y="{sill_line_y - 4}" fill="#94a3b8" font-size="10" text-anchor="end">sill</text>',
        f'<line x1="{range_line_x}" y1="{pad_t}" x2="{range_line_x}" y2="{pad_t + plot_h}" stroke="#475569" stroke-width="1" stroke-dasharray="4 3"/>',
        f'<text x="{range_line_x + 4}" y="{pad_t + 14}" fill="#94a3b8" font-size="10">{range_label}</text>',
        f'<path d="{path_d}" fill="none" stroke="#38bdf8" stroke-width="2"/>',
        f'<text x="{pad_l}" y="{h - 28}" fill="#94a3b8" font-size="11" font-family="Segoe UI, Arial">Distance h (km)</text>',
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
    ap.add_argument("--multi-compare", type=str, default=None,
                    help='JSON array de variogrammes à comparer')
    args = ap.parse_args()

    if args.multi_compare:
        params_list = json.loads(args.multi_compare)
        svg = make_svg_multi(params_list)
        print(json.dumps({"svg": svg, "rows": len(params_list)}))
        return 0
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
