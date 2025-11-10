// Types PostgreSQL disponibles pour le gestionnaire de BDD
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostgresType {
    pub name: String,
    pub category: String,
    pub requires_length: bool,
    pub requires_precision: bool,
    pub requires_scale: bool,
    pub description: String,
}

/// Retourne la liste des types PostgreSQL disponibles
pub fn get_postgres_types() -> Vec<PostgresType> {
    vec![
        // Numeric types
        PostgresType {
            name: "smallint".to_string(),
            category: "numeric".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Entier 16 bits (-32768 à 32767)".to_string(),
        },
        PostgresType {
            name: "integer".to_string(),
            category: "numeric".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Entier 32 bits (-2147483648 à 2147483647)".to_string(),
        },
        PostgresType {
            name: "bigint".to_string(),
            category: "numeric".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Entier 64 bits".to_string(),
        },
        PostgresType {
            name: "numeric".to_string(),
            category: "numeric".to_string(),
            requires_length: false,
            requires_precision: true,
            requires_scale: true,
            description: "Nombre décimal exact (precision, scale)".to_string(),
        },
        PostgresType {
            name: "real".to_string(),
            category: "numeric".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Nombre flottant 32 bits".to_string(),
        },
        PostgresType {
            name: "double precision".to_string(),
            category: "numeric".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Nombre flottant 64 bits".to_string(),
        },
        // String types
        PostgresType {
            name: "varchar".to_string(),
            category: "string".to_string(),
            requires_length: true,
            requires_precision: false,
            requires_scale: false,
            description: "Chaîne de caractères variable (max length)".to_string(),
        },
        PostgresType {
            name: "char".to_string(),
            category: "string".to_string(),
            requires_length: true,
            requires_precision: false,
            requires_scale: false,
            description: "Chaîne de caractères fixe (length)".to_string(),
        },
        PostgresType {
            name: "text".to_string(),
            category: "string".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Chaîne de caractères illimitée".to_string(),
        },
        // Date/Time types
        PostgresType {
            name: "date".to_string(),
            category: "datetime".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Date (YYYY-MM-DD)".to_string(),
        },
        PostgresType {
            name: "time".to_string(),
            category: "datetime".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Heure (HH:MM:SS)".to_string(),
        },
        PostgresType {
            name: "timestamp".to_string(),
            category: "datetime".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Date et heure sans fuseau horaire".to_string(),
        },
        PostgresType {
            name: "timestamptz".to_string(),
            category: "datetime".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Date et heure avec fuseau horaire".to_string(),
        },
        // Boolean
        PostgresType {
            name: "boolean".to_string(),
            category: "boolean".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Vrai/Faux".to_string(),
        },
        // JSON
        PostgresType {
            name: "json".to_string(),
            category: "json".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Données JSON (texte)".to_string(),
        },
        PostgresType {
            name: "jsonb".to_string(),
            category: "json".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Données JSON binaire (indexable)".to_string(),
        },
        // UUID
        PostgresType {
            name: "uuid".to_string(),
            category: "uuid".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Identifiant unique universel".to_string(),
        },
        // Geometry (PostGIS)
        PostgresType {
            name: "geometry(Point, 4326)".to_string(),
            category: "geometry".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Point géométrique (WGS84)".to_string(),
        },
        PostgresType {
            name: "geometry(LineString, 4326)".to_string(),
            category: "geometry".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Ligne géométrique (WGS84)".to_string(),
        },
        PostgresType {
            name: "geometry(Polygon, 4326)".to_string(),
            category: "geometry".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Polygone géométrique (WGS84)".to_string(),
        },
        PostgresType {
            name: "geometry(MultiPoint, 4326)".to_string(),
            category: "geometry".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Multi-points géométriques (WGS84)".to_string(),
        },
        PostgresType {
            name: "geometry(MultiLineString, 4326)".to_string(),
            category: "geometry".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Multi-lignes géométriques (WGS84)".to_string(),
        },
        PostgresType {
            name: "geometry(MultiPolygon, 4326)".to_string(),
            category: "geometry".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Multi-polygones géométriques (WGS84)".to_string(),
        },
        // Arrays
        PostgresType {
            name: "text[]".to_string(),
            category: "array".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Tableau de textes".to_string(),
        },
        PostgresType {
            name: "integer[]".to_string(),
            category: "array".to_string(),
            requires_length: false,
            requires_precision: false,
            requires_scale: false,
            description: "Tableau d'entiers".to_string(),
        },
    ]
}
