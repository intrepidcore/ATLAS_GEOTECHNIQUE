
Je te donne maintenant **la roadmap réelle vers une v1.0 commerciale**.

---

# 🎯 OBJECTIF FINAL

Un `.exe` NSIS qui :

1. Installe Atlas
    
2. Installe PostgreSQL + PostGIS embarqué
    
3. Initialise la DB
    
4. Applique les migrations
    
5. Importe **le dataset complet**
    
6. Lance l’application
    
7. Fonctionne 100% offline
    
8. Permet backup / restore
    

---

# 🧭 ROADMAP RÉELLE VERS V1.0 ENTERPRISE

---

# PHASE 7 — Dataset Master Industriel

Tu ne dois PLUS dépendre d’un SQL écrit à la main.

Tu dois générer un export structuré.

---

## 7.1 — Geler la base métier de référence

Sur ton environnement principal (Docker ou local stable) :

```powershell
pg_dump -U postgres -h 127.0.0.1 -p 5432 -d atlas_clean `
  --data-only `
  --column-inserts `
  --schema=atlas `
  --file=dataset_v1.sql
```

⚠ Important :

- `--column-inserts`
    
- data-only
    
- schema ciblé
    
- pas de DROP
    
- pas de CREATE TABLE
    

Ensuite :

- Nettoyer les séquences
    
- Vérifier FK order
    
- Tester import sur DB vide
    

---

## 7.2 — Versioning strict

Créer :

```
atlas/dataset/
    dataset_v1.sql
    DATASET_MANIFEST.json
```

Manifest :

```json
{
  "version": "1.0.0",
  "schema_hash": "sha256...",
  "dataset_hash": "sha256...",
  "created_at": "2026-03-01",
  "compatible_schema": ">=1.0.0"
}
```

---

## 7.3 — Idempotence robuste

Le bootstrap doit :

1. Vérifier `dataset_metadata`
    
2. Vérifier hash
    
3. Si mismatch → erreur contrôlée
    
4. Pas d’auto override
    

---

# PHASE 8 — Packaging PostgreSQL / PostGIS définitif

Tu dois figer :

```
src-tauri/pg/
    bin/
    lib/
    share/
```

Puis dans `tauri.conf.json` :

```json
"resources": [
  "pg/**/*"
]
```

Test obligatoire :

- Machine Windows vierge
    
- Sans Postgres installé
    
- Sans Docker
    
- Sans PATH modifié
    

---

# PHASE 9 — Flux Desktop Définitif

Ordre strict :

```
1. Start embedded PG
2. Wait port
3. Create DB if not exists
4. Apply migrations
5. Import dataset
6. Start api-geo
7. Start UI
```

Si une étape échoue → rollback + log + message UI propre.

---

# PHASE 10 — Support Produit

Tu vends un logiciel. Il faut :

## 10.1 Backup automatique

```powershell
pg_dump atlas_clean > backup_2026_03_01.sql
```

UI bouton :

> Sauvegarder la base

---

## 10.2 Restore contrôlé

- Stop API
    
- Drop DB
    
- Restore dump
    
- Restart
    

---

## 10.3 Reset usine

Option cachée :

```
--reset-db
```

Supprime data dir + relance bootstrap.

---

# PHASE 11 — Sécurité & Stabilité

- mot de passe DB généré aléatoirement
    
- stocké Windows Credential Manager
    
- pas hardcodé
    
- logs rotation
    
- ACL Windows sur data_dir
    

---

# PHASE 12 — Mise à jour future (important)

À l’update :

- migrations schema
    
- migrations data
    

---

# PHASE 13 — Expérience installateur premium

Pour ressembler à Autodesk :

- écran splash moderne
    
- progression détaillée :
    
    - Installing PostgreSQL runtime
        
    - Creating database
        
    - Installing PostGIS extension
        
    - Importing dataset
        
    - Finalizing configuration
        
- logs visibles
    
 tu génères **le code complet d'un installateur logiciel multi-écran** pour Windows/macOS, prêt à build avec Tauri. Pas de mockup : le code doit être fonctionnel, avec navigation, gestion de state et interactions réelles.  

**Nom du logiciel** : Atlas Géotechnique  
**Technos** : React + TypeScript + TailwindCSS + Tauri  
**Objectif** : installer le logiciel + runtime PostgreSQL/PostGIS embarqué + modules optionnels  

---

### **Écrans / Flux**
1. **Bienvenue**
   - Logo + nom logiciel + version  
   - Bouton “Suivant”

2. **Choix du dossier d’installation**
   - Input texte + bouton “Parcourir” pour sélectionner dossier  
   - Affichage disque détecté automatiquement  
   - Vérification d’espace libre (>2Go)  
   - Bouton “Suivant”

3. **Options d’installation**
   - Checkbox : “Installer DB intégrée (PostgreSQL + PostGIS)”  
   - Checkbox : “Installer modules supplémentaires”  
   - Info bulle ou texte explicatif pour chaque option  
   - Bouton “Suivant”

4. **Résumé**
   - Affiche chemin d’installation + options sélectionnées  
   - Bouton “Installer” (active la progression)

5. **Progression**
   - Barre animée principale + sous-étapes (copie runtime PG, création base, extensions PostGIS)  
   - Texte dynamique “Étape actuelle : …”  
   - Gestion d’erreur simple (ex: pop-up ou message inline)

6. **Fin**
   - Message “Installation terminée”  
   - Bouton “Terminer”  
   - Option “Lancer Atlas Géotechnique” (via invoke Tauri)

---

### **Design**
- Palette : gris clair / blanc / bleu profond (accents)  
- Typographie : sans serif, moderne  
- Responsive : 1080p → 4K  
- Barres de progression smooth + animées  
- Icônes simples vectoriels cohérents avec le logo  

---

### **Fonctionnalités techniques**
- Navigation entre écrans gérée par state global ou Context API  
- Validation du chemin d’installation  
- Calcul d’espace disque avant installation  
- Vérification présence runtime PostgreSQL/PostGIS (si DB intégrée)  
- Gestion des erreurs + messages utilisateur  
- Interaction Tauri `invoke` pour :  
  - Copie fichiers / runtime  
  - Création DB + extensions  
  - Lancement de l’exe  
- Toutes les variables sensibles doivent rester locales (pas de logging full path ou DB passwords)

---

### **Livrable attendu**
- Fichiers TypeScript / React complets (`App.tsx`, composants par écran, hooks pour state, TailwindCSS)  
- Scripts pour Tauri (`invoke` calls`) intégrés  
- Commentaires clairs expliquant chaque section  
- lancement des commande pour le builder l’installateur (`npm install && npm run tauri build`)

---

# PHASE 14 — Validation v1.0

Checklist finale :

|Test|OK|
|---|---|
|Machine vierge Windows 10||
|Machine Windows 11||
|Sans internet||
|Dataset complet présent||
|Backup fonctionne||
|Restore fonctionne||
|Reset fonctionne||
|Désinstallation propre||
