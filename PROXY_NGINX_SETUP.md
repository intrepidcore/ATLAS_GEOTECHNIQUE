# 🔒 Setup Proxy Nginx - Atlas v1.5.0.2

**Objectif** : Architecture robuste pour le déploiement LAN  
**Avantages** : Plus de problème localhost, pas de CORS, pas de rebuild quand l'IP change

---

## 🎯 Architecture

```
Testeur (navigateur)
    ↓
http://192.168.1.100:8080
    ↓
Nginx (conteneur UI)
    ├─ / → UI statique
    └─ /api/ → Proxy vers api-geo:8000 (réseau Docker interne)
```

**Avantages** :
- ✅ Pas d'IP codée en dur dans le JS
- ✅ Pas de problème CORS
- ✅ Pas de problème localhost/127.0.0.1
- ✅ API non exposée directement (sécurité)
- ✅ Changement d'IP sans rebuild

---

## 📝 Modifications Appliquées

### 1. `ui/nginx.conf` - Ajout du proxy

```nginx
location /api/ {
  proxy_pass http://api-geo:8000/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  
  # Timeouts
  proxy_connect_timeout 60s;
  proxy_send_timeout 60s;
  proxy_read_timeout 60s;
  
  # Pas de cache pour l'API
  add_header Cache-Control "no-store, no-cache, must-revalidate";
}
```

### 2. `.env` - Chemins relatifs

```bash
# Avant
VITE_API_GEO=http://127.0.0.1:8001

# Après
VITE_API_GEO=/api
```

### 3. `docker-compose.yml` - API non exposée

```yaml
api-geo:
  # Pas de ports exposés - accès uniquement via proxy
  # ports:
  #   - "8001:8000"  # Commenté
```

---

## 🚀 Déploiement

### Étape 1 : Rebuild avec la nouvelle config

```powershell
cd c:\PROJET_ATLAS_MASTER\atlas

# Arrêter les services
docker compose down

# Rebuild UI (avec nouveau nginx.conf et .env)
docker compose build ui

# Redémarrer tout
docker compose up -d

# Attendre que tout soit healthy
docker compose ps
```

### Étape 2 : Tester en local

```powershell
# Test UI
Invoke-RestMethod -Uri "http://127.0.0.1:8080"

# Test API via proxy
Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/healthz"
# Attendu: {"status":"ok"}

# Test endpoint thématique
$url = "http://127.0.0.1:8080/api/thematic/data?parameter=ip_avg&min_sondages=3"
$response = Invoke-RestMethod -Uri $url
Write-Host "Features: $($response.features.Count)"
```

### Étape 3 : Ouvrir le navigateur

```
http://127.0.0.1:8080
```

**Vider le cache** : **Ctrl + Shift + R**

**Tester la carte thématique** : IP moyen → Appliquer

---

## 🌐 Déploiement LAN

### Configuration Firewall

```powershell
# PowerShell en mode Administrateur
New-NetFirewallRule -DisplayName "Atlas UI" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow

# Plus besoin de règle pour 8001 car l'API n'est plus exposée
```

### Obtenir l'IP du serveur

```powershell
ipconfig
# Noter l'IPv4 (ex: 192.168.1.100)
```

### URL pour les testeurs

```
http://192.168.1.100:8080
```

**Aucun rebuild nécessaire !** L'UI utilise des chemins relatifs.

---

## 🧪 Tests de Validation

### Test 1 : Proxy fonctionne

```powershell
# Depuis le serveur
Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/healthz"
```

**Attendu** : `{"status":"ok"}`

### Test 2 : UI charge

```powershell
$ui = Invoke-WebRequest -Uri "http://127.0.0.1:8080" -UseBasicParsing
Write-Host "Status: $($ui.StatusCode)"
```

**Attendu** : `Status: 200`

### Test 3 : Depuis un autre PC (LAN)

```bash
# Depuis un PC testeur
curl -sS "http://192.168.1.100:8080/api/healthz"
```

**Attendu** : `{"status":"ok"}`

### Test 4 : Carte thématique

1. Ouvrir http://192.168.1.100:8080
2. **F12** → Network
3. Tester carte thématique
4. Vérifier les requêtes :
   - Request URL : `http://192.168.1.100:8080/api/thematic/data?...`
   - Status : 200

---

## 🔍 Vérification DevTools

### Ouvrir DevTools (F12)

1. Aller dans **Network**
2. Rafraîchir la page
3. Chercher une requête vers `/api/`
4. Cliquer dessus
5. Vérifier :
   - **Request URL** : `http://[IP]:8080/api/...`
   - **Status** : 200
   - **Response** : Données JSON

**Plus de problème localhost/127.0.0.1 !**

---

## 📊 Comparaison Avant/Après

| Aspect | Avant (v1.5.0.1) | Après (v1.5.0.2) |
|--------|------------------|------------------|
| **URL API** | `http://127.0.0.1:8001` | `/api` (relatif) |
| **Problème localhost** | ❌ Oui | ✅ Non |
| **CORS** | ⚠️ Nécessaire | ✅ Pas besoin |
| **Rebuild si IP change** | ❌ Oui | ✅ Non |
| **API exposée** | ⚠️ Port 8001 ouvert | ✅ Non (proxy seulement) |
| **Sécurité** | ⚠️ Moyenne | ✅ Meilleure |

---

## 🔧 Debug

### Logs Nginx

```powershell
docker compose logs ui --tail=50
```

### Logs API

```powershell
docker compose logs api-geo --tail=50
```

### Tester le proxy directement

```powershell
# Depuis le conteneur UI
docker compose exec ui curl -sS http://api-geo:8000/healthz
```

**Attendu** : `{"status":"ok"}`

---

## 🎁 Bonus : Nom de domaine local

### Option 1 : Fichier hosts (chaque PC)

**Sur chaque PC testeur**, éditer `C:\Windows\System32\drivers\etc\hosts` :

```
192.168.1.100  atlas.local
```

**URL** : http://atlas.local:8080

### Option 2 : DNS local (routeur/box)

Configurer dans votre routeur :
- Nom : `atlas.local`
- IP : `192.168.1.100`

**Avantage** : Un seul changement pour tous les testeurs

---

## 🔄 Rollback (si problème)

### Revenir à l'ancienne config

```powershell
# 1. Restaurer .env
# VITE_API_GEO=http://127.0.0.1:8001

# 2. Décommenter ports dans docker-compose.yml
# ports:
#   - "8001:8000"

# 3. Rebuild
docker compose build ui
docker compose up -d
```

---

## ✅ Checklist de Déploiement

### Configuration
- [x] `ui/nginx.conf` modifié (proxy /api/)
- [x] `.env` modifié (VITE_API_GEO=/api)
- [x] `docker-compose.yml` modifié (ports API commentés)

### Build & Deploy
- [ ] `docker compose down`
- [ ] `docker compose build ui`
- [ ] `docker compose up -d`
- [ ] Vérifier : `docker compose ps` (tous healthy)

### Tests Local
- [ ] `http://127.0.0.1:8080` accessible
- [ ] `http://127.0.0.1:8080/api/healthz` répond
- [ ] Carte thématique fonctionne
- [ ] Cache navigateur vidé (Ctrl+Shift+R)

### Tests LAN
- [ ] Firewall configuré (port 8080)
- [ ] IP serveur notée
- [ ] Test depuis autre PC : `http://[IP]:8080`
- [ ] Carte thématique fonctionne depuis LAN

### Documentation
- [ ] URL communiquée aux testeurs
- [ ] Guide utilisateur partagé
- [ ] Support disponible

---

## 📞 Support

### Si "Failed to fetch" persiste

1. **Vérifier le proxy** :
```powershell
docker compose exec ui curl -sS http://api-geo:8000/healthz
```

2. **Vérifier les logs Nginx** :
```powershell
docker compose logs ui --tail=50 | Select-String "api"
```

3. **Vérifier DevTools** :
   - F12 → Network
   - Request URL doit être `/api/...`
   - Status doit être 200

4. **Vider le cache** :
   - Ctrl + Shift + R
   - Ou mode privé

---

## 🎉 Avantages de cette Architecture

1. **Robustesse** : Plus de problème localhost/127.0.0.1
2. **Sécurité** : API non exposée directement
3. **Flexibilité** : Changement d'IP sans rebuild
4. **Simplicité** : Une seule URL pour tout (UI + API)
5. **Performance** : Pas de CORS preflight
6. **Maintenance** : Logs centralisés dans Nginx

---

**Version** : 1.5.0.2  
**Date** : 2025-10-20  
**Auteur** : Atlas Team

🚀 **Architecture production-ready pour le LAN !**
