# ✅ Câblage Base de Données Vérifié

**Date:** 2024-10-24  
**Status:** ✅ **OPÉRATIONNEL**

---

## 🎯 Résultat de la Vérification

### Configuration Actuelle

```
✅ API → atlas_clean
✅ Sondages dans atlas_clean: 0 (vide, prêt)
✅ Mailles dans atlas_clean: 29,407
✅ API Health: OK
✅ Endpoint coverage/mailles: Fonctionnel
```

---

## 🔧 Problème Résolu

### Symptôme Initial
L'API pointait vers `atlas` au lieu de `atlas_clean` malgré la modification du fichier `.env`.

### Cause Racine
Le fichier `.env.example` était chargé **après** `.env` dans `docker-compose.yml` et écrasait les valeurs :

```yaml
api-geo:
  env_file:
    - ./.env          # ✅ Chargé en premier
    - ./.env.example  # ❌ Écrasait les valeurs
```

### Solution Appliquée

1. **Mise à jour de `.env.example`**
   ```bash
   POSTGRES_DB=atlas_clean
   DATABASE_URL=postgres://atlas:atlas@db:5432/atlas_clean
   ```

2. **Redémarrage avec rechargement des variables**
   ```bash
   docker compose up -d api-geo
   ```
   
   ⚠️ **Note:** `docker compose restart` ne recharge PAS les variables d'environnement. Il faut utiliser `up -d`.

---

## 📊 État des Bases

### Base `atlas` (Ancienne - Préservée)
- **Sondages:** 26,005
- **Usage:** Données originales conservées
- **Status:** Non utilisée par l'API

### Base `atlas_clean` (Nouvelle - Active)
- **Sondages:** 0 ✅
- **Mailles:** 29,407 ✅
- **ADM1:** 5 ✅
- **ADM2:** 40 ✅
- **ADM3:** 373 ✅
- **Usage:** Base active pour l'API
- **Status:** Prête pour import

---

## 🚀 Prochaines Étapes

### 1. Vérifier l'UI

Ouvrir **http://localhost:8080** :
- ✅ Carte affichée
- ✅ Mailles visibles
- ✅ **Aucun sondage** (normal)
- ✅ Pas d'erreur CORS

### 2. Préparer les Données Excel

Créer un fichier `mes_donnees.xlsx` avec les feuilles :
- `sondages`
- `echantillons`
- `atterberg`
- `vbs`
- `proctor`

📄 **Voir:** `docs/GUIDE_ACADEMIQUE_SAISIE_DONNEES.md`

### 3. Installer Dépendances Python

```powershell
pip install pandas openpyxl psycopg[binary]
```

### 4. Import (Dry-Run)

```powershell
python scripts/02_import_excel.py `
  --file data/mes_donnees.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --dry-run
```

### 5. Import Réel

```powershell
python scripts/02_import_excel.py `
  --file data/mes_donnees.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean"
```

---

## 🛠️ Script de Vérification

Un script PowerShell a été créé pour vérifier le câblage :

```powershell
.\scripts\check-db-wiring.ps1
```

**Ce script vérifie:**
- ✅ Variables d'environnement de l'API
- ✅ Fichiers `.env` et `.env.example`
- ✅ Comptage des sondages dans les deux bases
- ✅ Healthcheck de l'API
- ✅ Endpoints fonctionnels

---

## 📚 Documentation Associée

- **Clone DB:** `docs/CLONE_DB_SUCCESS.md`
- **Import Guide:** `docs/GUIDE_IMPORT_GEOTECHNIQUE.md`
- **Saisie Données:** `docs/GUIDE_ACADEMIQUE_SAISIE_DONNEES.md`
- **CORS:** `docs/CORS_RESOLU.md`

---

## ✅ Checklist Complète

- [x] Base `atlas_clean` créée
- [x] Tables géotechniques vidées
- [x] Tables référentielles copiées
- [x] `.env` mis à jour
- [x] `.env.example` mis à jour
- [x] API redémarrée avec `up -d`
- [x] Câblage vérifié
- [x] Tests API passés
- [ ] **Données Excel préparées** ← Prochaine étape
- [ ] Import dry-run
- [ ] Import réel

---

## 💡 Leçons Apprises

### Docker Compose et Variables d'Environnement

1. **`restart` vs `up -d`**
   - `restart` : Redémarre le conteneur sans recharger les variables
   - `up -d` : Recrée le conteneur avec les nouvelles variables

2. **Ordre de chargement des `env_file`**
   - Les fichiers sont chargés dans l'ordre
   - Le dernier fichier écrase les valeurs précédentes
   - ⚠️ Attention à `.env.example` qui peut écraser `.env`

3. **Vérification des variables**
   ```bash
   docker compose exec api-geo printenv | grep DATABASE_URL
   ```

---

**Status Final:** ✅ **PRÊT POUR L'IMPORT DE DONNÉES**
