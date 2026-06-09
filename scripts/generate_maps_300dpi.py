#!/usr/bin/env python3
"""
generate_maps_300dpi.py
Wrapper de generation de cartes thematiques 300 DPI — Atlas Geotechnique Togo.

Ce script est le point d'entree principal pour generer des cartes PNG/PDF
a partir de atlas.ai_interpolation_values. Il delegue le rendu a
headless_render_300dpi.py et ajoute des fonctionnalites supplementaires :
- detection automatique des parametres disponibles en DB
- generation des cartes manquantes uniquement (skip si fichier existant)
- organisation par dossier (exports_300dpi/)
- rapport HTML de synthese

Usage:
  python generate_maps_300dpi.py --detect        # detecte les params disponibles en DB
  python generate_maps_300dpi.py --missing       # genere les cartes manquantes
  python generate_maps_300dpi.py --all           # genere toutes les cartes
  python generate_maps_300dpi.py --param vbs_ked_h1
  python generate_maps_300dpi.py --param eg_ked_h2 --force
  python generate_maps_300dpi.py --group ked     # seulement les KED
  python generate_maps_300dpi.py --group fusion  # seulement les fusion

Parametres disponibles en DB (pour la methode ked_hierarchical_5levels) :
  VBS  : vbs_ked_h1/h2/h3
  IP   : ip_ked_h1/h2/h3
  WL   : wl_ked_h1/h2/h3
  WP   : wp_ked_h1/h2/h3
  EG   : eg_ked_h1/h2/h3
  Rd   : rd_mpa_ked_h1/h2/h3
  CBR  : cbr_95_ked_h1
  gd   : gamma_d_ked_h1
  wopt : w_opt_ked_h1
  Fin. : passant_80um_ked_h1/h2/h3, passant_2mm_ked_h1/h2/h3
  Press: em_mpa_ked_h1/h3, pl_mpa_ked_h1/h3

  Fusion : vbs/ip/wl/wp/eg_fusion_h1/h2/h3
  RK     : vbs/ip/wl/wp/eg/rd_rk_h1/h2/h3
  MTGP   : vbs/ip/wl/wp/eg_mtgp_h1/h2/h3

DB : postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# Le moteur de rendu est dans headless_render_300dpi.py
sys.path.insert(0, str(Path(__file__).parent))
import headless_render_300dpi as engine

DB_DEFAULT = os.environ.get("DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean")

# ── Groupes de parametres ────────────────────────────────────────────────────

GROUPS = {
    "ked": [
        "vbs_ked_h1", "vbs_ked_h2", "vbs_ked_h3",
        "ip_ked_h1",  "ip_ked_h2",  "ip_ked_h3",
        "wl_ked_h1",  "wl_ked_h2",  "wl_ked_h3",
        "wp_ked_h1",  "wp_ked_h2",  "wp_ked_h3",
        "eg_ked_h1",  "eg_ked_h2",  "eg_ked_h3",
        "rd_mpa_ked_h1", "rd_mpa_ked_h2", "rd_mpa_ked_h3",
        "cbr_95_ked_h1",
        "gamma_d_ked_h1",
        "w_opt_ked_h1",
        "passant_80um_ked_h1", "passant_80um_ked_h2", "passant_80um_ked_h3",
        "passant_2mm_ked_h1",  "passant_2mm_ked_h2",  "passant_2mm_ked_h3",
        "em_mpa_ked_h1", "em_mpa_ked_h3",
        "pl_mpa_ked_h1", "pl_mpa_ked_h3",
    ],
    "rk": [
        "vbs_rk_h1", "vbs_rk_h2", "vbs_rk_h3",
        "ip_rk_h1",  "ip_rk_h2",  "ip_rk_h3",
        "wl_rk_h1",  "wl_rk_h2",  "wl_rk_h3",
        "wp_rk_h1",  "wp_rk_h2",  "wp_rk_h3",
        "eg_rk_h1",  "eg_rk_h2",  "eg_rk_h3",
    ],
    "fusion": [
        "vbs_fusion_h1", "vbs_fusion_h2", "vbs_fusion_h3",
        "ip_fusion_h1",  "ip_fusion_h2",  "ip_fusion_h3",
        "wl_fusion_h1",  "wl_fusion_h2",  "wl_fusion_h3",
        "wp_fusion_h1",  "wp_fusion_h2",  "wp_fusion_h3",
        "eg_fusion_h1",  "eg_fusion_h2",  "eg_fusion_h3",
    ],
    "mtgp": [
        "vbs_mtgp_h1", "vbs_mtgp_h2", "vbs_mtgp_h3",
        "ip_mtgp_h1",  "ip_mtgp_h2",  "ip_mtgp_h3",
        "wl_mtgp_h1",  "wl_mtgp_h2",  "wl_mtgp_h3",
        "wp_mtgp_h1",  "wp_mtgp_h2",  "wp_mtgp_h3",
        "eg_mtgp_h1",  "eg_mtgp_h2",  "eg_mtgp_h3",
    ],
}

# Tous les groupes concatenes
ALL_PARAMS = []
for g in GROUPS.values():
    for p in g:
        if p not in ALL_PARAMS:
            ALL_PARAMS.append(p)


def detect_available_params(cur) -> list[str]:
    """Detecte les parameter_id disponibles dans atlas.ai_interpolation_values."""
    cur.execute(
        "SELECT DISTINCT parameter_id FROM atlas.ai_interpolation_values ORDER BY parameter_id"
    )
    return [r[0] for r in cur.fetchall()]


def get_existing_maps(out_dir: Path) -> set[str]:
    """Retourne les parametres deja exportes (fichier PNG existant)."""
    existing = set()
    for f in out_dir.glob("*.png"):
        existing.add(f.stem)
    return existing


def write_html_report(results: list, out_dir: Path, elapsed: float):
    """Genere un rapport HTML de synthese."""
    html_path = out_dir / "_rapport_generation.html"
    now = datetime.now().strftime("%d/%m/%Y %H:%M")
    rows_html = ""
    for status, pid, info in results:
        color = "#27ae60" if status == "OK" else ("#e67e22" if status == "SKIP" else "#e74c3c")
        icon = "&#10003;" if status == "OK" else ("&#8594;" if status == "SKIP" else "&#10007;")
        rows_html += (
            f'<tr>'
            f'<td style="color:{color};font-weight:bold">{icon} {status}</td>'
            f'<td><code>{pid}</code></td>'
            f'<td style="font-size:0.85em;color:#555">{info}</td>'
            f'</tr>\n'
        )
    n_ok   = sum(1 for r in results if r[0] == "OK")
    n_skip = sum(1 for r in results if r[0] == "SKIP")
    n_err  = sum(1 for r in results if r[0] == "ERR")

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Rapport cartes 300dpi</title>
<style>
  body {{font-family:Arial,sans-serif; margin:2em; background:#f9f9f9}}
  h1   {{color:#1a3a5c}}
  .summary {{background:white; padding:1em; border-radius:8px; box-shadow:0 2px 4px #ccc; margin-bottom:1em}}
  table {{width:100%; border-collapse:collapse; background:white; border-radius:8px; box-shadow:0 2px 4px #ccc}}
  th   {{background:#1a3a5c; color:white; padding:8px; text-align:left}}
  td   {{padding:6px 10px; border-bottom:1px solid #eee}}
  tr:hover {{background:#f0f4f8}}
</style>
</head>
<body>
<h1>Atlas Geotechnique Togo — Rapport generation cartes 300 DPI</h1>
<div class="summary">
  <b>Date :</b> {now} &nbsp;|&nbsp;
  <b>Duree :</b> {elapsed:.0f}s &nbsp;|&nbsp;
  <b style="color:#27ae60">OK : {n_ok}</b> &nbsp;|&nbsp;
  <b style="color:#e67e22">Skip : {n_skip}</b> &nbsp;|&nbsp;
  <b style="color:#e74c3c">Erreurs : {n_err}</b> &nbsp;|&nbsp;
  <b>Total : {len(results)}</b><br>
  <b>Dossier :</b> <code>{out_dir.resolve()}</code>
</div>
<table>
<thead><tr><th>Statut</th><th>Parametre</th><th>Info</th></tr></thead>
<tbody>
{rows_html}
</tbody>
</table>
</body></html>"""
    html_path.write_text(html, encoding="utf-8")
    print(f"  [RAPPORT] {html_path}", flush=True)


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generateur de cartes thematiques 300 DPI — Atlas Geotechnique Togo"
    )
    parser.add_argument("--database-url", default=DB_DEFAULT)
    parser.add_argument("--param", default=None,
                        help="Parametre specifique a generer (ex: eg_ked_h2)")
    parser.add_argument("--all", action="store_true",
                        help="Generer toutes les cartes (KED + RK + Fusion + MTGP)")
    parser.add_argument("--missing", action="store_true",
                        help="Generer uniquement les cartes absentes du dossier output")
    parser.add_argument("--detect", action="store_true",
                        help="Afficher les parametres disponibles en DB et quitter")
    parser.add_argument("--group", default=None,
                        choices=list(GROUPS.keys()),
                        help="Groupe de parametres (ked|rk|fusion|mtgp)")
    parser.add_argument("--force", action="store_true",
                        help="Regenerer meme si le fichier PNG existe deja")
    parser.add_argument("--out", default="./exports_300dpi",
                        help="Repertoire de sortie (defaut: ./exports_300dpi)")
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--no-sondages", action="store_true",
                        help="Ne pas tracer les points sondages")
    args = parser.parse_args()

    import psycopg2
    conn = psycopg2.connect(args.database_url)
    conn.set_client_encoding("UTF8")
    cur = conn.cursor()

    # -- Mode detection
    if args.detect:
        print("\nParametres disponibles dans atlas.ai_interpolation_values :")
        available = detect_available_params(cur)
        for pid in available:
            in_meta = "(*)" if pid in engine.PARAM_META else "   "
            print(f"  {in_meta} {pid}")
        print(f"\n(*) = meta configuree dans PARAM_META ({len(engine.PARAM_META)} entrees)")
        print(f"Total DB : {len(available)} parametres")
        conn.close()
        return 0

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    # -- Determiner la liste de parametres
    if args.param:
        params = [args.param]
    elif args.all:
        params = ALL_PARAMS
    elif args.group:
        params = GROUPS[args.group]
    elif args.missing:
        existing = get_existing_maps(out_dir)
        params = [p for p in ALL_PARAMS if p not in existing]
        print(f"Cartes manquantes : {len(params)} / {len(ALL_PARAMS)}")
    else:
        # Par defaut : KED seulement
        params = GROUPS["ked"]
        print("Mode defaut : groupe KED. Utiliser --all, --group, --missing ou --param pour cibler.")

    if not args.force:
        existing = get_existing_maps(out_dir)
        params_todo = [p for p in params if p not in existing]
        params_skip = [p for p in params if p in existing]
        if params_skip:
            print(f"  Skip {len(params_skip)} deja exportes (--force pour regenerer)")
        params = params_todo

    if not params:
        print("Rien a generer.")
        conn.close()
        return 0

    print("=" * 60)
    print(f"generate_maps_300dpi.py — {len(params)} cartes a generer")
    print(f"Output : {out_dir.resolve()}")
    print(f"DPI    : {args.dpi}")
    print("=" * 60)

    # Chargement geometries (une seule fois)
    gdf      = engine.load_mailles_gdf(cur)
    boundary = engine.load_togo_boundary(cur)
    adm1     = engine.load_adm1(cur)

    sondages_gdf = None
    if not args.no_sondages:
        try:
            cur.execute("""
                SELECT ST_X(ST_Transform(geom, 4326)), ST_Y(ST_Transform(geom, 4326))
                FROM atlas.sondages
                WHERE deleted_at IS NULL AND geom IS NOT NULL
            """)
            rows = cur.fetchall()
            from shapely.geometry import Point
            import geopandas as gpd
            pts = [Point(r[0], r[1]) for r in rows]
            sondages_gdf = gpd.GeoDataFrame(geometry=pts, crs="EPSG:4326")
            print(f"  [LOAD] {len(sondages_gdf)} sondages", flush=True)
        except Exception as e:
            print(f"  [WARN] sondages: {e}")

    t_start = time.time()
    results = []

    for pid in params:
        print(f"\n{'='*55}")
        print(f"  {pid}")
        print(f"{'='*55}")

        meta = engine.PARAM_META.get(pid)
        if meta is None:
            # Auto-meta depuis la DB
            cur.execute(
                "SELECT MIN(value), MAX(value), COUNT(*) "
                "FROM atlas.ai_interpolation_values WHERE parameter_id=%s AND value IS NOT NULL",
                (pid,),
            )
            row = cur.fetchone()
            if not row or row[2] == 0:
                print(f"  [SKIP] {pid} — pas de donnees en DB")
                results.append(("SKIP", pid, "pas de donnees en DB"))
                continue
            meta = {
                "label": pid.replace("_", " ").upper(),
                "unit": "?",
                "cmap": "viridis",
                "vmin": float(row[0]),
                "vmax": float(row[1]),
                "horizon": "",
            }

        values = engine.load_values(cur, pid)
        if not values:
            print(f"  [SKIP] {pid} — aucune valeur")
            results.append(("SKIP", pid, "aucune valeur"))
            continue

        out_path = out_dir / pid
        try:
            engine.render_map(
                gdf=gdf,
                values=values,
                meta=meta,
                parameter_id=pid,
                out_path=out_path,
                boundary=boundary,
                adm1=adm1,
                dpi=args.dpi,
                sondages_gdf=sondages_gdf,
            )
            results.append(("OK", pid, str(out_path.with_suffix(".png"))))
        except Exception as exc:
            import traceback
            print(f"  [ERR] {pid}: {exc}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            results.append(("ERR", pid, str(exc)))

    cur.close()
    conn.close()

    elapsed = time.time() - t_start

    print(f"\n{'='*60}")
    print("BILAN generate_maps_300dpi.py")
    print(f"{'='*60}")
    for status, pid, info in results:
        print(f"  [{status}] {pid:<35} {info}")

    n_ok  = sum(1 for r in results if r[0] == "OK")
    n_err = sum(1 for r in results if r[0] == "ERR")
    print(f"\n  Succes: {n_ok} | Erreurs: {n_err} | Duree: {elapsed:.0f}s")
    print(f"  Dossier: {out_dir.resolve()}")

    write_html_report(results, out_dir, elapsed)

    return 0 if n_err == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
