
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

# 🔧 Configuration (source of truth) & variables d’environnement

Cette section est volontairement **très concrète** : elle décrit les variables réellement utilisées par le code Desktop (`apps/atlas-pro/src-tauri`) et par l’API (`services/api-geo`).

Objectif :

- éviter les divergences “document vs code”
- éviter les .env non versionnés impossibles à reproduire
- permettre un boot Desktop totalement offline et déterministe

## Variables Desktop (Tauri)

Ces variables sont lues directement dans le code Desktop (bootstrap Postgres/DB).

### Base de données (noms)

- `DB_NAME`
  - défaut : `atlas_clean`
  - usage : nom de la DB créée/restaurée par le Desktop

- `DB_USER`
  - défaut : `atlas`
  - usage : rôle Postgres utilisé par l’application Desktop

Remarque : le mot de passe est géré par le Desktop (Credential Manager) et n’est pas un `.env`.

### Seed dump (dataset embarqué)

- `ATLAS_DESKTOP_SEED_DUMP_PATH`
  - optionnel
  - usage : chemin explicite vers le dump de seed à restaurer (dev/tests)
  - si défini et le fichier existe → priorité absolue

- `ATLAS_FORCE_SEED_RESTORE`
  - optionnel
  - usage : autoriser le restore seed même si la DB “a l’air initialisée” (dev uniquement)
  - valeurs : `1` / `true`

#### Règles de découverte seed (fallback)

Si `ATLAS_DESKTOP_SEED_DUMP_PATH` n’est pas défini, le Desktop tente de trouver un seed dans le repo (dev) sous :

`data/db/backups/` avec des noms standards :

- `atlas_desktop_seed.dump` (recommandé)
- `atlas_desktop_seed.sql`
- `atlas_desktop_seed.backup`

Décision produit (v1) :

- **Nom canonique** : `data/db/backups/atlas_desktop_seed.dump`
- **Format canonique** : `pg_dump -Fc`

Scripts (implémentés dans le repo) :

- Génération seed + manifest : `scripts/create-desktop-seed-dump.ps1`
- Validation dump/manifest : `scripts/validate-dump.ps1`
- Génération manifest (utilisé par create-desktop-seed-dump) : `scripts/generate_seed_manifest.py`
- Vérification pré-build MSI (inputs requis) : `scripts/verify-bundle.ps1`

## PostgreSQL runtime embarqué (Desktop)

- `ATLAS_PG_BIN_DIR`
  - optionnel
  - en release : doit pointer vers `resources/pg/bin`
  - en dev : le code tente aussi `src-tauri/pg/bin`

- `ATLAS_PG_PORT`
  - optionnel
  - si défini : force le port Postgres Desktop

### Stockage local Desktop

Le Desktop stocke son état (cluster, logs, backups) sous :

- `%LOCALAPPDATA%\IntrepidCore\Atlas\`

et maintient :

- logs : `%LOCALAPPDATA%\IntrepidCore\Atlas\logs\`
- backups : `%LOCALAPPDATA%\IntrepidCore\Atlas\backups\`

## Variables API (`api-geo`)

Le backend Rust `services/api-geo` utilise :

- `DATABASE_URL` (obligatoire)
- `HOST` (défaut dans `.env.example` : `0.0.0.0`)
- `PORT` (défaut dans `.env.example` : `8000`)
- `RUST_LOG`
- `JWT_SECRET`
- `CORS_ORIGINS`

Remarque Desktop :

- En mode Desktop, l’API doit pointer vers la DB Desktop (donc un `DATABASE_URL` construit avec `DB_USER`, le mot de passe géré par le Desktop, `127.0.0.1:<ATLAS_PG_PORT>`, et `DB_NAME`).

---

# PHASE 7 — Dataset Master Industriel

Tu ne dois PLUS dépendre d’un SQL écrit à la main.

Tu dois générer un export structuré.

Le produit doit être **livré avec le dataset complet**, de manière **offline**, **reproductible**, et **vérifiable**.

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
    

Objectif de cette étape : obtenir une base **dev stable** (schéma + données) qui sert de référence pour produire un **seed dump** livré dans le produit Desktop.

Contraintes :

- La DB de référence doit être considérée comme un **artefact de release** (pas un simple état local).
- Elle doit être reproductible (procédure de build), vérifiable (hash), et testée (restore sur cluster vierge).

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

### Spécification Desktop : livrer le dataset complet (seed dump)

Dans un produit offline, la stratégie la plus robuste et la plus rapide est :

1. Le produit contient un **seed dump** de la DB (schéma + dataset complet)
2. Au premier lancement Desktop, le bootstrap restaure ce dump
3. Le bootstrap écrit un marqueur dans `atlas.desktop_state` (seed version + hash)
4. Les boots suivants **skip** le restore et ne font que gérer les upgrades (fingerprint des migrations)

### Format recommandé du seed

- Recommandé : dump **custom format**

```powershell
pg_dump -h 127.0.0.1 -p 5432 -U postgres -d atlas_clean -Fc -f seed_v1.dump
```

Pourquoi `-Fc` :

- plus rapide et fiable qu’un SQL énorme
- `pg_restore` gère mieux les objets / l’ordre de restore
- moins fragile que `--column-inserts` quand le dataset devient très gros

### Arborescence artefacts dataset (repo)

```
atlas/dataset/
  seed_v1.dump
  DATASET_MANIFEST.json
  DATASET_README.md
```

Contenu recommandé du `DATASET_MANIFEST.json` (exemple) :

```json
{
  "dataset_version": "v1",
  "app_version": "1.0.0",
  "created_at": "2026-03-01T00:00:00Z",
  "dump_format": "pg_dump_custom",
  "dataset_hash_blake3": "...",
  "dataset_hash_sha256": "...",
  "source": {
    "db_name": "atlas_clean",
    "db_engine": "postgres",
    "postgis": true
  },
  "notes": "seed v1 shipped with product"
}
```

### Stockage Desktop : `atlas.desktop_state`

Le bootstrap Desktop doit écrire (au minimum) :

- `seed_version = v1`
- `seed_hash = <blake3(seed_v1.dump)>`
- `seed_dump_path = <chemin local du dump utilisé>`
- `installed_at = <timestamp>`
- `app_version = <version>`

Ces clés sont le “tag/signature” pratique qui permet de:

- prouver qu’on est sur une base saine (seedée)
- empêcher les restores répétitifs
- diagnostiquer facilement un incident (support)

---

## 7.3 — Idempotence robuste

Le bootstrap doit :

1. Vérifier `dataset_metadata`
    
2. Vérifier hash
    
3. Si mismatch → erreur contrôlée
    
4. Pas d’auto override
    

### Règles de robustesse (très importantes Desktop)

Le Desktop n’est pas un serveur. Il faut que le bootstrap soit “safe by default”.

- Si la DB contient déjà des données et qu’elle n’est pas seedée (`seed_hash` absent) :
  - ne jamais écraser implicitement
  - proposer un workflow UI (backup/restore/reset)

- Si `seed_hash` existe :
  - considérer la DB comme “installée”
  - ne pas rejouer le seed

- Les migrations doivent être :
  - idempotentes quand c’est raisonnable (`IF NOT EXISTS`, guards)
  - et/ou protégées par un fingerprint (`migrations_fingerprint`)

### Fingerprint migrations (upgrade incrémental)

Principe :

- calculer un hash (ex: BLAKE3) de l’ensemble des fichiers migrations du repo
- stocker dans `atlas.desktop_state.migrations_fingerprint`

Au boot :

- si fingerprint identique : skip migrations
- si fingerprint différent : appliquer migrations (après backup)

Ce mécanisme permet :

- d’éviter de rejouer 100 migrations à chaque boot
- de rendre le système stable même si certaines migrations historiques ne sont pas parfaites

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
  "pg/**/*",
  "data/db/backups/atlas_desktop_seed.dump",
  "data/db/backups/atlas_desktop_seed.dump.json"
]
```

État actuel (implémenté) :

- `apps/atlas-pro/src-tauri/tauri.conf.json` embarque :
  - `pg/**/*`
  - `data/db/backups/atlas_desktop_seed.dump`
  - `data/db/backups/atlas_desktop_seed.dump.json`
- Le bootstrap Desktop résout le seed embarqué via `ATLAS_DESKTOP_SEED_DIR` (chemin resources Tauri).

Test obligatoire :

- Machine Windows vierge
    
- Sans Postgres installé
    
- Sans Docker
    
- Sans PATH modifié
    

Spécification Desktop v1 (packaging) :

- le runtime PG/PostGIS doit être embarqué (ressources Tauri)
- le bootstrap doit fonctionner sans Docker, sans internet, sans dépendances système
- le bootstrap doit éviter les collisions de ports
- le port effectif doit être :
  - détecté au démarrage
  - persisté dans un fichier (ex: `postgres.port`) pour les redémarrages

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

### Spécification Desktop v1 (avec dataset complet embarqué)

L’ordre réel recommandé devient (plus précis) :

```
0. Acquire single-instance lock
1. Start embedded PG (cluster + runtime)
2. Wait port
3. Ensure DB user/password (Credential Manager)
4. Create DB if not exists
5. Ensure PostGIS enabled
6. Ensure atlas.desktop_state exists
7. First-run: restore embedded seed dump (v1) if DB looks empty
8. Persist seed hash/version in desktop_state
9. Compute migrations fingerprint
10. If fingerprint changed: backup DB (optional v1) then apply repo migrations
11. Persist migrations fingerprint
12. Start api-geo (pointed to embedded PG)
13. Set UI runtime API base (window.__API_GEO__ / config)
14. Start UI
```

### Détails importants

#### 9.A — Seed dump (dataset complet) vs migrations

Le **seed dump** sert à :

- garantir un état initial cohérent ;
- éviter de rejouer des migrations historiques fragiles ;
- accélérer considérablement le premier boot ;
- garantir que le produit est livré "prêt à l’emploi".

Les migrations servent à :

- appliquer des upgrades incrémentaux (v1.0.1 → v1.0.2, etc.) ;
- corriger/faire évoluer le schéma au fil des releases.

#### 9.B — Hashes / signature / intégrité

Minimum viable (Desktop v1) :

- Calculer `seed_hash = blake3(seed_v1.dump)`.
- Stocker `seed_hash` dans `atlas.desktop_state`.
- À chaque boot :
  - si `seed_hash` est présent → on sait que la DB a été seedée.
  - si `seed_hash` absent et DB vide → restore.

Option renforcée :

- Vérifier aussi la présence de `DATASET_MANIFEST.json` et comparer `dataset_hash`.
- En release, vérifier l’intégrité du dump avant restore.

#### 9.C — Rollback / backup avant migration

Avant d’appliquer des migrations (quand fingerprint change) :

- faire un backup automatique dans `LOCALAPPDATA/IntrepidCore/Atlas/backups/` (format `-Fc` recommandé) ;
- calculer un hash du backup ;
- enregistrer le chemin/hash dans `desktop_state` (ou une table `atlas.desktop_backups`).

Si migration échoue :

- restaurer automatiquement le backup précédent ;
- afficher un message UI "Mise à jour échouée — restauration effectuée" ;
- proposer d’exporter un diagnostic.

---

# PHASE 10 — Support Produit

Tu vends un logiciel. Il faut :

## 10.1 Backup automatique

```powershell
pg_dump atlas_clean > backup_2026_03_01.sql
```

UI bouton :

> Sauvegarder la base

Spécification Desktop v1 :

- Le bouton doit déclencher un dump `pg_dump -Fc`.
- Le backup doit inclure :
  - la version applicative ;
  - le seed version/hash ;
  - le migrations fingerprint.

Convention de nommage recommandée :

```
atlas_{db_name}_{app_version}_{timestamp}.dump
atlas_{db_name}_{app_version}_{timestamp}.json   (manifest)
```

Le manifest backup contient :

- `created_at`
- `app_version`
- `seed_hash`
- `migrations_fingerprint`
- `backup_hash`

Le support produit doit pouvoir demander :

- le fichier backup
- le diagnostic export

---

## 10.2 Restore contrôlé

- Stop API
    
- Drop DB
    
- Restore dump
    
- Restart
    

Règles :

- stop api-geo avant restore
- exécuter restore en mode “ON_ERROR_STOP”
- après restore :
  - re-vérifier PostGIS
  - re-vérifier `seed_hash` / fingerprint
  - appliquer migrations si nécessaire

---

## 10.3 Reset usine

Option cachée :

```
--reset-db
```

Supprime data dir + relance bootstrap.

Recommandation Desktop : ne pas supprimer brutalement.

- renommer (quarantiner) le dossier `postgres/` et conserver un timestamp
- relancer bootstrap (qui restaure seed v1)

---

# PHASE 11 — Sécurité & Stabilité

- mot de passe DB généré aléatoirement
    
- stocké Windows Credential Manager
    
- pas hardcodé
    
- logs rotation
    
- ACL Windows sur data_dir

Exigences sécurité Desktop v1 :

- mot de passe DB :
  - généré aléatoirement
  - stocké dans Credential Manager
  - jamais loggé
- logs : rotation + export diagnostic
- permissions : ACL strictes sur data_dir/logs_dir
- pas de fuite de chemins sensibles / secrets dans les logs

---

# PHASE 12 — Mise à jour future (important)

À l’update :

- migrations schema
    
- migrations data

Politique d’upgrade recommandée :

- upgrades petits : migrations incrémentales
- upgrades massifs : nouveau seed dump + bump `seed_version`

Dans tous les cas :

- backup automatique avant modification
- rollback si échec
- update `migrations_fingerprint` uniquement si tout a réussi

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

Décision packaging côté sidecar (implémenté) :

- Le backend `api-geo` (sidecar) ne doit **pas** ouvrir de fenêtre console en release Windows.
- Implémentation : `services/api-geo/src/main.rs` → `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`

Ajout important (dataset complet embarqué) :

- l’utilisateur ne doit pas “télécharger un dataset”
- l’installateur doit afficher la progression locale :
  - restauration seed
  - migrations
  - démarrage services

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

Checklist dataset embarqué + tags + upgrades :

- Premier lancement (DB vide) :
  - restore seed OK
  - `seed_hash` présent dans `atlas.desktop_state`
  - `migrations_fingerprint` présent

- Second lancement :
  - aucun restore seed
  - aucune migration rejouée si fingerprint identique

- Upgrade simulé (post-v1) :
  - fingerprint change → backup auto
  - migration appliquée
  - fingerprint mis à jour
  - rollback fonctionne si migration volontairement cassée
