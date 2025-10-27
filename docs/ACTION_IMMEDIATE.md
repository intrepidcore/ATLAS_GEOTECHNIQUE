# 🚀 ACTION IMMÉDIATE - Atlas v1.5.0.1

**Problème** : "Failed to fetch" dans le wizard d'import  
**Solution** : Vider le cache navigateur

---

## ✅ À FAIRE MAINTENANT (2 minutes)

### 1. Vider le Cache du Navigateur

**Dans votre navigateur sur http://127.0.0.1:8080** :

Appuyer sur : **Ctrl + Shift + R**

Ou : **Ctrl + F5**

Ou : **Shift + F5**

### 2. Fermer et Rouvrir le Navigateur

Fermer **tous les onglets** d'Atlas, puis rouvrir :

```
http://127.0.0.1:8080
```

⚠️ **IMPORTANT** : Utiliser `127.0.0.1` et NON `localhost`

### 3. Tester la Carte Thématique

1. Cliquer sur l'icône carte (bas droite)
2. Sélectionner :
   - **Catégorie** : Atterberg
   - **Paramètre** : IP moyen
   - **Classes** : 5
   - **Palette** : Verts
3. Cliquer **Appliquer**

**Résultat attendu** :
- ✅ Mailles colorées en vert
- ✅ Légende affichée
- ✅ **Pas d'erreur "Failed to fetch"**

---

## 📝 Note sur le Wizard d'Import

L'erreur dans le wizard d'import est **NORMALE** car :
- L'endpoint `/import/bulk` n'est **pas encore implémenté** (prévu v1.5.1)
- Le backend ne supporte pas l'import CSV bulk pour le moment

**Workaround** :
- Utiliser le formulaire manuel : "🧪 Sondage Géotechnique"
- Ou attendre la version 1.5.1

---

## 🔍 Vérification

### Ouvrir DevTools (F12)

1. Appuyer sur **F12**
2. Aller dans **Network**
3. Rafraîchir la page (**Ctrl + R**)
4. Chercher une requête vers `/coverage/mailles` ou `/thematic/data`
5. Cliquer dessus
6. Vérifier la **Request URL**

**Doit commencer par** : `http://127.0.0.1:8001`

**Si vous voyez** `http://localhost:8001` :
- Le cache n'est pas vidé
- Recommencer l'étape 1

---

## 🎯 Mode Navigation Privée (Alternative)

Si le cache ne se vide pas :

**Edge** :
```powershell
Start-Process msedge -ArgumentList "-inprivate http://127.0.0.1:8080"
```

**Chrome** :
```powershell
Start-Process chrome -ArgumentList "--incognito http://127.0.0.1:8080"
```

En mode privé, **pas de cache** = garantie de voir la nouvelle version.

---

## ✅ Résumé

| Action | Statut |
|--------|--------|
| `.env` modifié (127.0.0.1) | ✅ Fait |
| UI rebuild | ✅ Fait |
| Services redémarrés | ✅ Fait |
| Cache navigateur vidé | ⏳ **À FAIRE** |
| Test carte thématique | ⏳ **À FAIRE** |

---

## 📞 Si Problème Persiste

Exécuter :
```powershell
powershell -ExecutionPolicy Bypass -File test_solution.ps1
```

Tous les tests doivent passer.

Si les tests passent mais le navigateur montre encore l'erreur :
→ **C'est un problème de cache** → Mode privé

---

**Version** : 1.5.0.1  
**Date** : 2025-10-20  

🎉 **Après avoir vidé le cache, la carte thématique devrait fonctionner !**
