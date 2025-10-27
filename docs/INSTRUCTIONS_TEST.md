# 🧪 Instructions de Test - Atlas v1.5.0

## ✅ Étape 1 : Vérifier que les services tournent

```powershell
docker compose ps
```

**Résultat attendu** :
```
NAME            STATUS
atlas-api-geo   Up (healthy)
atlas-db        Up (healthy)
atlas-ui        Up (healthy)
```

---

## ✅ Étape 2 : Tester l'API (depuis le serveur)

### Méthode 1 : Navigateur

Ouvrir dans votre navigateur :
- http://localhost:8001/healthz

**Résultat attendu** : `{"status":"ok"}`

### Méthode 2 : Docker exec

```powershell
docker compose exec api-geo curl http://localhost:8000/healthz
```

**Résultat attendu** : `{"status":"ok"}`

---

## ✅ Étape 3 : Tester la carte thématique (UI)

1. Ouvrir http://localhost:8080 dans votre navigateur

2. **Vider le cache** : **Ctrl + Shift + R**

3. Cliquer sur le bouton **🗺️** en bas à droite

4. Configurer :
   - **Catégorie** : Atterberg
   - **Paramètre** : IP moyen (Indice de plasticité)
   - **Type de carte** : Choroplèthe (aplats)
   - **Méthode** : Quantiles
   - **Nombre de classes** : 5
   - **Palette** : Verts

5. Cliquer **Appliquer**

**Résultat attendu** :
- ✅ Mailles colorées en vert sur la carte
- ✅ Légende affichée à gauche avec 5 classes
- ✅ Pas d'erreur dans la console (F12)

---

## ✅ Étape 4 : Tester d'autres paramètres

### Granulométrie

- **% Passant 80µm (moyen)**
- **% Passant 2mm (moyen)**

### VBS

- **VBS moyen**

### Proctor

- **γd max (moyen)**
- **wopt (moyen)**

**Pour chaque paramètre** :
1. Sélectionner dans le panneau
2. Cliquer **Appliquer**
3. Vérifier que la carte se met à jour

---

## ✅ Étape 5 : Tester depuis un autre PC (LAN)

### Sur le PC serveur

1. Obtenir l'IP :
```powershell
ipconfig
```
Notez l'adresse IPv4 (ex: `192.168.1.100`)

### Sur un autre PC du réseau

1. Ouvrir le navigateur

2. Aller à : `http://192.168.1.100:8080`  
   (Remplacer par l'IP réelle)

3. Tester la carte thématique (même procédure qu'Étape 3)

**Si ça ne fonctionne pas** :
- Vérifier le firewall Windows (voir DEPLOIEMENT_LAN.md)
- Ping le serveur : `ping 192.168.1.100`

---

## ✅ Étape 6 : Vérifier les données

### Depuis la base de données

```powershell
docker compose exec db psql -U atlas -d atlas
```

Puis dans psql :

```sql
-- Statistiques globales
SELECT 
    COUNT(*) as total_mailles,
    COUNT(*) FILTER (WHERE n_sondages > 0) as mailles_avec_donnees,
    SUM(n_sondages) as total_sondages,
    SUM(n_essais_geo) as total_essais
FROM mailles_geotechnique_stats;

-- Exemples de données
SELECT 
    code,
    n_sondages,
    n_essais_geo,
    ROUND(ip_avg::numeric, 2) as ip,
    ROUND(vbs_avg::numeric, 2) as vbs,
    ROUND(passant_80um_avg::numeric, 2) as passant_80um
FROM mailles_geotechnique_stats
WHERE n_sondages > 0
LIMIT 10;

-- Quitter
\q
```

**Résultats attendus** :
- Total mailles : ~29 407
- Mailles avec données : ~8 307
- Total sondages : ~25 620
- Total essais : ~196

---

## ✅ Étape 7 : Tester l'import manuel (optionnel)

1. Sur http://localhost:8080

2. Cliquer **🧪 Sondage Géotechnique**

3. Remplir le formulaire :
   - **Code** : TEST-2025-001
   - **Latitude** : 6.5
   - **Longitude** : 1.2
   - **Date** : 2025-10-20
   - **Source** : Test manuel

4. Cliquer **Créer**

5. Vérifier que le sondage apparaît sur la carte

6. Rafraîchir la vue matérialisée :
```powershell
docker compose exec db psql -U atlas -d atlas -c "REFRESH MATERIALIZED VIEW mailles_geotechnique_stats;"
```

---

## 🐛 Dépannage

### Problème : Carte thématique vide

**Solution** :
1. Vider le cache : Ctrl + Shift + R
2. Vérifier la console (F12) pour les erreurs
3. Vérifier que la MV contient des données :
```sql
SELECT COUNT(*) FROM mailles_geotechnique_stats WHERE ip_avg IS NOT NULL;
```

### Problème : Erreur "Failed to fetch"

**Solution** :
1. Vérifier que l'API tourne :
```powershell
docker compose logs api-geo --tail=20
```

2. Tester l'endpoint directement :
```powershell
docker compose exec api-geo curl http://localhost:8000/healthz
```

### Problème : Pas d'accès depuis le LAN

**Solution** :
1. Vérifier le firewall :
```powershell
Get-NetFirewallRule -DisplayName "Atlas*"
```

2. Créer les règles si nécessaire :
```powershell
New-NetFirewallRule -DisplayName "Atlas UI" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Atlas API" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow
```

3. Vérifier que Docker expose bien les ports :
```powershell
docker compose ps
# Doit afficher : 0.0.0.0:8080->80/tcp et 0.0.0.0:8001->8000/tcp
```

---

## ✅ Checklist Finale

- [ ] Services démarrés (`docker compose ps`)
- [ ] Health check OK (`/healthz`)
- [ ] UI accessible (http://localhost:8080)
- [ ] Carte thématique fonctionne (IP moyen)
- [ ] Autres paramètres fonctionnent (VBS, Passant 80µm)
- [ ] Accès LAN testé depuis un autre PC
- [ ] Firewall configuré
- [ ] Données vérifiées dans la base

---

**Si tous les tests passent** : ✅ **Atlas v1.5.0 est prêt pour les 10 testeurs !**

**En cas de problème** : Consulter `DEPLOIEMENT_LAN.md` et `RESUME_V1.5.0_FINAL.md`
