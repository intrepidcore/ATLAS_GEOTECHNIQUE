# 🌐 Déploiement Atlas v1.5.0 sur LAN

Guide pour déployer Atlas Géotechnique sur le réseau local du laboratoire.

---

## 📋 Prérequis

- **PC Serveur** : Windows avec Docker Desktop installé
- **Réseau** : Les 10 testeurs doivent être sur le même LAN
- **Ports** : 8080 (UI) et 8001 (API) disponibles

---

## 🚀 Installation sur le PC Serveur

### 1. Récupérer l'IP du PC

```powershell
ipconfig
# Notez l'adresse IPv4 (ex: 192.168.1.100)
```

### 2. Configurer les variables d'environnement

Créez/modifiez `.env` :

```bash
# API
CORS_ORIGIN=*
VITE_API_GEO=http://192.168.1.100:8001

# Base de données
DATABASE_URL=postgresql://atlas:atlas123@db:5432/atlas
POSTGRES_USER=atlas
POSTGRES_PASSWORD=atlas123
POSTGRES_DB=atlas

# Logs
RUST_LOG=info
```

⚠️ **Remplacez `192.168.1.100` par votre IP réelle**

### 3. Démarrer les services

```powershell
cd c:\PROJET_ATLAS_MASTER\atlas

# Arrêter si déjà lancé
docker compose down

# Rebuild avec les nouveaux paramètres
docker compose build

# Démarrer
docker compose up -d

# Vérifier
docker compose ps
docker compose logs -f api-geo
```

### 4. Vérifier l'accès

Depuis le PC serveur :
- UI : http://localhost:8080
- API : http://localhost:8001/healthz

Depuis un autre PC du LAN :
- UI : http://192.168.1.100:8080
- API : http://192.168.1.100:8001/healthz

---

## 👥 Accès pour les Testeurs

### URL à communiquer

```
http://192.168.1.100:8080
```

### Comptes de test

Créez des comptes via l'interface ou la base de données :

```sql
-- Se connecter à la DB
docker compose exec db psql -U atlas -d atlas

-- Créer un utilisateur test
INSERT INTO users (username, email, password_hash, role)
VALUES ('testeur1', 'testeur1@lab.tg', '$2b$12$...', 'viewer');
```

---

## 🔧 Configuration Firewall Windows

Si les testeurs ne peuvent pas accéder :

1. **Panneau de configuration** → **Pare-feu Windows**
2. **Paramètres avancés**
3. **Règles de trafic entrant** → **Nouvelle règle**
4. **Port** → **TCP** → **8080, 8001**
5. **Autoriser la connexion**
6. **Domaine, Privé, Public** (cochez tous)
7. **Nom** : "Atlas Géotechnique LAN"

Ou via PowerShell (admin) :

```powershell
New-NetFirewallRule -DisplayName "Atlas UI" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Atlas API" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow
```

---

## 📊 Vérification de la Configuration

### Test depuis le serveur

```powershell
# API Health
curl http://localhost:8001/healthz

# Carte thématique (avec données)
curl "http://localhost:8001/thematic/data?parameter=ip_avg&min_sondages=3"

# UI
Start-Process http://localhost:8080
```

### Test depuis un testeur

```bash
# Remplacer 192.168.1.100 par l'IP du serveur
curl http://192.168.1.100:8001/healthz
```

---

## 🗺️ Utilisation des Cartes Thématiques

### Paramètres disponibles

| Catégorie | Paramètre | Clé API |
|-----------|-----------|---------|
| **Granulométrie** | % Passant 80µm | `passant_80um_avg` |
| | % Passant 2mm | `passant_2mm_avg` |
| | % Passant 20mm | `passant_20mm_avg` |
| **Atterberg** | WL moyen | `wl_avg` |
| | WP moyen | `wp_avg` |
| | IP moyen | `ip_avg` |
| **VBS** | VBS moyen | `vbs_avg` |
| **Proctor** | γd max moyen | `gamma_d_max_avg` |
| | wopt moyen | `w_opt_avg` |
| **Gonflement** | eg moyen | `eg_avg` |

### Exemple d'utilisation UI

1. Cliquer sur **🗺️** (bas droite)
2. Sélectionner **Catégorie** : Atterberg
3. Sélectionner **Paramètre** : IP moyen
4. **Nombre de classes** : 5
5. **Palette** : Verts
6. Cliquer **Appliquer**

---

## 📈 Données Actuelles

- **Mailles** : 29 407
- **Sondages** : 25 620
- **Essais géotechniques** : 196
- **Mailles avec données** : 8 307

---

## 🔄 Rafraîchir les Données

Après import de nouvelles données :

```powershell
docker compose exec db psql -U atlas -d atlas -c "REFRESH MATERIALIZED VIEW mailles_geotechnique_stats;"
```

---

## 🐛 Dépannage

### Les testeurs ne voient pas la carte thématique

1. Vérifier que la MV est rafraîchie :
```sql
SELECT COUNT(*) FROM mailles_geotechnique_stats WHERE n_sondages > 0;
```

2. Vider le cache navigateur : **Ctrl + Shift + R**

### Erreur "Failed to fetch"

1. Vérifier que l'API est accessible :
```powershell
curl http://192.168.1.100:8001/healthz
```

2. Vérifier le firewall Windows

3. Vérifier les logs :
```powershell
docker compose logs api-geo --tail=50
```

### Performance lente

1. Limiter le nombre de mailles affichées :
   - Utiliser **min_sondages >= 5**
   - Zoomer sur une région spécifique

2. Désactiver les géométries pour stats uniquement :
   - `include_geometry=false` dans l'API

---

## 📞 Support

En cas de problème, vérifier :
1. Les logs : `docker compose logs -f`
2. L'état des services : `docker compose ps`
3. La connectivité réseau : `ping 192.168.1.100`

---

**Version** : 1.5.0  
**Date** : 2025-10-20  
**Auteur** : Atlas Team
