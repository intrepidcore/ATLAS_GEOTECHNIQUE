# Attribution Automatique des Mailles Atlas Colab

## 📋 Vue d'ensemble

Ce système permet d'attribuer automatiquement des mailles nationales (2 km²) aux étudiants du programme Atlas Colab en fonction de leurs préférences géographiques.

**Workflow complet :**
1. Les étudiants remplissent un formulaire avec leurs préférences de zone (ADM2 ou ADM3)
2. Les données sont consolidées dans un fichier Excel standardisé
3. Un script Python lit l'Excel, valide les données et attribue les mailles
4. Les résultats sont visibles dans Atlas Colab Studio

---

## 🗂️ Structure des données

### Tables créées (Migration 082)

#### `atlas.colab_student_prefs`
Table de staging des préférences étudiants.

| Colonne | Type | Description |
|---------|------|-------------|
| `student_id` | TEXT (PK) | Identifiant unique (matricule) |
| `user_id` | UUID | Lien vers `atlas.users` (optionnel) |
| `nom` | TEXT | Nom de famille |
| `prenom` | TEXT | Prénom |
| `telephone` | TEXT | Numéro de téléphone |
| `email` | TEXT | Email |
| `adm_niveau` | TEXT | `'ADM2'` (préfecture) ou `'ADM3'` (commune) |
| `adm_code_pref_1` | TEXT | Code ADM préférence 1 (obligatoire) |
| `adm_code_pref_2` | TEXT | Code ADM préférence 2 (optionnel) |
| `adm_code_pref_3` | TEXT | Code ADM préférence 3 (optionnel) |
| `commentaire` | TEXT | Commentaires libres |

#### `atlas.colab_maille_assignments`
Table d'attribution maille ↔ étudiant.

| Colonne | Type | Description |
|---------|------|-------------|
| `assignment_id` | UUID (PK) | Identifiant unique |
| `student_id` | TEXT | Référence vers `colab_student_prefs` |
| `maille_id` | UUID | Référence vers `atlas.mailles` |
| `adm_code_used` | TEXT | Code ADM utilisé pour l'attribution |
| `pref_rank_used` | INTEGER | Rang de préférence (1, 2 ou 3) |
| `assigned_at` | TIMESTAMPTZ | Date d'attribution |

**Contrainte :** Un étudiant = une seule maille (index unique sur `student_id`).

### Vues créées

#### `atlas.v_colab_maille_assignment_details`
Vue consolidée avec toutes les informations pour génération PDF :
- Infos étudiant complètes
- Infos maille (code, préfecture, géométrie)
- BBOX (xmin, ymin, xmax, ymax)
- Centroïde de la maille

#### `atlas.v_colab_assignments_by_adm`
Statistiques d'attribution par zone administrative.

#### `atlas.v_colab_students_without_maille`
Liste des étudiants sans maille attribuée (pour suivi).

---

## 📊 Format du fichier Excel

### Nom du fichier
`data/colab/etudiants_colab.xlsx`

### Nom de la feuille
`etudiants_preferences`

### Colonnes attendues

| Colonne | Type | Obligatoire | Description | Exemple |
|---------|------|-------------|-------------|---------|
| `student_id` | Texte | ✅ Oui | Matricule ou identifiant unique | `ETU2025001` |
| `nom` | Texte | ✅ Oui | Nom de famille | `KOUASSI` |
| `prenom` | Texte | ✅ Oui | Prénom | `Jean` |
| `telephone` | Texte | ❌ Non | Numéro de téléphone | `+228 90 12 34 56` |
| `email` | Texte | ✅ Oui | Email | `jean.kouassi@example.tg` |
| `adm_niveau` | Texte | ✅ Oui | `ADM2` ou `ADM3` | `ADM2` |
| `adm_code_pref_1` | Texte | ✅ Oui | Code ADM préférence 1 | `TG-M` |
| `adm_code_pref_2` | Texte | ❌ Non | Code ADM préférence 2 | `TG-K` |
| `adm_code_pref_3` | Texte | ❌ Non | Code ADM préférence 3 | `TG-C` |
| `commentaire` | Texte | ❌ Non | Commentaires libres | `Préfère zone côtière` |

### Règles de validation

Le script refusera les lignes avec :
- `student_id`, `email`, `nom` ou `prenom` vide
- `adm_niveau` différent de `'ADM2'` ou `'ADM3'`
- `adm_code_pref_1` vide ou inexistant dans la base
- Doublons sur `student_id`

---

## 🚀 Utilisation

### Pré-requis

1. **Migration appliquée**
   ```powershell
   cd C:\PROJET_ATLAS_MASTER\atlas
   psql $env:DATABASE_URL -f db/migrations/082_colab_maille_assignment_system.sql
   ```

2. **Fichier Excel préparé**
   - Placer le fichier dans `data/colab/etudiants_colab.xlsx`
   - Vérifier que la feuille `etudiants_preferences` existe
   - Vérifier que toutes les colonnes obligatoires sont présentes

3. **Dépendances Python**
   ```powershell
   poetry install
   ```

### Commandes

#### 1. Test en mode simulation (dry-run)

```powershell
cd C:\PROJET_ATLAS_MASTER\atlas
poetry run python scripts/colab_assign_mailles_from_excel.py `
  --input data/colab/etudiants_colab.xlsx `
  --sheet etudiants_preferences `
  --dry-run true
```

**Ce mode :**
- ✅ Lit et valide le fichier Excel
- ✅ Affiche les erreurs de validation
- ✅ Simule les attributions
- ❌ N'écrit RIEN en base de données

#### 2. Exécution réelle

```powershell
poetry run python scripts/colab_assign_mailles_from_excel.py `
  --input data/colab/etudiants_colab.xlsx `
  --sheet etudiants_preferences `
  --dry-run false
```

**Ce mode :**
- ✅ Importe les préférences dans `colab_student_prefs`
- ✅ Crée les attributions dans `colab_maille_assignments`
- ✅ Commit les changements en base

#### 3. Options avancées

```powershell
# Permettre plusieurs étudiants par maille (ex: 2)
poetry run python scripts/colab_assign_mailles_from_excel.py `
  --input data/colab/etudiants_colab.xlsx `
  --dry-run false `
  --max-students-per-maille 2

# Utiliser une autre feuille Excel
poetry run python scripts/colab_assign_mailles_from_excel.py `
  --input data/colab/promo_2025.xlsx `
  --sheet preferences `
  --dry-run false
```

---

## 🎯 Algorithme d'attribution

### Principe

Pour chaque étudiant sans maille :

1. **Essayer préférence 1** (`adm_code_pref_1`)
   - Récupérer les mailles disponibles dans cette zone
   - Si mailles disponibles → attribuer aléatoirement
   - Sinon → passer à l'étape 2

2. **Essayer préférence 2** (`adm_code_pref_2`)
   - Même logique que préférence 1
   - Si mailles disponibles → attribuer
   - Sinon → passer à l'étape 3

3. **Essayer préférence 3** (`adm_code_pref_3`)
   - Même logique
   - Si mailles disponibles → attribuer
   - Sinon → marquer "sans maille"

### Critères de disponibilité

Une maille est **disponible** si :
- Elle se trouve dans la zone ADM demandée
- Elle a moins de `max_students_per_maille` étudiants assignés (défaut: 1)

### Sélection aléatoire

Parmi les mailles disponibles, le choix est **aléatoire** pour :
- Éviter les biais géographiques
- Assurer une répartition équitable

---

## 📈 Suivi et vérification

### Vérifier les attributions

```sql
-- Nombre total d'attributions
SELECT COUNT(*) FROM atlas.colab_maille_assignments;

-- Détails des attributions
SELECT * FROM atlas.v_colab_maille_assignment_details
ORDER BY assigned_at DESC;

-- Étudiants sans maille
SELECT * FROM atlas.v_colab_students_without_maille;

-- Statistiques par zone ADM
SELECT * FROM atlas.v_colab_assignments_by_adm;
```

### Vérifier la répartition

```sql
-- Nombre d'étudiants par maille
SELECT 
    maille_code,
    COUNT(*) as nb_etudiants
FROM atlas.v_colab_maille_assignment_details
GROUP BY maille_code
ORDER BY nb_etudiants DESC;

-- Répartition par rang de préférence
SELECT 
    pref_rank_used,
    COUNT(*) as nb_etudiants,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct
FROM atlas.colab_maille_assignments
GROUP BY pref_rank_used
ORDER BY pref_rank_used;
```

---

## 🔄 Ré-exécution et mise à jour

### Comportement idempotent

Le script est **idempotent** :
- Ré-importer le même fichier met à jour les préférences existantes
- Les attributions existantes ne sont **pas écrasées** automatiquement

### Réinitialiser les attributions

Pour recommencer l'attribution à zéro :

```sql
-- ATTENTION : Supprime toutes les attributions !
TRUNCATE atlas.colab_maille_assignments CASCADE;
```

Puis relancer le script.

### Mettre à jour les préférences sans réattribuer

```sql
-- Supprimer uniquement les préférences (garde les attributions)
TRUNCATE atlas.colab_student_prefs CASCADE;
```

Puis relancer le script avec `--dry-run true` pour vérifier.

---

## 🔗 Intégration avec Atlas Colab Studio

### Lien avec les missions

Les attributions sont **indépendantes** des missions Colab existantes.

Pour créer des missions basées sur les attributions :

```sql
-- Exemple : Créer une mission par préfecture
INSERT INTO atlas.colab_missions (
    code,
    title,
    theme,
    maille_id,
    zone_label,
    status
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
-- Lier automatiquement les étudiants à leur mission de zone
INSERT INTO atlas.colab_mission_assignments (
    mission_id,
    student_id,
    role
)
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

## 📄 Génération des PDF de mission

### Données disponibles

La vue `v_colab_maille_assignment_details` contient toutes les infos nécessaires :

```sql
SELECT 
    student_id,
    full_name,
    email,
    maille_code,
    maille_pref_name,
    bbox_xmin,
    bbox_ymin,
    bbox_xmax,
    bbox_ymax,
    centroid_x,
    centroid_y
FROM atlas.v_colab_maille_assignment_details
WHERE student_id = 'ETU2025001';
```

### Script de génération PDF (à créer)

```python
# scripts/generate_mission_pdfs.py
# TODO: Implémenter la génération automatique des PDF
# - Template PDF avec carte de la maille
# - Infos étudiant
# - Objectifs de la mission
# - Instructions terrain
```

---

## 🛠️ Maintenance

### Ajouter un étudiant manuellement

```sql
-- 1. Ajouter les préférences
INSERT INTO atlas.colab_student_prefs (
    student_id, nom, prenom, email,
    adm_niveau, adm_code_pref_1
) VALUES (
    'ETU2025999',
    'NOUVEAU',
    'Étudiant',
    'nouveau@example.tg',
    'ADM2',
    'TG-M'
);

-- 2. Attribuer une maille manuellement
INSERT INTO atlas.colab_maille_assignments (
    student_id,
    maille_id,
    adm_code_used,
    pref_rank_used
) VALUES (
    'ETU2025999',
    (SELECT id FROM atlas.mailles WHERE code = 'M_1234' LIMIT 1),
    'TG-M',
    1
);
```

### Changer l'attribution d'un étudiant

```sql
-- Supprimer l'attribution actuelle
DELETE FROM atlas.colab_maille_assignments
WHERE student_id = 'ETU2025001';

-- Créer une nouvelle attribution
INSERT INTO atlas.colab_maille_assignments (
    student_id, maille_id, adm_code_used, pref_rank_used
) VALUES (
    'ETU2025001',
    (SELECT id FROM atlas.mailles WHERE code = 'M_5678' LIMIT 1),
    'TG-K',
    2
);
```

---

## ❓ FAQ

### Que faire si des étudiants n'ont pas de maille ?

1. Vérifier les codes ADM dans leurs préférences
2. Vérifier la disponibilité des mailles dans ces zones
3. Augmenter `--max-students-per-maille` si nécessaire
4. Ajouter une 3ème préférence dans une zone moins demandée

### Peut-on attribuer plusieurs mailles à un étudiant ?

Non, la contrainte `UNIQUE` sur `student_id` l'empêche. Si besoin, modifier la migration.

### Comment gérer plusieurs promotions ?

Ajouter une colonne `promotion` dans `colab_student_prefs` et filtrer par promotion lors de l'attribution.

### Les attributions sont-elles définitives ?

Non, elles peuvent être modifiées manuellement en SQL ou en réinitialisant la table.

---

## 📞 Support

Pour toute question ou problème :
1. Vérifier les logs du script
2. Consulter les vues de diagnostic SQL
3. Contacter l'équipe Atlas Lab

---

**Version :** 1.0.0  
**Date :** 2026-01-05  
**Auteur :** Atlas Lab
