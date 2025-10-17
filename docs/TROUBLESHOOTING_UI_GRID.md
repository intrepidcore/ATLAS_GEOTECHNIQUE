# Dépannage affichage grille UI

## ❌ Problème : La grille ne s'affiche pas

### Symptômes
- La carte Leaflet s'affiche correctement
- Aucune maille visible (ni grise ni rouge)
- Le statut indique "Chargement des mailles…" ou rien

---

## ✅ Solutions par ordre de priorité

### 1. Vérifier que l'API répond

```powershell
# Test rapide
(Invoke-RestMethod http://127.0.0.1:8001/coverage/mailles).features.Count

# Doit afficher: 35499 (ou le nombre de mailles dans votre base)
```

**Si erreur** :
```powershell
# Redémarrer l'API
docker compose restart api-geo

# Vérifier les logs
docker compose logs api-geo --tail 50
```

---

### 2. Vérifier la configuration des URLs dans l'UI

**Ouvrir la console du navigateur** (F12 → onglet Console)

Chercher :
- ✅ `Grille chargée: 35499 mailles (12 avec données)` → **OK**
- ❌ `Erreur couverture: Failed to fetch` → **Problème de CORS ou URL**
- ❌ `Erreur couverture: HTTP 404` → **API non accessible**

**Si problème d'URL** :

Vérifier que `ui/index.html` contient :
```html
<script>
  // Runtime overrides for API base URLs
  window.__API_GEO__ = "http://127.0.0.1:8001";
  window.__API_INFER__ = "http://127.0.0.1:8002";
  window.__API_OPTI__ = "http://127.0.0.1:8003";
</script>
```

**Si les lignes sont commentées** :
```powershell
# Décommenter et rebuild
docker compose build ui
docker compose up -d ui
```

---

### 3. Vérifier que le code TypeScript charge bien la grille

**Dans la console du navigateur**, taper :
```javascript
// Vérifier que la fonction existe
typeof loadCoverageOnce
// Doit afficher: "function"

// Forcer le rechargement
loadCoverageOnce()
```

**Si `undefined`** :
- Le build TypeScript a échoué
- Rebuild avec :
```powershell
docker compose build ui --no-cache
docker compose up -d ui
```

---

### 4. Vérifier les CORS

**Dans la console du navigateur**, chercher :
```
Access to fetch at 'http://127.0.0.1:8001/coverage/mailles' from origin 'http://127.0.0.1:8080' has been blocked by CORS policy
```

**Si erreur CORS** :

Vérifier que `api-geo` a bien les headers CORS :
```powershell
# Test manuel
curl -v http://127.0.0.1:8001/coverage/mailles -H "Origin: http://127.0.0.1:8080"

# Doit contenir dans la réponse:
# Access-Control-Allow-Origin: *
```

**Si manquant**, vérifier `services/api-geo/src/main.rs` :
```rust
use tower_http::cors::CorsLayer;

let app = Router::new()
    // ...
    .layer(CorsLayer::permissive());
```

---

### 5. Vérifier que Leaflet est chargé

**Dans la console du navigateur**, taper :
```javascript
typeof L
// Doit afficher: "object"

L.version
// Doit afficher: "1.9.4" (ou version similaire)
```

**Si `undefined`** :
- CDN Leaflet non accessible
- Vérifier `ui/index.html` :
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

---

### 6. Forcer un refresh complet

```powershell
# 1. Rebuild UI sans cache
docker compose build ui --no-cache

# 2. Redémarrer tous les services
docker compose down
docker compose up -d

# 3. Attendre que tout soit prêt
Start-Sleep -Seconds 10

# 4. Ouvrir l'UI
Start-Process "http://127.0.0.1:8080"

# 5. Dans le navigateur: Ctrl+Shift+R (hard refresh)
```

---

## 🔍 Checklist de vérification

### Services
- [ ] `docker compose ps` → tous les services `running`
- [ ] `docker compose logs api-geo --tail 20` → pas d'erreur
- [ ] `docker compose logs ui --tail 20` → pas d'erreur

### API
- [ ] `curl http://127.0.0.1:8001/healthz` → `{"status":"ok"}`
- [ ] `curl http://127.0.0.1:8001/coverage/mailles | jq '.features | length'` → `35499`

### UI
- [ ] `http://127.0.0.1:8080` → page s'affiche
- [ ] Console (F12) → pas d'erreur rouge
- [ ] Console → message `Grille chargée: X mailles (Y avec données)`
- [ ] Carte → mailles visibles (grises + rouges)

### Interaction
- [ ] Clic sur une maille → code rempli dans l'input
- [ ] Survol d'une maille → tooltip avec le code
- [ ] Survol d'une maille → contour devient épais
- [ ] Bouton "GET /grid/{code}" → affiche les données dans le panneau

---

## 🐛 Problèmes courants

### "Grille chargée" mais rien ne s'affiche

**Cause** : Les mailles sont chargées mais hors de la vue initiale.

**Solution** :
```javascript
// Dans la console du navigateur
if (gridLayer) {
  const bounds = gridLayer.getBounds()
  map.fitBounds(bounds, { padding: [12, 12] })
}
```

Ou cliquer sur le bouton **"Zoom Togo"** dans l'UI.

---

### Mailles visibles mais toutes grises

**Cause** : Aucune maille n'a `has_data: true`.

**Solution** :
```powershell
# Vérifier les données
docker compose exec db psql -U atlas -d atlas -c "SELECT COUNT(*) FROM sondages;"

# Si 0, recharger le seed
docker compose run --rm etl etl load-sample-extended --truncate

# Rafraîchir l'UI (F5)
```

---

### Performance : L'UI rame avec 35k mailles

**Cause** : Trop de polygones affichés d'un coup.

**Solutions** :

1. **Vérifier `preferCanvas: true`** dans `ui/src/main.ts` :
```typescript
const map = L.map('map', { preferCanvas: true }).setView([8.6195, 0.8248], 7)
```

2. **Réduire le nombre de mailles** (temporaire pour test) :
```typescript
// Dans loadCoverageOnce(), après fetch
const gj = await res.json()
gj.features = gj.features.slice(0, 1000) // Limiter à 1000 mailles
```

3. **Implémenter le filtrage par viewport** (voir `docs/UI_GRID_DISPLAY_v0.7.0.md`)

---

## 📞 Support

Si le problème persiste :

1. **Capturer les logs** :
```powershell
docker compose logs api-geo > api-geo.log
docker compose logs ui > ui.log
```

2. **Capturer la console du navigateur** :
- F12 → onglet Console
- Clic droit → "Save as..."

3. **Vérifier la version** :
```powershell
git log --oneline -5
# Doit contenir: "fix(ui): activer les URLs runtime pour API"
```

---

## ✅ Test de validation

Script complet pour valider que tout fonctionne :

```powershell
# 1. Services
Write-Host "=== Services ===" -ForegroundColor Cyan
docker compose ps

# 2. API
Write-Host "`n=== API ===" -ForegroundColor Cyan
$health = Invoke-RestMethod http://127.0.0.1:8001/healthz
Write-Host "Health: $($health.status)" -ForegroundColor Green

$fc = Invoke-RestMethod http://127.0.0.1:8001/coverage/mailles
Write-Host "Mailles: $($fc.features.Count)" -ForegroundColor Green

# 3. UI
Write-Host "`n=== UI ===" -ForegroundColor Cyan
$ui = Invoke-WebRequest http://127.0.0.1:8080
Write-Host "Status: $($ui.StatusCode)" -ForegroundColor Green

# 4. Ouvrir
Start-Process "http://127.0.0.1:8080"
Write-Host "`n✓ Ouvrez la console (F12) et vérifiez le message 'Grille chargée'" -ForegroundColor Yellow
```

---

**Version** : 0.7.0  
**Date** : 2025-10-17
