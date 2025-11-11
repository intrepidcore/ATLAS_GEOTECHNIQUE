#!/bin/bash
# Script d'inspection rapide de la base de données
# Affiche les schémas, tables et row counts

set -e

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-atlas}"
DB_NAME="${DB_NAME:-atlas_clean}"
PGPASSWORD="${PGPASSWORD:-atlas}"

echo "🔍 INSPECTION BASE DE DONNÉES"
echo "================================"
echo "Host: ${DB_HOST}:${DB_PORT}"
echo "Database: ${DB_NAME}"
echo ""

# Fonction pour exécuter une requête
query() {
    PGPASSWORD="${PGPASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "$1"
}

# 1. Schémas disponibles
echo "📂 SCHÉMAS DISPONIBLES"
echo "----------------------"
query "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') ORDER BY schema_name;" | while read schema; do
    echo "  • $schema"
done
echo ""

# 2. Tables par schéma avec row counts
for schema in "public" "atlas"; do
    echo "📋 TABLES DANS '$schema' (avec nombre de lignes)"
    echo "------------------------------------------------"
    
    # Obtenir la liste des tables
    tables=$(query "SELECT tablename FROM pg_tables WHERE schemaname='$schema' AND tablename NOT LIKE 'staging_test%' ORDER BY tablename;")
    
    if [ -z "$tables" ]; then
        echo "  (aucune table)"
        echo ""
        continue
    fi
    
    # Pour chaque table, compter les lignes
    echo "$tables" | while read table; do
        if [ -n "$table" ]; then
            count=$(query "SELECT count(*) FROM ${schema}.\"${table}\";")
            if [ "$count" -eq 0 ]; then
                printf "  %-30s %10s (vide)\n" "$table" "$count"
            else
                printf "  %-30s %10s lignes\n" "$table" "$count"
            fi
        fi
    done
    echo ""
done

# 3. Tables vides (potentiellement problématiques)
echo "⚠️  TABLES VIDES (peuvent causer 'Aucune donnée' dans l'UI)"
echo "-----------------------------------------------------------"
for schema in "public" "atlas"; do
    tables=$(query "SELECT tablename FROM pg_tables WHERE schemaname='$schema' AND tablename NOT LIKE 'staging_test%' ORDER BY tablename;")
    echo "$tables" | while read table; do
        if [ -n "$table" ]; then
            count=$(query "SELECT count(*) FROM ${schema}.\"${table}\";")
            if [ "$count" -eq 0 ]; then
                echo "  • ${schema}.${table}"
            fi
        fi
    done
done
echo ""

# 4. Top 10 tables les plus volumineuses
echo "📊 TOP 10 TABLES LES PLUS VOLUMINEUSES"
echo "---------------------------------------"
for schema in "public" "atlas"; do
    tables=$(query "SELECT tablename FROM pg_tables WHERE schemaname='$schema' AND tablename NOT LIKE 'staging_test%';")
    echo "$tables" | while read table; do
        if [ -n "$table" ]; then
            count=$(query "SELECT count(*) FROM ${schema}.\"${table}\";")
            echo "${count}|${schema}.${table}"
        fi
    done
done | sort -t'|' -k1 -rn | head -10 | while IFS='|' read count table; do
    printf "  %-40s %10s lignes\n" "$table" "$count"
done
echo ""

# 5. Résumé
echo "📈 RÉSUMÉ"
echo "---------"
total_public=$(query "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'staging_test%';")
total_atlas=$(query "SELECT count(*) FROM pg_tables WHERE schemaname='atlas' AND tablename NOT LIKE 'staging_test%';")
echo "  Tables dans 'public': $total_public"
echo "  Tables dans 'atlas':  $total_atlas"
echo ""
echo "✅ Inspection terminée"
