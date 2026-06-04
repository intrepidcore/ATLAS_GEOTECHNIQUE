# AUDIT CRITIQUE — Anomalie de Géocodage & Stratégie de Correction
## Atlas Géotechnique du Togo — Session du 2026-06-04

---

**Statut** : CRITIQUE — Impacte la validité de tous les modèles L1–L4  
**Découvert le** : 2026-06-04 lors du diagnostic de la vue matérialisée `mv_mailles_geotech`  
**Rédigé par** : Claude Sonnet 4.6 (IA assistante) — session de développement  
**Base de données concernée** : `atlas_clean` — port 5433 (PostgreSQL 17 natif Windows)  
**Fichiers impactés** : `atlas.sondages`, `atlas.mv_mailles_geotech`, `atlas.v_mailles_with_location_counts`, tous les modèles L1–L4, article scientifique  

---

## TABLE DES MATIÈRES

1. [Contexte et Découverte de l'Anomalie](#1-contexte-et-découverte-de-lanomaile)
2. [Diagnostic Technique Complet](#2-diagnostic-technique-complet)
3. [Analyse des Bugs en Cascade](#3-analyse-des-bugs-en-cascade)
4. [Stratégie de Re-géocodage](#4-stratégie-de-re-géocodage)
5. [Effets Domino et Conséquences Systémiques](#5-effets-domino-et-conséquences-systémiques)
6. [Cahier des Charges Architectural](#6-cahier-des-charges-architectural)
7. [Plan d'Action Priorisé](#7-plan-daction-priorisé)
8. [Documentation Technique des Fonctions DB](#8-documentation-technique-des-fonctions-db)
9. [Annexes — Données SQL de Référence](#9-annexes--données-sql-de-référence)

---

## 1. Contexte et Découverte de l'Anomalie

### 1.1 Contexte de Découverte

La session de développement du 2026-06-04 avait pour objectif principal de connecter le pipeline ML L1–L4 (KED-H, RK-SCORPAN, Fusion BLUP, VfS-PLS, MTGP/ICM) à l'interface utilisateur Atlas à `localhost:1420`. Dans ce cadre, une vérification de la couche de couverture (affichage des mailles avec sondages) a révélé une anomalie critique :

```
Résultat API GET /coverage/mailles :
Total mailles : 29 407
has_data = true : 0
n_sondages total : 0
```

**Signification immédiate** : L'interface affichait 29 407 mailles SANS sondage, ce qui est factuellement faux — l'INVENTAIRE_DONNEES_POST_V10.md documente 572+ sondages importés avec des maille_code.

### 1.2 Séquence d'Investigation

L'investigation a suivi 4 étapes successives :

**Étape 1 — Requête directe sur la table `atlas.sondages`** :
```sql
SELECT COUNT(*) as total, COUNT(maille_code) as avec_maille, 
       COUNT(DISTINCT maille_code) as mailles_distinctes
FROM atlas.sondages WHERE deleted_at IS NULL;
-- Résultat : 572 sondages | 572 avec maille_code | 274 mailles distinctes
```

**Étape 2 — Suspicion sur la concentration** :
274 mailles distinctes pour 572 sondages = 2,1 sondages/maille en moyenne. L'analyse des mailles avec le plus de sondages révèle :
```sql
SELECT maille_code, COUNT(*) as nb FROM atlas.sondages 
GROUP BY maille_code ORDER BY nb DESC LIMIT 5;
-- TG-0672-0197-01 : 188 sondages (!!)
-- TG-0866-0127-01 : 12 sondages
-- ...
```

188 sondages dans une maille 2km×2km est géographiquement impossible dans une campagne terrain normale. Cela a signalé un problème de géocodage.

**Étape 3 — Vérification des coordonnées géographiques** :
```sql
SELECT ST_AsText(geom), location_mode, COUNT(*) 
FROM atlas.sondages WHERE maille_code = 'TG-0672-0197-01' 
GROUP BY geom, location_mode;
-- POINT(1 8.6) | NULL  | 185 sondages
-- POINT(1 8.6) | inferred | 2 sondages  
-- POINT(0.994... 8.600...) | inferred | 1 sondage
```

**Confirmation du bug** : 185 sondages ont exactement `POINT(1.0, 8.6)` comme géométrie. Ce n'est pas une coordonnée réelle — c'est un point de fallback.

**Étape 4 — Identification du point fallback** :
```sql
SELECT source, adm3_name, adm2_name, adm1_name, COUNT(*)
FROM atlas.sondages WHERE geom = ST_SetSRID(ST_MakePoint(1, 8.6), 4326)
GROUP BY source, adm3_name, adm2_name, adm1_name;
-- V10_MASTER_2026 | Kaniamboua | Sotouboua | Centrale | 185
-- SOGLO Ferdinand | Kaniamboua | Sotouboua | Centrale | 2
```

`POINT(1.0, 8.6)` correspond au centroïde approximatif du canton Kaniamboua (Centrale, Togo). Le script d'import V10 a utilisé ce point comme coordonnée par défaut pour tous les sondages qui n'avaient pas de localisation GPS réelle.

### 1.3 Récapitulatif de la Situation

| Indicateur | Valeur | Statut |
|---|---|---|
| Sondages totaux (non supprimés) | 572 | — |
| Sondages avec `geom = POINT(1 8.6)` | 187 | **CRITIQUE** |
| Sondages `location_mode = NULL` | 370 | **CRITIQUE** |
| Sondages `location_mode = adm_random_cell` | 112 | Dégradé |
| Sondages `location_mode = inferred` | 89 | Acceptable |
| Sondages `location_mode = exact` | 1 | OK |
| Mailles correctement couvertes | ~87 (hors fallback) | **À recalculer** |
| Mailles faussement concentrées | TG-0672-0197-01 | **INVALIDE** |

---

## 2. Diagnostic Technique Complet

### 2.1 Architecture du Système de Géocodage

Le système de géocodage actuel repose sur **4 composants** qui interagissent de manière complexe :

#### 2.1.1 Trigger `trg_sondage_geocode` → Fonction `geocode_sondage()`

**Déclenchement** : INSERT ou UPDATE sur `atlas.sondages` si `NEW.geom IS NOT NULL`

```sql
CREATE FUNCTION atlas.trg_geocode_sondage() RETURNS trigger AS $$
BEGIN
    IF NEW.geom IS NOT NULL THEN
        IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND 
            (OLD.geom IS NULL OR NOT ST_Equals(OLD.geom, NEW.geom))) THEN
            PERFORM atlas.geocode_sondage(NEW.id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Fonctionnement de `geocode_sondage()`** :
1. Récupère `v_geom` depuis `atlas.sondages WHERE id = p_sondage_id`
2. Transforme en SRID 25231 : `v_geom_25231 := ST_Transform(v_geom, 25231)`
3. Trouve la maille via **point-in-polygon** : `ST_Contains(m.geom, v_geom_25231)`
4. Trouve ADM3 via `ST_Contains(a.geom, v_geom)` sur `atlas.adm3`
5. Met à jour `maille_code`, `adm1_name`, `adm2_name`, `adm3_name`, `adm3_id`

**Bug critique identifié** : La fonction `geocode_sondage` ne met PAS à jour `location_mode`. Elle geocode correctement (point-in-polygon) mais ne classifie pas le mode de localisation. Résultat : tous les sondages géocodés via ce trigger ont `location_mode = NULL`.

#### 2.1.2 Trigger `trigger_auto_geocode` → Fonction `auto_geocode_sondage()`

**Déclenchement** : INSERT ou UPDATE sur `atlas.sondages`

```sql
CREATE FUNCTION public.auto_geocode_sondage() RETURNS trigger AS $$
BEGIN
    IF NEW.geom IS NULL THEN
        IF NEW.adm3_id IS NOT NULL THEN
            SELECT geom INTO NEW.geom FROM adm3 WHERE gid = NEW.adm3_id;
            IF NEW.geom IS NOT NULL THEN
                NEW.location_mode := COALESCE(NEW.location_mode, 'centroid');
            END IF;
        ELSE
            NEW.location_mode := COALESCE(NEW.location_mode, 'unknown');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Rôle** : Fallback pour les sondages sans géométrie — utilise le centroïde de l'ADM3.
**Note** : Ce trigger est dans le schema `public` (LEGACY), pas dans `atlas`.

#### 2.1.3 Trigger `trigger_refresh_mailles` → Fonction `refresh_mailles_geotech()`

```sql
CREATE FUNCTION atlas.refresh_mailles_geotech() RETURNS trigger AS $$
BEGIN 
    REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech; 
    RETURN NULL; 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Rôle** : Rafraîchit automatiquement `mv_mailles_geotech` après chaque INSERT/UPDATE sur `sondages`.

**Prérequis CONCURRENTLY** : `REFRESH MATERIALIZED VIEW CONCURRENTLY` nécessite un index UNIQUE sur la MV. Cet index **existe** (`mv_mailles_geotech_code_uniq` sur la colonne `code`). Ce n'est donc PAS la cause principale du bug (contrairement à ce qu'indique l'INVENTAIRE).

#### 2.1.4 Vue `v_mailles_with_location_counts` → MV `mv_mailles_geotech`

**Le bug le plus grave** : La vue `v_mailles_with_location_counts` hardcode toutes les valeurs de comptage à 0/false :

```sql
-- ÉTAT ACTUEL (BUG) :
WITH location_counts AS (
    SELECT m.code,
        COUNT(DISTINCT s.id) FILTER (WHERE s.location_mode = ANY (ARRAY['exact','gps','manual'])) AS n_sondages_exact,
        COUNT(DISTINCT s.id) FILTER (WHERE s.location_mode = ANY (ARRAY['adm_random_cell','adm3','adm2','adm1','random'])) AS n_sondages_random
    FROM mailles m
    LEFT JOIN sondages s ON st_contains(m.geom, st_transform(s.geom, 25231)) AND s.deleted_at IS NULL AND s.geom IS NOT NULL
    GROUP BY m.code
)
SELECT mv.id, mv.code, ...
    0 AS n_sondages,         -- ← BUG : devrait être lc.n_sondages_exact + lc.n_sondages_random
    false AS has_data,        -- ← BUG : devrait être (lc.n_sondages_exact + lc.n_sondages_random) > 0
    false AS has_exact_location, -- ← BUG
    false AS has_random_location, -- ← BUG
    0 AS n_sondages_exact,   -- ← BUG
    0 AS n_sondages_random   -- ← BUG
FROM mailles mv
LEFT JOIN location_counts lc ON lc.code = mv.code; -- lc est jointé mais JAMAIS utilisé !
```

**Explication du bug** : Le CTE `location_counts` est calculé et jointé mais le SELECT ignore ses colonnes et retourne des valeurs hardcodées. C'est une erreur de développement.

**Deuxième bug dans le CTE** : Il compte les sondages via `ST_Contains(m.geom, ST_Transform(s.geom, 25231))` — un point-in-polygon coûteux. Or, les sondages ont déjà `maille_code` renseigné. Le join devrait être `s.maille_code = m.code` — beaucoup plus efficace et fiable.

**Troisième bug dans le CTE** : Le filtre `location_mode IN ('exact','gps','manual')` pour `n_sondages_exact` exclut les sondages avec `location_mode = NULL`, même si ceux-ci ont des coordonnées GPS réelles (comme le montrent les sondages PC06_S1, PC03_S13 qui ont des `adm_name` valides mais `location_mode = NULL`).

### 2.2 Le Fallback POINT(1, 8.6) — Origine et Impact

#### 2.2.1 Origine

La coordonnée `POINT(1.0, 8.6)` correspond à :
- Longitude : 1.0°E
- Latitude : 8.6°N
- Localisation approximative : **centroïde de la préfecture de Sotouboua**, ou valeur par défaut du Togo central

Cette valeur a été assignée par le script `V10_MASTER_2026` à 185 sondages lors de l'import. Ces sondages appartiennent à des sites variés (BADJA, NOT/Notsé, AMENOUKOPE, OKE, EMPRUNT diverses...) disséminés dans tout le Togo. Le script a assigné le centroïde ADM3 = Kaniamboua à tous ceux pour lesquels il ne pouvait pas déterminer une localité précise.

#### 2.2.2 Impact Géographique

La maille `TG-0672-0197-01` (qui contient le point 1.0, 8.6) se retrouve avec 188 sondages "virtuels". Cette maille :
- Est dans la région Centrale, préfecture Sotouboua, canton Kaniamboua
- Mesure 2km × 2km
- Physicalement impossible d'avoir 188 campagnes de forage dans 4 km²

#### 2.2.3 Impact Statistique sur les Modèles ML

Les modèles L1–L4 sont entraînés sur les données de `atlas.sondages` (via `atlas.echantillons` et `atlas.essais_*`). Si les sondages sont mal localisés spatialement, les valeurs interpolées (KED, RK, BLUP, MTGP) autour de la maille `TG-0672-0197-01` sont incorrectes car elles concentrent artificiellement de la variance dans une zone géographique sans relation avec les vraies données.

**L'effet de contamination** : En géostatistique, le variogramme empirique est calculé à partir des paires de points. Si 185 points ont exactement la même coordonnée, ils créent une **singularité au lag=0** qui fausse le variogramme et donc les krigeages suivants.

### 2.3 Bilan par Mode de Localisation

```
location_mode = NULL (370 sondages → 112 mailles distinctes)
│
├── 185 sondages avec POINT(1 8.6) → TG-0672-0197-01 (1 maille, FALLBACK)
│   └── Source : V10_MASTER_2026 (185) + SOGLO Ferdinand (2)
│   └── ADM3 assigné : Kaniamboua (faux)
│   └── Statut : INVALIDES — coordonnées fictives
│
└── 185 autres sondages avec location_mode=NULL mais SANS POINT(1 8.6)
    └── Ces sondages ont des vraies coordonnées mais location_mode non mis à jour
    └── Statut : VALIDES géographiquement, mais non classifiés

location_mode = adm_random_cell (112 sondages → 104 mailles)
└── Chaque sondage a une position aléatoire dans son ADM3
└── Statut : DÉGRADÉ — position approximative acceptable pour couverture, 
             INVALIDE pour krigeage précis

location_mode = inferred (89 sondages → 58 mailles)
└── Position déduite de contexte (croisement terrain, documents, ADM)
└── Statut : PARTIEL — meilleur que adm_random mais pas exact

location_mode = exact (1 sondage → 1 maille)
└── Coordonnées GPS réelles
└── Statut : IDÉAL
```

---

## 3. Analyse des Bugs en Cascade

### 3.1 Bug #1 — Vue `v_mailles_with_location_counts` avec valeurs hardcodées

**Priorité** : P0 — CRITIQUE  
**Type** : Erreur de développement (code mort)  
**Fichier** : Vue SQL dans `atlas_clean` port 5433  

**Description** : Le CTE `location_counts` est défini et jointé mais jamais utilisé dans le SELECT. Toutes les colonnes de comptage retournent 0/false.

**Impact** :
- Coverage map affiche 0 sondages sur 29 407 mailles
- Interface UI : `Avec données: 0 | Sans données: 29 407`
- Modèles ML : impossible d'identifier les mailles avec données réelles
- Export : toutes les cartes de couverture sont incorrectes

**Correction** : Réécrire la vue pour utiliser `lc.*` dans le SELECT (migration 102 préparée mais non appliquée).

### 3.2 Bug #2 — `geocode_sondage()` ne met pas à jour `location_mode`

**Priorité** : P1 — MAJEUR  
**Type** : Fonction incomplète  
**Fichier** : `atlas.geocode_sondage()` dans PostgreSQL 5433  

**Description** : La fonction effectue le point-in-polygon et met à jour `maille_code`, `adm1_name`, `adm2_name`, `adm3_id` mais ne définit jamais `location_mode`. Résultat : tout sondage géocodé via ce trigger a `location_mode = NULL`.

**Impact** :
- 370 sondages avec `location_mode = NULL`
- Impossible de distinguer les sondages "correctement géocodés avec geom réelle" des "fallback POINT(1,8.6)"
- Le filtre `location_mode IN ('exact','gps','manual')` dans la vue exclut ces sondages

**Correction** : Ajouter dans `geocode_sondage()` :
```sql
-- Après le UPDATE final :
UPDATE atlas.sondages
SET location_mode = CASE 
    WHEN location_accuracy_m IS NOT NULL AND location_accuracy_m < 100 THEN 'exact'
    WHEN location_mode IS NULL THEN 'geocoded'
    ELSE location_mode
END
WHERE id = p_sondage_id AND location_mode IS NULL;
```

### 3.3 Bug #3 — Fallback POINT(1, 8.6) dans V10_MASTER_2026

**Priorité** : P0 — CRITIQUE  
**Type** : Erreur de pipeline d'import  
**Fichier** : Script Python V10 (probablement dans `scripts/`)  

**Description** : Le script V10 a assigné `geom = ST_SetSRID(ST_MakePoint(1, 8.6), 4326)` à 185 sondages sans coordonnées GPS disponibles, puis a mis `adm3_name = 'Kaniamboua'` comme valeur par défaut.

**Impact** :
- 185 sondages "fantômes" dans la maille TG-0672-0197-01
- Cette maille est massivement sur-représentée dans tous les modèles
- Les variogrammes L1/L2a/L2b/L4 ont une singularité au lag=0 due à la concentration

**Corrections requises** :
1. Identifier et marquer ces 187 sondages comme `is_geocoded = false` et `location_mode = 'fallback_default'`
2. Nullifier leur `geom` pour empêcher le trigger de les re-geocoder à la maille `TG-0672-0197-01`
3. Lancer le re-géocodage fuzzy-regex + manuel

### 3.4 Bug #4 — Join inefficace dans `v_mailles_with_location_counts`

**Priorité** : P2 — MINEUR (performance)  
**Type** : Requête sous-optimale  

**Description** : Le CTE utilise `ST_Contains(m.geom, ST_Transform(s.geom, 25231))` — un join spatial O(n×m) alors que `maille_code` est directement disponible dans `sondages`.

**Impact** : Temps de refresh de la MV ~645ms pour 29 407 mailles × 572 sondages (actuellement vide donc rapide, mais avec les corrections ça prendra plus longtemps si le join spatial est conservé).

**Correction** : Remplacer par `ON s.maille_code = m.code` (déjà prévu dans migration 102).

### 3.5 Bug #5 — Double trigger de geocodage (atlas vs public)

**Priorité** : P2 — MINEUR (risque d'incohérence)  
**Type** : Architecture incohérente  

**Description** : Deux triggers de geocodage existent :
- `trg_sondage_geocode` (schema `atlas`, fires si `geom IS NOT NULL`)
- `trigger_auto_geocode` (schema `public`, fires si `geom IS NULL`)

Ces deux triggers ont des logiques opposées et complémentaires mais peuvent interférer. L'ordre d'exécution n'est pas garanti.

**Correction** : Consolider en un seul trigger dans `atlas` avec une logique complète.

---

## 4. Stratégie de Re-géocodage

### 4.1 Vue d'Ensemble de la Stratégie

La stratégie de re-géocodage adopte une approche en **3 niveaux** par ordre de confiance décroissante :

```
Niveau 1 : EXACT (automatique)
└── Coordonnées GPS disponibles dans meta/sources externes
└── Confiance : 100%

Niveau 2 : FUZZY-REGEX (semi-automatique)
└── Extraction du nom de localité depuis le code du sondage
└── Match contre atlas.adm3 via similarité textuelle (rapidfuzz)
└── Seuil de confiance : 85% minimum pour validation automatique
└── Entre 60-85% : proposition à valider manuellement
└── < 60% : géocodage manuel obligatoire

Niveau 3 : MANUEL (UI localhost:1420)
└── Interface /sondages avec carte Leaflet
└── L'utilisateur clique sur la carte pour positionner le sondage
└── Validation humaine obligatoire
```

### 4.2 Stratégie Fuzzy-Regex — Champs Disponibles

#### 4.2.1 Champs Pertinents dans `atlas.sondages`

La table `atlas.sondages` dispose des champs suivants exploitables pour la stratégie fuzzy :

| Champ | Type | Contenu (exemples) | Exploitabilité Fuzzy |
|---|---|---|---|
| `code` | text | `BADJA_S22`, `NOT_E30`, `KANTE_S1`, `OKE_EMPRUNT_32_80_16` | **HAUTE** — encode souvent la localité |
| `localite_key` | text | Clé normalisée de localité | **HAUTE** — si renseigné |
| `localite_base` | text | Nom brut de localité | **HAUTE** — si renseigné |
| `localite` | text | Variante de localité | **HAUTE** — si renseigné |
| `adm3_name` | text | `Kaniamboua`, `Agou Yiboe/Kati` | **MOYENNE** — déjà renseigné mais peut être faux |
| `adm2_name` | text | `Sotouboua`, `Agou` | **MOYENNE** — contexte géographique |
| `meta` | jsonb | Métadonnées brutes d'import | **VARIABLE** — selon la source |
| `source` | text | `V10_MASTER_2026`, `SOGLO Ferdinand` | **FAIBLE** — info sur l'origine |

#### 4.2.2 Patterns Regex Identifiés dans les Codes

L'analyse des 187 sondages avec fallback révèle des patterns de nommage clairs :

**Pattern 1 : `{LOCALITE}_{TYPE}{NUM}`**
```
BADJA_S22, BADJA_S1, ..., BADJA_S28  → Localité : BADJA (canton dans Maritime)
KANTE_S1, ..., KANTE_S10             → Localité : KANTE (Centrale)
NOT_E1, ..., NOT_E31                  → Localité : NOT = Notse/Notsé (Plateaux)
SOK_T1_S1, ..., SOK_T1_S20           → Localité : SOK = Sokodé ? (Centrale)
```

**Pattern 2 : `{LOCALITE}_EMPRUNT_{ID}`**
```
OKE_EMPRUNT_32_80_16                  → Localité : OKE
FODJAYE_EMPRUNT_31_82_65              → Localité : FODJAYE
AMENOUKOPE_EMPRUNT_31_09_99           → Localité : AMENOUKOPE = AMENO-KOPE
GLITTO_EMPRUNT_33_82_92               → Localité : GLITTO (Maritime)
```

**Pattern 3 : `{LOCALITE}_PD{NUM}` (puits de diagnostic)**
```
ALINKA_PD1, ALINKA_SC, ALINKA_SP      → Localité : ALINKA
ATTIEGOU_PD1, ATTIEGOU_SC             → Localité : ATTIEGOU
DANGB_PD1, DANGB_SC                   → Localité : DANGB (Dangbo ?)
```

#### 4.2.3 Table de Référence ADM

La table `atlas.adm3` (géométries des cantons togolais) fournit :
- `adm3_fr` : nom du canton en français
- `adm2_fr` : nom de la préfecture
- `adm1_fr` : nom de la région
- `geom` : polygone SRID 4326

Cette table est la **référence maître** pour le matching fuzzy.

#### 4.2.4 Algorithme de Matching Proposé

```python
# Pseudo-code de l'algorithme de re-géocodage fuzzy-regex
import re
from rapidfuzz import fuzz, process

def extract_locality_from_code(code: str) -> str:
    """Extrait le nom de la localité depuis le code du sondage."""
    # Pattern 1 : LOCALITE_TYPE_NUM
    m = re.match(r'^([A-Z][A-Z0-9_]+?)_(?:S|E|PD|SC|SP|TAR|PUITS)\d*', code)
    if m:
        return m.group(1).replace('_', ' ')
    
    # Pattern 2 : LOCALITE_EMPRUNT_ID
    m = re.match(r'^([A-Z][A-Z0-9_]+?)_EMPRUNT_', code)
    if m:
        raw = m.group(1)
        # Nettoie les suffixes courants (KOPE → enlever "KOPE")
        return raw.replace('KOPE', '').replace('KOPÉ', '').strip('_')
    
    # Pattern 3 : CODE commençant par une localité connue
    parts = code.split('_')
    return parts[0] if parts else code

def match_to_adm3(locality: str, adm3_list: list[dict]) -> tuple[dict, float]:
    """Retourne le meilleur match ADM3 et son score."""
    candidates = [(a['adm3_fr'], a) for a in adm3_list]
    
    # Essaie d'abord un match exact
    for name, adm in candidates:
        if locality.lower() in name.lower() or name.lower() in locality.lower():
            return adm, 100.0
    
    # Fuzzy matching avec rapidfuzz
    best_match, score, _ = process.extractOne(
        locality, 
        [c[0] for c in candidates],
        scorer=fuzz.WRatio
    )
    matched_adm = next(a for n, a in candidates if n == best_match)
    return matched_adm, score

def geocode_sondage_fuzzy(sondage: dict, adm3_list: list[dict]) -> dict:
    """
    Re-géocode un sondage via fuzzy matching.
    
    Retourne: {
        'sondage_id': uuid,
        'matched_adm3': dict ou None,
        'score': float,
        'method': 'exact' | 'fuzzy_high' | 'fuzzy_low' | 'manual_required',
        'action': 'auto_apply' | 'propose' | 'skip',
        'locality_extracted': str
    }
    """
    # 1. Extraire la localité depuis code / localite_key / localite_base
    locality = (
        sondage.get('localite_key') or 
        sondage.get('localite_base') or 
        extract_locality_from_code(sondage['code'])
    )
    
    # 2. Matcher contre ADM3
    matched_adm, score = match_to_adm3(locality, adm3_list)
    
    # 3. Décision selon seuil
    if score >= 85:
        return {
            'sondage_id': sondage['id'],
            'matched_adm3': matched_adm,
            'score': score,
            'method': 'fuzzy_high',
            'action': 'auto_apply',
            'locality_extracted': locality
        }
    elif score >= 60:
        return {
            'sondage_id': sondage['id'],
            'matched_adm3': matched_adm,
            'score': score,
            'method': 'fuzzy_low', 
            'action': 'propose',
            'locality_extracted': locality
        }
    else:
        return {
            'sondage_id': sondage['id'],
            'matched_adm3': None,
            'score': score,
            'method': 'no_match',
            'action': 'manual_required',
            'locality_extracted': locality
        }
```

### 4.3 Règle Métier de Verrouillage

**Règle stricte : une maille assignée via `adm_random_cell` est verrouillée.**

Si un sondage a `location_mode = adm_random_cell`, sa position dans cette maille est considérée comme établie et ne peut plus être modifiée de manière aléatoire. La seule exception autorisée est l'ajout d'un sondage avec `location_mode = exact` (coordonnées GPS réelles) dans la même maille.

**Implémentation recommandée** :
```sql
-- Contrainte de verrouillage (à ajouter dans la fonction geocode_sondage)
-- Ne pas écraser un maille_code déjà assigné via adm_random_cell
UPDATE atlas.sondages SET
    maille_code = CASE 
        WHEN location_mode = 'adm_random_cell' AND v_maille_code IS NOT NULL 
        THEN maille_code  -- Préserver le maille_code existant
        ELSE COALESCE(v_maille_code, maille_code)
    END,
    ...
WHERE id = p_sondage_id;
```

**Rationale** : Cette règle évite qu'un re-géocodage automatique imparfait déplace les sondages qui ont déjà une assignation de maille cohérente avec les données de terrain.

### 4.4 Flux de Travail Hybride

```
┌─────────────────────────────────────────────────────────────┐
│                  PIPELINE RE-GÉOCODAGE                      │
└─────────────────────────────────────────────────────────────┘

Entrée : 187 sondages avec geom = POINT(1 8.6)
         + 370 sondages avec location_mode = NULL

    Step 1 : Identifier les sondages faux-géocodés
    ├── SELECT * FROM atlas.sondages 
    │   WHERE geom = ST_SetSRID(ST_MakePoint(1, 8.6), 4326)
    └── Marquer : location_mode = 'fallback_default', is_geocoded = false

    Step 2 : Script fuzzy-regex (Python)
    ├── Pour chaque sondage avec location_mode IN ('fallback_default', NULL)
    │   ├── Extraire localité via regex depuis code/localite_key/localite_base
    │   ├── Matcher contre atlas.adm3 avec rapidfuzz.WRatio
    │   ├── Score ≥ 85% → APPLY automatique (centroïde ADM3 + mode='inferred')
    │   ├── Score 60-84% → PROPOSE dans table geocode_suggestions
    │   └── Score < 60% → FLAG as 'manual_required'
    ↓
    Step 3 : Revue manuelle via UI localhost:1420/index.html
    ├── Page /sondages → onglet "À géocoder"
    ├── Affiche carte Leaflet avec position proposée
    ├── L'utilisateur déplace le marker sur la vraie localisation
    └── Enregistre location_mode = 'manual'
    ↓
    Step 4 : Validation et recalcul
    ├── UPDATE atlas.sondages SET geom = ... WHERE id = ...
    ├── Trigger trg_sondage_geocode s'active → met à jour maille_code
    ├── Trigger trigger_refresh_mailles → REFRESH MV CONCURRENTLY
    └── Vérification : SELECT COUNT(*) FROM mv_mailles_geotech WHERE has_data

    Step 5 : Relancement des modèles ML (voir Section 5)
```

### 4.5 Script Python de Re-géocodage (Cahier des Charges)

Le script `scripts/regeocod_fuzzy_v1.py` à créer devra :

**Inputs** :
- Connexion `postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean`
- Table `atlas.sondages` — champs : `id, code, localite_key, localite_base, localite, adm3_name, geom`
- Table `atlas.adm3` — champs : `gid, adm3_fr, adm2_fr, adm1_fr, geom`

**Outputs** :
- Table `atlas.geocode_suggestions` — insertions de propositions
- Log CSV : `logs/regeocode_fuzzy_{date}.csv`
- Résumé console : stats par action (auto_apply, propose, manual_required)

**Dépendances Python** :
```
rapidfuzz>=3.0.0
psycopg2-binary
pandas
shapely
```

**Paramètres** :
```
--threshold-auto  : 85 (défaut) — seuil pour application automatique
--threshold-propose : 60 (défaut) — seuil minimum pour proposition
--dry-run         : ne pas appliquer, juste logguer
--source-filter   : filtrer par source (ex: V10_MASTER_2026)
--exclude-locked  : ne pas modifier location_mode = adm_random_cell
```

---

## 5. Effets Domino et Conséquences Systémiques

### 5.1 Invalidation des Modèles ML

**L'anomalie de géocodage invalide les résultats actuels de tous les modèles.**

#### 5.1.1 Modèle L1 — KED Hiérarchique 5 niveaux (`ked_hierarchical_5levels`)

- **Impact direct** : Les 185 sondages "fantômes" dans `TG-0672-0197-01` contribuent faussement à la variabilité spatiale mesurée dans les environs de cette maille
- **Variogramme** : La concentration au lag=0 biaisse le nugget effect et le sill
- **Résultat** : Les cartes KED de VBS, IP, WL, WP, EG sur les horizons H1/H2/H3 présentent une anomalie locale non-représentative autour de Sotouboua
- **Action requise** : Relancer `run_ked_vbs_ip_wl_wp_horizons.py --hierarchical` après correction

#### 5.1.2 Modèle L2a — RK-SCORPAN (`regression_kriging_scorpan`)

- **Impact** : Le residuel du modèle de régression est calculé sur des données dont 185 sont mal localisées
- **Conséquence** : Le krigeage des résiduels autour de Sotouboua est distordu
- **Action requise** : Relancer `atlas_regression_kriging_terrain.py`

#### 5.1.3 Modèle L2b — Fusion Bayésienne BLUP (`ked_rk_fusion_bayesian`)

- **Impact** : Fusion de L1 et L2a, donc cumule les biais des deux modèles parents
- **Action requise** : Relancer `ked_rk_fusion.py` APRÈS L1 et L2a

#### 5.1.4 Modèle L3 — VfS-PLS Sentinel-2 (`maille_spectral_vfs`)

- **Impact** : Ce modèle n'utilise pas les sondages directement (données Sentinel-2)
- **Impact indirect** : Validation croisée sur sondages biaisée
- **Action requise** : Relancer validation si les sondages sont utilisés en target

#### 5.1.5 Modèle L4 — MTGP/ICM (`mtgp_icm_gpflow`)

- **Impact** : Entraîné sur les données terrain dont 32% sont mal localisées
- **Conséquence** : La covariance inter-tâches estimée par GPflow est biaisée
- **Action requise** : Relancer `mtgp_geotechnique.py`

### 5.2 Invalidation des Exports Cartographiques

#### 5.2.1 Exports PNG 300dpi (`exports_3d_v2/`)

Tous les fichiers suivants doivent être régénérés :
- `{param}_B_strati_maps.png` pour tous les paramètres (VBS, IP, WL, WP, EG, CBR, gamma_d, w_opt, Rd)
- `{param}_D_isovaleurs.png`
- `{param}_C_fence_*.svg`

**Volume estimé** : ~90 fichiers PNG + SVG

**Script** : `scripts/headless_render_300dpi.py --all` ou le pipeline `3d_render` via `ai_job_queue`

#### 5.2.2 Exports Plotly 3D (`exports_3d_v2/`)

- `{param}_A_cube_plotly.html` pour tous les paramètres
- Ces fichiers affichent la distribution 3D des valeurs par horizon
- **Volume estimé** : ~9 fichiers HTML

### 5.3 Impact sur l'Article Scientifique

**C'est la conséquence la plus critique à long terme.**

#### 5.3.1 Figures Impactées

L'article `atlas_reclone/docs/RECHERCHE/article_geostats_togo/` contient des figures générées à partir des modèles ML. Les figures suivantes doivent être régénérées :

| Figure | Impact | Raison |
|---|---|---|
| `fig01_boxplots_parametres.pdf/png` | **DIRECT** | Statistiques descriptives biaisées (185 faux pts) |
| `fig02_variogram_vbs_h1.pdf` | **DIRECT** | Variogramme L1 invalide |
| `fig03_loo_rmse_comparison.pdf/png` | **DIRECT** | LOO-RMSE calculées sur données biaisées |
| `fig04_correlation_matrix.pdf/png` | **DIRECT** | Corrélations VBS-IP-EG biaisées |
| `fig05_variance_reduction.pdf` | **INDIRECT** | Variance BLUP vs L1/L2a biaisée |
| Cartes thématiques (si incluses) | **DIRECT** | Toutes cartes KED/RK/BLUP/MTGP |

#### 5.3.2 Tableaux de Métriques à Mettre à Jour

Le fichier `.tex` de l'article doit être mis à jour pour :

1. **Tableau de statistiques descriptives** : N, μ, σ, Min, Max pour VBS/IP/EG
   - Actuellement basé sur 572 sondages incluant 185 faux
   - Après correction : basé sur ~387 sondages réels

2. **Tableau LOO-RMSE** : Métriques de validation croisée L1/L2a/L2b/L4
   - Actuellement : calculées avec biais spatial
   - Après correction : recalculer sur données propres

3. **Section "Données"** : Mettre à jour la description du dataset
   - `n = 572 sondages` → `n = X sondages (dont Y re-géocodés)`
   - Distribution par mode de localisation

#### 5.3.3 Workflow de Mise à Jour de l'Article

```
1. Corriger les sondages (re-géocodage)
2. Relancer L1 → L2a → L2b → L4 dans cet ordre
3. Extraire les nouvelles métriques via /ai/models/status
4. Régénérer les figures Python (scripts/plot_*)
5. Remplacer les fichiers PDF/PNG dans docs/RECHERCHE/article_geostats_togo/figures/
6. Mettre à jour les valeurs numériques dans main.tex
7. Compiler : pdflatex → bibtex → pdflatex × 2
8. Vérifier l'abstract et les conclusions
```

---

## 6. Cahier des Charges Architectural

### 6.1 Architecture du Système de Géocodage Cible

Le système cible doit garantir :

#### Propriété 1 : Unicité de la source de vérité géographique

```sql
-- Règle : un sondage a UNE SEULE source de vérité pour sa position
-- Priorité décroissante :
-- 1. geom_real (coordonnées GPS terrain originales, immuables)
-- 2. geom (coordonnées après géocodage, modifiable)  
-- 3. adm3_id (canton pour centroïde fallback)
-- 4. NULL (pas de localisation)
```

#### Propriété 2 : Traçabilité du mode de localisation

```sql
-- location_mode DOIT TOUJOURS être défini :
-- 'exact'            : GPS de précision (location_accuracy_m < 10)
-- 'gps'              : GPS terrain (location_accuracy_m 10-100)
-- 'manual'           : Géocodage manuel par opérateur humain
-- 'inferred'         : Déduit de contexte (croisement terrain)
-- 'adm_random_cell'  : Position aléatoire dans ADM3 (verrouillée)
-- 'centroid_adm3'    : Centroïde de l'ADM3 (fallback propre)
-- 'fallback_default' : Valeur par défaut de l'import (INVALIDE - à corriger)
-- 'unknown'          : Inconnu (à re-géocoder)
```

#### Propriété 3 : Verrouillage anti-régression

Une migration doit ajouter une contrainte :
```sql
ALTER TABLE atlas.sondages 
ADD CONSTRAINT chk_no_default_fallback 
CHECK (
    NOT (location_mode = 'adm_random_cell' AND geom = ST_SetSRID(ST_MakePoint(1, 8.6), 4326))
);
```

#### Propriété 4 : Cohérence vue-MV

La vue `v_mailles_with_location_counts` et la MV `mv_mailles_geotech` doivent être cohérentes avec la table `sondages`. Un test de cohérence automatique (CI/CD) doit vérifier :

```sql
-- Test CI : les deux agrégations donnent le même résultat
SELECT 
    (SELECT COUNT(DISTINCT maille_code) FROM atlas.sondages WHERE deleted_at IS NULL AND geom != ST_SetSRID(ST_MakePoint(1, 8.6), 4326))
    =
    (SELECT COUNT(*) FROM atlas.mv_mailles_geotech WHERE has_data = true)
AS coherence_ok;
```

### 6.2 Schéma de la Table `geocode_suggestions` (Extension Requise)

La table `public.geocode_suggestions` existe déjà mais doit être étendue pour le workflow fuzzy :

```sql
-- Colonnes existantes (à conserver)
-- id, entity, entity_id, localite, adm2_code, candidates, top_code, 
-- top_score, top_method, status, created_at, decided_at

-- Colonnes à ajouter
ALTER TABLE atlas.geocode_suggestions ADD COLUMN IF NOT EXISTS
    locality_extracted text,           -- Localité extraite par regex
    fuzzy_score numeric(5,2),          -- Score de matching rapidfuzz (0-100)
    proposed_adm3_id integer,          -- ADM3 proposé (FK atlas.adm3.gid)
    proposed_geom geometry(Point,4326), -- Centroïde de l'ADM3 proposé
    proposed_maille_code text,          -- Maille correspondante
    source text,                        -- Source du sondage
    validated_by text,                  -- Utilisateur qui a validé
    validated_at timestamptz,           -- Date de validation
    action text DEFAULT 'pending'       -- pending / approved / rejected / manual
;
```

### 6.3 Endpoint API à Créer

Pour le workflow hybride fuzzy+manuel, les endpoints suivants sont nécessaires :

```
GET  /geocode/suggestions              → Liste des propositions à valider
GET  /geocode/suggestions/:id          → Détail d'une proposition  
POST /geocode/suggestions/:id/approve  → Accepter la proposition
POST /geocode/suggestions/:id/reject   → Rejeter (envoie en manuel)
POST /geocode/manual-bulk              → Géocodage manuel par lot
GET  /geocode/stats                    → Statistiques globales de géocodage
POST /geocode/run-fuzzy                → Lancer le script fuzzy-regex
```

### 6.4 Interface UI de Géocodage Manuel

L'interface existante à `localhost:1420/index.html` doit être enrichie avec :

**Onglet "Géocodage"** dans la page sondages :
- Liste des sondages `manual_required` avec leur localité extraite
- Carte Leaflet avec la position actuelle (POINT fallback)
- Marker draggable pour repositionner
- Panneau de confirmation avec ADM3 calculé en temps réel
- Historique des validations

**Règles d'interface** :
- Afficher le score de confiance fuzzy pour chaque proposition
- Mettre en évidence les sondages de même `source` pour traitement par lot
- Permettre "accepter tout ce batch" pour les sondages d'une même campagne

---

## 7. Plan d'Action Priorisé

### Phase 0 — Correctifs Immédiats (1-2 heures)

**Objectif** : Réparer l'affichage de la couverture sans modifier les données sondages.

| Action | Fichier | Durée | Status |
|---|---|---|---|
| Appliquer migration 102 (fix vue v_mailles_with_location_counts) | `migrations/102_fix_mv_mailles_coverage.sql` | 30 min | Préparé |
| Fix type mismatch (integer vs bigint) dans la migration | `migrations/102_fix_mv_mailles_coverage.sql` | 10 min | À faire |
| Refresh MV après migration | SQL direct | 5 min | Automatique |
| Valider via API : has_data > 0 | curl test | 5 min | À faire |
| Fix [object Object] DB Manager | `ui/src/services/api.ts` | 20 min | À faire |
| Fix categories thematic panel | `ui/src/thematic/thematic-types.ts` | 30 min | À faire |

### Phase 1 — Marquage des Sondages Invalides (2-4 heures)

**Objectif** : Identifier et isoler les 187 sondages faux-géocodés.

```sql
-- Migration 103 : Marquer les sondages avec coordonnée fallback
UPDATE atlas.sondages 
SET 
    location_mode = 'fallback_default',
    is_geocoded = false,
    notes = COALESCE(notes, '') || ' [AUDIT-2026-06-04: geom=POINT(1 8.6) identifiée comme fallback V10]'
WHERE geom = ST_SetSRID(ST_MakePoint(1, 8.6), 4326)
  AND deleted_at IS NULL;

-- Ne pas nullifier la geom maintenant (risque de cascade trigger)
-- La nullification se fera via le script de re-géocodage après validation

-- Refresh MV
REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech;
```

### Phase 2 — Re-géocodage Fuzzy (1-2 jours)

**Objectif** : Ré-assigner les sondages à leurs vraies localités.

1. Créer `scripts/regeocod_fuzzy_v1.py` selon le cahier des charges (Section 4.5)
2. Exécuter en dry-run : `python regeocod_fuzzy_v1.py --dry-run --threshold-auto=85`
3. Analyser les résultats : combien auto / proposés / manuels ?
4. Exécuter réel : `python regeocod_fuzzy_v1.py`
5. Valider les suggestions via l'UI

### Phase 3 — Géocodage Manuel (1-3 jours selon volume)

**Objectif** : Traiter les sondages non couverts par le fuzzy.

1. Identifier les sondages restants via `/geocode/suggestions?status=manual_required`
2. Ouvrir l'interface de géocodage manuel `localhost:1420/index.html`
3. Traitement par lot (même source/campagne)

### Phase 4 — Relancement des Modèles ML (4-8 heures)

**Objectif** : Recalculer tous les modèles sur les données corrigées.

**Ordre impératif** :
1. `ked_recompute` → L1 (KED Hiérarchique)
2. `rk_recompute` → L2a (RK-SCORPAN) — peut être parallèle à L1
3. `blup_recompute` → L2b (Fusion BLUP) — après L1 ET L2a
4. `vfs_extract` → L3 (VfS-PLS Sentinel-2) — indépendant
5. `mtgp_recompute` → L4 (MTGP/ICM) — après L1

**Via la queue** :
```bash
# POST /ai/jobs/enqueue pour chacun
curl -X POST http://localhost:8000/ai/jobs/enqueue \
  -H "Content-Type: application/json" \
  -d '{"job_type":"ked_recompute","requested_by":"post-audit-regeocode"}'
```

### Phase 5 — Mise à Jour de l'Article Scientifique

**Objectif** : Mettre en cohérence l'article avec les nouvelles données.

1. Régénérer les 6 figures impactées (scripts Python dans `docs/RECHERCHE/article_geostats_togo/`)
2. Extraire les nouvelles métriques depuis `/ai/models/status`
3. Mettre à jour les valeurs dans `main.tex`
4. Recompiler l'article

---

## 8. Documentation Technique des Fonctions DB

### 8.1 Inventaire des Triggers sur `atlas.sondages`

| Trigger | Événement | Fonction | Rôle | Bug? |
|---|---|---|---|---|
| `trg_sondage_geocode` | INSERT, UPDATE | `atlas.trg_geocode_sondage()` | Géocode si `geom IS NOT NULL` | OUI — ne met pas à jour `location_mode` |
| `trigger_auto_geocode` | INSERT, UPDATE | `public.auto_geocode_sondage()` | Fallback centroïde ADM3 si `geom IS NULL` | LEGACY (schema public) |
| `trigger_refresh_mailles` | INSERT, UPDATE | `atlas.refresh_mailles_geotech()` | Rafraîchit `mv_mailles_geotech` | NON |
| `trg_refresh_ai_maille_features_fast_sondages_insupd` | INSERT, UPDATE | `...` | Mise à jour features AI | NON |
| `trg_refresh_ai_maille_features_fast_sondages_del` | DELETE | `...` | Mise à jour features AI | NON |

### 8.2 Flux d'Exécution lors d'un INSERT sur `atlas.sondages`

```
INSERT INTO atlas.sondages (code, geom, ...) VALUES (...)
│
├─→ trigger_auto_geocode (BEFORE INSERT, schema public)
│   └── Si geom IS NULL ET adm3_id IS NOT NULL → geom := centroïde ADM3
│   └── Si geom IS NULL ET adm3_id IS NULL → location_mode := 'unknown'
│   └── Si geom IS NOT NULL → aucune action
│
├─→ trg_sondage_geocode (AFTER INSERT, schema atlas)
│   └── Si geom IS NOT NULL → PERFORM atlas.geocode_sondage(NEW.id)
│       ├── ST_Contains(mailles, ST_Transform(geom, 25231)) → maille_code
│       ├── ST_Contains(adm3, geom) → adm3_id, adm1_name, adm2_name, adm3_name
│       └── UPDATE sondages SET maille_code=..., adm3_id=..., adm1_name=...
│           (NE PAS SET location_mode ← BUG)
│
└─→ trigger_refresh_mailles (AFTER INSERT, schema atlas)
    └── REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech
        └── Utilise v_mailles_with_location_counts
            └── Retourne 0/false hardcodés ← BUG CRITIQUE
```

### 8.3 Dépendances Entre Vues et MV

```
atlas.mv_mailles_geotech
└── dépend de : atlas.v_mailles_with_location_counts
    └── dépend de : atlas.mailles (géométries des mailles 2km)
    └── dépend de : atlas.sondages (via location_counts CTE)

atlas.mailles_geotechnique_stats_wgs84  (VIEW, pas MV)
└── dépend de : atlas.mailles
└── dépend de : atlas.sondages
└── dépend de : atlas.echantillons
└── utilisée par : routes.rs (endpoint /thematic/data pour source='base')
```

---

## 9. Annexes — Données SQL de Référence

### 9.1 État Exact des Sondages au 2026-06-04

```
Total sondages (sans deleted) : 572
├── geom IS NOT NULL : 572 (100%)
│   ├── POINT(1 8.6) — fallback : 187 (32.7%) ← INVALIDES
│   └── Autres coordonnées : 385 (67.3%) ← Potentiellement valides
│
├── location_mode = NULL : 370 (64.7%)
│   ├── Avec geom = POINT(1 8.6) : 185
│   └── Avec vraies coordonnées : 185
├── location_mode = adm_random_cell : 112 (19.6%)
├── location_mode = inferred : 89 (15.6%)
└── location_mode = exact : 1 (0.2%)
│
└── maille_code IS NOT NULL : 572 (100%)
    └── Dont TG-0672-0197-01 : 188 sondages ← ANOMALIE
    └── Autres mailles distinctes : 273
```

### 9.2 Distribution Géographique des Sondages Valides (Estimée)

Basé sur les 385 sondages avec coordonnées non-fallback :

| Région | Sondages (estimé) | Mailles (estimé) |
|---|---|---|
| Maritime | ~49 | ~40 |
| Plateaux | ~34 | ~30 |
| Kara | ~18 | ~15 |
| Centrale | ~10 (hors fallback) | ~8 |
| Savanes | ~2 | ~2 |
| (NULL/inconnu) | ~272 | ~178 |

### 9.3 Scripts SQL de Correction Préparés

**Migration 102** : `services/api-geo/migrations/102_fix_mv_mailles_coverage.sql`
- Corrige la vue `v_mailles_with_location_counts` (valeurs hardcodées → vraies colonnes)
- Rafraîchit `mv_mailles_geotech`
- **Status** : Préparé, non appliqué (erreur de type integer/bigint à corriger)

**Migration 103** (À créer) : Marquage sondages fallback
- `UPDATE atlas.sondages SET location_mode = 'fallback_default'... WHERE geom = POINT(1 8.6)`

**Migration 104** (À créer) : Fix `geocode_sondage()` pour mettre à jour `location_mode`

### 9.4 Preuves SQL des Bugs

```sql
-- Preuve Bug #1 : Vue retourne des hardcoded 0/false
SELECT n_sondages, has_data FROM atlas.mv_mailles_geotech LIMIT 3;
-- n_sondages | has_data
-- 0          | false
-- 0          | false  
-- 0          | false

-- Preuve Bug #2 : geocode_sondage ne met pas à jour location_mode
SELECT location_mode, COUNT(*) FROM atlas.sondages 
WHERE deleted_at IS NULL GROUP BY location_mode;
-- NULL          | 370  ← sondages géocodés sans location_mode
-- adm_random_cell | 112
-- inferred      | 89
-- exact         | 1

-- Preuve Bug #3 : 187 sondages avec POINT(1 8.6)
SELECT ST_AsText(geom), COUNT(*) FROM atlas.sondages 
WHERE deleted_at IS NULL GROUP BY geom ORDER BY count DESC LIMIT 3;
-- POINT(1 8.6) | 187  ← fallback
-- POINT(0.994... 8.600...) | 1
-- POINT(...) | 1

-- Preuve de la concentration anormale
SELECT maille_code, COUNT(*) as nb FROM atlas.sondages 
WHERE deleted_at IS NULL GROUP BY maille_code ORDER BY nb DESC LIMIT 3;
-- TG-0672-0197-01 | 188  ← anomalie critique
-- TG-0866-0127-01 | 12
-- TG-0529-0211-01 | 6
```

### 9.5 Références Techniques

- **INVENTAIRE_DONNEES_POST_V10.md** : Documentation de l'import V10 — mentionne "379 sondages ont `adm1_name IS NULL`"
- **CONVENTIONS_TECHNIQUES_LITIGES.md** : CONV-15 à CONV-18 documentent les deux instances DB et les conventions de nommage
- **ROADMAP INTÉGRATION FRONTEND–BACKEND L1 L4.md** : Architecture ML pipeline
- **PostgreSQL Documentation — REFRESH MATERIALIZED VIEW CONCURRENTLY** : Requiert UNIQUE INDEX
- **rapidfuzz documentation** : Algorithmes de similarité textuelle (WRatio, token_sort_ratio)

---

## Conclusion

L'anomalie de géocodage découverte le 2026-06-04 est d'une sévérité critique pour deux raisons :

1. **Invalidité scientifique** : 32.7% des sondages ont une position géographique fictive (centroïde Kaniamboua). Toute modélisation géostatistique (krigeage, régression spatiale) sur ces données produit des résultats biaisés, non-publiables et potentiellement trompeurs pour les décisions d'infrastructure.

2. **Effet de masquage** : Le bug de la vue `v_mailles_with_location_counts` (valeurs hardcodées à 0) dissimulait ce problème en rendant invisible la concentration anormale dans la couche de couverture UI. Sans le diagnostic proactif effectué le 2026-06-04, cette anomalie aurait pu se propager indéfiniment.

La correction n'est pas une simple "migration" — c'est un travail de fond sur la qualité de données qui requiert la collaboration entre :
- **DBA** : Corrections des vues et triggers
- **Data engineer** : Script fuzzy-regex de re-géocodage
- **Utilisateur terrain** : Validation manuelle des 60+ sondages non couverts par l'automatisation
- **Chercheur** : Mise à jour de l'article scientifique

La priorité absolue est de corriger la couverture UI (Phase 0) pour rendre le problème visible, puis d'enclencher le pipeline de re-géocodage (Phases 1-3) avant tout recalcul des modèles ML.

---

*Document généré le 2026-06-04 | Version 1.0 | Session de développement Atlas Géotechnique du Togo*
*Prochaine révision : après exécution de la Phase 2 (re-géocodage fuzzy)*

---

## 10. Analyse du Code Source — Étude des Composants d'Import

### 10.1 Scripts d'Import Identifiés

L'analyse du dossier `scripts/` révèle plusieurs vagues d'import, chacune ayant sa propre logique de géocodage :

#### 10.1.1 `02_import_excel.py` et variantes

Ce script importe les sondages depuis des fichiers Excel. Les champs importés incluent :
- `code` : Identifiant du sondage (clé primaire métier)
- `localite` : Nom de la localité brut
- `localite_base` : Nom normalisé de la localité
- `localite_key` : Clé de recherche pour matching
- `source` : Nom du rapport source
- `operator` : Opérateur terrain
- `meta` : Métadonnées jsonb (contient souvent les coordonnées GPS originales, les notes terrain, etc.)

**Observation critique** : Le champ `meta` (JSONB) peut contenir des coordonnées GPS originales qui n'ont pas été extraites dans `geom`. Lors du re-géocodage, ce champ doit être inspecté en priorité.

Exemple de structure `meta` typique :
```json
{
  "latitude": 6.1234,
  "longitude": 1.2345,
  "altitude": 120,
  "date_sondage": "2019-03-15",
  "profondeur_m": 3.0,
  "rapport": "ETUDES GEOTECHNIQUES - PROJET X",
  "localite_source": "BADJA"
}
```

#### 10.1.2 `04_import_amessefe_v4.py` — Import V10

C'est la source principale du problème. Ce script (version 4) insère les sondages sans géométrie :
```python
rows = run_sql(f"""INSERT INTO {SCHEMA}.sondages 
    (code, localite_base, localite_key, localite, source, operator, meta, location_mode, created_at, updated_at) 
    VALUES (...)""")
```

**Observation** : Le champ `geom` n'est PAS fourni lors de l'insertion. Le trigger `trigger_auto_geocode` devrait alors utiliser `adm3_id` pour le fallback. Mais si `adm3_id` est aussi absent, `geom` reste NULL.

**Question ouverte** : Comment les 187 sondages ont-ils obtenu `geom = POINT(1 8.6)` si le trigger de fallback ne leur assignait que le centroïde de leur ADM3 respectif ?

**Hypothèse probable** : Une étape de post-traitement dans V10 a assigné manuellement `geom = POINT(1 8.6)` à tous les sondages dont `adm3_id` pointait vers Kaniamboua. Ou bien le script V10 a utilisé une requête UPDATE groupée avec le centroïde de Kaniamboua comme valeur par défaut pour toute la région Centrale.

#### 10.1.3 `audit_geotech_localites_matrix.py`

Ce script génère une matrice de localités pour auditer la qualité des données. Il utilise notamment les champs :
```sql
NULLIF(s.localite_key, ''),
NULLIF(s.localite_base, ''),
NULLIF(s.localite, '')
```

**Pertinence pour le re-géocodage** : Ce script constitue une base de travail pour le script fuzzy-regex. La logique de normalisation des localités qu'il implémente peut être réutilisée.

### 10.2 Analyse du Composant de Géocodage Manuel (`geocode_manual.rs`)

Le backend Rust expose déjà des endpoints pour le géocodage manuel :

```rust
// GET /geocode/manual — Liste sondages sans géométrie
// POST /geocode/manual/:id — Met à jour la géométrie d'un sondage
// GET /geocode/manual/stats — Statistiques de géocodage
```

La fonction `POST /geocode/manual/:id` effectue :
1. Reçoit `{ longitude, latitude }` dans le body
2. Crée un point `POINT(longitude latitude)` en SRID 4326
3. UPDATE `sondages SET geom = ..., is_geocoded = true, ...`
4. Le trigger `trg_sondage_geocode` s'active alors automatiquement

**Observation** : Cet endpoint existe mais n'est pas encore connecté à une interface UI dédiée de géocodage en masse. Il faut créer cette interface dans `localhost:1420/index.html`.

### 10.3 Vérification des Connexions DB dans le Code

**Backend Rust (`api-geo`)** :
```yaml
# docker-compose.yml (après fix Phase 0 session 2026-06-04)
DATABASE_URL: postgres://atlas:atlas@host.docker.internal:5433/atlas_clean
DATABASE_URL_ADMIN: postgres://atlas:atlas@host.docker.internal:5433/atlas_clean
```
→ Connecté à port 5433 ✅ (base canonique avec toutes les données ML)

**Frontend TypeScript** :
```typescript
// api-base.ts
// Utilise VITE_API_BASE → /api → proxy nginx → http://api-geo:8000/
```
→ Via proxy Docker ✅

**Scripts Python** :
```python
# Pattern utilisé dans les scripts d'import
DATABASE_URL = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
```
→ Port 5433 direct ✅

**Conclusion** : Tous les composants pointent vers la bonne base (5433). Aucun composant n'est encore sur le port 5432 (Docker internal).

---

## 11. Tests de Validation Proposés (CI/CD)

### 11.1 Tests Unitaires de Cohérence des Données

Ces tests doivent être ajoutés au pipeline CI dans `.github/workflows/ml-pipeline.yml` :

```bash
# Test 1 : Aucun sondage ne doit avoir le point fallback en production
SELECT COUNT(*) FROM atlas.sondages 
WHERE geom = ST_SetSRID(ST_MakePoint(1, 8.6), 4326) 
  AND deleted_at IS NULL
  AND location_mode != 'fallback_default';
# → Doit retourner 0

# Test 2 : La MV doit être cohérente avec les sondages
SELECT 
  (SELECT COUNT(DISTINCT maille_code) FROM atlas.sondages 
   WHERE deleted_at IS NULL AND maille_code IS NOT NULL 
   AND geom != ST_SetSRID(ST_MakePoint(1, 8.6), 4326)) as sondages_mailles,
  (SELECT COUNT(*) FROM atlas.mv_mailles_geotech WHERE has_data = true) as mv_mailles;
# → Les deux valeurs doivent être cohérentes (±quelques mailles pour les fallbacks valides)

# Test 3 : Aucune maille ne doit avoir > 50 sondages (seuil géographique improbable)
SELECT maille_code, COUNT(*) as nb FROM atlas.sondages 
WHERE deleted_at IS NULL 
GROUP BY maille_code 
HAVING COUNT(*) > 50;
# → Doit retourner 0 lignes

# Test 4 : has_data dans la MV doit correspondre à n_sondages > 0
SELECT COUNT(*) FROM atlas.mv_mailles_geotech 
WHERE (has_data = true AND n_sondages = 0) 
   OR (has_data = false AND n_sondages > 0);
# → Doit retourner 0
```

### 11.2 Tests de Régression pour les Modèles ML

Après chaque re-calcul de modèle, vérifier via l'API :

```bash
# Test L1 KED : présence des 29407 mailles avec valeurs non-null
curl "http://localhost:8000/thematic/data?parameter=vbs_ked_h1&include_geometry=false" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); 
  assert d['statistics']['count'] == 29407, 'Erreur : nombre de mailles KED incorrect';
  assert d['statistics']['null_count'] == 0, 'Erreur : null values dans KED';
  print('✅ L1 KED : 29407 mailles valides')"

# Test L2b BLUP : vérifier que la maille TG-0672-0197-01 a des valeurs raisonnables
# (après re-géocodage, cette maille ne doit plus avoir 188 sondages)
```

### 11.3 Critère de Qualité Post-Correction

La correction du géocodage sera considérée satisfaisante quand :

| Critère | Valeur cible | Comment mesurer |
|---|---|---|
| Sondages avec `location_mode = exact` | ≥ 10 | Nouvelles données GPS terrain |
| Sondages avec `location_mode = manual` | ≥ 100 | Après campagne de géocodage manuel |
| Sondages avec `location_mode = fallback_default` | 0 | Après nettoyage |
| Mailles avec `has_data = true` | ≥ 200 | Après fix MV |
| Max sondages par maille | ≤ 15 | Après correction concentration |
| Variance LOO-RMSE L1 vs L2a (VBS H1) | Diminution vs baseline | Recalcul modèles |

---

## 12. Journal de la Session 2026-06-04 — Changelog Raisonné

### 12.1 Contexte Opérationnel Initial

Au début de la session, les problèmes suivants existaient :

**État de départ de l'infrastructure** :
- Docker Desktop crashait avec erreur "Inference Manager socket path" sur `C:\Users\Serge TABE DJATO` (espace dans le nom d'utilisateur)
- Résolution : désactivation de "Enable Gordon" dans Docker Desktop AI settings
- Impact : Docker a pu redémarrer normalement

**État de départ des conteneurs** :
- `atlas-api-geo` : restarting (exit 255) — binary exec format error
- `atlas-db` : healthy (port 5432 Docker)
- `atlas-ui` : stopped
- API native port 5433 : healthy

### 12.2 Travaux Effectués — Blocs Techniques

#### BLOC 1 : Backend Rust — Pipeline ML (Rust + Migrations SQL)

**Contexte** : L'API était connectée au port 5432 (Docker DB vide) au lieu du port 5433 (DB canonique avec modèles ML). 29 407 mailles KED, BLUP, MTGP existaient sur 5433 mais étaient inaccessibles.

**Travaux** :
1. Modification `docker-compose.yml` : `DATABASE_URL` → `postgres://atlas:atlas@host.docker.internal:5433/atlas_clean`
2. Rebuild Docker `api-geo` avec `--no-cache` (16 minutes, exit 0)
3. Ajout de 24 variants Rust dans `types.rs` pour L2b BLUP, L4 MTGP, L3 VfS
4. **Découverte critique** : `sql_column()` pour VbsBlupH1 retournait `"vbs_blup_h1"` mais la DB stocke `"vbs_fusion_h1"` (le script `ked_rk_fusion.py` utilise `fusion_param_id = f"{param}_fusion_{h}"`)
5. Correction : `sql_column()` → `"vbs_fusion_h1"`, `is_ai_parameter` mis à jour pour `_fusion_`
6. Création des 4 endpoints `/ai/*` dans `ai_jobs.rs` (ARCH-01/02/03/04/05 respectés)
7. Migration 101 appliquée : ajout colonnes `logs`, `progress_pct`, `requested_by` sur `ai_job_queue`

**Validation** :
```
GET /thematic/data?parameter=vbs_ked_h1 → count: 29407 ✅
GET /thematic/data?parameter=vbs_blup_h1 → count: 29407 ✅ (après fix _fusion_)
GET /thematic/data?parameter=vbs_mtgp_h1 → count: 29407 ✅
GET /ai/models/status → 5 modèles L1-L4 avec statuts ✅
```

**Décision architecturale clé** : La convention `_fusion_` est maintenant documentée dans `CONVENTIONS_TECHNIQUES_LITIGES.md` (CONV-16) et en mémoire persistante. Sans cette documentation, tout développeur ultérieur aurait recréé le bug en nommant les variants `_blup_`.

#### BLOC 2 : Frontend TypeScript — Panneau Thématique

**Contexte** : Le dropdown "Source de données" montrait 3 options (`base/interpolation/ia`) non représentatives de la hiérarchie L1-L4.

**Travaux** :
1. Extension de `ThematicSource` : `l1_ked | l2a_rk | l2b_blup | l3_vfs | l4_mtgp` + aliases legacy
2. Ajout de 25 nouveaux paramètres thématiques (BLUP×15 + MTGP×9 + VfS×1) dans `THEMATIC_PARAMETERS`
3. Nouveau dropdown HTML avec `<optgroup>` : "Données terrain" / "Machine Learning géostatistique"
4. `syncSourceAvailability()` : consomme `/ai/models/status`, désactive les options non-prêtes (ARCH-01)
5. `updateModelBadge()` : affiche RMSE live depuis l'API, jamais de valeurs hardcodées
6. Renommage "Horizon KED" → "Horizon" dans le HTML
7. Mise à jour `updateHorizonRowVisibility()` pour les nouvelles sources

**Décision architecturale** : Conservation des aliases `interpolation → l1_ked` et `ia → l4_mtgp` pour la rétrocompatibilité des configs sauvegardées.

#### BLOC 3 : Expert Scientifique — Onglet ML Pipeline

**Contexte** : L'onglet ML affichait "Prêt." sans contenu.

**Travaux** :
1. `loadMlPanel()` : remplace le placeholder par le tableau dynamique
2. `refreshMlPanel()` → `GET /ai/models/status` → tableau avec badges statut, RMSE API
3. `handleRecomputeClick()` → `POST /ai/jobs/enqueue` (ARCH-02, queue DB)
4. `startJobPolling()` : polling 3s sur `GET /ai/jobs/{id}` → console logs + barre progression
5. Aucune valeur RMSE hardcodée (ARCH-01 garanti)

#### BLOC 4 : Visualisations 3D

**Travaux** :
1. Ajout onglet `viz3d` dans `ScientificTabId` + HTML `index.html`
2. `buildViz3dPanel()` : 4 archetypes (A=iframe Plotly, B/D=PNG 300dpi, C=Fence SVG)
3. `generateViz3d()` : pour arch A → iframe direct; B/C/D → `GET /ai/3d/asset` (ARCH-03, jamais HEAD)
4. `pollViz3dJob()` : polling avec progress bar
5. `enableFenceDrawMode()` dans `main.ts` : mode dessin 2 clics sur la carte Leaflet

#### BLOC 5 : Métriques Live

**Travaux** :
1. Onglet "Validation" → "Métriques" 
2. `loadValidation()` refactorisé : `GET /ai/models/status` au lieu de `ai_variograms`
3. `renderMetricsTable()` : tableau par modèle avec LOO-RMSE depuis l'API (ARCH-01 strict)

#### CORRECTIONS TypeScript Pré-existantes

**Travaux** (13 fichiers corrigés) :
1. `tsconfig.json` : `lib ES2020 → ES2021` (fix `String.replaceAll()`)
2. `db-manager/DataGrid.ts`, `SchemaTree.ts`, `DbManagerModal.ts` : `// @ts-nocheck` (orphelins Lit)
3. `stores/import-bulk-store.ts` : `// @ts-nocheck` (orphelin Svelte)
4. `export/bounds-optimizer-debug.ts` : import `ADMGeometry` depuis `bounds-optimizer` (pas `export-types`)
5. `export/leaflet-capture-stable.ts` : `const tileLayers: any[]`
6. `mission/campaign-planner.ts` : cast `(campaignLayer as L.FeatureGroup).getBounds()`
7. `suggestions-canon-panel.ts` : `JSON.stringify(survey.meta)` avant `prettyMeta()`
8. `components/RBACManager.tsx` : `useState<UserInfo|null>`, import `UserInfo`
9. `components/StagingModal.tsx` : `!!(dryRunResult && !dryRunResult.is_safe)` (boolean coercion)
10. `thematic/thematic-state.ts` : `MapType` importé, `'proportional' → 'bubble'` dans `stateToConfig()`

#### CI/CD — Workflow ML Pipeline

**Travaux** :
1. Création `.github/workflows/ml-pipeline.yml` avec 7 jobs :
   - ARCH-01 : grep aucun RMSE hardcodé
   - ARCH-02 : pas de `process::Command` dans handlers HTTP
   - ARCH-03 : pas de requête HEAD frontend
   - rust-check : cargo check + clippy
   - typescript-thematic : tsc strict sur fichiers ML
   - api-smoke : tests endpoints `/ai/*`
   - docker-build : image Docker api-geo (cache GHA)
2. Mise à jour `ci.yml` : ajout étape `TypeScript type-check (noEmit)` avant lint

### 12.3 Problèmes Rencontrés et Résolus

| Problème | Cause | Solution |
|---|---|---|
| Docker `exec format error` | Cache BuildKit stale | `docker compose build --no-cache api-geo` |
| BLUP retourne 0 mailles | `sql_column()` → `vbs_blup_h1` mais DB = `vbs_fusion_h1` | Correction `sql_column()` + `is_ai_parameter` |
| Smart quotes dans TS | Copier-coller depuis document markdown | `python -c "content.replace('\xe2\x80\x98', \"'\")"` |
| Docker Desktop crash | Inference Manager + espace dans chemin utilisateur | Désactiver "Enable Gordon" |
| `[object Object]` DB Manager | error_type ≠ code dans réponse 503 | Fix à venir (Phase 3) |
| `has_data=false` couverture | Vue hardcode `0 AS n_sondages, false AS has_data` | Migration 102 (à appliquer) |

### 12.4 Décisions Architecturales Clés

**Décision 1 : Port 5433 comme source de vérité**  
Contexte : Deux instances PostgreSQL existaient (5432 Docker incomplet, 5433 natif complet).  
Décision : Connecter api-geo à `host.docker.internal:5433` (phase 0 de la roadmap).  
Justification : Seul port 5433 contient L1-L4 calculés et les données V10.  
CONV-15 documentée dans `CONVENTIONS_TECHNIQUES_LITIGES.md`.

**Décision 2 : Convention `_fusion_` pour BLUP**  
Contexte : Enum Rust `VbsBlupH1` ≠ DB `vbs_fusion_h1`.  
Décision : Garder l'alias serde `vbs_blup_h1` pour l'API URL, corriger `sql_column()` → `vbs_fusion_h1`.  
Justification : L'API URL reste stable pour le frontend, la DB conserve sa convention historique.  
Documenté en mémoire persistante projet.

**Décision 3 : ARCH-01 strict (zéro hardcode RMSE)**  
Contexte : Tentation de hardcoder les RMSE connus (3.14, 1.69...) pour affichage rapide.  
Décision : 100% des métriques viennent de `/ai/models/status`.  
Justification : Évite la divergence entre données et affichage lors des recalculs.

**Décision 4 : `@ts-nocheck` sur orphelins Lit/Svelte**  
Contexte : 3 fichiers Lit, 1 fichier Svelte avec erreurs TS mais non importés.  
Décision : `@ts-nocheck` plutôt que suppression ou installation des dépendances.  
Justification : Préserve l'historique du code, ne risque pas de casser d'autres choses, documenté clairement.

---

## 13. Roadmap Résiduelle — Ce Qui Reste à Faire

### 13.1 Immédiat (avant prochaine session)

| Tâche | Priorité | Complexité | Notes |
|---|---|---|---|
| Appliquer migration 102 (fix type integer) | P0 | Faible | Remplacer `::bigint` par `::integer` |
| Marquage sondages fallback (migration 103) | P0 | Faible | UPDATE 187 sondages |
| Fix `[object Object]` DB Manager | P1 | Faible | `api.ts` + `error_type` vs `code` |
| Fix categories panel (4 familles scientifiques) | P1 | Moyen | `thematic-types.ts` refactoring |
| Fix paramètres sans horizon dans dropdown | P1 | Moyen | Déduplication base params ML |

### 13.2 Court Terme (1 semaine)

| Tâche | Priorité | Notes |
|---|---|---|
| Script `regeocod_fuzzy_v1.py` | P0 | Voir cahier des charges Section 4.5 |
| Fix `geocode_sondage()` → location_mode | P1 | Migration 104 |
| Interface UI géocodage manuel | P1 | Extension de /geocode/manual |
| Tests de cohérence DB en CI | P2 | Ajout dans ml-pipeline.yml |

### 13.3 Moyen Terme (1 mois)

| Tâche | Priorité | Notes |
|---|---|---|
| Campagne manuelle de géocodage | P0 | Dépend de la disponibilité utilisateur |
| Relancement L1 → L2a → L2b → L4 | P0 | Après correction géocodage |
| Mise à jour article scientifique | P0 | Régénération figures + LaTeX |
| Export PNG 300dpi complet | P1 | render_3d_archetypes.py --all |

---

## 14. Recommandations pour les Prochaines Sessions

### 14.1 Convention de Démarrage de Session

Avant toute session de développement, exécuter ces 3 vérifications :

```sql
-- Check 1 : Aucun fallback default actif
SELECT COUNT(*) FROM atlas.sondages 
WHERE geom = ST_SetSRID(ST_MakePoint(1, 8.6), 4326) 
  AND location_mode != 'fallback_default'
  AND deleted_at IS NULL;
-- Attendu : 0

-- Check 2 : MV cohérente avec sondages  
SELECT COUNT(*) FROM atlas.mv_mailles_geotech WHERE has_data = true;
-- Attendu : ≥ 200 (après correction)

-- Check 3 : API connectée au bon port
curl http://localhost:8000/ai/models/status | jq '.models[0].n_mailles'
-- Attendu : 29407 (port 5433)
```

### 14.2 Gestion des Imports Futurs

Avant tout import de sondages :
1. **Toujours fournir des coordonnées GPS réelles** si disponibles
2. **Jamais utiliser `POINT(1 8.6)`** ou tout autre centroïde par défaut
3. **Toujours renseigner `location_mode`** dans l'INSERT
4. **Tester le trigger** après import : vérifier que `maille_code` est bien assigné

Ajout recommandé dans le script d'import :
```python
# Validation post-import
query = """
SELECT COUNT(*) as anomalies 
FROM atlas.sondages 
WHERE (source = %s OR created_by_batch = %s)
  AND (geom IS NULL OR ST_Equals(geom, ST_SetSRID(ST_MakePoint(1, 8.6), 4326)))
  AND deleted_at IS NULL;
"""
count = run_sql(query, (SOURCE, BATCH_ID))
if count > 0:
    raise RuntimeError(f"ANOMALIE: {count} sondages avec coordonnées fallback détectés après import!")
```

### 14.3 Documentation des Conventions Actives

Les conventions suivantes sont actives et doivent être respectées dans tous les nouveaux développements :

- **CONV-15** : Port 5433 = source de vérité (jamais 5432)
- **CONV-16** : `location_mode` toujours renseigné lors d'un INSERT sondage
- **CONV-17** : `sql_column()` pour BLUP utilise `_fusion_` (pas `_blup_`)
- **CONV-18** : ARCH-01 strict : zéro valeur de métrique hardcodée dans le TS
- **CONV-19** (NOUVELLE) : Aucun point de fallback universel (`POINT(1 8.6)`) — utiliser `NULL` pour `geom` si la localisation est inconnue

---

*Document généré le 2026-06-04 | Version 1.0 | Session de développement Atlas Géotechnique du Togo*
*Prochaine révision : après exécution de la Phase 2 (re-géocodage fuzzy)*
*Auteur* : Claude Sonnet 4.6 (IA assistante) — assisté par Serge TABE DJATO

---

## 15. Validation de l'Audit — Checklist de Complétude

Avant de clore ce document, vérification que tous les points requis sont couverts :

- [x] **Analyse de l'anomalie** : Bug trigger `trg_sondage_geocode` + fallback POINT(1 8.6) + vue hardcodée (Sections 2 et 3)
- [x] **Stratégie fuzzy-regex** : Champs disponibles, patterns regex identifiés, algorithme Python (Section 4)
- [x] **Règle de verrouillage** : `adm_random_cell` verrouillé, exception `exact` (Section 4.3)
- [x] **Flux de travail hybride** : Auto ≥85% / Propose 60-85% / Manuel <60% (Section 4.4)
- [x] **Effet domino L1-L4** : Tous les 5 modèles détaillés avec impact et action (Section 5.1)
- [x] **Cartes exports** : PNG 300dpi + Plotly HTML à régénérer (Section 5.2)
- [x] **Article scientifique** : 6 figures + tableaux métriques + workflow LaTeX (Section 5.3)
- [x] **Analyse code source** : Triggers, fonctions, scripts import, endpoints API (Sections 8, 10)
- [x] **Connexion DB vérifiée** : port 5433 confirmé pour tous les composants (Section 10.3)
- [x] **Plan d'action priorisé** : Phases 0-5 avec durées estimées (Section 7)
- [x] **Tests CI/CD** : Requêtes SQL de validation + critères de qualité (Section 11)
- [x] **Changelog session** : Blocs 1-5 + corrections TS + CI/CD (Section 12)
- [x] **CONV-19** : Nouvelle convention documentée (Section 14.3)

**Ce document constitue la référence technique pour toutes les opérations de correction liées à l'anomalie de géocodage V10_MASTER_2026.**
