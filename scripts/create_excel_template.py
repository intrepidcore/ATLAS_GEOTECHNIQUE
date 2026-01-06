#!/usr/bin/env python3
"""
Crée un template Excel pour les préférences étudiants Colab
Avec menus déroulants pour les codes ADM
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation

def get_adm_codes_from_db():
    """Récupère les codes ADM depuis la base de données"""
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("⚠️  DATABASE_URL non définie, utilisation de codes par défaut")
        return []
    
    # Fallback db -> localhost si nécessaire
    if '@db:' in database_url:
        database_url_localhost = database_url.replace('@db:', '@localhost:')
    else:
        database_url_localhost = database_url
    
    try:
        conn = psycopg2.connect(database_url_localhost)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Récupérer ADM2 (nom comme clé principale)
        cursor.execute("""
            SELECT adm2_fr as nom, adm2_pcode as code, 'ADM2' as niveau
            FROM public.adm2
            WHERE adm2_pcode IS NOT NULL AND adm2_fr IS NOT NULL
            ORDER BY adm2_fr
        """)
        adm2_list = cursor.fetchall()
        
        # Récupérer ADM3 (nom comme clé principale)
        cursor.execute("""
            SELECT adm3_fr as nom, adm3_pcode as code, 'ADM3' as niveau
            FROM public.adm3
            WHERE adm3_pcode IS NOT NULL AND adm3_fr IS NOT NULL
            ORDER BY adm3_fr
        """)
        adm3_list = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        all_adm = list(adm2_list) + list(adm3_list)
        print(f"✓ {len(adm2_list)} codes ADM2 + {len(adm3_list)} codes ADM3 récupérés")
        return all_adm
        
    except Exception as e:
        print(f"⚠️  Erreur connexion DB: {e}")
        print("   Utilisation de codes par défaut")
        return []

def create_template():
    """Crée le template Excel avec menus déroulants"""
    
    # Récupérer les codes ADM depuis la DB
    adm_codes = get_adm_codes_from_db()
    
    # Créer le workbook
    wb = Workbook()
    
    # === Feuille 1: ADM_CODES (cachée) ===
    ws_adm = wb.active
    ws_adm.title = "ADM_CODES"
    
    # En-têtes
    headers_adm = ['nom', 'code', 'niveau']
    ws_adm.append(headers_adm)
    
    # Style des en-têtes
    for cell in ws_adm[1]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        cell.font = Font(bold=True, color="FFFFFF")
        cell.alignment = Alignment(horizontal="center")
    
    # Remplir les codes ADM
    if adm_codes:
        for adm in adm_codes:
            ws_adm.append([adm['nom'], adm['code'], adm['niveau']])
    else:
        # Codes par défaut si pas de connexion DB
        default_codes = [
            ['Agoe-Nyive', 'TG0309', 'ADM2'],
            ['Agou', 'TG0403', 'ADM2'],
            ['Akebou', 'TG0410', 'ADM2'],
            ['Adetikope', 'TG030901', 'ADM3'],
            ['Abobo', 'TG030801', 'ADM3'],
            ['Adeta', 'TG040701', 'ADM3'],
        ]
        for code_data in default_codes:
            ws_adm.append(code_data)
    
    # Ajuster largeur colonnes
    ws_adm.column_dimensions['A'].width = 30  # nom
    ws_adm.column_dimensions['B'].width = 15  # code
    ws_adm.column_dimensions['C'].width = 10  # niveau
    
    # Cacher la feuille
    ws_adm.sheet_state = 'hidden'
    
    # === Feuille 2: etudiants_preferences ===
    ws_main = wb.create_sheet("etudiants_preferences")
    
    # En-têtes
    headers_main = [
        'student_id', 'nom', 'prenom', 'telephone', 'email',
        'adm_niveau', 'adm_nom_pref_1', 'adm_nom_pref_2', 'adm_nom_pref_3',
        'commentaire'
    ]
    ws_main.append(headers_main)
    
    # Style des en-têtes
    for cell in ws_main[1]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        cell.font = Font(bold=True, color="FFFFFF")
        cell.alignment = Alignment(horizontal="center")
    
    # Données d'exemple
    examples = [
        ['ETU2025001', 'KOUASSI', 'Jean', '+228 90 12 34 56', 'jean.kouassi@example.tg',
         'ADM2', 'Agoe-Nyive', 'Agou', 'Akebou', 'Préfère zone côtière'],
        ['ETU2025002', 'AGBEKO', 'Marie', '+228 91 23 45 67', 'marie.agbeko@example.tg',
         'ADM3', 'Adetikope', 'Abobo', '', 'Originaire de Lomé'],
        ['ETU2025003', 'MENSAH', 'Paul', '+228 92 34 56 78', 'paul.mensah@example.tg',
         'ADM2', 'Agou', 'Akebou', 'Agoe-Nyive', ''],
    ]
    
    for example in examples:
        ws_main.append(example)
    
    # Ajuster largeur colonnes
    ws_main.column_dimensions['A'].width = 15  # student_id
    ws_main.column_dimensions['B'].width = 15  # nom
    ws_main.column_dimensions['C'].width = 15  # prenom
    ws_main.column_dimensions['D'].width = 18  # telephone
    ws_main.column_dimensions['E'].width = 30  # email
    ws_main.column_dimensions['F'].width = 12  # adm_niveau
    ws_main.column_dimensions['G'].width = 25  # adm_nom_pref_1
    ws_main.column_dimensions['H'].width = 25  # adm_nom_pref_2
    ws_main.column_dimensions['I'].width = 25  # adm_nom_pref_3
    ws_main.column_dimensions['J'].width = 25  # commentaire
    
    # === Data Validation ===
    
    # 1. Validation pour adm_niveau (colonne F)
    dv_niveau = DataValidation(type="list", formula1='"ADM2,ADM3"', allow_blank=False)
    dv_niveau.error = 'Veuillez choisir ADM2 ou ADM3'
    dv_niveau.errorTitle = 'Valeur invalide'
    ws_main.add_data_validation(dv_niveau)
    dv_niveau.add('F2:F1000')  # Appliquer sur 1000 lignes
    
    # 2. Validation pour les noms ADM (colonnes G, H, I)
    # Calculer la plage de la feuille ADM_CODES (colonne A = noms)
    nb_codes = len(adm_codes) if adm_codes else 6
    adm_range = f"ADM_CODES!$A$2:$A${nb_codes + 1}"
    
    dv_nom = DataValidation(type="list", formula1=adm_range, allow_blank=True)
    dv_nom.error = 'Veuillez choisir un nom ADM valide dans la liste'
    dv_nom.errorTitle = 'Nom ADM invalide'
    dv_nom.prompt = 'Sélectionnez un nom de préfecture/commune dans la liste déroulante'
    dv_nom.promptTitle = 'Nom ADM'
    ws_main.add_data_validation(dv_nom)
    dv_nom.add('G2:I1000')  # Colonnes pref_1, pref_2, pref_3
    
    # Créer le répertoire si nécessaire
    output_dir = Path(__file__).parent.parent / 'data' / 'colab'
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_file = output_dir / 'TEMPLATE_etudiants_preferences.xlsx'
    
    # Sauvegarder
    wb.save(output_file)
    
    print(f"✓ Template créé: {output_file}")
    print(f"  Feuille principale: etudiants_preferences (3 exemples)")
    print(f"  Feuille cachée: ADM_CODES ({nb_codes} codes)")
    print(f"  ✓ Menus déroulants configurés sur adm_niveau et adm_code_pref_*")
    print(f"  ✓ L'utilisateur ne doit jamais taper les codes à la main")

if __name__ == '__main__':
    create_template()
