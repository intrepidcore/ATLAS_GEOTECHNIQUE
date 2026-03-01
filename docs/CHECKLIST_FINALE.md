# ✅ Checklist Finale - Tests et Vérifications

## 🎯 Objectif
Vérifier que le refactoring UI `/sondages` fonctionne correctement après les migrations de types.

---

## 1. ✅ Tests API (Backend)

### `/sondages/stats` ✅
```bash
curl http://localhost:8000/sondages/stats
# Attendu: {"total":230,"geocoded":1,"with_geom":1,"with_adm3":0,"missing_geom":229,"missing_adm3":230}
```

### `/sondages?limit=5` ✅
```bash
curl "http://localhost:8000/sondages?limit=5"
# Attendu: Array de 5 sondages avec UUID, dates ISO8601, etc.
```

### `/sondages/:id` ✅
```bash
curl "http://localhost:8000/sondages/b87f4500-9665-4ebd-85fb-623711881de9"
# Attendu: Détails du sondage avec tous les champs
```

### `/sondages/:id/adm3-candidates` ✅
```bash
curl "http://localhost:8000/sondages/b87f4500-9665-4ebd-85fb-623711881de9/adm3-candidates"
# Attendu: Liste de candidats ADM3 avec scores de similarité
```

### `/sondages?search=TCHAMDE` ⏳ À tester
```bash
curl "http://localhost:8000/sondages?search=TCHAMDE"
# Attendu: Sondages filtrés par recherche textuelle
```

### `PATCH /sondages/:id/geometry` ⏳ À tester
```bash
curl -X PATCH "http://localhost:8000/sondages/b87f4500-9665-4ebd-85fb-623711881de9/geometry" \
  -H "Content-Type: application/json" \
  -d '{"mode":"adm","adm3_id":328}'
# Attendu: Sondage mis à jour avec adm3_id=328
```

---

## 2. ⏳ Tests UI (Frontend)

### Page "Liste des Sondages"
- [ ] La liste des 230 sondages s'affiche
- [ ] Les colonnes sont correctes (Code, Localité, ADM3, Statut)
- [ ] La recherche fonctionne
- [ ] Les filtres "Missing Geom" / "Missing ADM3" fonctionnent
- [ ] La pagination fonctionne

### Page "Géocodage Amélioré"
- [ ] Les sondages non géocodés s'affichent
- [ ] Cliquer sur un sondage affiche le panneau de détails
- [ ] Le panneau affiche les suggestions ADM3
- [ ] Cliquer sur une suggestion met à jour le sondage
- [ ] Le statut passe à "géocodé" après mise à jour
- [ ] Les statistiques se mettent à jour

### Carte
- [ ] Les mailles s'affichent (29,407 mailles)
- [ ] Les sondages géocodés s'affichent sur la carte
- [ ] Cliquer sur une maille affiche les détails

---

## 3. ⏳ Tests de Bout en Bout

### Workflow complet de géocodage
1. [ ] Ouvrir "Géocodage Amélioré"
2. [ ] Sélectionner un sondage non géocodé (ex: BLEU-TCHAMDE)
3. [ ] Voir les suggestions ADM3 (ex: Tchamba, score 0.45)
4. [ ] Cliquer sur "Valider" pour une suggestion
5. [ ] Vérifier que le sondage est mis à jour
6. [ ] Vérifier que les stats globales sont mises à jour
7. [ ] Vérifier que le sondage apparaît sur la carte (si mode ADM)

---

## 4. ⚠️ Points d'Attention Identifiés

### ✅ Résolus
- ✅ Types de colonnes `sondages` (UUID, INTEGER, DATE, TIMESTAMPTZ)
- ✅ Schéma `atlas` et fonctions `norm()` / `norm_key()`
- ✅ Table `adm3` avec `gid` INTEGER
- ✅ Table `echantillons` avec types corrects
- ✅ Vue matérialisée `mv_mailles_geotech`

### ⏳ À surveiller
- ⚠️ Tables d'essais (`essais_*`, `granulo_points`) - types TEXT
  - **Impact**: Graphiques et détails des essais peuvent ne pas fonctionner
  - **Solution**: Migrer si nécessaire pour les pages de détails
  
- ⚠️ Table `mailles` - `id` et `updated_at` en TEXT
  - **Impact**: Possibles erreurs sur les statistiques de mailles
  - **Solution**: Migrer si erreurs constatées

### ❓ À tester
- Performance de la recherche textuelle avec `atlas.norm()`
- Performance des requêtes spatiales (ST_Contains)
- Gestion des erreurs dans l'UI (sondage introuvable, etc.)

---

## 5. 🚀 Commandes Utiles

### Redémarrer l'API
```bash
docker-compose restart api-geo
```

### Voir les logs de l'API
```bash
docker-compose logs -f api-geo
```

### Vérifier la base de données
```bash
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "\d sondages"
```

### Rafraîchir la vue matérialisée
```bash
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;"
```

---

## 6. 📊 Métriques de Succès

- ✅ **API fonctionnelle**: Tous les endpoints `/sondages/*` répondent sans erreur
- ⏳ **UI fonctionnelle**: Liste et géocodage affichent les données
- ⏳ **Workflow complet**: Géocodage d'un sondage fonctionne de bout en bout
- ⏳ **Performance**: Temps de réponse < 1s pour la liste des sondages
- ⏳ **Stabilité**: Pas d'erreurs dans les logs après 5 minutes d'utilisation

---

## 7. 🐛 Bugs Potentiels à Surveiller

1. **Erreurs de type dans l'UI**
   - Symptôme: "Cannot read property 'id' of undefined"
   - Cause: Champs manquants ou types incorrects dans la réponse API
   
2. **Suggestions ADM3 vides**
   - Symptôme: Aucune suggestion pour des localités valides
   - Cause: Fonction `atlas.norm()` ou extension `unaccent` non fonctionnelle
   
3. **Géocodage ne se sauvegarde pas**
   - Symptôme: Clic sur suggestion ne met pas à jour le sondage
   - Cause: PATCH `/sondages/:id/geometry` échoue (contraintes, types, etc.)

4. **Carte ne s'affiche pas**
   - Symptôme: Mailles ou sondages invisibles
   - Cause: Problème de SRID ou géométries invalides

---

## ✅ Prochaine Action

**Tester l'UI maintenant !**

1. Ouvrir http://localhost:5173 (ou le port de l'UI)
2. Naviguer vers "Liste des Sondages"
3. Naviguer vers "Géocodage Amélioré"
4. Tester le workflow complet
5. Reporter les erreurs éventuelles
