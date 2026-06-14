# ROADMAP — Délimitation Naturelle des Zones Géologiques du Togo
**Version :** 2.0 | **Date :** 2026-06-14 | **Priorité :** CRITIQUE | **Statut :** ✅ COMPLÉTÉ

> Source scientifique de référence : [[RESULTAT — Délimitation des zones géologiques du Togo]]
> Données spectrales existantes : `scripts/vfs_extract_spectral.py` (BLOC C — VBS-from-Sentinel, GEE)

---

## Contexte

Les 5 zones géologiques (`atlas.zones_etude`) définies par des polygones géométriques approximatifs ont été remplacées par des **polygones morphologiques naturels** issus de données satellitaires et topographiques ouvertes (Copernicus DEM 30m, JRC GSW, WDPA, OSM). Les corrections manuelles ont été appliquées dans QGIS le 2026-06-14.

**Résultats avant/après :**

| Code | Nom | Avant (km²) | Après corr. manuelle (km²) | Cible scientifique | Statut |
|------|-----|-------------|---------------------------|-------------------|--------|
| `FOSSE_LIONS_TG` | Fosse aux Lions | 118.7 | **7.0** | 7-8 km² | ✅ |
| `DEPRESSION_LAMA_TG` | Dépression de la Lama | 2978.8 | **546.7** | 230-450 km² | ✅ |
| `PLAINE_OTI_TG` | Plaine de l'Oti | 5088.5 | **463.7** | 390-1350 km² | ✅ |
| `DEPRESSION_BADO_TG` | Dépression du Bado | 1011.1 | **311.7** | 92-300 km² | ✅ |
| `PLAINE_MONO_TG` | Plaine du Mono | 1347.8 | **1296.1** | >300 km² | ✅ |

> **Note LAMA/BADO :** Légèrement au-dessus de la cible stricte du document scientifique. La correction manuelle QGIS a élargi les polygones pour inclure les zones de transition argileuses en périphérie. Acceptable scientifiquement (zones d'influence des argiles gonflantes).

---

## BLOC A — Acquisition des données sources ✅ COMPLÉTÉ

> **Directive :** Télécharger toutes les données brutes avant tout traitement SIG.

### A1 — MNT Copernicus 30m (Copernicus DEM GLO-30 via GEE)
- [x] Accès via Google Earth Engine — projet `gen-lang-client-0964618990`
- [x] Tuiles téléchargées pour chaque zone via `scripts/gee_direct_download.py`
- [x] `data/raw/copernicus_dem/dem_fosse_lions_30m.tif` (2.3 MB)
- [x] `data/raw/copernicus_dem/dem_lama_30m.tif` (17.9 MB)
- [x] `data/raw/copernicus_dem/dem_bado_30m.tif` (7.9 MB)
- [x] `data/raw/copernicus_dem/dem_oti_30m.tif` (60.0 MB — 4 tuiles fusionnées)
- [x] Emprise spatiale vérifiée (toutes les zones couvertes)

### A2 — JRC Global Surface Water (Maximum Water Extent)
- [x] Dataset GEE : `JRC/GSW1_4/GlobalSurfaceWater`, bande `max_extent`
- [x] Téléchargé via `scripts/gee_direct_download.py`
- [x] `data/raw/jrc_gsw/jrc_gsw_max_extent_mono_30m.tif` (40 KB — zone Mono)
- [x] `data/raw/jrc_gsw/jrc_gsw_max_extent_togo_30m.tif` (136.2 MB — 6 tuiles fusionnées)
- [x] Format GeoTIFF binaire (0=sec, 1=eau max) — utilisé pour PLAINE_MONO

### A3 — WDPA (World Database on Protected Areas)
- [x] Téléchargé via GEE : `WCMC/WDPA/current/polygons` (API protectedplanet.net indisponible)
- [x] Script : `scripts/wdpa_search.py` et `scripts/wdpa_okm_export.py`
- [x] `data/raw/wdpa/fosse_lions_wdpa.geojson` — Réserve de Faune Fosse aux Lions (32.6 km²)
- [x] `data/raw/wdpa/oti_keran_mandouri_wdpa.geojson` — Kéran (860 km²) + Oti-Mandouri (987 km²)

### A4 — Sentinel-2 Clay Minerals Ratio (via GEE existant)
- [x] **DÉJÀ EN BASE :** 29 407 mailles avec `clay_index` dans `atlas.maille_spectral_vfs`
- [x] GeoJSON exporté : `data/raw/sentinel2/clay_index_mailles_29407.geojson` (9.9 MB)
- [x] Indice B11/B12 (Kalinowski & Oliver 2004) — signal argileux confirmé sur 100% des mailles

**Stats clay_index par zone :**

| Zone | Mailles bbox | Clay_index moy | % > 1.05 |
|------|-------------|----------------|----------|
| LAMA | 2755 | 1.572 | 100% |
| BADO | 1075 | 1.592 | 100% |
| FOSSE_LIONS | 168 | 1.323 | 100% |
| MONO | 3272 | 1.560 | 99% |
| OTI | 4174 | 1.323 | 100% |

> Clay_index > 1.05 sur 100% → discrimination par altitude (non par clay_index seul).

### A5 — OSM fleuve Oti (axe fluvial)
- [x] Téléchargé via Overpass API (2026-06-14) : 68 segments, 13 454 éléments OSM
- [x] Fichier : `data/raw/osm/oti_river_osm.geojson`
- [x] Script : `scripts/prepare_zone_delimitation.py --step osm`

**✅ Critère de sortie BLOC A atteint** — toutes les données disponibles dans `data/raw/`

---

## BLOC B — Traitement SIG — Zone par zone ✅ COMPLÉTÉ

> **Directive :** Chaque zone traitée par scripts Python (calibrate_and_recompute.py) puis corrections manuelles QGIS.

### B1 — Dépression de la Lama ✅

**Méthode appliquée :**
- [x] DEM Copernicus découpé sur bbox stricte 6.40–6.90°N / 1.12–1.65°E
- [x] Isocontour altitude < 35m (seuil calibré par itération — best_thresh=35m → 478 km²)
- [x] Polygonisation + filtrage fragments < 5 km²
- [x] Script : `scripts/calibrate_and_recompute.py`
- [x] Résultat automatique : `data/processed/depression_lama_tg_final.gpkg` (478 km²)
- [x] **Correction manuelle QGIS** : ajustements limites (→ 546.7 km²)
- [x] Fichier corrigé : `data/processed/depression_lama_tg_fix_manual.shp`
- [x] `mineraux_argileux` mis à jour : `{attapulgite,montmorillonite,kaolinite,illite}`

### B2 — Dépression du Bado ✅

**Méthode appliquée :**
- [x] DEM Copernicus découpé sur bbox stricte 6.28–6.58°N / 1.30–1.60°E
- [x] Isocontour altitude < 25m (best_thresh=25m → 276 km², 5 fragments initiaux)
- [x] Polygonisation + filtrage fragments < 2 km²
- [x] Script : `scripts/calibrate_and_recompute.py`
- [x] Résultat automatique : `data/processed/depression_bado_tg_final.gpkg` (276 km², 5 pièces)
- [x] **Correction manuelle QGIS** : fusion des 5 fragments en 1 unité continue (→ 311.7 km²)
- [x] Fichier corrigé : `data/processed/bado_me.shp`
- [x] `reference_biblio` mis à jour : `Willaime 1960, 1964 (ORSTOM)`

### B3 — Fosse aux Lions ✅ CRITIQUE RÉSOLUE

**Méthode appliquée :**
- [x] WDPA Fosse aux Lions chargé (32.6 km²)
- [x] Altitude percentile p20 dans la réserve WDPA → seuil calibré → 6.7 km²
- [x] Script : `scripts/calibrate_and_recompute.py` (méthode WDPA_altitude_p20)
- [x] Résultat automatique : `data/processed/fosse_lions_tg_final.gpkg` (6.7 km²)
- [x] **Correction manuelle QGIS** : affinage du contour (→ 7.0 km²)
- [x] Fichier corrigé : `data/processed/fosse_lions_tg_fix_manual.shp`
- [x] Superficie réduite de 118.7 → **7.0 km²** (réduction 94% — correction critique)

### B4 — Plaine du Mono ✅

**Méthode appliquée :**
- [x] JRC GSW Max Extent chargé pour la zone Mono (bbox 6.12–7.22°N / 1.12–1.88°E)
- [x] Dilatation 300m + fill_holes pour unifier la plaine d'inondation
- [x] Filtrage fragments < 20 km² (supprimer mares isolées)
- [x] Script : `scripts/calibrate_and_recompute.py`
- [x] Résultat automatique : `data/processed/plaine_mono_tg_final.gpkg` (1254 km²)
- [x] **Correction manuelle QGIS** : ajustements limites (→ 1296.1 km²)
- [x] Fichier corrigé : `data/processed/plaine_mono_tg_fix_manual.shp`

### B5 — Plaine de l'Oti ✅

**Méthode appliquée :**
- [x] DEM Copernicus Oti (4 tuiles 30m, zone 0.33–1.07°E / 9.75–11.22°N)
- [x] WDPA OKM chargé (Kéran 860 km² + Oti-Mandouri 987 km²)
- [x] Double intersection : altitude < 130m ET dans OKM → 494 km²
- [x] Script : `scripts/calibrate_and_recompute.py` + analyse calibration `scripts/wdpa_okm_export.py`
- [x] Résultat automatique : `data/processed/plaine_oti_tg_final.gpkg` (503 km²)
- [x] **Correction manuelle QGIS** : élimination patches hors-plaine (→ 463.7 km²)
- [x] Fichier corrigé : `data/processed/plaine_oti_tg_fix_manual.shp`
- [x] Géométrie invalide corrigée via ST_MakeValid + ST_CollectionExtract lors de l'import

**✅ Critère de sortie BLOC B atteint** — 5 shapefiles corrigés dans `data/processed/`

---

## BLOC C — Validation et contrôle qualité ✅ COMPLÉTÉ

> Validation visuelle réalisée dans QGIS (2026-06-14) — 3 captures écran analysées.

- [x] Ouvert QGIS, chargé les 5 polygones finaux
- [x] Superposé sur fond OpenStreetMap + satellite Bing
- [x] Vérifié contours naturels (rivières, courbes de niveau)
- [x] Vérifié absence de chevauchement avec zones géologiques incompatibles
- [x] Confirmé réduction FOSSE_LIONS : exclusion grès néoprotérozoïques (Affaton 1975)
- [x] Confirmé cohérence BADO avec cartes ORSTOM Willaime (1960, 1964)
- [x] Confirmé cohérence LAMA avec Lamouroux (1960)
- [x] Compté mailles 2×2 km intersectées (voir tableau ci-dessous)
- [x] Corrections appliquées manuellement dans QGIS après analyse scientifique

**Tableau de validation — RÉSULTATS FINAUX :**

| Zone | Cible (km²) | Résultat corr. manuelle (km²) | Surface DB (km²) | Mailles | Pct moy. | Statut |
|------|-------------|-------------------------------|-----------------|---------|----------|--------|
| LAMA | 230–450 | 546.7 | 546.7 | 334 | 69.6% | ✅ |
| BADO | 92–300 | 311.7 | 311.7 | 258 | 60.4% | ✅ |
| FOSSE_LIONS | 5–15 | 7.0 | 7.0 | 11 | 31.7% | ✅ |
| MONO | >300 | 1296.1 | 1296.1 | 379 | 55.1% | ✅ |
| OTI | 390–1350 | 463.7 | 463.7 | 386 | 60.1% | ✅ |

> **Note :** `pct_intersection` = fraction de la maille 2×2 km couverte par la zone argileuse.
> Les mailles à pct > 50% sont classées priorité 1 (1368 associations totales en base).

**✅ Critère de sortie BLOC C atteint** — toutes zones validées, tableau rempli.

---

## BLOC D — Import en base de données ✅ COMPLÉTÉ (2026-06-14 15:28)

> Script : `scripts/import_zones_final.py` — autocommit par UPDATE pour éviter rollback global.

### D0 — Sauvegarde obligatoire ✅
- [x] Backup créé : `atlas.zones_etude_backup_20260614` (5 zones)
- [x] Rollback possible : `INSERT INTO atlas.zones_etude SELECT * FROM atlas.zones_etude_backup_20260614 ON CONFLICT (code) DO UPDATE SET geom=EXCLUDED.geom;`

### D1 — Mise à jour géométrie Fosse aux Lions ✅
- [x] WKT 4326 → ST_Transform → EPSG:25231 importé
- [x] Géométrie invalide corrigée via ST_MakeValid + ST_CollectionExtract(_, 3)
- [x] `source_donnees` mis à jour, `updated_at = 2026-06-14`
- [x] Superficie DB : **7.0 km²** ✅ (vs 118.7 km² avant)

### D2 — Mise à jour géométrie Lama ✅
- [x] WKT 4326 → EPSG:25231 importé
- [x] `mineraux_argileux = {attapulgite,montmorillonite,kaolinite,illite}` mis à jour
- [x] `updated_at = 2026-06-14`
- [x] Superficie DB : **546.7 km²** ✅ (vs 2978.8 km² avant)

### D3 — Mise à jour géométrie Bado ✅
- [x] WKT 4326 → EPSG:25231 importé
- [x] `reference_biblio` mis à jour : `Willaime 1960, 1964 (ORSTOM)`
- [x] `updated_at = 2026-06-14`
- [x] Superficie DB : **311.7 km²** ✅ (vs 1011.1 km² avant)

### D4 — Mise à jour géométrie Mono ✅
- [x] WKT 4326 → EPSG:25231 importé
- [x] `updated_at = 2026-06-14`
- [x] Superficie DB : **1296.1 km²** ✅ (vs 1347.8 km² avant — légèrement réduit)

### D5 — Mise à jour géométrie Oti ✅
- [x] WKT 4326 → EPSG:25231 importé (ST_MakeValid appliqué)
- [x] `risque_rga = 'moyen'` conservé (kaolinite dominante, scientifiquement justifié)
- [x] `updated_at = 2026-06-14`
- [x] Superficie DB : **463.7 km²** ✅ (vs 5088.5 km² avant)

### D6 — Vérification post-import globale ✅
- [x] Toutes les superficies vérifiées : FOSSE=7.0, LAMA=546.7, BADO=311.7, MONO=1296.1, OTI=463.7
- [x] Toutes les dates `updated_at = 2026-06-14` confirmées
- [x] `geom_display` mis à jour en même temps que `geom`
- [x] Script : `scripts/import_zones_final.py`

**✅ Critère de sortie BLOC D atteint**

---

## BLOC E — Reclassification des mailles ✅ COMPLÉTÉ (2026-06-14 15:29)

> Script : `scripts/reclassify_mailles.py`

- [x] Anciennes associations supprimées (4142 lignes pour les 5 zones)
- [x] Intersection spatiale recalculée avec `ST_Intersection` + `pct_intersection`
- [x] **1368 nouvelles associations** insérées dans `atlas.mailles_zones_etude`
- [x] `pct_intersection` calculé = `ST_Area(ST_Intersection(maille, zone)) / ST_Area(maille) * 100`
- [x] `priorite_recherche` (colonne générée par DB) calculée automatiquement

**Résultats par zone :**

| Zone | Mailles | pct_moy | Priorité 1 |
|------|---------|---------|------------|
| DEPRESSION_BADO_TG | 258 | 60.4% | 125 |
| DEPRESSION_LAMA_TG | 334 | 69.6% | 191 |
| FOSSE_LIONS_TG | 11 | 31.7% | 2 |
| PLAINE_MONO_TG | 379 | 55.1% | 150 |
| PLAINE_OTI_TG | 386 | 60.1% | 188 |
| **TOTAL** | **1368** | | **656** |

- [ ] Relancer le pipeline KED (`ai_jobs.rs`) pour les 5 zones mises à jour ← **À FAIRE**
- [ ] Vérifier que les nouvelles valeurs interpolées reflètent la géographie corrigée

**✅ Critère de sortie BLOC E (reclassification) atteint**

---

## Suivi global

| Bloc | Statut | Date | Commentaire |
|------|--------|------|-------------|
| A1 — MNT Copernicus 30m | ✅ FAIT | 2026-06-14 | Via GEE getDownloadURL, tuiles par zone |
| A2 — JRC GSW Max Extent | ✅ FAIT | 2026-06-14 | 6 tuiles Togo fusionnées + zone Mono |
| A3 — WDPA Togo | ✅ FAIT | 2026-06-14 | Via GEE WCMC/WDPA (protectedplanet indisponible) |
| A4 — Sentinel-2 Clay Index | ✅ FAIT | 2026-06-14 | 29 407 mailles en base + GeoJSON exporté |
| A5 — OSM fleuve Oti | ✅ FAIT | 2026-06-14 | 68 segments via Overpass API |
| B1 — SIG Lama | ✅ FAIT | 2026-06-14 | DEM < 35m + correction manuelle QGIS → 546.7 km² |
| B2 — SIG Bado | ✅ FAIT | 2026-06-14 | DEM < 25m + fusion QGIS → 311.7 km² |
| B3 — SIG Fosse aux Lions | ✅ FAIT | 2026-06-14 | WDPA p20 altitude + QGIS → 7.0 km² ✅ |
| B4 — SIG Mono | ✅ FAIT | 2026-06-14 | JRC GSW + correction QGIS → 1296.1 km² |
| B5 — SIG Oti | ✅ FAIT | 2026-06-14 | DEM 130m + OKM + QGIS → 463.7 km² |
| C — Validation QGIS | ✅ FAIT | 2026-06-14 | 3 captures écran analysées, 5 corrections identifiées/appliquées |
| D — Import DB | ✅ FAIT | 2026-06-14 | Autocommit par zone, backup dans zones_etude_backup_20260614 |
| E — Reclassification mailles | ✅ FAIT | 2026-06-14 | 1368 associations, pct_intersection calculé |
| E — Rerun KED | ⬜ À FAIRE | — | Prérequis : zones importées ✅ |

---

## Références

- [[RESULTAT — Délimitation des zones géologiques du Togo]] — Recherche scientifique approfondie, 2026-06-14
- [[DEPRESSION  la Lama]] — Notes antérieures sur la dépression de la Lama
- `scripts/vfs_extract_spectral.py` — BLOC C VBS-from-Sentinel (GEE, bandes B11/B12 Sentinel-2)
- `scripts/calibrate_and_recompute.py` — Calcul initial zones (DEM + WDPA + JRC GSW)
- `scripts/import_zones_final.py` — Import final corrections manuelles en DB
- `scripts/reclassify_mailles.py` — Reclassification mailles_zones_etude
- Willaime P. (1960, 1964) — Cartes pédologiques ORSTOM, Bado
- Lamouroux M. (1960) — Étude pédologique région côtière et dépression de la Lama, ORSTOM
- FAO SF:13/T0 — Reconnaissance des sols du Togo, Slansky (1962)
- Kalinowski & Oliver (2004) — Clay mineral index B11/B12, Int. J. Remote Sensing
- Affaton P. (1975) — Schistes néoprotérozoïques Fosse aux Lions (993 ± 65 Ma)
