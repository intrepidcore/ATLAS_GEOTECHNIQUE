#!/usr/bin/env python3
"""
Synchronise les étudiants de colab_student_prefs vers colab_students
Crée automatiquement des utilisateurs si nécessaire
"""

import os
import sys
import hashlib
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

def get_database_url():
    """Récupère DATABASE_URL avec fallback db -> localhost"""
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        raise ValueError("DATABASE_URL non définie")
    
    # Fallback db -> localhost
    if '@db:' in database_url:
        database_url = database_url.replace('@db:', '@localhost:')
    
    return database_url

def sync_students(dry_run=False):
    """Synchronise les étudiants vers colab_students"""
    
    database_url = get_database_url()
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    print("=" * 70)
    print("🔄 Synchronisation étudiants → colab_students")
    print("=" * 70)
    print()
    
    # 1. Récupérer les étudiants de colab_student_prefs
    cursor.execute("""
        SELECT 
            student_id,
            nom,
            prenom,
            email,
            telephone
        FROM atlas.colab_student_prefs
        ORDER BY student_id
    """)
    
    prefs = cursor.fetchall()
    print(f"📊 {len(prefs)} étudiants dans colab_student_prefs")
    print()
    
    if not prefs:
        print("⚠️  Aucun étudiant à synchroniser")
        cursor.close()
        conn.close()
        return
    
    created_users = 0
    created_students = 0
    updated_students = 0
    
    for pref in prefs:
        student_id = pref['student_id']
        nom = pref['nom']
        prenom = pref['prenom']
        email = pref['email']
        
        # 2. Vérifier si l'utilisateur existe déjà
        cursor.execute("""
            SELECT id FROM atlas.users WHERE email = %s
        """, (email,))
        
        user = cursor.fetchone()
        
        if not user:
            # Créer l'utilisateur (format: prenom_nom, sans points)
            username = f"{prenom.lower()}_{nom.lower()}".replace(' ', '_').replace('.', '')
            # Limiter à 50 caractères
            username = username[:50]
            
            # Mot de passe par défaut (à changer lors de la première connexion)
            default_password = f"Atlas2025!{student_id}"
            password_hash = hashlib.sha256(default_password.encode()).hexdigest()
            
            if dry_run:
                print(f"   [DRY-RUN] Créerait utilisateur: {email} ({username})")
                user_id = None
            else:
                cursor.execute("""
                    INSERT INTO atlas.users (
                        email, username, password_hash,
                        first_name, last_name,
                        is_active, is_verified
                    ) VALUES (
                        %s, %s, %s, %s, %s, true, false
                    )
                    ON CONFLICT (email) DO UPDATE SET
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name
                    RETURNING id
                """, (email, username, password_hash, prenom, nom))
                
                user_id = cursor.fetchone()['id']
                created_users += 1
                print(f"   ✓ Utilisateur créé: {email}")
        else:
            user_id = user['id']
        
        # 3. Créer/mettre à jour l'étudiant dans colab_students
        if not dry_run and user_id:
            cursor.execute("""
                INSERT INTO atlas.colab_students (
                    user_id, matricule, promotion
                ) VALUES (
                    %s, %s, '2024-2025'
                )
                ON CONFLICT (user_id) DO UPDATE SET
                    matricule = EXCLUDED.matricule,
                    updated_at = NOW()
                RETURNING id
            """, (user_id, student_id))
            
            result = cursor.fetchone()
            if result:
                created_students += 1
                print(f"   ✓ Étudiant créé dans colab_students: {student_id}")
        elif dry_run:
            print(f"   [DRY-RUN] Créerait/mettrait à jour étudiant: {student_id}")
    
    if not dry_run:
        conn.commit()
    
    print()
    print("=" * 70)
    print("📊 RÉSUMÉ")
    print("=" * 70)
    print(f"Mode: {'DRY-RUN' if dry_run else 'PRODUCTION'}")
    print(f"Utilisateurs créés: {created_users}")
    print(f"Étudiants créés/mis à jour: {created_students}")
    print()
    
    # Vérifier le compteur
    if not dry_run:
        cursor.execute("SELECT COUNT(*) as total FROM atlas.colab_students")
        total = cursor.fetchone()['total']
        print(f"✅ Total étudiants dans colab_students: {total}")
        print()
        print("💡 Les étudiants devraient maintenant apparaître dans Colab Studio")
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Synchronise les étudiants vers colab_students')
    parser.add_argument('--dry-run', type=str, default='false', 
                        help='Mode simulation (true/false)')
    
    args = parser.parse_args()
    dry_run = args.dry_run.lower() == 'true'
    
    sync_students(dry_run=dry_run)
