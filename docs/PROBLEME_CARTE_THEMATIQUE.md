# 🔍 Problème Carte Thématique - Diagnostic

**Date** : 2025-10-21  
**Symptôme** : "Erreur: Aucune valeur à classifier"

---

## ✅ Ce qui Fonctionne

1. **Proxy Nginx** : ✅ `/api/healthz` répond
2. **UI utilise `/api`** : ✅ Build correct
3. **Base de données** : ✅ 187 mailles avec `passant_80um_avg`
4. **Vue matérialisée** : ✅ Existe et est peuplée
5. **Requête SQL directe** : ✅ Retourne des données

```sql
SELECT code, passant_80um_avg as value, n_sondages, n_essais_geo
FROM mailles_geotechnique_stats
WHERE passant_80um_avg IS NOT NULL
LIMIT 5;
-- Retourne 5 lignes ✅
```

---

## ❌ Ce qui Ne Fonctionne Pas

**API `/thematic/data`** : Retourne 0 features

### Tests effectués

```powershell
# Test 1 : Sans géométrie, sans filtres
GET /api/thematic/data?parameter=passant_80um_avg&include_geometry=false&min_sondages=0
→ 0 features ❌

# Test 2 : Avec géométrie
GET /api/thematic/data?parameter=passant_80um_avg&include_geometry=true&min_sondages=0
→ 0 features ❌
```

---

## 🔍 Cause Probable

**Code Rust** (`services/api-geo/src/thematic/routes.rs`, ligne 91) :

```rust
let value: Option<f64> = row.try_get("value").ok().flatten();
```

Cette ligne **échoue silencieusement** pour chaque ligne retournée par SQL.

### Hypothèses

1. **Type mismatch** : `passant_80um_avg` est `NUMERIC` en PostgreSQL, pas `f64`
2. **Nom de colonne** : L'alias `as value` ne fonctionne pas avec `sqlx::query`
3. **Extraction dynamique** : `sqlx::query` (non typé) a du mal avec les vues matérialisées

---

## 🔧 Solution Appliquée

### Ajout de logs debug

```rust
eprintln!("🔍 SQL Query: {}", query);
let rows = sqlx::query(&query).fetch_all(pool).await?;
eprintln!("✅ Rows fetched: {}", rows.len());

for row in rows {
    let value: Option<f64> = match row.try_get("value") {
        Ok(v) => v,
        Err(e) => {
            eprintln!("⚠️  Erreur try_get value: {}", e);
            None
        }
    };
}
```

### Prochaines étapes

1. ✅ Rebuild API avec logs
2. ⏳ Tester et lire les logs
3. 🔧 Corriger selon l'erreur trouvée

---

## 📊 Données Disponibles

| Paramètre | Mailles avec données |
|-----------|---------------------|
| `n_sondages` | 29407 |
| `n_essais_geo` | 29407 |
| `passant_80um_avg` | 187 |
| `passant_2mm_avg` | 187 |
| `wl_avg` | 150 |
| `wp_avg` | 150 |
| `ip_avg` | 150 |
| `vbs_avg` | 187 |
| `gamma_d_max_avg` | 187 |
| `w_opt_avg` | 187 |
| `eg_avg` | 187 |

---

## 🎯 Solutions Potentielles

### Option A : Cast explicite

```rust
let value: Option<f64> = row.try_get::<Option<rust_decimal::Decimal>, _>("value")
    .ok()
    .flatten()
    .map(|d| d.to_f64().unwrap_or(0.0));
```

### Option B : Requête typée

Utiliser `sqlx::query_as!` au lieu de `sqlx::query`

### Option C : Conversion SQL

```sql
SELECT 
    code,
    CAST(passant_80um_avg AS DOUBLE PRECISION) as value,
    ...
```

---

**Statut** : 🔄 En cours de résolution
