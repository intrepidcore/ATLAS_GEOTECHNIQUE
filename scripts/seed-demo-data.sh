#!/bin/bash
# Script de peuplement avec données de démonstration
# Usage: ./seed-demo-data.sh

set -e

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-atlas}"
DB_NAME="${DB_NAME:-atlas_clean}"
PGPASSWORD="${PGPASSWORD:-atlas}"

echo "🌱 SEED - Données de démonstration"
echo "==================================="
echo ""

# Fonction pour exécuter une requête
exec_sql() {
    PGPASSWORD="${PGPASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "$1"
}

# 1. Peupler atlas.sondages (si vide)
echo "📍 Peuplement atlas.sondages..."
count=$(PGPASSWORD="${PGPASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "SELECT count(*) FROM atlas.sondages;")

if [ "$count" -eq 0 ]; then
    exec_sql "
    INSERT INTO atlas.sondages (id, geom, date_sondage, source, meta)
    SELECT 
        gen_random_uuid(),
        ST_SetSRID(ST_MakePoint(1.0 + i*0.01, 6.0 + i*0.01), 25231),
        now() - (i||' days')::interval,
        'Demo Seed',
        jsonb_build_object('demo', true, 'index', i, 'type', 'seed')
    FROM generate_series(1, 20) as s(i);
    "
    echo "  ✅ 20 sondages insérés"
else
    echo "  ℹ️  Table déjà peuplée ($count lignes)"
fi
echo ""

# 2. Peupler atlas.mailles (si vide)
echo "🗺️  Peuplement atlas.mailles..."
count=$(PGPASSWORD="${PGPASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "SELECT count(*) FROM atlas.mailles;")

if [ "$count" -eq 0 ]; then
    exec_sql "
    INSERT INTO atlas.mailles (id, geom, code, nom)
    SELECT 
        gen_random_uuid(),
        ST_SetSRID(
            ST_MakeEnvelope(
                i::float, 
                j::float, 
                (i+1)::float, 
                (j+1)::float
            ), 
            25231
        ),
        'M-' || i || '-' || j,
        'Maille ' || i || '-' || j
    FROM generate_series(0, 4) as s(i),
         generate_series(0, 4) as t(j);
    "
    echo "  ✅ 25 mailles insérées"
else
    echo "  ℹ️  Table déjà peuplée ($count lignes)"
fi
echo ""

# 3. Peupler atlas.essais (si vide et si sondages existe)
echo "🧪 Peuplement atlas.essais..."
sondages_count=$(PGPASSWORD="${PGPASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "SELECT count(*) FROM atlas.sondages;")
essais_count=$(PGPASSWORD="${PGPASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "SELECT count(*) FROM atlas.essais;")

if [ "$sondages_count" -gt 0 ] && [ "$essais_count" -eq 0 ]; then
    exec_sql "
    INSERT INTO atlas.essais (id, sondage_id, type_essai, profondeur, resultat)
    SELECT 
        gen_random_uuid(),
        s.id,
        (ARRAY['SPT', 'CPT', 'Granulo', 'Atterberg'])[floor(random()*4 + 1)],
        (random() * 10)::numeric(5,2),
        jsonb_build_object('valeur', (random() * 100)::numeric(5,2), 'unite', 'kPa')
    FROM atlas.sondages s
    CROSS JOIN generate_series(1, 3) as t(i)
    LIMIT 50;
    "
    echo "  ✅ 50 essais insérés"
else
    if [ "$sondages_count" -eq 0 ]; then
        echo "  ⚠️  Pas de sondages disponibles"
    else
        echo "  ℹ️  Table déjà peuplée ($essais_count lignes)"
    fi
fi
echo ""

# 4. Résumé final
echo "📊 RÉSUMÉ DES DONNÉES"
echo "---------------------"
exec_sql "
SELECT 
    schemaname || '.' || tablename as table_name,
    (xpath('/row/cnt/text()', query_to_xml(format('SELECT count(*) as cnt FROM %I.%I', schemaname, tablename), false, true, '')))[1]::text::int AS row_count
FROM pg_tables 
WHERE schemaname = 'atlas' 
  AND tablename IN ('sondages', 'mailles', 'essais', 'classifications')
ORDER BY tablename;
" | grep -v "^$" || echo "  (aucune donnée)"

echo ""
echo "✅ Seed terminé avec succès"
echo ""
echo "💡 Pour tester l'UI:"
echo "   http://localhost:8080/db-manager.html"
