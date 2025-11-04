#!/usr/bin/env python3
"""
Script pour lier automatiquement les essais aux sondages
en se basant sur le code_sondage
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    # Connexion DB
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    print("🔍 Recherche des essais orphelins...")
    
    # 1. Compter les essais sans sondage_id
    orphans = await conn.fetchval("""
        SELECT COUNT(*) 
        FROM essais 
        WHERE sondage_id IS NULL AND deleted_at IS NULL
    """)
    print(f"   → {orphans} essais orphelins trouvés")
    
    if orphans == 0:
        print("✅ Aucun essai orphelin!")
        await conn.close()
        return
    
    # 2. Trouver les correspondances par code
    print("\n🔗 Recherche des correspondances par code...")
    
    matches = await conn.fetch("""
        SELECT 
            e.id as essai_id,
            e.type_essai,
            e.code_sondage,
            s.id as sondage_id,
            s.code as sondage_code
        FROM essais e
        JOIN sondages s ON UPPER(TRIM(e.code_sondage)) = UPPER(TRIM(s.code))
        WHERE e.sondage_id IS NULL 
          AND e.deleted_at IS NULL
          AND s.deleted_at IS NULL
    """)
    
    print(f"   → {len(matches)} correspondances exactes trouvées")
    
    if len(matches) == 0:
        print("\n⚠️  Aucune correspondance exacte. Essai avec similarité...")
        
        # Activer l'extension pg_trgm si pas déjà fait
        await conn.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        
        matches = await conn.fetch("""
            SELECT 
                e.id as essai_id,
                e.type_essai,
                e.code_sondage,
                s.id as sondage_id,
                s.code as sondage_code,
                similarity(e.code_sondage, s.code) as sim
            FROM essais e
            CROSS JOIN sondages s
            WHERE e.sondage_id IS NULL 
              AND e.deleted_at IS NULL
              AND s.deleted_at IS NULL
              AND similarity(e.code_sondage, s.code) > 0.6
            ORDER BY sim DESC
        """)
        
        print(f"   → {len(matches)} correspondances par similarité (>60%) trouvées")
    
    if len(matches) == 0:
        print("\n❌ Aucune correspondance trouvée!")
        await conn.close()
        return
    
    # 3. Afficher quelques exemples
    print("\n📋 Exemples de correspondances:")
    for i, m in enumerate(matches[:5]):
        sim = m.get('sim', 1.0)
        print(f"   {i+1}. {m['code_sondage']} → {m['sondage_code']} ({m['type_essai']}) [sim: {sim:.2f}]")
    
    # 4. Demander confirmation
    response = input(f"\n❓ Lier ces {len(matches)} essais? (y/N): ")
    if response.lower() != 'y':
        print("❌ Annulé")
        await conn.close()
        return
    
    # 5. Mettre à jour
    print("\n🔧 Mise à jour en cours...")
    updated = 0
    
    async with conn.transaction():
        for m in matches:
            await conn.execute("""
                UPDATE essais 
                SET sondage_id = $1 
                WHERE id = $2
            """, m['sondage_id'], m['essai_id'])
            updated += 1
    
    print(f"✅ {updated} essais liés avec succès!")
    
    # 6. Vérifier le résultat pour GRANULO-PITIAH
    print("\n🔍 Vérification pour GRANULO-PITIAH...")
    result = await conn.fetchrow("""
        SELECT 
            s.code,
            COUNT(e.id) as n_essais
        FROM sondages s
        LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
        WHERE s.code LIKE '%PITIAH%'
        GROUP BY s.code
    """)
    
    if result:
        print(f"   → {result['code']}: {result['n_essais']} essais")
    else:
        print("   → Sondage non trouvé")
    
    await conn.close()
    print("\n✅ Terminé!")

if __name__ == '__main__':
    asyncio.run(main())
