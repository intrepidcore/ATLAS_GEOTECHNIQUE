#!/usr/bin/env python3
"""
geocode_unknown_sondages.py
Geocodage des sondages sans coordonnees (location_mode='unknown').

Methodologie :
  1. Chercher le canton ADM3 le plus proche par le nom de la localite
  2. Generer un point pseudo-aleatoire deterministique a l'interieur du polygone
  3. Marquer location_mode='inferred' et location_accuracy='low'
  4. Appeler geocode_sondage() pour peupler adm1/adm2/adm3/maille_code

Reproductibilite : seed = hash(sondage.id) pour des coordonnees stables.

Usage:
  python geocode_unknown_sondages.py --database-url postgresql://...
  python geocode_unknown_sondages.py --dry-run
"""
from __future__ import annotations

import argparse
import hashlib
import math
import re
import sys
from typing import Optional, Tuple

import psycopg2
import psycopg2.extras

DB_DEFAULT = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"

# Mapping manuel force pour les cas connus
# code_sondage -> adm3_pcode ou adm3_gid ou None (auto)
FORCED_ADM3: dict = {
    "DJOGBEKOPE":        "TG030609",   # Vogan (Vo, Maritime) — adm3_code='VO' dans meta
    "Kaniamboua (Bago)": "TG010305",   # Kaniamboua (Sotouboua, Centrale)
    "Wome (Zongo)":      "TG041211",   # Wome (Kloto, Plateaux) — meme canton
    "Wome Zongo":        "TG041211",   # Wome (Kloto, Plateaux)
    "Zongo 1":           "TG041211",   # Zongo = quartier de Wome (Kloto, Plateaux)
    "Zongo 2":           "TG041211",   # Zongo = quartier de Wome (Kloto, Plateaux)
    "KONTONGBONGUE":     None,         # Introuvable dans adm3 — fallback national
    "NASSABLE":          None,         # Introuvable dans adm3 — fallback national
}

# Normalisation : retirer accents, ponctuation, mettre en minuscules
def normalize(s: str) -> str:
    if not s:
        return ""
    s = s.lower()
    # Accents basiques
    for src, dst in [
        ("é","e"),("è","e"),("ê","e"),
        ("\xe9","e"),("\xe8","e"),("\xea","e"),("\xeb","e"),
        ("\xe0","a"),("\xe2","a"),("\xe4","a"),
        ("\xf4","o"),("\xf2","o"),("\xf6","o"),
        ("\xfc","u"),("\xfb","u"),("\xf9","u"),
        ("\xef","i"),("\xee","i"),
        ("\xe7","c"),
    ]:
        s = s.replace(src, dst)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def extract_keywords(s: str) -> list:
    """Extrait des mots cles significatifs (>= 4 chars)."""
    s = normalize(s)
    # Enlever mots courants
    stop = {"sur","les","des","de","du","la","le","les","et","en","au","aux","bago",
            "village","quartier","canton","commune","district","zone","route",
            "lotissement","section"}
    words = [w for w in s.split() if len(w) >= 4 and w not in stop]
    return words


def find_adm3_by_pcode(cur, pcode: str) -> Optional[tuple]:
    cur.execute("""
        SELECT gid, adm3_pcode, adm3_fr, adm2_fr, adm1_fr,
               ST_AsText(geom), ST_Envelope(geom)
        FROM atlas.adm3 WHERE adm3_pcode = %s LIMIT 1
    """, (pcode,))
    return cur.fetchone()


def find_adm3_by_name(cur, localite: str) -> Optional[tuple]:
    """Recherche fuzzy dans adm3 par le nom."""
    keywords = extract_keywords(localite)
    if not keywords:
        keywords = [normalize(localite)[:10]]

    # Tenter les mots cles par ordre decroissant de longueur
    keywords.sort(key=len, reverse=True)
    for kw in keywords:
        if len(kw) < 3:
            continue
        cur.execute("""
            SELECT gid, adm3_pcode, adm3_fr, adm2_fr, adm1_fr,
                   ST_AsText(geom), ST_Envelope(geom)
            FROM atlas.adm3
            WHERE adm3_fr ILIKE %s
            ORDER BY LENGTH(adm3_fr) ASC
            LIMIT 3
        """, (f"%{kw}%",))
        rows = cur.fetchall()
        if len(rows) == 1:
            return rows[0]
        if len(rows) > 1:
            # Choisir celui dont le nom ressemble le plus
            best = None
            best_score = -1
            for row in rows:
                adm3_name = normalize(row[2])
                score = sum(1 for k in keywords if k in adm3_name)
                if score > best_score:
                    best_score = score
                    best = row
            return best
    return None


def random_point_in_bbox(
    sondage_id: str,
    xmin: float, ymin: float, xmax: float, ymax: float,
    n_tries: int = 1
) -> Tuple[float, float]:
    """
    Point pseudo-aleatoire deterministique dans une bbox.
    Seed = hash(sondage_id) pour reproductibilite.
    """
    seed = int(hashlib.sha256(sondage_id.encode()).hexdigest(), 16) % (2**32)
    import random
    rng = random.Random(seed + n_tries)
    lon = xmin + rng.random() * (xmax - xmin)
    lat = ymin + rng.random() * (ymax - ymin)
    return lon, lat


def geocode_unknown_sondage(
    cur, sid: str, code: str, localite: str, forced_pcode: Optional[str],
    dry_run: bool
) -> dict:
    """
    Geocode un sondage sans coordonnees.
    Retourne un dict avec le resultat.
    """
    # 1. Trouver l'ADM3
    adm3_row = None
    method = "auto"

    if forced_pcode:
        adm3_row = find_adm3_by_pcode(cur, forced_pcode)
        method = "forced_pcode"

    if adm3_row is None and localite:
        adm3_row = find_adm3_by_name(cur, localite)
        method = "name_match"

    # Fallback : centroide national Togo
    if adm3_row is None:
        print(f"  [WARN] {code} — aucun ADM3 trouve pour '{localite}' — fallback centroide Togo")
        lon, lat = 1.0, 8.6  # centroide national
        adm3_gid = None
        adm3_name = None
        adm1_name = "TOGO"
        adm2_name = None
        method = "national_fallback"
    else:
        gid, pcode, adm3_fr, adm2_fr, adm1_fr, wkt, envelope_wkt = adm3_row
        adm3_gid = gid
        adm3_name = adm3_fr
        adm1_name = adm1_fr
        adm2_name = adm2_fr

        # Extraire bbox de l'enveloppe
        # ST_Envelope retourne un polygone POLYGON((xmin ymin,...))
        coords_match = re.findall(r"[-\d.]+\s+[-\d.]+", envelope_wkt)
        if coords_match:
            pts = [tuple(map(float, c.split())) for c in coords_match]
            xmin = min(p[0] for p in pts)
            xmax = max(p[0] for p in pts)
            ymin = min(p[1] for p in pts)
            ymax = max(p[1] for p in pts)
        else:
            # Fallback : centroide du polygon
            cur.execute(
                "SELECT ST_X(ST_Centroid(geom)), ST_Y(ST_Centroid(geom)) FROM atlas.adm3 WHERE gid=%s",
                (gid,)
            )
            cx, cy = cur.fetchone()
            xmin, xmax = float(cx) - 0.05, float(cx) + 0.05
            ymin, ymax = float(cy) - 0.05, float(cy) + 0.05

        # Generer point dedans (verifie qu'il est dans le polygone)
        for attempt in range(10):
            lon, lat = random_point_in_bbox(sid, xmin, ymin, xmax, ymax, attempt)
            cur.execute("""
                SELECT ST_Contains(geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
                FROM atlas.adm3 WHERE gid=%s
            """, (lon, lat, gid))
            row = cur.fetchone()
            if row and row[0]:
                break
        else:
            # Si aucun essai ne tombe dans le polygone, prendre le centroide
            cur.execute("SELECT ST_X(ST_Centroid(geom)), ST_Y(ST_Centroid(geom)) FROM atlas.adm3 WHERE gid=%s", (gid,))
            lon, lat = cur.fetchone()
            print(f"  [INFO] {code} — point random impossible, utilisation centroide ADM3 {adm3_name}")

    print(f"  {'DRY-RUN ' if dry_run else ''}Geocode {code}")
    print(f"    localite='{localite}' -> ADM3={adm3_name} ({adm1_name})")
    print(f"    lon={lon:.6f} lat={lat:.6f} method={method}")

    if not dry_run:
        # Mettre a jour le sondage
        cur.execute("""
            UPDATE atlas.sondages SET
              geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326),
              location_mode = 'inferred',
              location_accuracy = 'low',
              adm1_name = %s,
              adm2_name = %s,
              adm3_id = %s,
              adm3_name = %s,
              updated_at = now()
            WHERE id = %s::uuid
        """, (lon, lat, adm1_name, adm2_name, adm3_gid, adm3_name, sid))

        # Appeler geocode_sondage pour peupler maille_code et affiner
        cur.execute("SELECT atlas.geocode_sondage(%s::uuid)", (sid,))

    return {
        "code": code,
        "localite": localite,
        "adm3": adm3_name,
        "adm1": adm1_name,
        "lon": lon,
        "lat": lat,
        "method": method,
        "ok": True,
    }


def main():
    parser = argparse.ArgumentParser(description="Geocode sondages sans coordonnees")
    parser.add_argument("--database-url", default=DB_DEFAULT)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False
    cur = conn.cursor()

    # Charger tous les sondages sans geom
    cur.execute("""
        SELECT id, code, localite, localite_base, meta,
               location_mode, adm3_id, adm1_name
        FROM atlas.sondages
        WHERE deleted_at IS NULL AND geom IS NULL
        ORDER BY code
    """)
    rows = cur.fetchall()
    print(f"=== Geocodage sondages sans geom : {len(rows)} sondage(s) ===")

    if not rows:
        print("Aucun sondage sans geom — rien a faire.")
        conn.close()
        return 0

    results = []
    errors  = []

    for sid, code, localite_col, localite_base, meta, lmode, adm3_id, adm1 in rows:
        # Extraire la meilleure info de localite
        localite = (
            (meta or {}).get("localite")
            or localite_col
            or localite_base
            or code
            or ""
        )
        # Nettoyage encodage
        if isinstance(localite, bytes):
            localite = localite.decode("utf-8", errors="replace")

        # Chercher dans le mapping force
        forced = None
        for k, v in FORCED_ADM3.items():
            if normalize(k) in normalize(code or "") or normalize(k) in normalize(localite or ""):
                forced = v
                break

        try:
            r = geocode_unknown_sondage(cur, str(sid), code, localite, forced, args.dry_run)
            results.append(r)
        except Exception as e:
            print(f"  ERR {code} : {e}")
            conn.rollback()
            errors.append({"code": code, "error": str(e)})

    if not args.dry_run:
        conn.commit()

    conn.close()

    print(f"\n=== BILAN ===")
    print(f"  Geocodes : {len(results)}")
    print(f"  Erreurs  : {len(errors)}")
    for r in results:
        adm3_s = str(r.get('adm3') or 'TOGO-fallback')
        print(f"  OK  {r['code']:<30} ADM3={adm3_s:<25} ({r['lon']:.4f},{r['lat']:.4f}) [{r['method']}]")
    for e in errors:
        print(f"  ERR {e['code']} : {e['error']}")

    return len(errors)


if __name__ == "__main__":
    sys.exit(main())
