# Roadmap — Refonte panneau droit unifié + Plan de campagne terrain + fix ADM3

**Date** : 2026-06-16
**Statut** : Phase 0 (fix ADM + commit) ✅ terminée — Phase 1 (refonte navigation) en cours
**Réf. session** : suite de `docs/RAPPORT/session/session_2026_06_15_refonte_panneaux_v3_theme_zones.md`

---

## Sommaire

1. Contexte et déclencheurs
2. Phase 0 — Fix ADM1/ADM3 (terminée)
3. Cahier des charges — Panneau droit unifié (navigation back-stack)
4. Cahier des charges — Plan de campagne terrain (refonte + intégration)
5. Les 11 paramètres géotechniques × 3 horizons — référentiel scientifique
6. Ce qui est réellement câblé côté moteur api-opti (limites actuelles)
7. Plan d'implémentation par étapes
8. Points ouverts / décisions à valider

---

## 1. Contexte et déclencheurs

Trois signaux distincts ont motivé cette roadmap :

1. **Bug ADM au survol** : le tooltip de survol des mailles n'affichait que la préfecture (ADM2, ex. "Zio"), jamais la région (ADM1) ni la commune (ADM3), alors que le frontend était déjà prêt à afficher les 3 niveaux.
2. **Mauvais emplacement fonctionnel** : "Plan de campagne terrain" (assistant d'optimisation de sondages) vit dans le panneau gauche, à côté de KPI passifs de lecture, alors que c'est un panneau d'action (déclenche un calcul + écrit une couche carte).
3. **Problème de navigation du panneau droit** : 3 modules indépendants (`Cartes thématiques`, `Infer / Opti`, `Analyse scientifique`) s'ouvrent chacun dans son propre conteneur `position:fixed; right:0`, superposés — pas de navigation commune, pas de bouton retour, l'utilisateur doit fermer un panneau pour voir les boutons des autres.

---

## 2. Phase 0 — Fix ADM1/ADM3 (terminée, commit `5fc10e9`)

### 2.1 Diagnostic (preuve par le code)

**Frontend déjà prêt** — [ui/src/main.ts:1378-1381](../../ui/src/main.ts) :
```typescript
if (p.adm1_name || p.adm2_name || p.adm3_name) {
  const loc = [p.adm1_name, p.adm2_name, p.adm3_name].filter(Boolean).join(' › ')
  content += `<div ...>${loc}</div>`
}
```
Le tooltip gère déjà la concaténation Région › Préfecture › Commune. Le problème n'était donc **pas** côté UI.

**Backend — la donnée existe mais est jetée par une vue.**

- `atlas.mailles.adm1_name` et `adm3_name` ont été ajoutées en migration `004` et `008`, puis **correctement peuplées par jointure spatiale** (centroïde de la maille intersecté avec `public.adm1`/`adm3`) dans [`111_fix_api_bindings.sql:25-41`](../../db/migrations/111_fix_api_bindings.sql).
- Mais une migration de **reconstruction d'urgence** postérieure, [`migrations_post_v1/153_full_rebuild.sql:18-20`](../../migrations_post_v1/153_full_rebuild.sql) (après une suppression en cascade), a recréé `atlas.v_mailles_with_location_counts` avec :
  ```sql
  NULL as adm1_name,
  mv.adm2_name,
  NULL as adm3_name,
  ```
  → ADM2 survit (lu depuis `atlas.mailles`), ADM1 et ADM3 sont écrasés par des `NULL` codés en dur, malgré la donnée réelle présente dans la table.
- Cette vue alimente `atlas.mv_mailles_geotech`, lue par `get_coverage_mailles()` dans [`services/api-geo/src/routes.rs:900-916`](../../services/api-geo/src/routes.rs), qui sert le GeoJSON de la grille consommé par le tooltip.

### 2.2 Fix appliqué

Migration [`181_fix_adm1_adm3_dropped_by_emergency_rebuild.sql`](../../db/migrations/181_fix_adm1_adm3_dropped_by_emergency_rebuild.sql) :
1. Sauvegarde légère (`atlas._backup_mailles_adm_181`) des colonnes ADM avant modification.
2. Re-backfill défensif (`UPDATE ... WHERE adm*_name IS NULL` uniquement — aucune perte de donnée existante, idempotent).
3. `CREATE OR REPLACE VIEW atlas.v_mailles_with_location_counts` pour lire `mv.adm1_name` / `mv.adm3_name` au lieu de `NULL`.
4. `REFRESH MATERIALIZED VIEW atlas.mv_mailles_geotech`.
5. Vérification (`RAISE NOTICE`) du nombre de mailles avec ADM1/ADM2/ADM3 non-nuls après refresh.

**⚠️ Action requise** : cette migration n'a **pas été exécutée contre la base** (pas d'accès `psql`/Docker depuis cet environnement shell). À appliquer manuellement :
```powershell
# Depuis WSL2 / conteneur où la DB est accessible
psql -h localhost -p 5433 -U postgres -d atlas_clean -f db/migrations/181_fix_adm1_adm3_dropped_by_emergency_rebuild.sql
```
Aucune modification de géométrie — la règle de backup `atlas.zones_etude` ne s'applique pas, mais la sauvegarde légère (étape 1) couvre le risque résiduel.

### 2.3 Downstream — rien d'autre à toucher
`atlas.mailles_geotechnique_stats_wgs84` ([`153_full_rebuild.sql:93-160`](../../migrations_post_v1/153_full_rebuild.sql)) lit déjà `mv.adm1_name`/`mv.adm3_name` depuis `mv_mailles_geotech` — une fois la vue de base corrigée et la matérialisée rafraîchie, cette vue affichera automatiquement les bonnes valeurs sans modification supplémentaire.

---

## 3. Cahier des charges — Panneau droit unifié (navigation back-stack)

### 3.1 Constat (preuve par le code)

3 conteneurs indépendants, tous `position:fixed; top:52px; right:0` :
- `#thematicPanel` ([ui/index.html:308](../../ui/index.html)) — `z-index:1500`
- conteneur du `command-center.ts` (Infer / Opti)
- conteneur du `scientific-drawer.ts` (Analyse scientifique)

Chaque bouton (`openThematicPanelSidebar`, `openInferOptiCommandCenter`, `openScientificDrawerBtn`) ouvre son propre overlay sans fermer les autres ni partager de conteneur. D'où la sensation de "3 fils" — 3 zones scrollables superposées sans navigation commune.

### 3.2 Principe retenu

Un **panneau droit unique** avec navigation en pile (back-stack), façon "page suivante / page précédente" :

```
┌──────────────────────────────────┐
│ ← Retour      Cartes thématiques  │  ← header contextuel, visible
├──────────────────────────────────┤     uniquement hors de la vue racine
│                                    │
│      [contenu de la vue active]   │  ← un seul scroll container
│                                    │
└──────────────────────────────────┘
```

- **Vue racine** (accueil panneau droit) : liste des boutons actuels + nouveau bouton `Plan de campagne` :
  1. Cartes thématiques
  2. Infer / Opti
  3. Analyse scientifique
  4. **Plan de campagne** (nouveau, sous Cartes thématiques — cf. §4)
- **Pile de navigation** : `viewStack: string[]`. `pushView(id)` empile et affiche ; `popView()` désempile et revient à la vue précédente (ou à la racine).
- Le bouton retour n'apparaît que si `viewStack.length > 0`.
- **État préservé par vue** : chaque module garde son état interne (filtres thématiques sélectionnés, résultats de campagne calculés) tant qu'on ne fait pas de reset explicite — pas de re-fetch au retour. C'est la règle UX `state-preservation` (référentiel ui-ux-pro-max, §9 Navigation Patterns).
- **Transition** : crossfade ou slide léger (150–250ms), cohérent avec le reste de l'UI (règles `duration-timing`, `motion-consistency`).
- La couche carte générée par chaque module (mailles thématiques, couche campagne) reste visible même quand on quitte la vue — comportement déjà correct aujourd'hui, à préserver impérativement.

### 3.3 Impact technique

| Fichier | Nature du changement |
|---|---|
| `ui/index.html` | Remplacer les 3 conteneurs `position:fixed` indépendants par **un seul** conteneur `#rightPanelShell` avec header (`#rightPanelHeader` : bouton retour + titre) + zone de contenu (`#rightPanelBody`). Nouveau bouton `Plan de campagne` dans la liste d'accueil. |
| `ui/src/main.ts` (ou nouveau `ui/src/right-panel/shell.ts`) | Orchestrateur : `pushView(viewId)`, `popView()`, `renderRoot()`. Chaque module (thematic, command-center, scientific-drawer, campaign-planner) reçoit un **conteneur hôte** au lieu de créer le sien. |
| `ui/src/infer-opti/command-center.ts` | Adapter pour monter dans le conteneur hôte fourni plutôt que créer son propre `position:fixed`. |
| `ui/src/scientific-drawer.ts` | Idem. |
| `ui/src/mission/campaign-planner.ts` | Idem + déplacement (cf. §4). |
| CSS (`index.html` `<style>` ou nouveau fichier) | Nouvelles règles `.right-panel-shell`, `.right-panel-header`, `.right-panel-back-btn`, transitions crossfade. Suppression progressive des styles `#thematicPanel{position:fixed...}` dupliqués par module. |

**Risque identifié** : les 3 modules existants ont chacun leur propre logique de montage/démontage et leurs propres styles CSS scoping (`#thematicPanel .xxx`). Le refactor doit être fait **un module à la fois**, en gardant la compatibilité CSS (renommer le conteneur hôte avec le même `id` que l'ancien plutôt que de tout réécrire) pour limiter la régression visuelle.

---

## 4. Cahier des charges — Plan de campagne terrain (refonte + intégration)

### 4.1 État actuel (analysé)

Composant [`ui/src/mission/campaign-planner.ts`](../../ui/src/mission/campaign-planner.ts), monté dans `#campaignPlannerMount` en bas du **panneau gauche**. Champs actuels :
- Zone d'étude (select)
- Budget sondages (1–200)
- Grille (2km / 28km)
- Contrainte dépression géologique (dur, toujours cochée par défaut)
- 2 boutons : Classement rapide (heuristique) / Optimiser (AG)
- Table résultats (rang, code maille, score) + métriques (pool, % en dépression, risque moyen, fitness AG)
- Toggle affichage carte + bouton effacer couche

C'est un panneau d'**action** (déclenche un calcul serveur + écrit une couche Leaflet), mal placé à côté de KPI passifs.

### 4.2 Nouvel emplacement

Bouton `Plan de campagne` dans la vue racine du panneau droit unifié (§3), juste sous `Cartes thématiques`. Au clic : `pushView('campaign')`.

### 4.3 Structure de la vue (3 sections, progressive disclosure)

| Section | Contenu | Statut |
|---|---|---|
| **A. Cadrage** | Zone d'étude, Grille (2km/28km), **Préréglage d'objectif** (remplace l'`objectif:'gonflement'` figé) | À refondre — voir §4.4 |
| **B. Contraintes** | Budget sondages, Contrainte dépression (dur/souple) | Repris tel quel |
| **C. Exécution & résultats** | 2 boutons (rapide/AG), statut, métriques, table résultats, toggle carte | Repris tel quel — fonctionnellement correct |

### 4.4 Section A révisée — Préréglage d'objectif (honnête vis-à-vis du moteur)

**Constat technique important** (vérifié dans `services/api-opti/src/campaign.rs`) : le champ `objectif` envoyé aujourd'hui (`'gonflement'`, en dur) **n'est pas branché** sur les paramètres ML du catalogue thématique (VBS, IP, RK, BLUP...). Le score de priorisation est un composite pondéré de 6 dimensions réellement actives :

```rust
pub struct CampaignWeights {
    w_risque: f64,            // risque RGA / argilosité
    w_variance: f64,          // incertitude du krigeage (σ²_K)
    w_distance_sondage: f64,  // éloignement des sondages existants
    w_transition_geol: f64,   // proximité d'une transition géologique
    w_infrastructure: f64,    // accessibilité / proximité réseau
    w_zone_coverage: f64,     // couverture globale de la zone
}
```

`objectif: "gonflement"` ne fait qu'une chose côté serveur : forcer `w_risque ≥ 1.2` ([campaign.rs:758](../../services/api-opti/src/campaign.rs)). Exposer les ~50 IDs du catalogue `ia_ag` (VBS BLUP H1, RK H2, etc.) comme choix d'"objectif" ne changerait donc **rien** dans le calcul réel — ce serait un menu qui ment sur son effet.

**Décision retenue** : exposer ce qui est **réellement câblé**.

| Champ | Type | Détail |
|---|---|---|
| **Préréglage d'objectif** | select, 5 options | • *Argilosité / gonflement* (défaut actuel) → `w_risque=1.5` <br>• **Réduction incertitude krigeage** → `w_variance=1.5` — c'est exactement la logique d'échantillonnage adaptatif décrite dans l'article scientifique (§5, cf. encadré ci-dessous) <br>• *Couverture lacunaire* → `w_zone_coverage=1.5, w_distance_sondage=1.3` <br>• *Logistique / accessibilité* → `w_infrastructure=1.5` <br>• *Équilibré* → tous les poids à 1.0 |
| **Mode expert** (toggle) | dévoile 6 sliders | un slider par poids, 0–2, pas 0.1 — leviers réellement actifs dans le moteur api-opti |

> **Justification scientifique du preset "Réduction incertitude krigeage"** — citation du document de référence (`docs/RECHERCHE/article_geostats_togo/main.tex`, lignes 203-212) :
> *"là où la variance locale σ²_K(s₀) est élevée, un sondage supplémentaire réduit davantage l'incertitude cartographique qu'ailleurs — logique d'échantillonnage adaptatif fondée sur la théorie géostatistique. La question passe de "où manque-t-il des données ?" à "où un sondage supplémentaire serait-il le plus utile ?""*
>
> C'est très exactement à quoi sert `w_variance` dans le moteur api-opti — ce preset n'est donc pas une simple option UI, il opérationnalise la thèse centrale de l'article au niveau du planificateur de campagne.

### 4.5 Hors scope explicite (Phase 2 — nécessite du travail backend)

Le catalogue des **11 paramètres géotechniques × 3 horizons** (§5) n'est aujourd'hui PAS exploitable comme cible directe d'optimisation par `api-opti`, parce que le moteur ne consomme pas une carte de variance par paramètre — il utilise un score composite générique. Pour qu'un utilisateur puisse dire *"optimise le choix des mailles pour réduire l'incertitude sur VBS-H2 spécifiquement"*, il faudrait :

1. Exposer côté `api-geo` une route retournant, par maille, la variance de krigeage du paramètre/horizon choisi (probablement déjà calculée en base — RK/KED produisent une variance prédictive, cf. article §6 "variance prédictive homoscédastique").
2. Ajouter un champ `parametre_cible` + `horizon_cible` à `CampaignRequest` (côté `api-opti`), et substituer (ou pondérer) `w_variance` par la variance réelle de ce paramètre/horizon plutôt qu'un proxy générique.
3. Adapter `weighted_priority()` pour consommer cette variance ciblée.

Cette phase 2 est documentée ici pour ne pas la perdre, mais n'est **pas** dans le périmètre d'implémentation immédiate (cf. §7, Étape 4).

---

## 5. Les 11 paramètres géotechniques × 3 horizons — référentiel scientifique

Source : `docs/RECHERCHE/article_geostats_togo/main.tex`, lignes 101-102 et 349-359.

### 5.1 Les 11 paramètres

| # | Paramètre | Nom complet | Unité |
|---|---|---|---|
| 1 | VBS | Valeur au bleu de méthylène | g/100g |
| 2 | IP | Indice de plasticité | % |
| 3 | WL | Limite de liquidité | % |
| 4 | WP | Limite de plasticité | % |
| 5 | EG | Facteur de gonflement | — |
| 6 | CBR 95% | Indice CBR à 95% de compactage | % |
| 7 | γd (gamma_d_max) | Densité sèche maximale (Proctor) | — |
| 8 | w_opt | Teneur en eau optimale (Proctor) | % |
| 9 | Rd | Résistance dynamique (pénétromètre) | MPa |
| 10 | Em | Module pressiométrique | MPa |
| 11 | Pl | Pression limite pressiométrique | — |

Corrélations inter-paramètres notables (justifiant le modèle multi-tâches L4/MTGP) : $r_{IP,WL}=0{,}773$ ; $r_{CBR,\gamma_d}=0{,}658$ ; $r_{\gamma_d,w_{opt}}=-0{,}684$.

### 5.2 Les 3 horizons canoniques

| Horizon | Profondeur | Signification géotechnique |
|---|---|---|
| **H1** | 0–1 m | Couche de fondation courante des routes ; paramètres les mieux documentés |
| **H2** | 1–1,5 m | Zone de transition sol résiduel / altérite, souvent sous-documentée |
| **H3** | > 1,5 m | Sol résiduel profond ; essais in situ ($E_m$, $P_l$) et pénétrométriques (Rd) dominants |

### 5.3 Correspondance avec le catalogue thématique existant

Le catalogue `THEMATIC_PARAMETERS` ([ui/src/thematic/thematic-types.ts](../../ui/src/thematic/thematic-types.ts)) expose déjà une grande partie de ces paramètres × horizons sous forme d'IDs (`vbs_rk_h1`, `ip_blup_h2`, `eg_mtgp_h3`, etc.) pour les cartes thématiques — c'est la bonne référence à réutiliser si la Phase 2 (§4.5) est lancée, plutôt que recréer un nouveau catalogue.

---

## 6. Ce qui est réellement câblé côté moteur api-opti (limites actuelles)

Résumé pour éviter de re-découvrir cette limite plus tard :

- `CampaignRequest.objectif: String` est transmis et renvoyé tel quel dans la réponse (traçabilité/affichage), mais n'influence le calcul que via le cas spécial `"gonflement"` (`weights.w_risque = max(1.2)`).
- Le vrai moteur de score est `weighted_priority(row, weights)` avec les 6 poids de `CampaignWeights` (§4.4).
- Il n'existe **aucune** notion de paramètre/horizon ciblé dans `api-opti` aujourd'hui.
- `CampaignRequest.weights: Option<CampaignWeights>` existe déjà côté backend (champ optionnel) — le frontend ne l'envoie jamais actuellement. **Bonne nouvelle** : exposer les 6 sliders en mode expert (§4.4) ne nécessite **aucun changement backend**, juste renseigner ce champ optionnel déjà supporté.

---

## 7. Plan d'implémentation par étapes

### Étape 0 — Fix ADM (✅ fait, ce commit)
- [x] Migration `181_fix_adm1_adm3_dropped_by_emergency_rebuild.sql` écrite
- [x] Commit du code + migration + doc session
- [ ] **Reste à faire (manuel, hors session)** : exécuter la migration contre la DB réelle (`psql -h localhost -p 5433 -U postgres -d atlas_clean -f db/migrations/181_...sql`)

### Étape 1 — Panneau droit unifié (structure de base)
- [ ] Créer `#rightPanelShell` (header + body) dans `ui/index.html`, en parallèle des 3 conteneurs existants (pas de suppression immédiate — migration progressive)
- [ ] Écrire l'orchestrateur `pushView`/`popView`/`renderRoot` (nouveau fichier `ui/src/right-panel/shell.ts` ou ajout dans `main.ts`)
- [ ] Vue racine avec les 4 boutons (Thématique, Infer/Opti, Analyse scientifique, Plan de campagne)
- [ ] Brancher `#openThematicPanelSidebar` sur `pushView('thematic')` en gardant le contenu existant de `#thematicPanel` tel quel (montage dans le nouveau conteneur hôte, pas de réécriture du module)

### Étape 2 — Migrer les 2 autres modules existants
- [ ] `command-center.ts` (Infer/Opti) → montage dans conteneur hôte
- [ ] `scientific-drawer.ts` (Analyse scientifique) → montage dans conteneur hôte
- [ ] Supprimer les anciens conteneurs `position:fixed` dupliqués une fois la bascule validée visuellement

### Étape 3 — Intégrer Plan de campagne dans le panneau droit
- [ ] Déplacer `campaign-planner.ts` du panneau gauche (`#campaignPlannerMount`) vers une vue du panneau droit (`pushView('campaign')`)
- [ ] Implémenter la Section A révisée (préréglages d'objectif + mode expert à 6 sliders, §4.4)
- [ ] Adapter `run()` pour envoyer `weights` (déjà supporté backend) au lieu du seul `objectif` figé
- [ ] Retirer le mount du panneau gauche, nettoyer `#campaignPlannerMount` dans `index.html`

### Étape 4 — Phase 2 (différée, nécessite specs backend)
- [ ] Spécifier la route de variance par paramètre/horizon côté `api-geo`
- [ ] Étendre `CampaignRequest` côté `api-opti` avec `parametre_cible`/`horizon_cible`
- [ ] Brancher la UI sur ce nouveau levier une fois disponible

---

## 8. Points ouverts / décisions à valider

1. **Exécution de la migration 181** : à faire manuellement, accès DB non disponible depuis l'environnement d'édition actuel.
2. **Ordre de migration des 3 modules existants vers le panneau unifié** : proposé Thématique → Infer/Opti → Analyse scientifique → Plan de campagne, du plus simple au plus complexe en termes de couplage carte/état.
3. **Préréglages d'objectif (§4.4)** : 5 presets proposés (Argilosité, Variance/incertitude, Couverture, Logistique, Équilibré) — à valider ou amender.
4. **Phase 2 (paramètre/horizon ciblé)** : confirmer qu'elle reste hors périmètre immédiat, ou la prioriser si c'est un besoin métier urgent (impliquerait du travail sur `api-opti` en Rust + une nouvelle route `api-geo`).
