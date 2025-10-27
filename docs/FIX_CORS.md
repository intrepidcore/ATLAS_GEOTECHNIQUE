# 🔧 Fix CORS - Atlas API

## ✅ Correction Appliquée

La configuration CORS de l'API a été mise à jour pour autoriser explicitement :
- `http://localhost:8080`
- `http://127.0.0.1:8080`

### Changements

**Avant:**
```rust
let cors = CorsLayer::new()
    .allow_origin(Any)  // ❌ Trop permissif, problèmes avec credentials
    .allow_methods([...])
    .allow_headers(Any);
```

**Après:**
```rust
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE, ACCEPT};

let cors = CorsLayer::new()
    .allow_origin([
        "http://localhost:8080".parse::<axum::http::HeaderValue>().unwrap(),
        "http://127.0.0.1:8080".parse::<axum::http::HeaderValue>().unwrap(),
    ])
    .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::PATCH, Method::PUT, Method::OPTIONS])
    .allow_headers([AUTHORIZATION, CONTENT_TYPE, ACCEPT])  // ⚠️ Pas Any avec credentials
    .allow_credentials(true);  // ✅ Support des credentials/cookies
```

**Note importante:** On ne peut **pas** combiner `allow_credentials(true)` avec `allow_headers(Any)`. C'est une restriction de sécurité CORS.

---

## 🚀 Redémarrer l'API

### ⚠️ Prérequis: Exposer le Port

Le fichier `docker-compose.yml` doit exposer le port 8000:

```yaml
api-geo:
  # ...
  ports:
    - "8000:8000"  # ✅ Exposé pour accès direct depuis l'UI
```

### Option 1: Docker Compose (Recommandé)

```powershell
# Reconstruire et redémarrer l'API
cd atlas
docker compose up -d --build api-geo

# Vérifier les logs
docker compose logs -f api-geo
```

### Option 2: Cargo (Développement)

```powershell
cd atlas\services\api-geo
cargo run --release
```

---

## ✅ Tester la Configuration CORS

### Test Automatique (PowerShell)

```powershell
cd atlas\scripts
.\test-cors.ps1
```

**Résultat attendu:**
```
🔍 Test de la configuration CORS
API: http://127.0.0.1:8000
Origin: http://localhost:8080

📋 Test 1: Requête OPTIONS (pré-vol)
✅ Status: 200
   Access-Control-Allow-Origin : http://localhost:8080
   Access-Control-Allow-Methods : GET, POST, DELETE, PATCH, PUT, OPTIONS
   Access-Control-Allow-Headers : *
   Access-Control-Allow-Credentials : true

📋 Test 2: Requête GET avec Origin
✅ Status: 200
   Access-Control-Allow-Origin: http://localhost:8080
   Access-Control-Allow-Credentials: true

✅ Tests CORS terminés
```

### Test Manuel (curl)

```bash
# Test pré-vol (OPTIONS)
curl -i -X OPTIONS http://127.0.0.1:8000/coverage/mailles \
  -H "Origin: http://localhost:8080" \
  -H "Access-Control-Request-Method: GET"

# Doit retourner:
# HTTP/1.1 200 OK
# access-control-allow-origin: http://localhost:8080
# access-control-allow-methods: GET, POST, DELETE, PATCH, PUT, OPTIONS
# access-control-allow-credentials: true

# Test GET réel
curl -i http://127.0.0.1:8000/coverage/mailles \
  -H "Origin: http://localhost:8080"

# Doit retourner:
# HTTP/1.1 200 OK
# access-control-allow-origin: http://localhost:8080
# access-control-allow-credentials: true
```

### Test depuis le Navigateur

1. Ouvrir `http://localhost:8080` dans le navigateur
2. Ouvrir la Console Développeur (F12)
3. Exécuter:

```javascript
fetch('http://127.0.0.1:8000/coverage/mailles')
  .then(r => r.json())
  .then(data => console.log('✅ CORS OK:', data))
  .catch(err => console.error('❌ CORS Error:', err));
```

**Résultat attendu:** Pas d'erreur CORS, données affichées.

---

## 🔍 Vérifications

### 1. L'API est bien démarrée

```powershell
# Healthcheck
curl http://127.0.0.1:8000/healthz

# Doit retourner:
# {"status":"ok"}
```

### 2. Les headers CORS sont présents

```powershell
# Vérifier les headers de réponse
curl -I http://127.0.0.1:8000/coverage/mailles \
  -H "Origin: http://localhost:8080"

# Chercher:
# access-control-allow-origin: http://localhost:8080
```

### 3. L'UI peut accéder à l'API

Ouvrir `http://localhost:8080` et vérifier que :
- ✅ La carte s'affiche
- ✅ Les données sont chargées
- ✅ Pas d'erreur CORS dans la console

---

## 🐛 Dépannage

### Erreur: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Cause:** L'API n'est pas redémarrée avec la nouvelle configuration.

**Solution:**
```powershell
docker compose restart api-geo
# ou
docker compose up -d --build api-geo
```

### Erreur: "Origin not allowed"

**Cause:** Vous accédez à l'UI depuis une URL différente.

**Solution:** Vérifier l'URL dans le navigateur. Doit être exactement:
- `http://localhost:8080` OU
- `http://127.0.0.1:8080`

Pas `http://localhost:8080/` (avec slash final) ni autre port.

### Erreur: "Credentials mode 'include' but CORS header is '*'"

**Cause:** Configuration CORS incorrecte (ancien code avec `Any`).

**Solution:** La correction appliquée résout ce problème. Redémarrer l'API.

### L'API ne démarre pas

**Vérifier les logs:**
```powershell
docker compose logs api-geo
```

**Erreur de compilation possible:**
```
error: no method named `parse` found for `&str`
```

**Solution:** Le code corrigé utilise la bonne syntaxe. Vérifier que le fichier `main.rs` est bien sauvegardé.

---

## 📝 Configuration Avancée

### Ajouter d'autres origines

Modifier `services/api-geo/src/main.rs`:

```rust
let cors = CorsLayer::new()
    .allow_origin([
        "http://localhost:8080".parse::<axum::http::HeaderValue>().unwrap(),
        "http://127.0.0.1:8080".parse::<axum::http::HeaderValue>().unwrap(),
        "http://localhost:3000".parse::<axum::http::HeaderValue>().unwrap(),  // Ajouter ici
    ])
    .allow_methods([...])
    .allow_headers(Any)
    .allow_credentials(true);
```

### CORS en production

Pour la production, utiliser des variables d'environnement:

```rust
use std::env;

let allowed_origins: Vec<HeaderValue> = env::var("ALLOWED_ORIGINS")
    .unwrap_or_else(|_| "http://localhost:8080".to_string())
    .split(',')
    .filter_map(|s| s.parse().ok())
    .collect();

let cors = CorsLayer::new()
    .allow_origin(allowed_origins)
    .allow_methods([...])
    .allow_headers(Any)
    .allow_credentials(true);
```

Puis dans `.env`:
```bash
ALLOWED_ORIGINS=https://atlas.example.com,https://www.atlas.example.com
```

---

## 📚 Références

- [Axum CORS Documentation](https://docs.rs/tower-http/latest/tower_http/cors/index.html)
- [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [CORS Preflight](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)

---

## ✅ Checklist

- [x] Configuration CORS mise à jour dans `api-geo/src/main.rs`
- [ ] API redémarrée (`docker compose up -d --build api-geo`)
- [ ] Tests CORS passés (`.\scripts\test-cors.ps1`)
- [ ] UI accessible sans erreur CORS
- [ ] Données chargées correctement

---

**Dernière mise à jour:** 2024-10-24
