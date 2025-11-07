# 🗂️ SCHÉMA ERD COMPLET - Atlas Géotechnique

**Date:** 2025-11-06

---

## 📊 Diagramme Entité-Relation

```mermaid
erDiagram
    %% ============================================================================
    %% TABLES BRUTES (Source de vérité unitaire)
    %% ============================================================================
    
    sondages {
        uuid id PK
        text code UK "GRANULO-KOMAH"
        text localite "KOMAH"
        uuid adm3_id FK
        text adm3_name "Komah"
        geometry geom "Point(25231)"
        location_mode_enum location_mode "exact|adm_random_cell|unknown"
        boolean is_geocoded "GENERATED: geom OR adm3"
        date date
        text source "Granulométrie"
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }
    
    echantillons {
        uuid id PK
        uuid sondage_id FK
        numeric profondeur_m
        text type_sol
        timestamptz created_at
    }
    
    classifications {
        uuid id PK
        uuid sondage_id FK
        numeric profondeur_m
        text uscs
        text gtr
        timestamptz created_at
    }
    
    essais_geotechniques {
        uuid id PK
        uuid sondage_id FK
        text type_essai
        numeric profondeur_m
        jsonb resultats
        timestamptz created_at
    }
    
    essais_atterberg {
        uuid id PK
        uuid echantillon_id FK
        numeric wl
        numeric wp
        numeric ip
    }
    
    essais_proctor {
        uuid id PK
        uuid echantillon_id FK
        numeric wopn
        numeric gamma_opn
    }
    
    essais_vbs {
        uuid id PK
        uuid echantillon_id FK
        numeric vbs
    }
    
    granulo_points {
        uuid id PK
        uuid echantillon_id FK
        numeric tamis_mm
        numeric passant_pct
    }
    
    %% ============================================================================
    %% TABLES CANONIQUES (Agrégées par localité)
    %% ============================================================================
    
    atlas_surveys {
        uuid id PK "= premier sondage"
        text code UK "Code canonique"
        text localite_canon UK "Normalisé"
        text localite "Humain"
        uuid adm3_id FK
        text adm3_name
        geometry geom "Point(4326)"
        location_mode location_mode "exact|adm|unknown"
        boolean is_geocoded "geom OR adm3"
        boolean has_geom "GENERATED"
        boolean has_adm3 "GENERATED"
        integer nb_sondages_source
        timestamptz created_at
        timestamptz updated_at
    }
    
    atlas_survey_aliases {
        uuid id PK
        uuid survey_id FK
        text alias_code UK "GRANULO-KOMAH"
        text source "legacy"
    }
    
    atlas_survey_tests {
        uuid id PK
        uuid survey_id FK
        text test_type
        jsonb test_data
    }
    
    %% ============================================================================
    %% TABLES ADM (Administratives)
    %% ============================================================================
    
    adm3 {
        integer gid PK
        text adm3_fr "Komah"
        text adm3_pcode "TG010506"
        text adm2_fr "Tchaoudjo"
        text adm1_fr "Centrale"
        geometry geom "Polygon(4326)"
    }
    
    adm2 {
        integer gid PK
        text adm2_fr
        text adm1_fr
        geometry geom
    }
    
    adm1 {
        integer gid PK
        text adm1_fr
        geometry geom
    }
    
    %% ============================================================================
    %% TABLES IMPORT
    %% ============================================================================
    
    imports {
        uuid id PK
        text filename
        text status
        timestamptz created_at
    }
    
    import_items {
        uuid id PK
        uuid import_id FK
        integer row_idx
        text status
        uuid created_survey_id FK
        jsonb raw_data
    }
    
    %% ============================================================================
    %% VUES MATÉRIALISÉES
    %% ============================================================================
    
    atlas_mv_sondages_unifies {
        uuid id PK
        text code
        text localite_canon
        boolean has_geom
        boolean has_adm3
        boolean is_geocoded
        integer nb_sondages
        uuid_array source_survey_ids
        text_array alias_codes
    }
    
    %% ============================================================================
    %% RELATIONS
    %% ============================================================================
    
    sondages ||--o{ echantillons : "a des"
    sondages ||--o{ classifications : "a des"
    sondages ||--o{ essais_geotechniques : "a des"
    
    echantillons ||--o{ essais_atterberg : "a des"
    echantillons ||--o{ essais_proctor : "a des"
    echantillons ||--o{ essais_vbs : "a des"
    echantillons ||--o{ granulo_points : "a des"
    
    sondages }o--|| adm3 : "rattaché à"
    adm3 }o--|| adm2 : "dans"
    adm2 }o--|| adm1 : "dans"
    
    imports ||--o{ import_items : "contient"
    import_items }o--|| sondages : "crée"
    
    sondages ||--o{ atlas_mv_sondages_unifies : "agrégé dans"
    atlas_mv_sondages_unifies ||--|| atlas_surveys : "matérialisé dans"
    atlas_surveys ||--o{ atlas_survey_aliases : "a des alias"
    atlas_surveys ||--o{ atlas_survey_tests : "lié aux essais"
```

---

## 🔄 Flux de Données (Data Lineage)

```mermaid
flowchart TB
    subgraph Import["📥 IMPORT"]
        A[CSV/Excel] --> B[Import Wizard]
        B --> C[import_items]
        C --> D[sondages brute]
    end
    
    subgraph Triggers["⚡ TRIGGERS"]
        D --> E[sondages_auto_code<br/>Génère code si absent]
        E --> F[sondages_tag_spatial<br/>Tag ADM automatique]
        F --> G[trg_enqueue_geocode_suggestion<br/>Enqueue suggestion]
    end
    
    subgraph Essais["🧪 ESSAIS"]
        D --> H[echantillons]
        H --> I[essais_atterberg<br/>WL, WP, IP]
        H --> J[essais_proctor<br/>WOPN, γOPN]
        H --> K[essais_vbs<br/>VBS]
        H --> L[granulo_points<br/>Courbe granulo]
    end
    
    subgraph Canonique["📊 CANONIQUE"]
        D --> M[atlas.v_sondages_unifies<br/>Vue: Agrégation par localite_canon]
        M --> N[atlas.mv_sondages_unifies<br/>MV: 140 localités]
        N --> O[atlas.refresh_surveys<br/>Fonction: Refresh]
        O --> P[atlas.surveys<br/>Table: 140 localités]
        O --> Q[atlas.survey_aliases<br/>Table: Mapping codes]
    end
    
    subgraph API["🌐 API"]
        D --> R[GET /sondages<br/>230 sondages individuels]
        D --> S[GET /sondages/stats<br/>KPI sondages]
        D --> T[PATCH /sondages/:id/geometry<br/>Géocoder 1 sondage]
        P --> U[GET /surveys-canon<br/>140 localités agrégées]
        P --> V[GET /surveys-canon/stats<br/>KPI localités]
    end
    
    subgraph UI["🖥️ UI"]
        R --> W[Liste Sondages<br/>230 items]
        S --> X[Badge: 229 sans géométrie]
        T --> Y[Géocodage sondage]
        U --> Z[Toggle: Grouper par localité<br/>140 items]
    end
    
    style D fill:#ff6b6b,color:#fff
    style P fill:#51cf66,color:#fff
    style N fill:#ffa94d,color:#fff
    style W fill:#4c6ef5,color:#fff
    style R fill:#4c6ef5,color:#fff
```

---

## 🔑 Fonctions Clés

### `atlas.norm(text)`

**Rôle:** Normalisation pour recherche accent-insensitive.

```sql
CREATE FUNCTION atlas.norm(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(unaccent(regexp_replace($1, '\s+', ' ', 'g')))
$$;
```

**Transformations:**
- `unaccent()`: Supprime accents (é → e)
- `regexp_replace()`: Normalise espaces
- `lower()`: Minuscules

**Exemples:**
```
"Adjengré  " → "adjengre"
"Bassar-Kpankissi" → "bassar-kpankissi"
```

### `atlas.normalize_localite(text)`

**Rôle:** Normalisation pour clé de regroupement.

```sql
CREATE FUNCTION atlas.normalize_localite(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT atlas.norm($1)
$$;
```

### `atlas.refresh_surveys()`

**Rôle:** Rafraîchir tables canoniques depuis MV.

```sql
CREATE FUNCTION atlas.refresh_surveys()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Refresh MV
  REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_sondages_unifies;
  
  -- 2. Truncate canoniques
  TRUNCATE atlas.surveys RESTART IDENTITY CASCADE;
  
  -- 3. Insérer depuis MV
  INSERT INTO atlas.surveys (...)
  SELECT ... FROM atlas.mv_sondages_unifies;
  
  -- 4. Insérer aliases
  INSERT INTO atlas.survey_aliases (...)
  SELECT id, unnest(alias_codes), 'legacy'
  FROM atlas.mv_sondages_unifies;
END;
$$;
```

### `extract_localite(text)`

**Rôle:** Extraire localité depuis code.

```sql
-- Exemple
SELECT extract_localite('GRANULO-KOMAH');
-- Retourne: 'KOMAH'
```

---

## 📊 Statistiques Actuelles

### Sondages (Brute)

```sql
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE localite IS NOT NULL) as avec_localite,
  COUNT(*) FILTER (WHERE is_geocoded) as geocodes,
  COUNT(*) FILTER (WHERE geom IS NOT NULL) as avec_geom,
  COUNT(*) FILTER (WHERE adm3_id IS NOT NULL) as avec_adm3
FROM sondages
WHERE deleted_at IS NULL;
```

| Métrique | Valeur | % |
|----------|--------|---|
| Total | 230 | 100% |
| Avec localite | 230 | 100% |
| Géocodés | 1 | 0.4% |
| Avec géométrie | 1 | 0.4% |
| Avec ADM3 | 0 | 0% |

### Localités (Canonique)

```sql
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE has_geom) as avec_geom,
  COUNT(*) FILTER (WHERE has_adm3) as avec_adm3,
  COUNT(*) FILTER (WHERE is_geocoded) as geocodes
FROM atlas.surveys;
```

| Métrique | Valeur | % |
|----------|--------|---|
| Total | 140 | 100% |
| Avec géométrie | 1 | 0.7% |
| Avec ADM3 | 0 | 0% |
| Géocodés | 1 | 0.7% |

---

## 🎯 Différence Clé: Sondages vs Localités

| Aspect | Sondages (`sondages`) | Localités (`atlas.surveys`) |
|--------|----------------------|----------------------------|
| **Nombre** | 230 | 140 |
| **Granularité** | 1 sondage = 1 ligne | 1 localité = N sondages |
| **Code** | GRANULO-KOMAH, BLEU-KOMAH | GRANULO-KOMAH (canonique) |
| **Géocodage** | Individuel | Appliqué à tous les sondages |
| **API** | `/sondages` | `/surveys-canon` |
| **UI** | 230 items, pas de badge | 140 items, badge "X sondages" |

**Recommandation:** Utiliser `/sondages` par défaut, avec toggle optionnel pour `/surveys-canon`.

---

## 📁 Fichiers Associés

- `docs/AUDIT_DONNEES_PART1.md` - Détails tables
- `docs/AUDIT_DONNEES_PART2.md` - Incohérences
- `docs/AUDIT_DONNEES_PART3.md` - Migrations
- `docs/AUDIT_SYNTHESE.md` - Synthèse exécutive
- `migrations/backfill_localite.sql` - ✅ Appliquée
- `migrations/fix_is_geocoded_sondages.sql` - ✅ Appliquée
- `migrations/recreate_views_with_flags.sql` - ✅ Appliquée
