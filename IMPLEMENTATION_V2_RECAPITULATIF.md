# Récapitulatif Implémentation Atlas UI v2.0

**Date**: 27 octobre 2025  
**Statut**: Backend complet ✅ | Frontend en cours ⏳

---

## ✅ BACKEND COMPLÉTÉ

### 1. Fonctions SQL Créées

#### `fn_granulo_indices(points JSONB)`
- **Fichier**: `sql/fn_granulo_indices.sql`
- **Fonction**: Calcule D10, D30, D60, Cu, Cc depuis une courbe granulométrique
- **Méthode**: Interpolation log-linéaire
- **Statut**: ✅ Appliqué en base

#### `fn_classify_uscs(wl, ip, fines_pct, d10, cu, cc)`
- **Fichier**: `sql/fn_classify_uscs.sql`
- **Fonction**: Classification USCS (ML, CL, CH, MH, SW, SP, SM, SC)
- **Statut**: ✅ Appliqué en base

#### `fn_classify_aashto(wl, ip, fines_pct, passant_2mm)`
- **Fichier**: `sql/fn_classify_aashto.sql`
- **Fonction**: Classification AASHTO/HRB (A-1 à A-7)
- **Statut**: ✅ Appliqué en base

#### `v_samples_complete`
- **Fichier**: `sql/v_samples_complete.sql`
- **Fonction**: Vue complète des essais avec:
  - Atterberg (WL, WP, IP, zone, plasticité)
  - VBS (valeur, argilosité)
  - Granulométrie (passants, indices D10/D30/D60/Cu/Cc, courbe)
  - Proctor (γd max, wopt, type)
  - Gonflement (Eg, risque)
  - Classifications (USCS, AASHTO, GTR)
- **Statut**: ✅ Créée en base

### 2. API Rust - Nouveau Endpoint

#### `GET /cells/{code}/complete`
- **Fichier**: `services/api-geo/src/cells_labs.rs`
- **Route ajoutée**: `main.rs` ligne 89
- **Réponse**:
```json
{
  "kpi": {
    "n_sondages": 1,
    "n_echantillons": 3,
    "n_essais": 21,
    "pct_spread": 100.0,
    "depth_max_m": 2.0,
    "updated_at": "2025-10-27T..."
  },
  "overview": {
    "atterberg": [...],
    "vbs": [...],
    "granulo": [],
    "depth_hist": [...]
  },
  "samples": [
    {
      "id": "uuid",
      "depth_m": 1.0,
      "atterberg": {"wl": 42, "wp": 22, "ip": 20, "zone": "CL", "plasticite": "Moyenne"},
      "vbs": {"vbs": 3.1, "argilosite": "Moyenne"},
      "granulo": {
        "passant_80um": 52.3,
        "passant_2mm": 88.1,
        "indices": {"d10": 0.09, "d30": 0.23, "d60": 0.55, "cu": 6.1, "cc": 1.07},
        "points": [...]
      },
      "proctor": {"gamma_d_max": 17.8, "w_opt": 13.5, "type": "normal"},
      "swelling": {"eg": 2.1, "risque": "Moyen"},
      "classif": {"uscs": "CL", "aashto": "A-4", "gtr": "A"}
    }
  ],
  "surveys": [...],
  "source_surveys": [...]
}
```
- **Statut**: ✅ Code ajouté, en cours de build

---

## ⏳ FRONTEND À IMPLÉMENTER

### 1. Panneau Gauche - Onglets (Priorité 1)

#### Structure HTML
```html
<div id="mailleDetails" class="panel-left">
  <!-- En-tête -->
  <div class="panel-header">
    <h3>📍 <span id="ficheCode">TG-0496-0212-01</span></h3>
    <span id="ficheStatus">✅ avec données</span>
  </div>
  
  <!-- KPIs -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <span class="kpi-label">Sondages</span>
      <span class="kpi-value" id="kpiSondages">1</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Échantillons</span>
      <span class="kpi-value" id="kpiEchantillons">3</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Essais</span>
      <span class="kpi-value" id="kpiEssais">21</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">% Spread</span>
      <span class="kpi-value" id="kpiSpread">100%</span>
    </div>
  </div>
  
  <!-- Alerte Spread -->
  <div id="spreadAlert" class="alert-spread" style="display:none">
    🔄 Valeurs agrégées depuis <strong id="spreadSource">Davie (TG030805)</strong> — diffusion ADM3
  </div>
  
  <!-- Onglets -->
  <div class="tabs">
    <button class="tab active" data-tab="overview">📊 Vue</button>
    <button class="tab" data-tab="essais">🔬 Essais</button>
    <button class="tab" data-tab="sondages">📋 Sondages</button>
    <button class="tab" data-tab="classif">🏷️ Classification</button>
  </div>
  
  <!-- Contenu Onglet 1: Vue d'ensemble -->
  <div class="tab-content active" id="tab-overview">
    <div class="charts-section">
      <canvas id="chartAtterberg"></canvas>
      <canvas id="chartVBS"></canvas>
      <canvas id="chartGranulo"></canvas>
      <canvas id="chartDepth"></canvas>
    </div>
    
    <div class="stats-section">
      <h4>Statistiques agrégées</h4>
      <div id="statsContent"></div>
    </div>
  </div>
  
  <!-- Contenu Onglet 2: Essais détaillés -->
  <div class="tab-content" id="tab-essais">
    <div class="essais-header">
      <button class="btn-sm" id="expandAll">Déployer tout</button>
      <button class="btn-sm" id="collapseAll">Replier tout</button>
    </div>
    
    <div id="essaisList" class="essais-list">
      <!-- Accordéons par échantillon -->
    </div>
  </div>
  
  <!-- Contenu Onglet 3: Sondages -->
  <div class="tab-content" id="tab-sondages">
    <div id="sondagesList"></div>
  </div>
  
  <!-- Contenu Onglet 4: Classification -->
  <div class="tab-content" id="tab-classif">
    <canvas id="chartCasagrande"></canvas>
    <canvas id="chartUSCSPie"></canvas>
    <div id="classifRules"></div>
  </div>
</div>
```

#### JavaScript (main.ts)
```typescript
// Fonction pour charger les données complètes
async function loadCellComplete(code: string) {
  const res = await fetch(`${API_GEO}/cells/${code}/complete`)
  const data = await res.json()
  
  // Afficher KPIs
  document.getElementById('kpiSondages').textContent = data.kpi.n_sondages
  document.getElementById('kpiEchantillons').textContent = data.kpi.n_echantillons
  document.getElementById('kpiEssais').textContent = data.kpi.n_essais
  document.getElementById('kpiSpread').textContent = `${data.kpi.pct_spread.toFixed(0)}%`
  
  // Alerte Spread
  if (data.kpi.pct_spread > 99 && data.source_surveys.length > 0) {
    const alert = document.getElementById('spreadAlert')
    const source = data.source_surveys[0]
    document.getElementById('spreadSource').textContent = 
      `${source.code_site} (${source.adm3_code})`
    alert.style.display = 'block'
  }
  
  // Rendre les onglets
  renderOverview(data.overview)
  renderEssais(data.samples)
  renderSondages(data.surveys, data.source_surveys)
  renderClassification(data.samples)
}

// Onglet Essais détaillés
function renderEssais(samples: any[]) {
  const list = document.getElementById('essaisList')
  list.innerHTML = samples.map((s, idx) => `
    <div class="essai-item">
      <div class="essai-header" onclick="toggleEssai(${idx})">
        <strong>Profondeur: ${s.depth_m}m</strong>
        <span>▼</span>
      </div>
      <div class="essai-content" id="essai-${idx}">
        ${renderEssaiDetails(s)}
      </div>
    </div>
  `).join('')
}

function renderEssaiDetails(sample: any) {
  let html = ''
  
  // Atterberg
  if (sample.atterberg) {
    const a = sample.atterberg
    html += `
      <div class="essai-group">
        <h5>Atterberg</h5>
        <table>
          <tr><td>WL:</td><td>${a.wl}%</td></tr>
          <tr><td>WP:</td><td>${a.wp}%</td></tr>
          <tr><td>IP:</td><td>${a.ip}%</td></tr>
          <tr><td>Zone:</td><td><span class="badge-zone">${a.zone}</span></td></tr>
          <tr><td>Plasticité:</td><td>${a.plasticite}</td></tr>
        </table>
      </div>
    `
  }
  
  // VBS
  if (sample.vbs) {
    const v = sample.vbs
    html += `
      <div class="essai-group">
        <h5>VBS</h5>
        <table>
          <tr><td>VBS:</td><td>${v.vbs} g/100g</td></tr>
          <tr><td>Argilosité:</td><td>${v.argilosite}</td></tr>
        </table>
      </div>
    `
  }
  
  // Granulométrie
  if (sample.granulo) {
    const g = sample.granulo
    html += `
      <div class="essai-group">
        <h5>Granulométrie</h5>
        <table>
          <tr><td>Passant 80µm:</td><td>${g.passant_80um}%</td></tr>
          <tr><td>Passant 2mm:</td><td>${g.passant_2mm}%</td></tr>
          ${g.indices ? `
            <tr><td>D10:</td><td>${g.indices.d10} mm</td></tr>
            <tr><td>D30:</td><td>${g.indices.d30} mm</td></tr>
            <tr><td>D60:</td><td>${g.indices.d60} mm</td></tr>
            <tr><td>Cu:</td><td>${g.indices.cu}</td></tr>
            <tr><td>Cc:</td><td>${g.indices.cc}</td></tr>
          ` : ''}
        </table>
        ${g.points ? `<button class="btn-sm" onclick="showGranuloChart(${JSON.stringify(g.points)})">📊 Voir courbe</button>` : ''}
      </div>
    `
  }
  
  // Proctor
  if (sample.proctor) {
    const p = sample.proctor
    html += `
      <div class="essai-group">
        <h5>Proctor</h5>
        <table>
          <tr><td>γd max:</td><td>${p.gamma_d_max} kN/m³</td></tr>
          <tr><td>wopt:</td><td>${p.w_opt}%</td></tr>
          <tr><td>Type:</td><td>${p.type}</td></tr>
        </table>
      </div>
    `
  }
  
  // Gonflement
  if (sample.swelling) {
    const sw = sample.swelling
    html += `
      <div class="essai-group">
        <h5>Gonflement</h5>
        <table>
          <tr><td>Eg:</td><td>${sw.eg}%</td></tr>
          <tr><td>Risque:</td><td><span class="badge-risk-${sw.risque.toLowerCase()}">${sw.risque}</span></td></tr>
        </table>
      </div>
    `
  }
  
  // Classifications
  if (sample.classif) {
    const c = sample.classif
    html += `
      <div class="essai-group">
        <h5>Classifications</h5>
        <table>
          <tr><td>USCS:</td><td><span class="badge-uscs">${c.uscs}</span></td></tr>
          <tr><td>AASHTO:</td><td><span class="badge-aashto">${c.aashto}</span></td></tr>
          <tr><td>GTR:</td><td><span class="badge-gtr">${c.gtr}</span></td></tr>
        </table>
      </div>
    `
  }
  
  return html
}
```

#### CSS
```css
/* Onglets */
.tabs {
  display: flex;
  gap: 4px;
  margin: 16px 0;
  border-bottom: 2px solid var(--border);
}

.tab {
  padding: 10px 16px;
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}

.tab:hover {
  color: var(--text);
  background: var(--panel-hover);
}

.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.tab-content {
  display: none;
  padding: 16px 0;
}

.tab-content.active {
  display: block;
}

/* Alerte Spread */
.alert-spread {
  background: #ff9f4322;
  border-left: 4px solid #ff9f43;
  padding: 12px;
  margin: 12px 0;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text);
}

/* Essais */
.essai-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 8px;
}

.essai-header {
  padding: 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  background: var(--panel-hover);
}

.essai-header:hover {
  background: var(--panel-active);
}

.essai-content {
  display: none;
  padding: 12px;
}

.essai-content.open {
  display: block;
}

.essai-group {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.essai-group:last-child {
  border-bottom: none;
}

.essai-group h5 {
  margin: 0 0 8px 0;
  color: var(--accent);
  font-size: 12px;
  text-transform: uppercase;
}

.essai-group table {
  width: 100%;
  font-size: 12px;
}

.essai-group table td:first-child {
  color: var(--muted);
  width: 40%;
}

/* Badges */
.badge-zone {
  background: var(--accent);
  color: var(--bg);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.badge-risk-faible {
  background: #0bb07b22;
  color: #0bb07b;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.badge-risk-moyen {
  background: #ff9f4322;
  color: #ff9f43;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.badge-risk-fort {
  background: #ef476f22;
  color: #ef476f;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.badge-uscs, .badge-aashto, .badge-gtr {
  background: var(--accent);
  color: var(--bg);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
```

---

## 📋 TODO LISTE

### Backend
- [x] Fonctions SQL granulométrie
- [x] Fonctions SQL classification
- [x] Vue v_samples_complete
- [x] Endpoint /cells/{code}/complete
- [ ] Build API Rust (en cours)
- [ ] Restart API

### Frontend
- [ ] Créer structure onglets HTML
- [ ] Implémenter système d'onglets JS
- [ ] Onglet Vue d'ensemble
- [ ] Onglet Essais détaillés
- [ ] Onglet Sondages
- [ ] Onglet Classification
- [ ] CSS pour onglets et badges
- [ ] Build UI
- [ ] Test complet

### Suggestions de géocodage (Phase 2)
- [ ] Radio par candidat
- [ ] Bouton "Accepter & diffuser"
- [ ] Prévisualisation ADM3
- [ ] Actions groupées

### Modale géocodage (Phase 2)
- [ ] 4 onglets (Coordonnées, ADM3, Grille, Clic carte)
- [ ] Mode pick sur carte
- [ ] Validation et preview

---

## 🚀 Commandes de Build

```powershell
# Backend
docker compose build api-geo
docker compose up -d api-geo

# Frontend
cd ui
npm run build
cd ..

# Vérifier
Invoke-RestMethod http://localhost:8000/cells/TG-0496-0212-01/complete | ConvertTo-Json -Depth 5
```

---

## 📊 Statut Global

**Backend**: 95% ✅  
**Frontend**: 20% ⏳  
**Tests**: 0% ❌  

**Estimation temps restant**: 4-6 heures pour frontend complet
