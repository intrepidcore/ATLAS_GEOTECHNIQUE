# Troubleshooting v0.7.0

Ce document recense les problèmes courants et leurs solutions pour la v0.7.0.

## 🚨 Erreurs communes

### 1. "No such command 'load-country'"

#### Symptôme
```bash
PS> docker compose run --rm etl etl load-country
Usage: etl [OPTIONS] COMMAND [ARGS]...
╭─ Error ────────────────────────────────────────────────────────────╮
│ No such command 'load-country'.                                    │
╰────────────────────────────────────────────────────────────────────╯
```

#### Cause
Le conteneur ETL n'a pas été **rebuild** après modification du code Python.

#### Solution
```bash
# Rebuild le conteneur ETL
docker compose build etl

# Réessayer
docker compose run --rm etl etl load-country
```

#### Explication
Docker utilise des images en cache. Quand vous modifiez le code Python (`etl/etl/cli.py`), il faut rebuilder l'image pour que les changements soient pris en compte.

**Important** : Faire un `build` après chaque modification du code ETL !

---

### 2. "table country_tg does not exist"

#### Symptôme
```bash
PS> docker compose run --rm etl etl load-country
psycopg.errors.UndefinedTable: relation "country_tg" does not exist
```

#### Cause
La migration 007 n'a pas été appliquée.

#### Solution
```bash
docker compose exec db psql -U atlas -d atlas -f /docker-entrypoint-initdb.d/007_grid_v0.7.0.sql
```

#### Vérification
```bash
docker compose exec db psql -U atlas -d atlas -c "\dt country_tg"
```

**Attendu** :
```
         List of relations
 Schema |    Name    | Type  | Owner
--------+------------+-------+-------
 public | country_tg | table | atlas
```

---

### 3. "No polygon found in country_tg"

#### Symptôme
```bash
PS> docker compose run --rm etl etl make-grid
❌ Aucun polygone trouvé dans country_tg. Exécutez d'abord : etl load-country
```

#### Cause
La commande `load-country` n'a pas encore été exécutée.

#### Solution
```bash
docker compose run --rm etl etl load-country
```

#### Vérification
```bash
docker compose exec db psql -U atlas -d atlas -c "SELECT COUNT(*) FROM country_tg;"
```

**Attendu** : `1`

---

### 4. "Fichier introuvable: /data/togo.geojson"

#### Symptôme
```bash
PS> docker compose run --rm etl etl load-country
Fichier introuvable: /data/togo.geojson
```

#### Cause
Le fichier `data/togo.geojson` n'existe pas ou le volume Docker n'est pas monté.

#### Solution

**Option A** : Créer le fichier
```bash
# Vérifier que le fichier existe
ls data/togo.geojson

# Si absent, le créer (voir FILES_CHANGED_v0.7.0.md pour le contenu)
```

**Option B** : Vérifier le volume
```bash
# Vérifier que le volume est monté dans docker-compose.yml
docker compose config | grep -A2 "etl:" | grep volumes
```

**Attendu** :
```yaml
volumes:
  - ./migrations:/migrations:ro
  - ./data:/data:ro
```

**Option C** : Rebuild après modification
```bash
docker compose down
docker compose build etl
docker compose up -d
```

---

### 5. Warning "version is obsolete"

#### Symptôme
```bash
time="2025-10-17T10:00:59Z" level=warning msg="C:\\...\\docker-compose.yml: the attribute `version` is obsolete"
```

#### Cause
Docker Compose v2+ n'utilise plus la directive `version: "3.9"`.

#### Solution

**Option A** : Ignorer (pas d'impact fonctionnel)

**Option B** : Supprimer la ligne
```yaml
# Avant
version: "3.9"
name: atlas

# Après
name: atlas
```

---

### 6. Grille vide (0 mailles générées)

#### Symptôme
```bash
PS> docker compose run --rm etl etl make-grid
✓ 0 mailles générées avec succès
```

#### Cause
Le polygone du Togo est invalide ou vide.

#### Diagnostic
```bash
# Vérifier que le polygone existe
docker compose exec db psql -U atlas -d atlas -c "
SELECT
  name,
  ST_IsValid(geom) AS is_valid,
  ST_NPoints(geom) AS n_points,
  ST_Area(ST_Transform(geom, 25231)) AS area_m2
FROM country_tg;
"
```

**Attendu** :
```
 name | is_valid | n_points | area_m2
------+----------+----------+-----------
 Togo |     t    |    19    | ~56785000000
```

#### Solution
Si invalide, recharger le polygone :
```bash
docker compose run --rm etl etl load-country
docker compose run --rm etl etl make-grid
```

---

### 7. "insufficient samples" lors de recompute

#### Symptôme
```bash
PS> curl -X POST http://127.0.0.1:8001/grid/recompute/TG-0001
{"error":"insufficient samples"}
```

#### Cause
La maille contient moins de 3 essais SPT_N (minimum requis pour IDW).

#### Solution

**Option A** : Choisir une autre maille
```bash
# Trouver une maille avec plus de données
curl -s http://127.0.0.1:8001/coverage/mailles | jq -r '.features[] | select(.properties.n_essais >= 3) | .properties.code' | head -1
```

**Option B** : Charger plus de données
```bash
docker compose run --rm etl etl load-sample-extended
```

**Option C** : Accepter l'erreur (comportement normal)
IDW nécessite au moins 3 points. C'est une contrainte mathématique.

---

### 8. UI : Grille ne s'affiche pas

#### Symptôme
La carte Leaflet est vide, pas de mailles visibles.

#### Diagnostic

**1. Vérifier que l'API répond**
```bash
curl http://127.0.0.1:8001/healthz
```

**2. Vérifier le nombre de mailles**
```bash
curl -s http://127.0.0.1:8001/coverage/mailles | jq '.features | length'
```

**3. Ouvrir la console navigateur (F12)**
Chercher des erreurs réseau ou JavaScript.

#### Solution

**Si 0 mailles** :
```bash
docker compose run --rm etl etl make-grid
```

**Si API inaccessible** :
```bash
docker compose ps api-geo  # Vérifier status
docker compose logs api-geo  # Voir les erreurs
docker compose restart api-geo
```

**Si UI pas rebuilded** :
```bash
docker compose build ui
docker compose up -d ui
```

**Hard refresh navigateur** : Ctrl+Shift+R (Chrome) ou Ctrl+F5 (Firefox)

---

### 9. Export GeoJSON ne fait rien

#### Symptôme
Clic sur "Export GeoJSON" → aucun fichier téléchargé.

#### Diagnostic

**1. Ouvrir console navigateur (F12)**
Chercher des erreurs JavaScript.

**2. Vérifier que le code est renseigné**
Le champ "Code Maille" doit contenir une valeur (ex: `TG-0001`).

**3. Tester l'endpoint directement**
```bash
curl -s http://127.0.0.1:8001/grid/TG-0001/shape
```

#### Solution

**Si code vide** :
Cliquer sur une maille ou entrer manuellement le code.

**Si endpoint 404** :
La maille n'existe pas. Vérifier la liste :
```bash
curl -s http://127.0.0.1:8001/coverage/mailles | jq -r '.features[].properties.code' | head -10
```

**Si navigateur bloque le download** :
Vérifier les paramètres de téléchargement (popup bloqués ?).

**Si UI pas rebuilded** :
```bash
docker compose build ui
docker compose up -d ui
# Ctrl+Shift+R dans le navigateur
```

---

### 10. Permissions denied sur Windows

#### Symptôme
```bash
PS> docker compose run --rm etl etl load-country
Error: Permission denied: '/data/togo.geojson'
```

#### Cause
Docker Desktop sur Windows peut avoir des problèmes de permissions avec les volumes montés.

#### Solution

**Option A** : Vérifier les paramètres Docker Desktop
`Settings > Resources > File Sharing` → Ajouter le dossier du projet

**Option B** : Utiliser WSL2
```bash
# Dans WSL2 Ubuntu
cd /mnt/c/PROJET_ATLAS_MASTER/atlas
docker compose run --rm etl etl load-country
```

**Option C** : Copier le fichier dans le conteneur
```bash
docker compose run --rm etl bash -c "ls -la /data"
# Si vide, vérifier docker-compose.yml volumes section
```

---

### 11. PostGIS : fonction ST_SquareGrid introuvable

#### Symptôme
```bash
psycopg.errors.UndefinedFunction: function st_squaregrid(double precision, geometry) does not exist
```

#### Cause
PostGIS < 3.1 (ST_SquareGrid ajouté en 3.1).

#### Diagnostic
```bash
docker compose exec db psql -U atlas -d atlas -c "SELECT postgis_full_version();"
```

**Attendu** : PostGIS 3.4 ou supérieur

#### Solution

**Si PostGIS < 3.1** :
Mettre à jour l'image Docker :
```yaml
# docker-compose.yml
db:
  image: postgis/postgis:16-3.4  # ← Vérifier cette ligne
```

```bash
docker compose down
docker compose pull db
docker compose up -d db
```

---

### 12. Seed : nombre de sondages varie

#### Symptôme
Exécution 1 : 24 sondages
Exécution 2 : 28 sondages

#### Cause
C'est **normal** ! Le seed utilise `random.randint(min, max)` pour chaque ville.

#### Solution

**Pour résultats identiques** : Utiliser le même seed
```bash
docker compose run --rm etl etl load-sample-extended --seed 42
```

**Pour résultats différents** : Changer le seed
```bash
docker compose run --rm etl etl load-sample-extended --seed 123
```

**Plages attendues** (seed=42) :
- Lomé : 8-12 sondages
- Sokodé : 4-7 sondages
- Kara : 4-7 sondages
- Dapaong : 3-5 sondages
- **Total** : 19-31 sondages

---

## 🔍 Diagnostic général

### Vérifier l'état complet du système

```bash
# 1. Services actifs
docker compose ps

# 2. Tables créées
docker compose exec db psql -U atlas -d atlas -c "\dt"

# 3. Comptages
docker compose exec db psql -U atlas -d atlas -c "
SELECT
  (SELECT COUNT(*) FROM country_tg) AS n_country,
  (SELECT COUNT(*) FROM mailles) AS n_mailles,
  (SELECT COUNT(*) FROM sondages) AS n_sondages,
  (SELECT COUNT(*) FROM essais) AS n_essais;
"

# 4. API accessible
curl http://127.0.0.1:8001/healthz

# 5. UI accessible
curl http://127.0.0.1:8080 | head -5
```

### Logs détaillés

```bash
# Logs API (20 dernières lignes)
docker compose logs api-geo --tail 20

# Logs UI (20 dernières lignes)
docker compose logs ui --tail 20

# Logs DB (rechercher erreurs)
docker compose logs db | grep ERROR

# Logs ETL (dernière exécution)
docker compose logs etl --tail 50
```

### Reset complet

Si tout est cassé :

```bash
# 1. Tout arrêter et nettoyer
docker compose down -v

# 2. Nettoyer les images (optionnel)
docker compose rm -f
docker system prune -f

# 3. Rebuild tout
docker compose build --no-cache

# 4. Redémarrer
docker compose up -d

# 5. Attendre healthy
sleep 30

# 6. Workflow complet
docker compose exec db psql -U atlas -d atlas -f /docker-entrypoint-initdb.d/007_grid_v0.7.0.sql
docker compose run --rm etl etl load-country
docker compose run --rm etl etl make-grid
docker compose run --rm etl etl load-sample-extended

# 7. Vérifier
curl -s http://127.0.0.1:8001/coverage/mailles | jq '.features | length'
```

**Durée totale** : ~2-3 minutes

---

## 💡 Bonnes pratiques

### 1. Toujours rebuild après modification du code

```bash
# Modification Python
docker compose build etl

# Modification Rust
docker compose build api-geo

# Modification UI
docker compose build ui
```

### 2. Vérifier avant d'exécuter

```bash
# Avant make-grid
docker compose exec db psql -U atlas -d atlas -c "SELECT COUNT(*) FROM country_tg;"

# Avant load-sample-extended
curl -s http://127.0.0.1:8001/coverage/mailles | jq '.features | length'
```

### 3. Utiliser les logs en cas de doute

```bash
docker compose logs <service> --follow
```

### 4. Documenter les seeds utilisés

```bash
# Garder une trace du seed utilisé
echo "42" > .seed_used
docker compose run --rm etl etl load-sample-extended --seed $(cat .seed_used)
```

### 5. Sauvegarder avant reset

```bash
# Backup DB
docker compose exec db pg_dump -U atlas atlas > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T db psql -U atlas atlas < backup_20250117.sql
```

---

## 📞 Support supplémentaire

Si aucune solution ne fonctionne :

1. **Vérifier la documentation**
   - [QUICKSTART_v0.7.0.md](QUICKSTART_v0.7.0.md)
   - [VERIFICATION_CHECKLIST_v0.7.0.md](VERIFICATION_CHECKLIST_v0.7.0.md)

2. **Collecter les informations**
   ```bash
   # Créer un diagnostic complet
   {
     echo "=== Services ==="
     docker compose ps
     echo ""
     echo "=== Tables ==="
     docker compose exec db psql -U atlas -d atlas -c "\dt"
     echo ""
     echo "=== Logs API ==="
     docker compose logs api-geo --tail 20
   } > diagnostic.txt
   ```

3. **Ouvrir une issue**
   Inclure `diagnostic.txt` + description du problème

---

**Dernière mise à jour** : 17 janvier 2025
**Version** : 0.7.0
