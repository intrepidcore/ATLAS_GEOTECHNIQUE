# 🧪 Test Final dans le Navigateur

## 📋 Instructions

### 1. Ouvrir en Mode Privé

**Windows** : `Ctrl + Shift + N` (Edge/Chrome)

**URL** : `http://127.0.0.1:8080`

---

### 2. Ouvrir DevTools

**F12** → Onglet **Network**

---

### 3. Tester la Carte Thématique

1. Cliquer sur l'icône **carte** (bas droite)
2. Sélectionner : **IP moyen**
3. Cliquer : **Appliquer**

---

### 4. Vérifier les Requêtes

Dans l'onglet **Network**, cherchez une requête vers :
```
/api/thematic/data?parameter=ip_avg&...
```

**✅ Attendu** :
- Request URL commence par `/api/` ou `http://127.0.0.1:8080/api/`
- Status : `200 OK`
- Response contient des features GeoJSON

**❌ Si erreur** :
- Request URL commence par `http://127.0.0.1:8001` → UI mal buildée
- Status : `Failed to fetch` → Proxy ne fonctionne pas
- Status : `CORS error` → Configuration CORS

---

### 5. Tester le Wizard Import

1. Cliquer sur **Import CSV/Bulk**
2. Vérifier que le wizard s'ouvre
3. Dans Network, chercher :
   ```
   OPTIONS /api/import/bulk
   ```

**✅ Attendu** :
- Status : `200 OK`
- Headers contiennent `Access-Control-Allow-Methods`

---

## 🔧 Si Problème

### "Failed to fetch"

```powershell
# Vérifier que l'UI utilise /api
cd C:\PROJET_ATLAS_MASTER\atlas
.\check_ui_build.ps1
```

### Carte vide (0 features)

```powershell
# Rafraîchir la vue matérialisée
docker compose exec db psql -U atlas -d atlas -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mailles_geotechnique_stats;"
```

### Erreur CORS

```powershell
# Vérifier logs API
docker compose logs api-geo --tail=20
```

---

## ✅ Succès Attendu

- Carte affiche les mailles colorées
- Pas d'erreur rouge dans Console
- Toutes les requêtes commencent par `/api/`
- Wizard import s'ouvre correctement

---

**Bonne chance ! 🚀**
