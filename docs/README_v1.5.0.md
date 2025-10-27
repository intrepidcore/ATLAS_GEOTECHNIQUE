# 🚀 Atlas Géotechnique v1.5.0 - PRÊT !

## ✅ Statut : Production-Ready pour LAN

**Date** : 2025-10-20  
**Objectif** : Déploiement pour 10 testeurs sur le réseau local du laboratoire

---

## 📋 Ce qui a été fait

### 1. Base de Données ✅
- Vue matérialisée `mailles_geotechnique_stats` avec **25 620 sondages** et **196 essais**
- Fonction `upsert_sondage_wgs84()` pour conversion WGS84→UTM
- UUID auto sur toutes les tables
- **Fichier** : `db/migrations/v1.5.0_complete_setup.sql`

### 2. API Backend ✅
- Alias serde pour accepter `passant_80um_avg` ET `passant80um_avg`
- CORS permissif (Any origin)
- Exposition sur 0.0.0.0:8000 (accessible LAN)
- **Fichier** : `services/api-geo/src/thematic/types.rs`

### 3. Docker ✅
- Ports exposés sur toutes interfaces (0.0.0.0)
  - UI : port 8080
  - API : port 8001
- **Fichier** : `docker-compose.yml`

### 4. Frontend ✅
- Cartes thématiques complètes (10 catégories de paramètres)
- Import Bulk Wizard (UI prête, backend v1.5.1)
- Détection de doublons (UI prête, backend v1.5.1)
- Contraste amélioré (police sombre)

---

## 🎯 Démarrage Rapide

```powershell
# 1. Obtenir l'IP du PC
ipconfig  # Noter l'IPv4 (ex: 192.168.1.100)

# 2. Configurer .env (si pas déjà fait)
# CORS_ORIGIN=*
# VITE_API_GEO=http://192.168.1.100:8001

# 3. Démarrer
cd c:\PROJET_ATLAS_MASTER\atlas
docker compose down
docker compose up -d

# 4. Vérifier
docker compose ps
docker compose logs -f api-geo
```

---

## 🌐 Accès

### Depuis le serveur
- **UI** : http://localhost:8080
- **API** : http://localhost:8001/healthz

### Depuis le LAN (testeurs)
- **UI** : http://192.168.1.100:8080  
  *(Remplacer par votre IP)*

---

## 🗺️ Test Carte Thématique

1. Ouvrir http://localhost:8080
2. **Ctrl + Shift + R** (vider cache)
3. Cliquer **🗺️** (bas droite)
4. Sélectionner :
   - Catégorie : **Atterberg**
   - Paramètre : **IP moyen**
   - Classes : **5**
   - Palette : **Verts**
5. Cliquer **Appliquer**

**Résultat** : Carte colorée avec 8 307 mailles

---

## 📊 Données Disponibles

| Métrique | Valeur |
|----------|--------|
| Mailles totales | 29 407 |
| Mailles avec données | 8 307 |
| Sondages | 25 620 |
| Essais géotechniques | 196 |

---

## 🔧 Firewall (si nécessaire)

```powershell
# PowerShell (admin)
New-NetFirewallRule -DisplayName "Atlas UI" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Atlas API" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow
```

---

## 📚 Documentation

| Fichier | Description |
|---------|-------------|
| `DEPLOIEMENT_LAN.md` | Guide complet de déploiement |
| `INSTRUCTIONS_TEST.md` | Procédure de test étape par étape |
| `CHANGELOG_v1.5.0.md` | Liste complète des changements |
| `RESUME_V1.5.0_FINAL.md` | Résumé technique détaillé |

---

## 🐛 Dépannage Rapide

### Carte vide ?
```powershell
# Vider cache navigateur : Ctrl + Shift + R
# Vérifier la MV :
docker compose exec db psql -U atlas -d atlas -c "SELECT COUNT(*) FROM mailles_geotechnique_stats WHERE n_sondages > 0;"
```

### Erreur "Failed to fetch" ?
```powershell
# Vérifier l'API :
docker compose exec api-geo curl http://localhost:8000/healthz
# Vérifier les logs :
docker compose logs api-geo --tail=50
```

### Pas d'accès LAN ?
```powershell
# Vérifier les ports :
docker compose ps
# Doit afficher : 0.0.0.0:8080 et 0.0.0.0:8001
# Configurer le firewall (voir ci-dessus)
```

---

## ⚠️ Limitations v1.5.0

- ❌ `/import/bulk` backend non implémenté → utiliser formulaire manuel
- ⚠️ `/surveys/nearby` nécessite tests
- ⚠️ Requêtes lentes sur 29k mailles → utiliser `min_sondages >= 3`

**Prévu v1.5.1** : Import bulk complet + optimisations

---

## ✅ Checklist Déploiement

- [ ] Services démarrés
- [ ] Health check OK
- [ ] Carte thématique testée (serveur)
- [ ] Accès LAN testé (autre PC)
- [ ] Firewall configuré
- [ ] URL communiquée aux testeurs

---

## 🎉 Prêt pour les 10 testeurs !

**Questions ?** Consulter `INSTRUCTIONS_TEST.md` ou `DEPLOIEMENT_LAN.md`

---

**Version** : 1.5.0  
**Statut** : ✅ Production-Ready  
**Date** : 2025-10-20
