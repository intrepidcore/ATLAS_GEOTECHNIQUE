#!/usr/bin/env python3
"""Test connexion PostgreSQL rapide avec timeout"""

import psycopg
import sys

dsn = "postgresql://atlas:atlas@localhost:5432/atlas_clean"

print("Test connexion PostgreSQL (timeout 5s)...")
print(f"DSN: {dsn}")
print()

try:
    # Connexion avec timeout
    with psycopg.connect(dsn, connect_timeout=5) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM sondages")
            count = cur.fetchone()[0]
            print(f"✓ Connexion OK - {count} sondages en base")
            sys.exit(0)
            
except psycopg.OperationalError as e:
    print(f"✗ PostgreSQL ne répond pas")
    print(f"  Erreur: {e}")
    print()
    print("SOLUTIONS:")
    print("  1. PostgreSQL n'est pas démarré")
    print("     → Démarrer le service PostgreSQL")
    print()
    print("  2. PostgreSQL est dans Docker")
    print("     → docker compose up -d db")
    print()
    print("  3. Mauvais port/host")
    print("     → Vérifier que PostgreSQL écoute sur localhost:5432")
    print()
    sys.exit(1)
    
except Exception as e:
    print(f"✗ Erreur: {e}")
    sys.exit(1)
