# Plan d'Import V10_MASTER — Atlas Géotechnique Togo
## Intrepid Core Engineering Standards

> **Règles appliquées** : DB-10 (inspecter avant écrire), DB-11 (atomique/idempotent),
> ETL-03 (jamais continuer en silence), CFG-01 (pas d'URL hardcodée),
> BM-SYNC-05 (scripts idempotents), DATA-02 (plages physiques).

**Date analyse** : 2026-06-01  
**Données source** : `data/extend/V10_MASTER/` (18 fichiers CSV)  
**DB cible** : `postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean` (port 5433)

---

## 1. Analyse des données V10

### 1.1 Inventaire des fichiers

| Fichier | Rôle | Lignes utiles |
|---------|------|:-------------:|
| `V10_SONDAGES_LOCALISATION.csv` | Localisation + type de chaque sondage | 395 |
| `V10_LABORATOIRE_HORIZONS.csv` | Essais labo par horizon (WL/WP/IP/CBR/Proctor) | 380 |
| `V10_INSITU_PROFIL_Z.csv` | Essais in-situ par profondeur (PD/SP/Géoph.) | 484 |
| `V10_PROJETS_METADATA.csv` | Métadonnées projet + recommandations fondation | 33 |
| `V10_PROCTOR_POINTS_*.csv` (×6) | Points courbe Proctor par projet | ~300 |
| `V10_COMPACITE_CBR_*.csv` (×6) | CBR à 55/25/12% compactage par projet | ~180 |

### 1.2 Décompte des sondages

**Par projet :**
| Projet | N sondages | Type dominant | Statut |
|--------|:----------:|---------------|--------|
| PISTES_PLATEAUX_2026 | 112 | Piste + Emprunt | 🆕 Nouveau |
| PISTES_MARITIME_2026 | 47 | Piste + Emprunt | 🆕 Nouveau |
| NOTSE_2024 | 31 | Emprunt | 🆕 Nouveau |
| BADJA_2024 | 28 | Emprunt | 🆕 Nouveau |
| SOKODE_2024 | 23 | Piste | 🆕 Nouveau |
| LOME2_2025 | 16 | Piste | 🆕 Nouveau |
| KANTE_2024 | 10 | Piste | 🆕 Nouveau |
| AMOU_OBLO_2024 | 10 | Piste | 🆕 Nouveau |
| CHAUSSEE_2024 | 10 | Piste | 🆕 Nouveau |
| ETRA_2025 | 12 | Piste | 🆕 Nouveau |
| BAFILO_2024 | 6 | Piste | 🆕 Nouveau |
| DZEMEKEY_2024 | 6 | Emprunt | 🆕 Nouveau |
| GEOPH_ADANLEHUI | 2 | Forage géoph. | 🆕 Nouveau |
| LOGOTE_2021, AGBANDJI_*, TOHOUN… | 82 | Divers | ✅ Déjà en DB |

**Totaux :**
- **395 entrées** dans V10_SONDAGES_LOCALISATION
- **~82 sondages déjà en DB** (projets 2017–2021)
- **~313 entrées nouvelles** (projets 2024–2026)
- **~240 sondages géoréférençables** (avec coordonnées non-NULL)
- **Sondages uniques avec WL/WP** : 297 (dont ~215 nouveaux)

### 1.3 Impact sur les modèles géostatistiques

| Paramètre | N actuel en DB | N après import | Delta |
|-----------|:--------------:|:--------------:|:-----:|
| VBS (g/100g) | 329 mesures | **329** | 0 (pas de VBS dans V10) |
| WL (%) | 360 | **~575** | +215 |
| WP (%) | 356 | **~570** | +214 |
| IP (%) | ~361 | **~576** | +215 |
| CBR (%) | 0 | **~240** | +240 nouveau |
| Rd pénétromètre (MPa) | ≈ quelques | **+484** points | nouveau |
| Pressiomètre (MPa) | ≈ quelques | **+118** points | nouveau |

> **Important** : aucun VBS dans les nouvelles données → L1 KED-H ne s'améliorera pas
> directement pour VBS. Mais WL/WP/IP → L2 RK-SCORPAN s'améliore pour ces paramètres.

---

## 2. Problèmes de coordonnées — Diagnostic

### 2.1 Systèmes de projection détectés

Champ `latitude_y_dec` / `longitude_x_dec` dans V10_SONDAGES_LOCALISATION contient
**trois cas** mélangés :

| Cas | Détection | Exemples | Action |
|-----|-----------|---------|--------|
| **WGS84 DD** | `latitude_y_dec < 12` et `> 5` | 6.197089 / 1.133917 | Insérer directement en EPSG:4326 |
| **UTM31N** | `latitude_y_dec > 100000` | 910580 / 294756 | Convertir EPSG:32631 → EPSG:4326 |
| **NULL** | `latitude_y_dec = NULL` | Pistes Plateaux sans coords | Géoréférencer par projet ou ignorer |

**Comptes** : 111 en UTM31N, 2 en WGS84, ~200 sans coordonnées.

### 2.2 Stratégie de conversion UTM31N → WGS84

```sql
-- PostGIS : conversion in-database
SELECT
  id_sondage,
  ST_AsText(
    ST_Transform(
      ST_SetSRID(ST_MakePoint(longitude_x_dec, latitude_y_dec), 32631),
      4326
    )
  ) AS geom_wgs84
FROM staging_v10_sondages
WHERE latitude_y_dec > 100000;
```

### 2.3 Sondages sans coordonnées — Stratégie

Pour les **200 sondages sans coordonnées** (principalement `PISTES_PLATEAUX_2026`
emprunts avec observation du type `29`, `36`, etc.) :

- **Option A (recommandée)** : utiliser la position centroïde du projet
  (coordonnées médianes des autres sondages du même projet).
- **Option B** : marquer `is_geocoded = false` et stocker en `sondages_non_geocodes`.
- **Règle** : jamais insérer un sondage dans `sondages` avec `geom = NULL`
  si le projet a d'autres sondages géolocalisés. Utiliser le centroïde projet
  avec `location_accuracy_m = 5000` (5km = incertitude du centroïde).

---

## 3. Nouveaux paramètres — Cartographie DB

### 3.1 Paramètres existants → tables existantes

| Paramètre V10 | Table DB existante | Colonne |
|---------------|-------------------|---------|
| `limite_liquidite_ll` | `atlas.essais_atterberg` | `wl` |
| `indice_plasticite_ip` | `atlas.essais_atterberg` | `ip_generated` |
| `classe_sol_hbr` | `atlas.essais_classif` | `hrb` |
| `densite_seche_nat` | `atlas.essais_physiques` | `rho_s` |
| `teneur_eau_nat_pct` | `atlas.essais_physiques` | `w` |
| `densite_seche_opm` | `atlas.essais_proctor` | `gamma_d_max` |
| `teneur_eau_opt_opm` | `atlas.essais_proctor` | `w_opt` |
| `nature_sol_brute` | `atlas.essais_classif` | `type_sol` |
| `pk_brut` | `atlas.sondages.meta` | jsonb → `pk_brut` |
| `nappe_phreatique_m` | `atlas.sondages.meta` | jsonb → `nappe_m` |
| `refus_penetrometre_m` | `atlas.sondages.meta` | jsonb → `refus_pd_m` |
| Observations fondation | `atlas.imports.meta` | jsonb → `recom_*` |

### 3.2 Nouveaux paramètres → nouvelles tables (3 migrations)

#### Migration 176 — `atlas.essais_penetrometre`
> Données PD (pénétromètre dynamique) : Rd, ELU, ELS par profondeur.
> N'existe pas en DB. Pas de table approchante sans trop de contorsion.

```sql
CREATE TABLE atlas.essais_penetrometre (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sondage_id     uuid NOT NULL REFERENCES atlas.sondages(id) ON DELETE CASCADE,
  profondeur_m   numeric NOT NULL,
  rd_mpa         numeric,          -- résistance dynamique brute
  elu_mpa        numeric,          -- valeur ELU calculée (0.05 × Rd)
  els_mpa        numeric,          -- valeur ELS calculée (0.033 × Rd)
  meta           jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  source_reference text
);
CREATE INDEX ON atlas.essais_penetrometre (sondage_id, profondeur_m);
COMMENT ON TABLE atlas.essais_penetrometre IS
  'Essais pénétromètre dynamique (PD) par profondeur par sondage — V10 import';
```

#### Migration 177 — `atlas.essais_pressiometre`
> Données SP (sondage pressiométrique) : Pf, Pl, Em, ratio Em/Pl par profondeur.

```sql
CREATE TABLE atlas.essais_pressiometre (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sondage_id     uuid NOT NULL REFERENCES atlas.sondages(id) ON DELETE CASCADE,
  profondeur_m   numeric NOT NULL,
  pf_mpa         numeric,          -- pression de fluage
  pl_mpa         numeric,          -- pression limite nette
  em_mpa         numeric,          -- module pressiométrique
  e_pl_ratio     numeric,          -- Em / Pl
  meta           jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  source_reference text
);
CREATE INDEX ON atlas.essais_pressiometre (sondage_id, profondeur_m);
```

#### Migration 178 — `atlas.essais_cbr`
> CBR à différents niveaux de compactage (55%, 25%, 12% OPM ou kN).
> `essais_proctor` existant ne supporte qu'un OPM global, pas la courbe CBR.

```sql
CREATE TABLE atlas.essais_cbr (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sondage_id         uuid NOT NULL REFERENCES atlas.sondages(id) ON DELETE CASCADE,
  echantillon_id     uuid REFERENCES atlas.echantillons(id),
  compactage_pct     numeric NOT NULL,   -- % Proctor (ex : 100, 95.2, 90.0)
  cbr_pct            numeric,            -- indice CBR mesuré
  gamma_d_gcm3       numeric,            -- densité sèche au % de compactage
  teneur_eau_pct     numeric,            -- teneur en eau au compactage
  proctor_ref        text,               -- 'OPM' ou 'OPMod'
  meta               jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  source_reference   text
);
CREATE INDEX ON atlas.essais_cbr (sondage_id);
```

### 3.3 Indice de Groupe (IG) — colonne manquante dans essais_classif

```sql
-- Migration 178b (idempotent)
ALTER TABLE atlas.essais_classif
  ADD COLUMN IF NOT EXISTS indice_groupe numeric,
  ADD COLUMN IF NOT EXISTS cbr_95_pct    numeric;  -- CBR à 95% OPM (résumé)
```

### 3.4 Paramètres de fondation du projet

Les recommandations de `V10_PROJETS_METADATA.csv` (contrainte_els, contrainte_elu,
tassement_total, module_Kv, type_fondation) sont stockées dans :

- `atlas.imports.meta` JSONB (clé `recom_fondation`) — pour le projet entier
- `atlas.sondages.meta` JSONB (clé `recom_fondation`) — pour chaque sondage clé

> **Ne pas utiliser `maille_geotech_foundation`** : cette table est per-maille
> (résultat d'interpolation spatiale) et non per-projet (donnée terrain brute).

---

## 4. Canonisation des profondeurs → H1/H2/H3

### 4.1 Règle de mapping

La DB utilise `echantillons.depth_m` comme profondeur de référence (milieu de l'horizon).
V10 fournit `z_min_m` / `z_max_m`. Règle de mapping :

```
profondeur_centroide = (z_min_m + z_max_m) / 2

H1 ← profondeur_centroide ∈ [0.0, 1.0]   → depth_m = centroïde réel
H2 ← profondeur_centroide ∈ (1.0, 1.5]   → depth_m = centroïde réel
H3 ← profondeur_centroide ∈ (1.5, 2.0]   → depth_m = centroïde réel
Hdeep ← profondeur_centroide > 2.0        → depth_m = centroïde réel
                                             (stocker dans meta : hors H1-H3)
```

> **Priorité** : conserver les profondeurs RÉELLES (`z_min_m`, `z_max_m`, centroïde)
> dans `echantillons.meta` sous `{"z_min": ..., "z_max": ..., "centroide": ...}`.
> Le mapping H1/H2/H3 est dérivé, pas la source de vérité.

### 4.2 Cas des sondages de piste (0–1m)

La majorité des nouveaux sondages (PISTES, KANTE, SOKODE…) ont des profondeurs
0.00–1.00m uniquement → tout part en H1. Pas de confusion.

### 4.3 Cas des sondages profonds (LOGOTE, ALINKA…)

Ces sondages ont des profondeurs > 2m (jusqu'à 30m pour pressiomètre).
Les horizons H1/H2/H3 sont extraits selon la règle ci-dessus.
Les profondeurs > 2m sont stockées avec `depth_m` réel mais **exclues des calculs
KED/RK** (flag dans meta ou colonne `is_ked_eligible = FALSE`).

### 4.4 Arrondi pour l'affectation H

En cas d'ambiguïté (centroïde exactement sur la frontière, ex. centroïde = 1.0m) :
- Règle : aller vers l'horizon SUPÉRIEUR (H1 si centroïde = 1.0m)
- Documenter l'arrondi dans `echantillons.meta["horizon_assign_rule"]`

---

## 5. Plan d'import en 6 phases

### Phase 0 — Dry-run et vérification pré-import (obligatoire)

```bash
# 1. Vérifier que le port 5433 répond
psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "SELECT COUNT(*) FROM atlas.sondages"

# 2. Dump de sécurité avant import
pg_dump -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean \
  --schema=atlas --no-owner -Fc \
  > backups/pre_v10_import_$(date +%Y%m%d_%H%M%S).dump
sha256sum backups/pre_v10_import_*.dump > backups/manifest.sha256

# 3. Lancer le script de dry-run
python scripts/import_v10/dry_run_v10.py \
  --database-url "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean" \
  --data-dir data/extend/V10_MASTER/ \
  --report-only
```

Le dry-run doit produire un rapport :
- N sondages à créer / N déjà existants (détection par `sondages.code`)
- N doublons à ignorer
- N coordonnées manquantes
- N conversions UTM31N requises
- Validation plages physiques (WL ∈ [10,90], IP ∈ [0,80], CBR ∈ [0,200])

### Phase 1 — Migrations DB (3 nouvelles tables)

```bash
# Appliquer les migrations dans l'ordre
psql -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean \
  -f migrations_post_v1/176_essais_penetrometre.sql
psql -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean \
  -f migrations_post_v1/177_essais_pressiometre.sql
psql -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean \
  -f migrations_post_v1/178_essais_cbr_indice_groupe.sql
```

### Phase 2 — Import des projets et sondages

```
V10_PROJETS_METADATA.csv → atlas.imports (meta JSONB)
V10_SONDAGES_LOCALISATION.csv → atlas.sondages
  - Détection coordonnées : WGS84 si lat < 12, UTM31N sinon
  - Conversion UTM31N via ST_Transform(EPSG:32631 → EPSG:4326)
  - type_sondage → sondages.meta["type_sondage"]
  - pk_brut → sondages.meta["pk_brut"]
  - Sondages sans coords → centroïde projet + location_accuracy_m = 5000
  - IDEMPOTENCE : ON CONFLICT (code) DO NOTHING
```

### Phase 3 — Import des horizons laboratoire

```
V10_LABORATOIRE_HORIZONS.csv → atlas.echantillons + essais_*
  - Créer echantillon par ligne (centroïde z_min/z_max)
  - WL/WP → atlas.essais_atterberg (id calculé, ip_generated = WL - WP)
  - HBR, type_sol → atlas.essais_classif (+ indice_groupe nouveau champ)
  - gamma_d_nat, w_nat → atlas.essais_physiques
  - gamma_d_opm, w_opt → atlas.essais_proctor (proctor_type = 'OPM')
  - cbr_95_pct → atlas.essais_classif.cbr_95_pct (nouveau champ)
  - volume_emprunt_m3 → sondage.meta["volume_emprunt_m3"]
  - IDEMPOTENCE : ON CONFLICT (sondage_id, depth_m) DO NOTHING
```

### Phase 4 — Import des profils in-situ

```
V10_INSITU_PROFIL_Z.csv → atlas.essais_penetrometre / essais_pressiometre
  - PD (pénétromètre) : rd_mpa + ELU/ELS calculés → essais_penetrometre
  - SP (pressiomètre) : Pf, Pl, Em, E/Pl → essais_pressiometre
  - Géophysique (résistivité) → sondages.meta["geoph_resistivite"] ou essais_pressiometre
  - IDEMPOTENCE : ON CONFLICT (sondage_id, profondeur_m) DO NOTHING
```

### Phase 5 — Import CBR et courbes Proctor

```
V10_PROCTOR_POINTS_*.csv → atlas.essais_proctor (points courbe)
  - Colonne proctor_point_num (numéro point) + gamma_d
  - Stocker dans meta JSONB : {"proctor_curve": [[point, gamma_d], ...]}
  - L'OPM (gamma_d_max, w_opt) est déjà en Phase 3 via V10_LABORATOIRE_HORIZONS

V10_COMPACITE_CBR_*.csv → atlas.essais_cbr
  - Lignes à 55%, 25%, 12% compactage
  - compactage_pct = la valeur en colonne 2 (kN → %OPM : 55kN=100%, 25kN=95%, 12kN=90%)
  - IDEMPOTENCE : ON CONFLICT (sondage_id, compactage_pct) DO NOTHING
```

### Phase 6 — Géoréférencement et validation finale

```bash
# 1. Vérifier le géoréférencement
psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
  SELECT COUNT(*) FILTER (WHERE geom IS NULL) as sans_geom,
         COUNT(*) FILTER (WHERE geom IS NOT NULL) as avec_geom,
         COUNT(*) as total
  FROM atlas.sondages WHERE deleted_at IS NULL;"

# 2. Vérifier le mapping grille (trigger sondages_tag_spatial est actif)
psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
  SELECT COUNT(*) FILTER (WHERE maille_code IS NULL AND geom IS NOT NULL) as non_mappe
  FROM atlas.sondages WHERE deleted_at IS NULL;"

# 3. Vérifier traçabilité runs APRÈS import
psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
  SELECT COUNT(*) FROM atlas.ai_interpolation_runs;"
```

---

## 6. Scripts à créer

```
scripts/import_v10/
├── dry_run_v10.py          ← Validation + rapport sans écriture
├── 01_import_projets.py    ← Phase 2a : imports + projets
├── 02_import_sondages.py   ← Phase 2b : sondages + géoréf UTM→WGS84
├── 03_import_horizons.py   ← Phase 3 : echantillons + essais_atterberg + classif
├── 04_import_insitu.py     ← Phase 4 : PD + SP + géoph
├── 05_import_cbr.py        ← Phase 5 : CBR + Proctor curve
├── 06_validate_final.py    ← Phase 6 : validation complète
└── utils/
    ├── coord_detect.py     ← Détection WGS84 vs UTM31N
    ├── depth_canon.py      ← Canonisation profondeurs → H1/H2/H3
    └── qc_ranges.py        ← Contrôle plages physiques
```

### Règles communes à tous les scripts :

```python
# [ETL-03] Jamais continuer en silence
def insert_with_log(cur, sql, params, context=""):
    try:
        cur.execute(sql, params)
    except Exception as e:
        logger.error(f"[ERREUR] {context}: {e}")
        raise  # Ne pas swallow

# [DATA-02] Plages physiques (invalider, ne pas bloquer)
PHYSICAL_RANGES = {
    "wl": (10, 90), "wp": (5, 50), "ip": (0, 80),
    "cbr_95_pct": (0, 200), "gamma_d_max": (1.2, 2.5),
    "rd_mpa": (0, 200), "pf_mpa": (0, 10),
}
```

---

## 7. Recalcul scientifique post-import

### 7.1 Pipeline automatique (trigger déjà actif)

Le trigger `trg_enqueue_ai_jobs_after_sondage` est actif sur `sondages`.
Après chaque INSERT de sondage, des jobs sont automatiquement enqueués dans
`atlas.ai_job_queue` si N ≥ 10 par paramètre.

**Pour lancer le worker après l'import en masse :**
```bash
# Lancer en arrière-plan avec surveillance
python scripts/pipeline_worker.py \
  --database-url "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean" \
  --interval 30 \
  > logs/pipeline_worker_post_v10_$(date +%Y%m%d).log 2>&1 &

echo "Worker PID: $!"

# Surveiller (vérifier que le worker ne crashe pas silencieusement)
tail -f logs/pipeline_worker_post_v10_$(date +%Y%m%d).log
```

### 7.2 Vérification de traçabilité (obligatoire après recalcul)

```sql
-- Doit retourner > 310 après recalcul avec nouvelles données
SELECT COUNT(*) FROM atlas.ai_interpolation_runs;

-- Vérifier couverture par paramètre
SELECT parameter_id, method,
       COUNT(*) as n_runs,
       MAX(created_at) as last_run
FROM atlas.ai_interpolation_runs
GROUP BY parameter_id, method
ORDER BY parameter_id, method;
```

### 7.3 Modèles affectés par l'import V10

| Modèle | Paramètre amélioré | Gain attendu |
|--------|-------------------|:------------:|
| L2a RK-SCORPAN | WL (+60%), WP (+60%), IP (+60%) | Moyen (RMSE ↓) |
| L2b Fusion BLUP | WL, WP, IP | Dérivé de L2a |
| L4 MTGP/ICM | Tous (corrélations) | Moyen |
| **L1 KED-H VBS** | **Aucun** | **0** (pas de VBS) |
| L3 VfS-PLS VBS | Aucun | 0 |

> **Note** : Pour améliorer le LOO-RMSE VBS (paramètre principal de la carte),
> il faudra des sondages avec **mesure VBS de laboratoire** explicite.
> Les nouveaux sondages V10 n'en contiennent pas.

---

## 8. Récapitulatif — Ce qu'il NE FAUT PAS faire

1. **Ne pas créer de nouvelles tables pour stocker les mêmes données ailleurs** :
   - WL/WP → TOUJOURS dans `essais_atterberg`, pas dans `essais_geotechniques`
   - Proctor OPM → TOUJOURS dans `essais_proctor`, pas dans `echantillons.meta`
   - Type de sol → TOUJOURS dans `essais_classif`, pas dans `sondages.type_sol`

2. **Ne pas insérer de sondages sans code unique** : le champ `sondages.code`
   doit être unique (format `PROJET_IDENTIFIANT`).

3. **Ne pas lancer le recalcul KED avant la validation dry-run** :
   un mauvais import créerait des valeurs interpolées erronées
   qui pollueraient les 441,105 prédictions existantes.

4. **Ne pas utiliser le port 5432** : la bonne instance est sur **5433**.

5. **Ne pas oublier le dump de sécurité** avant toute migration (règle BM-22).

---

## 9. Checklist d'exécution

- [ ] Dump de sécurité effectué + hash SHA256 vérifié
- [ ] Dry-run sans erreur + rapport lu
- [ ] Migration 176 (essais_penetrometre) appliquée
- [ ] Migration 177 (essais_pressiometre) appliquée
- [ ] Migration 178 (essais_cbr + indice_groupe) appliquée
- [ ] Phase 2 : sondages importés + coordonnées vérifiées
- [ ] Phase 3 : horizons labo importés + essais vérifiés
- [ ] Phase 4 : profils in-situ importés
- [ ] Phase 5 : CBR + Proctor importés
- [ ] Phase 6 : validation finale (N sondages, géoréf, mapping grille)
- [ ] Pipeline worker lancé en arrière-plan
- [ ] `ai_interpolation_runs` COUNT > 310 (traçabilité confirmée)
- [ ] Cartes thématiques WL/WP/IP mises à jour et vérifiées visuellement
