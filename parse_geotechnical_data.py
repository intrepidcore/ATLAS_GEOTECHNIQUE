"""
Script de parsing de données géotechniques brutes vers format Atlas V3
Génère un fichier atlas_import_example.xlsx conforme aux spécifications
"""

import pandas as pd
import openpyxl
from openpyxl import Workbook
from openpyxl.utils.dataframe import dataframe_to_rows
import re
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import numpy as np

# Configuration des codes de sites normalisés
SITE_CODES = {
    'assahoun': 'ASSA-S1',
    'assahoum': 'ASSA-S1',
    'badja': 'BADJA-S1',
    'kévé': 'KEVE-S1',
    'keve': 'KEVE-S1'
}

SITE_LOCALITES = {
    'ASSA-S1': 'Assahoun',
    'BADJA-S1': 'Badja',
    'KEVE-S1': 'Kévé'
}

# Profondeurs standard
DEPTHS = [1.0, 1.5, 2.0]

class CorrectionReport:
    """Classe pour suivre les corrections appliquées"""
    def __init__(self):
        self.corrections = []
        self.warnings = []
        self.ignored = []

    def add_correction(self, msg: str):
        self.corrections.append(msg)

    def add_warning(self, msg: str):
        self.warnings.append(msg)

    def add_ignored(self, msg: str):
        self.ignored.append(msg)

    def to_markdown(self) -> str:
        md = "# Rapport de Corrections - Import Géotechnique Atlas\n\n"
        md += f"**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"

        md += "## Corrections Appliquées\n\n"
        if self.corrections:
            for c in self.corrections:
                md += f"- {c}\n"
        else:
            md += "*Aucune correction appliquée*\n"

        md += "\n## Avertissements\n\n"
        if self.warnings:
            for w in self.warnings:
                md += f"- ⚠️ {w}\n"
        else:
            md += "*Aucun avertissement*\n"

        md += "\n## Lignes Ignorées\n\n"
        if self.ignored:
            for i in self.ignored:
                md += f"- {i}\n"
        else:
            md += "*Aucune ligne ignorée*\n"

        return md

report = CorrectionReport()

def normalize_site_code(localite: str) -> Optional[str]:
    """Normalise le nom de localité vers code_site standard"""
    localite_clean = localite.lower().strip()
    for key, code in SITE_CODES.items():
        if key in localite_clean:
            return code
    return None

def normalize_decimal(value: str) -> Optional[float]:
    """Convertit virgule en point et retourne float"""
    if pd.isna(value) or value == '':
        return None
    try:
        if isinstance(value, (int, float)):
            return float(value)
        value_str = str(value).strip().replace(',', '.').replace(' ', '')
        return float(value_str)
    except:
        return None

def clamp_percentage(value: float, context: str = "") -> float:
    """Clamp une valeur dans [0, 100] avec corrections automatiques"""
    if pd.isna(value):
        return None

    original = value

    # Correction des valeurs aberrantes (ex: 7440 -> 74.40)
    if value > 100:
        # Diviser par 10 jusqu'à rentrer dans [0, 100]
        while value > 100 and value < 10000:
            value = value / 10

        if value > 100:  # Still too high, clamp
            value = 100.0

        report.add_correction(f"Valeur {original} corrigée en {value:.2f} {context}")

    if value < 0:
        report.add_correction(f"Valeur négative {value} corrigée en 0 {context}")
        value = 0.0

    return round(value, 2)

def make_monotonic(passings: List[float], sieves: List[float]) -> List[float]:
    """Rend une courbe granulo monotone (running max quand sieve diminue)"""
    if not passings or not sieves:
        return passings

    # Créer des paires (sieve, passing) et trier par sieve décroissant
    pairs = list(zip(sieves, passings))
    pairs.sort(key=lambda x: x[0], reverse=True)

    # Appliquer running maximum
    monotonic = []
    current_max = 0
    for sieve, passing in pairs:
        if pd.notna(passing):
            current_max = max(current_max, passing)
            monotonic.append((sieve, current_max))
        else:
            monotonic.append((sieve, None))

    # Re-trier dans l'ordre original
    result_dict = dict(monotonic)
    result = [result_dict.get(s) for s in sieves]

    return result

def parse_granulo_table(lines: List[str], method: str) -> Dict[str, Dict[float, float]]:
    """
    Parse un tableau de granulométrie (AGT ou AGS)
    Retourne: {site_code@depth: {sieve_mm: passing_pct}}
    """
    granulo_data = {}
    current_site = None
    header_parsed = False
    depth_columns = []

    for line in lines:
        line = line.strip()
        if not line or line.startswith('---') or line.startswith('==='):
            continue

        # Détecter le site dans le titre
        for localite_key in SITE_CODES.keys():
            if localite_key in line.lower():
                current_site = SITE_CODES[localite_key]
                break

        # Parser les lignes de données (format: |sieve|val1|val2|val3|)
        if '|' in line:
            cells = [c.strip() for c in line.split('|') if c.strip()]

            if not cells:
                continue

            # Ligne header (contient "Passant" ou "profondeur")
            if any(keyword in cells[0].lower() for keyword in ['passant', 'profondeur', 'ouverture']):
                depth_columns = []
                for cell in cells[1:]:
                    # Extraire profondeur (ex: "1m", "1,5m", "2m")
                    depth_match = re.search(r'(\d+[,.]?\d*)\s*m', cell)
                    if depth_match:
                        depth_str = depth_match.group(1).replace(',', '.')
                        depth = float(depth_str)
                        depth_columns.append(depth)
                header_parsed = True
                continue

            # Ligne de données (commence par un nombre = sieve_mm)
            if header_parsed and cells:
                sieve_str = cells[0]
                sieve = normalize_decimal(sieve_str)

                if sieve is not None and sieve > 0:
                    # Parser les valeurs de passants pour chaque profondeur
                    for idx, depth in enumerate(depth_columns):
                        if idx + 1 < len(cells):
                            passing_str = cells[idx + 1]
                            passing = normalize_decimal(passing_str)

                            if passing is not None and current_site:
                                # Corriger et clamper
                                passing = clamp_percentage(
                                    passing,
                                    f"({current_site}@{depth}, {method}, {sieve}mm)"
                                )

                                # Créer la clé série
                                serie_key = f"{current_site}@{depth}"
                                if serie_key not in granulo_data:
                                    granulo_data[serie_key] = {}

                                granulo_data[serie_key][sieve] = passing

    # Appliquer monotonicité pour chaque série
    for serie_key, sieve_dict in granulo_data.items():
        sieves = sorted(sieve_dict.keys(), reverse=True)
        passings = [sieve_dict[s] for s in sieves]
        monotonic_passings = make_monotonic(passings, sieves)

        for sieve, passing in zip(sieves, monotonic_passings):
            if passing is not None:
                granulo_data[serie_key][sieve] = passing

    return granulo_data

def parse_atterberg_summary(text: str) -> pd.DataFrame:
    """Parse le tableau résumé des limites d'Atterberg"""
    rows = []
    lines = text.split('\n')

    for line in lines:
        if '|' not in line:
            continue

        cells = [c.strip() for c in line.split('|') if c.strip()]

        if len(cells) < 5:
            continue

        # Ignorer headers et moyennes
        if any(kw in line.lower() for kw in ['référence', 'localité', 'moyenne', 'wl', 'wp']):
            continue

        try:
            # Format: | Ref | Localité/Cantons | profondeur | Wl | Wp | Ip |
            site_raw = cells[1] if len(cells) > 1 else ''
            site_code = normalize_site_code(site_raw)

            if site_code:
                depth = normalize_decimal(cells[2]) if len(cells) > 2 else None
                wl = normalize_decimal(cells[3]) if len(cells) > 3 else None
                wp = normalize_decimal(cells[4]) if len(cells) > 4 else None

                if depth is not None and (wl is not None or wp is not None):
                    # Vérifier cohérence WL >= WP
                    if wl is not None and wp is not None:
                        if wl < wp:
                            report.add_correction(f"Atterberg {site_code}@{depth}: WL={wl} < WP={wp}, valeurs inversées")
                            wl, wp = wp, wl

                    rows.append({
                        'code_site': site_code,
                        'depth_m': depth,
                        'wl': clamp_percentage(wl, f"WL {site_code}@{depth}") if wl else None,
                        'wp': clamp_percentage(wp, f"WP {site_code}@{depth}") if wp else None
                    })
        except Exception as e:
            report.add_warning(f"Erreur parsing Atterberg ligne: {line[:50]}... ({e})")

    return pd.DataFrame(rows)

def parse_vbs_table(text: str) -> pd.DataFrame:
    """Parse le tableau VBS (Bleu de Méthylène)"""
    rows = []
    lines = text.split('\n')

    for line in lines:
        if '|' not in line:
            continue

        cells = [c.strip() for c in line.split('|') if c.strip()]

        if len(cells) < 3:
            continue

        # Ignorer headers et moyennes
        if any(kw in line.lower() for kw in ['localité', 'moyenne', 'vbs', 'caractéristique']):
            continue

        try:
            site_raw = cells[0]
            site_code = normalize_site_code(site_raw)

            if site_code:
                depth = normalize_decimal(cells[1]) if len(cells) > 1 else None
                vbs = normalize_decimal(cells[2]) if len(cells) > 2 else None
                commentaire = cells[3] if len(cells) > 3 else None

                if depth is not None and vbs is not None:
                    # VBS dans [0, 20]
                    vbs_clamped = max(0, min(20, vbs))
                    if vbs != vbs_clamped:
                        report.add_correction(f"VBS {site_code}@{depth}: {vbs} -> {vbs_clamped}")

                    rows.append({
                        'code_site': site_code,
                        'depth_m': depth,
                        'vbs': vbs_clamped,
                        'commentaire': commentaire
                    })
        except Exception as e:
            report.add_warning(f"Erreur parsing VBS ligne: {line[:50]}... ({e})")

    return pd.DataFrame(rows)

def parse_density_table(text: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Parse le tableau de densité
    Retourne: (echantillons_data, densite_data)
    """
    echant_rows = []
    dens_rows = []
    lines = text.split('\n')

    for line in lines:
        if '|' not in line:
            continue

        cells = [c.strip() for c in line.split('|') if c.strip()]

        if len(cells) < 3:
            continue

        # Ignorer headers
        if any(kw in line.lower() for kw in ['localité', 'densité', 'profondeur']):
            continue

        try:
            site_raw = cells[0]
            site_code = normalize_site_code(site_raw)

            if site_code:
                depth = normalize_decimal(cells[1]) if len(cells) > 1 else None
                rho_d_app = normalize_decimal(cells[2]) if len(cells) > 2 else None
                rho_s_abs = normalize_decimal(cells[3]) if len(cells) > 3 else None

                if depth is not None:
                    # Pour echantillons: rho_s_gcm3
                    if rho_s_abs is not None:
                        echant_rows.append({
                            'code_site': site_code,
                            'depth_m': depth,
                            'rho_s_gcm3': rho_s_abs
                        })

                    # Pour densite: les deux valeurs
                    if rho_d_app is not None or rho_s_abs is not None:
                        dens_rows.append({
                            'code_site': site_code,
                            'depth_m': depth,
                            'rho_d_app': rho_d_app,
                            'rho_s_abs': rho_s_abs,
                            'note': None
                        })
        except Exception as e:
            report.add_warning(f"Erreur parsing densité ligne: {line[:50]}... ({e})")

    return pd.DataFrame(echant_rows), pd.DataFrame(dens_rows)

def parse_water_content_table(text: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Parse le tableau de teneur en eau
    Retourne: (echantillons_data, teneur_eau_data)
    """
    echant_rows = []
    teneur_rows = []
    lines = text.split('\n')

    for line in lines:
        if '|' not in line:
            continue

        cells = [c.strip() for c in line.split('|') if c.strip()]

        if len(cells) < 4:
            continue

        # Ignorer headers et moyennes
        if any(kw in line.lower() for kw in ['localité', 'moyenne', 'teneur', 'profondeur']):
            continue

        try:
            site_raw = cells[0]
            site_code = normalize_site_code(site_raw)

            if site_code:
                depth = normalize_decimal(cells[1]) if len(cells) > 1 else None
                w = normalize_decimal(cells[2]) if len(cells) > 2 else None
                wi = normalize_decimal(cells[3]) if len(cells) > 3 else None
                caracteristique = cells[4] if len(cells) > 4 else None

                if depth is not None and w is not None:
                    # Pour echantillons: water_content_w
                    w_clamped = clamp_percentage(w, f"W {site_code}@{depth}")
                    echant_rows.append({
                        'code_site': site_code,
                        'depth_m': depth,
                        'water_content_w': w_clamped
                    })

                    # Pour teneur_eau
                    teneur_rows.append({
                        'code_site': site_code,
                        'depth_m': depth,
                        'w': w_clamped,
                        'wi': wi,
                        'note': caracteristique
                    })
        except Exception as e:
            report.add_warning(f"Erreur parsing teneur eau ligne: {line[:50]}... ({e})")

    return pd.DataFrame(echant_rows), pd.DataFrame(teneur_rows)

def parse_classification_table(text: str) -> pd.DataFrame:
    """Parse le tableau de classification"""
    rows = []
    lines = text.split('\n')

    for line in lines:
        if '|' not in line:
            continue

        cells = [c.strip() for c in line.split('|') if c.strip()]

        if len(cells) < 4:
            continue

        # Ignorer headers
        if any(kw in line.lower() for kw in ['localité', 'classification', 'profondeur']):
            continue

        try:
            site_raw = cells[0]
            site_code = normalize_site_code(site_raw)

            if site_code:
                depth = normalize_decimal(cells[1]) if len(cells) > 1 else None
                hrb = cells[2] if len(cells) > 2 else None
                unified = cells[3] if len(cells) > 3 else None
                bm = cells[4] if len(cells) > 4 else None

                if depth is not None:
                    rows.append({
                        'code_site': site_code,
                        'depth_m': depth,
                        'hrb': hrb,
                        'unified': unified,
                        'bm': bm,
                        'note': None
                    })
        except Exception as e:
            report.add_warning(f"Erreur parsing classification ligne: {line[:50]}... ({e})")

    return pd.DataFrame(rows)

def main():
    """Fonction principale"""

    # Créer workbook Excel
    wb = Workbook()
    wb.remove(wb.active)  # Supprimer feuille par défaut

    # Date du jour
    today = datetime.now().strftime('%Y-%m-%d')

    # ======================
    # 1. FEUILLE SONDAGES
    # ======================
    print("📍 Création feuille: sondages")
    sondages_data = []
    for code, localite in SITE_LOCALITES.items():
        sondages_data.append({
            'code_site': code,
            'localite': localite,
            'date': today,
            'adm3': None,
            'adm2': None,
            'lat': None,
            'lon': None,
            'source': 'Import données brutes 2025'
        })

    df_sondages = pd.DataFrame(sondages_data)
    ws_sondages = wb.create_sheet('sondages')
    for r in dataframe_to_rows(df_sondages, index=False, header=True):
        ws_sondages.append(r)

    print(f"   ✅ {len(df_sondages)} sondages créés")

    # ======================
    # 2. FEUILLE ECHANTILLONS
    # ======================
    print("📍 Création feuille: echantillons")
    echantillons_data = []

    # Créer échantillons pour toutes les combinaisons site × profondeur
    for code in SITE_LOCALITES.keys():
        for depth in DEPTHS:
            echantillons_data.append({
                'code_site': code,
                'depth_m': depth,
                'date': today,
                'laboratory': 'Labo Atlas',
                'rho_s_gcm3': None,
                'water_content_w': None,
                'is_index': None,
                'commentaire': None
            })

    df_echantillons = pd.DataFrame(echantillons_data)

    # Parser densités et teneur en eau (mise à jour de echantillons)
    raw_data = open(__file__.replace('.py', '_raw.txt'), 'r', encoding='utf-8').read()

    # ... (on va remplir avec les données parsées)

    ws_echantillons = wb.create_sheet('echantillons')
    for r in dataframe_to_rows(df_echantillons, index=False, header=True):
        ws_echantillons.append(r)

    print(f"   ✅ {len(df_echantillons)} échantillons créés")

    # ======================
    # 3. FEUILLE ATTERBERG
    # ======================
    print("📍 Création feuille: atterberg")

    atterberg_text = """
    Kévé 1 53 23 30
    Kévé 1.5 48 21 27
    Kévé 2 51 22 29
    Assahoum 1 24 12 12
    Assahoum 1.5 41 19 22
    Assahoum 2 42 22 20
    Badja 1 49 18 31
    Badja 1.5 53 18 35
    Badja 2 51 17 34
    """

    df_atterberg = parse_atterberg_summary(atterberg_text)

    ws_atterberg = wb.create_sheet('atterberg')
    for r in dataframe_to_rows(df_atterberg, index=False, header=True):
        ws_atterberg.append(r)

    print(f"   ✅ {len(df_atterberg)} essais Atterberg créés")

    # ======================
    # 4. FEUILLE VBS
    # ======================
    print("📍 Création feuille: vbs")

    vbs_text = """
    Kévé 1 4.02 Sol limoneux argileux
    Kévé 1.5 3.61 Sol limoneux argileux
    Kévé 2 1.22 Sol limoneux
    Assahoum 1 1.83 Sol limoneux argileux
    Assahoum 1.5 3.82 Sol limoneux argileux
    Assahoum 2 2.64 Sol limoneux argileux
    Badja 1 4.6 Sol limoneux argileux
    Badja 1.5 4.03 Sol limoneux argileux
    Badja 2 5.03 Sol limoneux argileux
    """

    df_vbs = parse_vbs_table(vbs_text)

    ws_vbs = wb.create_sheet('vbs')
    for r in dataframe_to_rows(df_vbs, index=False, header=True):
        ws_vbs.append(r)

    print(f"   ✅ {len(df_vbs)} essais VBS créés")

    # ======================
    # 5. FEUILLE PROCTOR (vide)
    # ======================
    print("📍 Création feuille: proctor (vide)")

    df_proctor = pd.DataFrame(columns=['code_site', 'depth_m', 'proctor_type', 'gamma_d_max', 'w_opt'])

    ws_proctor = wb.create_sheet('proctor')
    for r in dataframe_to_rows(df_proctor, index=False, header=True):
        ws_proctor.append(r)

    print(f"   ✅ Feuille proctor créée (vide)")

    # ======================
    # 6-7. FEUILLES GRANULO (WIDE)
    # ======================
    # TODO: Parser les tableaux AGT et AGS
    # Pour l'instant, créer les feuilles vides avec headers

    print("📍 Création feuille: granulo_tamisage_large")
    ws_tamisage = wb.create_sheet('granulo_tamisage_large')
    ws_tamisage.append(['sieve_mm', 'ASSA-S1@1', 'ASSA-S1@1.5', 'ASSA-S1@2',
                        'BADJA-S1@1', 'BADJA-S1@1.5', 'BADJA-S1@2',
                        'KEVE-S1@1', 'KEVE-S1@1.5', 'KEVE-S1@2'])

    print("📍 Création feuille: granulo_sedimento_large")
    ws_sedimento = wb.create_sheet('granulo_sedimento_large')
    ws_sedimento.append(['sieve_mm', 'ASSA-S1@1', 'ASSA-S1@1.5', 'ASSA-S1@2',
                         'BADJA-S1@1', 'BADJA-S1@1.5', 'BADJA-S1@2',
                         'KEVE-S1@1', 'KEVE-S1@1.5', 'KEVE-S1@2'])

    # ======================
    # 8-10. FEUILLES PLACEHOLDERS
    # ======================
    print("📍 Création feuilles placeholders")

    # densite
    df_densite = pd.DataFrame(columns=['code_site', 'depth_m', 'rho_d_app', 'rho_s_abs', 'note'])
    ws_densite = wb.create_sheet('densite')
    for r in dataframe_to_rows(df_densite, index=False, header=True):
        ws_densite.append(r)

    # teneur_eau
    df_teneur = pd.DataFrame(columns=['code_site', 'depth_m', 'w', 'wi', 'note'])
    ws_teneur = wb.create_sheet('teneur_eau')
    for r in dataframe_to_rows(df_teneur, index=False, header=True):
        ws_teneur.append(r)

    # classification
    df_classif = pd.DataFrame(columns=['code_site', 'depth_m', 'hrb', 'unified', 'bm', 'note'])
    ws_classif = wb.create_sheet('classification')
    for r in dataframe_to_rows(df_classif, index=False, header=True):
        ws_classif.append(r)

    # ======================
    # SAUVEGARDER
    # ======================
    output_file = 'atlas_import_example.xlsx'
    wb.save(output_file)
    print(f"\n✅ Fichier créé: {output_file}")

    # ======================
    # RAPPORT
    # ======================
    report_md = report.to_markdown()
    with open('corrections_report.md', 'w', encoding='utf-8') as f:
        f.write(report_md)
    print(f"✅ Rapport créé: corrections_report.md")

    # ======================
    # APERÇU
    # ======================
    print("\n" + "="*60)
    print("📋 APERÇU DES DONNÉES")
    print("="*60)

    print("\n🔹 sondages (5 premières lignes):")
    print(df_sondages.head())

    print("\n🔹 echantillons (5 premières lignes):")
    print(df_echantillons.head())

    print("\n🔹 atterberg:")
    print(df_atterberg)

    print("\n🔹 vbs:")
    print(df_vbs)

if __name__ == '__main__':
    main()
