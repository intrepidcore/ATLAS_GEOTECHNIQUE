#!/usr/bin/env python3
"""
Script d'attribution automatique des mailles Atlas Colab
=========================================================

Ce script permet d'importer un fichier Excel contenant les préférences des étudiants
et d'attribuer automatiquement une maille nationale (2 km²) à chaque étudiant.

Usage:
    poetry run python scripts/colab_assign_mailles_from_excel.py \
        --input data/colab/etudiants_colab.xlsx \
        --sheet etudiants_preferences \
        --dry-run false

Auteur: Atlas Lab
Date: 2026-01-05
"""

import argparse
import sys
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import logging

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values, RealDictCursor
from dotenv import load_dotenv

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class ColabMailleAssigner:
    """Gestionnaire d'attribution des mailles aux étudiants Colab"""
    
    def __init__(self, database_url: str, dry_run: bool = True, max_students_per_maille: int = 1):
        self.database_url = database_url
        self.dry_run = dry_run
        self.max_students_per_maille = max_students_per_maille
        self.conn = None
        self.stats = {
            'rows_read': 0,
            'rows_valid': 0,
            'rows_invalid': 0,
            'students_imported': 0,
            'students_updated': 0,
            'assignments_created': 0,
            'students_without_maille': 0,
            'errors': []
        }
    
    def connect(self):
        """Établit la connexion à la base de données avec fallback automatique db -> localhost"""
        try:
            self.conn = psycopg2.connect(self.database_url)
            logger.info("✓ Connexion à la base de données établie")
        except psycopg2.OperationalError as e:
            # Si erreur "could not translate host name db", essayer localhost
            if 'could not translate host name "db"' in str(e) or 'db' in self.database_url:
                logger.warning("⚠️  Host 'db' inaccessible, tentative avec 'localhost'...")
                fallback_url = self.database_url.replace('@db:', '@localhost:')
                try:
                    self.conn = psycopg2.connect(fallback_url)
                    self.database_url = fallback_url
                    logger.info("✓ Connexion établie via localhost")
                except Exception as e2:
                    logger.error(f"✗ Erreur de connexion (fallback): {e2}")
                    raise
            else:
                logger.error(f"✗ Erreur de connexion à la base de données: {e}")
                raise
        except Exception as e:
            logger.error(f"✗ Erreur de connexion à la base de données: {e}")
            raise
    
    def disconnect(self):
        """Ferme la connexion à la base de données"""
        if self.conn:
            self.conn.close()
            logger.info("✓ Connexion fermée")
    
    def read_excel(self, file_path: str, sheet_name: str) -> pd.DataFrame:
        """Lit le fichier Excel et retourne un DataFrame"""
        logger.info(f"📖 Lecture du fichier: {file_path}")
        logger.info(f"   Feuille: {sheet_name}")
        
        try:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            self.stats['rows_read'] = len(df)
            logger.info(f"✓ {len(df)} lignes lues")
            return df
        except FileNotFoundError:
            logger.error(f"✗ Fichier non trouvé: {file_path}")
            raise
        except Exception as e:
            logger.error(f"✗ Erreur lors de la lecture du fichier: {e}")
            raise
    
    def normalize_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normalise les données du DataFrame"""
        logger.info("🔧 Normalisation des données...")
        
        # Colonnes attendues (noms ADM au lieu de codes)
        expected_columns = [
            'student_id', 'nom', 'prenom', 'telephone', 'email',
            'adm_niveau', 'adm_nom_pref_1', 'adm_nom_pref_2', 
            'adm_nom_pref_3', 'commentaire'
        ]
        
        # Vérifier les colonnes manquantes
        missing_cols = set(expected_columns) - set(df.columns)
        if missing_cols:
            logger.warning(f"⚠ Colonnes manquantes: {missing_cols}")
            for col in missing_cols:
                df[col] = None
        
        # Normalisation
        df = df.copy()
        
        # Strip whitespace
        for col in df.select_dtypes(include=['object']).columns:
            df[col] = df[col].astype(str).str.strip()
            df[col] = df[col].replace('nan', None)
            df[col] = df[col].replace('', None)
        
        # Uppercase pour adm_niveau uniquement
        if 'adm_niveau' in df.columns:
            df['adm_niveau'] = df['adm_niveau'].str.upper() if df['adm_niveau'].dtype == 'object' else df['adm_niveau']
        
        logger.info("✓ Normalisation terminée")
        return df
    
    def validate_row(self, row: pd.Series, row_idx: int) -> Tuple[bool, Optional[str]]:
        """Valide une ligne de données"""
        
        # Vérifications obligatoires
        if pd.isna(row.get('student_id')) or not str(row.get('student_id')).strip():
            return False, f"Ligne {row_idx}: student_id manquant"
        
        if pd.isna(row.get('email')) or not str(row.get('email')).strip():
            return False, f"Ligne {row_idx}: email manquant"
        
        if pd.isna(row.get('nom')) or not str(row.get('nom')).strip():
            return False, f"Ligne {row_idx}: nom manquant"
        
        if pd.isna(row.get('prenom')) or not str(row.get('prenom')).strip():
            return False, f"Ligne {row_idx}: prenom manquant"
        
        # Vérifier adm_niveau
        adm_niveau = str(row.get('adm_niveau', '')).upper()
        if adm_niveau not in ['ADM2', 'ADM3']:
            return False, f"Ligne {row_idx}: adm_niveau doit être 'ADM2' ou 'ADM3', reçu '{adm_niveau}'"
        
        # Vérifier adm_nom_pref_1
        if pd.isna(row.get('adm_nom_pref_1')) or not str(row.get('adm_nom_pref_1')).strip():
            return False, f"Ligne {row_idx}: adm_nom_pref_1 manquant"
        
        return True, None
    
    def validate_adm_codes(self, df: pd.DataFrame) -> pd.DataFrame:
        """Convertit les noms ADM en codes et valide qu'ils existent dans la base de données"""
        logger.info("🔍 Conversion et validation des noms ADM...")
        
        cursor = self.conn.cursor()
        
        # Récupérer mapping nom -> code pour ADM2
        cursor.execute("SELECT adm2_fr, adm2_pcode FROM public.adm2 WHERE adm2_pcode IS NOT NULL AND adm2_fr IS NOT NULL")
        adm2_nom_to_code = {row[0]: row[1] for row in cursor.fetchall()}
        
        # Récupérer mapping nom -> code pour ADM3
        cursor.execute("SELECT adm3_fr, adm3_pcode FROM public.adm3 WHERE adm3_pcode IS NOT NULL AND adm3_fr IS NOT NULL")
        adm3_nom_to_code = {row[0]: row[1] for row in cursor.fetchall()}
        
        logger.info(f"   Noms ADM2 disponibles: {len(adm2_nom_to_code)}")
        logger.info(f"   Noms ADM3 disponibles: {len(adm3_nom_to_code)}")
        
        # Ajouter colonnes pour les codes
        df['adm_code_pref_1'] = None
        df['adm_code_pref_2'] = None
        df['adm_code_pref_3'] = None
        
        # Convertir noms -> codes
        invalid_rows = []
        for idx, row in df.iterrows():
            adm_niveau = str(row['adm_niveau']).upper()
            nom_to_code = adm2_nom_to_code if adm_niveau == 'ADM2' else adm3_nom_to_code
            
            for i in [1, 2, 3]:
                nom_col = f'adm_nom_pref_{i}'
                code_col = f'adm_code_pref_{i}'
                nom = row.get(nom_col)
                
                if pd.notna(nom) and str(nom).strip():
                    nom_str = str(nom).strip()
                    if nom_str in nom_to_code:
                        df.at[idx, code_col] = nom_to_code[nom_str]
                    else:
                        error_msg = f"Ligne {idx}: Nom {adm_niveau} invalide '{nom_str}' dans {nom_col}"
                        self.stats['errors'].append(error_msg)
                        logger.warning(f"⚠ {error_msg}")
                        invalid_rows.append(idx)
                        break
        
        if invalid_rows:
            logger.warning(f"⚠ {len(invalid_rows)} lignes avec noms ADM invalides")
            df = df.drop(invalid_rows)
        else:
            logger.info(f"✓ Tous les noms ADM convertis en codes avec succès")
        
        cursor.close()
        return df
    
    def validate_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Valide l'ensemble du DataFrame"""
        logger.info("✅ Validation des données...")
        
        # Vérifier les doublons sur student_id
        duplicates = df[df.duplicated(subset=['student_id'], keep=False)]
        if not duplicates.empty:
            logger.error(f"✗ Doublons détectés sur student_id:")
            for student_id in duplicates['student_id'].unique():
                logger.error(f"   - {student_id}")
            raise ValueError("Doublons détectés sur student_id")
        
        # Valider chaque ligne
        valid_rows = []
        for idx, row in df.iterrows():
            is_valid, error_msg = self.validate_row(row, idx)
            if is_valid:
                valid_rows.append(idx)
            else:
                self.stats['errors'].append(error_msg)
                self.stats['rows_invalid'] += 1
                logger.warning(f"⚠ {error_msg}")
        
        df_valid = df.loc[valid_rows].copy()
        self.stats['rows_valid'] = len(df_valid)
        
        # Valider les codes ADM
        df_valid = self.validate_adm_codes(df_valid)
        self.stats['rows_valid'] = len(df_valid)
        
        if df_valid.empty:
            logger.error("✗ Aucune ligne valide après validation")
            raise ValueError("Aucune ligne valide")
        
        logger.info(f"✓ {len(df_valid)} lignes valides sur {len(df)}")
        return df_valid
    
    def upsert_student_prefs(self, df: pd.DataFrame):
        """Insert ou update les préférences étudiants dans colab_student_prefs"""
        logger.info("💾 Import des préférences étudiants...")
        
        cursor = self.conn.cursor()
        
        upsert_query = """
            INSERT INTO atlas.colab_student_prefs (
                student_id, nom, prenom, telephone, email,
                adm_niveau, adm_code_pref_1, adm_code_pref_2, adm_code_pref_3,
                commentaire
            ) VALUES %s
            ON CONFLICT (student_id) DO UPDATE SET
                nom = EXCLUDED.nom,
                prenom = EXCLUDED.prenom,
                telephone = EXCLUDED.telephone,
                email = EXCLUDED.email,
                adm_niveau = EXCLUDED.adm_niveau,
                adm_code_pref_1 = EXCLUDED.adm_code_pref_1,
                adm_code_pref_2 = EXCLUDED.adm_code_pref_2,
                adm_code_pref_3 = EXCLUDED.adm_code_pref_3,
                commentaire = EXCLUDED.commentaire,
                updated_at = NOW()
        """
        
        # Préparer les données
        values = []
        for _, row in df.iterrows():
            values.append((
                str(row['student_id']),
                str(row['nom']),
                str(row['prenom']),
                str(row.get('telephone')) if pd.notna(row.get('telephone')) else None,
                str(row['email']),
                str(row['adm_niveau']),
                str(row['adm_code_pref_1']),
                str(row.get('adm_code_pref_2')) if pd.notna(row.get('adm_code_pref_2')) else None,
                str(row.get('adm_code_pref_3')) if pd.notna(row.get('adm_code_pref_3')) else None,
                str(row.get('commentaire')) if pd.notna(row.get('commentaire')) else None
            ))
        
        if self.dry_run:
            logger.info(f"   [DRY-RUN] Upsert de {len(values)} étudiants")
            self.stats['students_imported'] = len(values)
        else:
            execute_values(cursor, upsert_query, values)
            self.conn.commit()
            self.stats['students_imported'] = len(values)
            logger.info(f"✓ {len(values)} étudiants importés/mis à jour")
        
        cursor.close()
    
    def get_available_mailles(self, adm_code: str, adm_niveau: str) -> List[Dict]:
        """Récupère les mailles disponibles dans une zone ADM"""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        
        if adm_niveau == 'ADM2':
            # Pour ADM2, jointure spatiale avec public.adm2
            query = """
                SELECT 
                    m.id,
                    m.code,
                    COUNT(a.student_id) as nb_students
                FROM atlas.mailles m
                LEFT JOIN atlas.colab_maille_assignments a ON a.maille_id = m.id
                WHERE EXISTS (
                    SELECT 1 FROM public.adm2 adm2
                    WHERE adm2.adm2_pcode = %s
                    AND ST_Intersects(m.geom, ST_Transform(adm2.geom, 25231))
                )
                GROUP BY m.id, m.code
                HAVING COUNT(a.student_id) < %s
                ORDER BY COUNT(a.student_id), RANDOM()
            """
            cursor.execute(query, (adm_code, self.max_students_per_maille))
        else:
            # Pour ADM3, jointure spatiale avec public.adm3
            query = """
                SELECT 
                    m.id,
                    m.code,
                    COUNT(a.student_id) as nb_students
                FROM atlas.mailles m
                LEFT JOIN atlas.colab_maille_assignments a ON a.maille_id = m.id
                WHERE EXISTS (
                    SELECT 1 FROM public.adm3 adm3
                    WHERE adm3.adm3_pcode = %s
                    AND ST_Intersects(m.geom, ST_Transform(adm3.geom, 25231))
                )
                GROUP BY m.id, m.code
                HAVING COUNT(a.student_id) < %s
                ORDER BY COUNT(a.student_id), RANDOM()
            """
            cursor.execute(query, (adm_code, self.max_students_per_maille))
        
        mailles = cursor.fetchall()
        cursor.close()
        return mailles
    
    def assign_mailles(self):
        """Algorithme d'attribution des mailles aux étudiants"""
        logger.info("🎯 Attribution des mailles aux étudiants...")
        
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        
        # Récupérer les étudiants sans attribution
        cursor.execute("""
            SELECT 
                s.student_id,
                s.nom,
                s.prenom,
                s.adm_niveau,
                s.adm_code_pref_1,
                s.adm_code_pref_2,
                s.adm_code_pref_3
            FROM atlas.colab_student_prefs s
            LEFT JOIN atlas.colab_maille_assignments a ON a.student_id = s.student_id
            WHERE a.assignment_id IS NULL
            ORDER BY s.created_at
        """)
        
        students = cursor.fetchall()
        logger.info(f"   {len(students)} étudiants à traiter")
        
        assignments = []
        students_without_maille = []
        
        for student in students:
            student_id = student['student_id']
            adm_niveau = student['adm_niveau']
            
            # Essayer les préférences dans l'ordre
            maille_assigned = None
            pref_rank_used = None
            adm_code_used = None
            
            for rank, pref_col in enumerate([
                student['adm_code_pref_1'],
                student['adm_code_pref_2'],
                student['adm_code_pref_3']
            ], start=1):
                if not pref_col:
                    continue
                
                mailles = self.get_available_mailles(pref_col, adm_niveau)
                
                if mailles:
                    maille_assigned = mailles[0]
                    pref_rank_used = rank
                    adm_code_used = pref_col
                    logger.info(f"   ✓ {student['nom']} {student['prenom']}: maille {maille_assigned['code']} (pref {rank})")
                    break
            
            if maille_assigned:
                assignments.append({
                    'student_id': student_id,
                    'maille_id': maille_assigned['id'],
                    'adm_code_used': adm_code_used,
                    'pref_rank_used': pref_rank_used
                })
            else:
                students_without_maille.append(student_id)
                logger.warning(f"   ⚠ {student['nom']} {student['prenom']}: aucune maille disponible")
        
        # Insérer les attributions
        if assignments:
            if self.dry_run:
                logger.info(f"   [DRY-RUN] Création de {len(assignments)} attributions")
                self.stats['assignments_created'] = len(assignments)
            else:
                insert_query = """
                    INSERT INTO atlas.colab_maille_assignments (
                        student_id, maille_id, adm_code_used, pref_rank_used
                    ) VALUES %s
                """
                values = [
                    (a['student_id'], a['maille_id'], a['adm_code_used'], a['pref_rank_used'])
                    for a in assignments
                ]
                execute_values(cursor, insert_query, values)
                self.conn.commit()
                self.stats['assignments_created'] = len(assignments)
                logger.info(f"✓ {len(assignments)} attributions créées")
        
        self.stats['students_without_maille'] = len(students_without_maille)
        
        if students_without_maille:
            logger.warning(f"⚠ {len(students_without_maille)} étudiants sans maille:")
            for sid in students_without_maille:
                logger.warning(f"   - {sid}")
        
        cursor.close()
    
    def print_summary(self):
        """Affiche le résumé de l'exécution"""
        logger.info("\n" + "="*70)
        logger.info("📊 RÉSUMÉ DE L'EXÉCUTION")
        logger.info("="*70)
        logger.info(f"Mode: {'DRY-RUN (simulation)' if self.dry_run else 'PRODUCTION'}")
        logger.info(f"Lignes lues: {self.stats['rows_read']}")
        logger.info(f"Lignes valides: {self.stats['rows_valid']}")
        logger.info(f"Lignes invalides: {self.stats['rows_invalid']}")
        logger.info(f"Étudiants importés/mis à jour: {self.stats['students_imported']}")
        logger.info(f"Attributions créées: {self.stats['assignments_created']}")
        logger.info(f"Étudiants sans maille: {self.stats['students_without_maille']}")
        
        if self.stats['errors']:
            logger.info(f"\n⚠ Erreurs ({len(self.stats['errors'])}):")
            for error in self.stats['errors'][:10]:
                logger.info(f"   - {error}")
            if len(self.stats['errors']) > 10:
                logger.info(f"   ... et {len(self.stats['errors']) - 10} autres erreurs")
        
        logger.info("="*70 + "\n")
    
    def run(self, input_file: str, sheet_name: str):
        """Exécute le pipeline complet"""
        try:
            # 1. Connexion
            self.connect()
            
            # 2. Lecture Excel
            df = self.read_excel(input_file, sheet_name)
            
            # 3. Normalisation
            df = self.normalize_dataframe(df)
            
            # 4. Validation
            df = self.validate_dataframe(df)
            
            # 5. Upsert préférences
            self.upsert_student_prefs(df)
            
            # 6. Attribution des mailles
            self.assign_mailles()
            
            # 7. Résumé
            self.print_summary()
            
            if not self.dry_run:
                logger.info("✅ Traitement terminé avec succès!")
            else:
                logger.info("✅ Simulation terminée! Relancez avec --dry-run false pour appliquer.")
            
        except Exception as e:
            logger.error(f"❌ Erreur fatale: {e}")
            if self.conn:
                self.conn.rollback()
            raise
        finally:
            self.disconnect()


def main():
    """Point d'entrée principal"""
    parser = argparse.ArgumentParser(
        description="Attribution automatique des mailles Atlas Colab",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples:
  # Simulation (dry-run)
  poetry run python scripts/colab_assign_mailles_from_excel.py \\
      --input data/colab/etudiants_colab.xlsx \\
      --dry-run true

  # Exécution réelle
  poetry run python scripts/colab_assign_mailles_from_excel.py \\
      --input data/colab/etudiants_colab.xlsx \\
      --dry-run false
        """
    )
    
    parser.add_argument(
        '--input',
        required=True,
        help='Chemin du fichier Excel d\'entrée'
    )
    
    parser.add_argument(
        '--sheet',
        default='etudiants_preferences',
        help='Nom de la feuille Excel (défaut: etudiants_preferences)'
    )
    
    parser.add_argument(
        '--dry-run',
        type=lambda x: x.lower() in ['true', '1', 'yes', 'oui'],
        default=True,
        help='Mode simulation (true/false, défaut: true)'
    )
    
    parser.add_argument(
        '--max-students-per-maille',
        type=int,
        default=1,
        help='Nombre max d\'étudiants par maille (défaut: 1)'
    )
    
    args = parser.parse_args()
    
    # Charger les variables d'environnement
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        logger.error("❌ Variable DATABASE_URL non définie")
        sys.exit(1)
    
    # Vérifier que le fichier existe
    if not Path(args.input).exists():
        logger.error(f"❌ Fichier non trouvé: {args.input}")
        sys.exit(1)
    
    # Exécuter
    assigner = ColabMailleAssigner(
        database_url=database_url,
        dry_run=args.dry_run,
        max_students_per_maille=args.max_students_per_maille
    )
    
    assigner.run(args.input, args.sheet)


if __name__ == '__main__':
    main()
