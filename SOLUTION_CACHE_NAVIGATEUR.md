# 🔧 Solution Cache Navigateur - "Failed to fetch"

**Problème** : Erreur "TypeError: Failed to fetch" dans le wizard d'import  
**Cause** : Le navigateur utilise l'ancien cache avec `localhost` au lieu de `127.0.0.1`

---

## ✅ Solution Immédiate

### Étape 1 : Vider le Cache Navigateur (OBLIGATOIRE)

**Dans le navigateur (sur http://127.0.0.1:8080)** :

1. Appuyer sur **Ctrl + Shift + R** (Windows)
   - Ou **Ctrl + F5**
   - Ou **Shift + F5**

2. **OU** Vider le cache manuellement :
   - **Chrome/Edge** : F12 → Network → Cocher "Disable cache"
   - **Firefox** : F12 → Network → Cocher "Disable HTTP cache"

3. **OU** Vider tout le cache :
   - **Chrome/Edge** : Ctrl + Shift + Delete → Cocher "Cached images and files" → Clear data
   - **Firefox** : Ctrl + Shift + Delete → Cocher "Cache" → Clear

### Étape 2 : Fermer et Rouvrir le Navigateur

```powershell
# Fermer tous les onglets
# Puis rouvrir : http://127.0.0.1:8080
```

### Étape 3 : Vérifier l'URL dans DevTools

1. Appuyer sur **F12** (ouvrir DevTools)
2. Aller dans l'onglet **Network**
3. Rafraîchir la page (**Ctrl + R**)
4. Chercher une requête vers l'API
5. Vérifier que la **Request URL** commence par `http://127.0.0.1:8001`

**Si vous voyez encore `http://localhost:8001`** :
- Le cache n'est pas vidé → Recommencer l'étape 1
- Ou essayer en **mode navigation privée** (Ctrl + Shift + N)

---

## 🎯 Test Rapide

### Test 1 : Carte Thématique (sans import)

1. Ouvrir http://127.0.0.1:8080
2. **Ctrl + Shift + R** (vider cache)
3. Cliquer sur l'icône carte (bas droite)
4. Sélectionner : Atterberg → IP moyen
5. Cliquer **Appliquer**

**Résultat attendu** :
- ✅ Mailles colorées
- ✅ Pas d'erreur "Failed to fetch"

### Test 2 : Vérifier la Console

1. **F12** → Console
2. Chercher des erreurs rouges
3. Si vous voyez "Failed to fetch" :
   - Regarder l'URL de la requête
   - Si c'est `localhost` → Cache pas vidé
   - Si c'est `127.0.0.1` → Autre problème (voir ci-dessous)

---

## ⚠️ Note sur le Wizard d'Import

**L'endpoint `/import/bulk` n'existe pas encore** (prévu v1.5.1).

Même après avoir vidé le cache, le wizard d'import affichera :
```
❌ Erreur lors de l'import: TypeError: Failed to fetch
```

**C'est NORMAL** car le backend ne supporte pas encore l'import bulk.

**Workaround temporaire** :
- Utiliser le formulaire manuel : "🧪 Sondage Géotechnique"
- Ou attendre la v1.5.1

---

## 🔄 Procédure Complète de Reset

Si le problème persiste après avoir vidé le cache :

```powershell
# 1. Arrêter les services
docker compose down

# 2. Vérifier .env
cat .env | Select-String "VITE_API"
# Doit afficher: VITE_API_GEO=http://127.0.0.1:8001

# 3. Rebuild UI (force clean)
docker compose build --no-cache ui

# 4. Redémarrer
docker compose up -d

# 5. Attendre 10 secondes
Start-Sleep -Seconds 10

# 6. Ouvrir en mode privé
Start-Process msedge -ArgumentList "-inprivate http://127.0.0.1:8080"
# OU
Start-Process chrome -ArgumentList "--incognito http://127.0.0.1:8080"
```

---

## 🌐 Mode Navigation Privée (Recommandé pour Tests)

**Avantage** : Pas de cache, pas de cookies

**Chrome/Edge** :
```powershell
Start-Process msedge -ArgumentList "-inprivate http://127.0.0.1:8080"
```

**Firefox** :
```powershell
Start-Process firefox -ArgumentList "-private-window http://127.0.0.1:8080"
```

---

## 📊 Diagnostic Avancé

### Vérifier ce que l'UI utilise réellement

**Méthode 1 : Inspecter le code source**

1. Ouvrir http://127.0.0.1:8080
2. **Ctrl + U** (voir source)
3. Chercher `127.0.0.1` ou `localhost` dans le code

**Méthode 2 : Network tab**

1. **F12** → Network
2. Rafraîchir (**Ctrl + R**)
3. Cliquer sur n'importe quelle requête vers l'API
4. Regarder **Request URL** dans l'onglet Headers

**Méthode 3 : Console**

```javascript
// Dans la console (F12)
console.log(import.meta.env.VITE_API_GEO)
// Devrait afficher: http://127.0.0.1:8001
```

---

## ✅ Checklist Finale

- [ ] `.env` contient `VITE_API_GEO=http://127.0.0.1:8001`
- [ ] UI rebuild : `docker compose build ui`
- [ ] Services redémarrés : `docker compose up -d`
- [ ] Cache navigateur vidé : **Ctrl + Shift + R**
- [ ] Navigateur fermé et rouvert
- [ ] URL correcte : `http://127.0.0.1:8080` (pas localhost)
- [ ] DevTools Network montre `127.0.0.1:8001` dans les requêtes
- [ ] Carte thématique fonctionne sans erreur

---

## 🎯 Résumé

| Problème | Solution |
|----------|----------|
| "Failed to fetch" dans wizard | Normal, endpoint pas implémenté (v1.5.1) |
| "Failed to fetch" dans carte | Vider cache navigateur (Ctrl+Shift+R) |
| Requêtes vers `localhost` | Cache pas vidé → Mode privé |
| Requêtes vers `127.0.0.1` mais erreur | Vérifier que l'API répond (test_solution.ps1) |

---

## 📞 Support

**Si le problème persiste** :

1. Exécuter `test_solution.ps1` → Doit passer tous les tests
2. Ouvrir en mode privé → Doit fonctionner
3. Si mode privé OK mais normal KO → Problème de cache
4. Si mode privé KO aussi → Problème de configuration

---

**Version** : 1.5.0.1  
**Date** : 2025-10-20  
**Auteur** : Atlas Team

🎉 **La carte thématique devrait maintenant fonctionner !**
