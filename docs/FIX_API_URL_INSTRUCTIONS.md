# 🔧 Correctif "Failed to Fetch" - Instructions

## 🚨 Problème Identifié

L'application appelle la mauvaise URL pour l'API :
- **Configuré** : `http://127.0.0.1:8081`
- **Requêtes réelles** : `http://127.0.0.1:8080/coverage/mailles` (sans `/api`)
- **Résultat** : `ERR_CONNECTION_REFUSED`

## ✅ Solution Immédiate (2 minutes)

### Option 1 : Page de Correction Automatique

1. **Ouvrir** : http://localhost:8080/fix_api_url.html
2. **Cliquer** : "✅ Corriger l'API URL"
3. **Cliquer** : "🔄 Recharger Atlas"
4. **Vérifier** : Le "Failed to fetch" doit disparaître

### Option 2 : Console Navigateur

1. Ouvrir la console (F12)
2. Exécuter :
   ```javascript
   localStorage.setItem('API_GEO', '/api');
   location.reload();
   ```
3. Vérifier dans l'onglet Network que les requêtes partent vers `/api/...`

## 🛠️ Solution Permanente (Code)

Le module `ui/src/api.ts` a été créé pour centraliser toutes les requêtes API.

### Utilisation dans le Code

**Avant (problématique) :**
```typescript
// ❌ Ignore la configuration API_GEO
fetch(`${location.origin}/coverage/mailles`)
fetch('/coverage/mailles')
```

**Après (correct) :**
```typescript
import { apiGet, apiPost, apiUrl } from './api'

// ✅ Utilise automatiquement la bonne base URL
apiGet('/coverage/mailles')
apiPost('/surveys', { data })

// Ou pour construire une URL manuellement
const url = apiUrl('/coverage/mailles')
```

### Migration du Code Existant

Pour migrer le code existant, remplacez progressivement :

1. **Import du module** :
   ```typescript
   import { apiGet, apiPost, apiDelete, apiUrl } from './api'
   ```

2. **Remplacer les fetch directs** :
   ```typescript
   // Avant
   const res = await fetch(`${API_GEO}/coverage/mailles`)
   const data = await res.json()

   // Après
   const data = await apiGet('/coverage/mailles')
   ```

3. **Pour les POST** :
   ```typescript
   // Avant
   const res = await fetch(`${API_GEO}/surveys`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(payload)
   })

   // Après
   const data = await apiPost('/surveys', payload)
   ```

## 🧪 Vérifications

### 1. Vérifier la Configuration
```javascript
// Dans la console navigateur
console.log(localStorage.getItem('API_GEO'))
// Doit afficher: "/api"
```

### 2. Vérifier les Requêtes
Ouvrir l'onglet **Network** (F12) et observer :
- ✅ Les requêtes doivent partir vers `http://localhost:8080/api/...`
- ❌ Pas vers `http://localhost:8080/coverage/...` (sans `/api`)

### 3. Tester l'API Directement

**Via le proxy Nginx (recommandé) :**
```powershell
curl http://localhost:8080/api/coverage/mailles
```

**Directement sur l'API (debug) :**
```powershell
curl http://localhost:8080/api/coverage/mailles
```

Les deux doivent retourner du JSON.

## 📊 Architecture Correcte

```
Navigateur
    ↓
http://localhost:8080/api/coverage/mailles
    ↓
Nginx (conteneur UI, port 8080)
    ↓ proxy_pass /api → http://api-geo:8000
Backend API (conteneur api-geo, port interne 8000)
```

## 🔍 Diagnostics

### Problème : Toujours "Failed to fetch"

**Vérifier que les conteneurs sont démarrés :**
```powershell
docker compose ps
```

Tous doivent être "Up" et "healthy".

**Vérifier les logs :**
```powershell
# Backend
docker compose logs -f api-geo

# UI
docker compose logs -f ui
```

**Tester le proxy Nginx :**
```powershell
curl -v http://localhost:8080/api/coverage/mailles
```

Si erreur 502 Bad Gateway → le backend ne répond pas
Si erreur 404 → le proxy n'est pas configuré

### Problème : localStorage ne persiste pas

Vérifier que vous n'êtes pas en navigation privée.

### Problème : Les requêtes partent toujours vers le mauvais port

Le code utilise probablement des URL hardcodées. Cherchez :
```typescript
// Patterns à éviter
fetch('/coverage/...')
fetch(`${location.origin}/...`)
fetch('http://localhost:8081/...')
```

Remplacez par :
```typescript
import { apiGet } from './api'
apiGet('/coverage/...')
```

## 📝 Checklist Complète

- [ ] localStorage.API_GEO = '/api'
- [ ] Reload de la page
- [ ] Network montre GET /api/...
- [ ] Pas d'erreur "Failed to fetch"
- [ ] curl http://localhost:8080/api/coverage/mailles fonctionne
- [ ] docker compose ps montre tous les services "healthy"
- [ ] Console affiche `[API] Configuration: { effective: '/api' }`

## 🚀 Prochaines Étapes

1. **Immédiat** : Utiliser http://localhost:8080/fix_api_url.html
2. **Court terme** : Migrer le code vers `api.ts`
3. **Long terme** : Supprimer toutes les URL hardcodées

---

**Note** : Le module `api.ts` gère automatiquement :
- ✅ localStorage override
- ✅ Variables d'environnement
- ✅ Logs de debug
- ✅ Gestion d'erreurs
- ✅ Headers corrects
