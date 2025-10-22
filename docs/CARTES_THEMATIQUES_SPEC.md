# 🗺️ Cartes Thématiques - Spécifications v1.5.0

**Date** : 2025-10-19  
**Statut** : Spécification

---

## 📋 Vue d'ensemble

Les **cartes thématiques** permettent de visualiser les données géotechniques selon différentes dimensions analytiques avec des styles variés.

### Objectifs

1. **Visualisation multi-paramètres** : SPT-N, qc, profondeur, densité
2. **Styles variés** : Choroplèthe, symboles, heatmap, isolignes
3. **Interactivité** : Filtres dynamiques, légendes, comparaison
4. **Export** : PNG, PDF, SVG avec légende
5. **Sauvegarde** : Configurations réutilisables

---

## 🎨 Types de Cartes

### 1. Carte Choroplèthe
- Coloration des mailles selon valeur statistique
- Paramètres : `spt_n_avg`, `qc_avg`, `n_sondages`, `depth_avg`, `data_quality`
- Palettes : Séquentielle, Divergente, Qualitative
- Classes : Quantiles, Intervalles égaux, Jenks, Personnalisé

### 2. Symboles Proportionnels
- Cercles/carrés dimensionnés selon valeur
- Taille : `n_sondages`, `n_essais`
- Couleur : Paramètre secondaire

### 3. Heatmap
- Interpolation spatiale (IDW, Kriging)
- Paramètres : `spt_n`, `qc`, `depth_max`
- Options : Rayon, résolution, lissage

### 4. Isolignes
- Lignes de niveau pour valeurs continues
- Intervalle automatique ou personnalisé

### 5. Densité de Points
- Concentration spatiale des sondages
- Méthodes : KDE, Hexbins, Grille

### 6. Carte Comparative
- Affichage côte-à-côte de 2-4 paramètres
- Modes : Split, Swipe, Grille 2x2

---

## 🛠️ Architecture Backend

### Nouveaux Endpoints

```http
GET /thematic/data
  ?parameter=spt_n_avg&bbox=...&adm1=Maritime

POST /thematic/classify
  Body: {parameter, method, n_classes}

POST /thematic/heatmap
  Body: {parameter, method, radius_m, resolution_m}

POST /thematic/configs
  Body: {name, type, parameter, config}

GET /thematic/configs
GET /thematic/configs/:id
DELETE /thematic/configs/:id

GET /thematic/export
  ?config_id=...&format=png
```

### Nouvelle Table

```sql
CREATE TABLE thematic_configs (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parameter TEXT NOT NULL,
  config JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Vue Matérialisée

```sql
CREATE MATERIALIZED VIEW mailles_stats_mv AS
SELECT
  m.id, m.code, m.geom,
  COUNT(DISTINCT s.id) AS n_sondages,
  AVG(CASE WHEN e.type = 'SPT_N' THEN e.value END) AS spt_n_avg,
  AVG(CASE WHEN e.type = 'qc' THEN e.value END) AS qc_avg,
  AVG(e.depth_m) AS depth_avg
FROM mailles m
LEFT JOIN sondages s ON ST_Within(s.geom, m.geom)
LEFT JOIN essais e ON e.sondage_id = s.id
GROUP BY m.id;
```

---

## 🎨 Frontend

### Nouveau Module

```typescript
class ThematicMapManager {
  async loadThematicMap(config: ThematicMapConfig)
  async updateFilters(filters: any)
  async changeParameter(parameter: string)
  async exportMap(format: string)
  async saveConfig(name: string)
  async loadConfig(configId: string)
}
```

### Panneau UI

- Sélection type de carte
- Sélection paramètre
- Configuration classification
- Palette de couleurs
- Filtres (région, min_sondages)
- Actions (appliquer, sauvegarder, exporter)
- Statistiques et légende

---

## 🚀 Plan d'Implémentation

### Phase 1 : Backend (3-4 jours)
1. Module `thematic.rs`
2. Endpoints `/thematic/*`
3. Classification (quantiles, equal_interval)
4. Table `thematic_configs`
5. Vue matérialisée

### Phase 2 : Frontend (4-5 jours)
1. Module `thematic-maps.ts`
2. Classe `ThematicMapManager`
3. Panneau UI
4. Carte choroplèthe
5. Légende dynamique
6. Sauvegarde/chargement

### Phase 3 : Avancé (3-4 jours)
1. Heatmap (IDW)
2. Symboles proportionnels
3. Isolignes
4. Densité
5. Mode comparaison

### Phase 4 : Polish (2-3 jours)
1. Optimisation SQL
2. Cache frontend
3. UX améliorée
4. Tests performance
5. Documentation

---

## 📈 Métriques

- Chargement < 500ms (100 mailles)
- Changement paramètre < 200ms
- Export PNG < 2s
- 5+ configs prédéfinies

---

## 🔧 Dépendances

### Backend
- `statrs` : Statistiques
- `colorgrad` : Palettes

### Frontend
- `chroma-js` : Couleurs
- `html2canvas` : Export PNG
- `file-saver` : Téléchargement
