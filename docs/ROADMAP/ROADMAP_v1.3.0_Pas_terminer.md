# 🗺️ Roadmap Atlas v1.3.0 - Interface Avancée & Analyse

**Version actuelle** : v1.2.0  
**Version cible** : v1.3.0  
**Date** : 2025-01-17  
**Statut** : 📋 En validation

---

## 📊 Vue d'ensemble

La v1.3.0 transforme Atlas en un outil d'analyse géotechnique professionnel avec :
- Interface à double panneau (Dashboard + Actions)
- Gestion CRUD complète des sondages
- Visualisations thématiques avancées
- Exports professionnels (GeoPackage, PDF, Cartes)

---

## 🎯 Objectifs Principaux

### 1. **UX/UI Professionnelle**
- ✅ Double panneau (gauche = analyse, droite = actions)
- ✅ Messages toast plus longs (5s au lieu de 3s)
- ✅ Mise en évidence des mailles plus longue (5s)
- ✅ Contours de mailles dynamiques selon le zoom
- ✅ Format d'affichage des données maille non-JSON (cards modernes)

### 2. **Gestion Avancée des Sondages**
- ✅ CRUD complet (Create, Read, Update, Delete)
- ✅ Détection des doublons (rayon 1 km)
- ✅ Historique d'édition avec export CSV
- ✅ Snapping visuel au centre de maille
- ✅ Chargement paresseux par bbox

### 3. **Analyse & Visualisation**
- ✅ Filtres par profondeur (0-5m, 5-10m, >10m)
- ✅ Filtres par type d'essai (SPT_N, qc)
- ✅ Vues thématiques (densité, SPT_N moyen, qc moyen)
- ✅ Comparaison de mailles voisines
- ✅ Cascades ADM dans les filtres

### 4. **Exports Professionnels**
- ✅ GeoPackage (mailles + sondages + essais + ADM)
- ✅ PDF automatique avec gabarit structuré
- ✅ Impression de carte (A4/A3, portrait/paysage)

---

## 📋 Tâches Détaillées

### Phase 1 : UX/UI Améliorée (Priorité HAUTE)

#### 1.1 - Ajustements des Timings ⏱️
**Fichiers** : `ui/src/main.ts`, `ui/index.html`

- [ ] **Toast duration** : 3000ms → 5000ms
  - Modifier `duration: 3000` en `duration: 5000` dans toutes les fonctions `showToast()`
  
- [ ] **Highlight duration** : 3000ms → 5000ms
  - Modifier le timeout de `highlightedMaille` dans `handleMapClick()`
  
**Temps estimé** : 10 min

---

#### 1.2 - Contours de Mailles Dynamiques 🎨
**Fichiers** : `ui/src/main.ts`

**Problème actuel** : Les contours des mailles sans données deviennent invisibles au zoom élevé.

**Solution** :
```typescript
// Ajuster l'épaisseur des contours selon le niveau de zoom
map.on('zoom', () => {
  const zoom = map.getZoom();
  const strokeWidth = zoom < 10 ? 1 : zoom < 12 ? 1.5 : 2;
  
  map.setPaintProperty('mailles-fill', 'fill-outline-width', strokeWidth);
});
```

**Critères d'acceptation** :
- Zoom < 10 : contour 1px
- Zoom 10-12 : contour 1.5px
- Zoom > 12 : contour 2px
- Contours toujours visibles même au zoom max

**Temps estimé** : 30 min

---

#### 1.3 - Double Panneau (Dashboard + Actions) 🖥️
**Fichiers** : `ui/index.html`, `ui/src/main.ts`

**Architecture** :
```
┌─────────────────────────────────────────────┐
│           Header (Logo + Titre)             │
├──────────────┬──────────────────────────────┤
│              │                              │
│   PANNEAU    │                              │
│   GAUCHE     │         CARTE                │
│  (Dashboard) │       (Mapbox GL)            │
│              │                              │
│  - Stats     │                              │
│  - Légende   │                              │
│  - Données   │                              │
│    Maille    │                              │
│              │                              │
├──────────────┴──────────────────────────────┤
│           PANNEAU DROIT (Actions)           │
│  - Édition Sondage                          │
│  - Import CSV                               │
│  - Exports                                  │
└─────────────────────────────────────────────┘
```

**Panneau Gauche (Dashboard)** :
- **Statistiques filtrées** (temps réel)
  - Mailles visibles : 29 407
  - Mailles avec données : 152
  - Sondages : 206
  - Essais : 727
  
- **Légende**
  - 🟦 Mailles avec sondages (bleu)
  - ⬜ Mailles sans sondages (transparent)
  
- **Données de la maille sélectionnée**
  - Format : Cards modernes (pas JSON)
  - Sections : Infos générales, Sondages, Essais
  - Actions rapides : Zoom, Exporter

**Panneau Droit (Actions)** :
- Bouton "✏️ Édition Sondage" (remplace "Nouveau sondage")
- Bouton "📥 Import CSV/Bulk"
- Bouton "📤 Exports"

**Critères d'acceptation** :
- Panneau gauche : largeur 320px, scrollable
- Panneau droit : drawer overlay (comme actuellement)
- Stats mises à jour en temps réel lors du filtrage
- Format d'affichage des données maille : cards avec icônes

**Temps estimé** : 3h

---

### Phase 2 : Gestion Avancée des Sondages (Priorité HAUTE)

#### 2.1 - Champ "Source" Obligatoire ⚠️
**Fichiers** : `ui/index.html`, `ui/src/main.ts`

- [ ] Ajouter `*` rouge après "Source"
- [ ] Validation côté client : `if (!source) showToast('Source obligatoire', 'error')`
- [ ] Message d'erreur explicite

**Temps estimé** : 10 min

---

#### 2.2 - Auto-remplissage "Code Sondage" 🔢
**Fichiers** : `ui/src/main.ts`

**Comportement** :
- Lors du clic sur une maille → Remplir automatiquement le code sondage
- Format : `{CODE_MAILLE}-{NUMERO}` (ex: `TG-001-001`)
- Vérifier les sondages existants pour incrémenter le numéro

```typescript
async function generateSurveyCode(mailleCode: string): Promise<string> {
  // Récupérer les sondages existants dans cette maille
  const surveys = await fetch(`/surveys?maille=${mailleCode}`).then(r => r.json());
  const nextNum = surveys.length + 1;
  return `${mailleCode}-${String(nextNum).padStart(3, '0')}`;
}
```

**Critères d'acceptation** :
- Code généré automatiquement au clic sur maille
- Incrémentation automatique (001, 002, 003...)
- Modifiable manuellement par l'utilisateur

**Temps estimé** : 45 min

---

#### 2.3 - Sélecteur d'Essais (Dropdown) 📋
**Fichiers** : `ui/index.html`, `ui/src/main.ts`

**Problème actuel** : L'utilisateur doit taper "SPT_N" ou "qc" manuellement.

**Solution** :
```html
<select id="test-type-select">
  <option value="">-- Choisir un type d'essai --</option>
  <option value="SPT_N">SPT-N (Standard Penetration Test)</option>
  <option value="qc">qc (Résistance de pointe CPT)</option>
</select>
```

**Workflow** :
1. Utilisateur clique "➕ Ajouter un essai"
2. Dropdown s'affiche avec les 2 types disponibles
3. Utilisateur sélectionne le type
4. Formulaire s'affiche : Profondeur (m) + Valeur
5. Bouton "✅ Ajouter" ajoute l'essai à la liste

**Critères d'acceptation** :
- Dropdown avec icônes pour chaque type d'essai
- Validation : type obligatoire
- Interface claire et intuitive

**Temps estimé** : 1h

---

#### 2.4 - CRUD Complet : "Édition Sondage" ✏️
**Fichiers** : `ui/index.html`, `ui/src/main.ts`, `services/api-geo/src/surveys.rs`

**Remplacer "Nouveau sondage" par "Édition Sondage"** avec 3 modes :

```
┌─────────────────────────────────────┐
│  ✏️ Édition Sondage                 │
├─────────────────────────────────────┤
│  Mode :                             │
│  ○ Ajouter un nouveau sondage       │
│  ○ Modifier un sondage existant     │
│  ○ Supprimer un sondage             │
└─────────────────────────────────────┘
```

**Mode 1 : Ajouter** (comportement actuel amélioré)
- Formulaire complet
- Auto-remplissage code sondage
- Détection doublons (rayon 1 km)
- Snapping au centre de maille

**Mode 2 : Modifier**
- Liste déroulante des sondages existants
- Chargement des données dans le formulaire
- Bouton "💾 Enregistrer les modifications"
- Historique d'édition (qui, quand, quoi)

**Mode 3 : Supprimer**
- Liste déroulante des sondages
- Confirmation avec modal
- Suppression en cascade des essais
- Log dans l'historique

**Critères d'acceptation** :
- 3 modes fonctionnels
- Historique d'édition stocké en DB
- Export CSV de l'historique
- Temps de réponse API ≤ 300ms

**Temps estimé** : 6h

---

#### 2.5 - Détection de Doublons (Rayon 1 km) 🔍
**Fichiers** : `services/api-geo/src/surveys.rs`

**Endpoint** : `GET /surveys/nearby?lat={lat}&lon={lon}&radius=1000`

```rust
#[get("/surveys/nearby")]
async fn get_nearby_surveys(
    lat: Query<f64>,
    lon: Query<f64>,
    radius: Query<f64>, // en mètres
    pool: Data<PgPool>,
) -> Result<Json<Vec<Survey>>> {
    let surveys = sqlx::query_as!(
        Survey,
        r#"
        SELECT * FROM sondages
        WHERE ST_DWithin(
            geom::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $3
        )
        ORDER BY ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
        "#,
        lon, lat, radius
    )
    .fetch_all(pool.get_ref())
    .await?;
    
    Ok(Json(surveys))
}
```

**UI** : Afficher une alerte si des sondages proches sont détectés
```
⚠️ Attention : 3 sondages trouvés dans un rayon de 1 km
- TG-001-001 (250m)
- TG-001-002 (680m)
- TG-002-001 (920m)
```

**Temps estimé** : 2h

---

#### 2.6 - Snapping Visuel au Centre de Maille 🎯
**Fichiers** : `ui/src/main.ts`

**Comportement** :
- Lors du placement d'un sondage, afficher un cercle au centre de la maille
- Aimanter automatiquement le point au centre si distance < 50m
- Animation visuelle (pulse) pour indiquer le snapping

```typescript
function snapToGridCenter(clickedPoint: [number, number], mailleCode: string): [number, number] {
  const center = getMailleCenter(mailleCode);
  const distance = turf.distance(clickedPoint, center, { units: 'meters' });
  
  if (distance < 50) {
    showToast('📍 Sondage aimanté au centre de la maille', 'info');
    return center;
  }
  
  return clickedPoint;
}
```

**Temps estimé** : 1h30

---

#### 2.7 - Chargement Paresseux par Bbox 🚀
**Fichiers** : `ui/src/main.ts`, `services/api-geo/src/surveys.rs`

**Problème** : Charger tous les sondages ralentit l'application.

**Solution** : Charger uniquement les sondages visibles dans la bbox actuelle.

```typescript
map.on('moveend', async () => {
  const bounds = map.getBounds();
  const bbox = [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth()
  ];
  
  const surveys = await fetch(`/surveys?bbox=${bbox.join(',')}`).then(r => r.json());
  updateSurveysLayer(surveys);
});
```

**Backend** :
```rust
#[get("/surveys")]
async fn get_surveys_in_bbox(
    bbox: Query<String>, // "west,south,east,north"
    pool: Data<PgPool>,
) -> Result<Json<Vec<Survey>>> {
    let coords: Vec<f64> = bbox.split(',').map(|s| s.parse().unwrap()).collect();
    
    let surveys = sqlx::query_as!(
        Survey,
        r#"
        SELECT * FROM sondages
        WHERE ST_Intersects(
            geom,
            ST_MakeEnvelope($1, $2, $3, $4, 4326)
        )
        "#,
        coords[0], coords[1], coords[2], coords[3]
    )
    .fetch_all(pool.get_ref())
    .await?;
    
    Ok(Json(surveys))
}
```

**Critères d'acceptation** :
- Chargement uniquement des sondages visibles
- Rechargement automatique lors du déplacement de la carte
- Temps de réponse ≤ 300ms en zone urbaine

**Temps estimé** : 2h

---

### Phase 3 : Analyse & Visualisation (Priorité MOYENNE)

#### 3.1 - Filtres Avancés 🔍
**Fichiers** : `ui/index.html`, `ui/src/main.ts`

**Panneau de filtres** (dans le panneau gauche) :

```html
<div id="filters-panel">
  <h3>🔍 Filtres</h3>
  
  <!-- Filtre par profondeur -->
  <div class="filter-group">
    <label>Profondeur</label>
    <select id="depth-filter" multiple>
      <option value="0-5">0-5 m</option>
      <option value="5-10">5-10 m</option>
      <option value="10+">Plus de 10 m</option>
    </select>
  </div>
  
  <!-- Filtre par type d'essai -->
  <div class="filter-group">
    <label>Type d'essai</label>
    <div class="checkbox-group">
      <label><input type="checkbox" value="SPT_N" checked> SPT-N</label>
      <label><input type="checkbox" value="qc" checked> qc</label>
    </div>
  </div>
  
  <!-- Filtre ADM (cascades) -->
  <div class="filter-group">
    <label>Région (ADM1)</label>
    <select id="adm1-filter">
      <option value="">Toutes les régions</option>
    </select>
    
    <label>Préfecture (ADM2)</label>
    <select id="adm2-filter" disabled>
      <option value="">Toutes les préfectures</option>
    </select>
    
    <label>Commune (ADM3)</label>
    <select id="adm3-filter" disabled>
      <option value="">Toutes les communes</option>
    </select>
  </div>
  
  <button id="apply-filters">Appliquer les filtres</button>
  <button id="reset-filters">Réinitialiser</button>
</div>
```

**Critères d'acceptation** :
- Filtres appliqués en temps réel (≤ 250ms)
- Cascades ADM fonctionnelles
- Stats mises à jour automatiquement
- Indicateur visuel du nombre de résultats

**Temps estimé** : 3h

---

#### 3.2 - Vues Thématiques 🎨
**Fichiers** : `ui/src/main.ts`

**Sélecteur de vue** (dans le panneau gauche) :

```html
<div id="view-selector">
  <h3>📊 Vue thématique</h3>
  <select id="thematic-view">
    <option value="default">Vue par défaut</option>
    <option value="density">Densité de sondages</option>
    <option value="spt_n_avg">SPT-N moyen</option>
    <option value="qc_avg">qc moyen</option>
  </select>
</div>
```

**Vue 1 : Densité de sondages**
- Couleur des mailles selon le nombre de sondages
- Échelle : 0 (blanc) → 10+ (bleu foncé)

**Vue 2 : SPT-N moyen**
- Couleur selon la valeur moyenne de SPT-N
- Échelle : 0-10 (vert) → 10-30 (jaune) → 30+ (rouge)

**Vue 3 : qc moyen**
- Couleur selon la valeur moyenne de qc
- Échelle : 0-2 (vert) → 2-5 (jaune) → 5+ (rouge)

**Critères d'acceptation** :
- Changement de vue sans recharger les données (≤ 250ms)
- Légende dynamique selon la vue
- Cohérence des statistiques (validation par tests)

**Temps estimé** : 4h

---

#### 3.3 - Comparaison de Mailles Voisines 🔀
**Fichiers** : `ui/index.html`, `ui/src/main.ts`

**Panneau de comparaison** (dans le panneau gauche, sous les données de la maille) :

```
┌─────────────────────────────────────┐
│  🔀 Mailles voisines                │
├─────────────────────────────────────┤
│  TG-001 (sélectionnée)              │
│  - Sondages : 5                     │
│  - SPT-N moyen : 18.5               │
│  - qc moyen : 3.2 MPa               │
├─────────────────────────────────────┤
│  TG-002 (Nord)                      │
│  - Sondages : 3                     │
│  - SPT-N moyen : 22.1               │
│  - qc moyen : 4.1 MPa               │
├─────────────────────────────────────┤
│  TG-010 (Est)                       │
│  - Sondages : 7                     │
│  - SPT-N moyen : 15.8               │
│  - qc moyen : 2.9 MPa               │
└─────────────────────────────────────┘
```

**Critères d'acceptation** :
- Affichage des 4 mailles voisines (N, S, E, O)
- Statistiques côte-à-côte
- Clic sur une maille voisine → Sélection

**Temps estimé** : 2h30

---

### Phase 4 : Exports Professionnels (Priorité MOYENNE)

#### 4.1 - Export GeoPackage 📦
**Fichiers** : `services/api-geo/src/exports.rs`

**Endpoint** : `GET /exports/geopackage?bbox={bbox}`

**Contenu du GeoPackage** :
- Layer 1 : `mailles` (polygones)
- Layer 2 : `sondages` (points)
- Layer 3 : `essais` (table attributaire liée)
- Attributs ADM (adm1_name, adm2_name, adm3_name)

**Bibliothèque** : `gdal` ou `geopackage-rs`

**Critères d'acceptation** :
- GeoPackage chargeable dans QGIS sans erreur
- Toutes les couches présentes
- Attributs ADM correctement liés

**Temps estimé** : 4h

---

#### 4.2 - Export PDF Automatique 📄
**Fichiers** : `services/api-geo/src/exports.rs`

**Endpoint** : `POST /exports/pdf`

**Gabarit PDF structuré** :
1. **Page de garde**
   - Titre du projet
   - Logo Atlas
   - Date de génération
   
2. **Contexte**
   - Zone d'étude (ADM)
   - Période des données
   - Nombre de sondages
   
3. **Carte principale**
   - Carte A4 avec échelle
   - Légende
   - Rose des vents
   
4. **Statistiques**
   - Tableau KPI
   - Graphiques (densité, SPT-N, qc)
   
5. **Annexes**
   - Liste des sondages
   - Métadonnées

**Bibliothèque** : `printpdf` ou `wkhtmltopdf`

**Critères d'acceptation** :
- PDF multi-pages généré en < 5s
- Carte et tableaux inclus
- Format professionnel

**Temps estimé** : 6h

---

#### 4.3 - Impression de Carte 🖨️
**Fichiers** : `ui/src/main.ts`

**Bouton "🖨️ Imprimer la carte"** dans le panneau droit.

**Options** :
- Format : A4 / A3
- Orientation : Portrait / Paysage
- Échelle : 1:5000 / 1:10000 / 1:25000
- Éléments : Légende, Échelle, Rose des vents, Titre

**Bibliothèque** : `mapbox-gl-print` ou custom canvas export

**Critères d'acceptation** :
- Impression haute résolution (300 DPI)
- Échelle correcte
- Légende et annotations incluses

**Temps estimé** : 3h

---

## 📊 Récapitulatif des Temps

| Phase | Tâches | Temps estimé |
|-------|--------|--------------|
| **Phase 1 : UX/UI** | 3 tâches | **3h50** |
| **Phase 2 : CRUD Sondages** | 7 tâches | **13h45** |
| **Phase 3 : Analyse** | 3 tâches | **9h30** |
| **Phase 4 : Exports** | 3 tâches | **13h** |
| **TOTAL** | **16 tâches** | **~40h** |

---

## 🎯 Critères de Validation Globaux

### Performance
- ✅ Temps de réponse API ≤ 300ms (bbox urbaine)
- ✅ Changement de vue ≤ 250ms
- ✅ Génération PDF ≤ 5s

### Qualité
- ✅ Aucune régression des fonctionnalités v1.2.0
- ✅ Tests manuels sur tous les workflows
- ✅ Validation des exports (QGIS, PDF)

### UX
- ✅ Interface intuitive et professionnelle
- ✅ Messages d'erreur explicites
- ✅ Feedback visuel sur toutes les actions

---

## 📝 Ordre d'Implémentation Recommandé

### Sprint 1 (10h) - UX de Base
1. ✅ Ajustements timings (toast, highlight)
2. ✅ Contours mailles dynamiques
3. ✅ Double panneau (Dashboard + Actions)
4. ✅ Champ source obligatoire
5. ✅ Auto-remplissage code sondage

### Sprint 2 (12h) - CRUD Avancé
6. ✅ Sélecteur d'essais (dropdown)
7. ✅ Mode "Édition Sondage" (3 modes)
8. ✅ Détection doublons
9. ✅ Snapping visuel

### Sprint 3 (8h) - Analyse
10. ✅ Filtres avancés + cascades ADM
11. ✅ Chargement paresseux bbox
12. ✅ Vues thématiques

### Sprint 4 (10h) - Exports
13. ✅ Comparaison mailles voisines
14. ✅ Export GeoPackage
15. ✅ Export PDF
16. ✅ Impression carte

---

## 🚀 Prochaines Étapes

1. **Validation de cette roadmap** par l'utilisateur
2. **Démarrage Sprint 1** après validation
3. **Tests continus** à chaque phase
4. **Release v1.3.0** après validation finale

---

## 📌 Notes Importantes

### Dépendances Techniques
- **Backend** : Rust + Actix-web + SQLx + PostGIS
- **Frontend** : TypeScript + Mapbox GL JS + Vanilla JS
- **Exports** : GDAL (GeoPackage), printpdf (PDF)

### Données Requises
- ✅ Tables ADM (adm1_tg, adm2_tg, adm3_tg) déjà importées
- ✅ Table mailles existante
- ✅ Tables sondages + essais existantes

### Points d'Attention
- **Performance** : Optimiser les requêtes spatiales (index GIST)
- **UX** : Tester sur différentes résolutions d'écran
- **Exports** : Valider la compatibilité QGIS

---

**Prêt pour validation ! 🎯**

Une fois validée, je commence l'implémentation sprint par sprint.
