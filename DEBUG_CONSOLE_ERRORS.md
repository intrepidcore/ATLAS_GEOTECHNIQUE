# 🔍 Debug Erreurs Console

**Problème** : Erreurs dans la console DevTools  
**Symptômes** : Requêtes vers `/api/...` qui échouent

---

## 🎯 Actions Immédiates

### 1. Vider le Cache Navigateur (OBLIGATOIRE)

**L'UI a été rebuild avec `/api` mais le navigateur utilise encore l'ancien code avec `http://127.0.0.1:8001`**

**Solution** :
```
Ctrl + Shift + R
```

Ou fermer complètement le navigateur et rouvrir.

### 2. Vérifier les Request URL dans DevTools

**F12** → **Network** → Cliquer sur une requête qui échoue

**Vérifier** :
- **Request URL** doit commencer par `/api/` ou `http://127.0.0.1:8080/api/`
- **Si vous voyez** `http://127.0.0.1:8001/` → Cache pas vidé

---

## 🔧 Solution Complète

### Étape 1 : Fermer TOUS les onglets Atlas

Fermer complètement le navigateur.

### Étape 2 : Rouvrir en mode privé

**Edge** :
```powershell
Start-Process msedge -ArgumentList "-inprivate http://127.0.0.1:8080"
```

**Chrome** :
```powershell
Start-Process chrome -ArgumentList "--incognito http://127.0.0.1:8080"
```

### Étape 3 : Tester

1. Ouvrir **F12** → **Network**
2. Rafraîchir la page
3. Chercher une requête vers l'API
4. Vérifier que l'URL commence par `/api/`

---

## 📊 Diagnostic des Erreurs

### Erreur Type 1 : "Failed to fetch"

**Cause** : Cache navigateur utilise l'ancienne URL

**Solution** : Ctrl + Shift + R ou mode privé

### Erreur Type 2 : 404 Not Found sur `/api/...`

**Cause** : Le proxy Nginx ne fonctionne pas

**Vérification** :
```powershell
# Test direct du proxy
Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/healthz"
```

**Si ça échoue** :
```powershell
# Vérifier la config Nginx
docker compose exec ui cat /etc/nginx/conf.d/default.conf | Select-String "location /api"

# Vérifier les logs
docker compose logs ui --tail=50
```

### Erreur Type 3 : CORS Error

**Cause** : Requête vers une URL externe (pas via proxy)

**Solution** : Vider le cache (l'UI doit utiliser `/api` et non une URL absolue)

---

## 🧪 Tests de Validation

### Test 1 : Proxy fonctionne

```powershell
powershell -ExecutionPolicy Bypass -File test_proxy.ps1
```

**Tous les tests doivent passer.**

### Test 2 : Cache vidé

1. Ouvrir http://127.0.0.1:8080
2. **F12** → **Console**
3. Taper :
```javascript
console.log(window.location.origin)
```

**Attendu** : `http://127.0.0.1:8080`

4. Chercher une requête API dans Network
5. **Request URL** doit être : `http://127.0.0.1:8080/api/...`

---

## 🔄 Procédure de Reset Complète

Si rien ne fonctionne :

```powershell
# 1. Arrêter tout
docker compose down

# 2. Rebuild UI (force clean)
docker compose build --no-cache ui

# 3. Redémarrer
docker compose up -d

# 4. Attendre 15 secondes
Start-Sleep -Seconds 15

# 5. Tester le proxy
Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/healthz"

# 6. Ouvrir en mode privé
Start-Process msedge -ArgumentList "-inprivate http://127.0.0.1:8080"
```

---

## 📝 Checklist de Vérification

- [ ] Services démarrés : `docker compose ps`
- [ ] Proxy fonctionne : `test_proxy.ps1` passe
- [ ] Cache vidé : Ctrl + Shift + R
- [ ] Mode privé testé
- [ ] DevTools Network : Request URL = `/api/...`
- [ ] Pas d'erreur rouge dans Console

---

## 🎯 Solution Rapide

**Si vous voyez des erreurs dans la console** :

1. **Ctrl + Shift + Delete**
2. Cocher "Cached images and files"
3. Cliquer "Clear data"
4. Fermer le navigateur
5. Rouvrir : http://127.0.0.1:8080

**Ou simplement** :

```powershell
Start-Process msedge -ArgumentList "-inprivate http://127.0.0.1:8080"
```

---

**Version** : 1.5.0.2  
**Date** : 2025-10-20

🎉 **Le mode privé garantit de voir la nouvelle version sans cache !**
