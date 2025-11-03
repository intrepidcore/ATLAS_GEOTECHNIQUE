# 🗺️ Atlas Géotechnique - v2.0.0

## 🎯 Nouveautés v2.0

### Panneau Gauche - Vue Pro avec Onglets

Le panneau gauche affiche maintenant toutes les données géotechniques d'une maille via 4 onglets :

#### 📊 Onglet "Vue d'ensemble"
- Graphiques Atterberg (WL, WP)
- Graphique VBS
- Graphique Granulométrie
- Histogramme des profondeurs

#### 🔬 Onglet "Essais détaillés"
- Accordéons par échantillon (par profondeur)
- Pour chaque échantillon :
  - **Atterberg**: WL, WP, IP, zone Casagrande, plasticité
  - **VBS**: Valeur, argilosité
  - **Granulométrie**: Passants (80µm, 2mm, 20mm), indices (D10, D30, D60, Cu, Cc), courbe
  - **Proctor**: γd max, wopt, type
  - **Gonflement**: Eg, risque
  - **Classifications**: USCS, AASHTO, GTR
- Boutons "Déployer tout" / "Replier tout"

#### 📋 Onglet "Sondages"
- Liste des sondages de la maille
- Badges GPS/Spread
- Nombre d'échantillons et d'essais
- Section "Sondages sources" pour les mailles spread-only

#### 🏷️ Onglet "Classification"
- Répartition des classifications USCS
- Répartition des classifications AASHTO
- Statistiques par classe

### KPIs Enrichis

4 KPIs au lieu de 2 :
- **Sondages**: Nombre de sondages dans la maille
- **Échantillons**: Nombre d'échantillons
- **Essais**: Nombre total d'essais
- **% Spread**: Pourcentage de diffusion (0% = données réelles, 100% = diffusé)

### Alerte Spread

Si une maille a 100% de diffusion (spread), une alerte affiche le sondage source.

### Backend Enrichi

#### Nouvelles Fonctions SQL

1. **`fn_granulo_indices(points JSONB)`**
   - Calcule D10, D30, D60, Cu, Cc depuis une courbe granulométrique
   - Méthode: Interpolation log-linéaire

2. **`fn_classify_uscs(...)`**
   - Classification USCS automatique
   - Classes: ML, CL, CH, MH, SW, SP, SM, SC

3. **`fn_classify_aashto(...)`**
   - Classification AASHTO/HRB automatique
   - Classes: A-1 à A-7

4. **Vue `v_samples_complete`**
   - Vue complète avec tous les essais et classifications
   - Données structurées en JSONB

#### Nouvel Endpoint API

**`GET /cells/{code}/complete`**

Retourne toutes les données d'une maille :
```json
{
  "kpi": {
    "n_sondages": 1,
    "n_echantillons": 3,
    "n_essais": 21,
    "pct_spread": 0.0,
    "depth_max_m": 2.0,
    "updated_at": "2025-10-27T..."
  },
  "overview": {
    "atterberg": [...],
    "vbs": [...],
    "granulo": [...],
    "depth_hist": [...]
  },
  "samples": [
    {
      "id": "uuid",
      "depth_m": 1.0,
      "atterberg": {...},
      "vbs": {...},
      "granulo": {...},
      "proctor": {...},
      "swelling": {...},
      "classif": {...}
    }
  ],
  "surveys": [...],
  "source_surveys": [...]
}
```

---

## 🚀 Démarrage

### Prérequis
- Docker & Docker Compose
- Node.js 18+ (pour le développement UI)

### Lancement
```powershell
# Démarrer tous les services
docker compose up -d

# Vérifier les logs
docker compose logs -f
```

### Accès
- **UI**: http://localhost:3000
- **API**: http://localhost:8000

---

## 🧪 Tests

### Tester l'endpoint `/complete`
```powershell
# Script de test complet
.\test_complete_endpoint.ps1

# Test manuel
Invoke-RestMethod http://localhost:8000/cells/TG-0703-0236-01/complete
```

### Tester l'UI
1. Ouvrir http://localhost:3000
2. Cliquer sur une maille avec données
3. Vérifier les 4 onglets
4. Vérifier les KPIs
5. Vérifier l'alerte Spread (si applicable)

---

## 🔧 Développement

### Rebuild API
```powershell
docker compose build api-geo
docker compose up -d api-geo
```

### Rebuild UI
```powershell
cd ui
npm run build
cd ..
```

### Appliquer les fonctions SQL
```powershell
docker cp sql/fn_granulo_indices.sql atlas-db:/tmp/
docker compose exec -T db psql -U atlas -d atlas -f /tmp/fn_granulo_indices.sql

docker cp sql/fn_classify_uscs.sql atlas-db:/tmp/
docker compose exec -T db psql -U atlas -d atlas -f /tmp/fn_classify_uscs.sql

docker cp sql/fn_classify_aashto.sql atlas-db:/tmp/
docker compose exec -T db psql -U atlas -d atlas -f /tmp/fn_classify_aashto.sql

docker cp sql/v_samples_complete.sql atlas-db:/tmp/
docker compose exec -T db psql -U atlas -d atlas -f /tmp/v_samples_complete.sql
```

---

## 📁 Structure du Projet

```
atlas/
├── sql/
│   ├── fn_granulo_indices.sql      # Calcul D10, D30, D60, Cu, Cc
│   ├── fn_classify_uscs.sql        # Classification USCS
│   ├── fn_classify_aashto.sql      # Classification AASHTO
│   └── v_samples_complete.sql      # Vue complète
├── services/
│   └── api-geo/
│       └── src/
│           ├── cells_labs.rs       # Endpoint /complete
│           └── main.rs             # Routes
├── ui/
│   ├── index.html                  # UI avec onglets
│   └── src/
│       ├── main.ts                 # Logique onglets
│       └── version.ts              # v2.0.0
├── test_complete_endpoint.ps1      # Script de test
├── RECAPITULATIF_FINAL.md          # Documentation complète
└── README_V2.md                    # Ce fichier
```

---

## 📚 Documentation

- **`RECAPITULATIF_FINAL.md`**: Documentation technique complète
- **`IMPLEMENTATION_V2_RECAPITULATIF.md`**: Guide d'implémentation détaillé
- **`test_complete_endpoint.ps1`**: Script de test avec exemples

---

## 🐛 Dépannage

### L'endpoint /complete retourne une erreur 404
```powershell
# Vérifier que l'API est démarrée
docker compose ps api-geo

# Vérifier les logs
docker compose logs api-geo --tail 50

# Rebuild si nécessaire
docker compose build api-geo
docker compose up -d api-geo
```

### Les onglets ne s'affichent pas
```powershell
# Vérifier que l'UI est buildée
cd ui
npm run build
cd ..

# Vider le cache du navigateur
# Ctrl+Shift+R (Chrome/Edge)
```

### Les fonctions SQL n'existent pas
```powershell
# Réappliquer les fonctions
docker cp sql/fn_granulo_indices.sql atlas-db:/tmp/
docker compose exec -T db psql -U atlas -d atlas -f /tmp/fn_granulo_indices.sql
# Répéter pour les autres fonctions
```

---

## 🎯 Prochaines Étapes (Phase 2)

### Suggestions de Géocodage
- Radio buttons par candidat
- Bouton "Accepter & diffuser"
- Prévisualisation ADM3
- Actions groupées

### Modale Géocodage
- 4 onglets (Coordonnées, ADM3, Grille, Clic carte)
- Mode pick sur carte
- Validation et preview

### Panneau Droit
- Accordéons pour filtres
- Filtres Essais et Temporels
- Recherche unifiée
- Configurateur d'export

---

## 📞 Support

Pour toute question ou problème :
1. Consulter `RECAPITULATIF_FINAL.md`
2. Vérifier les logs Docker
3. Tester avec `test_complete_endpoint.ps1`

---

**Version**: v2.0.0  
**Date**: 27 octobre 2025  
**Statut**: ✅ Production Ready
