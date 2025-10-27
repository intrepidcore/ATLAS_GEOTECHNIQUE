# 📍 SYSTÈME DE GÉOCODAGE STRICT - RAPPORT FINAL

**Date** : 2025-10-26  
**Base** : `atlas_clean`  
**Politique** : Matching strict + Suggestions manuelles

---

## ✅ Résultats Actuels

### Sondages Géocodés
| Code Site | Localité | ADM3 Code | Canton | Statut |
|-----------|----------|-----------|--------|--------|
| DAVIE | Davie | TG030805 | Davie (Zio) | ✅ Auto-accepted (synonym) |

### Suggestions Pending (Validation Manuelle Requise)
| Code Site | Localité | Top Candidat | Score | Méthode |
|-----------|----------|--------------|-------|---------|
| TEKPO | Tekpo | Tchekpo (TG030709) | 0.40 | candidate |
| APEHEME | Apeheme | Lavie/ Apedome (TG041208) | 0.22 | candidate |
| KONTONGBONGUE | Kontongbongue | Tamongue (TG051515) | 0.22 | candidate |
| KONSOGOU_T2 | Konsogou T2 | Koutougou (TG020605) | 0.22 | candidate |
| KONSOGOU_T1 | Konsogou T1 | Koumongou (TG051902) | 0.22 | candidate |
| DZOGBECOPE | Dzogbecope | Dzolo (TG030104) | 0.21 | candidate |

### Sans Suggestion
| Code Site | Localité | Raison |
|-----------|----------|--------|
| NASSABLE | Nassablé | Aucun ADM3 similaire trouvé (< 20% similarité) |

---

## 🔒 Politique de Matching Strict

### Seuils Auto-Accept
1. **Synonym** (table blanche) : score = 0.99 → ✅ **AUTO-ACCEPTED**
2. **Trigram + Tokens** : score >= 0.85 ET jaccard >= 0.66 → ✅ **AUTO-ACCEPTED**
3. **Tout le reste** : → ⚠️ **PENDING** (validation manuelle UI)

### Méthodes de Scoring
- **synonym** : Match exact dans `adm3_synonyms` (table blanche curée manuellement)
- **trgm+tokens** : Similarité trigrammes >= 0.85 ET recouvrement tokens >= 0.66
- **trgm** : Similarité trigrammes >= 0.70 (mais tokens < 0.66)
- **tokens** : Recouvrement tokens >= 0.50 (mais sim < 0.70)
- **candidate** : Tout le reste (similarité > 0.20)

---

## 📊 Architecture Technique

### Tables
```sql
-- Vue matérialisée des noms ADM3 normalisés
adm3_names (code, name, name_norm, adm2_pcode, adm1_pcode)

-- Table blanche des synonymes validés
adm3_synonyms (alias_norm PRIMARY KEY, adm3_code)

-- Table des suggestions pour UI
geocode_suggestions (
  id, entity, entity_id, localite, adm2_code,
  candidates JSONB, top_code, top_score, top_method,
  status ('pending'|'accepted'|'rejected'),
  created_at, decided_at
)
```

### Fonction Principale
```sql
match_adm3_strict(p_localite text, p_adm2_code text, p_limit int)
RETURNS TABLE(adm3_code, adm3_name, score, method)
```

**Passes** :
1. Synonymes (table blanche) → score 0.99
2. Trigrammes + Jaccard → score brut (0.20-1.00)
3. Filtrage par seuils pour déterminer method

---

## 🚀 Flux d'Utilisation

### 1. Import Initial
```bash
# Import des données (localité remplie, adm3_code vide)
python scripts/02_import_excel.py --file data.xlsx --dsn "postgresql://..."
```

### 2. Génération des Suggestions
```bash
python run_sql.py step1_generate_suggestions.sql
```

**Résultat** :
- Suggestions `accepted` : auto-validées (synonym ou score très élevé)
- Suggestions `pending` : nécessitent validation manuelle UI
- Pas de suggestion : aucun match trouvé (< 20% similarité)

### 3. Application des Accepted
```bash
python run_sql.py step2_apply_accepted_suggestions.sql
```

**Résultat** : `sondages.meta->>'adm3_code'` rempli pour les accepted

### 4. Validation Manuelle (UI Géocodage)
**Interface proposée** :
- Liste des suggestions `pending`
- Affichage : localité, top candidat, score, liste complète des candidats
- Actions : Accept / Reject / Modifier
- Filtres : par préfecture, par score

**Endpoints API** (à implémenter dans Rust) :
```
GET  /geocode/suggestions?status=pending
POST /geocode/suggestions/{id}/accept
POST /geocode/suggestions/{id}/reject
POST /geocode/suggestions/{id}/update {adm3_code}
```

### 5. Application Finale
```bash
# Après validation UI
python run_sql.py step2_apply_accepted_suggestions.sql

# Refresh vues matérialisées
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;
```

---

## 🔧 Maintenance

### Ajouter un Synonyme Validé
```sql
INSERT INTO adm3_synonyms(alias_norm, adm3_code) VALUES
('nassable', 'TG051703')  -- Exemple si validé manuellement
ON CONFLICT (alias_norm) DO UPDATE SET adm3_code = EXCLUDED.adm3_code;

-- Refresh la vue
REFRESH MATERIALIZED VIEW adm3_names;

-- Re-générer les suggestions
-- (exécuter step1_generate_suggestions.sql)
```

### Ajouter un Alias ADM3
```sql
-- Si l'ADM3 existe mais avec un nom différent
UPDATE adm3 
SET alt_names = 'Nassable,Nassablé,Cinkassé'
WHERE adm3_pcode = 'TG051703';

-- Refresh
REFRESH MATERIALIZED VIEW adm3_names;
```

---

## 📈 Statistiques Actuelles

| Métrique | Valeur |
|----------|--------|
| **Total sondages** | 8 |
| **Géocodés (auto)** | 1 (12.5%) |
| **Pending (validation)** | 6 (75%) |
| **Sans suggestion** | 1 (12.5%) |
| **Taux auto-accept** | 12.5% |

---

## 🎯 Prochaines Étapes

### Priorité 1 : UI Géocodage
- [ ] Créer page "Géocodage" dans l'UI
- [ ] Implémenter endpoints API Rust
- [ ] Interface de validation (accept/reject/modify)
- [ ] Filtres et recherche

### Priorité 2 : Enrichissement Référentiel
- [ ] Valider manuellement les 6 pending
- [ ] Ajouter synonymes validés dans `adm3_synonyms`
- [ ] Compléter `adm3.alt_names` si nécessaire
- [ ] Traiter "Nassablé" (recherche manuelle canton réel)

### Priorité 3 : Automatisation
- [ ] Script de ré-import avec auto-géocodage
- [ ] Job automatique de génération suggestions après import
- [ ] Notification UI si nouvelles suggestions pending

---

## 📝 Fichiers SQL Créés

1. `step0_strict_matching_setup.sql` - Setup initial (extensions, fonctions, tables)
2. `step1_generate_suggestions.sql` - Génération des suggestions
3. `step2_apply_accepted_suggestions.sql` - Application des accepted
4. `fix_matching_threshold.sql` - Ajustement seuils (si nécessaire)

---

**Rapport généré le** : 2025-10-26 19:40 UTC  
**Système** : Politique stricte opérationnelle ✅  
**Prêt pour** : Intégration UI + Validation manuelle
