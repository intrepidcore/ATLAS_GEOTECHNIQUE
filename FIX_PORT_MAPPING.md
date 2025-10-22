# 🔧 Fix Port Mapping Docker → Windows

**Problème** : API répond dans le conteneur mais pas depuis Windows  
**Symptôme** : `Test-NetConnection` OK mais `Invoke-RestMethod` timeout

---

## 🔍 Diagnostic

✅ **Ce qui fonctionne** :
- API répond dans le conteneur : `docker compose exec api-geo curl http://localhost:8000/healthz`
- Port 8001 ouvert : `Test-NetConnection -Port 8001`

❌ **Ce qui ne fonctionne pas** :
- Requêtes HTTP depuis Windows : `Invoke-RestMethod http://localhost:8001/healthz`

**Cause** : Problème de port mapping Docker Desktop / WSL2

---

## 🔧 Solutions (par ordre de priorité)

### Solution 1 : Redémarrer Docker Desktop (le plus rapide)

```powershell
# 1. Arrêter les conteneurs
docker compose down

# 2. Redémarrer Docker Desktop
# Clic droit sur l'icône Docker → Restart

# 3. Attendre que Docker soit prêt (30-60 secondes)

# 4. Redémarrer les services
docker compose up -d

# 5. Tester
Start-Sleep -Seconds 10
Invoke-RestMethod -Uri "http://localhost:8001/healthz"
```

---

### Solution 2 : Utiliser 127.0.0.1 au lieu de localhost

Parfois Windows/Docker a des problèmes avec la résolution `localhost`.

**Test** :
```powershell
# Tester avec 127.0.0.1
Invoke-RestMethod -Uri "http://127.0.0.1:8001/healthz"
```

**Si ça marche** :
```bash
# Modifier .env
VITE_API_GEO=http://127.0.0.1:8001

# Rebuild UI
docker compose build ui
docker compose up -d ui
```

---

### Solution 3 : Changer le port externe

Parfois le port 8001 est en conflit.

```yaml
# docker-compose.yml
api-geo:
  ports:
    - "8888:8000"  # ← Utiliser 8888 au lieu de 8001
```

```bash
# .env
VITE_API_GEO=http://localhost:8888
```

```powershell
docker compose down
docker compose up -d
docker compose build ui
docker compose up -d ui

# Tester
Invoke-RestMethod -Uri "http://localhost:8888/healthz"
```

---

### Solution 4 : Vérifier les paramètres Docker Desktop

**Ouvrir Docker Desktop** → **Settings** → **Resources** → **Network**

Vérifier :
- ✅ **Enable host networking** (si disponible)
- ✅ **Use kernel networking for UDP** (décoché)

**Appliquer** et redémarrer Docker Desktop.

---

### Solution 5 : Réinitialiser le réseau Docker

```powershell
# 1. Arrêter tout
docker compose down

# 2. Supprimer le réseau
docker network rm atlas_atlas-net

# 3. Redémarrer
docker compose up -d

# 4. Tester
Invoke-RestMethod -Uri "http://localhost:8001/healthz"
```

---

### Solution 6 : Utiliser l'IP du conteneur directement

**Trouver l'IP du conteneur** :
```powershell
docker inspect atlas-api-geo --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
# Ex: 172.18.0.3
```

**Tester** :
```powershell
Invoke-RestMethod -Uri "http://172.18.0.3:8000/healthz"
```

**Si ça marche**, c'est un problème de port forwarding Docker Desktop.

---

### Solution 7 : Vérifier WSL2 (si Docker utilise WSL2)

```powershell
# Vérifier si Docker utilise WSL2
wsl --list --verbose

# Si oui, redémarrer WSL2
wsl --shutdown

# Attendre 10 secondes puis redémarrer Docker Desktop
```

---

### Solution 8 : Bind explicite sur 0.0.0.0

Modifier `docker-compose.yml` :

```yaml
api-geo:
  ports:
    - "0.0.0.0:8001:8000"  # ← Bind explicite sur toutes interfaces
```

```powershell
docker compose down
docker compose up -d
```

---

### Solution 9 : Désactiver temporairement le pare-feu

**Test rapide** :
```powershell
# Désactiver temporairement (mode Administrateur)
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False

# Tester
Invoke-RestMethod -Uri "http://localhost:8001/healthz"

# Réactiver
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

**Si ça marche**, créer une règle spécifique :
```powershell
New-NetFirewallRule -DisplayName "Docker API 8001" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow -Profile Any
```

---

### Solution 10 : Utiliser host network mode (Linux seulement)

⚠️ **Ne fonctionne pas sur Windows/Mac**, mais pour référence :

```yaml
api-geo:
  network_mode: "host"
```

---

## 🎯 Procédure Recommandée

**Essayer dans cet ordre** :

1. **Redémarrer Docker Desktop** (Solution 1) - 2 min
2. **Tester avec 127.0.0.1** (Solution 2) - 1 min
3. **Réinitialiser réseau Docker** (Solution 5) - 2 min
4. **Changer de port** (Solution 3) - 3 min
5. **Vérifier paramètres Docker** (Solution 4) - 5 min

---

## 📊 Script de Test Complet

```powershell
# test_port_mapping.ps1

Write-Host "=== Test Port Mapping Docker ===" -ForegroundColor Cyan

# Test 1: Depuis le conteneur
Write-Host "`n1. Test depuis le conteneur:" -ForegroundColor Yellow
docker compose exec api-geo curl -sS http://localhost:8000/healthz

# Test 2: Port ouvert
Write-Host "`n2. Test port 8001 ouvert:" -ForegroundColor Yellow
$port = Test-NetConnection -ComputerName localhost -Port 8001 -WarningAction SilentlyContinue
Write-Host "Port 8001: $($port.TcpTestSucceeded)"

# Test 3: HTTP depuis Windows (localhost)
Write-Host "`n3. Test HTTP localhost:8001:" -ForegroundColor Yellow
try {
    $r1 = Invoke-RestMethod -Uri "http://localhost:8001/healthz" -TimeoutSec 5
    Write-Host "OK: $($r1.status)" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: HTTP depuis Windows (127.0.0.1)
Write-Host "`n4. Test HTTP 127.0.0.1:8001:" -ForegroundColor Yellow
try {
    $r2 = Invoke-RestMethod -Uri "http://127.0.0.1:8001/healthz" -TimeoutSec 5
    Write-Host "OK: $($r2.status)" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: IP du conteneur
Write-Host "`n5. IP du conteneur:" -ForegroundColor Yellow
$ip = docker inspect atlas-api-geo --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
Write-Host "IP: $ip"

if ($ip) {
    Write-Host "`n6. Test HTTP via IP conteneur:" -ForegroundColor Yellow
    try {
        $r3 = Invoke-RestMethod -Uri "http://${ip}:8000/healthz" -TimeoutSec 5
        Write-Host "OK: $($r3.status)" -ForegroundColor Green
    } catch {
        Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Résumé ===" -ForegroundColor Cyan
Write-Host "Si Test 1 OK mais Test 3/4 KO → Problème port mapping Docker"
Write-Host "Si Test 3 KO mais Test 4 OK → Utiliser 127.0.0.1 au lieu de localhost"
Write-Host "Si Test 6 OK → Docker fonctionne, problème de port forwarding"
```

---

## 🚨 Si Rien ne Fonctionne

**Workaround temporaire** : Accéder à l'API via l'IP du conteneur

1. Trouver l'IP :
```powershell
docker inspect atlas-api-geo --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

2. Modifier `.env` :
```bash
VITE_API_GEO=http://172.18.0.3:8000  # ← Utiliser l'IP trouvée
```

3. Rebuild UI :
```powershell
docker compose build ui
docker compose up -d ui
```

⚠️ **Attention** : L'IP peut changer au redémarrage !

---

## 📞 Support

Si le problème persiste :

1. Exécuter `test_port_mapping.ps1`
2. Copier les résultats
3. Copier la version de Docker Desktop : `docker --version`
4. Copier le backend Docker : Docker Desktop → Settings → General → "Use WSL 2 based engine"

---

**Version** : 1.5.0.1  
**Date** : 2025-10-20  
**Auteur** : Atlas Team
