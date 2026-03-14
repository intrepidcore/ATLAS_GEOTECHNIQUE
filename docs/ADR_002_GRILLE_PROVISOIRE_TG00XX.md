# ADR_002 — Grille provisoire `TG-00xx-00yy-01` (3e grille) : statut, preuves et protocole de remapping

- **Statut**: Draft
- **Date**: 2026-03-14
- **Périmètre**: Colab (missions importées), remapping vers `atlas.mailles` (V2)

---

## 1) Constat

Des imports Colab (exports missions) contiennent des codes mailles au format :

- `TG-0052-0046-01` (exemples similaires `TG-0045-0044-01`, etc.)

Or la grille courante en base (`atlas.mailles`) utilise des codes d’une autre plage (ex: `TG-0477-0212-01` → `TG-0871-0152-01`).

Conséquence :

- la résolution directe `colab_missions.maille_id` par `atlas.mailles.code` échoue
- le système peut être **référentiellement cohérent** (FK non rompue) tout en étant **sémantiquement faux** (mauvaise maille géographique)

---

## 2) Preuves (sources)

### 2.1. Les codes `TG-00xx` sont présents dans les artefacts Colab versionnés

- `data/colab/MAILLES_PROVISOIRE.pdf`
- `data/colab/MAILLES_PROVISOIRE-1.png`

Ces fichiers listent explicitement des missions `M-2026...` associées à des `Code Référence` de type `TG-00xx-00yy-01`.

### 2.1.b. L’export missions XLSX ne contient pas de bbox/coordonnées

Le fichier `data/colab/export_missions_ceb08621-3e8c-4fac-9435-e9ef0a0b6615.xlsx` contient uniquement (sheet `missions`) les colonnes suivantes :

- `mission_id`, `mission_code`, `mission_name`
- `maille_code`
- `zone`, `localite`
- `student_name`, `student_email`
- `date_start`, `date_end`
- `operational_status`, `operational_reason`

Il n’y a pas de colonnes `bbox`, `xmin/xmax/ymin/ymax`, `lat/lon` ou géométrie.

Conclusion : cet export ne permet pas à lui seul un remapping spatial prouvé vers `atlas.mailles`.

### 2.2. Les codes `TG-00xx` ne sont pas dans la grille courante

- Requêtes DB exécutées :
  - `SELECT COUNT(*) FROM atlas.mailles WHERE code LIKE 'TG-00%';` → `0`
  - `SELECT code FROM atlas.mailles WHERE code IN (...)` (liste des 18 codes) → `0 rows`

### 2.3. Les codes `TG-00xx` ne sont pas dans la legacy V1 archivée utilisée pour le lookup

La migration `112_legacy_lookup_view.sql` utilise comme source legacy :

- `public.mailles_legacy_v1_archive`

Vérification :

- `SELECT COUNT(*) FROM public.mailles_legacy_v1_archive WHERE code IN (...)` → `0`

Conclusion : ces codes appartiennent à une **troisième grille** (distincte de :
- la legacy V1 archivée (table `public.mailles_legacy_v1_archive`)
- la V2 actuelle (`atlas.mailles`)

---

## 3) Hypothèses et limites

- Le format `TG-XXXX-YYYY-01` encode vraisemblablement des indices (i/j) de grille.
- L’ADR_001 documente un algorithme “Iso-Code” basé sur un pas de 2000 (en SRID 25231) et des paramètres `X0/Y0`.

Mais :

- l’existence d’un code “compatible” ne suffit pas à déterminer l’**origine** et la **projection** de la grille provisoire
- sans géométrie de référence (ou un référentiel de conversion prouvé), toute tentative de conversion par heuristique introduit de la dette technique

---

## 4) Règles métier associées

- Voir **BM-13** : la validité géographique d’un rattachement mission → maille ne peut pas être prouvée par la seule intégrité (FK / non-NULL).

---

## 5) Protocole canonique de remapping (sans dette)

### 5.1. Pré-requis (source de vérité)

Il faut au minimum **un** des éléments suivants :

- **Option A (recommandée)** : la grille provisoire sous forme géométrique (shapefile / GeoPackage / table PostGIS) avec colonnes `code` + `geom`
- **Option B** : pour chaque mission importée, une bbox/coordonnées WGS84 fiables (centroid) permettant un remapping spatial vers `atlas.mailles`

Un fichier Excel listant des codes sans géométrie associée est insuffisant.

### 5.2. Remapping spatial reproductible

Une fois la source chargée (ex: `public.mailles_provisoire` en SRID 25231) :

1) Construire une table de mapping (ex: `atlas.colab_maille_code_map`):

- `source_code` (PK)
- `target_code`
- `coverage_pct`
- `method` (`intersection`, `centroid`, etc.)
- `created_at`

2) Calculer le mapping par intersection géométrique (pattern similaire à `112_legacy_lookup_view.sql`).

3) Appliquer le mapping:

- `UPDATE atlas.colab_missions SET maille_id = m.id FROM atlas.mailles m JOIN atlas.colab_maille_code_map map ON map.target_code = m.code WHERE <mission.original_code = map.source_code>`

4) Vérifier:

- `COUNT(*) WHERE maille_id IS NULL` (doit tendre vers 0)
- audit échantillon de missions (centroid dans maille)

---

## 6) Décision

- **Ne pas** implémenter de “décalage numérique” ou transformation non sourcée entre `TG-00xx` et `TG-04xx`.
- Formaliser et exiger une **source géométrique** ou des **coordonnées** pour le remapping.

---

## 7) Prochaines étapes

1) Retrouver la source de la grille provisoire (export QGIS, shapefile, dump table).
2) Importer cette source en base (`public.mailles_provisoire_*`).
3) Générer un mapping spatial et appliquer le remapping Colab de façon traçable.
