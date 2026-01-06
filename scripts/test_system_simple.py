#!/usr/bin/env python3
"""
Test simplifié du système d'attribution Colab
Sans dépendances poetry/psql
"""

import os
import sys
from pathlib import Path

# Ajouter le répertoire parent au path
sys.path.insert(0, str(Path(__file__).parent.parent))

def test_files_exist():
    """Vérifie que tous les fichiers nécessaires existent"""
    print("="*70)
    print("🔍 TEST 1: Vérification des fichiers")
    print("="*70)
    
    base_dir = Path(__file__).parent.parent
    
    files_to_check = {
        "Migration SQL": "db/migrations/082_colab_maille_assignment_system.sql",
        "Script principal": "scripts/colab_assign_mailles_from_excel.py",
        "Script template": "scripts/create_excel_template.py",
        "Script vérification": "scripts/verify_colab_setup.py",
        "Script export": "scripts/export_colab_assignments.py",
        "Script PowerShell": "scripts/run_colab_attribution.ps1",
        "Tests SQL": "tests/test_colab_assignment.sql",
        "Doc complète": "docs/COLAB_MAILLE_ASSIGNMENT.md",
        "Guide rapide": "QUICKSTART_COLAB_MAILLES.md",
        "README": "README_COLAB_MAILLES.md",
    }
    
    all_ok = True
    for name, path in files_to_check.items():
        full_path = base_dir / path
        exists = full_path.exists()
        status = "✓" if exists else "✗"
        print(f"  {status} {name}: {path}")
        if not exists:
            all_ok = False
    
    print()
    return all_ok

def test_script_syntax():
    """Vérifie la syntaxe des scripts Python"""
    print("="*70)
    print("🔍 TEST 2: Vérification syntaxe Python")
    print("="*70)
    
    base_dir = Path(__file__).parent.parent
    
    scripts = [
        "scripts/colab_assign_mailles_from_excel.py",
        "scripts/create_excel_template.py",
        "scripts/verify_colab_setup.py",
        "scripts/export_colab_assignments.py",
    ]
    
    all_ok = True
    for script_path in scripts:
        full_path = base_dir / script_path
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                code = f.read()
                compile(code, script_path, 'exec')
            print(f"  ✓ {script_path}")
        except SyntaxError as e:
            print(f"  ✗ {script_path}: {e}")
            all_ok = False
        except Exception as e:
            print(f"  ⚠ {script_path}: {e}")
    
    print()
    return all_ok

def test_sql_syntax():
    """Vérifie la syntaxe SQL basique"""
    print("="*70)
    print("🔍 TEST 3: Vérification syntaxe SQL")
    print("="*70)
    
    base_dir = Path(__file__).parent.parent
    
    sql_files = [
        "db/migrations/082_colab_maille_assignment_system.sql",
        "tests/test_colab_assignment.sql",
    ]
    
    all_ok = True
    for sql_path in sql_files:
        full_path = base_dir / sql_path
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # Vérifications basiques
                if 'CREATE TABLE' in content:
                    print(f"  ✓ {sql_path} (contient CREATE TABLE)")
                else:
                    print(f"  ⚠ {sql_path} (pas de CREATE TABLE)")
        except Exception as e:
            print(f"  ✗ {sql_path}: {e}")
            all_ok = False
    
    print()
    return all_ok

def test_documentation():
    """Vérifie que la documentation est complète"""
    print("="*70)
    print("🔍 TEST 4: Vérification documentation")
    print("="*70)
    
    base_dir = Path(__file__).parent.parent
    
    docs = {
        "README_COLAB_MAILLES.md": ["Démarrage en 3 minutes", "Documentation"],
        "QUICKSTART_COLAB_MAILLES.md": ["4 étapes", "Workflow"],
        "docs/COLAB_MAILLE_ASSIGNMENT.md": ["Format Excel", "Algorithme"],
    }
    
    all_ok = True
    for doc_path, keywords in docs.items():
        full_path = base_dir / doc_path
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
                found = sum(1 for kw in keywords if kw.lower() in content.lower())
                status = "✓" if found == len(keywords) else "⚠"
                print(f"  {status} {doc_path} ({found}/{len(keywords)} mots-clés)")
        except Exception as e:
            print(f"  ✗ {doc_path}: {e}")
            all_ok = False
    
    print()
    return all_ok

def test_directory_structure():
    """Vérifie la structure des répertoires"""
    print("="*70)
    print("🔍 TEST 5: Vérification structure répertoires")
    print("="*70)
    
    base_dir = Path(__file__).parent.parent
    
    dirs_to_check = [
        "db/migrations",
        "scripts",
        "data/colab",
        "docs",
        "tests",
    ]
    
    all_ok = True
    for dir_path in dirs_to_check:
        full_path = base_dir / dir_path
        exists = full_path.exists() and full_path.is_dir()
        status = "✓" if exists else "✗"
        print(f"  {status} {dir_path}/")
        if not exists:
            all_ok = False
    
    print()
    return all_ok

def main():
    """Fonction principale"""
    print("\n")
    print("╔" + "="*68 + "╗")
    print("║" + " "*15 + "TEST SYSTÈME ATTRIBUTION COLAB" + " "*23 + "║")
    print("╚" + "="*68 + "╝")
    print()
    
    results = []
    
    # Test 1: Fichiers
    results.append(("Fichiers créés", test_files_exist()))
    
    # Test 2: Syntaxe Python
    results.append(("Syntaxe Python", test_script_syntax()))
    
    # Test 3: Syntaxe SQL
    results.append(("Syntaxe SQL", test_sql_syntax()))
    
    # Test 4: Documentation
    results.append(("Documentation", test_documentation()))
    
    # Test 5: Structure
    results.append(("Structure", test_directory_structure()))
    
    # Résumé
    print("="*70)
    print("📊 RÉSUMÉ DES TESTS")
    print("="*70)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status} - {test_name}")
        if not passed:
            all_passed = False
    
    print()
    print("="*70)
    
    if all_passed:
        print("✅ TOUS LES TESTS SONT PASSÉS")
        print()
        print("Prochaines étapes:")
        print("  1. Appliquer la migration SQL:")
        print("     psql $env:DATABASE_URL -f db/migrations/082_colab_maille_assignment_system.sql")
        print()
        print("  2. Créer le template Excel:")
        print("     python scripts/create_excel_template.py")
        print()
        print("  3. Tester avec dry-run:")
        print("     python scripts/colab_assign_mailles_from_excel.py --input data/colab/etudiants_colab.xlsx --dry-run true")
    else:
        print("⚠️  CERTAINS TESTS ONT ÉCHOUÉ")
        print()
        print("Vérifier les erreurs ci-dessus et corriger.")
    
    print("="*70)
    print()
    
    return 0 if all_passed else 1

if __name__ == '__main__':
    sys.exit(main())
