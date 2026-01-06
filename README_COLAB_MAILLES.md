# 🎯 Système d'Attribution Automatique des Mailles Colab

> **Objectif :** Attribuer automatiquement des mailles nationales (2 km²) aux étudiants Atlas Colab à partir d'un simple fichier Excel.

---

## 🚀 Démarrage en 3 minutes

### 1. Installation (une seule fois)

```powershell
cd C:\PROJET_ATLAS_MASTER\atlas

# Appliquer la migration
psql $env:DATABASE_URL -f db/migrations/082_colab_maille_assignment_system.sql

# Vérifier l'installation
poetry run python scripts/verify_colab_setup.py
```

### 2. Créer le fichier Excel

```powershell
# Générer le template avec exemples
poetry run python scripts/create_excel_template.py

# Ouvrir data/colab/TEMPLATE_etudiants_preferences.xlsx
# Remplir avec les vraies données
# Sauvegarder sous data/colab/etudiants_colab.xlsx
```

### 3. Lancer l'attribution

```powershell
# Test (simulation)
.\scripts\run_colab_attribution.ps1 -DryRun

# Production (réel)
.\scripts\run_colab_attribution.ps1
```

**C'est tout ! ✨**

---

## 📁 Fichiers créés

```
atlas/
├── db/migrations/
│   └── 082_colab_maille_assignment_system.sql    ⭐ Migration
│
├── scripts/
│   ├── colab_assign_mailles_from_excel.py        ⭐ Script principal
│   ├── create_excel_template.py                   🔧 Template Excel
│   ├── verify_colab_setup.py                      ✅ Vérification
│   ├── export_colab_assignments.py                📊 Export CSV
│   └── run_colab_attribution.ps1                  🎯 Wrapper PowerShell
│
├── data/colab/
│   ├── README.md                                   📖 Instructions
│   └── TEMPLATE_etudiants_preferences.xlsx        📊 Template
│
├── tests/
│   └── test_colab_assignment.sql                  🧪 Tests
│
├── docs/
│   └── COLAB_MAILLE_ASSIGNMENT.md                 📚 Doc complète
│
├── QUICKSTART_COLAB_MAILLES.md                    🚀 Guide rapide
├── COLAB_MAILLES_IMPLEMENTATION.md                📦 Implémentation
├── COLAB_MAILLES_INDEX.md                         📑 Index
├── COLAB_MAILLES_RESUME.md                        📝 Résumé
└── README_COLAB_MAILLES.md                        👈 Ce fichier
```

---

## 📖 Documentation

### Par niveau d'expertise

| Niveau | Fichier | Durée |
|--------|---------|-------|
| 🟢 **Débutant** | `QUICKSTART_COLAB_MAILLES.md` | 15 min |
| 🟡 **Utilisateur** | `data/colab/README.md` | 30 min |
| 🟠 **Expert** | `docs/COLAB_MAILLE_ASSIGNMENT.md` | 1h |
| 🔴 **Développeur** | `COLAB_MAILLES_IMPLEMENTATION.md` | 2h |

### Par besoin

- **Démarrer rapidement** → `QUICKSTART_COLAB_MAILLES.md`
- **Comprendre le format Excel** → `data/colab/README.md`
- **Voir toutes les options** → `docs/COLAB_MAILLE_ASSIGNMENT.md`
- **Comprendre l'architecture** → `COLAB_MAILLES_IMPLEMENTATION.md`
- **Index de tous les fichiers** → `COLAB_MAILLES_INDEX.md`
- **Résumé exécutif** → `COLAB_MAILLES_RESUME.md`

---

## 🎓 Comment ça marche ?

### Algorithme simple

```
Pour chaque étudiant:
  1. Essayer préférence 1 → Maille dispo ? → Attribuer ✓
  2. Sinon, essayer préférence 2 → Maille dispo ? → Attribuer ✓
  3. Sinon, essayer préférence 3 → Maille dispo ? → Attribuer ✓
  4. Sinon → Marquer "sans maille" ⚠️
```

### Format Excel

| Colonne | Obligatoire | Exemple |
|---------|-------------|---------|
| `student_id` | ✅ | `ETU2025001` |
| `nom` | ✅ | `KOUASSI` |
| `prenom` | ✅ | `Jean` |
| `email` | ✅ | `jean@example.tg` |
| `adm_niveau` | ✅ | `ADM2` ou `ADM3` |
| `adm_code_pref_1` | ✅ | `TG-M` |
| `adm_code_pref_2` | ❌ | `TG-K` |
| `adm_code_pref_3` | ❌ | `TG-C` |

---

## 🔍 Vérifier les résultats

```sql
-- Voir les attributions
SELECT * FROM atlas.v_colab_maille_assignment_details;

-- Étudiants sans maille
SELECT * FROM atlas.v_colab_students_without_maille;

-- Statistiques
SELECT * FROM atlas.v_colab_assignments_by_adm;
```

Ou en PowerShell :

```powershell
# Export CSV
poetry run python scripts/export_colab_assignments.py
```

---

## 🛠️ Commandes utiles

### Vérification

```powershell
# Vérifier l'installation
poetry run python scripts/verify_colab_setup.py

# Tester la migration
psql $env:DATABASE_URL -f tests/test_colab_assignment.sql
```

### Attribution

```powershell
# Avec le wrapper PowerShell (recommandé)
.\scripts\run_colab_attribution.ps1 -DryRun
.\scripts\run_colab_attribution.ps1

# Ou directement avec Python
poetry run python scripts/colab_assign_mailles_from_excel.py \
  --input data/colab/etudiants_colab.xlsx \
  --dry-run true
```

### Export

```powershell
# Export CSV des attributions
poetry run python scripts/export_colab_assignments.py
```

### Maintenance

```sql
-- Réinitialiser les attributions
TRUNCATE atlas.colab_maille_assignments CASCADE;

-- Supprimer un étudiant
DELETE FROM atlas.colab_student_prefs WHERE student_id = 'ETU2025001';
```

---

## 🔗 Intégration avec Atlas Colab Studio

### Créer des missions automatiquement

```sql
-- Créer une mission par préfecture
INSERT INTO atlas.colab_missions (code, title, theme, maille_id, zone_label, status)
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

## ❓ FAQ

### Que faire si des étudiants n'ont pas de maille ?

1. Vérifier les codes ADM dans leurs préférences
2. Augmenter `--max-students-per-maille 2`
3. Ajouter une 3ème préférence dans une zone moins demandée

### Comment réinitialiser tout ?

```sql
TRUNCATE atlas.colab_maille_assignments CASCADE;
TRUNCATE atlas.colab_student_prefs CASCADE;
```

### Peut-on modifier une attribution ?

Oui, soit manuellement en SQL, soit en supprimant l'attribution et en relançant le script.

---

## 🆘 En cas de problème

### Erreur "Code ADM invalide"

```sql
-- Lister les codes valides
SELECT code, name FROM atlas.adm2_tg ORDER BY name;
SELECT code, name FROM atlas.adm3_tg ORDER BY name;
```

### Erreur "Fichier non trouvé"

```powershell
# Vérifier le chemin
Test-Path data\colab\etudiants_colab.xlsx

# Créer le template
poetry run python scripts\create_excel_template.py
```

### Erreur de connexion base de données

```powershell
# Vérifier DATABASE_URL
echo $env:DATABASE_URL

# Tester la connexion
psql $env:DATABASE_URL -c "SELECT version();"
```

---

## 📊 Statistiques

Après attribution, vous pouvez voir :

- ✅ Nombre d'étudiants par zone
- ✅ Répartition par rang de préférence
- ✅ Mailles les plus demandées
- ✅ Étudiants sans maille

Tout est disponible dans les vues SQL ou via export CSV.

---

## 🎉 Résultat final

**Avant :** Collecte Excel → Traitement manuel long et fastidieux

**Après :** Collecte Excel → **1 commande** → Attributions automatiques ✨

```powershell
.\scripts\run_colab_attribution.ps1
```

**→ Chaque étudiant a sa maille, visible dans Atlas Colab Studio !**

---

## 📞 Support

**Documentation complète :** `docs/COLAB_MAILLE_ASSIGNMENT.md`

**Scripts de diagnostic :**
```powershell
poetry run python scripts/verify_colab_setup.py
```

**Contact :** Équipe Atlas Lab

---

**Version :** 1.0.0  
**Date :** 2026-01-05  
**Statut :** ✅ Prêt à l'emploi

**Bon courage ! 🚀**
