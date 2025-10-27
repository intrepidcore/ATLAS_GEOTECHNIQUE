#!/usr/bin/env python3
"""
Générateur de template XLSX pour import géotechnique Atlas
Conforme à la spécification réelle du parser (xlsx_parser.rs)

Génère: atlas_import_template.xlsx avec toutes les feuilles supportées

Usage:
    python make_atlas_import_template.py

Feuilles générées:
- sondages (obligatoire)
- echantillons (obligatoire)
- atterberg (optionnel)
- vbs (optionnel)
- proctor (optionnel)
- granulo_tamisage_large (optionnel, format wide)
- granulo_sedimento_large (optionnel, format wide)
"""

import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

OUT = "atlas_import_template.xlsx"

# Définition des feuilles selon le parser réel
SHEETS = {
    "sondages": {
        "columns": [
            "code_site",     # OBLIGATOIRE - Code unique du sondage
            "localite",      # Optionnel - Nom du site
            "date",          # Optionnel - Format YYYY-MM-DD
            "lat",           # Optionnel - Latitude WGS84 (requis si mode=exact)
            "lon",           # Optionnel - Longitude WGS84 (requis si mode=exact)
            "adm1",          # Optionnel - Région
            "adm2",          # Optionnel - Préfecture
            "adm3",          # Optionnel - Commune
            "source",        # Optionnel - Source des données
        ],
        "notes": "code_site = identifiant unique. Géolocalisation selon mode choisi à l'import."
    },

    "echantillons": {
        "columns": [
            "code_site",        # OBLIGATOIRE - Doit exister dans sondages
            "depth_m",          # OBLIGATOIRE - Profondeur en mètres (> 0)
            "date",             # Optionnel - Date de prélèvement
            "laboratory",       # Optionnel - Nom du laboratoire
            "norm",             # Optionnel - Norme utilisée (ex: NF P94-051)
            "rho_s_gcm3",       # Optionnel - Densité absolue des solides (g/cm³), 2.0-3.5
            "water_content_w",  # Optionnel - Teneur en eau (%), 0-100
            "is_index",         # Optionnel - Indice de gonflement Is, 0-1
            "eg",               # Optionnel - Gonflement œdométrique (%), 0-50
            "commentaire",      # Optionnel - Commentaire libre
        ],
        "notes": "Clé unique: (code_site, depth_m, date). Un échantillon par profondeur."
    },

    "atterberg": {
        "columns": [
            "code_site",  # OBLIGATOIRE - Référence à echantillons
            "depth_m",    # OBLIGATOIRE - Profondeur correspondante
            "wl",         # Optionnel - Limite de liquidité (%), 0-200
            "wp",         # Optionnel - Limite de plasticité (%), 0-200
        ],
        "notes": "IP = WL - WP calculé automatiquement. Vérifier WL >= WP."
    },

    "vbs": {
        "columns": [
            "code_site",   # OBLIGATOIRE
            "depth_m",     # OBLIGATOIRE
            "vbs",         # OBLIGATOIRE - Valeur de Bleu (g/100g), 0-20
            "commentaire", # Optionnel - Classification
        ],
        "notes": "Classification automatique selon GTR (VBS < 0.1 = insensible, >= 6 = très argileux)."
    },

    "proctor": {
        "columns": [
            "code_site",    # OBLIGATOIRE
            "depth_m",      # OBLIGATOIRE
            "proctor_type", # OBLIGATOIRE - 'normal' ou 'modifie'
            "gamma_d_max",  # OBLIGATOIRE - Densité sèche max (kN/m³), 10-30
            "w_opt",        # OBLIGATOIRE - Teneur en eau optimale (%), 0-50
        ],
        "notes": "proctor_type: exactement 'normal' ou 'modifie' (minuscule). gamma_d_max en kN/m³."
    },

    "granulo_tamisage_large": {
        "columns": [
            "sieve_mm",  # OBLIGATOIRE - Diamètre tamis (mm)
            # Ajouter colonnes au format: code_site@depth_m
            # Exemple: Sanfatoute@1, Korbongou@1.5
        ],
        "notes": "FORMAT WIDE: sieve_mm en 1ère colonne, puis code_site@depth_m pour chaque échantillon. Valeurs = % passant (0-100)."
    },

    "granulo_sedimento_large": {
        "columns": [
            "sieve_mm",  # OBLIGATOIRE - Diamètre équivalent (mm, généralement < 0.08)
            # Ajouter colonnes au format: code_site@depth_m
        ],
        "notes": "FORMAT WIDE identique à tamisage. Fraction fine < 80µm (0.08 mm)."
    },

    # Feuilles NON IMPLEMENTEES (placeholders pour développement futur)
    "densite": {
        "columns": [
            "code_site",   # OBLIGATOIRE
            "depth_m",     # OBLIGATOIRE
            "rho_d_app",   # Optionnel - Densité apparente sèche (g/cm³)
            "rho_s_abs",   # Optionnel - Densité absolue des grains (g/cm³)
            "note",        # Optionnel - Commentaire
        ],
        "notes": "NON IMPLEMENTE - Utilisez echantillons.rho_s_gcm3 pour densité absolue."
    },

    "teneur_eau": {
        "columns": [
            "code_site",   # OBLIGATOIRE
            "depth_m",     # OBLIGATOIRE
            "w",           # Optionnel - Teneur en eau naturelle (%)
            "wi",          # Optionnel - Indice de plasticité
            "note",        # Optionnel - Commentaire
        ],
        "notes": "NON IMPLEMENTE - Utilisez echantillons.water_content_w pour teneur en eau."
    },

    "classification": {
        "columns": [
            "code_site",   # OBLIGATOIRE
            "depth_m",     # OBLIGATOIRE
            "hrb",         # Optionnel - Classification HRB/AASHTO
            "unified",     # Optionnel - Classification USCS
            "bm",          # Optionnel - Classification Bleu de Méthylène (GTR)
            "note",        # Optionnel - Commentaire
        ],
        "notes": "NON IMPLEMENTE - Classifications dérivées automatiquement des essais (VBS, Atterberg, granulo)."
    },
}

def make_template():
    """Génère le template XLSX avec styling"""

    # Créer le fichier avec pandas
    with pd.ExcelWriter(OUT, engine="openpyxl") as writer:
        for sheet_name, config in SHEETS.items():
            df = pd.DataFrame(columns=config["columns"])
            df.to_excel(writer, sheet_name=sheet_name, index=False)

    # Charger pour styling
    wb = load_workbook(OUT)

    # Styles
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_align = Alignment(horizontal="center", vertical="center")

    notes_fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
    notes_font = Font(italic=True, size=9)

    border = Border(
        left=Side(style='thin', color='D0D0D0'),
        right=Side(style='thin', color='D0D0D0'),
        top=Side(style='thin', color='D0D0D0'),
        bottom=Side(style='thin', color='D0D0D0')
    )

    for sheet_name in SHEETS.keys():
        ws = wb[sheet_name]
        config = SHEETS[sheet_name]

        # Style header (ligne 1)
        for col_idx, cell in enumerate(ws[1], start=1):
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_align
            cell.border = border

        # Ajouter ligne de notes (ligne 2)
        ws.insert_rows(2)
        ws.merge_cells(f'A2:{get_column_letter(len(config["columns"]))}2')
        notes_cell = ws['A2']
        notes_cell.value = f"INFO: {config['notes']}"
        notes_cell.fill = notes_fill
        notes_cell.font = notes_font
        notes_cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
        ws.row_dimensions[2].height = 30

        # Freeze panes (après header + notes)
        ws.freeze_panes = "A3"

        # Auto-filter sur header
        last_col = get_column_letter(len(config["columns"]))
        ws.auto_filter.ref = f"A1:{last_col}1"

        # Largeurs de colonnes optimales
        for col_idx, col_name in enumerate(config["columns"], start=1):
            col_letter = get_column_letter(col_idx)

            # Largeurs selon type de colonne
            if col_name in {"commentaire", "notes"}:
                ws.column_dimensions[col_letter].width = 35
            elif col_name in {"code_site", "localite", "laboratory", "norm", "proctor_type"}:
                ws.column_dimensions[col_letter].width = 18
            elif col_name in {"date"}:
                ws.column_dimensions[col_letter].width = 12
            elif col_name in {"depth_m", "sieve_mm", "wl", "wp", "vbs", "gamma_d_max", "w_opt"}:
                ws.column_dimensions[col_letter].width = 11
            elif col_name in {"lat", "lon", "rho_s_gcm3", "water_content_w", "is_index", "eg"}:
                ws.column_dimensions[col_letter].width = 14
            elif col_name in {"adm1", "adm2", "adm3", "source"}:
                ws.column_dimensions[col_letter].width = 16
            else:
                ws.column_dimensions[col_letter].width = 14

        # Hauteur header
        ws.row_dimensions[1].height = 25

    # Sauvegarder
    wb.save(OUT)
    print(f"[OK] Template genere: {OUT}")
    print(f"\nFeuilles creees:")
    for name in SHEETS.keys():
        print(f"  - {name}")
    print(f"\nInstructions:")
    print(f"  1. Remplir au minimum: sondages + echantillons")
    print(f"  2. Ajouter les essais optionnels selon vos donnees")
    print(f"  3. Format granulo wide: ajouter colonnes code_site@depth_m")
    print(f"  4. Importer via API: POST /api/v1/surveys/bulk-import/geotechnical")

if __name__ == "__main__":
    make_template()
