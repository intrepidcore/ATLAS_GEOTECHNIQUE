# 📍 GÉOCODAGE STRICT - RÉSUMÉ EXÉCUTIF

## ✅ Système Opérationnel

**Politique** : Seul **Davie** accepté automatiquement (match exact synonym)  
**Reste** : 6 pending + 1 sans suggestion → **Validation manuelle requise**

---

## 🎯 Résultats

| Statut | Count | Localités |
|--------|-------|-----------|
| ✅ **Accepted** | 1 | Davie |
| ⚠️ **Pending** | 6 | Tekpo, Apeheme, Kontongbongue, Konsogou T1/T2, Dzogbecope |
| ❌ **No Match** | 1 | Nassablé |

---

## 🔒 Règles Auto-Accept

1. **Synonym** (table blanche) → ✅ AUTO
2. **Trigram+Tokens** (sim >= 0.85 ET jaccard >= 0.66) → ✅ AUTO
3. **Tout le reste** → ⚠️ PENDING

---

## 🚀 Commandes Rapides

```bash
# 1. Générer suggestions
python run_sql.py step1_generate_suggestions.sql

# 2. Appliquer accepted
python run_sql.py step2_apply_accepted_suggestions.sql

# 3. Vérifier
python check_suggestions.py
```

---

## 📋 TODO UI

**Page "Géocodage"** :
- Liste pending avec candidats
- Actions : Accept / Reject / Modify
- Après validation → `step2_apply_accepted_suggestions.sql`

**Endpoints API** :
```
GET  /geocode/suggestions?status=pending
POST /geocode/suggestions/{id}/accept
POST /geocode/suggestions/{id}/reject
```

---

## 🔧 Maintenance

**Ajouter synonyme validé** :
```sql
INSERT INTO adm3_synonyms VALUES ('tekpo', 'TG030709');
REFRESH MATERIALIZED VIEW adm3_names;
```

**Re-générer** : `step1_generate_suggestions.sql`

---

**Status** : ✅ Prêt pour intégration UI  
**Documentation complète** : `GEOCODING_SYSTEM_REPORT.md`
