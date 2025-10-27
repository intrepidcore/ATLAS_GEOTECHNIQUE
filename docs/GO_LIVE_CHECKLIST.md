# 🚀 Go-Live Checklist - Atlas v1.5.0.1

**Date** : 2025-10-20  
**Objectif** : Déploiement LAN pour 10 testeurs

---

## 0️⃣ Pré-requis

### Infrastructure
- [ ] PC serveur avec Docker Desktop installé
- [ ] Réseau LAN stable
- [ ] IP fixe réservée pour le PC serveur (DHCP reservation)
- [ ] Firewall Windows configuré (ports 8080, 8001)

### Logiciels
- [ ] Docker Desktop en cours d'exécution
- [ ] Git (pour tag v1.5.0.1)
- [ ] PowerShell 7+ (optionnel)

---

## 1️⃣ Configuration

### 1.1 Obtenir l'IP du serveur

```powershell
ipconfig
# Noter l'IPv4 (ex: 192.168.1.100)
```

**IP détectée** : `_________________`

### 1.2 Configurer .env

```bash
# Éditer c:\PROJET_ATLAS_MASTER\atlas\.env

# Base de données
POSTGRES_USER=atlas
POSTGRES_PASSWORD=atlas
POSTGRES_DB=atlas
DATABASE_URL=postgres://atlas:atlas@db:5432/atlas

# API (IMPORTANT: utiliser localhost pour dev, IP pour LAN)
VITE_API_GEO=http://localhost:8001        # ← Dev local
# VITE_API_GEO=http://192.168.1.100:8001  # ← Décommenter pour LAN

# CORS
CORS_ORIGIN=*  # ← Permissif pour tests, restreindre en prod

# Logs
RUST_LOG=info
```

**Checklist** :
- [ ] `VITE_API_GEO` configuré correctement
- [ ] `CORS_ORIGIN` défini
- [ ] Mots de passe sécurisés (si production)

### 1.3 Tag Git

```powershell
cd c:\PROJET_ATLAS_MASTER\atlas
git add .
git commit -m "v1.5.0.1 - Correctif Failed to fetch + préparation LAN"
git tag v1.5.0.1
```

- [ ] Tag créé

---

## 2️⃣ Build & Démarrage

### 2.1 Arrêter les services existants

```powershell
docker compose down
```

- [ ] Services arrêtés

### 2.2 Build des images

```powershell
docker compose build
```

**Durée estimée** : 3-5 minutes

- [ ] Build réussi (exit code 0)

### 2.3 Démarrer les services

```powershell
docker compose up -d
```

- [ ] Services démarrés

### 2.4 Vérifier l'état

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

- [ ] Tous les services sont "healthy"

---

## 3️⃣ Tests Serveur

### 3.1 Health Check API

```powershell
# Depuis le conteneur
docker compose exec api-geo curl http://localhost:8000/healthz
```

**Résultat attendu** : `{"status":"ok"}`

- [ ] API répond

### 3.2 Test Endpoint Thématique

```powershell
# Créer un script PowerShell temporaire
$response = Invoke-RestMethod -Uri "http://localhost:8001/thematic/data?parameter=ip_avg&min_sondages=3"
Write-Host "Features: $($response.features.Count)"
Write-Host "Min: $($response.statistics.min)"
Write-Host "Max: $($response.statistics.max)"
```

**Résultat attendu** : 
```
Features: 150
Min: 5.2
Max: 45.8
```

- [ ] Endpoint répond avec des données

### 3.3 Test UI

Ouvrir dans le navigateur : http://localhost:8080

- [ ] Page se charge
- [ ] Carte s'affiche
- [ ] Pas d'erreur dans la console (F12)

### 3.4 Test Carte Thématique

1. Cliquer sur **🗺️** (bas droite)
2. Sélectionner :
   - Catégorie : **Atterberg**
   - Paramètre : **IP moyen**
   - Classes : **5**
   - Palette : **Verts**
3. Cliquer **Appliquer**

**Résultat attendu** :
- Mailles colorées en vert
- Légende affichée
- Pas d'erreur "Failed to fetch"

- [ ] Carte thématique fonctionne
- [ ] Grilles visibles
- [ ] Légende correcte

---

## 4️⃣ Santé Base de Données

### 4.1 Connexion DB

```powershell
docker compose exec db psql -U atlas -d atlas
```

- [ ] Connexion réussie

### 4.2 Refresh Materialized View

```sql
REFRESH MATERIALIZED VIEW mailles_geotechnique_stats;
```

- [ ] Refresh réussi (sans erreur)

### 4.3 Vérifier les Données

```sql
SELECT 
    COUNT(*) as total_mailles,
    COUNT(*) FILTER (WHERE n_sondages > 0) as mailles_avec_donnees,
    SUM(n_sondages) as total_sondages,
    SUM(n_essais_geo) as total_essais
FROM mailles_geotechnique_stats;
```

**Résultat attendu** :
```
 total_mailles | mailles_avec_donnees | total_sondages | total_essais 
---------------+----------------------+----------------+--------------
         29407 |                 8307 |          25620 |          196
```

- [ ] Données présentes
- [ ] Statistiques cohérentes

### 4.4 Vérifier les Paramètres

```sql
SELECT 
    COUNT(*) FILTER (WHERE passant_80um_avg IS NOT NULL) as avec_passant_80um,
    COUNT(*) FILTER (WHERE ip_avg IS NOT NULL) as avec_ip,
    COUNT(*) FILTER (WHERE vbs_avg IS NOT NULL) as avec_vbs
FROM mailles_geotechnique_stats;
```

- [ ] Paramètres disponibles

```sql
\q  -- Quitter psql
```

---

## 5️⃣ Tests LAN (depuis un autre PC)

### 5.1 Connectivité Réseau

Depuis un PC testeur :

```bash
ping 192.168.1.100  # Remplacer par votre IP
```

- [ ] Ping réussit

### 5.2 Test UI

Ouvrir : `http://192.168.1.100:8080`

- [ ] Page se charge
- [ ] Carte s'affiche

### 5.3 Test API

```bash
curl http://192.168.1.100:8001/healthz
```

- [ ] API répond

### 5.4 Test Carte Thématique

Même procédure qu'en 3.4

- [ ] Carte thématique fonctionne depuis le LAN

---

## 6️⃣ Configuration Firewall

### 6.1 Vérifier les Règles

```powershell
Get-NetFirewallRule -DisplayName "Atlas*"
```

- [ ] Règles existent

### 6.2 Créer les Règles (si nécessaire)

```powershell
# PowerShell en mode Administrateur
New-NetFirewallRule -DisplayName "Atlas UI" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Atlas API" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow
```

- [ ] Règles créées

### 6.3 Tester depuis le LAN

Répéter les tests de la section 5

- [ ] Accès LAN fonctionnel

---

## 7️⃣ Sécurité & Performance

### 7.1 Restreindre CORS (Optionnel)

Si vous connaissez l'IP exacte des testeurs :

```yaml
# docker-compose.yml
environment:
  CORS_ORIGIN: http://192.168.1.100:8080
```

- [ ] CORS restreint (si applicable)

### 7.2 Vérifier les Logs

```powershell
docker compose logs api-geo --tail=50
docker compose logs ui --tail=50
```

- [ ] Pas d'erreurs critiques
- [ ] Pas de warnings suspects

### 7.3 Performance

Tester avec plusieurs paramètres thématiques :
- IP moyen
- VBS moyen
- Passant 80µm

**Temps de réponse attendu** : < 2 secondes

- [ ] Performance acceptable

---

## 8️⃣ Documentation Testeurs

### 8.1 Créer le Guide Testeur

```markdown
# Guide Testeur - Atlas Géotechnique

## Accès
URL : http://192.168.1.100:8080

## Fonctionnalités Disponibles
- ✅ Visualisation des sondages
- ✅ Cartes thématiques (10 paramètres)
- ✅ Filtres géographiques
- ⏳ Import CSV (v1.5.1)
- ⏳ Détection doublons (v1.5.1)

## Support
En cas de problème :
1. Vider le cache : Ctrl + Shift + R
2. Vérifier la connexion réseau
3. Contacter l'administrateur
```

- [ ] Guide créé
- [ ] Guide partagé avec les testeurs

### 8.2 Comptes Testeurs

Créer des comptes pour les 10 testeurs :

```sql
-- Exemple
INSERT INTO users (username, email, password_hash, role)
VALUES 
  ('testeur1', 'testeur1@lab.tg', '$2b$12$...', 'viewer'),
  ('testeur2', 'testeur2@lab.tg', '$2b$12$...', 'viewer');
```

- [ ] 10 comptes créés
- [ ] Identifiants communiqués

---

## 9️⃣ Monitoring & Maintenance

### 9.1 Script de Monitoring

Créer `monitor.ps1` :

```powershell
while ($true) {
    $api = Invoke-RestMethod -Uri "http://localhost:8001/healthz" -ErrorAction SilentlyContinue
    if ($api.status -eq "ok") {
        Write-Host "$(Get-Date) - ✅ API OK" -ForegroundColor Green
    } else {
        Write-Host "$(Get-Date) - ❌ API DOWN" -ForegroundColor Red
    }
    Start-Sleep -Seconds 60
}
```

- [ ] Script créé

### 9.2 Sauvegarde Automatique

Créer `backup.ps1` :

```powershell
$date = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "backup_atlas_$date.sql.gz"

docker compose exec -T db pg_dump -U atlas -d atlas | gzip > $backupFile

Write-Host "Sauvegarde créée : $backupFile"
```

- [ ] Script créé
- [ ] Première sauvegarde effectuée

### 9.3 Planifier les Tâches

**Tâches quotidiennes** :
- Refresh MV : 2h du matin
- Sauvegarde : 3h du matin
- Nettoyage logs : 4h du matin

```powershell
# Créer une tâche planifiée
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File C:\PROJET_ATLAS_MASTER\atlas\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -TaskName "Atlas Backup" -Action $action -Trigger $trigger
```

- [ ] Tâches planifiées créées

---

## 🔟 Communication & Formation

### 10.1 Email aux Testeurs

```
Objet : Atlas Géotechnique v1.5.0 - Accès Testeurs

Bonjour,

L'application Atlas Géotechnique est maintenant disponible pour les tests.

🌐 Accès : http://192.168.1.100:8080

📚 Fonctionnalités :
- Visualisation des 25 620 sondages existants
- Cartes thématiques avec 10 paramètres géotechniques
- Filtres géographiques (ADM1/2/3)

🔑 Identifiants :
Username : testeurX
Password : (fourni séparément)

📞 Support :
En cas de problème, contactez [votre nom] à [email/téléphone]

Merci de votre participation !
```

- [ ] Email envoyé

### 10.2 Session de Formation (Optionnel)

**Durée** : 30 minutes

**Programme** :
1. Présentation générale (5 min)
2. Navigation de base (5 min)
3. Cartes thématiques (10 min)
4. Filtres et recherche (5 min)
5. Questions/Réponses (5 min)

- [ ] Session planifiée
- [ ] Testeurs invités

---

## ✅ Checklist Finale

### Technique
- [ ] Services démarrés et healthy
- [ ] API répond (healthz)
- [ ] UI accessible (localhost)
- [ ] UI accessible (LAN)
- [ ] Carte thématique fonctionne
- [ ] Grilles visibles
- [ ] Base de données opérationnelle
- [ ] MV rafraîchie
- [ ] Firewall configuré
- [ ] Logs propres

### Documentation
- [ ] Guide testeur créé
- [ ] Comptes créés
- [ ] Email envoyé
- [ ] Support disponible

### Monitoring
- [ ] Script de monitoring en place
- [ ] Sauvegarde automatique configurée
- [ ] Tâches planifiées créées

### Sécurité
- [ ] CORS configuré
- [ ] Firewall actif
- [ ] Mots de passe sécurisés
- [ ] Sessions limitées

---

## 📊 Métriques de Succès

### Jour 1
- [ ] 10/10 testeurs connectés
- [ ] 0 erreur critique
- [ ] Temps de réponse < 2s

### Semaine 1
- [ ] Feedback collecté
- [ ] Bugs identifiés
- [ ] Améliorations listées

---

## 🐛 Plan de Rollback

En cas de problème critique :

```powershell
# 1. Arrêter les services
docker compose down

# 2. Revenir à la version précédente
git checkout v1.4.0

# 3. Rebuild
docker compose build

# 4. Redémarrer
docker compose up -d
```

- [ ] Plan de rollback testé

---

## 📞 Contacts

**Administrateur** : _________________  
**Email** : _________________  
**Téléphone** : _________________  

**Heures de support** : _________________

---

## 📝 Notes

_Espace pour notes personnelles pendant le déploiement_

```
Date de déploiement : _______________
Heure de début : _______________
Heure de fin : _______________

Problèmes rencontrés :
- 
- 

Solutions appliquées :
- 
- 

Testeurs présents :
1. _______________
2. _______________
...
```

---

**Version** : 1.5.0.1  
**Date** : 2025-10-20  
**Statut** : ✅ Prêt pour Go-Live

🎉 **Bon déploiement !**
