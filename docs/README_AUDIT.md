# 📚 AUDIT DONNÉES & GÉOCODAGE - INDEX

**Date:** 2025-11-06  
**Version:** 1.0.0  
**Status:** ✅ DB prête, API/UI à implémenter

---

## 🎯 OBJECTIF

Passer d'un géocodage **par localité agrégée** (140 items) à un géocodage **par sondage individuel** (230 items).

---

## 📁 DOCUMENTS

### 1. **AUDIT_SYNTHESE.md** ⭐ COMMENCER ICI
- Vue d'ensemble exécutive
- État actuel vs attendu
- Plan d'implémentation (4h)
- Checklist complète

### 2. **AUDIT_DONNEES_PART1.md** - Schéma & Dictionnaire
- Tables principales (`sondages`, `atlas.surveys`)
- Colonnes, types, contraintes
- État actuel des données (230 sondages, 140 localités)
- KPI au niveau sondage

### 3. **AUDIT_DONNEES_PART2.md** - Incohérences & Solutions
- 🚨 Problème 1: Badge "2 sondages"
- 🚨 Problème 2: Sous-titre "LIMITE-OUNTIVOU"
- 🚨 Problème 3: `is_geocoded` mal calculé
- 🚨 Problème 4: 176 sondages sans localite
- ✅ Solutions détaillées (API `/sondages`)

### 4. **AUDIT_DONNEES_PART3.md** - Checklist & Migrations
- Checklist "Data Readiness"
- Migrations SQL (✅ appliquées)
- Commandes build & test
- Data lineage (Mermaid)
- Risques & debt technique

### 5. **SCHEMA_ERD.md** - Diagrammes
- ERD complet (Mermaid)
- Flux de données
- Fonctions clés (`atlas.norm()`, `atlas.refresh_surveys()`)
- Statistiques actuelles

### 6. **REQUETES_SQL_UTILES.md** - SQL Copiable
- KPI sondages/localités
- Recherche (code, localité)
- Géocodage (ADM3, géométrie)
- Maintenance (refresh, backfill)
- Analyses (distribution, qualité)

---

## ✅ MIGRATIONS APPLIQUÉES

### Migration 1: Backfill Localite
**Fichier:** `migrations/backfill_localite.sql`  
**Status:** ✅ Appliquée  
**Résultat:** 176 sondages mis à jour, 100% ont maintenant une localite

### Migration 2: Recalculer is_geocoded
**Fichier:** `migrations/fix_is_geocoded_sondages.sql`  
**Status:** ✅ Appliquée  
**Résultat:** Colonne générée `is_geocoded = (geom IS NOT NULL OR adm3_id IS NOT NULL)`

### Migration 3: Recréer Vues
**Fichier:** `migrations/recreate_views_with_flags.sql`  
**Status:** ✅ Appliquée  
**Résultat:** Vues avec `has_geom` et `has_adm3`, 140 localités

---

## 📊 ÉTAT ACTUEL

### Base de Données ✅

| Métrique | Valeur | Status |
|----------|--------|--------|
| Sondages totaux | 230 | ✅ |
| Avec localite | 230 (100%) | ✅ Backfill appliqué |
| Géocodés | 1 (0.4%) | ⚠️ 229 à géocoder |
| Localités uniques | 140 | ✅ |
| `is_geocoded` correct | Oui | ✅ Colonne générée |

### API ⚠️ À Implémenter

| Endpoint | Status | Fichier |
|----------|--------|---------|
| `GET /sondages` | ❌ À créer | `services/api-geo/src/sondages.rs` |
| `GET /sondages/stats` | ❌ À créer | `services/api-geo/src/sondages.rs` |
| `PATCH /sondages/:id/geometry` | ❌ À créer | `services/api-geo/src/sondages.rs` |

### UI ⚠️ À Modifier

| Fichier | Action | Status |
|---------|--------|--------|
| `ui/src/api/sondages.ts` | Créer client API | ❌ |
| `ui/src/modal/sondages-modal.ts` | Remplacer `/surveys-canon` | ❌ |
| `ui/src/geocode-canon-panel.ts` | Stats sondages | ❌ |
| `ui/src/suggestions-canon-panel.ts` | Stats sondages | ❌ |

---

## 🚀 PLAN D'IMPLÉMENTATION

### Phase 1: API Rust (2h)

1. Créer `services/api-geo/src/sondages.rs`
2. Copier/adapter depuis `surveys_canon.rs`
3. Ajouter routes dans `main.rs`
4. Build & test

**Commandes:**
```bash
docker-compose build api-geo
docker-compose up -d api-geo
curl http://localhost:8000/sondages/stats | jq
```

### Phase 2: Client TypeScript (1h)

1. Créer `ui/src/api/sondages.ts`
2. Définir types `Sondage`, `SondagesStats`
3. Implémenter fonctions API

**Commandes:**
```bash
cd ui && npm run build
```

### Phase 3: UI (1h)

1. Modifier `sondages-modal.ts`
   - Import `listSondages` au lieu de `listSurveysCanon`
   - Supprimer badge "X sondages"
   - Afficher 230 items

2. Modifier `geocode-canon-panel.ts`
   - Stats: "229 sondages" au lieu de "39 villages"

3. Modifier `suggestions-canon-panel.ts`
   - Idem

### Phase 4: Test (30min)

1. Ctrl+F5 (purge cache)
2. Ouvrir "Liste des Sondages"
3. Vérifier: 230 items affichés
4. Vérifier: Pas de badge "2 sondages"
5. Ouvrir "Géocodage Amélioré"
6. Badge: "229 sondages sans géométrie"
7. Géocoder 1 sondage
8. Vérifier: Badge passe à 228

**Temps total estimé:** 4h

---

## 📖 GUIDE DE LECTURE

### Pour comprendre le problème
1. Lire **AUDIT_SYNTHESE.md** (10 min)
2. Voir captures d'écran (badge "2 sondages", "LIMITE-OUNTIVOU")
3. Lire **AUDIT_DONNEES_PART2.md** section E (incohérences)

### Pour implémenter la solution
1. Lire **AUDIT_DONNEES_PART2.md** section F (recommandations)
2. Copier code Rust/TypeScript fourni
3. Suivre **AUDIT_DONNEES_PART3.md** section G (checklist)

### Pour comprendre le modèle de données
1. Voir **SCHEMA_ERD.md** (diagrammes Mermaid)
2. Lire **AUDIT_DONNEES_PART1.md** section A (dictionnaire)
3. Utiliser **REQUETES_SQL_UTILES.md** pour explorer

### Pour débugger
1. Utiliser **REQUETES_SQL_UTILES.md** (diagnostics)
2. Vérifier migrations dans `migrations/`
3. Lire **AUDIT_DONNEES_PART3.md** section J (risques)

---

## 🔑 CONCEPTS CLÉS

### Sondage vs Localité

| Aspect | Sondage | Localité |
|--------|---------|----------|
| Table | `sondages` | `atlas.surveys` |
| Nombre | 230 | 140 |
| Granularité | 1 sondage = 1 ligne | 1 localité = N sondages |
| Code | GRANULO-KOMAH | GRANULO-KOMAH (canonique) |
| Géocodage | Individuel | Tous les sondages |
| API | `/sondages` | `/surveys-canon` |

### Flags de Géocodage

```sql
-- Dans sondages (GENERATED)
is_geocoded = (geom IS NOT NULL OR adm3_id IS NOT NULL)

-- Dans atlas.surveys (GENERATED)
has_geom = (geom IS NOT NULL)
has_adm3 = (adm3_id IS NOT NULL)
is_geocoded = (has_geom OR has_adm3)
```

### Normalisation

```sql
-- atlas.norm()
"Adjengré  " → "adjengre"

-- extract_localite()
"GRANULO-KOMAH" → "KOMAH"

-- similarity()
similarity("Komah", "Komah") = 1.0  (100%)
similarity("Komah", "Koma") = 0.85  (85%)
```

---

## 🛠️ COMMANDES UTILES

### Base de Données

```bash
# Se connecter
docker exec -it atlas-db psql -U atlas atlas_clean

# KPI sondages
docker exec -i atlas-db psql -U atlas atlas_clean -c "
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_geocoded) as geocodes
FROM sondages;
"

# Refresh canoniques
docker exec -i atlas-db psql -U atlas atlas_clean -c "SELECT atlas.refresh_surveys();"
```

### API

```bash
# Build
docker-compose build api-geo
docker-compose up -d api-geo

# Test
curl http://localhost:8000/surveys-canon/stats | jq
curl http://localhost:8000/sondages/stats | jq  # Après implémentation
```

### UI

```bash
# Build
cd ui && npm run build

# Dev
cd ui && npm run dev
```

---

## 📞 SUPPORT

### Questions Fréquentes

**Q: Pourquoi 230 sondages mais 140 localités?**  
R: Plusieurs sondages peuvent avoir la même localité (ex: GRANULO-KOMAH, BLEU-KOMAH → Komah).

**Q: Quelle est la différence entre `/sondages` et `/surveys-canon`?**  
R: `/sondages` retourne 230 items individuels, `/surveys-canon` retourne 140 localités agrégées.

**Q: Dois-je supprimer `/surveys-canon`?**  
R: Non, garder pour le toggle "Grouper par localité" (optionnel).

**Q: Les migrations sont-elles réversibles?**  
R: Oui, voir `migrations/*.sql` pour les commandes DROP.

**Q: Comment tester sans casser la prod?**  
R: Utiliser une DB de test ou un snapshot avant migrations.

### Ressources

- **Code Rust:** Voir `services/api-geo/src/surveys_canon.rs` (référence)
- **Code TypeScript:** Voir `ui/src/api/surveys-canon.ts` (référence)
- **SQL:** Voir `migrations/` et `docs/REQUETES_SQL_UTILES.md`
- **Diagrammes:** Voir `docs/SCHEMA_ERD.md`

---

## 📈 MÉTRIQUES DE SUCCÈS

### Avant Implémentation

- ❌ UI affiche 40 localités
- ❌ Badge "2 sondages" présent
- ❌ Sous-titre "LIMITE-OUNTIVOU"
- ❌ Géocodage appliqué à toute la localité
- ❌ Stats: "39 villages sans géométrie"

### Après Implémentation

- ✅ UI affiche 230 sondages
- ✅ Pas de badge
- ✅ Sous-titre "GRANULO-KOMAH • Commune: Komah"
- ✅ Géocodage appliqué à 1 sondage
- ✅ Stats: "229 sondages sans géométrie"

---

## 🎉 CONCLUSION

**Status:** Base de données prête, API/UI à implémenter (4h)

**Prochaines étapes:**
1. Implémenter API `/sondages` (Rust)
2. Créer client TypeScript
3. Modifier UI
4. Tester workflow complet

**Documentation complète disponible dans:**
- `docs/AUDIT_SYNTHESE.md` ⭐
- `docs/AUDIT_DONNEES_PART1.md`
- `docs/AUDIT_DONNEES_PART2.md`
- `docs/AUDIT_DONNEES_PART3.md`
- `docs/SCHEMA_ERD.md`
- `docs/REQUETES_SQL_UTILES.md`

**Migrations appliquées:**
- ✅ `migrations/backfill_localite.sql`
- ✅ `migrations/fix_is_geocoded_sondages.sql`
- ✅ `migrations/recreate_views_with_flags.sql`

---

**FIN DE L'INDEX**
