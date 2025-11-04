# 🎯 AMÉLIORATIONS RECOMMANDÉES - Panneau QGIS v2.5.0

**Complément de**: `REFACTOR_PANEL_QGIS_PR2-5.md`

---

## 🔝 TOP 10 PRIORITÉS (Haut Impact / Faible Risque)

### 1. Badge Dynamique Suggestions (PR5)
**Impact**: UX + Visibilité  
**Effort**: 30 min

```typescript
// Dans initTabsPanel() après manager.init()
async function refreshBadge() {
  try {
    const { suggestions_pending } = await httpJSON<{suggestions_pending:number}>('/geocode/stats');
    const btn = document.querySelector('[data-tab-id="geocode"] .tab-badge') as HTMLElement | null;
    if (btn) btn.textContent = suggestions_pending > 0 ? String(suggestions_pending) : '';
  } catch {}
}

bus.on('suggestion:changed', () => refreshBadge());
setInterval(refreshBadge, 60000); // Poll 60s
refreshBadge();
```

---

### 2. Event Bus Typé (PR1)
**Impact**: Architecture + Cleanup  
**Effort**: 45 min

**Créer `src/utils/event-bus.ts`**:

```typescript
type Events = {
  'survey:created': { id: string };
  'survey:updated': { id: string };
  'survey:geocoded': { id: string };
  'suggestion:changed': { pending: number };
  'tab:changed': { from: string; to: string };
};

type Handler<T> = (payload: T) => void;

export const bus = (() => {
  const handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};

  return {
    on<K extends keyof Events>(type: K, fn: Handler<Events[K]>) {
      (handlers[type] ??= new Set()).add(fn);
      return () => handlers[type]!.delete(fn); // Cleanup function
    },
    
    emit<K extends keyof Events>(type: K, payload: Events[K]) {
      handlers[type]?.forEach(h => h(payload));
    },
    
    clear() {
      (Object.keys(handlers) as (keyof Events)[]).forEach(k => handlers[k]?.clear());
    }
  };
})();
```

**Usage**:
```typescript
// Émettre
bus.emit('survey:created', { id: 'abc123' });

// Écouter avec cleanup
const cleanup = bus.on('survey:created', ({ id }) => {
  console.log('Survey created:', id);
  refreshList();
});

// Cleanup automatique au unmount
return { unmount: cleanup };
```

---

### 3. Sync Onglet ↔ URL (PR2)
**Impact**: Deep-linking + Partage  
**Effort**: 30 min

**Créer `src/utils/url-params.ts`**:

```typescript
export function getParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

export function setParam(key: string, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  return url.pathname + url.search;
}
```

**Dans `tab-manager.ts`**:

```typescript
import { getParam, setParam } from '../utils/url-params';

// Au démarrage (dans init)
function loadState() {
  const urlTab = getParam('tab');
  if (urlTab && tabs.some(t => t.id === urlTab)) {
    state.activeTab = urlTab as TabId;
    return;
  }
  
  // Sinon localStorage
  try {
    const saved = localStorage.getItem(CONFIG.storage.tabStateKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.version === '2.5.0' && tabs.some(t => t.id === parsed.activeTab)) {
        state.activeTab = parsed.activeTab;
      }
    }
  } catch {}
}

// À chaque changement d'onglet (dans switchTo)
history.replaceState(null, '', setParam('tab', tabId));
```

---

### 4. HTTP Wrapper + AbortController (PR1)
**Impact**: Robustesse + Performance  
**Effort**: 1h

**Créer `src/utils/http.ts`**:

```typescript
export class HttpError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
    this.name = 'HttpError';
  }
}

export function httpJSON<T>(
  input: RequestInfo,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 15000);

  return fetch(input, {
    ...init,
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
    .then(async (r) => {
      clearTimeout(timeout);
      const contentType = r.headers.get('content-type');
      const data = contentType?.includes('application/json')
        ? await r.json()
        : await r.text();

      if (!r.ok) {
        const message =
          typeof data === 'string'
            ? data
            : data?.message || `HTTP ${r.status}`;
        throw new HttpError(r.status, message);
      }

      return data as T;
    })
    .catch((err) => {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new HttpError(0, 'Request timeout');
      }
      throw err;
    });
}
```

**Utiliser dans `geocode-api.ts`**:

```typescript
import { httpJSON } from '../utils/http';

export async function fetchSurveysWithoutGeom(): Promise<SurveyToGeocode[]> {
  return httpJSON('/surveys/ungeocode');
}

export async function geocodeSurvey(payload: GeocodePayload): Promise<void> {
  await httpJSON(`/surveys/${payload.survey_id}/geocode`, {
    method: 'POST',
    body: JSON.stringify({ method: payload.method, ...payload.data }),
  });
}
```

---

### 5. Toasts Non-Bloquants (PR1)
**Impact**: UX  
**Effort**: 1h

**Créer `src/ui/toast.ts`**:

```typescript
type ToastType = 'success' | 'error' | 'info';

let container: HTMLElement | null = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function show(message: string, type: ToastType, duration = 3000) {
  const c = ensureContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  c.appendChild(toast);
  
  // Animate in
  setTimeout(() => toast.classList.add('toast-show'), 10);
  
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export const toast = {
  success: (msg: string) => show(msg, 'success'),
  error: (msg: string) => show(msg, 'error'),
  info: (msg: string) => show(msg, 'info'),
};
```

**CSS dans `tabs.css`**:

```css
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toast {
  min-width: 300px;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  color: white;
  font-size: 14px;
  opacity: 0;
  transform: translateX(400px);
  transition: all 0.3s ease;
}

.toast-show {
  opacity: 1;
  transform: translateX(0);
}

.toast-success { background: #0bb07b; }
.toast-error { background: #ff6b6b; }
.toast-info { background: #3aa6ff; }
```

**Remplacer `alert()` par `toast`**:

```typescript
// Avant
alert('✅ Sondage créé!');

// Après
toast.success('Sondage créé!');
```

---

### 6. Validation Locale Lat/Lon & ADM (PR4)
**Impact**: UX + Réduction erreurs serveur  
**Effort**: 30 min

```typescript
// Dans geocode-drawer.ts
const TOGO_BBOX = {
  lat: { min: 5.8, max: 11.5 },
  lon: { min: -0.2, max: 1.9 },
};

function validateCoordinates(lat: number, lon: number): string | null {
  if (lat < TOGO_BBOX.lat.min || lat > TOGO_BBOX.lat.max) {
    return `Latitude hors limites (${TOGO_BBOX.lat.min} à ${TOGO_BBOX.lat.max})`;
  }
  if (lon < TOGO_BBOX.lon.min || lon > TOGO_BBOX.lon.max) {
    return `Longitude hors limites (${TOGO_BBOX.lon.min} à ${TOGO_BBOX.lon.max})`;
  }
  return null;
}

// Dans handleSave()
if (mode === 'exact') {
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  
  const error = validateCoordinates(lat, lon);
  if (error) {
    toast.error(error);
    return;
  }
  // ...
}
```

---

### 7. Pagination Liste Sondages (PR3)
**Impact**: Performance si >1000 sondages  
**Effort**: 2h

```typescript
// Dans tab-liste-sondages.ts
interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

let pagination: PaginationState = {
  page: 1,
  limit: 100,
  total: 0,
};

async function loadSurveys() {
  const offset = (pagination.page - 1) * pagination.limit;
  const url = `/surveys?limit=${pagination.limit}&offset=${offset}`;
  
  const response = await httpJSON<{ data: Survey[]; total: number }>(url);
  surveys = response.data;
  pagination.total = response.total;
  
  renderTable();
  renderPagination();
}

function renderPagination() {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  // Render pagination controls...
}
```

---

### 8. Accessibilité Renforcée (PR2-5)
**Impact**: A11y + Conformité  
**Effort**: 1h

**Focus Trap pour Modal/Drawer**:

```typescript
function trapFocus(container: HTMLElement) {
  const focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0] as HTMLElement;
  const last = focusable[focusable.length - 1] as HTMLElement;
  
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  
  container.addEventListener('keydown', handler);
  first.focus();
  
  return () => container.removeEventListener('keydown', handler);
}
```

**ARIA Live pour Toasts**:

```html
<div class="toast-container" role="status" aria-live="polite" aria-atomic="true">
```

---

### 9. MSW + Playwright (Tests)
**Impact**: Qualité + CI/CD  
**Effort**: 4h

**MSW Setup** (`tests/mocks/handlers.ts`):

```typescript
import { rest } from 'msw';

export const handlers = [
  rest.get('/surveys/ungeocode', (req, res, ctx) => {
    return res(ctx.json([
      { id: '1', code: 'TEST1', source: 'MOCK', has_geom: false },
    ]));
  }),
  
  rest.get('/geocode/stats', (req, res, ctx) => {
    return res(ctx.json({ suggestions_pending: 3 }));
  }),
];
```

**Playwright Test** (`e2e/geocode.spec.ts`):

```typescript
test('Géocoder un sondage', async ({ page }) => {
  await page.goto('/?tab=geocode');
  
  // Cliquer sur "Géocoder"
  await page.click('button:has-text("🗺️ Géocoder")');
  
  // Drawer ouvert
  await expect(page.locator('.geocode-drawer')).toBeVisible();
  
  // Saisir coordonnées
  await page.fill('#geocode-lat', '6.5');
  await page.fill('#geocode-lon', '1.2');
  
  // Enregistrer
  await page.click('button:has-text("Enregistrer")');
  
  // Toast succès
  await expect(page.locator('.toast-success')).toBeVisible();
});
```

---

### 10. Kill-Switch localStorage (PR1)
**Impact**: Debug + Test en prod  
**Effort**: 15 min

```typescript
// Dans config.ts
export const CONFIG = {
  features: {
    get uiPanelTabs() {
      // Override localStorage pour test en prod
      const override = localStorage.getItem('atlas_ui_tabs');
      if (override === 'on') return true;
      if (override === 'off') return false;
      
      // Sinon valeur par défaut
      return false; // ← false jusqu'à PR4
    },
  },
};
```

**Usage**:
```javascript
// Console navigateur pour activer
localStorage.setItem('atlas_ui_tabs', 'on');
location.reload();
```

---

## 📋 CHECKLIST API (Vérifications)

### Endpoints Requis

- [ ] `GET /surveys` - Support `?q=&mode=&has_geom=&limit=&offset=`
- [ ] `GET /surveys/ungeocode` - Liste sondages sans géométrie
- [ ] `POST /surveys/{id}/geocode` - Body: `{ method, latitude?, longitude?, adm_level?, adm_code? }`
- [ ] `GET /adm3` - Liste zones ADM3 (cache 1h côté UI)
- [ ] `POST /geocode/suggestions` - Body: `{ status: 'pending' }`
- [ ] `PATCH /geocode/suggestions/{id}` - Body: `{ status, adm3_code_override? }`
- [ ] `POST /geocode/apply-accepted` - Retour: `{ updated: number }`
- [ ] `GET /geocode/stats` - Retour: `{ suggestions_pending, ... }`

---

## 🎨 Styling Complémentaire

Ajouter dans `tabs.css`:

```css
/* Boutons génériques */
.btn-primary, .btn-secondary {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary {
  background: var(--primary, #3aa6ff);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2a96ef;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  color: var(--tab-text-primary);
  border: 1px solid var(--tab-border);
}

.btn-secondary:hover {
  background: var(--tab-bg-hover);
}

/* Table compacte */
.data-table-compact {
  font-size: 12px;
}

.data-table-compact th,
.data-table-compact td {
  padding: 8px 12px;
}

/* États */
:root {
  --color-success: #0bb07b;
  --color-warning: #ff9f43;
  --color-error: #ff6b6b;
  --color-info: #3aa6ff;
}
```

---

## ⚠️ RISQUES & MITIGATION

| Risque | Mitigation |
|--------|-----------|
| **Régression UI** | Feature flag OFF par défaut jusqu'à PR4 |
| **Couplage API** | `geocode-api.ts` = unique point d'accès |
| **Performance table** | Pagination serveur si >1k lignes |
| **Cache invalide** | Versionner localStorage (`{version:'2.5.0', ...}`) |
| **Race conditions** | AbortController + debounce |

---

**✅ DOCUMENTATION AMÉLIORÉE - PRÊTE POUR IMPLÉMENTATION**
