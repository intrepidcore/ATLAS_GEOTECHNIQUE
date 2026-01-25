# 🚀 Démarrage Rapide - Attribution Mailles Colab

Guide ultra-rapide pour attribuer automatiquement les mailles aux étudiants.

---

## ⚡ En 4 étapes

### 1️⃣ Appliquer la migration

```powershell
cd C:\PROJET_ATLAS_MASTER\atlas
psql $env:DATABASE_URL -f db/migrations/082_colab_maille_assignment_system.sql
```

**Résultat attendu :**
```
Migration 082 terminée avec succès.
Tables créées: colab_student_prefs, colab_maille_assignments
...
COMMIT
```

---

### 2️⃣ Créer le template Excel

```powershell
poetry run python scripts/create_excel_template.py
```

**Résultat :** Fichier `data/colab/TEMPLATE_etudiants_preferences.xlsx` créé avec exemples.

---

### 3️⃣ Remplir les données

1. Ouvrir `data/colab/TEMPLATE_etudiants_preferences.xlsx`
2. Remplacer les 3 lignes d'exemple par les vraies données
3. **Sauvegarder sous** `data/colab/etudiants_colab.xlsx`

**Colonnes obligatoires :**
- `student_id` : matricule unique
- `nom`, `prenom`, `email`
- `adm_niveau` : `ADM2` ou `ADM3`
- `adm_code_pref_1` : code de la zone préférée

---

### 4️⃣ Lancer l'attribution

**Test (simulation) :**
```powershell
poetry run python scripts/colab_assign_mailles_from_excel.py `
  --input data/colab/etudiants_colab.xlsx `
  --dry-run true
```

**Production (réel) :**
```powershell
poetry run python scripts/colab_assign_mailles_from_excel.py `
  --input data/colab/etudiants_colab.xlsx `
  --dry-run false
```

---

## ✅ Vérification

```sql
-- Voir les attributions
SELECT 
    student_id,
    nom || ' ' || prenom as etudiant,
    maille_code,
    maille_pref_name,
    pref_rank_used
FROM atlas.v_colab_maille_assignment_details
ORDER BY assigned_at DESC;

-- Étudiants sans maille
SELECT * FROM atlas.v_colab_students_without_maille;

-- Stats par zone
SELECT * FROM atlas.v_colab_assignments_by_adm;
```

---

## 🔄 Workflow complet

```
┌─────────────────────────┐
│ Formulaire Google Forms │
│ ou collecte manuelle    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Consolidation Excel     │
│ etudiants_colab.xlsx    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Script Python           │
│ --dry-run true (test)   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Validation OK ?         │
│ Oui → --dry-run false   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Attribution en base     │
│ colab_maille_assignments│
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Visible dans            │
│ Atlas Colab Studio      │
└─────────────────────────┘
```

---

## 📚 Documentation complète

Pour plus de détails : `docs/COLAB_MAILLE_ASSIGNMENT.md`

---

## ⚠️ Points d'attention

1. **Codes ADM** : Doivent exister dans `atlas.adm2_tg` ou `atlas.adm3_tg`
2. **Doublons** : Pas de `student_id` en double
3. **Dry-run** : Toujours tester avant de lancer en production
4. **Backup** : Sauvegarder la base avant la première exécution

---

## 🆘 En cas de problème

### Erreur "Code ADM invalide"
→ Vérifier les codes dans la base :
```sql
SELECT code, name FROM atlas.adm2_tg ORDER BY name;
SELECT code, name FROM atlas.adm3_tg ORDER BY name;
```

### Erreur "Aucune maille disponible"
→ Augmenter `--max-students-per-maille 2` ou ajouter d'autres préférences

### Réinitialiser les attributions
```sql
TRUNCATE atlas.colab_maille_assignments CASCADE;
```

---

**Prêt à démarrer ? Suivez les 4 étapes ci-dessus ! 🎯**
