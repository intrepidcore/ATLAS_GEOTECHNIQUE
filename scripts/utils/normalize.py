"""
normalize.py - Module centralisé de normalisation des noms de localités

Ce module est utilisé par :
- 04_import_amessefe_v2.py (clé localite_key)
- generate_geocode_suggestions.py
- build_amessefe_summary_xlsx_v2.py (audit)
- fix_amessefe_missing_essais.py (réparation)

Objectif : une seule localité canonique par village, valable pour :
- l'import
- le géocodage
- les audits futurs
"""

import unicodedata
import re
from typing import Optional

# =============================================================================
# ALIASES MANUELS
# =============================================================================
# Mapping des variantes connues vers la forme canonique
# Format: { "variante_normalisée": "forme_canonique_normalisée" }

LOCALITE_ALIASES = {
    # Espaces avant parenthèses
    "adjengre ( pounpoun)": "adjengre (pounpoun)",
    "adjengre ( pounpouni)": "adjengre (pounpouni)",
    "srikpui( togblecope)": "srikpui (togblecope)",
    "wome( ville)": "wome (ville)",
    "kpime( seva)": "kpime (seva)",
    "kpime( tomegbe)": "kpime (tomegbe)",
    "bassar( kpankissi)": "bassar (kpankissi)",
    
    # Variantes orthographiques connues
    "tsevie deve": "tsevie deve",
    "apeheyme": "apeheme",
    "apeyeyeme": "apeyeyeme",
}


# =============================================================================
# FONCTION PRINCIPALE DE NORMALISATION
# =============================================================================

def normalize_localite(name: Optional[str], apply_aliases: bool = True) -> str:
    """
    Normalise un nom de localité pour permettre les comparaisons Excel ↔ DB.
    
    Étapes de normalisation :
    1. Strip + suppression espaces insécables
    2. Minuscules
    3. Suppression des accents (via unicodedata NFD)
    4. Normalisation des espaces autour des parenthèses
    5. Normalisation des espaces multiples
    6. Application des aliases connus (optionnel)
    
    Args:
        name: Nom de localité brut (peut être None ou NaN)
        apply_aliases: Si True, applique le mapping LOCALITE_ALIASES
        
    Returns:
        Nom normalisé (string vide si input invalide)
        
    Examples:
        >>> normalize_localite("Adjengré ( Pounpoun)")
        'adjengre (pounpoun)'
        >>> normalize_localite("  Abobo  ")
        'abobo'
        >>> normalize_localite("Kpimé (Séva)")
        'kpime (seva)'
    """
    # Gestion des valeurs nulles/NaN
    if name is None:
        return ""
    
    # Conversion en string si nécessaire (pandas peut passer des types variés)
    s = str(name)
    
    # Détection NaN de pandas
    if s.lower() in ("nan", "none", "null", ""):
        return ""
    
    # 1. Strip + suppression caractères spéciaux
    s = s.strip()
    s = s.replace("\u00a0", " ")  # espace insécable
    s = s.replace("\u2019", "'")  # apostrophe typographique
    s = s.replace("\u2018", "'")  # apostrophe typographique ouvrante
    s = s.replace("'", "'")       # autre variante d'apostrophe
    
    # 2. Minuscules
    s = s.lower()
    
    # 3. Suppression des accents via unicodedata
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    
    # 4. Normalisation des espaces autour des parenthèses
    # "Adjengré ( Pounpoun)" → "Adjengré (Pounpoun)"
    s = re.sub(r"\s*\(\s*", " (", s)  # espace avant (, pas après
    s = re.sub(r"\s*\)\s*", ") ", s)  # pas d'espace avant ), espace après
    
    # 5. Normalisation des espaces multiples
    s = re.sub(r"\s+", " ", s).strip()
    
    # Supprimer l'espace final après une parenthèse fermante en fin de chaîne
    s = re.sub(r"\)\s*$", ")", s)
    
    # 6. Application des aliases
    if apply_aliases and s in LOCALITE_ALIASES:
        s = LOCALITE_ALIASES[s]
    
    return s


def normalize_localite_for_display(name: Optional[str]) -> str:
    """
    Normalise un nom de localité pour l'affichage (garde la casse originale).
    
    Utilisé pour avoir un nom "propre" mais lisible.
    
    Args:
        name: Nom de localité brut
        
    Returns:
        Nom nettoyé mais avec casse préservée
    """
    if name is None:
        return ""
    
    s = str(name)
    if s.lower() in ("nan", "none", "null", ""):
        return ""
    
    # Nettoyage basique
    s = s.strip()
    s = s.replace("\u00a0", " ")
    s = s.replace("\u2019", "'")
    
    # Normalisation des espaces autour des parenthèses
    s = re.sub(r"\s*\(\s*", " (", s)
    s = re.sub(r"\s*\)\s*", ") ", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\)\s*$", ")", s)
    
    return s


def get_canonical_localite(name: Optional[str]) -> str:
    """
    Retourne la forme canonique d'une localité.
    
    Combine normalisation + lookup dans les aliases.
    
    Args:
        name: Nom de localité brut
        
    Returns:
        Forme canonique normalisée
    """
    return normalize_localite(name, apply_aliases=True)


# =============================================================================
# FONCTIONS UTILITAIRES
# =============================================================================

def are_same_localite(name1: Optional[str], name2: Optional[str]) -> bool:
    """
    Compare deux noms de localité après normalisation.
    
    Args:
        name1: Premier nom
        name2: Second nom
        
    Returns:
        True si les deux noms représentent la même localité
    """
    return normalize_localite(name1) == normalize_localite(name2)


def find_best_display_name(*names: Optional[str]) -> str:
    """
    Parmi plusieurs variantes d'un nom de localité, retourne la meilleure
    pour l'affichage (la plus longue, nettoyée).
    
    Args:
        *names: Liste de noms candidats
        
    Returns:
        Le meilleur nom pour l'affichage
    """
    candidates = []
    for name in names:
        if name:
            cleaned = normalize_localite_for_display(name)
            if cleaned:
                candidates.append(cleaned)
    
    if not candidates:
        return ""
    
    # Retourne le plus long (souvent le plus précis)
    return max(candidates, key=len)


# =============================================================================
# TESTS
# =============================================================================

if __name__ == "__main__":
    # Tests rapides
    test_cases = [
        ("Adjengré ( Pounpoun)", "adjengre (pounpoun)"),
        ("Adjengré (Pounpoun)", "adjengre (pounpoun)"),
        ("  Abobo  ", "abobo"),
        ("Kpimé (Séva)", "kpime (seva)"),
        ("Tsévié dévé", "tsevie deve"),
        ("Womé( Ville)", "wome (ville)"),
        ("LOME", "lome"),
        (None, ""),
        ("", ""),
        ("nan", ""),
    ]
    
    print("=" * 60)
    print("TESTS DE NORMALISATION")
    print("=" * 60)
    
    all_passed = True
    for input_val, expected in test_cases:
        result = normalize_localite(input_val)
        status = "✅" if result == expected else "❌"
        if result != expected:
            all_passed = False
        print(f"{status} '{input_val}' → '{result}' (attendu: '{expected}')")
    
    print("\n" + ("✅ Tous les tests passent!" if all_passed else "❌ Certains tests échouent"))
