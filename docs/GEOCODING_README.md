# 🗺️ Système de Géocodage Strict - Guide d'Utilisation

**Version** : Atlas v1.6.0  
**Statut** : ✅ Opérationnel  
**Documentation complète** : `IMPLEMENTATION_FINALE_GEOCODAGE.md`

---

## 🚀 Démarrage Rapide

### 1. Démarrer les Services
```bash
cd c:\PROJET_ATLAS_MASTER\atlas
docker compose up -d
```

### 2. Générer les Suggestions
```bash
python run_sql.py step1_generate_suggestions.sql
```

### 3. Consulter les Suggestions
```bash
# Via API
curl http://localhost:8000/geocode/stats
curl http://localhost:8000/geocode/suggestions?status=pending

# Via Python
python check_suggestions.py
```

### 4. Valider Manuellement
```bash
# Accepter une suggestion
curl -X POST http://localhost:8000/geocode/suggestions/2/accept

# Rejeter une suggestion
curl -X POST http://localhost:8000/geocode/suggestions/3/reject

# Modifier l'ADM3
curl -X POST http://localhost:8000/geocode/suggestions/4/update \
  -H "Content-Type: application/json" \
  -d '{"adm3_code": "TG030709"}'
```

### 5. Appliquer les Validations
```bash
curl -X POST http://localhost:8000/geocode/apply-accepted
```

---

## 📋 Endpoints API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/geocode/stats` | Statistiques globales |
| GET | `/geocode/suggestions` | Liste toutes les suggestions |
| GET | `/geocode/suggestions?status=pending` | Filtrer par statut |
| GET | `/geocode/suggestions?adm2=TG03` | Filtrer par préfecture |
| GET | `/geocode/suggestions?q=Tekpo` | Recherche par localité |
| POST | `/geocode/suggestions/:id/accept` | Accepter une suggestion |
| POST | `/geocode/suggestions/:id/reject` | Rejeter une suggestion |
| POST | `/geocode/suggestions/:id/update` | Modifier l'ADM3 |
| POST | `/geocode/apply-accepted` | Appliquer toutes les accepted |

---

## 🎯 Politique de Matching

### Auto-Accept (Automatique)
- **Synonym** : Match exact dans table blanche → ✅ Accepté
- **Trigram+Tokens** : Score >= 85% ET recouvrement >= 66% → ✅ Accepté

### Pending (Validation Manuelle)
- **Candidate** : Score < 85% ou recouvrement < 66% → ⚠️ À valider
- **No Match** : Aucun candidat > 20% → ❌ Géocodage manuel requis

---

## 📊 Exemples de Réponses API

### GET /geocode/stats
```json
{
  "total": 7,
  "accepted": 1,
  "pending": 6,
  "rejected": 0,
  "no_suggestion": 1
}
```

### GET /geocode/suggestions?status=pending
```json
[
  {
    "id": 2,
    "entity": "sondages",
    "entity_id": "db47ed3b-344e-4d62-81bb-9568a4f0cfe5",
    "localite": "Tekpo",
    "top_code": "TG030709",
    "top_score": 0.4,
    "top_method": "candidate",
    "status": "pending",
    "candidates": [
      {
        "code": "TG030709",
        "name": "Tchekpo",
        "score": 0.4,
        "method": "candidate"
      },
      {
        "code": "TG030604",
        "name": "Dzrekpo",
        "score": 0.27,
        "method": "candidate"
      }
    ]
  }
]
```

### POST /geocode/apply-accepted
```json
{
  "applied_count": 1,
  "refreshed": true
}
```

---

## 🔧 Maintenance

### Ajouter un Synonyme Validé
```sql
-- Après validation manuelle d'une suggestion
INSERT INTO adm3_synonyms(alias_norm, adm3_code) VALUES
('tekpo', 'TG030709')
ON CONFLICT (alias_norm) DO UPDATE SET adm3_code = EXCLUDED.adm3_code;

-- Refresh la vue
REFRESH MATERIALIZED VIEW adm3_names;

-- Re-générer les suggestions
-- (exécuter step1_generate_suggestions.sql)
```

### Vérifier l'État du Système
```bash
# Statistiques
curl http://localhost:8000/geocode/stats

# Sondages sans ADM3
SELECT COUNT(*) FROM sondages WHERE (meta->>'adm3_code') IS NULL;

# Suggestions en attente
SELECT COUNT(*) FROM geocode_suggestions WHERE status = 'pending';
```

### Nettoyer les Suggestions
```sql
-- Supprimer les suggestions rejected
DELETE FROM geocode_suggestions WHERE status = 'rejected';

-- Régénérer toutes les suggestions
TRUNCATE geocode_suggestions;
-- Puis exécuter step1_generate_suggestions.sql
```

---

## 📁 Structure des Fichiers

```
atlas/
├── step0_strict_matching_setup.sql      # Setup initial DB
├── step1_generate_suggestions.sql       # Génération suggestions
├── step2_apply_accepted_suggestions.sql # Application
├── check_suggestions.py                 # Vérification Python
├── test_geocoding_api.ps1              # Tests API
├── services/api-geo/src/
│   └── geocoding.rs                    # Module API (340 lignes)
└── docs/
    ├── GEOCODING_README.md             # Ce fichier
    ├── IMPLEMENTATION_FINALE_GEOCODAGE.md  # Rapport complet
    └── GEOCODING_UI_REFONTE.md         # Proposition UI
```

---

## ⚠️ Troubleshooting

### Problème : API ne répond pas
```bash
# Vérifier les logs
docker compose logs -f api-geo

# Redémarrer
docker compose restart api-geo
```

### Problème : Suggestions vides
```bash
# Vérifier les sondages
SELECT COUNT(*) FROM sondages WHERE (meta->>'localite') IS NOT NULL;

# Re-générer
python run_sql.py step1_generate_suggestions.sql
```

### Problème : Erreur "Connection refused"
```bash
# Vérifier la DB
docker compose ps
docker compose up -d db

# Attendre 10s puis relancer API
docker compose up -d api-geo
```

---

## 📚 Documentation Complète

- **`IMPLEMENTATION_FINALE_GEOCODAGE.md`** - Rapport technique complet
- **`GEOCODING_SYSTEM_REPORT.md`** - Architecture détaillée
- **`GEOCODING_UI_REFONTE.md`** - Proposition UI (Phase 2)
- **`GEOCODING_SUMMARY.md`** - Résumé exécutif

---

## 🎯 Prochaines Étapes

### Phase 2 : UI Frontend
- [ ] Créer onglet "Suggestions" dans l'interface
- [ ] Interface de validation (accept/reject/modify)
- [ ] Filtres et recherche
- [ ] Statistiques visuelles

### Phase 3 : Automatisation
- [ ] Hook post-import (génération auto)
- [ ] Notification si pending > 0
- [ ] Export CSV suggestions

### Phase 4 : Enrichissement
- [ ] Valider les 6 suggestions pending
- [ ] Enrichir `adm3_synonyms`
- [ ] Traiter "Nassablé"

---

## 💡 Bonnes Pratiques

1. **Toujours vérifier** les suggestions avant d'appliquer
2. **Enrichir progressivement** la table `adm3_synonyms` avec les validations
3. **Documenter** les décisions de validation
4. **Sauvegarder** les snapshots avant modifications massives
5. **Tester** les endpoints après chaque modification

---

**Créé le** : 2025-10-26  
**Auteur** : Cascade AI  
**Support** : Voir `IMPLEMENTATION_FINALE_GEOCODAGE.md`
