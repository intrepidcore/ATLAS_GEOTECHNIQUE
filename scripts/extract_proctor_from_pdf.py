#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stratégie d'extraction pour données/donné géotechnique .pdf

PHASE 1 — OCR automatique (70-80% des cas)
  Outil : pdfplumber + pytesseract pour les pages scannées
  
  Pour chaque page :
  1. Déterminer si c'est une page texte (pdfplumber) ou image (pytesseract)
  2. Chercher les patterns :
     - "Proctor" ou "Compactage" dans le titre de la page
     - γd max = XX.XX kN/m³
     - w opt = XX.X %
  3. Extraire le numéro de sondage de l'en-tête
  4. Écrire dans un fichier CSV de révision humaine

PHASE 2 — Validation (20-30% des cas ambigus)
  Interface de révision simple (terminal ou Excel)
  Validateur humain confirme ou corrige chaque ligne douteuse
  
PHASE 3 — Import en DB (identique aux autres essais)
"""

import re
from pathlib import Path
import csv
import argparse

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

PROCTOR_PATTERNS = [
    r'γd\s*max\s*[=:]\s*(\d+[.,]\d+)',
    r'gamma_d\s*max\s*[=:]\s*(\d+[.,]\d+)',
    r'poids\s+volumique\s+sec\s+max[imum]*\s*[=:]\s*(\d+[.,]\d+)',
    r'densit[eé]\s+s[eè]che\s+max[imum]*\s*[=:]\s*(\d+[.,]\d+)',
]

W_OPT_PATTERNS = [
    r'w\s*opt[imale]*\s*[=:]\s*(\d+[.,]\d+)',
    r'teneur\s+en\s+eau\s+optimale\s*[=:]\s*(\d+[.,]\d+)',
]

def extract_proctor_from_pdf(pdf_path: Path, output_csv: Path):
    if pdfplumber is None:
        print("Erreur : la librairie 'pdfplumber' n'est pas installée. Veuillez lancer pip install pdfplumber.")
        return

    results = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            
            # Chercher le code sondage dans la page
            sondage_match = re.search(r'[Ss]ondage\s*[Nn°]*\s*:?\s*([A-Z0-9-]+)', text)
            sondage_code = sondage_match.group(1) if sondage_match else f"PAGE_{page_num}"
            
            # Chercher γd max
            gamma_d = None
            for pattern in PROCTOR_PATTERNS:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    gamma_d = float(match.group(1).replace(',', '.'))
                    break
            
            # Chercher w_opt
            w_opt = None
            for pattern in W_OPT_PATTERNS:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    w_opt = float(match.group(1).replace(',', '.'))
                    break
            
            if gamma_d or w_opt:
                # Validation physique basique pour le tag de confiance
                valid_gamma = gamma_d is not None and 14 <= gamma_d <= 22
                valid_w = w_opt is not None and 5 <= w_opt <= 30
                
                results.append({
                    'page': page_num,
                    'sondage_code': sondage_code,
                    'gamma_d_max_kNm3': gamma_d,
                    'w_opt_pct': w_opt,
                    'confidence': 'high' if (valid_gamma and valid_w) else 'low',
                    'needs_review': True if not (valid_gamma and valid_w) else False
                })
    
    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys() if results else [])
        writer.writeheader()
        writer.writerows(results)
    
    print(f"✅ {len(results)} entrées Proctor extraites → {output_csv}")
    needs_review = sum(1 for r in results if r['needs_review'])
    print(f"⚠️  {needs_review} entrées nécessitent une révision humaine (hors plage ou incomplet)")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Extraire les données Proctor depuis un PDF de labo.")
    parser.add_argument('--pdf', type=Path, required=True, help="Chemin vers le fichier PDF d'entrée")
    parser.add_argument('--csv', type=Path, required=True, help="Chemin vers le CSV de sortie (à valider)")
    
    args = parser.parse_args()
    
    if not args.pdf.exists():
        print(f"Fichier inexistant : {args.pdf}")
        exit(1)
        
    extract_proctor_from_pdf(args.pdf, args.csv)
