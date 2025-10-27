# ⚡ CORS Quick Fix - 3 Commandes

## 🎯 Problème

```
Access to fetch at 'http://127.0.0.1:8000/coverage/mailles' from origin 'http://localhost:8080' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

## ✅ Solution en 3 Étapes

### 1️⃣ Redémarrer l'API (avec rebuild)

```powershell
cd atlas\scripts
.\restart-api.ps1 -Build
```

**Résultat attendu:**
```
✅ API redémarrée avec succès
🔗 Endpoints:
   Health: http://127.0.0.1:8000/healthz
   Coverage: http://127.0.0.1:8000/coverage/mailles
```

---

### 2️⃣ Tester CORS

```powershell
.\test-cors.ps1
```

**Résultat attendu:**
```
✅ Status: 200
   Access-Control-Allow-Origin : http://localhost:8080
   Access-Control-Allow-Methods : GET, POST, DELETE, PATCH, PUT, OPTIONS
   Access-Control-Allow-Credentials : true
```

---

### 3️⃣ Vérifier l'UI

1. Ouvrir **http://localhost:8080** dans le navigateur
2. Ouvrir la Console (F12)
3. Vérifier qu'il n'y a **pas d'erreur CORS**
4. La carte doit s'afficher avec les données

---

## 🔧 Ce qui a été corrigé

**Fichier:** `services/api-geo/src/main.rs`

```rust
// ❌ AVANT (trop permissif)
let cors = CorsLayer::new()
    .allow_origin(Any)
    .allow_methods([...])
    .allow_headers(Any);

// ✅ APRÈS (origines explicites)
let cors = CorsLayer::new()
    .allow_origin([
        "http://localhost:8080".parse::<axum::http::HeaderValue>().unwrap(),
        "http://127.0.0.1:8080".parse::<axum::http::HeaderValue>().unwrap(),
    ])
    .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::PATCH, Method::PUT, Method::OPTIONS])
    .allow_headers(Any)
    .allow_credentials(true);  // ✅ Support credentials
```

---

## 🧪 Test Rapide (curl)

```bash
# Test pré-vol
curl -i -X OPTIONS http://127.0.0.1:8000/coverage/mailles \
  -H "Origin: http://localhost:8080" \
  -H "Access-Control-Request-Method: GET"

# Doit retourner: access-control-allow-origin: http://localhost:8080
```

---

## 🐛 Si ça ne marche toujours pas

### Vérifier que l'API est bien redémarrée

```powershell
docker compose ps
# api-geo doit être "Up"

docker compose logs api-geo --tail=20
# Chercher: "listening on 0.0.0.0:8000"
```

### Vider le cache du navigateur

1. **Chrome/Edge:** Ctrl+Shift+Delete → Cocher "Images et fichiers en cache" → Effacer
2. **Firefox:** Ctrl+Shift+Delete → Cocher "Cache" → Effacer
3. Recharger la page: **Ctrl+F5** (hard reload)

### Vérifier l'URL de l'UI

L'URL doit être **exactement**:
- ✅ `http://localhost:8080`
- ✅ `http://127.0.0.1:8080`

**Pas:**
- ❌ `http://localhost:8080/` (avec slash)
- ❌ `http://192.168.x.x:8080`
- ❌ Autre port

---

## 📚 Documentation Complète

Pour plus de détails: **`FIX_CORS.md`**

---

## ✅ Checklist

- [ ] API redémarrée: `.\restart-api.ps1 -Build`
- [ ] Tests CORS OK: `.\test-cors.ps1`
- [ ] UI accessible: `http://localhost:8080`
- [ ] Pas d'erreur CORS dans la console (F12)
- [ ] Données chargées sur la carte

---

**Temps total:** ~2 minutes
