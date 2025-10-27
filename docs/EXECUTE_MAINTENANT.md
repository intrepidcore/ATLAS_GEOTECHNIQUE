# 🚀 À EXÉCUTER MAINTENANT

## ⚡ Commandes à Copier-Coller

Ouvrez **PowerShell** et exécutez :

```powershell
# 1. Aller dans le dossier atlas
cd C:\PROJET_ATLAS_MASTER\atlas

# 2. Redémarrer l'API avec rebuild
.\scripts\restart-api.ps1 -Build

# 3. Tester CORS
.\scripts\test-cors.ps1
```

---

## ✅ Résultat Attendu

### Après `restart-api.ps1 -Build`

```
🔄 Redémarrage de l'API Atlas

⏹️  Arrêt de l'API...
🔨 Reconstruction de l'image...
▶️  Démarrage de l'API...
⏳ Attente du démarrage...
✅ API démarrée avec succès!

========================================
✅ API redémarrée avec succès
========================================

🔗 Endpoints:
   Health: http://127.0.0.1:8000/healthz
   Coverage: http://127.0.0.1:8000/coverage/mailles

🌐 UI: http://localhost:8080
```

### Après `test-cors.ps1`

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

📋 Test 3: Requête avec Origin 127.0.0.1:8080
✅ Status: 200
   Access-Control-Allow-Origin: http://127.0.0.1:8080

✅ Tests CORS terminés
```

---

## 🌐 Vérifier dans le Navigateur

1. Ouvrir **http://localhost:8080**
2. Appuyer sur **F12** (Console Développeur)
3. Vérifier qu'il n'y a **AUCUNE erreur CORS rouge**
4. La carte doit afficher les données

---

## 🎯 Si Erreur

### "docker compose: command not found"

**Solution:**
```powershell
# Vérifier Docker Desktop
docker --version

# Si pas installé, télécharger:
# https://www.docker.com/products/docker-desktop
```

### "API n'a pas démarré correctement"

**Solution:**
```powershell
# Voir les logs
docker compose logs api-geo

# Redémarrer Docker Desktop
# Puis relancer: .\scripts\restart-api.ps1 -Build
```

### "Tests CORS échouent"

**Solution:**
```powershell
# Vérifier que l'API écoute bien
curl http://127.0.0.1:8000/healthz

# Doit retourner: {"status":"ok"}

# Si erreur, voir les logs:
docker compose logs api-geo --tail=50
```

---

## 📋 Checklist Rapide

- [ ] PowerShell ouvert
- [ ] `cd C:\PROJET_ATLAS_MASTER\atlas`
- [ ] `.\scripts\restart-api.ps1 -Build` → ✅
- [ ] `.\scripts\test-cors.ps1` → ✅
- [ ] Navigateur: http://localhost:8080 → Pas d'erreur CORS
- [ ] Carte affichée avec données

---

## 🎉 Succès !

Si tous les tests sont ✅, le problème CORS est **résolu** !

Vous pouvez maintenant utiliser l'application normalement.

---

## 📚 Documentation

- **Guide rapide:** `CORS_QUICK_FIX.md`
- **Guide complet:** `FIX_CORS.md`
- **Scripts:** `scripts/restart-api.ps1`, `scripts/test-cors.ps1`

---

**Prêt ? Exécutez les commandes ci-dessus ! 🚀**
