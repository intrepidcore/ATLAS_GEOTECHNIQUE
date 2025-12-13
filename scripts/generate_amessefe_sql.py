#!/usr/bin/env python3
"""
Génère les fichiers SQL pour l'import AMESSEFE.
Utilise le module centralisé amessefe_excel.py.
"""

import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from utils.amessefe_excel import (
    load_vbs, load_limites, load_granulo, load_classif, load_gonflement,
    get_all_localites, STANDARD_DEPTHS
)

SOURCE = "AMESSEFE Komi Yoan Freddy"
OPERATOR = "Serge TABE DJATO"
SCHEMA = "atlas"

def escape_sql(s):
    """Échappe les quotes pour SQL."""
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def generate_sql():
    """Génère le SQL complet d'import."""
    
    lines = []
    lines.append("-- Import AMESSEFE généré automatiquement")
    lines.append("-- Source: utils/amessefe_excel.py")
    lines.append("")
    lines.append("BEGIN;")
    lines.append("")
    
    # 1. Sondages
    localites = sorted(get_all_localites())
    print(f"📍 {len(localites)} localités à importer")
    
    lines.append(f"-- 1. SONDAGES ({len(localites)} localités)")
    for loc in localites:
        meta = json.dumps({"localite": loc, "auteur": SOURCE})
        lines.append(f"""
INSERT INTO {SCHEMA}.sondages (code, localite_base, localite_key, localite, source, operator, meta, location_mode, created_at, updated_at)
VALUES ({escape_sql(loc)}, {escape_sql(loc)}, {escape_sql(loc)}, {escape_sql(loc)}, {escape_sql(SOURCE)}, {escape_sql(OPERATOR)}, {escape_sql(meta)}::jsonb, 'unknown', now(), now())
ON CONFLICT DO NOTHING;""")
    
    # 2. Échantillons
    lines.append("")
    lines.append(f"-- 2. ÉCHANTILLONS (3 profondeurs par sondage)")
    for loc in localites:
        for depth in STANDARD_DEPTHS:
            lines.append(f"""
INSERT INTO {SCHEMA}.echantillons (sondage_id, depth_m, laboratory, created_at)
SELECT id, {depth}, 'AMESSEFE', now() FROM {SCHEMA}.sondages 
WHERE localite_key = {escape_sql(loc)} AND source = {escape_sql(SOURCE)}
ON CONFLICT (sondage_id, depth_m, date) DO NOTHING;""")
    
    # 3. VBS (pas de colonne source dans la table)
    vbs_records = load_vbs()
    print(f"💙 {len(vbs_records)} VBS")
    lines.append("")
    lines.append(f"-- 3. VBS ({len(vbs_records)} records)")
    for rec in vbs_records:
        lines.append(f"""
INSERT INTO {SCHEMA}.essais_vbs (echantillon_id, vbs, created_at)
SELECT e.id, {rec.vbs}, now()
FROM {SCHEMA}.echantillons e
JOIN {SCHEMA}.sondages s ON s.id = e.sondage_id
WHERE s.localite_key = {escape_sql(rec.localite_norm)} AND s.source = {escape_sql(SOURCE)} AND e.depth_m = {rec.depth_m}
ON CONFLICT (echantillon_id) DO UPDATE SET vbs = EXCLUDED.vbs;""")
    
    # 4. Limites
    limites_records = load_limites()
    print(f"📐 {len(limites_records)} Limites")
    lines.append("")
    lines.append(f"-- 4. LIMITES ({len(limites_records)} records)")
    for rec in limites_records:
        wl = rec.wl if rec.wl is not None else "NULL"
        wp = rec.wp if rec.wp is not None else "NULL"
        ip = rec.ip if rec.ip is not None else "NULL"
        lines.append(f"""
INSERT INTO {SCHEMA}.essais_geotechniques (echantillon_id, wl, wp, ip, source, created_at, updated_at)
SELECT e.id, {wl}, {wp}, {ip}, {escape_sql(SOURCE)}, now(), now()
FROM {SCHEMA}.echantillons e
JOIN {SCHEMA}.sondages s ON s.id = e.sondage_id
WHERE s.localite_key = {escape_sql(rec.localite_norm)} AND s.source = {escape_sql(SOURCE)} AND e.depth_m = {rec.depth_m}
ON CONFLICT (echantillon_id) DO UPDATE SET wl = COALESCE(EXCLUDED.wl, {SCHEMA}.essais_geotechniques.wl), wp = COALESCE(EXCLUDED.wp, {SCHEMA}.essais_geotechniques.wp), ip = COALESCE(EXCLUDED.ip, {SCHEMA}.essais_geotechniques.ip), updated_at = now();""")
    
    # 5. Granulo (pas de colonne source, contrainte unique inclut method)
    granulo_records = load_granulo()
    print(f"📊 {len(granulo_records)} Granulo")
    lines.append("")
    lines.append(f"-- 5. GRANULO ({len(granulo_records)} records)")
    for rec in granulo_records:
        lines.append(f"""
INSERT INTO {SCHEMA}.granulo_points (echantillon_id, sieve_mm, passing_pct, method, created_at)
SELECT e.id, {rec.sieve_mm}, {rec.passing_pct}, 'tamisage', now()
FROM {SCHEMA}.echantillons e
JOIN {SCHEMA}.sondages s ON s.id = e.sondage_id
WHERE s.localite_key = {escape_sql(rec.localite_norm)} AND s.source = {escape_sql(SOURCE)} AND e.depth_m = {rec.depth_m}
ON CONFLICT (echantillon_id, method, sieve_mm) DO UPDATE SET passing_pct = EXCLUDED.passing_pct;""")
    
    # 6. Classif
    classif_records = load_classif()
    print(f"🏷️ {len(classif_records)} Classif")
    lines.append("")
    lines.append(f"-- 6. CLASSIF ({len(classif_records)} records)")
    for rec in classif_records:
        lines.append(f"""
INSERT INTO {SCHEMA}.essais_classif (echantillon_id, class_chassagneux, class_daksha, class_seed, class_vijay, type_sol, source, created_at)
SELECT e.id, {escape_sql(rec.class_chassagneux)}, {escape_sql(rec.class_daksha)}, {escape_sql(rec.class_seed)}, {escape_sql(rec.class_vijay)}, {escape_sql(rec.type_sol)}, {escape_sql(SOURCE)}, now()
FROM {SCHEMA}.echantillons e
JOIN {SCHEMA}.sondages s ON s.id = e.sondage_id
WHERE s.localite_key = {escape_sql(rec.localite_norm)} AND s.source = {escape_sql(SOURCE)} AND e.depth_m = {rec.depth_m}
ON CONFLICT (echantillon_id) DO UPDATE SET 
  class_chassagneux = COALESCE(EXCLUDED.class_chassagneux, {SCHEMA}.essais_classif.class_chassagneux), 
  class_daksha = COALESCE(EXCLUDED.class_daksha, {SCHEMA}.essais_classif.class_daksha), 
  class_seed = COALESCE(EXCLUDED.class_seed, {SCHEMA}.essais_classif.class_seed), 
  class_vijay = COALESCE(EXCLUDED.class_vijay, {SCHEMA}.essais_classif.class_vijay),
  type_sol = COALESCE(EXCLUDED.type_sol, {SCHEMA}.essais_classif.type_sol);""")
    
    # 7. Gonflement (pas de colonne source dans la table)
    gonflement_records = load_gonflement()
    print(f"🔄 {len(gonflement_records)} Gonflement")
    lines.append("")
    lines.append(f"-- 7. GONFLEMENT ({len(gonflement_records)} records)")
    for rec in gonflement_records:
        cg = rec.cg if rec.cg is not None else "NULL"
        lines.append(f"""
INSERT INTO {SCHEMA}.essais_potentiel_gonflement (echantillon_id, cg, cg_qual, created_at)
SELECT e.id, {cg}, {escape_sql(rec.cg_qual)}, now()
FROM {SCHEMA}.echantillons e
JOIN {SCHEMA}.sondages s ON s.id = e.sondage_id
WHERE s.localite_key = {escape_sql(rec.localite_norm)} AND s.source = {escape_sql(SOURCE)} AND e.depth_m = {rec.depth_m}
ON CONFLICT (echantillon_id) DO UPDATE SET cg = EXCLUDED.cg, cg_qual = EXCLUDED.cg_qual;""")
    
    lines.append("")
    lines.append("COMMIT;")
    lines.append("")
    lines.append("-- Résumé")
    lines.append(f"-- Sondages: {len(localites)}")
    lines.append(f"-- Échantillons: {len(localites) * 3}")
    lines.append(f"-- VBS: {len(vbs_records)}")
    lines.append(f"-- Limites: {len(limites_records)}")
    lines.append(f"-- Granulo: {len(granulo_records)}")
    lines.append(f"-- Classif: {len(classif_records)}")
    lines.append(f"-- Gonflement: {len(gonflement_records)}")
    
    return "\n".join(lines)


if __name__ == "__main__":
    output_path = Path(__file__).parent.parent / "sql" / "import_amessefe_full.sql"
    
    print("=" * 60)
    print("🔧 Génération SQL import AMESSEFE")
    print("=" * 60)
    
    sql = generate_sql()
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(sql)
    
    print(f"\n✅ Fichier généré: {output_path}")
    print(f"   Taille: {len(sql)} caractères")
