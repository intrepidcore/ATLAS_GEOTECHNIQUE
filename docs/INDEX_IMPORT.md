# 📑 Index - Système d'Import Géotechnique

## 📁 Fichiers Créés

### 🔧 Scripts Exécutables

| Fichier | Type | Description | Usage |
|---------|------|-------------|-------|
| `scripts/01_clone_database.sh` | Bash | Clone base sans données géotech (Linux/Mac) | `./01_clone_database.sh` |
| `scripts/01_clone_database.ps1` | PowerShell | Clone base sans données géotech (Windows) | `.\01_clone_database.ps1` |
| `scripts/02_import_excel.py` | Python | Import Excel → PostgreSQL idempotent | `python 02_import_excel.py --file data.xlsx --dsn "..."` |

### 📚 Documentation

| Fichier | Contenu | Pour Qui |
|---------|---------|----------|
| `QUICK_START_IMPORT.md` | Guide rapide 5 étapes | ⚡ Démarrage rapide |
| `GUIDE_IMPORT_GEOTECH.md` | Guide complet détaillé | 📘 Référence complète |
| `scripts/README.md` | Documentation scripts | 🔧 Développeurs |
| `data/TEMPLATE_IMPORT_EXEMPLE.md` | Structure Excel + exemples | 📊 Préparation données |
| `INDEX_IMPORT.md` | Ce fichier (index) | 🗺️ Navigation |

---

## 🎯 Par Cas d'Usage

### Je veux démarrer rapidement
👉 **`QUICK_START_IMPORT.md`**
- 5 étapes simples
- Commandes prêtes à copier-coller
- Temps: 20-45 min

### Je veux comprendre en détail
👉 **`GUIDE_IMPORT_GEOTECH.md`**
- Explications approfondies
- Dépannage complet
- Vérifications post-import
- Sécurité & backup

### Je prépare mes données Excel
👉 **`data/TEMPLATE_IMPORT_EXEMPLE.md`**
- Structure des 5 feuilles
- Exemples de données
- Conseils de nettoyage
- Checklist pré-import

### Je développe/maintiens les scripts
👉 **`scripts/README.md`**
- Architecture des scripts
- Format des données
- Gestion des erreurs
- Points techniques

---

## 🔄 Workflows Disponibles

### Workflow A: Excel → PostgreSQL (Recommandé)
```
Excel (.xlsx) → 02_import_excel.py → PostgreSQL
```
**Avantages:**
- ✅ Validation automatique
- ✅ Rapport détaillé
- ✅ Idempotent (UPSERT)
- ✅ Mode dry-run
- ✅ Gestion erreurs

**Fichiers:**
- Script: `scripts/02_import_excel.py`
- Doc: `GUIDE_IMPORT_GEOTECH.md` (section "Méthode Recommandée")
- Template: `data/TEMPLATE_IMPORT_EXEMPLE.md`

### Workflow B: Texte Brut → CSV → PostgreSQL
```
Texte brut → Claude → CSV → COPY → PostgreSQL
```
**Avantages:**
- ✅ Rapide pour données brutes
- ✅ Pas de dépendances Python
- ✅ Contrôle manuel

**Fichiers:**
- Doc: `GUIDE_IMPORT_GEOTECH.md` (section "Workflow Alternatif")

---

## 📋 Checklist Complète

### Avant de Commencer
- [ ] PostgreSQL installé (client tools)
- [ ] Python 3.8+ installé
- [ ] Dépendances: `pip install pandas openpyxl psycopg[binary]`
- [ ] Accès base source (`atlas_prod`)
- [ ] Droits création base (`atlas_clean`)

### Étape 1: Clone Base
- [ ] Script `01_clone_database` exécuté
- [ ] Base `atlas_clean` créée
- [ ] Extensions PostGIS activées
- [ ] Tables référentielles remplies
- [ ] Tables géotech vides
- [ ] Vue matérialisée créée (vide)

### Étape 2: Configuration API
- [ ] `.env` modifié (DATABASE_URL)
- [ ] API redémarrée
- [ ] UI accessible
- [ ] Cartes affichées
- [ ] Compteurs géotech à 0

### Étape 3: Préparation Données
- [ ] Fichier Excel créé (`.xlsx`)
- [ ] 5 feuilles présentes: sondages, echantillons, atterberg, vbs, proctor
- [ ] Noms colonnes corrects
- [ ] Coordonnées WGS84 (décimales)
- [ ] Dates format ISO (YYYY-MM-DD)
- [ ] Codes sondages uniques
- [ ] Pas de lignes vides

### Étape 4: Validation
- [ ] Dry-run exécuté: `--dry-run`
- [ ] Rapport sans erreurs
- [ ] Compteurs cohérents
- [ ] Références valides

### Étape 5: Import
- [ ] Import réel exécuté
- [ ] Rapport succès (100%)
- [ ] Vue matérialisée rafraîchie
- [ ] Vérifications SQL OK
- [ ] UI affiche données

---

## 🗺️ Architecture du Système

```
atlas/
├── scripts/
│   ├── 01_clone_database.sh          # Clone base (Linux/Mac)
│   ├── 01_clone_database.ps1         # Clone base (Windows)
│   ├── 02_import_excel.py            # Import Excel → PostgreSQL
│   └── README.md                     # Doc scripts
│
├── data/
│   └── TEMPLATE_IMPORT_EXEMPLE.md    # Template + exemples
│
├── QUICK_START_IMPORT.md             # Guide rapide 5 étapes
├── GUIDE_IMPORT_GEOTECH.md           # Guide complet
└── INDEX_IMPORT.md                   # Ce fichier
```

---

## 🎓 Ordre de Lecture Recommandé

### Pour Débutants
1. **`QUICK_START_IMPORT.md`** - Commencer ici
2. **`data/TEMPLATE_IMPORT_EXEMPLE.md`** - Préparer données
3. **`GUIDE_IMPORT_GEOTECH.md`** - Approfondir si besoin

### Pour Utilisateurs Avancés
1. **`scripts/README.md`** - Architecture technique
2. **`GUIDE_IMPORT_GEOTECH.md`** - Référence complète
3. Scripts sources pour personnalisation

---

## 📊 Tables Concernées

### Tables Géotechniques (vidées puis remplies)
```
sondages                    → Sondages géotechniques
echantillons                → Échantillons par profondeur
essais_atterberg            → Limites Atterberg (WL, WP, IP)
essais_vbs                  → Valeur de Bleu
essais_proctor              → Essais Proctor
granulo_points              → Courbes granulométriques
```

### Tables Référentielles (conservées)
```
mailles                     → Grille géographique
adm_0, adm_2, adm_3        → Divisions administratives
```

### Vues Matérialisées (rafraîchies)
```
mailles_geotechnique_stats  → Statistiques par maille
```

---

## 🔗 Liens Rapides

| Action | Commande |
|--------|----------|
| **Clone base** | `./scripts/01_clone_database.sh` |
| **Import Excel** | `python scripts/02_import_excel.py --file data.xlsx --dsn "..."` |
| **Dry-run** | Ajouter `--dry-run` à la commande import |
| **Verbose** | Ajouter `--verbose` à la commande import |
| **Vérif SQL** | `psql -d atlas_clean -c "SELECT COUNT(*) FROM sondages;"` |
| **Refresh MV** | `psql -d atlas_clean -c "REFRESH MATERIALIZED VIEW mailles_geotechnique_stats;"` |

---

## 💡 Conseils Généraux

### Sécurité
- ✅ Toujours tester en `--dry-run` d'abord
- ✅ Backup avant import: `pg_dump -Fc atlas_clean > backup.dump`
- ✅ Ne jamais supprimer `atlas_prod`

### Performance
- ✅ Import par lots (< 10k lignes par fichier)
- ✅ Désactiver triggers pour gros volumes
- ✅ Utiliser `COPY` pour imports massifs

### Maintenance
- ✅ Scripts idempotents (relançables)
- ✅ Logs détaillés conservés
- ✅ Versionner vos fichiers Excel

---

## 🐛 Dépannage Rapide

| Symptôme | Fichier à Consulter | Section |
|----------|---------------------|---------|
| Erreur clone base | `GUIDE_IMPORT_GEOTECH.md` | "Dépannage" |
| Erreur import Excel | `scripts/README.md` | "Dépannage" |
| Format Excel incorrect | `data/TEMPLATE_IMPORT_EXEMPLE.md` | Toutes sections |
| Performance lente | `GUIDE_IMPORT_GEOTECH.md` | "Performance" |
| Coordonnées invalides | `data/TEMPLATE_IMPORT_EXEMPLE.md` | "Coordonnées Géographiques" |

---

## 📞 Support

### Ordre de Consultation
1. **Ce fichier** (INDEX_IMPORT.md) - Navigation
2. **QUICK_START_IMPORT.md** - Démarrage rapide
3. **GUIDE_IMPORT_GEOTECH.md** - Référence complète
4. **scripts/README.md** - Détails techniques

### Ressources Externes
- [PostGIS Documentation](https://postgis.net/documentation/)
- [psycopg3 Documentation](https://www.psycopg.org/psycopg3/docs/)
- [Pandas Documentation](https://pandas.pydata.org/docs/)

---

## 🎯 Résumé Ultra-Rapide

```bash
# 1. Clone
./scripts/01_clone_database.sh

# 2. Config
echo "DATABASE_URL=postgresql://user:pass@localhost/atlas_clean" > .env
docker compose restart api

# 3. Import
python scripts/02_import_excel.py --file data.xlsx --dsn "..." --dry-run
python scripts/02_import_excel.py --file data.xlsx --dsn "..."

# 4. Vérif
psql -d atlas_clean -c "SELECT COUNT(*) FROM sondages;"
```

**Temps total:** 20-45 minutes

---

**Version:** 1.0  
**Dernière mise à jour:** 2024-10-24  
**Auteur:** Atlas Team
