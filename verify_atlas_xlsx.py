"""
Script de verification du fichier atlas_import_example.xlsx
Verifie la conformite avec les specifications Atlas V3
"""

import openpyxl
import sys

def verify_atlas_xlsx(filename='atlas_import_example.xlsx'):
    """Verifie la conformite du fichier Excel avec les specs Atlas V3"""

    print(f"[*] Verification du fichier: {filename}")
    print("="*70)

    try:
        wb = openpyxl.load_workbook(filename)
    except FileNotFoundError:
        print(f"[ERREUR] Fichier {filename} introuvable!")
        return False

    errors = []
    warnings = []
    success = []

    # ========================================
    # 1. Verifier les feuilles obligatoires
    # ========================================
    print("\n[1] Verification des feuilles...")

    required_sheets = ['sondages', 'echantillons']
    optional_sheets = ['atterberg', 'vbs', 'proctor', 'granulo_tamisage_large',
                       'granulo_sedimento_large', 'densite', 'teneur_eau', 'classification']

    all_expected_sheets = required_sheets + optional_sheets

    for sheet in required_sheets:
        if sheet in wb.sheetnames:
            success.append(f"[OK] Feuille obligatoire '{sheet}' presente")
        else:
            errors.append(f"[ERREUR] Feuille obligatoire '{sheet}' manquante!")

    for sheet in optional_sheets:
        if sheet in wb.sheetnames:
            success.append(f"[OK] Feuille optionnelle '{sheet}' presente")
        else:
            warnings.append(f"[WARN] Feuille optionnelle '{sheet}' absente")

    # Feuilles inattendues
    for sheet in wb.sheetnames:
        if sheet not in all_expected_sheets:
            warnings.append(f"[WARN] Feuille inattendue: '{sheet}'")

    # ========================================
    # 2. Verifier la feuille SONDAGES
    # ========================================
    print("\n[2] Verification feuille 'sondages'...")

    if 'sondages' in wb.sheetnames:
        ws = wb['sondages']
        header = [cell.value for cell in ws[1]]

        expected_cols = ['code_site', 'localite', 'date', 'adm3', 'adm2', 'lat', 'lon', 'source']

        if 'code_site' not in header:
            errors.append("[ERREUR] Colonne obligatoire 'code_site' manquante dans 'sondages'")
        else:
            success.append("[OK] Colonne 'code_site' presente")

        # Compter les lignes de donnees
        data_rows = sum(1 for row in ws.iter_rows(min_row=2) if any(cell.value for cell in row))
        if data_rows > 0:
            success.append(f"[OK] {data_rows} sondage(s) dans la feuille")
        else:
            errors.append("[ERREUR] Aucun sondage dans la feuille!")

    # ========================================
    # 3. Verifier la feuille ECHANTILLONS
    # ========================================
    print("\n[3] Verification feuille 'echantillons'...")

    if 'echantillons' in wb.sheetnames:
        ws = wb['echantillons']
        header = [cell.value for cell in ws[1]]

        required_cols = ['code_site', 'depth_m']
        for col in required_cols:
            if col not in header:
                errors.append(f"[ERREUR] Colonne obligatoire '{col}' manquante dans 'echantillons'")
            else:
                success.append(f"[OK] Colonne '{col}' presente")

        # Compter les lignes
        data_rows = sum(1 for row in ws.iter_rows(min_row=2) if any(cell.value for cell in row))
        if data_rows > 0:
            success.append(f"[OK] {data_rows} echantillon(s) dans la feuille")

            # Verifier depth_m > 0
            for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
                if not any(row):
                    continue
                depth_idx = header.index('depth_m') if 'depth_m' in header else None
                if depth_idx is not None:
                    depth = row[depth_idx]
                    if depth is not None and depth <= 0:
                        errors.append(f"[ERREUR] depth_m <= 0 a la ligne {row_idx}")
        else:
            errors.append("[ERREUR] Aucun echantillon dans la feuille!")

    # ========================================
    # 4. Verifier ATTERBERG
    # ========================================
    print("\n[4] Verification feuille 'atterberg'...")

    if 'atterberg' in wb.sheetnames:
        ws = wb['atterberg']
        header = [cell.value for cell in ws[1]]

        if 'wl' in header and 'wp' in header:
            success.append("[OK] Colonnes 'wl' et 'wp' presentes")

            wl_idx = header.index('wl')
            wp_idx = header.index('wp')

            # Verifier WL >= WP
            for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
                if not any(row):
                    continue
                wl = row[wl_idx] if wl_idx < len(row) else None
                wp = row[wp_idx] if wp_idx < len(row) else None

                if wl is not None and wp is not None:
                    if wl < wp:
                        errors.append(f"[ERREUR] WL < WP a la ligne {row_idx} (WL={wl}, WP={wp})")

            success.append("[OK] Toutes les valeurs WL >= WP")

    # ========================================
    # 5. Verifier GRANULO_TAMISAGE_LARGE (FORMAT WIDE)
    # ========================================
    print("\n[5] Verification feuille 'granulo_tamisage_large'...")

    if 'granulo_tamisage_large' in wb.sheetnames:
        ws = wb['granulo_tamisage_large']
        header = [cell.value for cell in ws[1]]

        if header[0] == 'sieve_mm':
            success.append("[OK] Premiere colonne 'sieve_mm' correcte")
        else:
            errors.append(f"[ERREUR] Premiere colonne devrait etre 'sieve_mm', trouve: '{header[0]}'")

        # Verifier pattern site@depth dans les colonnes suivantes
        valid_patterns = 0
        for col in header[1:]:
            if col and '@' in str(col):
                parts = str(col).split('@')
                if len(parts) == 2:
                    valid_patterns += 1

        if valid_patterns > 0:
            success.append(f"[OK] {valid_patterns} serie(s) au format 'site@depth' trouvee(s)")
        else:
            warnings.append("[WARN] Aucune serie au format 'site@depth' trouvee")

        # Compter les tamis
        sieve_count = sum(1 for row in ws.iter_rows(min_row=2) if any(cell.value for cell in row))
        if sieve_count > 0:
            success.append(f"[OK] {sieve_count} tamis dans la feuille")

        # Verifier valeurs dans [0, 100]
        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
            for col_idx, val in enumerate(row[1:], 1):  # Skip sieve_mm
                if val is not None and isinstance(val, (int, float)):
                    if val < 0 or val > 100:
                        errors.append(f"[ERREUR] Valeur hors [0,100] ligne {row_idx}, col {col_idx+1}: {val}")

    # ========================================
    # 6. Verifier VBS
    # ========================================
    print("\n[6] Verification feuille 'vbs'...")

    if 'vbs' in wb.sheetnames:
        ws = wb['vbs']
        header = [cell.value for cell in ws[1]]

        if 'vbs' in header:
            success.append("[OK] Colonne 'vbs' presente")

            vbs_idx = header.index('vbs')

            # Verifier VBS dans [0, 20]
            for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
                if not any(row):
                    continue
                vbs = row[vbs_idx] if vbs_idx < len(row) else None

                if vbs is not None and isinstance(vbs, (int, float)):
                    if vbs < 0 or vbs > 20:
                        errors.append(f"[ERREUR] VBS hors [0,20] a la ligne {row_idx}: {vbs}")

            success.append("[OK] Toutes les valeurs VBS dans [0, 20]")

    # ========================================
    # 7. Afficher le resume
    # ========================================
    print("\n" + "="*70)
    print("RESUME DE LA VERIFICATION")
    print("="*70)

    if success:
        print(f"\n[OK] Validations reussies ({len(success)}):")
        for msg in success[:10]:  # Limiter affichage
            print(f"  {msg}")
        if len(success) > 10:
            print(f"  ... et {len(success) - 10} autres validations OK")

    if warnings:
        print(f"\n[WARN] Avertissements ({len(warnings)}):")
        for msg in warnings:
            print(f"  {msg}")

    if errors:
        print(f"\n[ERREUR] Erreurs detectees ({len(errors)}):")
        for msg in errors:
            print(f"  {msg}")
        print("\n[RESULTAT] VERIFICATION ECHOUEE")
        return False
    else:
        print(f"\n[RESULTAT] VERIFICATION REUSSIE - Fichier conforme aux specifications Atlas V3!")
        return True

if __name__ == '__main__':
    filename = sys.argv[1] if len(sys.argv) > 1 else 'atlas_import_example.xlsx'
    success = verify_atlas_xlsx(filename)
    sys.exit(0 if success else 1)
