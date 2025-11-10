#!/bin/bash
# Wait for PostgreSQL to be ready
# Usage: ./wait-for-db.sh [timeout_seconds]

set -e

TIMEOUT="${1:-30}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-atlas}"
DB_NAME="${DB_NAME:-atlas_clean}"

echo "⏳ Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."

start_time=$(date +%s)

while true; do
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready"
        
        # Vérifier que la DB existe et est accessible
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
            echo "✅ Database $DB_NAME is accessible"
            exit 0
        else
            echo "⚠️  PostgreSQL is up but database $DB_NAME is not accessible"
        fi
    fi
    
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    
    if [ $elapsed -ge $TIMEOUT ]; then
        echo "❌ Timeout after ${TIMEOUT}s waiting for PostgreSQL"
        exit 1
    fi
    
    echo "⏳ Still waiting... (${elapsed}s/${TIMEOUT}s)"
    sleep 2
done
