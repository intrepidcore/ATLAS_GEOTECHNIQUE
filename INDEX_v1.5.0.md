# 📑 Index - Atlas Géotechnique v1.5.0

## 🎯 Navigation Rapide

### Je veux...

| Objectif | Fichier à consulter |
|----------|---------------------|
| **Déployer rapidement** | `README_v1.5.0.md` → `deploy.ps1` |
| **Comprendre ce qui a changé** | `CHANGELOG_v1.5.0.md` |
| **Tester l'installation** | `INSTRUCTIONS_TEST.md` |
| **Configurer le LAN** | `DEPLOIEMENT_LAN.md` |
| **Comprendre l'architecture** | `RESUME_V1.5.0_FINAL.md` |
| **Voir tous les fichiers** | `FICHIERS_v1.5.0.md` |
| **Dépanner un problème** | `DEPLOIEMENT_LAN.md` (section Dépannage) |

---

## 📚 Documentation par Rôle

### 👨‍💼 Chef de Projet

**Lire dans cet ordre** :
1. `README_v1.5.0.md` (2 min) - Vue d'ensemble
2. `CHANGELOG_v1.5.0.md` (5 min) - Nouveautés
3. `DEPLOIEMENT_LAN.md` (10 min) - Plan de déploiement

### 👨‍💻 Développeur

**Lire dans cet ordre** :
1. `RESUME_V1.5.0_FINAL.md` (10 min) - Architecture technique
2. `CHANGELOG_v1.5.0.md` (10 min) - Changements code
3. `db/migrations/v1.5.0_complete_setup.sql` - Migration SQL
4. `services/api-geo/src/thematic/types.rs` - Types API

### 🧪 Testeur

**Lire dans cet ordre** :
1. `README_v1.5.0.md` (2 min) - Accès rapide
2. `INSTRUCTIONS_TEST.md` (15 min) - Procédure de test
3. `DEPLOIEMENT_LAN.md` (si problème) - Dépannage

### 🔧 DevOps

**Lire dans cet ordre** :
1. `DEPLOIEMENT_LAN.md` (15 min) - Guide complet
2. `deploy.ps1` - Script automatique
3. `docker-compose.yml` - Configuration
4. `INSTRUCTIONS_TEST.md` - Validation

---

## 🗂️ Documentation par Thème

### Déploiement

| Fichier | Description | Durée lecture |
|---------|-------------|---------------|
| `README_v1.5.0.md` | Résumé ultra-concis | 2 min |
| `DEPLOIEMENT_LAN.md` | Guide complet | 15 min |
| `deploy.ps1` | Script automatique | - |

### Tests

| Fichier | Description | Durée lecture |
|---------|-------------|---------------|
| `INSTRUCTIONS_TEST.md` | Procédure étape par étape | 15 min |
| `test_api.ps1` | Script de test API | - |
| `test_thematic.sh` | Script de test cartes | - |

### Technique

| Fichier | Description | Durée lecture |
|---------|-------------|---------------|
| `RESUME_V1.5.0_FINAL.md` | Résumé technique | 10 min |
| `CHANGELOG_v1.5.0.md` | Liste des changements | 10 min |
| `SITUATION_FINALE.md` | Analyse technique | 10 min |

### Base de Données

| Fichier | Description | Durée lecture |
|---------|-------------|---------------|
| `db/migrations/v1.5.0_complete_setup.sql` | Migration complète | 5 min |

### Code

| Fichier | Description | Durée lecture |
|---------|-------------|---------------|
| `services/api-geo/src/thematic/types.rs` | Types API (modifié) | 5 min |
| `ui/src/import-bulk-wizard.css` | Styles UI (modifié) | 2 min |
| `docker-compose.yml` | Config Docker (modifié) | 2 min |

---

## 🚀 Workflows Recommandés

### Workflow 1 : Premier Déploiement (30 min)

```
1. Lire README_v1.5.0.md (2 min)
2. Exécuter deploy.ps1 (5 min)
3. Suivre INSTRUCTIONS_TEST.md (15 min)
4. Configurer firewall (5 min)
5. Tester depuis LAN (3 min)
```

### Workflow 2 : Dépannage (15 min)

```
1. Consulter DEPLOIEMENT_LAN.md (section Dépannage)
2. Vérifier les logs : docker compose logs -f
3. Exécuter test_api.ps1
4. Consulter INSTRUCTIONS_TEST.md
```

### Workflow 3 : Mise à jour (10 min)

```
1. Lire CHANGELOG_v1.5.0.md
2. Exécuter deploy.ps1 -SkipBuild
3. Tester avec INSTRUCTIONS_TEST.md
```

---

## 📊 Matrice de Décision

### Quel fichier lire ?

```
Vous êtes...              → Lisez...
├─ Pressé ?               → README_v1.5.0.md
├─ Déployeur ?            → DEPLOIEMENT_LAN.md
├─ Testeur ?              → INSTRUCTIONS_TEST.md
├─ Développeur ?          → RESUME_V1.5.0_FINAL.md
├─ Curieux ?              → CHANGELOG_v1.5.0.md
└─ Perdu ?                → Ce fichier (INDEX_v1.5.0.md)
```

### Quel script exécuter ?

```
Vous voulez...            → Exécutez...
├─ Déployer ?             → deploy.ps1
├─ Tester l'API ?         → test_api.ps1
├─ Tester les cartes ?    → test_thematic.sh
└─ Tout automatiser ?     → deploy.ps1 (puis test_api.ps1)
```

---

## 🔍 Recherche Rapide

### Par Mot-Clé

| Mot-clé | Fichiers concernés |
|---------|-------------------|
| **LAN** | DEPLOIEMENT_LAN.md, README_v1.5.0.md |
| **Firewall** | DEPLOIEMENT_LAN.md, deploy.ps1 |
| **Carte thématique** | INSTRUCTIONS_TEST.md, RESUME_v1.5.0_FINAL.md |
| **IP** | DEPLOIEMENT_LAN.md, deploy.ps1 |
| **Docker** | docker-compose.yml, DEPLOIEMENT_LAN.md |
| **SQL** | db/migrations/v1.5.0_complete_setup.sql |
| **API** | RESUME_V1.5.0_FINAL.md, types.rs |
| **Test** | INSTRUCTIONS_TEST.md, test_api.ps1 |
| **Erreur** | DEPLOIEMENT_LAN.md (Dépannage) |

### Par Problème

| Problème | Solution |
|----------|----------|
| Carte vide | INSTRUCTIONS_TEST.md (Étape 6) |
| Failed to fetch | DEPLOIEMENT_LAN.md (Dépannage) |
| Pas d'accès LAN | DEPLOIEMENT_LAN.md (Firewall) |
| Services ne démarrent pas | INSTRUCTIONS_TEST.md (Étape 1) |
| Données manquantes | db/migrations/v1.5.0_complete_setup.sql |

---

## 📖 Glossaire

| Terme | Définition | Fichier de référence |
|-------|------------|---------------------|
| **MV** | Materialized View (Vue matérialisée) | v1.5.0_complete_setup.sql |
| **LAN** | Local Area Network (Réseau local) | DEPLOIEMENT_LAN.md |
| **CORS** | Cross-Origin Resource Sharing | docker-compose.yml |
| **WGS84** | Système de coordonnées GPS (EPSG:4326) | v1.5.0_complete_setup.sql |
| **UTM** | Universal Transverse Mercator (EPSG:25231) | v1.5.0_complete_setup.sql |
| **Choroplèthe** | Carte avec aplats de couleur | INSTRUCTIONS_TEST.md |

---

## 🎓 Parcours d'Apprentissage

### Niveau 1 : Débutant (30 min)

1. `README_v1.5.0.md` - Vue d'ensemble
2. `deploy.ps1` - Déploiement automatique
3. `INSTRUCTIONS_TEST.md` - Tests de base

### Niveau 2 : Intermédiaire (1h)

1. `DEPLOIEMENT_LAN.md` - Déploiement manuel
2. `CHANGELOG_v1.5.0.md` - Comprendre les changements
3. `RESUME_V1.5.0_FINAL.md` - Architecture

### Niveau 3 : Avancé (2h)

1. `db/migrations/v1.5.0_complete_setup.sql` - SQL avancé
2. `services/api-geo/src/thematic/types.rs` - Code Rust
3. `SITUATION_FINALE.md` - Analyse technique

---

## 📞 Support

### En cas de problème

1. **Consulter** : `DEPLOIEMENT_LAN.md` (section Dépannage)
2. **Vérifier** : `INSTRUCTIONS_TEST.md` (checklist)
3. **Logs** : `docker compose logs -f`

### Pour aller plus loin

1. **Architecture** : `RESUME_V1.5.0_FINAL.md`
2. **Développement** : `CHANGELOG_v1.5.0.md`
3. **Fichiers** : `FICHIERS_v1.5.0.md`

---

## ✅ Checklist Rapide

Avant de commencer :
- [ ] J'ai lu `README_v1.5.0.md`
- [ ] J'ai Docker Desktop installé
- [ ] Je connais mon IP (ou je sais la trouver)

Pour déployer :
- [ ] J'exécute `deploy.ps1`
- [ ] Je suis `INSTRUCTIONS_TEST.md`
- [ ] Je configure le firewall si nécessaire

Pour tester :
- [ ] J'ouvre http://localhost:8080
- [ ] Je teste la carte thématique
- [ ] Je teste depuis un autre PC

---

**Version** : 1.5.0  
**Date** : 2025-10-20  
**Auteur** : Atlas Team

🎉 **Bon déploiement !**
