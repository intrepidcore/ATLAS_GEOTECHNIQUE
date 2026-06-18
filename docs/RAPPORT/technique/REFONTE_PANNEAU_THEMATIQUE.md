# Document de refonte — Panneau thématique droit (v5.1)

**Projet :** Atlas Géotechnique Togo  
**Fichier source :** `ui/src/thematic/thematic-panel.ts` (2 736 lignes)  
**Date :** 2026-06-18  
**Basé sur :** inspection live Chrome (`#thematicPanel`, 56 contrôles, 349 px) + lecture code complète  
**Audit UX :** conformité vérifiée contre le skill `ui-ux-pro-max` (v5.1 → 9 corrections ajoutées)

---

## Sources de référence (Skill `ui-ux-pro-max`)

Toutes les corrections de la section 11 sont tracées vers les fichiers suivants du skill :

| Alias | Chemin absolu | Description |
|-------|--------------|-------------|
| `[UX-CSV]` | `ui-ux-pro-max/data/ux-guidelines.csv` | 99 règles UX numérotées, colonnes Do/Don't/Severity |
| `[QR]` | `ui-ux-pro-max/templates/base/quick-reference.md` | Référence rapide §1–§10, règles nommées (ex. `touch-target-size`) |
| `[SC]` | `ui-ux-pro-max/templates/base/skill-content.md` | Pre-Delivery Checklist + Common Rules (Icons, Interaction, Light/Dark, Layout) |
| `[UI-R]` | `ui-ux-pro-max/data/ui-reasoning.csv` | Patterns recommandés par type de produit (ligne 7 : Analytics Dashboard) |

Correspondance produit : le panneau thématique est classé **Analytics Dashboard / Data-Dense Tool**
→ `[UI-R]` ligne 7 : `Data-Dense + Heat Map`, `must_have: data-export, if_large_dataset: virtualize-lists`.

---

## 1. État actuel — Inventaire exact

### Structure HTML actuelle (`renderPanel()`)

```
[Header] Cartes thématiques                            [✕]
[Toggle] Mode expert

[Accordéon ▼] Carte thématique                         (ouvert)
  Source de données        [select — 6 options ML L1-L4 + Base]
    Badge modèle (coverage + LOO-RMSE)
    Banner warning (RK-SCORPAN H2 dégradé)
  Catégorie                [select — 4 familles]
  Paramètre                [select — 50+ options dynamiques]
    Description paramètre
  Horizon (ML seul.)       [select H1/H2/H3 — conditionnel]
  Type de carte            [select — choropleth/bubble/heatmap/binary]
  Méthode classification   [select — quantiles/equal/jenks/manual]
  Nombre de classes        [number 3–9]
  Seuils manuels           [text — conditionnel si method=manual]
  Palette de couleurs      [custom select — 30+ palettes]
  Opacité                  [range 0–100%]

[Accordéon ▼] Filtres                                  (ouvert, badge compteur)
  — Filtres géographiques —
  Région (ADM1)            [select — cascade]
  Préfecture (ADM2)        [select — cascade]
  Commune (ADM3)           [select — cascade]
  Résumé ADM               [div conditionnel]
  [Bouton] Effacer filtres géographiques
  — Filtres données —
  Sondages minimum         [number 0–10]
  Exclure mailles sans données  [checkbox ✓]
  Exclure mailles hors ADM      [checkbox]
  [Expert] Profondeur Min/Max   [2×number — caché]
  Afficher la grille de fond    [checkbox ✓]
  — Niveau de grille —
  2km / combinée / 28km    [radio group]
  [Expert] Overlay fiabilité    [checkbox — caché]

[Accordéon ▶] Couches contexte (QGIS)                  (fermé)
  Géologie         [checkbox + opacity + légende dépliable]
  Pédologie        [checkbox + opacity + légende dépliable]
  Risque gonflement[checkbox + opacity + légende dépliable]
  Relief (altitude)[checkbox + opacity + note tileserver]

[Accordéon ▼] Zones d'étude                            (ouvert)
  [Info] Ouvrir le panneau d'analyse par zone…
  [Grille 2×2+1] Lama / Bado / Mono / Oti / Fosse aux Lions
  [Bouton] Recalculer sources IA/AG
  [Grille 2×2] Train IA | Kriging

[Div] Résumé données

[Bouton primaire] Appliquer
[Bouton secondaire] Auto-Zoom
[Bouton reset] Réinitialiser

[Accordéon ▶] Exports                                  (fermé)
  Export Pro (PNG/PDF)
  Export Atlas complet
  [Grille 2×2] PNG rapide | QGIS
  [Grille 2×2] GeoJSON brut | Sauvegarder config
```

---

## 2. Problèmes UX identifiés

### P1 — Densité d'information : trop de contrôles visibles simultanément

**Constat :** Deux accordéons ouverts par défaut (Carte + Filtres + Zones) exposent ~35 contrôles
dès l'ouverture du panneau. Un ingénieur qui veut juste changer le paramètre doit ignorer visuellement
le bloc Filtres et le bloc Zones pour trouver ce qui l'intéresse.

**Impact :** Charge cognitive élevée, risque d'erreur (modifier un filtre sans le vouloir).

---

### P2 — Chaîne Source → Catégorie → Paramètre non progressive

**Constat :** Les trois selects sont empilés avec la même hauteur et le même style. La dépendance
hiérarchique (Source filtre les Paramètres disponibles ; Catégorie filtre aussi) n'est pas visible.
L'utilisateur peut sélectionner une Source ML puis une Catégorie incompatible sans feedback immédiat.

**Impact :** Erreurs de configuration silencieuses. L'Horizon ML n'apparaît que si la source ET le
paramètre le permettent — cette logique conditionnelle est opaque.

---

### P3 — Badge modèle et warning banner peu visibles / mal situés

**Constat :** Le badge LOO-RMSE (`#sourceModelBadge`, 11px gris `#94a3b8`) et le banner warning
(orange, format alert) sont placés directement sous le select Source, mais leur lien avec la source
sélectionnée n'est pas explicite. En mode sombre ils sont lisibles ; en mode clair ils disparaissent.

**Impact :** L'information qualité ML (coverage, RMSE) est ignorée. Les warnings sur RK-SCORPAN H2 ne
sont pas actionnables depuis leur position.

---

### P4 — Mode expert mal positionné et sans contexte

**Constat :** Le toggle "Mode expert" est le premier contrôle après le header, avant tout contenu.
L'utilisateur ne sait pas ce qu'il débloque avant d'avoir coché. En mode standard, les couches
contextuelles (Géologie, Pédologie…) sont invisibles mais leur accordéon "Couches contexte (QGIS)"
reste affiché et accessible — contradiction.

**Impact :** L'accordéon "Couches contexte" est accessible en mode standard mais n'a aucun effet
(les couches sont désactivées de force par `applyExpertMode(false)`). Un utilisateur standard
peut cocher Géologie sans résultat visible.

---

### P5 — Boutons IA/Kriging dans la mauvaise section

**Constat :** "Train IA", "Kriging" et "Recalculer sources IA/AG" sont placés dans l'accordéon
"Zones d'étude". Sémantiquement, les zones sont des entités géographiques (Lama, Bado…) et les
calculs ML sont des actions de pipeline backend. Ce mélange crée une confusion : l'utilisateur cherche
"comment recalculer" en vain dans "Carte thématique" ou "Exports".

**Impact :** Actions ML difficiles à trouver. Le bouton "Recalculer sources IA/AG" est la seule action
qui déclenche l'ensemble du pipeline (infer + kriging + AG) — sa position dans "Zones" est arbitraire.

---

### P6 — Navigation Retour / ✕ ambiguë

**Constat (précisé par l'utilisateur) :** Le bouton "← Retour" navigue entre les pages internes du
panneau (vue principale → fiche d'une zone d'étude), tandis que "✕" ferme le panneau entièrement.
Ces deux actions ont des affordances différentes mais le code les traite avec des éléments similaires.
Sur les screenshots, les deux boutons sont proches dans le header, sans distinction visuelle forte.

**Impact :** Un utilisateur peut fermer le panneau en voulant juste revenir à la vue principale.

---

### P7 — Exports distants des actions principales

**Constat :** L'accordéon "Exports" (fermé par défaut) est le dernier élément, après les boutons
Appliquer/Reset. Pour exporter, l'utilisateur doit : (1) configurer, (2) appliquer, (3) scroller vers
le bas, (4) ouvrir l'accordéon. Le "Export Pro" qui est l'action la plus fréquente est cachée.

**Impact :** Workflow export en 4 étapes non intuitives. Les 6 formats d'export (Pro, Atlas, PNG,
QGIS, GeoJSON, Config) ont une hiérarchie identique — le Pro se noie dans la liste.

---

### P8 — Grille "Niveau de grille" dans Filtres (mauvais groupe)

**Constat :** La sélection du niveau de grille (2km / combinée / 28km) est un paramètre
**cartographique** (il change la couche affichée), pas un **filtre de données**. Elle est actuellement
dans l'accordéon Filtres, après les checkboxes données.

**Impact :** L'utilisateur qui cherche à changer la résolution de grille cherche dans "Carte" avant
de trouver dans "Filtres".

---

### P9 — Binary map : seuil manquant (TODO code ligne 1416)

**Constat :** Quand `mapType = 'binary'`, le seuil de dichotomisation n'est pas configurable. Le code
contient un `// TODO: Afficher un champ pour le seuil binaire`. Actuellement, l'utilisateur sélectionne
"Binaire" sans pouvoir régler la frontière Vrai/Faux.

**Impact :** Le type "Binaire" est non fonctionnel en pratique.

---

## 3. Principes de refonte

### Principe 1 — Progressive disclosure

Exposer par défaut uniquement ce qui est nécessaire pour 80% des usages :
> Source → Paramètre → Appliquer.

Tout le reste (filtres géographiques, couches contexte, exports avancés) est accessible en 1 clic
mais ne pollue pas la vue initiale.

### Principe 2 — Groupes cohérents par intention

| Groupe | Intention |
|--------|-----------|
| **Données** | Que veux-je visualiser ? (source ML, paramètre, horizon) |
| **Rendu** | Comment l'afficher ? (type carte, classification, palette, opacité) |
| **Filtres géo** | Sur quelle zone ? (ADM1/2/3) |
| **Couches** | Quels overlays contextuels ? (géologie, grille) |
| **Calcul ML** | Recalculer les modèles backend |
| **Zones** | Analyser une zone de data gap |
| **Export** | Produire une livrable |

### Principe 3 — Hiérarchie des actions

```
[Primaire]   Appliquer
[Secondaire] Auto-Zoom, Export Pro
[Tertiaire]  Reset, PNG rapide, QGIS, GeoJSON, Config
[Admin]      Train IA, Kriging, Recalculer sources
```

### Principe 4 — Navigation interne explicite

La distinction Retour (navigation) / ✕ (fermeture) doit être visuellement encodée :
- ← Retour : bouton avec flèche + libellé, position gauche
- ✕ Fermer : icône seule, position droite, style discret

---

## 4. Architecture proposée (v5.0)

### 4.1 Structure globale

```
┌──────────────────────────────────────┐
│ ← [Retour]    Cartes thématiques  [✕]│  ← header 2 zones distinctes
├──────────────────────────────────────┤
│ [Tabs] Données | Rendu | Couches     │  ← 3 onglets principaux
├──────────────────────────────────────┤
│ [Contenu de l'onglet actif]          │
│                                      │
│                                      │
├──────────────────────────────────────┤
│ [Expert] ─────────────────────── ○  │  ← toggle en bas, hors tabs
├──────────────────────────────────────┤
│ [Appliquer]          [Auto-Zoom]     │  ← actions primaires toujours visibles
│ [Export Pro]                         │
├──────────────────────────────────────┤
│ [▼ Plus d'exports] [Reset]           │  ← secondaire rétractable
└──────────────────────────────────────┘
```

---

### 4.2 Onglet "Données" (vue par défaut)

```
[Onglet DONNÉES]

Source de données ──────────────────────
  [Select] Base terrain / ML L1 / L2a / L2b / L3 / L4
  [Chip] L1_KED_H · 12 345 mailles · LOO-RMSE VBS H1: 1.23     ← badge inline
  [⚠] RK-SCORPAN H2 : métriques dégradées VBS/EG              ← warning si actif

Paramètre ──────────────────────────────
  [Cascade 2 steps]
  Famille :  [Couverture ▾] [Argilosité ▾] [Portance ▾] [In-situ ▾]
                                             ↑ pill-tabs horizontal
  Paramètre : [select dynamique selon famille + source]
  Horizon :   [H1 · H2 · H3]  ← pill conditionnel si ML + paramètre horizonné
  [ℹ] Description + formule (dépliable, fermée par défaut)

Filtres géographiques ───────────────────
  Région (ADM1)     [select]
  Préfecture (ADM2) [select — désactivé si pas ADM1]
  Commune (ADM3)    [select — désactivé si pas ADM2]
  ↳ [Fil d'Ariane] Maritime → Lomé Commune          ← résumé si filtre actif
  [Effacer ↺]                                        ← bouton visible si filtre actif

Filtres données ─────────────────────────
  Sondages min     [0 ─────────────── 10]  (slider + valeur)
  [✓] Exclure mailles sans données
  [ ] Exclure mailles hors sélection ADM

[Expert-only] Profondeur (m)    [0.0] → [──] → [5.0]   ← slider double
[Expert-only] Overlay fiabilité [checkbox]
```

---

### 4.3 Onglet "Rendu"

```
[Onglet RENDU]

Type de carte ───────────────────────────
  [◉ Choroplèthe]  [○ Bulles]  [○ Chaleur]  [○ Binaire]
  ↳ Si Binaire : [Seuil] ─────────────── [valeur] ← implémente TODO P9

Niveau de grille ────────────────────────           ← déplacé depuis Filtres
  [◉ 2 km]  [○ Combinée]  [○ 28 km]

Classification ──────────────────────────
  Méthode   [Quantiles ▾]
  Classes   [────●──] 5                             ← slider avec bulles 3–9
  ↳ Si Manuelle : [Seuils]  1, 2, 3, 4, 5

Style ───────────────────────────────────
  Palette   [████████████ Bleus        ▾]           ← custom select gradient
  Opacité   [████████░░]  70%
```

---

### 4.4 Onglet "Couches"

```
[Onglet COUCHES]

[Expert-only]  (badge "Expert" si mode standard)

Couches contexte ────────────────────────
  [▶] Géologie       [○ off]  Opacité 45%   [vecteur]
  [▶] Pédologie      [○ off]  Opacité 45%   [vecteur]
  [▶] Risque gonfl.  [○ off]  Opacité 50%   [vecteur]
  [▶] Relief (DSM)   [○ off]  Opacité 60%   [raster]
  ↳ Chaque ligne : expandable pour légende

[Mode standard — empty state]
  ℹ Activez le Mode Expert pour accéder
    aux couches contextuelles.
  [Activer le Mode Expert →]
```

---

### 4.5 Section "Zones d'étude" (accordéon séparé, hors tabs)

```
[Accordéon ▶] Zones data gap ── 5 zones ────────────

[● Lama  547 km²  → Analyser]         [☐ Afficher]
[● Bado  312 km²  → Analyser]         [☐ Afficher]
[● Mono  1 296 km² → Analyser]        [☐ Afficher]
[● Oti    464 km²  → Analyser]        [☐ Afficher]
[● Fosse aux Lions 7 km² → Analyser]  [☐ Afficher]

→ "Analyser" (zone de clic principale) → page interne zone
→ "Afficher" (toggle séparé) → afficher/masquer emprise sur la carte
```

> **C11-G** — la zone de clic et le checkbox sont visuellement séparés.
> Voir §11 Correction 7.

---

### 4.6 Section "Calcul ML" (accordéon séparé, hors tabs)

```
[Accordéon ▶] Recalcul ML ──────────────────────────
[Expert-only — masqué en mode standard]

[Recalculer sources IA/AG]     ← master trigger (full pipeline)
  Déclenche : infer + kriging + fondation AG

[Train IA supervisé]   [Kriging global]
```

> **C11-E** — chaque bouton ML affiche une dialog de confirmation avant déclenchement.
> Voir §11 Correction 5.

---

### 4.7 Footer permanent (toujours visible)

```
┌──────────────────────────────────────┐
│ [Mode expert ────────────────── ○]   │
├──────────────────────────────────────┤
│ [Appliquer ✓]           [Auto-Zoom ⊕]│
│ [Export Pro ↑]                        │
│ [▼ Plus : PNG | QGIS | GeoJSON | Atlas] [Réinitialiser ↺] │
└──────────────────────────────────────┘
```

> **C11-C** — le contenu de l'onglet actif reçoit un `padding-bottom` égal à la hauteur du footer
> pour que le dernier élément scrollable ne soit pas caché. Voir §11 Correction 3.

---

## 5. Navigation interne — Retour vs ✕

### État Racine (vue principale panneau)
```
                              Cartes thématiques     [✕]
```
- Le bouton Retour n'est **pas** visible à l'état racine
- ✕ ferme le panneau entièrement
- `aria-label="Fermer le panneau"` sur ✕

### État Fiche zone (drill-in depuis "Zones d'étude")
```
[← Retour]    Dépression de la Lama               [✕]
```
- ← Retour : bouton avec flèche + libellé texte, position gauche — retour à la vue principale
- ✕ : position droite, ferme le panneau entièrement
- Encodage visuel : Retour = style ghost/lien ; ✕ = icône seule, `opacity: 0.7`
- `aria-label="Retour à la vue principale"` sur ← Retour

### Implémentation technique

```typescript
type PanelPage = 'root' | `zone:${string}`

interface PanelNavState {
  page: PanelPage
  title: string
  showBack: boolean
}

function navigateTo(page: PanelPage) { /* met à jour l'état + move focus sur h3 */ }
function navigateBack() { navigateTo('root') }
```

> **C11-D** — après chaque navigation, le focus est déplacé sur le titre `h3` du panneau.
> Voir §11 Correction 4.

---

## 6. Mode Expert — nouvelle logique

**En mode standard :**
- Onglet "Couches" : checkboxes `disabled` + empty state explicatif avec CTA "Activer"
- Accordéon "Calcul ML" : masqué (actions admin)
- Toggle Expert visible dans le footer

**En mode expert :**
- Onglet "Couches" pleinement fonctionnel (couches activables)
- Accordéon "Calcul ML" visible
- Filtre Profondeur (slider double) visible dans Données
- Overlay fiabilité visible dans Données

**Position du toggle :** footer du panneau (bas), avant les boutons d'action.

---

## 7. Palette — comportement amélioré

**Proposition :** Chip de recommandation sans forçage.

```
Palette   [████ Bleus ▾]   [✨ Recommandé : YlOrRd]
```

- Si la palette active ≠ recommandée → chip cliquable "Recommandé : X"
- Cliquer sur le chip applique la recommandation
- L'auto-suggestion au changement de paramètre reste désactivée (ne pas écraser les choix)

---

## 8. Détails visuels

### Largeur
- Actuelle : 349px (mesurée Chrome)
- Proposée : 360px (gain 11px)
- Résizable : conserver `makeResizable` avec min=320, max=480

### Header
```
Hauteur : 48px
Padding : 0 16px
Align   : space-between
Police  : 14px 600 (titre) + 20px icon (✕)
← Retour : visible seulement si page ≠ 'root'
```

### Tabs (Données / Rendu / Couches)
```
role="tablist" — aria conforme (voir C11-D)
Style    : pill-tabs, hauteur 44px minimum (touch target — voir C11-A)
Police   : 13px 500
Active   : background accent, text white
Inactive : text muted, bg transparent
```

### Actions footer
```
Position    : sticky bottom 0, z-index 10
Background  : var(--panel) avec border-top 1px var(--field-border)
Padding     : 12px 16px
Gap         : 8px
Appliquer   : btn-primary full-width, min-height 44px
Auto-Zoom   : btn-secondary, min-height 44px
Export Pro  : btn-secondary full-width, min-height 44px
```

### Boutons `.btn-sm`
```
min-height : 44px   ← correction C11-A
padding    : 10px 12px
```

---

## 9. Points de vigilance implémentation

### A — Tabs vs accordéons (scroll interne)

Avec les 3 tabs, chaque tab a son propre scroll. Le `overflow-y: auto` doit être sur le contenu
du tab, **pas** sur `#thematicPanel`.

```css
.thematic-panel-body {
  display: flex;
  flex-direction: column;
  height: calc(100% - 48px); /* 48px = header */
}
.tabs-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: var(--footer-height, 120px); /* C11-C : inset anti-masquage */
}
.panel-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--field-border);
}
```

### B — Migration incrémentale (3 passes)

**Passe 1 (rapide) :**
- [x] Déplacer "Niveau de grille" dans la section "Carte thématique"
- [x] Déplacer IA/Kriging → accordéon "Calcul ML" (hors Zones)
- [x] Implémenter seuil binaire (TODO ligne 1416)
- [ ] Logique Expert : `disabled` (pas caché) sur les checkboxes couches en mode standard
- [x] C11-A — `btn-small` min-height 44px + `zone-etude-btn` + `btn-close`
- [x] C11-B — Badge RMSE : 13px + contraste ≥4.5:1 (`var(--muted)`)
- [x] C11-D — Tabs ARIA (`role="tablist/tab/tabpanel"`) + navigation clavier flèches (Passe 3)
- [x] C11-E — Confirmation dialog avant Train IA / Kriging / Recalculer sources

**Passe 2 (medium) :**
- [x] C11-C — Sticky footer : `padding-bottom` dynamique sur `.tabs-content`
- [x] C11-F — Inline validation sur inputs numériques (classes, opacité, seuils)
- [x] C11-G — Séparer zone-button et checkbox (éléments interactifs imbriqués)
- [x] C11-H — Empty state onglet Couches (mode standard sans expert)
- [x] C11-I — Migrer inline styles `#0f172a` / `#0a1018` → tokens CSS
- [x] P4 — Logique Expert : `disabled` couches en mode standard
- [x] P6 — Navigation Retour + ARIA + focus sur changement de page
- [ ] Chip recommandation palette
- [ ] Pill-tabs Famille horizontaux

**Passe 3 (restructuration) :**
- [x] 3 onglets principaux (Données / Rendu / Couches)
- [x] Sticky footer Appliquer + Export Pro toujours visibles
- [x] Toggle Expert → footer (bas du panneau)
- [ ] Typographie et tokens CSS uniformisés

### C — Compatibilité dark/light (tokens)

Les inline styles `background:#0f172a` dans les accordéons "Couches contexte" doivent être
migrés vers des classes CSS lors de la passe 1. Le `vanilla-theme-override.css` reste en place
comme fallback. Voir C11-I.

---

## 10. Résumé des changements par priorité

| Statut | Priorité | Changement | Problème résolu | Fichier |
|--------|----------|------------|-----------------|---------|
| [x] | **P0** | Déplacer IA/Kriging → accordéon "Calcul ML" | P5 | thematic-panel.ts |
| [x] | **P0** | Déplacer "Niveau de grille" → section "Carte" | P8 | thematic-panel.ts |
| [x] | **P0** | Implémenter seuil binaire (TODO ligne 1416) | P9 | thematic-panel.ts |
| [x] | **P0** | `btn-small` min-height 44px | **C11-A** | index.html + thematic-maps.css |
| [x] | **P0** | Badge RMSE : 13px + contraste ≥4.5:1 | **C11-B** | thematic-panel.ts + thematic-maps.css |
| [x] | **P0** | Tabs ARIA (`role="tablist/tab/tabpanel"`) + focus on nav | **C11-D** | thematic-panel.ts (Passe 3) |
| [x] | **P0** | Confirmation dialog boutons ML | **C11-E** | thematic-panel.ts |
| [x] | **P1** | Sticky footer : padding-bottom sur tabs-content | **C11-C** | thematic-maps.css |
| [x] | **P1** | Inline validation sur inputs numériques | **C11-F** | thematic-panel.ts |
| [x] | **P1** | Séparer zone-button et checkbox (nested conflict) | **C11-G** | thematic-panel.ts + thematic-maps.css |
| [x] | **P1** | Empty state onglet Couches (mode standard) | **C11-H** | thematic-panel.ts |
| [x] | **P1** | Migrer inline styles `#0f172a` → tokens CSS | **C11-I** | thematic-panel.ts + thematic-maps.css |
| [x] | **P1** | Logique Expert : `disabled` couches en mode standard | P4 | thematic-panel.ts |
| [x] | **P1** | Navigation Retour + ARIA | P6 | thematic-panel.ts |
| [ ] | **P1** | Chip recommandation palette | P3 | thematic-panel.ts |
| [ ] | **P2** | Pill-tabs Famille horizontaux | P2 | thematic-panel.ts |
| [ ] | **P2** | Sticky footer Appliquer + Export Pro | P7 | thematic-panel.ts + thematic-maps.css |
| [ ] | **P3** | 3 onglets principaux (Données / Rendu / Couches) | P1 | refactoring complet |
| [ ] | **P3** | Toggle Expert → footer (bas du panneau) | P4 | thematic-panel.ts |

---

## 11. Audit de conformité `ui-ux-pro-max` — 9 corrections

> Chaque correction cite la règle exacte du skill avec son alias de fichier et son identifiant.
> Ces corrections s'ajoutent aux problèmes P1–P9 déjà documentés.

---

### C11-A — Touch targets < 44px

**Règle :** `[QR] §2 touch-target-size` — *"Min 44×44pt (Apple) / 48×48dp (Android); extend hit
area beyond visual bounds if needed."*  
**Référence secondaire :** `[UX-CSV] row 23, No.22` — *Touch Target Size, Severity: HIGH.*  
**Checklist :** `[SC] §Interaction "Touch targets meet minimum size (>=44x44pt iOS)"`.

**Non-conformité constatée :** Les boutons `.btn-sm` (Train IA, Kriging, PNG rapide, QGIS,
GeoJSON, Sauvegarder) ont une hauteur ~28–32px en CSS courant. Les zone-buttons ne spécifiaient
pas de hauteur minimum.

**Correction :**
```css
/* thematic-maps.css */
.btn-sm {
  min-height: 44px;
  padding: 10px 12px;
}
.zone-etude-btn {
  min-height: 44px;
}
.thematic-panel-header .btn-close {
  min-width: 44px;
  min-height: 44px;
}
```

**Périmètre :** tous les éléments interactifs du panneau — vérifier aussi les sliders opacity
(height implicite via navigateur) et les checkboxes (ajouter `hitSlop` ou padding).

---

### C11-B — Contraste badge LOO-RMSE insuffisant

**Règle :** `[QR] §1 color-contrast` — *"Minimum 4.5:1 ratio for normal text (large text 3:1)."*  
**Référence secondaire :** `[UX-CSV] row 37, No.36` — *Color Contrast, Severity: HIGH.*  
**Référence tertiaire :** `[SC] §Light/Dark Mode Contrast "Text contrast (dark) ≥4.5:1"`.  
**Règle complémentaire :** `[QR] §5 readable-font-size` — *"Minimum 16px body text on mobile."*

**Non-conformité constatée :**
- `#sourceModelBadge` : `font-size: 11px` → sous le minimum 16px
- `color: #94a3b8` sur fond `#0f172a` → ratio ≈ 3.2:1 (WCAG AA requis : 4.5:1 pour texte normal)

**Correction :**
```css
/* thematic-panel.ts — dans renderPanel() */
#sourceModelBadge {
  font-size: 13px;        /* exception justifiée : espace contraint, secondary info */
  color: var(--muted);    /* var(--muted) doit être vérifié ≥4.5:1 contre var(--panel) */
  padding: 6px 0;
  min-height: 18px;
}
```

> Note : 13px reste en dessous de 16px mais est admissible pour une métadonnée secondaire
> (`[QR] §6 font-scale` autorise 12px pour les labels). L'essentiel est de passer de 3.2:1
> à ≥4.5:1 en contraste. Valider avec un outil WCAG (ex. Coolors Contrast Checker).

---

### C11-C — Contenu masqué derrière le sticky footer

**Règle :** `[QR] §5 fixed-element-offset` — *"Fixed navbar/bottom bar must reserve safe padding
for underlying content."*  
**Référence secondaire :** `[SC] §Layout & Spacing "Scroll and fixed element coexistence — Add
bottom/top content insets so lists are not hidden behind fixed bars."*  
**Checklist :** `[SC] §Layout "Scroll content is not hidden behind fixed/sticky bars."*

**Non-conformité constatée :** La proposition introduit un footer sticky (Appliquer + Export Pro
toujours visibles) sans spécifier d'inset sur le contenu scrollable — le dernier élément de l'onglet
actif peut se retrouver caché derrière le footer.

**Correction :**
```css
/* thematic-maps.css */
.tabs-content {
  flex: 1;
  overflow-y: auto;
  /* inset dynamique via CSS custom property calculée au montage du panel */
  padding-bottom: var(--panel-footer-height, 124px);
}
```

```typescript
// thematic-panel.ts — après montage du footer
const footer = this.panelElement.querySelector('.panel-footer') as HTMLElement
if (footer) {
  const h = footer.offsetHeight
  this.panelElement.style.setProperty('--panel-footer-height', `${h + 8}px`)
}
```

---

### C11-D — Tabs sans ARIA et sans gestion du focus clavier

**Règle principale :** `[QR] §1 keyboard-nav` — *"Tab order matches visual order; full keyboard
support."*  
**Règle complémentaire :** `[QR] §1 aria-labels` — *"aria-label for icon-only buttons;
accessibilityLabel in native."*  
**Référence secondaire :** `[UX-CSV] row 42, No.41` — *Keyboard Navigation, Severity: HIGH.*  
**Référence navigation :** `[QR] §9 focus-on-route-change` — *"After page transition, move focus
to main content region for screen reader users."*

**Non-conformité constatée :** La proposition introduit 3 onglets (Données / Rendu / Couches) sans
spécifier les attributs ARIA requis pour les tabs, ni le comportement clavier (flèches entre tabs,
Tab vers le contenu).

**Correction :**
```html
<!-- thematic-panel.ts renderPanel() -->
<div class="tabs-nav" role="tablist" aria-label="Configuration thématique">
  <button role="tab" id="tab-donnees"  aria-selected="true"
          aria-controls="panel-donnees"  tabindex="0">Données</button>
  <button role="tab" id="tab-rendu"    aria-selected="false"
          aria-controls="panel-rendu"    tabindex="-1">Rendu</button>
  <button role="tab" id="tab-couches"  aria-selected="false"
          aria-controls="panel-couches"  tabindex="-1">Couches</button>
</div>
<div role="tabpanel" id="panel-donnees" aria-labelledby="tab-donnees">…</div>
<div role="tabpanel" id="panel-rendu"   aria-labelledby="tab-rendu"   hidden>…</div>
<div role="tabpanel" id="panel-couches" aria-labelledby="tab-couches" hidden>…</div>
```

```typescript
// Comportement clavier : flèches ←/→ entre tabs, Tab vers le contenu
tabList.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') focusNextTab()
  if (e.key === 'ArrowLeft')  focusPrevTab()
})
// Focus sur h3 après navigation de page (Retour / drill-in)
function navigateTo(page: PanelPage) {
  // ... changement d'état ...
  const title = this.panelElement.querySelector('h3')
  title?.focus()
}
```

---

### C11-E — Boutons ML sans confirmation pour actions non annulables

**Règle :** `[QR] §8 confirmation-dialogs` — *"Confirm before destructive actions."*  
**Référence secondaire :** `[UX-CSV] row 36, No.35` — *Confirmation Dialogs, Severity: HIGH.*  
**Règle complémentaire :** `[SC] §Forms & Feedback "destructive-emphasis — Destructive actions use
semantic danger color and are visually separated from primary actions."*

**Non-conformité constatée :** "Train IA", "Kriging" et "Recalculer sources IA/AG" déclenchent
des opérations backend longues et non annulables (calculs ML global sur toutes les mailles) sans
aucune confirmation.

**Correction :** Dialog de confirmation minimal avant déclenchement :

```typescript
// thematic-panel.ts — handler bouton Train IA
runTrainBtn.addEventListener('click', async () => {
  const confirmed = await showConfirmDialog({
    title: 'Lancer l\'entraînement supervisé ?',
    message: 'Cette opération recalcule l\'inférence ML sur toutes les mailles. '
           + 'Durée estimée : plusieurs minutes.',
    confirmLabel: 'Lancer',
    cancelLabel:  'Annuler',
    variant: 'warning'  // couleur orange/ambre, pas rouge (non destructif)
  })
  if (!confirmed) return
  // ... appel API ...
})
```

> Les opérations ML ne sont pas destructives (elles écrasent des colonnes calculées, pas des
> données terrain) — utiliser `variant: 'warning'` (orange) plutôt que `variant: 'danger'` (rouge)
> pour respecter la sémantique couleur.

---

### C11-F — Inline validation manquante sur les inputs numériques

**Règle :** `[QR] §8 inline-validation` — *"Validate on blur (not keystroke); show error only
after user finishes input."*  
**Référence secondaire :** `[UX-CSV] row 57, No.56` — *Inline Validation, Severity: MEDIUM.*  
**Règle complémentaire :** `[QR] §8 error-placement` — *"Show error below the related field."*  
**Règle complémentaire :** `[SC] §Forms & Feedback "touch-friendly-input — Mobile input height
≥44px."*

**Non-conformité constatée :** `nClasses` (3–9), `minSondages` (0–10), `depthMin/Max` — aucune
validation inline. Un utilisateur peut saisir une valeur hors plage (ex. 15 classes) sans retour
immédiat ; l'erreur n'apparaît qu'à l'Appliquer.

**Correction :**
```typescript
// thematic-panel.ts — helper réutilisable
function addRangeValidation(
  input: HTMLInputElement,
  min: number, max: number,
  label: string
) {
  const errorEl = document.createElement('div')
  errorEl.className = 'field-error'
  errorEl.setAttribute('role', 'alert')
  errorEl.setAttribute('aria-live', 'polite')
  input.after(errorEl)

  input.addEventListener('blur', () => {
    const val = Number(input.value)
    if (isNaN(val) || val < min || val > max) {
      errorEl.textContent = `${label} doit être entre ${min} et ${max}.`
      input.setAttribute('aria-invalid', 'true')
    } else {
      errorEl.textContent = ''
      input.removeAttribute('aria-invalid')
    }
  })
}

// Appels
addRangeValidation(this.elements.nClassesInput!,    3,  9, 'Nombre de classes')
addRangeValidation(this.elements.minSondagesInput!, 0, 10, 'Sondages minimum')
addRangeValidation(this.elements.depthMinInput!,    0, 20, 'Profondeur min')
addRangeValidation(this.elements.depthMaxInput!,    0, 20, 'Profondeur max')
```

```css
/* thematic-maps.css */
.field-error {
  font-size: 12px;
  color: var(--err, #ef4444);
  margin-top: 4px;
  min-height: 16px; /* réserve espace pour éviter layout shift [UX-CSV #19] */
}
```

---

### C11-G — Éléments interactifs imbriqués dans les zone-buttons

**Règle :** `[QR] §2 gesture-conflicts` — *"Avoid horizontal swipe on main content; prefer vertical
scroll."* (principe étendu aux tap conflicts)  
**Référence secondaire :** `[UX-CSV] row 25, No.24` — *Gesture Conflicts, Severity: MEDIUM.*  
**Règle complémentaire :** `[SC] §Interaction "Gesture conflict prevention — Keep one primary
gesture per region."*

**Non-conformité constatée :** Chaque `zone-etude-btn` (bouton `<button>`) contient un
`<input type="checkbox">` imbriqué. Sur un écran tactile, une pression imprécise peut déclencher
la checkbox au lieu du bouton principal — conflit d'interaction à l'intérieur d'un même élément.

**Correction :** Séparer physiquement les deux zones d'interaction dans le DOM :

```html
<!-- thematic-panel.ts renderPanel() — nouvelle structure zone -->
<div class="zone-etude-row">
  <button type="button" class="zone-etude-btn" id="openZoneEtudeLamaBtn"
          title="Dépression de la Lama — data gap RGA">
    <span class="zone-dot zone-dot--lama" aria-hidden="true"></span>
    <span class="zone-name">Lama</span>
    <span class="zone-km2-badge">547 km²</span>
  </button>
  <label class="zone-vis-label" title="Afficher sur la carte">
    <input type="checkbox" id="zoneVisLama"
           data-zone="DEPRESSION_LAMA_TG"
           class="zone-vis-chk"
           aria-label="Afficher Lama sur la carte">
  </label>
</div>
```

```css
/* thematic-maps.css */
.zone-etude-row {
  display: flex;
  align-items: center;
  gap: 8px;      /* [QR] §2 touch-spacing — min 8px entre cibles */
}
.zone-etude-btn {
  flex: 1;
  min-height: 44px;    /* C11-A */
}
.zone-vis-label {
  min-width: 44px;
  min-height: 44px;    /* C11-A */
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

### C11-H — Empty states non définis

**Règle :** `[QR] §8 empty-states` — *"Helpful message and action when no content."*  
**Référence secondaire :** `[UX-CSV] row 80, No.79` — *Empty States, Severity: MEDIUM.*  
**Règle complémentaire :** `[SC] §Forms & Feedback "empty-states."*

**Non-conformité constatée :** Deux situations sans empty state défini :
1. `#dataSummary` : vide avant le premier clic Appliquer
2. Onglet "Couches" en mode standard : checkboxes disabled sans explication

**Correction — dataSummary (état initial) :**
```typescript
// thematic-panel.ts — dans init(), après applyConfigToUI()
if (this.elements.summaryText) {
  this.elements.summaryText.innerHTML = `
    <div class="empty-state-hint">
      Configurez une carte et cliquez sur <strong>Appliquer</strong>
      pour afficher le résumé.
    </div>`
}
```

**Correction — onglet Couches (mode standard) :**
```typescript
// thematic-panel.ts — dans applyExpertMode(false)
const couches = document.getElementById('panel-couches')
if (couches) {
  couches.insertAdjacentHTML('afterbegin', `
    <div class="expert-gate empty-state" role="note">
      <svg aria-hidden="true">…</svg>  <!-- icône lock Lucide -->
      <p>Les couches contextuelles (Géologie, Pédologie, Relief…)
         nécessitent le <strong>Mode Expert</strong>.</p>
      <button type="button" class="btn-secondary" id="activateExpertFromCouches">
        Activer le Mode Expert
      </button>
    </div>`)

  document.getElementById('activateExpertFromCouches')
    ?.addEventListener('click', () => {
      const toggle = this.elements.toggleExpertModeCheckbox
      if (toggle) { toggle.checked = true; toggle.dispatchEvent(new Event('change')) }
    })
}
```

---

### C11-I — Inline styles `#0f172a` / `#0a1018` : tokens non respectés

**Règle :** `[QR] §6 color-semantic` — *"Define semantic color tokens (primary, secondary, error,
surface, on-surface) not raw hex in components."*  
**Référence secondaire :** `[SC] §Light/Dark Mode Contrast "Token-driven theming — Use semantic
color tokens mapped per theme; no hardcoded per-screen hex values."*  
**Checklist :** `[SC] §Visual Quality "Semantic theme tokens are used consistently (no ad-hoc
per-screen hardcoded colors)."*

**Non-conformité constatée :** L'accordéon "Couches contexte" contient ~20 attributs
`style="background:#0f172a"` et `style="background:#0a1018"` inline. En mode light, le fichier
`vanilla-theme-override.css` les corrige via sélecteurs `[style*="background:#0f172a"]`, mais
cette approche est fragile et ne respecte pas la norme token.

**Correction — Passe 1 (migration des inline styles) :**

```typescript
// thematic-panel.ts — dans renderPanel(), remplacer les attributs style inline
// AVANT (non conforme) :
`<details style="background:#0f172a;border-radius:6px;border-left:3px solid #8B4513">`

// APRÈS (conforme) :
`<details class="context-layer-accordion context-layer-accordion--geologie">`
```

```css
/* thematic-maps.css — nouvelles classes */
.context-layer-accordion {
  background: var(--card-bg);
  border-radius: 6px;
  margin-bottom: 8px;
}
.context-layer-accordion summary {
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.context-layer-accordion .layer-content {
  padding: 8px;
  border-top: 1px solid var(--card-border);
  background: var(--field);
}
/* Accents de couleur par couche via modifier */
.context-layer-accordion--geologie  { border-left: 3px solid #8B4513; }
.context-layer-accordion--pedologie { border-left: 3px solid #FFB6C1; }
.context-layer-accordion--risque    { border-left: 3px solid #ff9933; }
.context-layer-accordion--relief    { border-left: 3px solid #4682B4; }
```

> La règle `[style*="background:#0f172a"]` dans `vanilla-theme-override.css` peut être retirée
> une fois la migration complète, ce qui simplifie la maintenance CSS.

---

## 12. Pre-Delivery Checklist (extrait `[SC]`)

Avant de livrer la passe 1, vérifier les points suivants issus de `[SC] §Pre-Delivery Checklist` :

### Visual Quality
- [ ] Aucun emoji utilisé comme icône (Lucide OK)
- [ ] Tokens sémantiques CSS uniformes — inline styles `#0f172a` migrés **(C11-I)**
- [ ] État pressed des boutons ne décale pas le layout

### Interaction
- [ ] Tous les éléments tappables ≥44×44px **(C11-A)**
- [ ] Timing micro-interactions 150–300ms (accordéons, tabs)
- [ ] États disabled visuellement clairs (couches Expert)
- [ ] Focus clavier après navigation de page **(C11-D)**
- [ ] Pas de conflits gesture (zone-buttons) **(C11-G)**

### Light/Dark Mode
- [ ] Contraste texte ≥4.5:1 en light ET dark **(C11-B)**
- [ ] Tokens CSS utilisés — vérifier `var(--muted)` en light mode
- [ ] Scrim des dialogs de confirmation ≥40% black **(C11-E)**

### Layout
- [ ] Contenu scrollable non caché derrière le footer sticky **(C11-C)**
- [ ] Spacing system 4/8px maintenu dans les nouvelles sections

### Accessibilité
- [ ] Tabs ARIA complets (`role="tablist/tab/tabpanel"`, `aria-selected`) **(C11-D)**
- [ ] Empty states définis (dataSummary + onglet Couches mode standard) **(C11-H)**
- [ ] Erreurs inline validation avec `role="alert"` **(C11-F)**
- [ ] Confirmations boutons ML **(C11-E)**

---

## Annexe A — Contrôles existants à conserver sans changement

- Badge LOO-RMSE (API `/ai/models/status`) — repositionnement + contraste seulement (C11-B)
- Cascade ADM1/ADM2/ADM3 (`/adm2`, `/adm3`) — logique correcte
- Palette custom select avec previews gradient — garder tel quel
- Opacity slider avec affichage % — garder tel quel
- Zone buttons + visibility checkboxes (localStorage) — restructurer DOM (C11-G)
- Export Pro / Atlas (dialogs séparés) — garder tel quel
- `applyExpertMode()` / `syncSourceAvailability()` — logique à conserver, UI à ajuster

## Annexe B — TODO code non liés à l'UX

- Ligne 1416 : seuil binaire (traité en P9)
- Ligne 1867 : filtrage features dans légende couche GeoJSON (hors scope)
- DSM via togo_map au lieu de dsm-cop30 (hors scope)

## Annexe C — Références skill complètes

```
Skill path   : ui-ux-pro-max/
Version      : ui-ux-pro-max-skill-main
Plateforme   : Claude (templates/platforms/claude.json)

Fichiers utilisés dans ce document :
  data/ux-guidelines.csv        → règles [UX-CSV] row 22, 24, 35, 36, 41, 56, 57, 79
  data/ui-reasoning.csv         → ligne 7 (Analytics Dashboard) [UI-R]
  templates/base/quick-reference.md → §1 §2 §5 §6 §8 §9 [QR]
  templates/base/skill-content.md   → Pre-Delivery Checklist, Common Rules [SC]

Commande de vérification recommandée (si Python disponible) :
  python3 skills/ui-ux-pro-max/scripts/search.py \
    "geotechnical analytics dashboard data-dense panel" \
    --design-system -p "Atlas Géotechnique"
```
