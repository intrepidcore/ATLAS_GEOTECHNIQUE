#!/bin/bash
# Script de vérification du schéma de base de données
# Usage: ./check-db-schema.sh

set -e

# Configuration
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-atlas}"
DB_NAME="${DB_NAME:-atlas_clean}"
PGPASSWORD="${PGPASSWORD:-atlas}"

echo "🔍 Vérification du schéma de base de données..."
echo "  Host: ${DB_HOST}:${DB_PORT}"
echo "  Database: ${DB_NAME}"
echo ""

# Fonction pour exécuter une requête
query() {
    PGPASSWORD="${PGPASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "$1"
}

# 1. Vérifier la connexion
echo "✓ Test de connexion..."
if ! query "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ ERREUR: Impossible de se connecter à la base de données"
    exit 1
fi
echo "✅ Connexion réussie"
echo ""

# 2. Lister les schémas
echo "📂 Schémas disponibles:"
query "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema') ORDER BY schema_name;" | sed 's/^/  - /'
echo ""

# 3. Lister les tables par schéma
echo "📋 Tables dans le schéma 'public':"
query "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;" | sed 's/^/  - /' || echo "  (aucune)"
echo ""

echo "📋 Tables dans le schéma 'atlas':"
query "SELECT tablename FROM pg_tables WHERE schemaname='atlas' ORDER BY tablename;" | sed 's/^/  - /' || echo "  (aucune)"
echo ""

# 4. Vérifier les tables critiques
echo "🔍 Vérification des tables critiques:"

CRITICAL_TABLES=(
    "atlas.staging_info"
    "atlas.staging_locks"
    "atlas.audit_log"
    "atlas.backups"
)

MISSING_TABLES=()

for table in "${CRITICAL_TABLES[@]}"; do
    IFS='.' read -r schema tablename <<< "$table"
    COUNT=$(query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${schema}' AND table_name='${tablename}';")
    if [ "$COUNT" -eq "1" ]; then
        echo "  ✅ ${table}"
    else
        echo "  ❌ ${table} (manquante)"
        MISSING_TABLES+=("$table")
    fi
done
echo ""

# 5. Vérifier search_path
echo "🔍 Search path actuel:"
query "SHOW search_path;" | sed 's/^/  /'
echo ""

# 6. Résumé
if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
    echo "✅ Toutes les tables critiques sont présentes"
    exit 0
else
    echo "⚠️  ${#MISSING_TABLES[@]} table(s) manquante(s):"
    for table in "${MISSING_TABLES[@]}"; do
        echo "  - $table"
    done
    echo ""
    echo "💡 Pour corriger, exécutez les migrations:"
    echo "   cd migrations && for f in *.sql; do psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -f \"\$f\"; done"
    exit 1
fi
