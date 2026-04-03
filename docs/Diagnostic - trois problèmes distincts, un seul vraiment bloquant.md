Je vais analyser la situation complète avant de te donner un diagnostic et un plan d'action précis. Voici le diagnostic complet et le plan d'action, organisé du plus urgent au moins urgent.

---
![[Pasted image 20260330164215.png]]
## Diagnostic : trois problèmes distincts, un seul vraiment bloquant

Il faut bien distinguer ce qui est livré, ce qui est cassé, et ce qui est lent.

**Ce qui est livré et fonctionne :** l'UI est en place — mode expert, drawer scientifique, onglets DB Manager Pipeline/Audit. Build et tests passent. Les endpoints `kriging_vbs` et `kriging_ip` servent 29407 mailles. C'est une bonne base.

**Ce qui est cassé (bloquant pipeline) :** `ai_maille_features_fast` reste à 0 malgré des appels répétés à `refresh_ai_maille_features_fast_for_codes`. Le feature store est vide — ce qui signifie que tout le pipeline ML (inférence, régression kriging, classification RGA) travaille sur des features nulles ou absentes.

**Ce qui est lent (problème de performance, pas de correctness) :** la fonction `refresh_ai_maille_features_fast_for_codes` met plusieurs minutes même pour 5 codes. Ça suggère un `ST_Clip` massif sans filtre spatial préalable, ou une jointure sans index utilisé.

**Ce qui manque côté UI (non bloquant, à compléter) :** l'onglet Variogrammes utilise une approximation client-side. Il faudra câbler l'endpoint Python `POST /ai/plots/variogram` une fois implémenté.

---

## Problème 1 — Feature store vide : diagnostic root cause### Diagnostic à exécuter immédiatement — 3 requêtes psql

Avant de modifier quoi que ce soit, ces trois requêtes donnent le diagnostic exact :

```sql
-- 1. Vérifier si la fonction existe et sa définition
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'atlas' 
  AND routine_name = 'refresh_ai_maille_features_fast_for_codes';

-- 2. Vérifier l'état réel de la table
SELECT COUNT(*) as n_rows,
       COUNT(*) FILTER (WHERE vbs_avg IS NOT NULL) as n_vbs,
       COUNT(*) FILTER (WHERE ip_avg IS NOT NULL) as n_ip
FROM atlas.ai_maille_features_fast;

-- 3. Voir si des transactions sont bloquées sur cette table
SELECT pid, now()-query_start as age, state, wait_event_type, wait_event,
       left(query, 100) as query_start
FROM pg_stat_activity 
WHERE query ILIKE '%ai_maille_features_fast%'
  AND state <> 'idle';
```

---

## Plan d'action immédiat : résoudre le feature store

**Étape 1 — Tuer tous les refresh en cours et repartir proprement**

```sql
-- Via psql (pas via Python pour éviter timeout SQLAlchemy)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE query ILIKE '%refresh_ai_maille_features_fast%'
  AND state <> 'idle'
  AND pid <> pg_backend_pid();
```

**Étape 2 — Inspecter la migration 147 pour localiser le ST_Clip**

```bash
cat db/migrations/147_ai_feature_store_fast_refresh.sql | grep -n "ST_Clip\|ST_Intersects\|ST_Contains" | head -30
```

La cause la plus probable du timeout est un `ST_Clip(raster, geom)` sur le DSM sans filtrer d'abord par bbox. La correction est de remplacer :

```sql
-- LENT : clip DSM complet pour chaque maille
ST_Clip(dsm.rast, maille.geom)

-- RAPIDE : filtre bbox d'abord, clip ensuite
ST_Clip(dsm.rast, maille.geom)
WHERE dsm.rast && maille.geom  -- opérateur && = bbox overlap, utilise l'index GIST
```

**Étape 3 — Refresh manuel par psql avec timeout long**

Si la fonction est correcte mais que SQLAlchemy timeout avant la fin, lancer directement via docker compose :

```bash
# Via psql direct, pas Python — pas de timeout client
docker compose exec -T db psql -U atlas -d atlas_clean \
  -c "SET statement_timeout = '300000'; \
      SELECT atlas.refresh_ai_maille_features_fast_for_codes(\
        ARRAY(SELECT DISTINCT maille_code FROM public.sondages \
              WHERE deleted_at IS NULL LIMIT 20));" \
  -t -A

# Vérifier immédiatement après
docker compose exec -T db psql -U atlas -d atlas_clean \
  -t -A -c "SELECT COUNT(*) FROM atlas.ai_maille_features_fast;"
```

**Étape 4 — Si la fonction est trop lente, créer une version simplifiée**

Si `ST_Clip` est le goulot et que les features DSM ne sont pas critiques pour le pipeline KED immédiat, une version allégée suffit pour débloquer le pipeline :

```sql
-- Version allégée : features sans ST_Clip DSM
-- À utiliser comme fallback si la fonction complète reste bloquée
CREATE OR REPLACE FUNCTION atlas.refresh_ai_maille_features_fast_lightweight(
  p_codes text[]
) RETURNS void AS $$
  INSERT INTO atlas.ai_maille_features_fast (
    maille_code, vbs_avg, ip_avg, wl_avg, wp_avg, eg_avg,
    passant_2mm_avg, passant_80um_avg, n_sondages,
    updated_at
  )
  SELECT 
    m.code,
    AVG(ev.vbs)            as vbs_avg,
    AVG(ea.ip_generated)   as ip_avg,
    AVG(ea.wl)             as wl_avg,
    AVG(ea.wp)             as wp_avg,
    AVG(epg.cg)            as eg_avg,
    AVG(eg.passant_2mm)    as passant_2mm_avg,
    AVG(eg.passant_80um)   as passant_80um_avg,
    COUNT(DISTINCT s.id)   as n_sondages,
    NOW()
  FROM atlas.mailles m
  LEFT JOIN public.sondages s ON s.maille_code = m.code AND s.deleted_at IS NULL
  LEFT JOIN atlas.echantillons e ON e.sondage_id = s.id
  LEFT JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id
  LEFT JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id
  LEFT JOIN atlas.essais_potentiel_gonflement epg ON epg.echantillon_id = e.id
  LEFT JOIN atlas.essais_granulometrie eg ON eg.echantillon_id = e.id
  WHERE m.code = ANY(p_codes)
  GROUP BY m.code
  ON CONFLICT (maille_code) DO UPDATE SET
    vbs_avg = EXCLUDED.vbs_avg,
    ip_avg  = EXCLUDED.ip_avg,
    wl_avg  = EXCLUDED.wl_avg,
    wp_avg  = EXCLUDED.wp_avg,
    eg_avg  = EXCLUDED.eg_avg,
    passant_2mm_avg = EXCLUDED.passant_2mm_avg,
    n_sondages = EXCLUDED.n_sondages,
    updated_at = NOW();
$$ LANGUAGE SQL;
```

---

## Problème 2 — Variogrammes UI : plan de câblage endpoint Python

La note de l'agent est claire : l'onglet Variogrammes affiche une approximation JS. Voici la structure complète pour câbler le vrai endpoint.

**Côté backend Rust (à ajouter dans `main.rs`) :**

```rust
// Route à enregistrer
.route("/ai/plots/variogram", post(handlers::ai_plots::plot_variogram))
.route("/ai/plots/crossval",  post(handlers::ai_plots::plot_crossval))
.route("/ai/plots/eda",       post(handlers::ai_plots::plot_eda))
```

**Contrat de l'endpoint — request/response :**

```json
POST /ai/plots/variogram
{
  "parameter_id": "vbs_avg",
  "horizon": "H2",
  "domain_code": "GEO_008",
  "run_id": "optional-uuid"
}

Response: { "svg": "<svg>...</svg>", "cached": true, "run_id": "...", "loo_rmse": 3.65 }
```

Le handler Rust appelle un script Python `scripts/generate_variogram_plot.py` via `tokio::process::Command`, ou récupère un SVG déjà en cache dans `atlas.ai_plot_cache` (table simple : `run_id`, `plot_type`, `svg_content`, `created_at`).

**Côté UI (modification dans `scientific-drawer.ts`) :**

```typescript
// Remplacer l'approximation client-side par :
async function loadVariogramTab(parameter: string, horizon: string) {
  const container = document.getElementById('variogram-container');
  container.innerHTML = '<div class="loader">Calcul en cours...</div>';
  
  try {
    const resp = await fetch('/api/ai/plots/variogram', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ parameter_id: parameter, horizon })
    });
    const data = await resp.json();
    container.innerHTML = data.svg;  // SVG Python injecté directement
  } catch {
    container.innerHTML = approximationClientSide(parameter);  // fallback JS
  }
}
```

---

## État actuel consolidé — tableau de bord---

![[Pasted image 20260330164206.png]]

## Décision architecture sur `ai_maille_features_fast`

Il faut trancher une question de fond : le feature store a-t-il vraiment besoin du `ST_Clip` DSM pour le pipeline KED immédiat ?

La réponse est non. Pour le KED, les features utilisées sont les statistiques agrégées des essais (`vbs_avg`, `ip_avg`, `eg_avg`, `wl_avg`) et le contexte pédologique (type de sol assigné à la maille). Les features topographiques DSM (élévation, pente, TWI) sont utiles pour la régression kriging (ADR-005) mais pas pour le KED de base.

La stratégie recommandée est donc de déployer la version lightweight maintenant, lancer le KED et débloquer toute la chaîne, puis optimiser la fonction complète avec `ST_Clip` en arrière-plan avec un `statement_timeout` approprié et un refresh incrémental nocturne.

**Bonne pratique supplémentaire :** ajoute un champ `feature_version` dans `ai_maille_features_fast` — valeur `1` pour la version lightweight sans DSM, valeur `2` pour la version complète avec topographie. Le pipeline sait ainsi automatiquement si une maille a des features complètes ou partielles, et peut choisir le niveau de modèle approprié sans logique conditionnelle complexe. Quand le refresh complet finit pour une maille, il met à jour `feature_version` de 1 à 2 — l'amélioration est progressive et traçable.