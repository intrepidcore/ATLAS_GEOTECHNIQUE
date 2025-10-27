# Proposition UI : Panneau Gauche Complet

## 📊 Comparaison Visuelle

### ACTUEL (v1.6.0)
```
┌─────────────────────┐
│ KPIs (4)            │
│ Charts (3)          │
│ Sondages (liste)    │
└─────────────────────┘
```
**Limites**: Pas de détails essais, pas de granulo, pas de classification

### PROPOSÉ (v2.0)
```
┌─────────────────────┐
│ KPIs (6)            │
│ ┌─────────────────┐ │
│ │📊│🔬│📋│📈│     │ │ ← ONGLETS
│ └─────────────────┘ │
│                     │
│ ONGLET 📊 VUE       │
│ • Charts (5)        │
│ • Stats agrégées    │
│                     │
│ ONGLET 🔬 ESSAIS    │
│ • Par échantillon   │
│ • Tous les détails  │
│ • Filtres           │
│                     │
│ ONGLET 📋 SONDAGES  │
│ • Liste complète    │
│ • Actions           │
└─────────────────────┘
```

## 🎯 Données Affichées

### Onglet 1: 📊 Vue d'Ensemble
- Charts: Atterberg, VBS, Granulo, Depth, Proctor
- Stats: Moyennes, écarts-types, min/max
- Classification dominante

### Onglet 2: 🔬 Essais Détaillés
**Par échantillon** (accordéon):
- **Granulo**: Passants, D10/D30/D60, Cu, Cc, courbe
- **Atterberg**: WL, WP, IP, plasticité
- **VBS**: Valeur, argilosité
- **Proctor**: γd max, wopt, courbe
- **Gonflement**: Eg, risque
- **Classification**: HRB, USCS, GTR + descriptions

### Onglet 3: 📋 Sondages
- Métadonnées complètes
- Liste échantillons
- Comptage essais par type
- Actions: Détails, Modifier, Localiser, Supprimer

## 🔧 Implémentation

### Backend: Nouveau endpoint `/cells/{code}/complete`
Retourne: cell, stats, echantillons[], sondages[], charts

### Frontend: Composant `PanneauComplet`
- Système d'onglets
- Accordéons pour échantillons
- Graphiques conditionnels
- Filtres et recherche
- Export CSV/PDF

## 📦 Livrables

1. SQL: `api_panel_complete.sql`
2. Rust: Route `/cells/{code}/complete`
3. TypeScript: `panneau-complet.ts`
4. CSS: Styles onglets + accordéons
5. Tests: Vérification données complètes

Voulez-vous que j'implémente cette proposition ?
