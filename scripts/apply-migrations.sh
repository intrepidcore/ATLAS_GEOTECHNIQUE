#!/bin/bash
# Script d'application des migrations SQL
# Usage: ./apply-migrations.sh [migration_dir]

set -e

# Configuration
MIGRATION_DIR="${1:-../migrations}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-atlas}"
DB_NAME="${DB_NAME:-atlas_clean}"
PGPASSWORD="${PGPASSWORD:-atlas}"

echo "🚀 Application des migrations SQL"
echo "  Répertoire: ${MIGRATION_DIR}"
echo "  Database: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""

# Vérifier que le répertoire existe
if [ ! -d "${MIGRATION_DIR}" ]; then
    echo "❌ ERREUR: Répertoire ${MIGRATION_DIR} introuvable"
    exit 1
fi

# Compter les fichiers SQL
SQL_FILES=$(find "${MIGRATION_DIR}" -name "*.sql" -type f | sort)
COUNT=$(echo "$SQL_FILES" | wc -l)

if [ "$COUNT" -eq "0" ]; then
    echo "⚠️  Aucun fichier SQL trouvé dans ${MIGRATION_DIR}"
    exit 0
fi

echo "📁 ${COUNT} fichier(s) SQL trouvé(s)"
echo ""

# Appliquer chaque migration
SUCCESS=0
FAILED=0

while IFS= read -r file; do
    filename=$(basename "$file")
    echo "⏳ Application de ${filename}..."
    
    if PGPASSWORD="${PGPASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "$file" > /dev/null 2>&1; then
        echo "  ✅ ${filename} appliquée avec succès"
        ((SUCCESS++))
    else
        echo "  ❌ ${filename} a échoué"
        ((FAILED++))
    fi
done <<< "$SQL_FILES"

echo ""
echo "📊 Résumé:"
echo "  ✅ Réussies: ${SUCCESS}"
echo "  ❌ Échouées: ${FAILED}"

if [ "$FAILED" -gt "0" ]; then
    echo ""
    echo "⚠️  Certaines migrations ont échoué. Vérifiez les logs ci-dessus."
    exit 1
else
    echo ""
    echo "✅ Toutes les migrations ont été appliquées avec succès !"
    exit 0
fi
