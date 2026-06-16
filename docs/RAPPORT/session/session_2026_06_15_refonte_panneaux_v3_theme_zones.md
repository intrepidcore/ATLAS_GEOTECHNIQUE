# Session 2026-06-15 — Refonte Panneaux Atlas V3 : Thème, Roadmap, Zones d'étude
## Atlas Géotechnique Togo — UI/UX, logique métier zones, dark/light theme

**Date** : 2026-06-15  
**Durée estimée** : session longue (~5h, reprise depuis contexte compressé)  
**Opérateur** : Claude Sonnet 4.6 (IA assistante)  
**Contexte de démarrage** : session reprise depuis un résumé de compaction — la conversation précédente avait dépassé la limite de contexte. Les informations ont été reconstituées depuis le fichier `.jsonl` de session.

---

## Résumé exécutif

Cette session couvre trois axes majeurs de développement UI pour l'Atlas Géotechnique Togo :

1. **Correction du bug de mélange de thème dark/light** — les panneaux latéraux gauches affichaient des fonds sombres hardcodés en mode clair
2. **Implémentation des éléments manquants de la roadmap REFONTE_PANNEAUX_ATLAS_V3** — trois composants absents : badges zones actives (Niveau 0), breadcrumb ADM (Niveau 1), boutons d'actions (Niveau 1)
3. **Analyse de la logique métier `pct_intersection`** depuis le document scientifique, puis correction du composant `ZoneEtudePanel` : dark mode + filtre "Avec sondages"

---

## Table des matières

1. Contexte de démarrage et reconstruction de session
2. Audit de conformité roadmap REFONTE_PANNEAUX_ATLAS_V3
3. Diagnostic du bug de thème (dark/light mixing)
4. Fix thème — CSS attribute selectors avec `!important`
5. Implémentation Niveau 0 — Zones d'étude actives (badges)
6. Implémentation Niveau 1 — Breadcrumb ADM
7. Implémentation Niveau 1 — Boutons d'actions
8. Analyse de la logique métier `pct_intersection`
9. Analyse du document scientifique RÉSULTAT — Délimitation des zones
10. Diagnostic des défauts de thème dans ZoneEtudePanel
11. Implémentation Solution 1 — Filtre "Avec sondages"
12. Implémentation Solution 2 — Dark mode Tailwind sur ZoneEtudePanel
13. Implémentation Solution 3 — Indicateur visuel de tier d'appartenance
14. Build final et vérification
15. Synthèse des fichiers modifiés
16. Points ouverts et perspectives

---

## 1. Contexte de démarrage et reconstruction de session

### 1.1 Situation héritée

La session a démarré depuis un résumé de compaction. Le contexte résumé indiquait que :
- Un audit visuel via Chrome MCP avait été réalisé sur l'UI à `localhost:1420`
- Le bug de mélange thème dark/light avait été identifié et partiellement corrigé (commit `00d0467`)
- Trois éléments de la roadmap `REFONTE_PANNEAUX_ATLAS_V3.md` avaient été identifiés comme manquants

### 1.2 Premier réflexe : lire l'état réel des fichiers

La première action a consisté à lire les fichiers sources directement plutôt que de se fier uniquement au résumé. Cette discipline est essentielle car les résumés de compaction peuvent omettre des détails d'implémentation importants.

Fichiers lus en priorité :
- `ui/index.html` (lignes 480–800) — structure des panneaux HTML
- `ui/src/vanilla-theme-override.css` — état des overrides CSS
- `ui/src/main.ts` (plusieurs sections) — logique JS des fiches mailles
- `ui/src/map-style.ts` — exports des fonctions de zones

### 1.3 Ce que la lecture a révélé

Lecture de `vanilla-theme-override.css` : le fix du commit `00d0467` était bien en place avec les sélecteurs CSS attribut :

```css
:root:not(.dark) [style*="background:#0f172a"],
:root:not(.dark) [style*="background: #0f172a"] {
  background: var(--card-bg) !important;
  border-color: var(--card-border) !important;
}
```

Ces règles ciblaient les attributs `style` inline hardcodés dans `index.html`. La stratégie reposait sur le fait que les inline styles ne peuvent pas être overridés par CSS ordinaire — seul `!important` combiné à un sélecteur d'attribut plus spécifique permet cela.

Lecture de `main.ts` autour de `renderMailleHeader` (ligne 1974) : les fonctions `renderMailleHeader` et `renderMailleHeaderMinimal` existaient, mais ne peuplaient pas les nouveaux éléments HTML prévus par la roadmap.

Lecture de `map-style.ts` lignes 25–90 : la Map privée `zoneMailleCodes` contenait les compteurs de mailles par zone, mais sans export. La fonction `getZonesForMaille` était exportée, mais pas de compteur de mailles par zone.

---

## 2. Audit de conformité roadmap REFONTE_PANNEAUX_ATLAS_V3

### 2.1 Document de référence

Le fichier `docs/RAPPORT/ux/REFONTE_PANNEAUX_ATLAS_V3.md` définit une roadmap UI complète pour les deux panneaux de l'Atlas. L'audit a comparé ce que l'UI présentait réellement vs. ce qui était spécifié.

### 2.2 Résultat de l'audit

| Élément roadmap | Statut avant session |
|---|---|
| Panneau gauche Niveau 0 — KPI globaux (mailles, sondages) | ✅ présent |
| Panneau gauche Niveau 0 — Répartition des essais (6 types) | ✅ présent |
| Panneau gauche Niveau 0 — Profondeurs d'investigation globales | ✅ présent |
| Panneau gauche Niveau 0 — Indicateur d'argilosité global | ✅ présent |
| Panneau gauche Niveau 0 — **Zones d'étude actives (5 badges)** | ❌ absent |
| Panneau gauche Niveau 1 — Fiche maille : code + badges | ✅ présent |
| Panneau gauche Niveau 1 — **Localisation ADM Région › Préfecture › Commune** | ❌ absent |
| Panneau gauche Niveau 1 — **Actions [Gérer sondages] [Exporter PDF]** | ❌ absent |
| Thème clair — panneaux avec fond blanc | ❌ fonds sombres hardcodés |
| Panneau droit — filtres ADM + thématiques | ✅ présent |

Trois éléments manquants et un bug de thème à corriger.

### 2.3 Décision de priorisation

L'ordre d'implémentation a été décidé comme suit :
1. Fix thème (fondamental — affecte la lisibilité globale)
2. Zones actives (impact visuel immédiat — panneau gauche)
3. Breadcrumb ADM (valeur métier haute — contexte géographique immédiat)
4. Boutons d'actions (UX — accès direct depuis la fiche)

---

## 3. Diagnostic du bug de thème (dark/light mixing)

### 3.1 Nature du problème

L'UI proposait un toggle light/dark via une classe `.dark` sur `<html>`. En mode clair (sans `.dark`), les panneaux latéraux devaient afficher des fonds blancs. Mais plusieurs sections montraient des fonds navy foncés (`#0f172a`) en mode clair.

### 3.2 Identification de la cause racine

La lecture de `index.html` a révélé que les sections statistiques avaient des backgrounds hardcodés en inline styles :

```html
<!-- Ligne 503 -->
<div id="essaisTypeStats" 
     style="margin-top:12px;padding:10px;background:#0f172a;border-radius:8px;border:1px solid #1c2843">
```

Et leurs sous-éléments :
```html
<!-- Ligne 506 -->
<div style="display:flex;justify-content:space-between;padding:3px 6px;background:#0a1018;border-radius:4px">
```

Le problème est fondamental en CSS : **un inline `style=""` a une spécificité plus haute que toute règle CSS ordinaire** (y compris les sélecteurs complexes de classes multiples). La seule façon de l'override sans modifier le HTML source est d'utiliser `!important` combiné à un sélecteur d'attribut.

### 3.3 Pourquoi ne pas simplement modifier les HTML inline styles ?

La tentation évidente serait de remplacer `background:#0f172a` par `background:var(--card-bg)` directement dans le HTML. Trois raisons ont conduit à préférer la solution CSS :

1. **Maintenabilité** : le HTML contient des dizaines de ces inline styles. Les modifier tous augmente le risque d'introduction d'erreurs.
2. **Réversibilité** : la solution CSS dans un fichier séparé (`vanilla-theme-override.css`) est plus facile à retirer ou ajuster.
3. **Séparation des préoccupations** : la logique de thème appartient au CSS, pas au HTML structurel.

### 3.4 Mécanisme CSS adopté

```css
/* Sélecteur d'attribut avec substring match (*=) */
:root:not(.dark) [style*="background:#0f172a"] {
  background: var(--card-bg) !important;
  border-color: var(--card-border) !important;
}
```

La pseudo-classe `:root:not(.dark)` s'active uniquement quand la classe `.dark` est ABSENTE de `<html>`. Le sélecteur `[style*="background:#0f172a"]` cible tout élément dont l'attribut style contient cette valeur hex. Le `!important` permet de gagner contre la spécificité inline.

**Variante avec espace** : les valeurs CSS peuvent parfois contenir un espace après les deux-points (`background: #0f172a`). Les deux formes ont été couvertes.

---

## 4. Fix thème — CSS attribute selectors

### 4.1 Fichier modifié : `ui/src/vanilla-theme-override.css`

Le fix a été ajouté avant la section "D3 focus states". L'ordre dans le fichier n'affecte pas la spécificité, mais respecte une logique de lecture : d'abord les règles structurelles globales, ensuite les règles D3.

Voici le bloc complet ajouté (reproduit pour traçabilité) :

```css
/* ── Light mode — override inline dark backgrounds hardcodés ─────────────── */
:root:not(.dark) [style*="background:#0f172a"],
:root:not(.dark) [style*="background: #0f172a"] {
  background: var(--card-bg) !important;
  border-color: var(--card-border) !important;
}
:root:not(.dark) [style*="background:#0a1018"],
:root:not(.dark) [style*="background: #0a1018"] {
  background: var(--field) !important;
  border-color: var(--field-border) !important;
}
:root:not(.dark) [style*="border:1px solid #1c2843"] {
  border-color: var(--card-border) !important;
}

/* Classes hardcodées dark → light */
:root:not(.dark) .test-item,
:root:not(.dark) .maille-header,
:root:not(.dark) .kpi-card,
:root:not(.dark) .survey-card,
:root:not(.dark) .sondage-item,
:root:not(.dark) .btn-sm,
:root:not(.dark) .essai-header,
:root:not(.dark) .essai-content {
  background: var(--card-bg) !important;
  border-color: var(--card-border) !important;
}
/* ... + hover, forms, panels thématiques */
```

### 4.2 Variables CSS utilisées

Les variables sont définies dans `index.html` en tête de `<style>` :

```css
/* Mode clair */
:root {
  --card-bg: #ffffff;
  --card-border: #e2e8f0;
  --field: #f8fafc;
  --field-border: #cbd5e1;
  --bg: #f1f5f9;
  --panel: #ffffff;
  --text: #1e293b;
  --muted: #64748b;
  --accent: #2563EB;
}
/* Mode sombre */
:root.dark {
  --card-bg: #0f172a;
  --card-border: #1c2843;
  --field: #0a1018;
  --field-border: #1e2d4a;
  --bg: #060d19;
  --panel: #0a1018;
  --text: #e2e8f0;
  --muted: #94a3b8;
  --accent: #3b82f6;
}
```

Ce dual-pattern light/dark via custom properties permet à la correction CSS d'être automatiquement adaptative : le même fix fonctionne dans les deux modes sans branchement logique JS.

### 4.3 Commit associé

Commit `00d0467` — réalisé en session précédente, validé visuellement dans Chrome via MCP.

---

## 5. Implémentation Niveau 0 — Zones d'étude actives (badges)

### 5.1 Contexte fonctionnel

La roadmap spécifie pour le Niveau 0 (vue globale du panneau gauche) : "Zones d'étude actives : 5 badges colorés avec compteur mailles". Ces 5 zones sont les formations géologiques d'intérêt prioritaires pour le krigeage :

- **Dépression de la Lama** (`DEPRESSION_LAMA_TG`) — RGA Très Fort, argiles smectitiques
- **Dépression du Bado** (`DEPRESSION_BADO_TG`) — RGA Fort, extension Lama
- **Plaine du Mono** (`PLAINE_MONO_TG`) — RGA Fort, alluvions holocènes
- **Plaine de l'Oti** (`PLAINE_OTI_TG`) — RGA Moyen, kaolinite dominante
- **Fosse aux Lions** (`FOSSE_LIONS_TG`) — RGA Très Fort, 7 km² seulement

### 5.2 Analyse du data flow existant

L'investigation du code a révélé une architecture en deux couches :

**Couche données** (`map-style.ts`) :
- `zoneMailleCodes: Map<string, Set<string>>` — Map privée, non exportée
- `setZoneMailleMetadata(code, mailles)` — peuple ces maps depuis l'API
- `getZonesForMaille(mailleCode)` — exportée, retourne les zones d'une maille

**Couche chargement** (`main.ts`) :
- `loadAllZoneMailleCodes()` — appelle l'API `/zones-etude/{code}/mailles` pour les 5 zones
- Appelée au démarrage de l'application

Le problème : `zoneMailleCodes.size` (le compteur de mailles par zone) n'était pas accessible depuis `main.ts` car la Map était privée au module `map-style.ts`.

### 5.3 Décision d'architecture : export minimal

Deux approches possibles :
- **Option A** : Exporter la Map entière `zoneMailleCodes` → expose trop de données, viole l'encapsulation
- **Option B** : Exporter une fonction `getZoneMailleCount(code) → number` → interface minimale, respecte l'encapsulation

L'Option B a été retenue. La fonction ajoutée dans `map-style.ts` :

```typescript
/** Retourne le nombre de mailles enregistrées pour une zone. */
export function getZoneMailleCount(zoneCode: string): number {
  return zoneMailleCodes.get(String(zoneCode || '').toUpperCase().trim())?.size ?? 0
}
```

Nota : le `.toUpperCase().trim()` normalise l'entrée de la même façon que `setZoneMailleMetadata` qui normalise déjà le code zone (`const code = String(zoneCode || '').toUpperCase().trim()`). Cohérence de traitement garantie.

### 5.4 HTML ajouté dans `index.html`

Le bloc a été inséré à l'intérieur de la `<div class="section">` existante, après `#argilositeStats` et avant `#campaignPlannerSection`. Ce placement est sémantiquement correct : c'est une information de niveau global (Niveau 0), au même rang que les statistiques des essais.

```html
<!-- Niveau 0 — Zones d'étude actives (5 badges colorés + compteur mailles) -->
<div id="zonesEtudeActivesBadges" 
     style="margin-top:12px;padding:10px;background:#0f172a;border-radius:8px;border:1px solid #1c2843">
  <div style="font-size:10px;color:var(--accent);font-weight:600;margin-bottom:8px;
              letter-spacing:0.08em;text-transform:uppercase">Zones d'étude actives</div>
  <div id="zonesEtudeActivesGrid" style="display:flex;flex-wrap:wrap;gap:5px">
    <span style="font-size:10px;color:var(--muted)">Chargement…</span>
  </div>
</div>
```

Note importante : `background:#0f172a` est hardcodé ici INTENTIONNELLEMENT pour le mode sombre. En mode clair, le CSS override de `vanilla-theme-override.css` prend le relais automatiquement via le sélecteur `[style*="background:#0f172a"]`. Cette cohérence de pattern est essentielle pour que le fix CSS générique s'applique aussi à ce nouveau bloc.

### 5.5 Fonction JS `refreshZonesEtudePanel()`

La fonction a été placée dans `main.ts` juste avant `loadLamaMailleCodes` (qui est dépréciée), et appelée à la fin de `loadAllZoneMailleCodes()` :

```typescript
function refreshZonesEtudePanel(): void {
  const grid = document.getElementById('zonesEtudeActivesGrid')
  if (!grid) return
  const ZONES = [
    { code: 'DEPRESSION_LAMA_TG', label: 'Lama',  color: '#F59E0B' },
    { code: 'DEPRESSION_BADO_TG', label: 'Bado',  color: '#EF4444' },
    { code: 'PLAINE_MONO_TG',     label: 'Mono',  color: '#10B981' },
    { code: 'PLAINE_OTI_TG',      label: 'Oti',   color: '#0EA5E9' },
    { code: 'FOSSE_LIONS_TG',     label: 'Fosse', color: '#8B5CF6' },
  ]
  grid.innerHTML = ZONES.map(z => {
    const count = getZoneMailleCount(z.code)
    return `<span style="display:inline-flex;align-items:center;gap:4px;
      padding:3px 8px;border-radius:12px;
      border:1px solid ${z.color}55;background:${z.color}18;
      font-size:10px;color:${z.color};font-weight:500;white-space:nowrap">
      <span style="width:7px;height:7px;border-radius:50%;
        background:${z.color};flex-shrink:0"></span>
      ${z.label}
      <span style="background:${z.color}33;border-radius:8px;
        padding:0 5px;font-weight:700;margin-left:2px">${count}</span>
    </span>`
  }).join('')
}
```

**Choix de design du badge** : chaque badge est un `<span>` flex avec :
- Pastille circulaire colorée (7×7px)
- Nom court de la zone
- Compteur en bulle semi-opaque (couleur×33 = 20% opacité)

Les couleurs sont cohérentes avec `ZONE_PASTEL_COLORS` dans `map-style.ts` et avec les `.zone-dot--lama/bado/mono/oti/fosse` dans `thematic-maps.css`. La cohérence colorimétrique à travers tout le système est maintenue.

**Timing d'appel** : la fonction est appelée après `Promise.all(promises)` dans `loadAllZoneMailleCodes()`, garantissant que les 5 zones sont toutes chargées avant d'afficher les compteurs.

```typescript
async function loadAllZoneMailleCodes(): Promise<void> {
  const promises = ALL_ZONE_CODES.map(async (code) => {
    // ... fetch API ...
    setZoneMailleMetadata(code, mailles || [])
    // ...
  })
  await Promise.all(promises)
  if (gridLayer) {
    gridLayer.setStyle((feature: any) => styleFeature(feature))
  }
  refreshZonesEtudePanel()  // ← ajout ici
}
```

---

## 6. Implémentation Niveau 1 — Breadcrumb ADM

### 6.1 Contexte fonctionnel

La roadmap spécifie pour le Niveau 1 (fiche maille) : "Localisation ADM : Région › Préfecture › Commune". Actuellement, la fiche affichait l'ADM comme une chaîne concaténée dans `#ficheAdm` (`ficheAdm.textContent = admPath || '—'`). La roadmap demande un breadcrumb stylistiquement différencié avec les séparateurs `›` entre niveaux.

### 6.2 Analyse de l'existant : `ficheAdm` vs. `ficheAdmBreadcrumb`

L'élément `#ficheAdm` existant affichait déjà le texte ADM (pour la compatibilité avec les lecteurs d'écran et les exports). La décision a été de **ne pas modifier** cet élément mais d'en ajouter un nouveau (`#ficheAdmBreadcrumb`) pour le rendu visuel enrichi. Raisons :

1. `#ficheAdm` est peut-être utilisé ailleurs (recherche textuelle, exports)
2. Ajouter un overlay plutôt que remplacer minimise le risque de régression
3. On peut désactiver l'un des deux si nécessaire sans toucher à l'autre

Le separator `' > '` dans `ficheAdm.textContent` a été mis à jour en `' › '` (caractère U+203A) pour la cohérence visuelle avec le nouveau breadcrumb.

### 6.3 HTML inséré dans `index.html`

Placement : dans `.maille-header`, après `#ficheZoneBadges` et avant `#ficheAssignment`.

```html
<!-- C1 Niveau 1 — Localisation ADM Région › Préfecture › Commune -->
<div id="ficheAdmBreadcrumb" 
     style="display:none;margin-top:6px;font-size:11px;color:var(--muted);line-height:1.6">
  <span id="ficheAdmRegion" style="font-weight:500;color:var(--text)"></span>
  <span id="ficheAdmSep1" style="display:none;opacity:0.5;margin:0 4px">›</span>
  <span id="ficheAdmPref"></span>
  <span id="ficheAdmSep2" style="display:none;opacity:0.5;margin:0 4px">›</span>
  <span id="ficheAdmCommune" style="font-weight:500"></span>
</div>
```

Design de l'implémentation : chaque niveau ADM est un `<span>` séparé, avec les séparateurs `›` dans leurs propres spans. Cette architecture permet d'afficher/masquer les séparateurs de façon granulaire (si une commune n'est pas disponible, `sep2` et `ficheAdmCommune` sont masqués).

### 6.4 Logique JS dans `renderMailleHeader()`

```typescript
// C1 — Breadcrumb ADM détaillé Région › Préfecture › Commune
const ficheAdmBreadcrumb = document.getElementById('ficheAdmBreadcrumb')
if (ficheAdmBreadcrumb) {
  const region = metrics.region || ''
  const pref = metrics.prefecture || ''
  const commune = metrics.commune || ''
  const elRegion = document.getElementById('ficheAdmRegion')
  const elSep1 = document.getElementById('ficheAdmSep1')
  const elPref = document.getElementById('ficheAdmPref')
  const elSep2 = document.getElementById('ficheAdmSep2')
  const elCommune = document.getElementById('ficheAdmCommune')
  if (elRegion) elRegion.textContent = region
  if (elSep1) elSep1.style.display = (region && pref) ? 'inline' : 'none'
  if (elPref) elPref.textContent = pref
  if (elSep2) elSep2.style.display = (pref && commune) ? 'inline' : 'none'
  if (elCommune) elCommune.textContent = commune
  ficheAdmBreadcrumb.style.display = (region || pref || commune) ? 'block' : 'none'
}
```

La logique conditionne l'affichage de chaque séparateur à la présence de DEUX valeurs de part et d'autre. Si `metrics.commune` est null (données manquantes), `ficheAdmSep2` reste caché. Le breadcrumb entier se masque si aucune donnée ADM n'est disponible.

### 6.5 Masquage dans `renderMailleHeaderMinimal()`

```typescript
// Dans renderMailleHeaderMinimal — maille sans données
const ficheAdmBreadcrumb = document.getElementById('ficheAdmBreadcrumb')
if (ficheAdmBreadcrumb) ficheAdmBreadcrumb.style.display = 'none'
const ficheActions = document.getElementById('ficheActions')
if (ficheActions) ficheActions.style.display = 'none'
```

Cette symétrie est nécessaire : si l'utilisateur passe d'une maille avec données à une maille sans données, les éléments Niveau 1 doivent se rétracter. Sans ce code, les valeurs de la fiche précédente resteraient affichées (état "zombie").

---

## 7. Implémentation Niveau 1 — Boutons d'actions

### 7.1 Fonctionnalité requise par la roadmap

La roadmap spécifie : "Actions : [Gérer sondages] [Exporter fiche PDF]".

### 7.2 Implémentation [Gérer sondages]

Ce bouton devait permettre un accès direct aux sondages de la maille ouverte. L'analyse du code a montré qu'un bouton "Gérer" existait déjà (`#btnOpenSondagesManager`) mais il était :
- Visible uniquement depuis la section "Sondages de la maille" (bas de fiche)
- Masqué si la maille n'avait pas de sondages

Le nouveau bouton d'action `#btnFicheGererSondages` dans le header résout la discoverability : l'utilisateur voit immédiatement les actions disponibles sans scroller.

Comportement implémenté :
```typescript
btnFicheGererSondages.addEventListener('click', () => {
  const surveysList = document.getElementById('cellSurveysList')
  if (surveysList) surveysList.scrollIntoView({ behavior: 'smooth', block: 'start' })
})
```

Plutôt que de dupliquer l'ouverture du gestionnaire (qui ouvre une nouvelle page via `window.location.hash`), le scroll vers `#cellSurveysList` offre un accès contextuel sans quitter la vue courante. L'ouverture du gestionnaire complet reste accessible via le bouton "Gérer" existant.

### 7.3 Implémentation [Exporter PDF]

```typescript
btnFicheExportPdf.addEventListener('click', () => {
  window.print()
})
```

`window.print()` déclenche l'impression du navigateur. En l'absence d'une feuille CSS `@media print` dédiée, le résultat n'est pas parfait mais fonctionnel. Une feuille `@media print` personnalisée pourrait être ajoutée ultérieurement pour masquer le topbar, le panneau droit, la carte, et n'imprimer que la fiche maille.

### 7.4 HTML des boutons

```html
<!-- Niveau 1 — Actions -->
<div id="ficheActions" style="display:none;margin-top:10px;gap:6px">
  <button id="btnFicheGererSondages" 
    style="flex:1;font-size:10px;padding:5px 8px;background:#4c6ef522;
           border:1px solid #4c6ef5;color:#4c6ef5;border-radius:5px;
           cursor:pointer;font-weight:500">
    Gérer sondages
  </button>
  <button id="btnFicheExportPdf" 
    style="flex:1;font-size:10px;padding:5px 8px;background:#64748b22;
           border:1px solid #64748b;color:var(--muted);border-radius:5px;
           cursor:pointer;font-weight:500">
    Exporter PDF
  </button>
</div>
```

Note technique : le `display:none` initial permet la gestion JS (`ficheActions.style.display = 'flex'` lors de l'ouverture). Le `gap:6px` dans le style inline est ignoré quand `display:none` — il ne s'applique qu'une fois que JS passe la div en `flex`. C'est une subtilité CSS : un élément `display:none` ne rend pas ses propriétés de layout.

---

## 8. Analyse de la logique métier `pct_intersection`

### 8.1 Question posée

L'utilisateur a remarqué que les bordures de mailles dans les zones affichaient deux teintes de la même couleur par zone. La question : y a-t-il une logique métier derrière ce dégradé ?

### 8.2 Code source de la symbologie

Dans `map-style.ts`, la fonction `getGridFeatureStyle()` calcule la couleur de bordure de chaque maille :

```typescript
// ZONE_PASTEL_COLORS — deux couleurs par zone
export const ZONE_PASTEL_COLORS: Record<string, { from: string; to: string; hex: string }> = {
  DEPRESSION_LAMA_TG: { from: '#FDE68A', to: '#B45309', hex: '#F59E0B' },  // Ambre clair → Ambre foncé
  DEPRESSION_BADO_TG: { from: '#FCA5A5', to: '#B91C1C', hex: '#EF4444' },  // Rouge clair → Rouge foncé
  PLAINE_MONO_TG:     { from: '...',     to: '...',     hex: '#10B981' },   // Vert clair → Vert foncé
  // ...
}
```

Et l'interpolation :
```typescript
const colors = ZONE_PASTEL_COLORS[dominantZone.zoneCode]
if (colors) {
  strokeColor = interpolateZoneStroke(colors.from, colors.to, dominantZone.pct)
}
```

**La couleur de bordure encode le `pct_intersection`** : faible pct → `from` (pastel clair), fort pct → `to` (saturé foncé).

### 8.3 Signification cartographique

C'est une choroplèthe du degré d'appartenance : les mailles au cœur de la zone (fort pct) ont une bordure plus intense que les mailles en bordure (faible pct). Cette représentation est pertinente géologiquement : les mailles à fort pourcentage sont celles dont la majorité de la surface est couverte par la formation argileuse, et donc les plus critiques pour les essais géotechniques.

---

## 9. Analyse du document scientifique RÉSULTAT — Délimitation des zones

### 9.1 Document lu

`docs/DEPRESSION DE LAMA/RESULTAT — Délimitation des zones géologiques du Togo.md` — rapport d'expertise scientifique (2166 lignes).

### 9.2 Logique métier formalisée dans le document

Le document §1.6 (Lama), §3.6 (Fosse), §6 (Synthèse) établit deux seuils numériques clés :

**Seuil d'inclusion à 10%** (§6, Synthèse) :
> *"La règle d'association spatiale fixée à 10 % (soit 0,4 km² d'intersection) est suffisante pour basculer le pixel dans une catégorie de risque RGA spécifique."*

**Seuil de priorité à 50%** (§1.6 et §6) :
> *"Les mailles présentant une intersection supérieure ou égale à 50 % devront être marquées d'un drapeau d'alerte dans le système d'ordres de mission, imposant systématiquement des prélèvements non remaniés (carottages) lors des futures campagnes de sondages."*

### 9.3 Table des tiers formalisée

| pct_intersection | Tier | Signification | Action terrain |
|---|---|---|---|
| `< 10%` | Exclue | Pas de formation argileuse significative | Aucune |
| `10% ≤ pct < 50%` | Bordure | RGA actif, covariable KED activée | Investigation standard |
| `pct ≥ 50%` | Cœur | Formation majoritaire, Priorité 1 | Carottage lourd obligatoire |

### 9.4 Correspondance avec le panneau existant

Le panneau `ZoneEtudePanel` reflétait déjà partiellement ces seuils :
- Tab "Priorité 1" = `priorite_recherche === 1` ← correspond au tier Cœur (pct ≥ 50%)
- Tab "À investiguer" = `statut_donnees === 'aucune_donnee'` ← correspond aux mailles sans sondages (tous tiers confondus)

**Lacune identifiée** : aucun filtre pour les mailles déjà documentées (`nb_sondages > 0`). Pour le krigeage, ces mailles sont les points d'ancrage les plus précieux — l'équipe terrain doit pouvoir les visualiser rapidement pour planifier les interpolations.

### 9.5 Minéralogie spécifique par zone

Le document révèle des spécificités minéralogiques importantes pour la modélisation :
- **Lama/Bado** : attapulgite + montmorillonite → retrait-gonflement maximal (argiles 2:1)
- **Fosse aux Lions** : illite + smectites néoprotérozoïques → retrait-gonflement élevé
- **Mono** : argiles de décantation smectitiques post-Nangbéto → fort RGA
- **Oti** : kaolinite dominante (argile 1:1) → **RGA Moyen seulement** — la kaolinite ne gonfle pas

Cette différenciation minéralogique justifie l'encodage du RGA comme covariable distincte par zone dans le KED, et non comme un paramètre uniforme.

---

## 10. Diagnostic des défauts de thème dans ZoneEtudePanel

### 10.1 Observation

L'utilisateur a fourni une capture d'écran du modal de la zone Lama montrant :
- Cartes KPI avec fond sombre (navy)
- Items de mailles avec fond sombre
- Badges "minéraux argileux" sur fond gris clair mal visible en dark mode
- Bouton de fermeture sans état hover visible en dark mode

### 10.2 Investigation du code source

Lecture de `ZoneEtudePanel.tsx` (199 lignes) : AUCUNE classe Tailwind `dark:*` dans tout le fichier. Le composant a été conçu uniquement pour le mode clair.

Exemple caractéristique :
```tsx
// Avant — sans dark: variants
<div className="rounded-lg border border-slate-200 bg-white p-3">
  <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
  <div className="text-xs text-slate-600">Mailles totales</div>
</div>
```

Lecture de `zone-etude-modal.tsx` ligne 139 :
```tsx
<div className="relative z-[90] h-[90vh] w-full max-w-3xl overflow-hidden 
               rounded-2xl bg-white shadow-xl dark:bg-slate-900 
               border border-slate-200 dark:border-slate-700">
```

Le conteneur modal avait ses variants dark, mais le contenu (ZoneEtudePanel) non. En dark mode, cela donnait : fond `bg-slate-900` pour le container, éléments internes `bg-white` pour les cartes — blanc sur navy. Paradoxalement lisible, mais incohérent avec le design system du reste de l'application.

### 10.3 Absence du filtre "Avec sondages"

`ZoneEtudeFilter` était défini comme :
```typescript
export type ZoneEtudeFilter = 'tous' | 'prio1' | 'sans_donnees'
```

La stat `avecSondages` était CALCULÉE dans `stats` mais jamais exposée comme filtre :
```typescript
const avecSondages = mailles.filter(m => m.nb_sondages > 0).length  // calculé...
// mais aucun bouton ne pointait vers ce filtre
```

---

## 11. Implémentation Solution 1 — Filtre "Avec sondages"

### 11.1 Changements apportés dans `ZoneEtudePanel.tsx`

**Type étendu** :
```typescript
export type ZoneEtudeFilter = 'tous' | 'prio1' | 'sans_donnees' | 'avec_sondages'
```

**Logique de filtrage** :
```typescript
const maillesFiltrees = useMemo(() => {
  if (filter === 'prio1') return mailles.filter(m => m.priorite_recherche === 1)
  if (filter === 'sans_donnees') return mailles.filter(m => m.statut_donnees === 'aucune_donnee')
  if (filter === 'avec_sondages') return mailles.filter(m => m.nb_sondages > 0)
  return mailles
}, [filter, mailles])
```

**Bouton tab** :
```tsx
<Button
  variant={filter === 'avec_sondages' ? 'primary' : 'outline'}
  size="sm"
  onClick={() => setFilter('avec_sondages')}
>
  Avec sondages ({stats.avecSondages})
</Button>
```

### 11.2 Impact fonctionnel

Pour la zone Lama (334 mailles, 4 avec sondages), le tab "Avec sondages (4)" permet à l'équipe terrain d'identifier immédiatement les 4 mailles déjà investiguées — points d'ancrage pour l'interpolation KED. Avant ce fix, retrouver ces 4 mailles nécessitait de scroller toute la liste de 334 items ou d'exporter en CSV pour filtrer.

---

## 12. Implémentation Solution 2 — Dark mode Tailwind sur ZoneEtudePanel

### 12.1 Stratégie d'application des dark: variants

Pour chaque classe Tailwind light-mode, la classe dark: correspondante a été ajoutée. Le mapping systématique :

| Classe originale | Classe dark: ajoutée | Raison |
|---|---|---|
| `border-slate-200` | `dark:border-slate-700` | Bordure invisible sur fond sombre |
| `bg-white` | `dark:bg-slate-800` | Carte sur fond container slate-900 |
| `text-slate-900` | `dark:text-slate-100` | Texte principal lisible |
| `text-slate-600/700` | `dark:text-slate-400/300` | Texte secondaire lisible |
| `bg-slate-100` | `dark:bg-slate-700` | Badges sur fond sombre |
| `bg-slate-50` | `dark:bg-slate-800/50` | Fond vide (dashed border) |
| `hover:bg-slate-50` | `dark:hover:bg-slate-700/60` | State hover visible |
| `hover:bg-slate-100` | `dark:hover:bg-slate-700` | Bouton fermeture |

### 12.2 Exemples avant/après

**Carte KPI — Avant** :
```tsx
<div className="rounded-lg border border-slate-200 bg-white p-3">
  <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
  <div className="text-xs text-slate-600">Mailles totales</div>
</div>
```

**Carte KPI — Après** :
```tsx
<div className="rounded-lg border border-slate-200 dark:border-slate-700 
               bg-white dark:bg-slate-800 p-3">
  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</div>
  <div className="text-xs text-slate-600 dark:text-slate-400">Mailles totales</div>
</div>
```

**Item maille — Avant** :
```tsx
<button className="w-full rounded-xl border border-slate-200 bg-white p-3 
                  text-left hover:bg-slate-50">
```

**Item maille — Après** :
```tsx
<button className="w-full rounded-xl border border-slate-200 dark:border-slate-700 
                  bg-white dark:bg-slate-800 p-3 text-left 
                  hover:bg-slate-50 dark:hover:bg-slate-700/60"
        style={{ borderLeftWidth: '3px', borderLeftColor: tierBorderColor }}>
```

### 12.3 Note sur la coexistence inline style + Tailwind

Le tier indicator (bordure gauche colorée) utilise un `style` inline car Tailwind ne permet pas facilement les couleurs dynamiques (couleur calculée à runtime). La coexistence entre inline style (pour `border-left`) et classes Tailwind (pour le reste) est gérée via la priorité CSS standard : `border-left-color` inline (`border-left-color: #d32f2f`) est distinct de `border-color` Tailwind (`border-slate-200`). Pas de conflit.

---

## 13. Implémentation Solution 3 — Indicateur visuel de tier d'appartenance

### 13.1 Ajout de la bordure gauche colorée

La bordure gauche (3px colorée) encode visuellement le tier sans nécessiter de lecture du pourcentage. Logique :

```typescript
// pct >= 50% → cœur → rouge (Priorité 1 / carottage)
// pct < 50% → bordure → orange (investigation standard)
const tierBorderColor = m.pct_intersection >= 50 ? '#d32f2f' : '#f57c00'
```

Ce seuil à 50% correspond exactement au seuil "Priorité 1 + carottage lourd" documenté dans §1.6 et §6 du rapport scientifique. L'implémentation est donc alignée sur la logique métier.

### 13.2 Badge "Cœur — carottage" conditionnel

Pour les mailles dont pct ≥ 50%, un badge d'alerte supplémentaire est affiché :

```tsx
{m.pct_intersection >= 50 && (
  <span className="rounded-md bg-red-100 dark:bg-red-900/30 px-2 py-1 
                  text-red-700 dark:text-red-400 font-semibold">
    Cœur — carottage
  </span>
)}
```

Ce badge traduit directement la recommandation du rapport : "imposant systématiquement des prélèvements non remaniés (carottages)". L'utilisateur terrain voit immédiatement quelles mailles nécessitent un équipement spécialisé.

### 13.3 Cohérence avec les couleurs existantes

`#d32f2f` (rouge) est la couleur de `PRIORITE_COLORS[1]` dans le composant. Utiliser la même couleur pour la bordure gauche ET le badge Priorité 1 crée une cohérence visuelle : tout ce qui est rouge signifie "prioritaire/carottage".

---

## 14. Build final et vérification

### 14.1 Builds réalisés pendant la session

**Build 1** — Après les 3 implémentations roadmap (zones actives, breadcrumb ADM, boutons actions) :
```
✓ built in 15.85s
2429 modules transformed
```
Aucune erreur TypeScript.

**Build 2** — Après implémentation ZoneEtudePanel (filtre + dark mode) :
```
✓ built in 12.44s
```
Aucune erreur TypeScript.

### 14.2 Avertissement chunk size

Les deux builds ont émis l'avertissement :
```
(!) Some chunks are larger than 1500 kB after minification.
    vendor-export-CAtOY-7-.js  1,537.85 kB │ gzip: 448.51 kB
```

Cet avertissement est antérieur à cette session et concerne les bibliothèques d'export (jsPDF, etc.). Il ne bloque pas la production et est documenté comme point ouvert.

### 14.3 Vérification visuelle

L'UI a été vérifiée visuellement par capture d'écran fournie par l'utilisateur. Les éléments confirmés fonctionnels :
- Section "Zones d'étude actives" visible avec les 5 badges (Lama 334, Bado 258, Mono 379, Oti 388, Fosse 11)
- Badges colorés cohérents avec la légende de la carte

---

## 15. Synthèse des fichiers modifiés

### 15.1 Liste complète des modifications

| Fichier | Type de modification | Impact |
|---|---|---|
| `ui/src/vanilla-theme-override.css` | Ajout de règles CSS override | Fix thème dark/light pour panels inline-hardcoded |
| `ui/index.html` | Ajout HTML : 3 blocs nouveaux | Zones actives, breadcrumb ADM, boutons actions |
| `ui/src/map-style.ts` | Ajout export `getZoneMailleCount()` | Compteur mailles accessible depuis main.ts |
| `ui/src/main.ts` | Import + 3 fonctions + 2 handlers | Alimentation dynamique des 3 nouveaux éléments |
| `ui/src/components/ZoneEtudePanel.tsx` | Réécriture complète | Filtre avec_sondages + dark: variants Tailwind |

### 15.2 Détail des modifications `main.ts`

5 modifications distinctes dans `main.ts` :

1. **Import** : `getZoneMailleCount` ajouté à l'import depuis `./map-style`

2. **Nouvelle fonction** `refreshZonesEtudePanel()` : affiche les 5 badges zones avec compteurs dynamiques

3. **Appel** : `refreshZonesEtudePanel()` ajouté à la fin de `loadAllZoneMailleCodes()` (après le Promise.all)

4. **Mise à jour** `renderMailleHeader()` : 
   - ADM breadcrumb (région/pref/commune avec spans séparés)
   - Affichage des boutons d'actions via `ficheActions.style.display = 'flex'`

5. **Mise à jour** `renderMailleHeaderMinimal()` :
   - Masquage breadcrumb ADM
   - Masquage boutons d'actions

6. **Handlers** près de `initCloseMailleActions()` :
   - `btnFicheGererSondages` → scroll vers `#cellSurveysList`
   - `btnFicheExportPdf` → `window.print()`

---

## 16. Points ouverts et perspectives

### 16.1 Points non résolus en cette session

**A — CSS print media pour export PDF**

Le bouton "Exporter PDF" appelle `window.print()`. Sans `@media print` dédié, le rendu imprimé inclut le topbar, la carte Leaflet, et le panneau droit — des éléments sans valeur dans un PDF de fiche géotechnique. Une future session devrait ajouter :

```css
@media print {
  #topbar, #map, #sidebar, #thematicPanel { display: none !important; }
  #dashboard { width: 100% !important; }
  #mailleContent { page-break-inside: avoid; }
}
```

**B — Chunk size `vendor-export` > 1500 kB**

Le bundle d'export reste trop grand. Solution : lazy import de jsPDF/xlsx uniquement lors du clic sur "Exporter". Nécessite une refactorisation de l'import.

**C — Tiles offline Leaflet**

En l'absence de WiFi, les tuiles CartoDB Dark/Positron ne se chargent pas — la carte reste en OSM hors-ligne. Le switch de tuiles selon le thème est correct dans le code mais ne produit pas d'effet visible offline. Ce comportement est attendu et documenté dans `COMPILATION_SANS_WIFI.md`.

**D — Seuil 10% non implémenté en base**

Le document scientifique établit clairement que les mailles avec `pct_intersection < 10%` devraient être exclues de la zone. La validation en base (via PostGIS) que toutes les mailles listées dans `atlas.zones_etude_mailles` respectent ce seuil n'a pas été effectuée.

```sql
-- Requête de vérification à exécuter :
SELECT zone_code, COUNT(*) as nb_mailles_sous_seuil
FROM atlas.zones_etude_mailles
WHERE pct_intersection < 10
GROUP BY zone_code;
```

**E — Logique `statut_donnees` dans ZoneEtudePanel**

Le filtre "À investiguer" utilise `statut_donnees === 'aucune_donnee'`. Mais `statut_donnees = 'partiellement_documente'` représente aussi des mailles insuffisamment documentées pour le krigeage. Une future évolution pourrait fusionner ces deux cas dans un filtre "À compléter".

### 16.2 Perspectives d'amélioration

**Zoom automatique sur filtre "Avec sondages"**

Quand l'utilisateur clique "Avec sondages (N)", les N mailles documentées pourraient être surlignées sur la carte Leaflet (via un flash de couleur sur les features correspondantes). Cela nécessite un callback vers `main.ts` pour appliquer un style temporaire.

**Indicateur de couverture par tier**

Les stats actuelles montrent le nombre total de mailles avec sondages, mais pas la répartition par tier :
- Mailles cœur (pct ≥ 50%) avec sondages : données de krigeage les plus fiables
- Mailles bordure (10-50%) avec sondages : données de krigeage moins représentatives

Un graphique en stacked bar 2×2 (tier × sondages) donnerait une vision immédiate de la maturité de la zone.

**Breadcrumb cliquable**

Les spans du breadcrumb ADM (`ficheAdmRegion`, `ficheAdmPref`, `ficheAdmCommune`) pourraient être des liens qui déclenchent le filtre ADM correspondant dans la topbar. Actuellement, le filtre ADM nécessite de scroller jusqu'au breadcrumb principal (`#bcRegion`, `#bcPref`, `#bcCommune`).

---

## Annexe A — Chronologie des décisions techniques

| Heure approx. | Décision | Justification |
|---|---|---|
| T+0 | Lire les fichiers source avant d'agir | Résumé de compaction potentiellement incomplet |
| T+30 | CSS attribute selectors plutôt que modifier HTML | Maintenabilité, séparation des préoccupations |
| T+45 | Export `getZoneMailleCount()` minimal | Encapsulation de `zoneMailleCodes` |
| T+60 | Breadcrumb en spans séparés (pas de string concat) | Contrôle granulaire des séparateurs |
| T+75 | Scroll vers sondages (pas redirect) | Navigation non-destructive |
| T+90 | Lire document scientifique complet | Comprendre la logique métier avant d'implémenter |
| T+120 | Dark: variants Tailwind (pas CSS global) | Tailwind est le système de thème de ce composant React |
| T+135 | Bordure gauche comme indicateur de tier | Cohérence avec PRIORITE_COLORS existant |

---

## Annexe B — Patterns CSS retenus pour la session

### Pattern 1 : Override inline style avec attribute selector

```css
/* Ciblage d'inline styles non modifiables */
:root:not(.dark) [style*="background:#0f172a"] {
  background: var(--card-bg) !important;
}
```

**Quand l'utiliser** : inline styles hardcodés dans HTML généré ou legacy. Ne pas utiliser si le HTML peut être modifié directement (ajoute de la complexité CSS).

### Pattern 2 : Dual-theme via custom properties

```css
:root { --card-bg: #ffffff; }
:root.dark { --card-bg: #0f172a; }

/* Utilisation */
.card { background: var(--card-bg); }
```

**Avantage** : les composants vanilla-JS et React (inline styles) partagent le même système de variables. Pas besoin de Tailwind pour les composants legacy.

### Pattern 3 : Dark: variants Tailwind systématiques

```tsx
// Pattern de base pour tout composant React bi-modal
className="bg-white dark:bg-slate-800 
           border-slate-200 dark:border-slate-700 
           text-slate-900 dark:text-slate-100"
```

**Quand l'utiliser** : composants React avec classes Tailwind. Toujours préfixer toute classe de couleur avec son variant dark.

---

## Annexe C — Architecture des zones d'étude dans le système

```
                    ┌──────────────────────────────────────┐
                    │         API Backend                  │
                    │  GET /zones-etude/{code}/mailles     │
                    └───────────────┬──────────────────────┘
                                    │ maille_code + pct_intersection
                                    ▼
                    ┌──────────────────────────────────────┐
                    │         map-style.ts                 │
                    │  setZoneMailleMetadata()             │
                    │  zoneMailleCodes: Map<code, Set>     │ ← privé
                    │  zoneMailleMetaByCode: Map<code,Map> │ ← privé
                    │  getZonesForMaille() ← export        │
                    │  getZoneMailleCount() ← export NEW   │
                    └───────────────┬──────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────┐
                    │         main.ts                      │
                    │  loadAllZoneMailleCodes()            │
                    │  └→ refreshZonesEtudePanel() NEW     │
                    │  renderMailleHeader()                │
                    │  └→ breadcrumb ADM NEW               │
                    │  └→ ficheActions.display NEW         │
                    └───────────────┬──────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────┐
                    │  ZoneEtudePanel.tsx (React)          │
                    │  filter: tous|prio1|sans_donnees     │
                    │         |avec_sondages ← NEW         │
                    │  dark: variants Tailwind ← NEW       │
                    │  tier indicator border-left ← NEW    │
                    └──────────────────────────────────────┘
```

---

## Annexe D — Valeurs observées en production (Lama, 2026-06-15)

Zone DEPRESSION_LAMA_TG au moment de la session :

| Métrique | Valeur | Source |
|---|---|---|
| Mailles totales | 334 | zoneMailleCodes.size |
| Mailles avec sondages | 4 | nb_sondages > 0 |
| Mailles sans données | 330 | statut_donnees = 'aucune_donnee' |
| Priorité 1 (pct ≥ 50%) | 191 | priorite_recherche = 1 |
| Couverture données | 1% | 4/334 |
| Minéraux argileux | attapulgite, montmorillonite, kaolinite, illite | DB atlas |

Ces valeurs confirment la critique urgence d'investigation de la zone Lama : seulement 1% de couverture sur 334 mailles, dont 191 en cœur de zone (carottage lourd requis). Les 4 mailles avec données sont précieuses comme points d'ancrage pour le krigeage.

---

*Document de session rédigé le 2026-06-15 par Claude Sonnet 4.6.*  
*Référence projet : Atlas Géotechnique National du Togo — Version 2.6.0*
