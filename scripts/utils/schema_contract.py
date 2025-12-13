"""
schema_contract.py - Contrat de schéma pour l'import AMESSEFE

Ce module définit :
1. Les colonnes utilisées par l'import (pas toutes les colonnes des tables)
2. La vérification du schéma réel vs attendu au démarrage
3. Le mapping Excel → Tables Atlas

RÈGLE D'OR : L'import ne touche QUE les colonnes listées ici.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set
import subprocess

# =============================================================================
# CONTRAT DE SCHÉMA - Colonnes utilisées par l'import AMESSEFE
# =============================================================================

SCHEMA_CONTRACT = {
    "sondages": {
        "columns": {
            "id": {"type": "uuid", "required": True},
            "code": {"type": "text", "required": True},
            "localite_base": {"type": "text", "required": False},
            "localite_key": {"type": "text", "required": False},
            "localite": {"type": "text", "required": False},
            "source": {"type": "text", "required": True},
            "operator": {"type": "text", "required": False},
            "meta": {"type": "jsonb", "required": False},
            "location_mode": {"type": "text", "required": False},
            "created_at": {"type": "timestamp", "required": False},
            "updated_at": {"type": "timestamp", "required": False},
        },
        "unique_key": ["source", "localite_key"],
    },
    "echantillons": {
        "columns": {
            "id": {"type": "uuid", "required": True},
            "sondage_id": {"type": "uuid", "required": True},
            "depth_m": {"type": "numeric", "required": True},
            "date": {"type": "date", "required": False},
            "laboratory": {"type": "text", "required": False},
            "created_at": {"type": "timestamp", "required": False},
        },
        "unique_key": ["sondage_id", "depth_m", "date"],
    },
    "essais_vbs": {
        "columns": {
            "id": {"type": "uuid", "required": True},
            "echantillon_id": {"type": "uuid", "required": True},
            "vbs": {"type": "numeric", "required": True},
            "meta": {"type": "jsonb", "required": False},
            "created_at": {"type": "timestamp", "required": False},
        },
        "unique_key": ["echantillon_id"],
    },
    "essais_geotechniques": {
        "columns": {
            "id": {"type": "uuid", "required": True},
            "echantillon_id": {"type": "uuid", "required": True},
            "wl": {"type": "numeric", "required": False},
            "wp": {"type": "numeric", "required": False},
            "ip": {"type": "numeric", "required": False},
            "meta": {"type": "jsonb", "required": False},
            "created_at": {"type": "timestamp", "required": False},
            "updated_at": {"type": "timestamp", "required": False},
        },
        "unique_key": ["echantillon_id"],
    },
    "essais_classif": {
        "columns": {
            "id": {"type": "uuid", "required": True},
            "echantillon_id": {"type": "uuid", "required": True},
            "class_chassagneux": {"type": "text", "required": False},
            "class_daksha": {"type": "text", "required": False},
            "class_seed": {"type": "text", "required": False},
            "class_vijay": {"type": "text", "required": False},
            "type_sol": {"type": "text", "required": False},
            "source": {"type": "text", "required": False},
            "created_at": {"type": "timestamp", "required": False},
        },
        "unique_key": ["echantillon_id"],
    },
    "essais_potentiel_gonflement": {
        "columns": {
            "id": {"type": "uuid", "required": True},
            "echantillon_id": {"type": "uuid", "required": True},
            "cg": {"type": "numeric", "required": False},
            "cg_qual": {"type": "text", "required": False},
            "type_sol": {"type": "text", "required": False},
            "meta": {"type": "jsonb", "required": False},
            "created_at": {"type": "timestamp", "required": False},
        },
        "unique_key": ["echantillon_id"],
    },
    "granulo_points": {
        "columns": {
            "id": {"type": "uuid", "required": True},
            "echantillon_id": {"type": "uuid", "required": True},
            "method": {"type": "text", "required": False},
            "sieve_mm": {"type": "numeric", "required": True},
            "passing_pct": {"type": "numeric", "required": True},
            "meta": {"type": "jsonb", "required": False},
            "created_at": {"type": "timestamp", "required": False},
        },
        "unique_key": ["echantillon_id", "method", "sieve_mm"],
    },
}


# =============================================================================
# MAPPING EXCEL → TABLES ATLAS
# =============================================================================

EXCEL_TO_DB_MAPPING = {
    "vbs": {
        "excel_file": "bleu.xlsx",
        "excel_columns": ["Localités", "1", "1.5", "2"],
        "db_table": "essais_vbs",
        "db_columns": ["echantillon_id", "vbs"],
        "description": "Valeur de bleu de méthylène",
    },
    "limites": {
        "excel_file": "limite.xlsx",
        "excel_columns": ["Localité", "Profondeur", "Limite de liquidité (WL)", 
                         "Limite de plasticité (WP)", "Indice de plasticité (IP)"],
        "db_table": "essais_geotechniques",
        "db_columns": ["echantillon_id", "wl", "wp", "ip"],
        "description": "Limites d'Atterberg",
    },
    "granulo": {
        "excel_file": "Granulométrie.xlsx",
        "excel_columns": ["Localités", "1", "1.5", "2"],
        "db_table": "granulo_points",
        "db_columns": ["echantillon_id", "method", "sieve_mm", "passing_pct"],
        "description": "% passant à 0.08mm (tamisage)",
        "notes": "method = 'tamisage_amessefe', sieve_mm = 0.08",
    },
    "classif": {
        "excel_file": "classification.xlsx",
        "excel_columns": ["Localité", "Profondeur", 
                         "Classification CHASSAGNEUX D. et al. 1996",
                         "Classification Dakshanamurthy et Raman 1973",
                         "Classification SEED H. et al 1962",
                         "Classification VIJAYVERGIYA et GHAZZALY 1973",
                         "Type de sol"],
        "db_table": "essais_classif",
        "db_columns": ["echantillon_id", "class_chassagneux", "class_daksha", 
                      "class_seed", "class_vijay", "type_sol"],
        "description": "Classifications des sols",
    },
    "gonflement": {
        "excel_file": "potentielle_de_gonflement.xlsx",
        "excel_columns": ["Localité", "Potentiel gonflement (cg) 1m", 
                         "Potentiel gonflement (cg) 1,5m", "Potentiel gonflement (cg) 2m",
                         "Analyse 1m", "Analyse 1,5m", "Analyse 2m"],
        "db_table": "essais_potentiel_gonflement",
        "db_columns": ["echantillon_id", "cg", "cg_qual"],
        "description": "Potentiel de gonflement",
    },
}


# =============================================================================
# TYPES COMPATIBLES
# =============================================================================

TYPE_COMPATIBILITY = {
    "uuid": {"uuid"},
    "text": {"text", "character varying", "varchar"},
    "numeric": {"numeric", "decimal", "integer", "bigint", "real", "double precision"},
    "jsonb": {"jsonb", "json"},
    "timestamp": {"timestamp with time zone", "timestamp without time zone", "timestamptz"},
    "date": {"date"},
    "boolean": {"boolean"},
}


def is_type_compatible(expected: str, actual: str) -> bool:
    """Vérifie si le type réel est compatible avec le type attendu."""
    expected_lower = expected.lower()
    actual_lower = actual.lower()
    
    if expected_lower in TYPE_COMPATIBILITY:
        return actual_lower in TYPE_COMPATIBILITY[expected_lower]
    
    # Fallback: comparaison directe
    return expected_lower == actual_lower


# =============================================================================
# VÉRIFICATION DU SCHÉMA
# =============================================================================

@dataclass
class SchemaCheckResult:
    """Résultat de la vérification du schéma."""
    table: str
    is_valid: bool
    missing_columns: List[str] = field(default_factory=list)
    type_mismatches: List[Dict] = field(default_factory=list)
    extra_info: str = ""


def get_actual_schema_docker(schema: str = "atlas") -> Dict[str, Dict[str, str]]:
    """
    Récupère le schéma réel depuis PostgreSQL via Docker.
    
    Returns:
        Dict[table_name] -> Dict[column_name] -> data_type
    """
    sql = f"""
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = '{schema}'
    ORDER BY table_name, ordinal_position;
    """
    
    cmd = [
        "docker", "exec", "-i", "atlas-db",
        "psql", "-U", "atlas", "atlas_clean",
        "-t", "-A", "-F", "\t",
        "-c", sql
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        lines = result.stdout.strip().split("\n")
        
        schema_dict = {}
        for line in lines:
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) >= 3:
                table, column, dtype = parts[0], parts[1], parts[2]
                if table not in schema_dict:
                    schema_dict[table] = {}
                schema_dict[table][column] = dtype
        
        return schema_dict
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Erreur Docker: {e.stderr}")


def check_schema(actual_schema: Dict[str, Dict[str, str]] = None) -> List[SchemaCheckResult]:
    """
    Vérifie que le schéma réel correspond au contrat.
    
    Args:
        actual_schema: Schéma réel (si None, récupéré via Docker)
    
    Returns:
        Liste de SchemaCheckResult pour chaque table du contrat
    """
    if actual_schema is None:
        actual_schema = get_actual_schema_docker()
    
    results = []
    
    for table_name, contract in SCHEMA_CONTRACT.items():
        result = SchemaCheckResult(table=table_name, is_valid=True)
        
        # Vérifier que la table existe
        if table_name not in actual_schema:
            result.is_valid = False
            result.extra_info = f"Table '{table_name}' inexistante dans le schéma atlas"
            results.append(result)
            continue
        
        actual_columns = actual_schema[table_name]
        
        # Vérifier chaque colonne du contrat
        for col_name, col_spec in contract["columns"].items():
            if col_name not in actual_columns:
                result.missing_columns.append(col_name)
                result.is_valid = False
            else:
                actual_type = actual_columns[col_name]
                expected_type = col_spec["type"]
                if not is_type_compatible(expected_type, actual_type):
                    result.type_mismatches.append({
                        "column": col_name,
                        "expected": expected_type,
                        "actual": actual_type,
                    })
                    result.is_valid = False
        
        results.append(result)
    
    return results


def validate_schema_or_fail() -> bool:
    """
    Valide le schéma et affiche un rapport.
    Retourne True si OK, False sinon.
    
    Usage au début de l'import:
        if not validate_schema_or_fail():
            sys.exit(1)
    """
    print("=" * 60)
    print("🔍 VÉRIFICATION DU SCHÉMA")
    print("=" * 60)
    
    try:
        results = check_schema()
    except RuntimeError as e:
        print(f"❌ Impossible de vérifier le schéma: {e}")
        return False
    
    all_valid = True
    
    for r in results:
        if r.is_valid:
            print(f"  ✅ {r.table}")
        else:
            all_valid = False
            print(f"  ❌ {r.table}")
            if r.extra_info:
                print(f"     → {r.extra_info}")
            if r.missing_columns:
                print(f"     → Colonnes manquantes: {', '.join(r.missing_columns)}")
            if r.type_mismatches:
                for tm in r.type_mismatches:
                    print(f"     → Type incompatible: {tm['column']} "
                          f"(attendu: {tm['expected']}, réel: {tm['actual']})")
    
    print()
    if all_valid:
        print("✅ Schéma validé - Import autorisé")
    else:
        print("❌ Schéma invalide - Import ANNULÉ")
        print("   Corrigez le schéma ou mettez à jour le contrat dans schema_contract.py")
    
    return all_valid


def print_mapping_table():
    """Affiche le tableau de mapping Excel → DB."""
    print("\n" + "=" * 80)
    print("📋 MAPPING EXCEL → BASE DE DONNÉES")
    print("=" * 80)
    print(f"{'Type':<12} {'Fichier Excel':<35} {'Table DB':<30}")
    print("-" * 80)
    for key, mapping in EXCEL_TO_DB_MAPPING.items():
        print(f"{key:<12} {mapping['excel_file']:<35} atlas.{mapping['db_table']:<30}")
    print()


# =============================================================================
# TEST
# =============================================================================

if __name__ == "__main__":
    print_mapping_table()
    validate_schema_or_fail()
