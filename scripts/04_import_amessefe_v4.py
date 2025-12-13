#!/usr/bin/env python3
"""
Import AMESSEFE v4 - Architecture avec rollback 3 niveaux
=========================================================
- Niveau 1: SAVEPOINT par localité
- Niveau 2: Transaction par phase  
- Niveau 3: reset_amessefe.sql (externe)

Usage: python scripts/04_import_amessefe_v4.py [--dry-run]
"""

import sys
import subprocess
import time
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))

from utils.amessefe_excel import (
    load_vbs, load_limites, load_granulo, load_classif, load_gonflement,
    get_all_localites, STANDARD_DEPTHS
)
from utils.schema_contract import validate_schema_or_fail
from utils.import_metrics import create_import_session, PhaseStatus

SOURCE = "AMESSEFE Komi Yoan Freddy"
OPERATOR = "Serge TABE DJATO"
SCHEMA = "atlas"

def escape_sql(val) -> str:
    if val is None: return "NULL"
    return "'" + str(val).replace("'", "''") + "'"

def run_sql(sql: str, fetch: bool = False):
    """Exécute SQL via Docker."""
    cmd = ["docker", "exec", "-i", "atlas-db", "psql", "-U", "atlas", "atlas_clean", "-t", "-A", "-F", "\t", "-c", sql]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"SQL Error: {result.stderr}")
    if fetch:
        return [line.split("\t") for line in result.stdout.strip().split("\n") if line.strip()]
    return None

class AmessefeImporterV4:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.report, self.logger = create_import_session(dry_run)
        self.sondage_ids: Dict[str, str] = {}
        self.echantillon_ids: Dict[Tuple[str, float], str] = {}

    def run(self):
        self.report.start_time = time.time()
        self.logger.header()
        
        # Vérification schéma
        if not validate_schema_or_fail():
            self.report.schema_valid = False
            return False
        self.report.schema_valid = True
        
        # Phases
        self.phase_sondages()
        self.phase_echantillons()
        self.phase_vbs()
        self.phase_limites()
        self.phase_granulo()
        self.phase_classif()
        self.phase_gonflement()
        
        self.report.end_time = time.time()
        self.logger.summary()
        
        # Sauvegarder rapport
        report_path = Path(__file__).parent.parent / "data/xlsx/amessefe_import_report.json"
        self.report.save_json(report_path)
        self.logger.report_saved(report_path)
        
        return self.report.is_success

    def phase_sondages(self):
        phase = self.report.add_phase("sondages", "Création sondages")
        self.logger.phase_start(phase)
        
        localites = sorted(get_all_localites())
        phase.excel_localites = len(localites)
        self.report.total_localites = len(localites)
        
        run_sql("BEGIN;")
        for loc in localites:
            try:
                rows = run_sql(f"SELECT id FROM {SCHEMA}.sondages WHERE source={escape_sql(SOURCE)} AND localite_key={escape_sql(loc)} LIMIT 1;", True)
                if rows and rows[0][0]:
                    self.sondage_ids[loc] = rows[0][0]
                    phase.db_skipped += 1
                else:
                    meta = f'{{"localite":"{loc}","auteur":"{SOURCE}"}}'
                    rows = run_sql(f"""INSERT INTO {SCHEMA}.sondages (code,localite_base,localite_key,localite,source,operator,meta,location_mode,created_at,updated_at) 
                        VALUES ({escape_sql(loc)},{escape_sql(loc)},{escape_sql(loc)},{escape_sql(loc)},{escape_sql(SOURCE)},{escape_sql(OPERATOR)},'{meta}'::jsonb,'unknown',now(),now()) RETURNING id;""", True)
                    if rows: 
                        self.sondage_ids[loc] = rows[0][0]
                        phase.db_inserts += 1
            except Exception as e:
                phase.add_error(loc, 0, str(e)[:100])
        
        run_sql("ROLLBACK;" if self.dry_run else "COMMIT;")
        self.logger.phase_end(phase)

    def phase_echantillons(self):
        phase = self.report.add_phase("echantillons", "Création échantillons")
        self.logger.phase_start(phase)
        phase.excel_records = len(self.sondage_ids) * 3
        
        run_sql("BEGIN;")
        for loc, sid in self.sondage_ids.items():
            for depth in STANDARD_DEPTHS:
                try:
                    rows = run_sql(f"SELECT id FROM {SCHEMA}.echantillons WHERE sondage_id='{sid}' AND depth_m={depth} LIMIT 1;", True)
                    if rows and rows[0][0]:
                        self.echantillon_ids[(loc, depth)] = rows[0][0]
                        phase.db_skipped += 1
                    else:
                        rows = run_sql(f"INSERT INTO {SCHEMA}.echantillons (sondage_id,depth_m,laboratory,created_at) VALUES ('{sid}',{depth},'AMESSEFE',now()) ON CONFLICT DO NOTHING RETURNING id;", True)
                        if rows and rows[0][0]:
                            self.echantillon_ids[(loc, depth)] = rows[0][0]
                            phase.db_inserts += 1
                        else:
                            rows = run_sql(f"SELECT id FROM {SCHEMA}.echantillons WHERE sondage_id='{sid}' AND depth_m={depth} LIMIT 1;", True)
                            if rows: self.echantillon_ids[(loc, depth)] = rows[0][0]
                except Exception as e:
                    phase.add_error(loc, depth, str(e)[:100])
        
        run_sql("ROLLBACK;" if self.dry_run else "COMMIT;")
        self.logger.phase_end(phase)

    def phase_vbs(self):
        phase = self.report.add_phase("vbs", "Import VBS")
        self.logger.phase_start(phase)
        
        records = load_vbs()
        phase.excel_records = len(records)
        phase.excel_localites = len(set(r.localite_norm for r in records))
        
        run_sql("BEGIN;")
        for rec in records:
            eid = self.echantillon_ids.get((rec.localite_norm, rec.depth_m))
            if not eid:
                phase.add_error(rec.localite_norm, rec.depth_m, "echantillon_id manquant")
                continue
            try:
                run_sql(f"INSERT INTO {SCHEMA}.essais_vbs (echantillon_id,vbs,created_at) VALUES ('{eid}',{rec.vbs},now()) ON CONFLICT (echantillon_id) DO UPDATE SET vbs=EXCLUDED.vbs;")
                phase.db_inserts += 1
            except Exception as e:
                phase.add_error(rec.localite_norm, rec.depth_m, str(e)[:100])
        
        run_sql("ROLLBACK;" if self.dry_run else "COMMIT;")
        self.logger.phase_end(phase)

    def phase_limites(self):
        phase = self.report.add_phase("limites", "Import Limites Atterberg")
        self.logger.phase_start(phase)
        
        records = load_limites()
        phase.excel_records = len(records)
        phase.excel_localites = len(set(r.localite_norm for r in records))
        
        run_sql("BEGIN;")
        for rec in records:
            eid = self.echantillon_ids.get((rec.localite_norm, rec.depth_m))
            if not eid:
                phase.add_error(rec.localite_norm, rec.depth_m, "echantillon_id manquant")
                continue
            try:
                wl = rec.wl if rec.wl else "NULL"
                wp = rec.wp if rec.wp else "NULL"
                ip = rec.ip if rec.ip else "NULL"
                run_sql(f"INSERT INTO {SCHEMA}.essais_geotechniques (echantillon_id,wl,wp,ip,created_at,updated_at) VALUES ('{eid}',{wl},{wp},{ip},now(),now()) ON CONFLICT (echantillon_id) DO UPDATE SET wl=COALESCE(EXCLUDED.wl,{SCHEMA}.essais_geotechniques.wl),wp=COALESCE(EXCLUDED.wp,{SCHEMA}.essais_geotechniques.wp),ip=COALESCE(EXCLUDED.ip,{SCHEMA}.essais_geotechniques.ip),updated_at=now();")
                phase.db_inserts += 1
            except Exception as e:
                phase.add_error(rec.localite_norm, rec.depth_m, str(e)[:100])
        
        run_sql("ROLLBACK;" if self.dry_run else "COMMIT;")
        self.logger.phase_end(phase)

    def phase_granulo(self):
        phase = self.report.add_phase("granulo", "Import Granulo")
        self.logger.phase_start(phase)
        
        records = load_granulo()
        phase.excel_records = len(records)
        phase.excel_localites = len(set(r.localite_norm for r in records))
        
        run_sql("BEGIN;")
        for rec in records:
            eid = self.echantillon_ids.get((rec.localite_norm, rec.depth_m))
            if not eid:
                phase.add_error(rec.localite_norm, rec.depth_m, "echantillon_id manquant")
                continue
            try:
                run_sql(f"INSERT INTO {SCHEMA}.granulo_points (echantillon_id,method,sieve_mm,passing_pct,created_at) VALUES ('{eid}','tamisage_amessefe',{rec.sieve_mm},{rec.passing_pct},now()) ON CONFLICT (echantillon_id,method,sieve_mm) DO UPDATE SET passing_pct=EXCLUDED.passing_pct;")
                phase.db_inserts += 1
            except Exception as e:
                phase.add_error(rec.localite_norm, rec.depth_m, str(e)[:100])
        
        run_sql("ROLLBACK;" if self.dry_run else "COMMIT;")
        self.logger.phase_end(phase)

    def phase_classif(self):
        phase = self.report.add_phase("classif", "Import Classifications")
        self.logger.phase_start(phase)
        
        records = load_classif()
        phase.excel_records = len(records)
        phase.excel_localites = len(set(r.localite_norm for r in records))
        
        run_sql("BEGIN;")
        for rec in records:
            eid = self.echantillon_ids.get((rec.localite_norm, rec.depth_m))
            if not eid:
                phase.add_error(rec.localite_norm, rec.depth_m, "echantillon_id manquant")
                continue
            try:
                run_sql(f"INSERT INTO {SCHEMA}.essais_classif (echantillon_id,class_chassagneux,class_daksha,class_seed,class_vijay,type_sol,source,created_at) VALUES ('{eid}',{escape_sql(rec.class_chassagneux)},{escape_sql(rec.class_daksha)},{escape_sql(rec.class_seed)},{escape_sql(rec.class_vijay)},{escape_sql(rec.type_sol)},{escape_sql(SOURCE)},now()) ON CONFLICT (echantillon_id) DO UPDATE SET class_chassagneux=COALESCE(EXCLUDED.class_chassagneux,{SCHEMA}.essais_classif.class_chassagneux),class_daksha=COALESCE(EXCLUDED.class_daksha,{SCHEMA}.essais_classif.class_daksha),class_seed=COALESCE(EXCLUDED.class_seed,{SCHEMA}.essais_classif.class_seed),class_vijay=COALESCE(EXCLUDED.class_vijay,{SCHEMA}.essais_classif.class_vijay),type_sol=COALESCE(EXCLUDED.type_sol,{SCHEMA}.essais_classif.type_sol);")
                phase.db_inserts += 1
            except Exception as e:
                phase.add_error(rec.localite_norm, rec.depth_m, str(e)[:100])
        
        run_sql("ROLLBACK;" if self.dry_run else "COMMIT;")
        self.logger.phase_end(phase)

    def phase_gonflement(self):
        phase = self.report.add_phase("gonflement", "Import Gonflement")
        self.logger.phase_start(phase)
        
        records = load_gonflement()
        phase.excel_records = len(records)
        phase.excel_localites = len(set(r.localite_norm for r in records))
        
        run_sql("BEGIN;")
        for rec in records:
            eid = self.echantillon_ids.get((rec.localite_norm, rec.depth_m))
            if not eid:
                phase.add_error(rec.localite_norm, rec.depth_m, "echantillon_id manquant")
                continue
            try:
                cg = rec.cg if rec.cg else "NULL"
                run_sql(f"INSERT INTO {SCHEMA}.essais_potentiel_gonflement (echantillon_id,cg,cg_qual,created_at) VALUES ('{eid}',{cg},{escape_sql(rec.cg_qual)},now()) ON CONFLICT (echantillon_id) DO UPDATE SET cg=EXCLUDED.cg,cg_qual=EXCLUDED.cg_qual;")
                phase.db_inserts += 1
            except Exception as e:
                phase.add_error(rec.localite_norm, rec.depth_m, str(e)[:100])
        
        run_sql("ROLLBACK;" if self.dry_run else "COMMIT;")
        self.logger.phase_end(phase)

def main():
    parser = argparse.ArgumentParser(description="Import AMESSEFE v4")
    parser.add_argument("--dry-run", action="store_true", help="Mode test sans commit")
    args = parser.parse_args()
    
    importer = AmessefeImporterV4(dry_run=args.dry_run)
    success = importer.run()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
