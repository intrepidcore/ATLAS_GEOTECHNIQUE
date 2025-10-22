# 🔍 Diagnostic "Failed to fetch" - Guide Rapide

**Problème** : Erreur "Failed to fetch" dans l'UI  
**Symptômes** : Stats = 0, bannière "Erreur de chargement", grilles non visibles

---

## ✅ Tests de Diagnostic (dans l'ordre)

### Test 1 : L'API répond-elle localement ?

```powershell
docker compose exec api-geo curl -sS http://localhost:8000/healthz
```

**Attendu** : `{"status":"ok"}`

- ✅ **Si OK** : L'API fonctionne, passer au Test 2
- ❌ **Si KO** : Redémarrer l'API
  ```powershell
  docker compose restart api-geo
  docker compose logs -f api-geo
  ```

---

### Test 2 : L'API est-elle accessible depuis l'hôte ?

```powershell
# Test depuis Windows (hors conteneur)
Invoke-RestMethod -Uri "http://localhost:8001/healthz"
```

**Attendu** : `status : ok`

- ✅ **Si OK** : Port mapping fonctionne, passer au Test 3
- ❌ **Si KO** : Vérifier docker-compose.yml
  ```yaml
  api-geo:
    ports:
      - "8001:8000"  # ← Doit être présent
    environment:
      - API_BIND=0.0.0.0:8000  # ← Écoute sur toutes interfaces
  ```

---

### Test 3 : Quelle URL l'UI utilise-t-elle ?

**Ouvrir le navigateur** : http://localhost:8080

1. Appuyer sur **F12** (ouvrir DevTools)
2. Aller dans l'onglet **Network**
3. Rafraîchir la page (**Ctrl + R**)
4. Chercher une requête vers `/coverage/mailles` ou `/thematic/data`
5. Cliquer dessus et regarder la **Request URL**

**Exemples** :

| Request URL | Diagnostic |
|-------------|------------|
| `http://localhost:8001/...` | ✅ **CORRECT** |
| `http://127.0.0.1:8001/...` | ❌ **MAUVAIS** - Rebuild UI nécessaire |
| `http://192.168.x.y:8001/...` | ✅ **OK pour LAN** |
| Autre port (ex: 8000) | ❌ **MAUVAIS PORT** - Corriger .env |

---

### Test 4 : Vérifier la configuration .env

```powershell
cat .env | Select-String "VITE_API"
```

**Attendu** :
```
VITE_API_GEO=http://localhost:8001
```

**Corrections possibles** :

| Problème | Correction |
|----------|------------|
| `http://127.0.0.1:8001` | Changer en `http://localhost:8001` |
| `http://localhost:8000` | Changer en `http://localhost:8001` |
| Manquant | Ajouter la ligne |

**Après correction** :
```powershell
docker compose build ui
docker compose up -d ui
```

⚠️ **IMPORTANT** : Vite compile l'URL dans le JS. Il FAUT rebuild après changement de `.env`.

---

## 🔧 Correctifs par Cause

### Cause #1 : Mauvais VITE_API_GEO (le plus fréquent)

**Symptôme** : Request URL dans Network montre une mauvaise adresse

**Solution** :
```bash
# Éditer .env
VITE_API_GEO=http://localhost:8001

# Rebuild UI
docker compose build ui
docker compose up -d ui

# Vider cache navigateur
Ctrl + Shift + R
```

---

### Cause #2 : API n'écoute pas sur 0.0.0.0

**Symptôme** : Test 2 échoue (API non accessible depuis l'hôte)

**Solution** :
```yaml
# docker-compose.yml
api-geo:
  environment:
    - API_BIND=0.0.0.0:8000  # ← Ajouter cette ligne
  ports:
    - "8001:8000"  # ← Vérifier le mapping
```

```powershell
docker compose up -d api-geo
```

---

### Cause #3 : CORS bloque la requête

**Symptôme** : Dans Network, status = "(failed)" et erreur CORS dans Console

**Solution** :
```yaml
# docker-compose.yml
api-geo:
  environment:
    - CORS_ORIGIN=*  # ← Permissif pour tests
    # OU
    - CORS_ORIGIN=http://localhost:8080  # ← Plus sécurisé
```

```powershell
docker compose up -d api-geo
# Vider cache navigateur
Ctrl + Shift + R
```

---

### Cause #4 : Firewall Windows bloque

**Symptôme** : Test 2 OK depuis le serveur, mais KO depuis un autre PC du LAN

**Solution** :
```powershell
# PowerShell en mode Administrateur
New-NetFirewallRule -DisplayName "Atlas UI" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Atlas API" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow

# Vérifier
Get-NetFirewallRule -DisplayName "Atlas*"
```

---

## 🎯 Checklist Rapide

- [ ] Test 1 : API répond localement (`curl` dans conteneur)
- [ ] Test 2 : API accessible depuis l'hôte (`Invoke-RestMethod`)
- [ ] Test 3 : Request URL correcte dans DevTools (F12 → Network)
- [ ] Test 4 : `.env` contient `VITE_API_GEO=http://localhost:8001`
- [ ] UI rebuild après changement `.env`
- [ ] Cache navigateur vidé (Ctrl + Shift + R)
- [ ] Firewall configuré (si LAN)

---

## 📊 Tableau de Décision

| Test 1 | Test 2 | Test 3 (Request URL) | Cause Probable | Solution |
|--------|--------|----------------------|----------------|----------|
| ❌ | - | - | API down | Restart API |
| ✅ | ❌ | - | Port mapping | Vérifier docker-compose.yml |
| ✅ | ✅ | `127.0.0.1:8001` | Mauvais VITE_API_GEO | Corriger .env + rebuild UI |
| ✅ | ✅ | `localhost:8000` | Mauvais port | Corriger .env + rebuild UI |
| ✅ | ✅ | `localhost:8001` + CORS error | CORS | Ajouter CORS_ORIGIN=* |
| ✅ | ✅ | Depuis LAN KO | Firewall | Ouvrir ports 8080/8001 |

---

## 🔄 Procédure Complète de Reset

Si rien ne fonctionne, reset complet :

```powershell
# 1. Arrêter tout
docker compose down

# 2. Vérifier .env
cat .env
# Doit contenir : VITE_API_GEO=http://localhost:8001

# 3. Rebuild tout
docker compose build

# 4. Redémarrer
docker compose up -d

# 5. Attendre que tout soit healthy
docker compose ps

# 6. Tester API
Invoke-RestMethod -Uri "http://localhost:8001/healthz"

# 7. Ouvrir UI et vider cache
# http://localhost:8080
# Ctrl + Shift + R

# 8. Tester carte thématique
# 🗺️ → IP moyen → Appliquer
```

---

## 📞 Support

Si le problème persiste après tous ces tests :

1. **Copier** la Request URL complète depuis Network (F12)
2. **Copier** le contenu de `.env`
3. **Copier** le résultat de `docker compose ps`
4. **Copier** les logs : `docker compose logs api-geo --tail=50`

Avec ces 4 éléments, le diagnostic sera immédiat.

---

**Version** : 1.5.0.1  
**Date** : 2025-10-20  
**Auteur** : Atlas Team
