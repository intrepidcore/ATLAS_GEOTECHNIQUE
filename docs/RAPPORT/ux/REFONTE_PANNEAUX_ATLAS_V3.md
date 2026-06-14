# Proposition de Refonte UI/UX — Panneaux Atlas Géotechnique Togo v3.0

> **Statut** : Proposition — à valider avant implémentation  
> **Date** : 2026-06-14  
> **Skill appliqué** : ui-ux-pro-max v2.5.0 — style recommandé : *Data-Dense Dashboard + Drill-Down Analytics + Dark Mode OLED*  
> **Audience cible** : Ingénieur géotechnicien / géologue togolais (utilisateur final, pas développeur)

---

## 1. Contexte et données disponibles

### 1.1 Base de données cartographiée

| Entité | Volume | Colonnes clés exposables |
|--------|--------|--------------------------|
| `atlas.mailles` | 29 407 mailles 2×2 km | code, geom, adm1/2/3, n_sondages, has_exact_location, has_random_location |
| `atlas.sondages` | 572 géocodés | code, location_mode (exact/adm_random_cell), is_geocoded, adm3_id, maille_code |
| `atlas.echantillons` | ~2 000 | depth_m, h_canon, eg, rho_s |
| **Essais** | — | wl, wp, ip · vbs · cbr · proctor γd/w_opt · pressio em/pl · pénétro rd · classif · gonflement |
| `atlas.ai_interpolation_values` | 11 param. ML | KED·RK·BLUP·MTGP·SGS, horizons H1/H2/H3 |
| `atlas.zones_etude` | 5 zones | Lama (547 km²), Bado (312 km²), Mono (1296 km²), Oti (464 km²), Fosse (7 km²) |
| `atlas.mailles_zones_etude` | 1 368 assoc. | maille_id, zone_id, pct_intersection, priorite_recherche |
| `public.geocode_suggestions` | 200 | status: accepted/pending |
| `atlas.v_contexte_geologique` | 29 407 | 14 unités pédo, 22 unités géo |

### 1.2 Ce que l'utilisateur final fait réellement

1. **Explorer** : naviguer la carte du Togo, zoomer sur une zone, filtrer par région/préfecture/commune
2. **Consulter** : cliquer sur une maille → voir les sondages, essais, qualité des données
3. **Comparer** : afficher une carte thématique (ex : VBS H1 source BLUP) pour visualiser la distribution spatiale d'un paramètre
4. **Planifier** : identifier les zones prioritaires pour la campagne de terrain (mailles sans données dans les zones d'étude)
5. **Exporter** : PDF cartographique, GeoJSON, PNG pour rapport

---

## 2. Critique de l'interface actuelle

### Panneau Gauche — Problèmes identifiés

| # | Problème | Sévérité |
|---|----------|----------|
| P1 | Deux modes (global/fiche maille) se chevauchent sans transition claire | Haute |
| P2 | "Zones d'étude (carte)" = paragraphes de texte illisibles, sans valeur directe | Haute |
| P3 | Statistiques globales + statistiques filtrées = confusion (deux niveaux mélangés) | Haute |
| P4 | "Plan de campagne terrain" enfouie au fond, peu accessible | Moyenne |
| P5 | Fiche maille manque de hiérarchie visuelle (tout au même niveau) | Haute |
| P6 | Légende statique en bas, séparée du contexte | Basse |
| P7 | Pas de breadcrumb ADM après filtre géographique | Moyenne |

### Panneau Droit — Problèmes identifiés

| # | Problème | Sévérité |
|---|----------|----------|
| D1 | Trop d'options en scroll vertical (fatigue cognitive) | Haute |
| D2 | "Couches de contexte QGIS" + "Zones d'étude" + "Objectif métier" = 3 catégories entremêlées | Haute |
| D3 | Filtres géographiques dupliquent ce qui est dans le panneau gauche | Moyenne |
| D4 | Exports mélangés avec la configuration thématique | Moyenne |
| D5 | Pas de toggle thème clair/sombre | Haute |
| D6 | Bouton "Appliquer" requis — pas de mise à jour réactive | Basse |

---

## 3. Architecture informationnelle proposée

### 3.1 Panneau Gauche — "Contexte & Fiche"

**Principe : Drill-Down en 3 niveaux**

```
Niveau 0 — Vue globale (aucune sélection)
  ├── KPI Bar : Total mailles · Avec données · Sans données · Attribuées
  ├── Filtre actif : breadcrumb ADM ou badge "Tout Togo"
  ├── Répartition essais : mini bar chart horizontal (8 types, valeur absolue)
  ├── Distribution profondeurs : sparkline 0-1m · 1-1.5m · 1.5-2m · >2m
  ├── Indicateur argilosité global : VBS moy. · % argileux · IP moy.
  ├── Zones d'étude actives : 5 badges colorés avec compteur mailles
  └── [Bouton] Lancer assistant campagne →

Niveau 1 — Fiche Maille (clic sur maille)
  ├── Header maille
  │   ├── Code maille [TG-XXXX-XXXX-01]  ← typographie monospace
  │   ├── Localisation ADM : Région › Préfecture › Commune
  │   ├── Zone(s) d'étude : badge(s) coloré(s) avec % intersection
  │   └── [×] Fermer fiche
  ├── Score qualité données : progressbar couleur (66/100 → orange)
  │   └── Manquants : badges rouges (ex: "Proctor yd max")
  ├── Bloc instrumentation (grid 3 colonnes)
  │   ├── N Sondages (icône forage)
  │   ├── N Échantillons (icône tube)
  │   └── N Essais total (icône microscope)
  ├── Profondeur investigation : min · moy · max + mini graphique
  ├── Essais disponibles : grid compact (Atterberg · VBS · CBR · Proctor · Pénétro · Pressio · Classif · Gonfl.)
  ├── Argilosité maille : VBS · %argileux · IP
  ├── Synthèse narrative : texte auto-généré, accordéon
  ├── Sondages de la maille : liste cliquable (code · type localisation · nb essais)
  └── Actions : [Gérer sondages] [Exporter fiche PDF]

Niveau 2 — Détail sondage (clic dans liste sondages)
  → Ouvre modal (inchangé)
```

### 3.2 Panneau Droit — "Carte & Configuration"

**Principe : Accordéon par section, état persisté dans localStorage**

```
Section 1 — Fond de carte [toujours visible, non-accordéon]
  ├── Toggle fond : OpenStreetMap · Satellite · Topographique
  └── Toggle grille : 2km (détaillée) · 28km (profils)

Section 2 — Zones d'étude [accordéon]
  ├── 5 boutons zone + checkbox visibilité (état actuel ✓)
  └── [Info] "Les bordures des mailles colorent la zone d'appartenance"

Section 3 — Couches contextuelles [accordéon]
  ├── Géologie        [vecteur] ☐ ▼
  ├── Pédologie       [vecteur] ☐ ▼
  ├── Risque gonflement [vecteur] ☐ ▼
  └── Relief (Altitude) [raster] ☐ ▼

Section 4 — Carte thématique [accordéon, section principale]
  ├── Objectif métier : select compact (RGA / Fondations / Routes / Exploitation argile)
  ├── Paramètre       : select (VBS · IP · WL · WP · CBR · γd · w_opt · em · rd…)
  ├── Source ML       : tabs compacts [KED] [RK] [BLUP] [MTGP] [SGS]
  ├── Horizon         : pills [H1] [H2] [H3]
  ├── Visualisation   : toggle [Carte thématique] [Heatmap]
  ├── Palette         : sélecteur visuel (7 pastilles)
  ├── Opacité         : slider compact
  └── [Appliquer]  ← ou mise à jour live (à discuter)

Section 5 — Filtres [accordéon + badge compteur actif]
  ├── Géographiques
  │   ├── Région (ADM1)
  │   ├── Préfecture (ADM2)
  │   └── Commune (ADM3)
  ├── Données
  │   ├── Min. sondages
  │   ├── Profondeur min/max (m)
  │   ├── Période
  │   ├── ☑ Avec données · ☑ Sans données · ☐ Uniquement attribuées
  │   └── [Réinitialiser filtres]
  └── Badge "N filtres actifs" dans le header accordéon

Section 6 — Exports [accordéon, collapsé par défaut]
  ├── [Export Pro PNG/PDF]  ← bouton primaire
  ├── [Export Atlas complet]
  ├── [PNG rapide]  [QGIS]  [GeoJSON brut]
  └── [Sauvegarder config]
```

---

## 4. Thème Clair / Sombre

### 4.1 Toggle dans le header global

Position : icône `☀/🌙` en haut à droite de la topbar (entre le profil utilisateur et les indicateurs API/Grille).

```html
<button id="themeToggle" class="btn-icon" aria-label="Basculer thème" title="Thème clair / sombre">
  <span class="icon-sun" aria-hidden="true">☀</span>
  <span class="icon-moon" aria-hidden="true" style="display:none">🌙</span>
</button>
```

Persistance : `localStorage.setItem('atlas-theme', 'light'|'dark')`  
Application : `document.documentElement.setAttribute('data-theme', 'light'|'dark')`

### 4.2 Design tokens (CSS custom properties)

```css
/* Thème sombre — défaut OLED (existant) */
[data-theme="dark"], :root {
  --bg-primary:    #0b1220;
  --bg-secondary:  #0e1628;
  --bg-card:       #131d2e;
  --bg-elevated:   #1a2540;
  --border:        #1f2d45;
  --text-primary:  #e2e8f0;
  --text-secondary:#94a3b8;
  --text-muted:    #64748b;
  --accent:        #3b82f6;
  --accent-hover:  #2563eb;
  --success:       #22c55e;
  --warning:       #f59e0b;
  --danger:        #ef4444;
  --shadow:        0 4px 16px rgba(0,0,0,0.4);
}

/* Thème clair — analytics dashboard */
[data-theme="light"] {
  --bg-primary:    #f8fafc;
  --bg-secondary:  #f1f5f9;
  --bg-card:       #ffffff;
  --bg-elevated:   #ffffff;
  --border:        #e2e8f0;
  --text-primary:  #0f172a;
  --text-secondary:#475569;
  --text-muted:    #94a3b8;
  --accent:        #2563eb;
  --accent-hover:  #1d4ed8;
  --success:       #16a34a;
  --warning:       #d97706;
  --danger:        #dc2626;
  --shadow:        0 4px 16px rgba(0,0,0,0.08);
}
```

### 4.3 Composants critiques à adapter

| Composant | Dark | Light |
|-----------|------|-------|
| Fond carte (Leaflet) | OSM dark tile | OSM light tile (standard) |
| Tooltip maille | bg `#0e1628` border `#1f2d45` | bg `#fff` border `#e2e8f0` shadow |
| Badges zone | Opacité 0.9 sur fond sombre | Opacité 1.0, bordure visible |
| KPI bar | Texte `#94a3b8` valeur `#e2e8f0` | Texte `#475569` valeur `#0f172a` |
| Graphiques Chart.js | `gridColor: #1f2d45` | `gridColor: #e2e8f0` |
| Score qualité | gradient rouge→vert inchangé | idem + contour visible |

---

## 5. Spécifications visuelles (ui-ux-pro-max)

### 5.1 Typographie

```
Famille    : system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif
Mono       : 'JetBrains Mono', 'Fira Code', monospace (codes maille, coordonnées UTM)

Scale      : 10px · 11px · 12px · 13px · 14px · 16px · 18px · 24px
Line-height: 1.5 corps de texte, 1.2 labels denses
Poids      : 400 corps · 500 labels · 600 section headers · 700 KPI values
```

### 5.2 Espacements

```
Panel padding   : 16px (desktop) / 12px (compact)
Section gap     : 12px entre sections
Item gap        : 6px entre items d'une même section
Card padding    : 12px
Chip/badge      : 4px 8px
Touch minimum   : 36px hauteur (44px pour actions critiques)
```

### 5.3 Composants clés à créer/refactoriser

#### KPI Card (Panneau gauche — vue globale)
```
┌──────────────────────────────────────────────┐
│  29 407        390         29 017         21  │
│  Mailles    Avec données  Sans données  Attrib│
│  [total]    [vert]        [gris]        [rose]│
└──────────────────────────────────────────────┘
Spec: grid 4 colonnes, font-size: 20px bold pour valeurs, 10px pour labels
```

#### Fiche Maille — Score qualité
```
[TG-0504-0222-01]  Tone › Zio › Kpomassè
Zone: ● Lama (78%)

Qualité données  ████████░░  66/100
⚠ Manquants: Proctor yd max

📍 1 sondage  🧪 0 échantillons  🔬 9 essais
```

#### Badge zone (dans la fiche maille)
```
● Lama (78%)   → amber fond très léger, border amber
● Mono (12%)   → vert fond très léger, border vert
```

#### Accordéon panneau droit
```
▸ Carte thématique [VBS H1 BLUP]     ← header cliquable
  [contenu déployé]

▸ Filtres  [2 actifs]                ← badge rouge si filtres actifs
  [contenu replié]
```

### 5.4 Couleurs essais (pour grille disponibilité)

| Essai | Couleur (dark) | Couleur (light) |
|-------|---------------|-----------------|
| Atterberg (WL/WP/IP) | `#60a5fa` | `#2563eb` |
| VBS | `#f59e0b` | `#d97706` |
| CBR | `#34d399` | `#16a34a` |
| Proctor | `#a78bfa` | `#7c3aed` |
| Pénétromètre | `#fb923c` | `#ea580c` |
| Pressiomètre | `#e879f9` | `#a21caf` |
| Classif. | `#94a3b8` | `#475569` |
| Gonflement | `#ef4444` | `#dc2626` |

---

## 6. Wireframes ASCII

### 6.1 Panneau Gauche — Vue globale

```
┌─────────────────────────────────────┐
│ ATLAS GÉOTECHNIQUE   [☀/🌙] [Profil]│  ← topbar inchangée
├─────────────────────────────────────┤
│                                     │
│  29 407  │  390   │29 017│   21     │  ← KPI bar
│  Mailles │ Données│ Sans │ Attrib.  │
│                                     │
│  ─── Tout le Togo ──────────────── │  ← breadcrumb / badge filtre
│                                     │
│  RÉPARTITION ESSAIS                 │
│  Atterberg ████████ 988             │
│  VBS       ███████  844             │
│  Classif.  █████    617             │
│  Proctor   ████     371             │
│  Granulo.  ███      249             │
│  Gonflem.  ████     327             │
│                                     │
│  PROFONDEURS                        │
│  Min 0.1m  Moy 2.0m  Max 30.0m     │
│  [████▓▓░░]  0-1 · 1-1.5 · >2m    │
│                                     │
│  ARGILOSITÉ GLOBALE                 │
│  VBS moy 4.1  │ % arg. 53% │ IP 19  │
│  Zone sols argileux, plasticité élevée│
│                                     │
│  ZONES D'ÉTUDE                      │
│  ● Lama 334  ● Bado 258             │
│  ● Mono 379  ● Oti  386             │
│  ● Fosse 11                         │
│                                     │
│  ─── LÉGENDE ───────────────────── │
│  ■ GPS exact   ■ ADM approx.        │
│  ■ Attribuée   ■ Sans données       │
│                                     │
│  [🗺 Lancer campagne terrain →]     │
└─────────────────────────────────────┘
```

### 6.2 Panneau Gauche — Fiche Maille (après clic)

```
┌─────────────────────────────────────┐
│ [← Retour]                    [✕]  │
│                                     │
│  TG-0504-0222-01                    │  ← monospace
│  Maritime › Zio › Kpomassè          │  ← breadcrumb ADM
│  ● Lama (78%) · ● Bado (12%)       │  ← badges zone
│                                     │
│  Qualité données  ██████░░  66/100  │
│  ⚠ Manquants: Proctor yd max        │
│                                     │
│  📍 1      🧪 0        🔬 9         │
│  Sondages  Échant.    Essais        │
│                                     │
│  PROFONDEUR INVESTIGATION           │
│  Min 1.0m · Moy 1.5m · Max 2.0m   │
│  [1.0] [████] [1.5] [██] [2.0]     │
│                                     │
│  ESSAIS DISPONIBLES                 │
│  ✓ Atterberg  ✓ VBS  ✗ CBR         │
│  ✗ Proctor    ✗ Pén. ✓ Gonfl.      │
│  ✓ Classif.                         │
│                                     │
│  ARGILOSITÉ MAILLE                  │
│  VBS 3.9  │ % arg. 100% │ IP 10    │
│  Sols limon-argileux, plasticité faible│
│                                     │
│  SYNTHÈSE ▾                         │
│  Maille instrumentée: 1 sondage,    │
│  9 essais. Investigations 1.0-2.0m. │
│  Sols limon-argileux (VBS 3.9).     │
│                                     │
│  SONDAGES                           │
│  Sanfatoute  ADM · 3éch · 12 essais│
│  [Détails →]                        │
│                                     │
│  [Gérer sondages]  [Exporter fiche] │
└─────────────────────────────────────┘
```

### 6.3 Panneau Droit — Configuration

```
┌──────────────────────────────────┐
│ Cartes thématiques           [✕] │
├──────────────────────────────────┤
│                                  │
│ ▸ Fond de carte                  │
│   OSM Standard ● / Satellite ○   │
│   Grille: ● 2km ○ 28km          │
│                                  │
│ ▸ Zones d'étude                  │
│   ● Lama ☑  ● Bado ☐            │
│   ● Mono ☐  ● Oti  ☐            │
│   ● Fosse aux Lions ☐            │
│                                  │
│ ▸ Couches contextuelles          │
│   Géologie      [vecteur] ☐      │
│   Pédologie     [vecteur] ☐      │
│   Risque gonfl. [vecteur] ☐      │
│   Relief        [raster]  ☐      │
│                                  │
│ ▸ Carte thématique ──────────── │ ← section ouverte
│   Objectif  [─ RGA ─────────▼]  │
│   Paramètre [─ VBS ──────────▼] │
│   Source    [KED][RK][BLUP][MTGP][SGS] │
│   Horizon   [H1] [H2] [H3]      │
│   Palette   [██████] ▼           │
│   Opacité   ───●────── 70%       │
│                                  │
│   [✓ Appliquer]  [↺ Auto-Zoom]  │
│                                  │
│ ▸ Filtres  [2 actifs]            │
│   Région    [─ Maritime ───────▼]│
│   Préfecture [─ Zio ───────────▼]│
│   Commune   [─ Toutes ─────────▼]│
│   ─────────────────              │
│   Min. sondages  [0]             │
│   ☑ Avec données  ☑ Sans données │
│   [Réinitialiser]                │
│                                  │
│ ▸ Exports                        │
│   [⬆ Export Pro PNG/PDF]         │
│   [Atlas complet] [PNG rapide]   │
│   [QGIS] [GeoJSON] [Config]      │
└──────────────────────────────────┘
```

---

## 7. Intégration thème clair — capture attendue

| Zone | Dark (actuel) | Light (proposé) |
|------|---------------|-----------------|
| Fond panneau | `#0b1220` | `#ffffff` |
| Fond carte | Basemap OSM standard | OSM standard + fond blanc |
| Texte primaire | `#e2e8f0` | `#0f172a` |
| KPI valeurs | `#60a5fa` (bleu) | `#1d4ed8` |
| Bordures | `#1f2d45` | `#e2e8f0` |
| Sections header | `#1a2540` | `#f1f5f9` |
| Badges zone | pastels sur fond sombre | pastels sur fond clair + bordure visible |
| Score qualité | gradient rouge-orange-vert | idem (couleur sémantique, OK) |

---

## 8. Ordre d'implémentation recommandé

> **Convention** : `- [ ]` = à faire · `- [x]` = terminé · cocher au fil de l'implémentation.  
> **Skill ref** : styles.csv #7 (Dark Mode OLED) + #28 (Data-Dense Dashboard) · ux-guidelines.csv rows 6, 22, 28, 36, 37, 78, 99.

---

### Phase A — Quick wins ⏱ 1-2h

**Objectif** : Fondations thème + panneau droit accordéon. Zéro régression fonctionnelle.

#### A1 · Toggle thème clair/sombre

- [ ] **Créer `ui/src/styles/theme.css`** — définir toutes les CSS custom properties :
  ```css
  :root[data-theme="dark"] {
    --bg-primary: #000000;      /* OLED black */
    --bg-secondary: #121212;
    --bg-card: #1a1a2e;
    --text-primary: #ffffff;
    --text-secondary: #94a3b8;
    --border: #334155;
    --accent: #3b82f6;          /* Analytics blue */
    --accent-hover: #1d4ed8;
    --success: #22c55e;
    --warning: #f59e0b;
    --danger: #ef4444;
    --muted: #1e293b;
  }
  :root[data-theme="light"] {
    --bg-primary: #f8fafc;
    --bg-secondary: #ffffff;
    --bg-card: #ffffff;
    --text-primary: #0f172a;
    --text-secondary: #64748b;
    --border: #e2e8f0;
    --accent: #1e40af;
    --accent-hover: #1e3a8a;
    --success: #059669;
    --warning: #d97706;
    --danger: #dc2626;
    --muted: #f1f5f9;
  }
  ```
- [ ] **Remplacer toutes les couleurs hardcodées** dans `thematic-maps.css` par les variables (`#2171b5` → `var(--accent)`, `#f0f0f0` → `var(--muted)`, etc.)
- [ ] **Ajouter bouton toggle** dans la topbar (`ui/src/index.html` ou `App.tsx`) — icône soleil/lune, `aria-label="Basculer thème clair/sombre"`, touch target ≥44px (skill ux row 22)
- [ ] **Persister le choix** via `localStorage.setItem('atlas_theme', 'dark'|'light')` + appliquer `document.documentElement.setAttribute('data-theme', …)` au chargement
- [ ] **Vérifier contraste WCAG AA** (4.5:1 min) sur les deux thèmes — text-primary sur bg-primary et text-secondary sur bg-card (skill ux row 36)
- [ ] **Appliquer `prefers-color-scheme`** comme valeur par défaut si aucune pref stockée (skill ux row 99)

#### A2 · Refactorisation panneau droit en accordéons

- [ ] **Identifier les 4 sections** dans `thematic-panel.ts` : Filtres ADM · Zones d'étude · Carte thématique · Export
- [ ] **Wrapper chaque section** avec `<details class="atlas-accordion">` + `<summary class="accordion-header">` (HTML natif, 0 JS requis)
- [ ] **Styles `atlas-accordion`** dans `thematic-maps.css` :
  ```css
  .atlas-accordion summary { padding: 10px 14px; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; min-height: 44px; }
  .atlas-accordion summary::after { content: '▾'; transition: transform 200ms ease-out; }
  .atlas-accordion[open] summary::after { transform: rotate(-180deg); }
  .atlas-accordion .accordion-body { padding: 12px 14px 14px; }
  ```
- [ ] **État ouvert par défaut** : "Filtres ADM" et "Zones d'étude" ouverts, les autres fermés
- [ ] **Persister l'état** des accordéons dans `localStorage` (`atlas_accordion_${id}`)
- [ ] **Test non-régression** : Vérifier que les événements de filtre fonctionnent toujours après wrapping

#### A3 · Badge "N filtres actifs"

- [ ] **Ajouter `<span id="filtersActiveBadge" class="badge-filters">0</span>`** dans le `<summary>` de l'accordéon Filtres
- [ ] **Mettre à jour le compteur** dans `thematic-panel.ts` à chaque changement de sélect ADM (compter les selects avec valeur non-nulle)
- [ ] **Style badge** : pill rouge `background: var(--danger)` · `color: #fff` · `font-size: 11px` · caché si compteur = 0 (`display: none`)
- [ ] **Touch targets** : Vérifier que le `<summary>` reste ≥44px de hauteur avec le badge (skill ux row 22)

---

### Phase B — Panneau gauche ⏱ 2-3h

**Objectif** : Drill-down Niveau 0 (global) → Niveau 1 (fiche maille) avec animation. Pas de refactoring de `buildCellSummary` — adaptation CSS uniquement dans un premier temps.

#### B1 · Transition Niveau 0 → Niveau 1

- [ ] **Créer deux conteneurs** dans le panneau gauche (`left-panel.ts` ou équivalent) :
  ```html
  <div id="panelN0" class="panel-level"><!-- vue globale --></div>
  <div id="panelN1" class="panel-level panel-level--hidden"><!-- fiche maille --></div>
  ```
- [ ] **CSS transition slide** (skill ux row animation — `transform` uniquement, pas `display`) :
  ```css
  .panel-level { transition: transform 250ms ease-out, opacity 250ms ease-out; }
  .panel-level--hidden { transform: translateX(100%); opacity: 0; pointer-events: none; position: absolute; }
  ```
- [ ] **Bouton Retour** dans `panelN1` : `←  Vue globale` · `aria-label="Retour vue globale"` · touch target 44×44px
- [ ] **Déclencher la transition** depuis le handler de clic maille : masquer N0 + afficher N1 (swap de classes)
- [ ] **Préserver l'état de scroll** du panneau N0 en sortant de la fiche maille
- [ ] **Respecter `prefers-reduced-motion`** : si actif, switcher sans animation (skill ux row 99)

#### B2 · KPI Bar — remplacer le header stats

- [ ] **Identifier l'emplacement actuel** du bloc statistiques dans la vue globale (Niveau 0)
- [ ] **Créer `<div class="kpi-bar">` 4 colonnes** :
  ```html
  <div class="kpi-bar">
    <div class="kpi-card"><span class="kpi-value" id="kpiTotalMailles">29 407</span><span class="kpi-label">Mailles totales</span></div>
    <div class="kpi-card"><span class="kpi-value" id="kpiMaillesAvecData">—</span><span class="kpi-label">Avec données</span></div>
    <div class="kpi-card"><span class="kpi-value" id="kpiSondages">572</span><span class="kpi-label">Sondages</span></div>
    <div class="kpi-card"><span class="kpi-value" id="kpiZones">5</span><span class="kpi-label">Zones d'étude</span></div>
  </div>
  ```
- [ ] **Style compact** (skill styles #28 Data-Dense Dashboard : padding 8-12px, font-size 12-14px) :
  ```css
  .kpi-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 8px; }
  .kpi-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 8px 6px; text-align: center; }
  .kpi-value { display: block; font-size: 18px; font-weight: 700; color: var(--accent); }
  .kpi-label { display: block; font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
  ```
- [ ] **Mettre à jour dynamiquement** `kpiMaillesAvecData` lors de l'application d'un filtre ADM (requête `GET /api/geo/mailles/stats?adm3_id=…`)
- [ ] **Skeleton loader** sur `kpiMaillesAvecData` pendant le chargement (≥300ms → indicateur, skill ux row 78)

#### B3 · Grid essais disponibles (fiche maille)

- [ ] **Identifier la liste d'essais** à afficher : WL/WP/IP · VBS · CBR · Proctor · Pressiomètre · Pénétromètre · Classif · Gonflement + ML (11 param.)
- [ ] **Créer `<div class="essais-grid">` compact** dans `panelN1` — 4 colonnes × N lignes :
  ```html
  <div class="essai-chip essai-chip--ok" title="WL/WP/IP disponible">IP</div>
  <div class="essai-chip essai-chip--missing" title="VBS non disponible">VBS</div>
  ```
- [ ] **Style chips** (8×8dp grid, couleur sémantique) :
  ```css
  .essai-chip { padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
  .essai-chip--ok { background: var(--success); color: #fff; }
  .essai-chip--missing { background: var(--muted); color: var(--text-secondary); }
  ```
- [ ] **Populate depuis l'API** : `GET /api/geo/mailles/{code}/essais-summary` → dict `{atterberg: true, vbs: false, …}`
- [ ] **Fallback texte** si API indisponible : `<span class="text-muted">Données non disponibles</span>`
- [ ] **Pas de couleur seule** pour communiquer la disponibilité — texte sigle + couleur (skill ux row 37)

#### B4 · Badges zone dans le header de la fiche maille

- [ ] **Récupérer la/les zones** depuis `getZonesForMaille(cellCode)` (déjà disponible dans `map-style.ts`)
- [ ] **Afficher 1-N badges** dans le header fiche : `<span class="zone-badge zone-badge--lama">Lama 78%</span>`
- [ ] **Style badge** cohérent avec les `zone-dot` existants (couleurs `ZONE_PASTEL_COLORS`) :
  ```css
  .zone-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
  .zone-badge--lama { background: rgba(245,158,11,0.2); color: #F59E0B; border: 1px solid rgba(245,158,11,0.4); }
  /* … idem bado/mono/oti/fosse */
  ```
- [ ] **Afficher le pourcentage** d'intersection (ex : "Lama 78%") quand `pct_intersection` disponible
- [ ] **Touch target** du header : s'assurer que le bouton Retour reste ≥44px même avec les badges (skill ux row 22)

---

### Phase C — UX raffinements ⏱ 1h

**Objectif** : Améliorer la lisibilité et la navigation sans toucher à la logique métier.

#### C1 · Breadcrumb ADM

- [ ] **Ajouter `<nav aria-label="Localisation" class="breadcrumb-adm">` sous la KPI bar** (skill ux row 6 — breadcrumbs pour 3+ niveaux)
- [ ] **Structure HTML** : `<span>Togo</span> › <span id="bcRegion">—</span> › <span id="bcPrefecture">—</span> › <span id="bcCommune">—</span>`
- [ ] **Mettre à jour** depuis les handlers de select ADM dans `thematic-panel.ts`
- [ ] **Niveaux non sélectionnés** : grisés `color: var(--text-secondary)` + `›` séparateur visible sur les deux thèmes
- [ ] **Niveau courant** : `font-weight: 600` · `color: var(--text-primary)` · `aria-current="location"` (accessibilité)
- [ ] **Click sur breadcrumb ancêtre** : réinitialise les selects en dessous + recharge la carte
- [ ] **Style compact** : `font-size: 12px` · `padding: 6px 14px` · `overflow: hidden; white-space: nowrap; text-overflow: ellipsis`

#### C2 · Accordéon Synthèse dans la fiche maille

- [ ] **Identifier le bloc Synthèse** existant dans `buildCellSummary` (géologie, pédologie, unité géologique)
- [ ] **Wrapper dans `<details class="atlas-accordion" open>` → replié par défaut** (`open` absent)
- [ ] **Titre summary** : "Contexte géologique" · indicateur flèche (CSS only, déjà défini Phase A2)
- [ ] **Conserver le contenu existant** sans le modifier — changement purement structurel
- [ ] **Test régression** : Vérifier que les données géologiques s'affichent correctement à l'ouverture

#### C3 · Compteur zones d'étude (vue globale)

- [ ] **Ajouter 5 badges dans la section "Zones d'étude" du panneau gauche (Niveau 0)** :
  ```html
  <div class="zones-counter-grid">
    <span class="zone-counter-badge zone-dot--lama">Lama <b id="cntLama">547</b> km²</span>
    <!-- … Bado / Mono / Oti / Fosse -->
  </div>
  ```
- [ ] **Valeurs statiques** dans un premier temps (issues de `atlas.zones_etude`) : Lama 547 km² · Bado 312 · Mono 1 296 · Oti 464 · Fosse 7
- [ ] **Optionnel (si temps)** : ajouter nb de mailles par zone `GET /api/geo/zones-etude/{code}/stats` — afficher "N mailles"
- [ ] **Style compact** — grille 2 colonnes, même gabarit que les boutons zone existants
- [ ] **Sync avec les checkboxes de visibilité** : badge grisé quand la zone est décochée

---

### Phase D — Thème clair ⏱ 1h

**Objectif** : Validation du thème clair sur tous les composants. Ne débuter qu'après Phase A complète.

#### D1 · Adapter les tuiles Leaflet

- [ ] **Définir deux configurations de tuiles** dans `main.ts` :
  ```typescript
  const TILES = {
    dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    light: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  }
  ```
- [ ] **Écouter l'événement thème** (`storage` event ou custom event `atlas:themechange`) pour swapper les tuiles sans recharger la page
- [ ] **Préserver le zoom/centre** courant lors du swap de tuiles
- [ ] **Attribution correcte** sur les deux layers (obligatoire OpenStreetMap)

#### D2 · Adapter tooltips, Chart.js et badges

- [ ] **Leaflet tooltips** : `className: 'atlas-tooltip'` · style via CSS variables (déjà ciblé dans `thematic-maps.css`)
- [ ] **Chart.js globaux** (si utilisé) : passer `Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--text-primary')` après chaque changement de thème
- [ ] **`stats-box`** dans `thematic-maps.css` : remplacer `background: #f8f9fa` par `var(--muted)` · `color: #333` par `var(--text-primary)` · `color: #666` par `var(--text-secondary)`
- [ ] **`thematic-legend`** : remplacer `background: white` par `var(--bg-secondary)` · les couleurs hardcodées dans `.legend-header`, `.legend-label`
- [ ] **`.stats-box h4`** et `.stat-row` : migrer toutes les couleurs hexadécimales vers les variables thème
- [ ] **Zone badges** de Phase B4 : vérifier que les `rgba(…, 0.2)` restent lisibles sur fond clair (ratio ≥4.5:1)

#### D3 · Test contraste WCAG AA

- [ ] **Lister tous les couples texte/fond** présents dans l'interface
- [ ] **Vérifier chaque couple** avec outil (ex : WebAIM Contrast Checker) — seuil 4.5:1 texte normal, 3:1 grand texte (≥18px bold) (skill ux row 36)
- [ ] **Thème dark** : `--text-secondary` (#94a3b8) sur `--bg-card` (#1a1a2e) = vérifier ratio
- [ ] **Thème light** : `--text-secondary` (#64748b) sur `--bg-card` (#ffffff) = vérifier ratio
- [ ] **Zone dots/badges** : Les 5 couleurs pastel (Amber/Red/Green/Sky/Purple) — s'assurer qu'elles passent 3:1 sur fond clair et fond OLED
- [ ] **États focus** : outline `2px solid var(--accent)` + `outline-offset: 2px` sur tous les éléments interactifs (skill ux row 28)
- [ ] **Corriger** tout couple qui échoue avant de valider la Phase D

---

### Récapitulatif de suivi

| Phase | Tâche | Fichiers concernés | Statut |
|-------|-------|-------------------|--------|
| A1 | CSS custom properties + theme.css | `ui/src/styles/theme.css` (nouveau), `thematic-maps.css` | `[ ]` |
| A1 | Bouton toggle topbar | `ui/src/index.html` ou `App.tsx` | `[ ]` |
| A1 | Persistance localStorage thème | `ui/src/main.ts` | `[ ]` |
| A2 | Accordéons panneau droit | `thematic/thematic-panel.ts`, `thematic-maps.css` | `[ ]` |
| A3 | Badge N filtres actifs | `thematic/thematic-panel.ts`, `thematic-maps.css` | `[ ]` |
| B1 | Transition N0/N1 panneau gauche | `ui/src/left-panel.ts` (ou équivalent) | `[ ]` |
| B2 | KPI Bar 4 colonnes | idem | `[ ]` |
| B3 | Grid essais disponibles | idem + `colab-api.ts` | `[ ]` |
| B4 | Badges zone fiche maille | idem + `map-style.ts` | `[ ]` |
| C1 | Breadcrumb ADM | `thematic/thematic-panel.ts`, `thematic-maps.css` | `[ ]` |
| C2 | Accordéon Synthèse fiche maille | `cell-summary.ts` (wrapping uniquement) | `[ ]` |
| C3 | Compteur zones vue globale | panneau gauche, CSS | `[ ]` |
| D1 | Tiles Leaflet dark/light | `ui/src/main.ts` | `[ ]` |
| D2 | Chart.js + tooltips thème | `thematic-maps.css`, `main.ts` | `[ ]` |
| D3 | Test contraste WCAG AA | — (validation manuelle) | `[ ]` |

---

## 9. Points de vigilance

| Risque | Mitigation |
|--------|------------|
| Régression du panneau maille existant (buildCellSummary) | Ne pas toucher `cell-summary.ts` dans un premier temps — adapter l'affichage CSS uniquement |
| Leaflet tiles dark/light | Utiliser `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` pour dark, OSM standard pour light |
| Chart.js couleurs sur fond blanc | Passer `color: var(--text-primary)` dans les options globales Chart.js |
| Accordéons et scroll | Panneau droit : hauteur max = 100vh - 60px (topbar) avec overflow-y: auto |
| Touch targets checkboxes zone | Déjà ≥36px (actuel) — augmenter à 40px dans Phase A |
| Transition Niveau 0/1 panneau gauche | CSS `transform: translateX` + `visibility` pour performances (pas `display:none` + `block`) |

---

*Document généré le 2026-06-14 · Atlas Géotechnique Togo v2.6.0 → v3.0*
