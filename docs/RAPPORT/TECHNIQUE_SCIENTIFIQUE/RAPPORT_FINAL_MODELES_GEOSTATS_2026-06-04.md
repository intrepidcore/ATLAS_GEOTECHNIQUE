# Atlas Géotechnique du Togo — Rapport Final des Modèles Géostatistiques
## Hiérarchie L1 → L4 : état au 2026-06-04 (Post-Audit Géocodage)

**Auteur :** Serge TABE DJATO  
**Encadrement :** Intrepid Core Engineering Standards  
**Base de données :** `atlas_clean` @ 127.0.0.1:5433  
**Mailles :** 29 407 × 3 horizons (H1: 0.5–1.5m | H2: 1.0–2.0m | H3: 1.5–2.5m)  
**Rapport précédent :** `RAPPORT_FINAL_MODELES_GEOSTATS_2026-06-01.md`  
**Référence audit :** `AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md`

---

## 1. Contexte — Découverte Critique du 2026-06-04

Un audit de la couche de couverture UI a révélé deux anomalies critiques :

| Anomalie | Impact | Statut |
|----------|--------|--------|
| **Bug A** : Vue `v_mailles_with_location_counts` hardcode `0 AS n_sondages` | Coverage UI = 0 mailles avec données | ✅ Corrigé (migration 102) |
| **Bug B** : 187 sondages avec `geom = POINT(1.0, 8.6)` (centroïde Kaniamboua) | Biais spatial massif dans tous les modèles | ⏳ Correction en cours |

### 1.1 Situation des sondages au 2026-06-04

| Mode de localisation | Avant audit | Objectif post-correction |
|----------------------|-------------|--------------------------|
| `exact` / `gps` | 1 | ≥ 10 |
| `manual` | 0 | ≥ 100 |
| `inferred` | 89 | maintenu |
| `adm_random_cell` | 112 | maintenu |
| `geocoded` (recalibré) | 185 | maintenu |
| `fallback_default` (marqués) | 187 | → 0 (après re-géocodage) |
| `NULL` | 370 | → 0 |

### 1.2 État des modèles

| Modèle | Statut calcul | Statut données | Action requise |
|--------|---------------|----------------|----------------|
| L1 KED Hiérarchique | ✅ Calculé (29 407 mailles) | ⚠️ Biais spatial | Relancer après re-géocodage |
| L2a RK-SCORPAN | ✅ Calculé (29 407 mailles) | ⚠️ Biais spatial | Relancer après re-géocodage |
| L2b Fusion BLUP | ✅ Calculé (29 407 mailles) | ⚠️ Biais cumulé | Relancer après L1+L2a |
| L3 VfS-PLS | ❌ Non calculé (vbs_vfs_pred=NULL) | ⏳ Bloqué | Relancer après re-géocodage PLS |
| L4 MTGP/ICM | ✅ Calculé (29 407 mailles) | ⚠️ Biais spatial | Relancer après re-géocodage |

---

## 2. Métriques actuelles (baseline pré-correction)

> Ces métriques sont les **métriques de référence baseline** calculées avec les
> données biaisées. Elles servent à quantifier l'amélioration post-correction.

### 2.1 LOO-RMSE H1 — Modèles L1/L2a/L3 (VBS, IP, WL, WP, EG)

| Paramètre | L1 KED hier | L2a RK | L3 VfS | L4 MTGP |
|:---------:|:-----------:|:------:|:------:|:-------:|
| VBS (g/100g) | 2.941 | **2.480** | **2.788** | n/a |
| IP (%) | **9.786** | 12.793 | n/a | n/a |
| WL (%) | **13.213** | 15.417 | n/a | n/a |
| WP (%) | **7.949** | 8.071 | n/a | n/a |
| EG (%) | 1.668 | **1.243** | n/a | n/a |

### 2.2 Réduction de variance L2b BLUP (baseline)

| Paramètre | σ²_KED H1 | σ²_RK H1 | σ²_fusion H1 | Réduction |
|:---------:|:---------:|:--------:|:------------:|:---------:|
| VBS | 12.45 | 10.60 | 5.73 | **45.9%** |
| IP | 90.99 | 79.87 | 42.33 | **47.0%** |
| WL | 174.15 | 140.36 | 77.63 | **44.7%** |
| WP | 54.54 | 60.37 | 28.70 | **47.4%** |
| EG | 2.68 | 2.55 | 1.34 | **46.6%** |

> **Note** : La propriété BLUP (σ²_fusion < min(σ²_KED, σ²_RK)) est garantie mathématiquement
> et ne sera pas affectée par la correction géocodage. Seules les **valeurs absolues** changeront.

### 2.3 L4 MTGP — Prédictions moyennes (baseline)

| Paramètre | N train | Pred moy H1 | Var moy H1 |
|:---------:|:-------:|:-----------:|:----------:|
| VBS | ~260 | 4.090 g/100g | 8.928 |
| IP | ~260 | 19.463 % | 100.257 |
| EG | ~260 | 3.731 % | 3.546 |

---

## 3. Corrections Implémentées (Session 2026-06-04)

### 3.1 Migrations SQL appliquées / préparées

| Migration | Fichier | Statut | Action |
|-----------|---------|--------|--------|
| 101 | `101_extend_ai_job_queue_l1_l4.sql` | ✅ Appliqué | — |
| 102 | `102_fix_mv_mailles_coverage.sql` | ✅ Appliqué | — |
| 103 | `103_mark_fallback_sondages.sql` | ✅ Appliqué | 187 sondages marqués `fallback_default` |
| **104** | `104_fix_geocode_sondage_location_mode.sql` | ⬜ **À appliquer** | Fix trigger `geocode_sondage()` |
| **105** | `105_geocode_suggestions_extended.sql` | ⬜ **À appliquer** | Table suggestions fuzzy + contrainte |

**Commande d'application :**
```bash
PGPASSWORD=atlas psql -h 127.0.0.1 -p 5433 -U atlas -d atlas_clean \
  -f services/api-geo/migrations/104_fix_geocode_sondage_location_mode.sql
PGPASSWORD=atlas psql -h 127.0.0.1 -p 5433 -U atlas -d atlas_clean \
  -f services/api-geo/migrations/105_geocode_suggestions_extended.sql
```

### 3.2 Scripts créés

| Script | Fichier | Usage |
|--------|---------|-------|
| Re-géocodage fuzzy | `scripts/regeocod_fuzzy_v1.py` | Traite les 187 sondages fallback |
| Orchestrateur nightly v2 | `scripts/run_all_models_nightly_v2.py` | Lance les modèles via API Rust |

---

## 4. Procédure de Correction Complète (Ordre Impératif)

### Étape 1 — Appliquer les migrations 104 et 105
```bash
PGPASSWORD=atlas psql -h 127.0.0.1 -p 5433 -U atlas -d atlas_clean \
  -f services/api-geo/migrations/104_fix_geocode_sondage_location_mode.sql
PGPASSWORD=atlas psql -h 127.0.0.1 -p 5433 -U atlas -d atlas_clean \
  -f services/api-geo/migrations/105_geocode_suggestions_extended.sql
```

### Étape 2 — Re-géocodage fuzzy en dry-run (vérification)
```bash
python scripts/regeocod_fuzzy_v1.py --dry-run --source-filter V10_MASTER_2026
# Vérifier le CSV dans logs/ — combien d'auto vs propose vs manual_required ?
```

### Étape 3 — Re-géocodage fuzzy réel
```bash
python scripts/regeocod_fuzzy_v1.py --source-filter V10_MASTER_2026
```

### Étape 4 — Validation manuelle dans l'UI
- Ouvrir `http://localhost:1420`
- Onglet Géocodage → valider les suggestions `action=proposed`
- Positionner manuellement les sondages `action=manual_required`

### Étape 5 — Vérification DB post-géocodage
```sql
-- Attendu : 0
SELECT COUNT(*) FROM atlas.sondages
WHERE location_mode = 'fallback_default' AND deleted_at IS NULL;

-- Attendu : 0
SELECT maille_code, COUNT(*) FROM atlas.sondages
WHERE deleted_at IS NULL GROUP BY maille_code HAVING COUNT(*) > 50;

-- Attendu : ≥ 200
SELECT COUNT(*) FROM atlas.mv_mailles_geotech WHERE has_data = true;
```

### Étape 6 — Relancement des modèles ML
```bash
# Option A : orchestrateur v2 (recommandé — via API Rust)
python scripts/run_all_models_nightly_v2.py

# Option B : orchestrateur v1 (direct subprocess Python)
python scripts/run_all_models_nightly.py --reset
```

### Étape 7 — Validation des résultats
```bash
curl http://localhost:8000/ai/models/status | python3 -m json.tool
# Vérifier que L1/L2a/L2b/L4 ont status=ready et des métriques LOO-RMSE
```

---

## 5. Orchestrateur Nightly v2 — Gain de Performance

L'orchestrateur `run_all_models_nightly_v2.py` remplace les appels directs `subprocess.run()`
par des appels à l'API Rust (`POST /ai/jobs/enqueue` + `GET /ai/jobs/:id`).

### Comparaison v1 vs v2

| Critère | v1 (subprocess Python) | v2 (API Rust) |
|---------|------------------------|---------------|
| Gestion mémoire | Accumulée entre subprocesses | Libérée entre chaque job |
| Observabilité | Logs fichier locaux | Logs en DB + UI localhost:1420 |
| Reprise après crash | Checkpoint JSON local | Checkpoint DB (ai_job_queue) |
| Concurrence | Non contrôlée | SKIP LOCKED Rust (anti-double lancement) |
| GPU MTGP | TF_FORCE_GPU_ALLOW_GROWTH via env | Configuré au niveau worker Rust |
| Monitoring | Logs terminal | Dashboard `/ai/models/status` en temps réel |

### Usage typique post-correction géocodage
```bash
# Démarrer l'API (si pas déjà lancée)
docker compose up -d api-geo

# Lancer la nuit — v2 via API
python scripts/run_all_models_nightly_v2.py 2>&1 | tee logs/nightly_$(date +%Y%m%d).log

# Statut en cours d'exécution
python scripts/run_all_models_nightly_v2.py --status

# Reprendre depuis le checkpoint après une interruption
python scripts/run_all_models_nightly_v2.py  # reprend automatiquement
```

---

## 6. Métriques Post-Correction (À Remplir)

> Cette section sera mise à jour après l'exécution de la procédure de correction.

| Indicateur | Baseline (pré-correction) | Post-correction | Δ |
|------------|---------------------------|-----------------|---|
| N sondages `exact`+`gps`+`manual` | 1 | — | — |
| N sondages `fallback_default` | 187 | 0 (cible) | — |
| Mailles `has_data=true` | 274 | — | — |
| LOO-RMSE VBS H1 L1 KED | 2.941 | — | — |
| LOO-RMSE VBS H1 L2a RK | 2.480 | — | — |
| LOO-RMSE VBS VfS L3 | 2.788 | — | — |
| σ²_fusion VBS H1 (réduction) | 45.9% | — | — |

---

## 7. Références

- `AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md` — Diagnostic complet + roadmap phases 0–5
- `RAPPORT_FINAL_MODELES_GEOSTATS_2026-06-01.md` — Métriques officielles pré-audit
- `RESULTATS_FUSION_KED_RK.md` — Détail métriques BLUP + alerte provisoire
- `RESULTATS_MTGP_BLOC_D.md` — Résultats MTGP + plan de relancement
- `RESULTATS_VFS_BLOC_C.md` — Statut VfS + checklist de déblocage
- `SESSION_2026-06-04_PIPELINE_ML_L1L4.md` — Chronologie technique de la session
- Hengl et al. (2007). *About regression-kriging*, Computers & Geosciences 33(10).
- Chilès & Delfiner (2012). *Geostatistics: Modeling Spatial Uncertainty*, Wiley.

---

*Document généré le 2026-06-04*  
*Scripts : `regeocod_fuzzy_v1.py`, `run_all_models_nightly_v2.py`*  
*Migrations : 104 (geocode_sondage fix), 105 (geocode_suggestions + contrainte)*  
*Auteur : Claude Sonnet 4.6 (IA assistante) — Projet Atlas Géotechnique du Togo*
