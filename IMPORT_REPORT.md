# 📊 RAPPORT D'IMPORT GÉOTECHNIQUE

**Date** : 2025-10-26  
**Base** : `atlas_clean`  
**Fichiers traités** : 2/13 (fichiers standardisés uniquement)

---

## ✅ Fichiers Importés avec Succès

### 1. `atlas_import_nicabou_ninsao_vianney.xlsx`
**Auteur** : NICABOU Ninsao Vianney  
**Durée** : 10.8s  
**Status** : ✅ Succès complet

**Données Canoniques** :
- 4 sondages (APEHEME, DAVIE, DZOGBECOPE, TEKPO)
- 12 échantillons (3 profondeurs × 4 sites)
- 9 essais Atterberg
- 9 essais VBS

**Données RAW** :
- 162 points AGT (tamisage)
- 72 points AGS (sédimentométrie)
- 234 liens RAW → échantillons créés

**Avertissements** :
- ⚠️ Tous les sondages sans GPS ni ADM3 (mode orphelin)

---

### 2. `atlas_import_soglo_ferdinand.xlsx`
**Auteur** : SOGLO Ferdinand  
**Durée** : 10.9s  
**Status** : ✅ Succès avec erreurs mineures

**Données Canoniques** :
- 4 sondages (KONSOGOU_T1, KONSOGOU_T2, NASSABLE, KONTONGBONGUE)
- 12 échantillons (3 profondeurs × 4 sites)
- 12 essais Atterberg
- 12 essais VBS

**Données RAW** :
- 208 points AGT
- 63 points AGS
- 60 mesures Atterberg RAW (24 rejetées)
- 331 liens RAW → échantillons créés

**Erreurs** :
- ❌ 24 mesures Atterberg RAW rejetées : `LP` au lieu de `PL` (erreur de saisie)

**Avertissements** :
- ⚠️ Tous les sondages sans GPS ni ADM3 (mode orphelin)

---

## 📈 Totaux en Base

### Tables Canoniques
| Table | Lignes | Source |
|-------|--------|--------|
| `sondages` | 8 | 2 fichiers |
| `echantillons` | 24 | 2 fichiers |
| `essais_atterberg` | 21 | 2 fichiers |
| `essais_vbs` | 21 | 2 fichiers |

### Tables RAW (Archives Fidèles)
| Table | Lignes | Liens OK |
|-------|--------|----------|
| `raw_lab_agt` | 370 | 370 (100%) |
| `raw_lab_ags` | 135 | 135 (100%) |
| `raw_lab_atterberg` | 60 | 60 (100%) |

**Total RAW** : 565 mesures archivées avec liens vers échantillons

---

## ⚠️ Problèmes Identifiés

### 1. Géolocalisation Manquante
**Tous les sondages** (8/8) n'ont ni GPS ni ADM3 :
- Mode "orphelin" activé
- Données importées mais **non géolocalisables**
- **Impact** : Ne peuvent pas être affichés sur la carte
- **Solution** : Ajouter manuellement les ADM3 ou GPS dans les fichiers sources

### 2. Erreurs de Saisie Atterberg RAW
**24 mesures** rejetées dans `soglo_ferdinand.xlsx` :
- Type `LP` au lieu de `PL` (Limite Plastique)
- **Solution** : Corriger le fichier source et ré-importer

---

## 📋 Fichiers Restants (Non Standardisés)

**11 fichiers** avec formats hétérogènes nécessitent un traitement manuel :
1. `ADOTE Adote emmanuel.xlsx` - Format laboratoire brut
2. `AKONDOR Tigana Messanh.xlsx` - Format laboratoire brut
3. `ANYO Akouete jean-paul.xlsx` - Format laboratoire brut
4. `GAMBAGA Inoussa.xlsx` - Format laboratoire brut
5. `NABIYOU Warou.xlsx` - Format laboratoire brut
6. `NGOAPO-GOLLO Roxane Lenira Chrisie.xlsx` - Format laboratoire brut
7. `NICABOU Ninsao Vianney.xlsx` - Format laboratoire brut
8. `OUDJABITI Bassirou.xlsx` - Format laboratoire brut
9. `SOGLO FERDINAND.xlsx` - Format laboratoire brut
10. `TCHALA Komla Hyacinthe.xlsx` - Format laboratoire brut
11. `ABGBANA_Essi_Odette.xlsx` - Fichier vide

**Caractéristiques** :
- Feuilles nommées par site/essai (ex: "AGT OGARO", "AGS YALGA")
- Pas de structure canonique
- Nécessite parsing personnalisé par fichier

---

## 🔧 Corrections Apportées

### Script d'Import (`02_import_excel.py`)
1. ✅ Acceptation sondages sans géoloc (mode orphelin)
2. ✅ Correction rétro-liaison RAW (syntaxe SQL FROM)
3. ✅ Adaptation UUID au lieu de BIGINT pour `echantillon_id`

### Base de Données
1. ✅ Création tables RAW (`raw_lab_agt`, `raw_lab_ags`, `raw_lab_atterberg`)
2. ✅ Adaptation colonnes `echantillon_id` en UUID
3. ✅ Enum `atterberg_test_type` créé

---

## 📊 Statistiques

**Taux de succès** : 100% (2/2 fichiers standardisés)  
**Données importées** : 639 lignes (74 canoniques + 565 RAW)  
**Durée totale** : 21.7s  
**Erreurs bloquantes** : 0  
**Avertissements** : 32 (géoloc manquante + erreurs saisie)

---

## 🚀 Prochaines Étapes

### Priorité 1 : Géolocalisation
- [ ] Ajouter ADM3 ou GPS aux 8 sondages orphelins
- [ ] Ré-importer ou UPDATE manuel en base

### Priorité 2 : Correction Erreurs
- [ ] Corriger `LP` → `PL` dans `soglo_ferdinand.xlsx`
- [ ] Ré-importer les 24 mesures Atterberg RAW

### Priorité 3 : Fichiers Non Standardisés
- [ ] Développer parsers spécifiques pour les 11 fichiers restants
- [ ] Ou standardiser manuellement les fichiers sources

### Priorité 4 : Vues & API
- [ ] Rafraîchir `mv_mailles_geotech` (actuellement skip car sondages orphelins)
- [ ] Vérifier affichage UI une fois géoloc ajoutée

---

## ✅ Validation SQL

```sql
-- Compteurs
SELECT 'sondages' AS table, COUNT(*) FROM sondages
UNION ALL SELECT 'echantillons', COUNT(*) FROM echantillons
UNION ALL SELECT 'essais_atterberg', COUNT(*) FROM essais_atterberg
UNION ALL SELECT 'essais_vbs', COUNT(*) FROM essais_vbs
UNION ALL SELECT 'raw_lab_agt', COUNT(*) FROM raw_lab_agt
UNION ALL SELECT 'raw_lab_ags', COUNT(*) FROM raw_lab_ags
UNION ALL SELECT 'raw_lab_atterberg', COUNT(*) FROM raw_lab_atterberg;

-- Rétro-liaison RAW
SELECT 
  (SELECT COUNT(*) FROM raw_lab_agt WHERE echantillon_id IS NULL) AS agt_unlinked,
  (SELECT COUNT(*) FROM raw_lab_ags WHERE echantillon_id IS NULL) AS ags_unlinked,
  (SELECT COUNT(*) FROM raw_lab_atterberg WHERE echantillon_id IS NULL) AS att_unlinked;
-- Résultat attendu : 0, 0, 0

-- Sondages orphelins
SELECT COUNT(*) AS orphelins FROM sondages WHERE geom IS NULL;
-- Résultat : 8 (tous)
```

---

**Rapport généré le** : 2025-10-26 17:57 UTC  
**Par** : Script d'import automatisé v1.5.3
