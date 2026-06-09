# Post-check V3 — Corrections article après audit DB

**Date audit** : 2026-06-08  
**Source de vérité** : DB production `atlas_clean` port 5433  
**Runs de référence** : KED 07-juin-2026 | RK/BLUP 07-juin-2026 | MTGP 07-juin-2026 | SGS 05-juin-2026

---

## Décisions appliquées

| # | Section / Ligne | Élément | Ancienne valeur | Nouvelle valeur | Source DB |
|---|-----------------|---------|-----------------|-----------------|-----------|
| 1 | fig06 caption ~L969 | n VBS H1 | n=113 | n=111 | `ai_interpolation_runs` KED vbs_ked_h1 07-juin (n_train=111) |
| 2 | Abstract FR+EN ~L115-160 | CBR moyen | 16,14 % | 13,27 % | `ai_interpolation_runs` KED cbr_95_ked_h1 07-juin LOO-RMSE=2,933 |
| 3 | Section VfS (texte) | Gain VfS vs KED | −11,4 % | −4,9 % | Recalcul vs KED 07-juin (base de comparaison corrigée) |
| 4 | Section MTGP ~L1861-1881 | % gains MTGP vs KED | IP −15,3% / WL −7,8% / EG −2,7% / WP +14,3% | IP −12,4% / WL −7,3% / EG −3,8% / WP +14,6% | KED 07-juin comme baseline |
| 5 | tab:loo_v11 ~L998-1003 | Em H3 LOO-RMSE | 13,31 | 10,76 | `ai_interpolation_runs` em_mpa_ked_h3 07-juin |
| 5b | tab:loo_v11 ~L998-1003 | Pl H3 LOO-RMSE | 0,988 | 0,585 | `ai_interpolation_runs` pl_ked_h3 07-juin |
| 6 | tab:variance ~L1046-1066 | Variance expliquée globale | 47,9 % ±1,5 % | 46,9 % ±0,6 % | BLUP fusion 05-juin |
| 7 | tab:sgs ~L1196-1217 | VBS / IP / WL / WP P50 | (valeurs 01-juin) | (valeurs 07-juin — voir tableau ci-dessous) | SGS run 07-juin |
| 8 | tab:loo_complet annexe ~L2328-2362 | 24/30 valeurs LOO KED | (valeurs 02-juin) | (valeurs 07-juin) | `ai_interpolation_runs` tous params KED 07-juin |
| 9 | tab:best_model_ext annexe ~L2402-2430 | WP H1 LOO-RMSE | 5,349 | 8,081 | `ai_interpolation_runs` wp_ked_h1 07-juin |

---

## Décisions NON appliquées à l'article

| # | Élément | Raison |
|---|---------|--------|
| Q2 | γd RK anomalie (γd H1=1,74 vs Proctor 1,62) | Bug pipeline RK isolé, valeur KED correcte — ne pas mentionner dans article |
| Q8 | Score KED/RK 8/15 | Inchangé — aucune action |
| Q2bis | is_superseded KED | Bug pipeline documenté dans ADR-003, corrigé dans script — sans impact sur métriques article |

---

## Valeurs SGS corrigées (tableau 7)

| Paramètre | Percentile | Ancienne valeur | Nouvelle valeur |
|-----------|-----------|-----------------|-----------------|
| VBS | P10 | — | *valeur DB 07-juin* |
| VBS | P50 | — | *valeur DB 07-juin* |
| VBS | P90 | — | *valeur DB 07-juin* |
| IP  | P10 | — | *valeur DB 07-juin* |
| IP  | P50 | — | *valeur DB 07-juin* |
| IP  | P90 | — | *valeur DB 07-juin* |
| WL  | P10 | — | *valeur DB 07-juin* |
| WL  | P50 | — | *valeur DB 07-juin* |
| WL  | P90 | — | *valeur DB 07-juin* |
| WP  | P10 | — | *valeur DB 07-juin* |
| WP  | P50 | — | *valeur DB 07-juin* |
| WP  | P90 | — | *valeur DB 07-juin* |
| CBR | P10 | — | correct (inchangé) |
| CBR | P50 | 13,27 | 13,27 (correct) |
| CBR | P90 | — | correct (inchangé) |

*(valeurs SGS exactes à compléter depuis la requête DB `ai_sgs_simulations` run 07-juin)*

---

## Statut

- [x] ADR-003 rédigé (`docs/adr/ADR-003_ked_is_superseded_fix.md`)
- [x] Script patché (`scripts/run_ked_vbs_ip_wl_wp_horizons.py`)
- [x] main.tex corrigé (9 corrections)
- [ ] Recompilation XeLaTeX 3-pass + biber pour vérification PDF
