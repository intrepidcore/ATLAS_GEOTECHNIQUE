# TODO — Révision V3 (issu de POINTS_REVISION_PROCHAINE_ITERATION_V3.md)
> Mise à jour : 2026-06-08

## HAUTE PRIORITÉ (avant soumission)

- [x] **Table 15 overflow** : `\multicolumn{5}{l}` → `\multicolumn{5}{p{12.5cm}}` ✓ (2026-06-08)
- [x] **Coquille : RG4 → RGA** — introuvable dans LaTeX, déjà RGA partout ✓
- [x] **Coquille : krieeage** — introuvable dans LaTeX (déjà corrigé) ✓
- [x] **Coquille : arhictecure** — introuvable dans LaTeX (déjà corrigé) ✓
- [x] **Coquille : argilisité** — introuvable, texte utilise déjà "argilosité" ✓
- [x] **Coquille : georéférencés** — abstract EN correct "georeferenced", résumé FR non trouvé ✓
- [x] **CBR effectif** : n=117 → n=280 dans légende figure 23 ✓ (2026-06-08)
- [x] **guard auto → seuil automatique** ✓ (2026-06-08)
- [x] **sur-couv. → sur-couverture** dans Table 15 ✓ (2026-06-08)
- [x] **Ajouter section « Data and code availability »** avant Remerciements ✓ (2026-06-08)
- [x] **Ajouter déclaration d'intérêts** avant Remerciements ✓ (2026-06-08)
- [x] **Clarifier statut MTGP Groupe 2** (Compactage) : phrase ajoutée — MTGP non calibré, Fusion BLUP seule ✓ (2026-06-08)
- [x] **Uniformiser décimaux** : tous les tableaux utilisent déjà la virgule {,} ✓ (2026-06-08)
- [ ] **Harmoniser VBS KED-H H1** : tab:loo_rmse = 2,933 (H1 uniquement, n=113) / tab:perf_region national = 3,147 (toutes régions) / tab:sensibilite_variogram sphérique = 3,147 — valeurs légitimement différentes. Fig03 bar chart à vérifier si besoin de régénération.

## PRIORITÉ MOYENNE

- [x] **Clarifier statut MTGP groupe compactage** : phrase ajoutée discussion ✓ (session précédente)
- [x] **Améliorer légende figure 7 (VBS maps)** : "L1--L5" → "L1, L2a, L2b et L4" avec note L3/L5 séparés ✓ (2026-06-08)
- [x] **Supprimer/expliquer « guard auto »** → "seuil automatique" ✓ (session précédente)
- [ ] **Revoir structure section 2.4 → 2.5** : regrouper validation LOO, blocs, Moran, Levene, PICP
- [x] **PICP vide pour CBR/γd/wopt** : déjà « --- » dans tableau 15 ✓
- [x] **Em/Pl checklist** : Région dense → orange, Région nord → rouge, footnote $^c$ ajoutée ✓ (2026-06-08)

## PRIORITÉ BASSE

- [ ] **Espaces insécables** avant « : », « ; », « ! », « ? » (LaTeX : `~:` etc.) — global
- [ ] **Raccourcir le titre** (25 mots → ~15) si soumission anglophone — NON FAIRE (demande utilisateur)
- [x] **DOI manquants** : brus2007sampling DOI ajouté, chassagneux1996 → @techreport + institution ✓ (2026-06-08)
- [x] **Ajouter déclaration d'intérêts** ✓ (session précédente)
- [x] **Guillemets** : `` '' → « » harmonisé (4 occurrences) ✓ (2026-06-08)
- [x] **Nombres décimaux dans tableaux** : déjà virgule {,} partout ✓

## DÉJÀ CORRIGÉ (sessions précédentes)

- [x] Pipeline figure : bug flèche L4→L3 (b_l5[4] → b_l5[5] → architecture réécrite)
- [x] Pipeline figure : labels statuts internes supprimés
- [x] Pipeline figure : flèches aux bords des boîtes (box_edge helper)
- [x] Table 15 : `table` → `table*` (deux colonnes) + `\clearpage`
- [x] SGS maps : scatter → polygon GDF (zéro stries)
- [x] VfS map : idem polygon, P2/P98 dynamique
- [x] roberts2017cross : référence ajoutée au .bib
- [x] `\textbf{$Dépendance` : bug LaTeX corrigé
- [x] Figs 1&2 : `[htbp]` → `[!ht]` + `\vspace{-0.6em}`
- [x] Table 5 : suit immédiatement sa phrase

## ARCHITECTURE SCRIPTS (rappel)

| Script | Rôle | Sortie |
|--------|------|--------|
| `scripts/headless_render_300dpi.py` | Cartes atlas L1-L4 + VfS | `exports_300dpi/` |
| `scripts/generate_sgs_vfs_maps.py` | Cartes SGS P10/P50/P90 | `exports_300dpi/` |
| `fix_pipeline_figure.py` | Figure pipeline article | `figures/` |
| `docs/.../figures/` | Figures article | article |
