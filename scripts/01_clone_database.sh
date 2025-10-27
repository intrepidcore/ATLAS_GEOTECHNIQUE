#!/bin/bash
# ============================================================================
# Script 01: Cloner la base Atlas sans données géotechniques
# ============================================================================
# Description: Dump schema + données référentielles, puis restore dans atlas_clean
# Usage: ./01_clone_database.sh
# ============================================================================

set -e  # Exit on error

# ============================================================================
# CONFIGURATION - À ADAPTER À VOTRE ENVIRONNEMENT
# ============================================================================

# Base source (production)
PGHOST_SRC="${PGHOST_SRC:-localhost}"
PGPORT_SRC="${PGPORT_SRC:-5432}"
PGUSER_SRC="${PGUSER_SRC:-postgres}"
PGDB_SRC="${PGDB_SRC:-atlas_prod}"

# Base destination (clean)
PGHOST_DST="${PGHOST_DST:-localhost}"
PGPORT_DST="${PGPORT_DST:-5432}"
PGUSER_DST="${PGUSER_DST:-postgres}"
PGDB_DST="${PGDB_DST:-atlas_clean}"

# Fichier dump
DUMP_FILE="${DUMP_FILE:-/tmp/atlas_base_wo_geotech.dump}"

# Couleurs pour output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================================================
# FONCTIONS UTILITAIRES
# ============================================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "Commande '$1' non trouvée. Installez PostgreSQL client tools."
        exit 1
    fi
}

# ============================================================================
# VÉRIFICATIONS PRÉALABLES
# ============================================================================

log_info "Vérification des prérequis..."
check_command pg_dump
check_command createdb
check_command psql
check_command pg_restore

# Vérifier connexion base source
log_info "Test connexion à la base source: $PGDB_SRC@$PGHOST_SRC:$PGPORT_SRC"
if ! psql -h "$PGHOST_SRC" -p "$PGPORT_SRC" -U "$PGUSER_SRC" -d "$PGDB_SRC" -c "SELECT 1" > /dev/null 2>&1; then
    log_error "Impossible de se connecter à la base source"
    exit 1
fi
log_info "✓ Connexion source OK"

# ============================================================================
# ÉTAPE 1: DUMP DE LA BASE SOURCE (sans données géotech)
# ============================================================================

log_info "Étape 1/4: Dump de la base source (schema + données référentielles)..."
log_warn "Exclusion des données des tables géotechniques..."

pg_dump -h "$PGHOST_SRC" -p "$PGPORT_SRC" -U "$PGUSER_SRC" -d "$PGDB_SRC" \
  -Fc \
  --no-owner \
  --no-privileges \
  --verbose \
  --exclude-table-data=public.sondages \
  --exclude-table-data=public.essais \
  --exclude-table-data=public.essais_geotechniques \
  --exclude-table-data=public.echantillons \
  --exclude-table-data=public.essais_atterberg \
  --exclude-table-data=public.essais_vbs \
  --exclude-table-data=public.essais_proctor \
  --exclude-table-data=public.granulo_points \
  --exclude-table-data=public.imports \
  --exclude-table-data=public.import_items \
  --exclude-table-data=public.import_logs \
  --exclude-table-data=public.import_mapping_profiles \
  --exclude-table-data=public.test_type_defaults \
  --exclude-table-data=public.refresh_queue \
  -f "$DUMP_FILE"

if [ $? -eq 0 ]; then
    log_info "✓ Dump créé: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
else
    log_error "Échec du dump"
    exit 1
fi

# ============================================================================
# ÉTAPE 2: CRÉATION DE LA BASE DESTINATION
# ============================================================================

log_info "Étape 2/4: Création de la base destination: $PGDB_DST..."

# Supprimer si existe (ATTENTION: destructif!)
if psql -h "$PGHOST_DST" -p "$PGPORT_DST" -U "$PGUSER_DST" -lqt | cut -d \| -f 1 | grep -qw "$PGDB_DST"; then
    log_warn "La base $PGDB_DST existe déjà. Suppression..."
    dropdb -h "$PGHOST_DST" -p "$PGPORT_DST" -U "$PGUSER_DST" "$PGDB_DST" --if-exists
fi

# Créer base vide
createdb -h "$PGHOST_DST" -p "$PGPORT_DST" -U "$PGUSER_DST" "$PGDB_DST" \
  --encoding=UTF8 \
  --locale=en_US.UTF-8 \
  --template=template0

log_info "✓ Base $PGDB_DST créée"

# ============================================================================
# ÉTAPE 3: ACTIVATION DES EXTENSIONS
# ============================================================================

log_info "Étape 3/4: Activation des extensions PostGIS..."

psql -h "$PGHOST_DST" -p "$PGPORT_DST" -U "$PGUSER_DST" -d "$PGDB_DST" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS postgis_topology;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    
    SELECT PostGIS_Full_Version();
EOSQL

log_info "✓ Extensions activées"

# ============================================================================
# ÉTAPE 4: RESTORE DU DUMP
# ============================================================================

log_info "Étape 4/4: Restore du dump dans $PGDB_DST..."

pg_restore \
  -h "$PGHOST_DST" \
  -p "$PGPORT_DST" \
  -U "$PGUSER_DST" \
  -d "$PGDB_DST" \
  --no-owner \
  --no-privileges \
  --verbose \
  -j 4 \
  "$DUMP_FILE"

if [ $? -eq 0 ]; then
    log_info "✓ Restore terminé"
else
    log_warn "Restore terminé avec warnings (normal si extensions déjà créées)"
fi

# ============================================================================
# ÉTAPE 5: VÉRIFICATIONS POST-RESTORE
# ============================================================================

log_info "Vérifications post-restore..."

psql -h "$PGHOST_DST" -p "$PGPORT_DST" -U "$PGUSER_DST" -d "$PGDB_DST" <<-EOSQL
    \echo '=== Tables référentielles (doivent avoir des données) ==='
    SELECT 'mailles' as table_name, COUNT(*) as count FROM mailles
    UNION ALL
    SELECT 'adm_0', COUNT(*) FROM adm_0
    UNION ALL
    SELECT 'adm_2', COUNT(*) FROM adm_2
    UNION ALL
    SELECT 'adm_3', COUNT(*) FROM adm_3;
    
    \echo ''
    \echo '=== Tables géotechniques (doivent être vides) ==='
    SELECT 'sondages' as table_name, COUNT(*) as count FROM sondages
    UNION ALL
    SELECT 'essais_geotechniques', COUNT(*) FROM essais_geotechniques
    UNION ALL
    SELECT 'echantillons', COUNT(*) FROM echantillons
    UNION ALL
    SELECT 'essais_atterberg', COUNT(*) FROM essais_atterberg
    UNION ALL
    SELECT 'essais_vbs', COUNT(*) FROM essais_vbs
    UNION ALL
    SELECT 'essais_proctor', COUNT(*) FROM essais_proctor
    UNION ALL
    SELECT 'granulo_points', COUNT(*) FROM granulo_points;
    
    \echo ''
    \echo '=== Extensions ==='
    SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'postgis_topology', 'pgcrypto');
EOSQL

# ============================================================================
# ÉTAPE 6: REFRESH MATERIALIZED VIEW (vide pour l'instant)
# ============================================================================

log_info "Refresh de la vue matérialisée (vide)..."

psql -h "$PGHOST_DST" -p "$PGPORT_DST" -U "$PGUSER_DST" -d "$PGDB_DST" <<-EOSQL
    REFRESH MATERIALIZED VIEW IF EXISTS mailles_geotechnique_stats;
    SELECT COUNT(*) as mailles_total FROM mailles_geotechnique_stats;
EOSQL

# ============================================================================
# FIN
# ============================================================================

log_info "=========================================="
log_info "✅ CLONE TERMINÉ AVEC SUCCÈS"
log_info "=========================================="
log_info "Base destination: $PGDB_DST"
log_info "Dump sauvegardé: $DUMP_FILE"
log_info ""
log_info "Prochaines étapes:"
log_info "  1. Pointer l'API vers $PGDB_DST (DATABASE_URL dans .env)"
log_info "  2. Redémarrer l'API: docker compose up -d --build api"
log_info "  3. Importer vos données avec le script Python (02_import_excel.py)"
log_info ""
log_info "Pour supprimer le dump: rm $DUMP_FILE"
