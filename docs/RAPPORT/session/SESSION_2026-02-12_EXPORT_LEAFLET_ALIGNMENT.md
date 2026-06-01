# Session 2026-02-12 — Export Atlas : alignement Leaflet raster/vector + stabilisation bounds + QA capture

## 1) Contexte

### Symptôme

- Sur les exports PNG (A4), on observait un **double contour** :
  - le fond OSM (raster, tuiles)
  - la limite ADM (vector, pointillée)
  - avec un **décalage visible** entre les deux.

### Régions affectées

- Phénomène observé sur plusieurs exports (ADM1), pas uniquement sur une zone.

### Preuves log

- Dans les logs d’export (ex: `atlas_geotechnique_2026-02-12 (1)/atlas_export_log_2026-02-12T16-14-27.md`), la séquence export montrait systématiquement :
  - `fitBounds(...)`
  - puis **`moveend TIMEOUT`** (2s auparavant)
  - et capture immédiate, donc risque de capture pendant un état Leaflet non stabilisé.

## 2) Diagnostic technique

### Cause racine (désynchronisation temporelle raster/vector)

L’export fonctionne en deux “mondes” qui doivent être cohérents :

- **Raster** : capture du fond OSM via `captureLeafletMap(...)` (tilePane uniquement)
- **Vector/canvas** : redessin sur canvas (limite ADM, mailles, grille) en projetant les géométries par rapport à une `bbox` (`bounds`).

Si la capture raster est faite alors que Leaflet n’est pas stabilisé (fitBounds en cours / resize du container / transforms non appliquées), on fige un fond raster qui ne correspond pas exactement aux bounds utilisés pour la projection vectorielle. Résultat : **décalage raster/vector**.

### Signaux observés

- `moveend`/`zoomend` non reçus (ou trop tard) pendant export → le pipeline continuait.
- `Map bounds APRÈS` parfois différents des bounds demandés.

## 3) Solution implémentée

### 3.1 Stabilisation Leaflet (éviter capture en état intermédiaire)

Dans `ui/src/export/export-quick-dialog.ts` (flux batch `exportSingle`) :

- Attente plus robuste via `waitForStableBounds(map)` :
  - échantillonnage de `map.getBounds()`
  - stabilisation N fois consécutives
  - timeout sécurisé

### 3.2 Source de vérité : bounds effectifs

- Après `fitBounds`, on projette désormais sur les **bounds effectifs réellement rendus** (stables), pas seulement les bounds “théoriques/optimisées”.
- Après `applyPanBiasIfNeeded(...)` (cas littoral), on recalcule encore des bounds effectifs stables.

Justification mathématique : la projection pixel = f(lng,lat,bbox) doit utiliser la même bbox que celle correspondant au fond raster capturé, sinon on introduit un décalage affine entre couches.

### 3.3 Sécurisation Maritime (bounds aberrants)

Le log `atlas_geotechnique_2026-02-12 (2)/atlas_export_log_2026-02-12T17-15-30.md` a mis en évidence un cas où **Maritime** finit avec des bounds énormes, rendant l’ADM minuscule sur la page.

Implémentation :

- **Sanity-check** entre bounds demandés (optimisés) et bounds effectifs :
  - si largeur/hauteur effectives >> demandées (ou > seuil), on considère les bounds aberrants
  - on fait un **re-`fitBounds`** sur la target bounds et on attend à nouveau des bounds stables

### 3.4 Sécurisation pipeline (anti recadrage concurrent)

- Désactivation temporaire des interactions Leaflet pendant l’export (`dragging`, `scrollWheelZoom`, etc.) pour réduire les risques de recadrage concurrent pendant la capture.
- Restauration systématique à la fin (dans `finally`).

### 3.5 QA capture (correction “capture noire/blank”)

Problème : le log montre `blackRatio=0.00` même lorsque le rendu final peut être inutilisable (ex: image noire chez certains viewers). La QA initiale ne détectait que des pixels noirs/alpha.

Correction dans `ui/src/export/capture-utils.ts` :

- `validateCapture()` calcule désormais aussi :
  - `whiteRatio`
  - `transparentRatio`
  - `uniformRatio` (faible variance)

et invalide une capture trop blanche/transparent/uniforme afin de déclencher un retry.

## 4) Impact

- **Correction du décalage raster/vector** (limite ADM superposée au fond OSM de manière cohérente).
- Pipeline export plus robuste :
  - meilleure stabilité Leaflet
  - projection canvas cohérente avec la capture raster
  - réduction des exports “Maritime” inutilisables
  - meilleure détection des captures invalides

## 5) Limites restantes / risques

- Le mécanisme de stabilité dépend de la stabilité réelle de Leaflet : un listener externe peut encore modifier la vue si non maîtrisé.
- La QA capture ne garantit pas 100% des cas (ex: rendu partiellement chargé mais non uniformément), mais réduit fortement les faux positifs.
- Le repo UI n’est pas TS-clean globalement (`npx tsc --noEmit` remonte des erreurs dans d’autres modules), donc la vérification doit se faire via tests/export manuel ciblé.
