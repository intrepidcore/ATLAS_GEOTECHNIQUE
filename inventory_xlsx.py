import os
import json
from datetime import datetime
from pathlib import Path

# Liste des fichiers xlsx
files = [
    "atlas_import_example.xlsx",
    "atlas_import_example_1761495185.xlsx",
    "data/xlsx/ABGBANA_Essi_Odette.xlsx",
    "data/xlsx/ADANDOGOU Afiwa Pamela  PAS TERMINE.xlsx",
    "data/xlsx/ADOTE Adote emmanuel.xlsx",
    "data/xlsx/AG TCHESSI pas terminer.xlsx",
    "data/xlsx/AKONDOR Tigana Messanh.xlsx",
    "data/xlsx/ANYO Akouete jean-paul.xlsx",
    "data/xlsx/GAMBAGA Inoussa.xlsx",
    "data/xlsx/Granulométrie.xlsx",
    "data/xlsx/IMPORT/atlas_import_nicabou_ninsao_vianney.xlsx",
    "data/xlsx/IMPORT/atlas_import_soglo_ferdinand.xlsx",
    "data/xlsx/NABIYOU Warou.xlsx",
    "data/xlsx/NGOAPO-GOLLO Roxane Lenira Chrisie.xlsx",
    "data/xlsx/NICABOU Ninsao Vianney.xlsx",
    "data/xlsx/OUDJABITI Bassirou.xlsx",
    "data/xlsx/SOGLO FERDINAND.xlsx",
    "data/xlsx/TCHALA Komla Hyacinthe.xlsx",
    "data/xlsx/TEMPLATE.xlsx",
    "data/xlsx/bleu.xlsx",
    "data/xlsx/limite.xlsx",
    "scripts/atlas_import_template.xlsx"
]

base_dir = Path(r"c:\PROJET_ATLAS_MASTER\atlas")
inventory = []

print("="*80)
print("INVENTAIRE DES FICHIERS EXCEL")
print("="*80)
print(f"{'Fichier':<60} {'Taille':>10} {'Modifié':<20}")
print("-"*80)

for file_rel in files:
    file_path = base_dir / file_rel
    if file_path.exists():
        stat = file_path.stat()
        size_kb = stat.st_size / 1024
        modified = datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M')
        
        # Exclure les templates et fichiers "pas terminé"
        skip = False
        skip_reason = ""
        
        if "TEMPLATE" in file_path.name.upper():
            skip = True
            skip_reason = "template"
        elif "PAS TERMINE" in file_path.name.upper() or "pas terminer" in file_path.name.lower():
            skip = True
            skip_reason = "incomplet"
        elif file_path.name in ["bleu.xlsx", "limite.xlsx", "Granulométrie.xlsx"]:
            skip = True
            skip_reason = "fichier test/partiel"
        
        status = "skip" if skip else "pending"
        
        inventory.append({
            "file": str(file_rel),
            "size_kb": round(size_kb, 2),
            "modified": modified,
            "status": status,
            "skip_reason": skip_reason if skip else None
        })
        
        status_mark = "⊘" if skip else "✓"
        print(f"{status_mark} {file_rel:<58} {size_kb:>8.1f}KB {modified:<20}")
        if skip:
            print(f"  → Skip: {skip_reason}")

print("-"*80)
print(f"\nTotal: {len(inventory)} fichiers")
print(f"À importer: {sum(1 for i in inventory if i['status'] == 'pending')}")
print(f"À ignorer: {sum(1 for i in inventory if i['status'] == 'skip')}")

# Sauvegarder l'inventaire
with open(base_dir / "inventory_xlsx.json", "w", encoding="utf-8") as f:
    json.dump({"files": inventory}, f, indent=2, ensure_ascii=False)

print("\n✓ Inventaire sauvegardé dans inventory_xlsx.json")

# TODO list
todo = {
    "todo_files": [
        {"file": i["file"], "status": i["status"]} 
        for i in inventory 
        if i["status"] == "pending"
    ]
}

with open(base_dir / "todo_import.json", "w", encoding="utf-8") as f:
    json.dump(todo, f, indent=2, ensure_ascii=False)

print("✓ TODO sauvegardée dans todo_import.json")
print(f"\n{len(todo['todo_files'])} fichiers à importer")
