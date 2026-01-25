# 📦 Système d'Attribution Automatique des Mailles Colab - Implémentation Complète

## 🎯 Objectif

Permettre l'attribution automatique des mailles nationales (2 km²) aux étudiants Atlas Colab en fonction de leurs préférences géographiques, via un simple fichier Excel.

---

## 📁 Fichiers créés

### 1. Migration SQL
**`db/migrations/082_colab_maille_assignment_system.sql`**

Crée :
- ✅ Table `atlas.colab_student_prefs` (staging préférences)
- ✅ Table `atlas.colab_maille_assignments` (attributions)
- ✅ Vue `atlas.v_colab_maille_assignment_details` (pour PDF)
- ✅ Vue `atlas.v_colab_assignments_by_adm` (statistiques)
- ✅ Vue `atlas.v_colab_students_without_maille` (suivi)
- ✅ Fonctions utilitaires SQL

### 2. Script Python
**`scripts/colab_assign_mailles_from_excel.py`**

Fonctionnalités :
- ✅ Lecture et validation du fichier Excel
- ✅ Import/update des préférences étudiants
- ✅ Algorithme d'attribution intelligent (pref 1→2→3)
- ✅ Mode dry-run (simulation)
- ✅ Logging détaillé et rapport final
- ✅ Gestion des erreurs complète

### 3. Documentation
- ✅ **`docs/COLAB_MAILLE_ASSIGNMENT.md`** : Documentation complète
- ✅ **`QUICKSTART_COLAB_MAILLES.md`** : Guide de démarrage rapide
- ✅ **`data/colab/README.md`** : Instructions pour les fichiers Excel

### 4. Utilitaires
- ✅ **`scripts/create_excel_template.py`** : Génère le template Excel
- ✅ **`data/colab/TEMPLATE_etudiants_preferences.xlsx`** : Template avec exemples

---

## 🏗️ Architecture de la solution

### Structure de la base de données

```
atlas.colab_student_prefs
    ├── student_id (PK)
    ├── nom, prenom, email, telephone
    ├── adm_niveau (ADM2/ADM3)
    ├── adm_code_pref_1/2/3
    └── commentaire

atlas.colab_maille_assignments
    ├── assignment_id (PK)
    ├── student_id (FK → colab_student_prefs) [UNIQUE]
    ├── maille_id (FK → atlas.mailles)
    ├── adm_code_used
    └── pref_rank_used (1, 2 ou 3)

atlas.mailles (existant)
    ├── id (UUID)
    ├── code
    ├── pref_code (pour ADM2)
    └── geom (Polygon, SRID 25231)

atlas.adm2_tg / adm3_tg (existant)
    ├── code
    ├── name
    └── geom
```

### Flux de données

```
Excel → Validation → colab_student_prefs → Algorithme → colab_maille_assignments
                                                              ↓
                                                    v_colab_maille_assignment_details
                                                              ↓
                                                        Génération PDF
```

---

## 🚀 Utilisation

### Installation initiale

```powershell
# 1. Appliquer la migration
cd C:\PROJET_ATLAS_MASTER\atlas
psql $env:DATABASE_URL -f db/migrations/082_colab_maille_assignment_system.sql

# 2. Créer le template Excel
poetry run python scripts/create_excel_template.py
```

### Workflow standard

```powershell
# 1. Préparer le fichier Excel
# → Ouvrir data/colab/TEMPLATE_etudiants_preferences.xlsx
# → Remplir avec les vraies données
# → Sauvegarder sous data/colab/etudiants_colab.xlsx

# 2. Test en simulation
poetry run python scripts/colab_assign_mailles_from_excel.py `
  --input data/colab/etudiants_colab.xlsx `
  --dry-run true

# 3. Vérifier les logs et corriger si nécessaire

# 4. Exécution réelle
poetry run python scripts/colab_assign_mailles_from_excel.py `
  --input data/colab/etudiants_colab.xlsx `
  --dry-run false
```

---

## 🎓 Algorithme d'attribution

### Principe

Pour chaque étudiant :

1. **Récupérer les préférences** (pref_1, pref_2, pref_3)
2. **Pour chaque préférence dans l'ordre** :
   - Chercher les mailles disponibles dans la zone ADM
   - Si mailles trouvées → attribuer aléatoirement et STOP
   - Sinon → essayer la préférence suivante
3. **Si aucune maille** → marquer "sans attribution"

### Critères de disponibilité

Une maille est disponible si :
- Elle intersecte la zone ADM demandée (ADM2 ou ADM3)
- Elle a moins de `max_students_per_maille` étudiants (défaut: 1)

### Sélection aléatoire

Parmi les mailles disponibles, le choix est **aléatoire** pour garantir une répartition équitable.

---

## 📊 Vues et requêtes utiles

### Vue principale : v_colab_maille_assignment_details

Contient toutes les infos pour chaque attribution :
- Infos étudiant (nom, prénom, email, téléphone)
- Infos maille (code, préfecture, géométrie)
- BBOX (xmin, ymin, xmax, ymax) pour PDF
- Centroïde de la maille
- Rang de préférence utilisé

```sql
SELECT * FROM atlas.v_colab_maille_assignment_details;
```

### Statistiques

```sql
-- Nombre d'attributions par zone
SELECT * FROM atlas.v_colab_assignments_by_adm;

-- Étudiants sans maille
SELECT * FROM atlas.v_colab_students_without_maille;

-- Répartition par rang de préférence
SELECT 
    pref_rank_used,
    COUNT(*) as nb,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct
FROM atlas.colab_maille_assignments
GROUP BY pref_rank_used;

-- Mailles avec plusieurs étudiants
SELECT 
    maille_code,
    COUNT(*) as nb_etudiants
FROM atlas.v_colab_maille_assignment_details
GROUP BY maille_code
HAVING COUNT(*) > 1;
```

---

## 🔗 Intégration avec Atlas Colab Studio

### Lien avec les missions existantes

Les attributions sont **indépendantes** des missions. Pour créer des missions basées sur les attributions :

```sql
-- Créer une mission par préfecture
INSERT INTO atlas.colab_missions (
    code, title, theme, maille_id, zone_label, status
)
SELECT DISTINCT
    'M-2025-' || m.pref_code,
    'Mission reconnaissance ' || m.pref_name || ' 2025',
    'reconnaissance',
    a.maille_id,
    m.pref_name,
    'planned'
FROM atlas.colab_maille_assignments a
JOIN atlas.mailles m ON m.id = a.maille_id
ON CONFLICT (code) DO NOTHING;
```

### Lier les étudiants aux missions

```sql
-- Lier automatiquement via user_id
INSERT INTO atlas.colab_mission_assignments (mission_id, student_id, role)
SELECT 
    mis.id,
    cs.id,
    'membre'
FROM atlas.colab_maille_assignments a
JOIN atlas.colab_student_prefs sp ON sp.student_id = a.student_id
JOIN atlas.colab_students cs ON cs.user_id = sp.user_id
JOIN atlas.mailles m ON m.id = a.maille_id
JOIN atlas.colab_missions mis ON mis.code = 'M-2025-' || m.pref_code
WHERE sp.user_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

---

## 🛠️ Maintenance et opérations

### Réinitialiser les attributions

```sql
-- ATTENTION : Supprime toutes les attributions
TRUNCATE atlas.colab_maille_assignments CASCADE;
```

### Supprimer un étudiant

```sql
-- Supprime l'étudiant et son attribution (CASCADE)
DELETE FROM atlas.colab_student_prefs WHERE student_id = 'ETU2025001';
```

### Changer l'attribution d'un étudiant

```sql
-- Méthode 1 : Supprimer et réattribuer via le script
DELETE FROM atlas.colab_maille_assignments WHERE student_id = 'ETU2025001';
-- Puis relancer le script

-- Méthode 2 : Modification manuelle
UPDATE atlas.colab_maille_assignments
SET 
    maille_id = (SELECT id FROM atlas.mailles WHERE code = 'M_5678' LIMIT 1),
    adm_code_used = 'TG-K',
    pref_rank_used = 2
WHERE student_id = 'ETU2025001';
```

---

## 📄 Génération des PDF (à implémenter)

### Données disponibles

La vue `v_colab_maille_assignment_details` contient toutes les infos nécessaires :

```sql
SELECT 
    student_id,
    full_name,
    email,
    telephone,
    maille_code,
    maille_pref_name,
    bbox_xmin, bbox_ymin, bbox_xmax, bbox_ymax,
    centroid_x, centroid_y,
    area_km2
FROM atlas.v_colab_maille_assignment_details
WHERE student_id = 'ETU2025001';
```

### Script à créer

```python
# scripts/generate_mission_pdfs.py
# TODO: Implémenter
# - Template PDF avec carte de la maille
# - Infos étudiant et mission
# - Instructions terrain
# - QR code pour accès mobile
```

---

## ✅ Tests et validation

### Tests unitaires recommandés

1. **Validation Excel**
   - Colonnes manquantes
   - Doublons student_id
   - Codes ADM invalides
   - Valeurs obligatoires vides

2. **Algorithme d'attribution**
   - Préférence 1 disponible → utilise pref 1
   - Préférence 1 indisponible → utilise pref 2
   - Aucune préférence disponible → sans maille
   - Respect de max_students_per_maille

3. **Intégrité des données**
   - Contrainte UNIQUE sur student_id
   - Foreign keys valides
   - Géométries valides

### Validation manuelle

```sql
-- Vérifier l'intégrité
SELECT 
    COUNT(*) as total_students,
    COUNT(DISTINCT student_id) as unique_students,
    COUNT(DISTINCT maille_id) as unique_mailles
FROM atlas.colab_maille_assignments;

-- Vérifier les géométries
SELECT COUNT(*) 
FROM atlas.v_colab_maille_assignment_details
WHERE geom IS NULL OR NOT ST_IsValid(geom);
```

---

## 🐛 Dépannage

### Problème : "Code ADM invalide"

**Cause :** Le code ADM n'existe pas dans `atlas.adm2_tg` ou `atlas.adm3_tg`

**Solution :**
```sql
-- Lister les codes valides
SELECT code, name FROM atlas.adm2_tg ORDER BY name;
SELECT code, name FROM atlas.adm3_tg ORDER BY name;
```

### Problème : "Aucune maille disponible"

**Causes possibles :**
1. Toutes les mailles de la zone sont déjà attribuées
2. La zone ADM ne contient aucune maille
3. Problème de géométrie (SRID, intersection)

**Solutions :**
```sql
-- Vérifier les mailles dans une zone
SELECT COUNT(*) 
FROM atlas.mailles 
WHERE pref_code = 'TG-M';  -- Pour ADM2

-- Augmenter max_students_per_maille
poetry run python scripts/colab_assign_mailles_from_excel.py \
  --max-students-per-maille 2 \
  --dry-run false
```

### Problème : "Erreur de connexion base de données"

**Solution :**
```powershell
# Vérifier DATABASE_URL
echo $env:DATABASE_URL

# Tester la connexion
psql $env:DATABASE_URL -c "SELECT version();"
```

---

## 📈 Évolutions futures

### Court terme
- [ ] Script de génération PDF automatique
- [ ] Interface web pour upload Excel
- [ ] Validation en temps réel des codes ADM
- [ ] Export CSV des attributions

### Moyen terme
- [ ] Gestion multi-promotions
- [ ] Historique des attributions
- [ ] Notifications email automatiques
- [ ] Dashboard de suivi temps réel

### Long terme
- [ ] Algorithme d'optimisation (minimiser distances)
- [ ] Contraintes géographiques avancées
- [ ] Intégration avec système de notation
- [ ] API REST pour intégration externe

---

## 📞 Support

**Documentation :**
- Guide complet : `docs/COLAB_MAILLE_ASSIGNMENT.md`
- Démarrage rapide : `QUICKSTART_COLAB_MAILLES.md`
- Fichiers Excel : `data/colab/README.md`

**Contact :**
- Équipe Atlas Lab
- Email : support@atlas-lab.tg (à définir)

---

## 📝 Changelog

### Version 1.0.0 (2026-01-05)
- ✅ Migration 082 : Tables et vues
- ✅ Script Python complet avec dry-run
- ✅ Documentation complète
- ✅ Template Excel avec exemples
- ✅ Algorithme d'attribution intelligent
- ✅ Intégration avec structure Colab existante

---

**Système prêt à l'emploi ! 🎉**

Pour démarrer : voir `QUICKSTART_COLAB_MAILLES.md`
