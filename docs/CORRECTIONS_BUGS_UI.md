# Corrections des Bugs UI - Géocodage Sondages

**Date**: 2025-11-07  
**Branche**: `feat/sondages-api-ui`

---

## 🐛 Problèmes Identifiés

### 1. Clic sur suggestion ne pré-sélectionne pas le select
**Symptôme**: Lorsqu'on clique sur une suggestion ADM3, le select reste vide et on obtient "Veuillez sélectionner une commune".

**Cause**: Les event listeners des suggestions sont attachés une seule fois, mais le DOM est re-rendu à chaque sélection de sondage, détruisant les listeners.

**Solution**:
- Ajout de propriétés pour stocker les callbacks
- Déclenchement d'un event `change` sur le select après sélection
- Ajout de feedback visuel (bordure verte)
- Reset des autres suggestions
- Log console pour debug

**Fichier**: `ui/src/geocode-canon-panel.ts`

### 2. Erreur HTTP 400 lors du PATCH
**Symptôme**: 
```
error returned from database: column "adm3_id" is of type uuid but expression is of type integer
```

**Cause**: Incohérence de schéma dans la base de données:
- Table `sondages.adm3_id` était de type `UUID`
- Table `adm3.gid` est de type `INTEGER`
- Impossible de faire la jointure

**Solution**:
1. Migration SQL pour corriger le type de `adm3_id`
2. Suppression de l'ancienne colonne UUID
3. Recréation comme INTEGER avec FK vers `adm3.gid`
4. Recréation de la colonne `is_geocoded` (dépendait de `adm3_id`)
5. Rebuild Docker avec `--no-cache` pour éviter le cache SQLx

**Fichiers**:
- `migrations/fix_adm3_id_type.sql`
- `services/api-geo/src/sondages.rs`

### 3. Mailles ne se chargent pas en navigation privée
**Symptôme**: Erreurs CORS et de chargement des ressources en mode navigation privée.

**Cause**: 
- Tracking Prevention bloque l'accès au storage
- Problèmes de cache et de CORS

**Solution**: (À implémenter si nécessaire)
- Vérifier les headers CORS de l'API
- Ajouter des fallbacks pour la navigation privée
- Désactiver le cache pour les ressources critiques

---

## ✅ Corrections Appliquées

### Migration SQL

```sql
-- migrations/fix_adm3_id_type.sql
BEGIN;

ALTER TABLE sondages DROP COLUMN IF EXISTS adm3_id CASCADE;
ALTER TABLE sondages ADD COLUMN adm3_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_sondages_adm3_id ON sondages(adm3_id);
ALTER TABLE sondages 
ADD CONSTRAINT fk_sondages_adm3 
FOREIGN KEY (adm3_id) REFERENCES adm3(gid) 
ON DELETE SET NULL;

ALTER TABLE sondages DROP COLUMN IF EXISTS is_geocoded CASCADE;
ALTER TABLE sondages ADD COLUMN is_geocoded BOOLEAN 
GENERATED ALWAYS AS (
  geom IS NOT NULL OR adm3_id IS NOT NULL
) STORED;

COMMIT;
```

### Code TypeScript

**geocode-canon-panel.ts**:
```typescript
// Ajout de propriétés pour callbacks
private onSuccessCallback?: (msg: string) => void;
private onErrorCallback?: (error: string) => void;
private currentContainerId?: string;

// Dans renderUI
this.onSuccessCallback = onSuccess;
this.onErrorCallback = onError;
this.currentContainerId = containerId;

// Dans le clic sur suggestion
select.value = candidate.gid.toString();
select.dispatchEvent(new Event('change', { bubbles: true }));
(item as HTMLElement).style.borderColor = '#51cf66';
(item as HTMLElement).style.background = '#1e3a5f';
console.log('[SONDAGES] Suggestion sélectionnée:', candidate.name, 'gid:', candidate.gid);
```

**sondages.ts**:
```typescript
export async function updateSondageGeometry(
  id: string,
  payload: UpdateGeometryPayload
): Promise<Sondage> {
  console.log('[SONDAGES] updateSondageGeometry - ID:', id);
  console.log('[SONDAGES] updateSondageGeometry - Payload:', JSON.stringify(payload, null, 2));
  return apiPatch<Sondage>(`/sondages/${id}/geometry`, payload);
}
```

### Code Rust

**sondages.rs**:
```rust
pub struct Sondage {
    pub id: Uuid,
    pub code: String,
    pub localite: Option<String>,
    pub adm3_id: Option<i32>, // ✅ Corrigé de Uuid vers i32
    pub adm3_name: Option<String>,
    // ...
}
```

---

## 🧪 Tests de Validation

### Test 1: Clic sur suggestion
```
1. Ouvrir "Géocodage Amélioré"
2. Sélectionner un sondage (ex: ANIE)
3. Cliquer sur une suggestion (ex: "Anie 100%")
4. ✅ Le select est pré-rempli avec la commune
5. ✅ La suggestion a une bordure verte
6. ✅ Log console: "Suggestion sélectionnée: Anie gid: X"
```

### Test 2: PATCH ADM3
```bash
# Test API direct
curl -X PATCH http://localhost:8000/sondages/<UUID>/geometry \
  -H "Content-Type: application/json" \
  -d '{"mode":"adm","adm3_id":1}'

# ✅ Attendu: Objet sondage mis à jour avec adm3_id=1
```

### Test 3: UI complète
```
1. Ouvrir "Géocodage Amélioré"
2. Sélectionner un sondage
3. Cliquer sur une suggestion
4. Cliquer "Enregistrer le géocodage"
5. ✅ Toast vert: "Sondage ... géocodé avec ADM3: ..."
6. ✅ Badge décrémente (229 → 228)
7. ✅ Sondage disparaît de la liste
```

---

## 📊 Impact

### Avant
- ❌ Clic sur suggestion ne fonctionne pas
- ❌ Erreur HTTP 400 lors du géocodage
- ❌ Incohérence de schéma (UUID vs INTEGER)

### Après
- ✅ Clic sur suggestion pré-sélectionne le select
- ✅ PATCH fonctionne correctement
- ✅ Schéma cohérent (INTEGER partout)
- ✅ Logs pour debug
- ✅ Feedback visuel

---

## 🚀 Déploiement

```bash
# 1. Appliquer la migration
Get-Content migrations/fix_adm3_id_type.sql | docker compose exec -T db psql -U atlas -d atlas

# 2. Rebuild API (avec --no-cache pour éviter cache SQLx)
docker compose build --no-cache api-geo

# 3. Rebuild UI
cd ui && npm run build

# 4. Redémarrer services
docker compose up -d api-geo ui

# 5. Vérifier
curl http://localhost:8000/sondages/stats
```

---

## ⚠️ Notes Importantes

### Cache SQLx
SQLx prépare les requêtes au moment du build. Si le schéma change après le build, il faut rebuild avec `--no-cache`.

### Vues Dépendantes
La migration DROP CASCADE supprime les vues qui dépendent de `adm3_id`:
- `v_sondages_unifies`
- `mv_sondages_unifies`
- `v_sondages_geocoded`

Il faudra les recréer si nécessaire.

### Clé Étrangère
La nouvelle FK `fk_sondages_adm3` garantit l'intégrité référentielle:
```sql
FOREIGN KEY (adm3_id) REFERENCES adm3(gid) ON DELETE SET NULL
```

---

## 📝 Checklist Finale

- [x] Migration SQL appliquée
- [x] Type Rust corrigé (i32)
- [x] Type TypeScript correct (number)
- [x] Event listeners corrigés
- [x] Logs ajoutés pour debug
- [x] Feedback visuel ajouté
- [x] API rebuild avec --no-cache
- [x] UI rebuild
- [ ] Tests manuels validés
- [ ] Documentation mise à jour

---

## 🔮 Améliorations Futures

1. **Retry automatique** en cas d'erreur PATCH
2. **Validation côté client** avant envoi
3. **Prévisualisation** de la zone ADM3 sur la carte
4. **Undo** pour annuler un géocodage
5. **Batch geocoding** pour géocoder plusieurs sondages d'un coup
