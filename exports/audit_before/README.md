# Audit Export Atlas - BEFORE FIX

## Date/Heure
27/12/2025 13:07 UTC+00:00

## Objectif
Capturer l'état AVANT corrections pour les 5 régions ADM1 du Togo avec le KPI `ip_avg` (Indice de Plasticité moyen).

## Configuration Export

### Paramètres UI
- **Niveau**: ADM1 (Régions)
- **Thématique**: `ip_avg` (Indice de Plasticité moyen)
- **Qualité**: HD (300 DPI)
- **Format**: PNG
- **Masque**: Context (masque hors ADM avec bordure)
- **Options**:
  - Statistiques: OUI
  - Voisins: OUI
  - Mailles vides: OUI
  - Grille: Cross
  - Cadre: Double

### Zones Testées
1. **Centrale** (référence OK)
2. **Kara** (référence OK)
3. **Maritime** (problème: trop d'espace vide)
4. **Plateaux** (problème: trop d'espace vide, forme verticale)
5. **Savanes** (problème: trop d'espace vide)

## Procédure de Reproduction

### Méthode 1: Export Atlas Complet (UI)
1. Ouvrir Atlas Géotechnique UI (http://localhost:5173)
2. Cliquer sur bouton "📚 Export Atlas" dans la barre supérieure
3. Configurer:
   - Niveaux: Cocher uniquement "ADM1"
   - Thématiques: Décocher toutes SAUF "ip_avg"
   - Qualité: HD
   - Masque: Context
   - Options: Tout cocher
4. Cliquer "🚀 Lancer l'export"
5. Attendre fin export (50 cartes = 5 zones × 10 thématiques)
6. Extraire du ZIP les 5 images `{zone}/ip_avg.png`

### Méthode 2: Export Rapide (UI - recommandé pour debug)
1. Ouvrir Atlas Géotechnique UI
2. Sélectionner filtre ADM1 dans panneau gauche (ex: "Centrale")
3. Sélectionner thématique "ip_avg" dans panneau thématique
4. Cliquer "Appliquer"
5. Cliquer bouton "📸 Export Rapide" dans panneau droit
6. Configurer qualité HD, masque Context
7. Cliquer "Exporter"
8. Répéter pour les 5 zones

### Méthode 3: Mode Debug (Code)
```typescript
// Dans export-atlas-dialog.ts, activer debugMode
config.debugMode = true
config.levels = { adm1: true, adm2: false, adm3: false }
config.thematics = ['ip_avg']
config.selectedAdms = { 
  adm1: ['Centrale', 'Kara', 'Maritime', 'Plateaux', 'Savanes'],
  adm2: [], 
  adm3: [] 
}
```

## Problèmes Observés (Logs)

### Centrale (OK - référence)
```
[Export][Bounds] portrait shrink=0.987 clear_min=16.8px occ_area=96.2%
[Export][Bounds] FINAL pad_max=1.2%
```

### Kara (OK - référence)
```
[Export][Bounds] portrait shrink=0.982 clear_min=17.1px occ_area=95.8%
[Export][Bounds] FINAL pad_max=1.5%
```

### Maritime (KO - trop d'espace)
```
[Export][Bounds] landscape shrink=0.999 clear_min=50.0px occ_area=41.5%
[Export][Bounds] FINAL pad_max=28.9%
[Export][Bounds] ⚠️ Limite atteinte: impossible de serrer plus
```

### Plateaux (KO - trop d'espace, forme verticale)
```
[Export][Bounds] portrait shrink=0.999 clear_min=50.0px occ_area=96.0%
[Export][Bounds] FINAL pad_max=17.3% (marges latérales)
[Export][Bounds] ⚠️ Limite atteinte: forme oblique/allongée
```

### Savanes (KO - trop d'espace)
```
[Export][Bounds] portrait shrink=0.999 clear_min=50.0px occ_area=94.2%
[Export][Bounds] FINAL pad_max=15.8%
```

## Symptômes Visuels

- **Maritime**: Région horizontale, beaucoup d'espace blanc en haut/bas
- **Plateaux**: Région verticale, beaucoup d'espace blanc gauche/droite
- **Savanes**: Région irrégulière, espace blanc non équilibré

## Hypothèses Root Cause

1. **Clearance constante (50px)**: Géométrie ADM non extraite depuis Leaflet → fallback 50px
2. **Shrink=0.999**: Optimisation ne converge pas car clearance fausse
3. **Orientation fixe**: Pas de rééquilibrage des marges après fitBounds
4. **Pas de pan/center**: Région non centrée dans le frame après zoom

## Fichiers Concernés

- `ui/src/export/bounds-optimizer.ts` - Algorithme optimisation
- `ui/src/export/export-quick-dialog.ts` - Extraction géométrie ADM
- `ui/src/export/capture-utils.ts` - Capture Leaflet
- `ui/src/thematic/thematic-maps.ts` - Gestion layers ADM

## Prochaines Étapes

1. Fix extraction géométrie ADM depuis Leaflet (Polygon/MultiPolygon)
2. Fix bounds optimizer pour vraie convergence
3. Ajouter pan/center optimization
4. Stabiliser capture Leaflet
5. Générer exports AFTER et comparer
