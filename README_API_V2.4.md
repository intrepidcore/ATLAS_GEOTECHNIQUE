# 📡 API Atlas v2.4.0 - Documentation

## Endpoint `/cells/{code}/complete` — Enrichi

### Nouveaux Champs (v2.4.0)

#### `samples[].physiques`
```json
{
  "densite_absolue_gcm3": 2.65,
  "teneur_eau_pct": 12.5,
  "source": "ADOTE Adote emmanuel"
}
```

#### `samples[].classif`
```json
{
  "aashto": [
    { "class": "A-2-4", "reason": "IP < 10" }
  ],
  "uscs": [
    { "class": "SM", "reason": "Sable limoneux" }
  ],
  "gtr": [
    { "class": "B2", "reason": "Sol sablo-limoneux" }
  ]
}
```

#### `surveys[].badge`
```json
{
  "id": "uuid",
  "code_site": "BLEU-AKEPE",
  "mode": "adm_random_cell",
  "badge": "ADM random cell"  // ← Nouveau champ
}
```

---

## Exemple Complet

### Requête
```bash
curl http://localhost:8000/cells/TG-0703-0236-01/complete
```

### Réponse
```json
{
  "kpi": {
    "n_sondages": 3,
    "n_echantillons": 9,
    "updated_at": "2025-11-04T11:00:00Z"
  },
  "samples": [
    {
      "id": "uuid-1",
      "depth_m": 1.0,
      "wl": 45.2,
      "wp": 22.1,
      "ip": 23.1,
      "vbs": 5.2,
      "physiques": {
        "densite_absolue_gcm3": 2.68,
        "teneur_eau_pct": 15.3,
        "source": "ADOTE Adote emmanuel"
      },
      "classif": {
        "aashto": [
          { "class": "A-6", "reason": "IP > 10" }
        ],
        "uscs": [
          { "class": "CL", "reason": "Argile peu plastique" }
        ]
      }
    }
  ],
  "surveys": [
    {
      "id": "uuid-s1",
      "code_site": "BLEU-AKEPE",
      "mode": "adm_random_cell",
      "samples": 3,
      "tests": 9,
      "badge": "ADM random cell"
    }
  ]
}
```

---

## Vue SQL Sous-jacente

### `v_samples_complete_v4`

```sql
CREATE VIEW v_samples_complete_v4 AS
SELECT
  eg.id AS essai_id,
  s.code AS code_site,
  s.grid_code,
  eg.depth_m,
  eg.wl, eg.wp, (eg.wl - eg.wp) AS ip,
  eg.vbs,
  -- physiques
  jsonb_strip_nulls(
    jsonb_build_object(
      'densite_absolue_gcm3', ep.densite_absolue_gcm3,
      'teneur_eau_pct', ep.teneur_eau_pct,
      'source', ep.source
    )
  ) AS physiques,
  -- classif
  (
    SELECT jsonb_strip_nulls(
      jsonb_build_object(
        'aashto', (SELECT jsonb_agg(...) FROM essais_classif WHERE systeme='AASHTO'),
        'uscs', (SELECT jsonb_agg(...) FROM essais_classif WHERE systeme='USCS'),
        'gtr', (SELECT jsonb_agg(...) FROM essais_classif WHERE systeme='GTR')
      )
    )
  ) AS classif
FROM essais_geotechniques eg
JOIN sondages s ON s.id = eg.sondage_id
LEFT JOIN essais_physiques ep ON ep.essai_id = eg.id;
```

---

## Tests

### PowerShell
```powershell
.\scripts\test_complete_api.ps1 -Cell "TG-0703-0236-01"
```

### Vérifications Automatiques
- ✅ `samples` présent
- ✅ `surveys` présent
- ✅ Au moins 1 sample avec `physiques` ou `classif`
- ✅ Champ `badge` existe (même si NULL)

---

## Intégration UI

### TypeScript
```typescript
import { renderPhysiques, renderClassif, renderSurveys } from './cell-complete-types'

const data = await fetch(`/api/cells/${code}/complete`).then(r => r.json())

renderPhysiques(document.getElementById('physiques-panel'), data.samples)
renderClassif(document.getElementById('classif-panel'), data.samples)
renderSurveys(document.getElementById('survey-list'), data.surveys)
```

### HTML
```html
<!-- Accordéon Essais Physiques -->
<div class="section">
  <h4>⚗️ Essais physiques</h4>
  <div id="physiques-panel"></div>
</div>

<!-- Accordéon Classifications -->
<div class="section">
  <h4>🏷️ Classifications</h4>
  <div id="classif-panel"></div>
</div>

<!-- Accordéon Sondages -->
<div class="section">
  <h4>🧭 Sondages</h4>
  <div id="survey-list"></div>
</div>
```

### CSS
```css
.badge-adm { 
  background: #eef6ff; 
  color: #1557b0; 
  padding: 2px 6px; 
  border-radius: 10px; 
}
.chip-aashto { background: #fff1e6; color: #9a5b00; }
.chip-uscs { background: #eaf8f1; color: #0f6848; }
.chip-gtr { background: #f1e8ff; color: #5a36a3; }
```

---

## Migration

### Appliquer la Vue
```bash
Get-Content db\migrations\017_view_samples_v4.sql | docker exec -i atlas-db psql -U atlas -d atlas_clean
```

### Rebuild API
```bash
cd services/api-geo
cargo build --release
cd ../..
docker compose build api-geo
docker compose restart api-geo
```

### Rebuild UI
```bash
cd ui
npm run build
cd ..
docker compose build ui
docker compose restart ui
```

---

## Changelog

### v2.4.0 (2025-11-04)
- ✅ Ajout `physiques` et `classif` dans `/cells/{code}/complete`
- ✅ Badge "ADM random cell" pour sondages
- ✅ Nouveaux accordéons UI
- ✅ Tests automatisés

### v2.3.0 (2025-10-28)
- Import Wizard V3

### v2.2.0 (2025-10-20)
- Cartes thématiques

### v2.1.0 (2025-10-15)
- Panneau droit unifié
