# Proposition: Désactivation propre des fonctionnalités 28km

## Contexte

Les mailles 28km sont des profils régionaux qui agrègent les données de plusieurs mailles 2km. Certaines fonctionnalités avancées (cartes thématiques, analyse des voisins) ne sont pas pertinentes ou pas encore implémentées pour ce niveau d'agrégation.

## Objectif

Désactiver de manière **propre et durable** les fonctionnalités suivantes pour les grilles 28km :
1. **Cartes thématiques** (interpolation, classification)
2. **Analyse des voisins** (déjà fonctionnel mais peut être limité)

## Approche recommandée

### 1. Backend API - Validation et messages clairs

#### Endpoint `/thematic/data`
```rust
// Dans services/api-geo/src/thematic/mod.rs

pub async fn get_thematic_data(
    Query(params): Query<ThematicParams>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    // Vérifier le niveau de grille
    if params.grid_level == Some("28km".to_string()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "thematic_not_supported_28km",
                "message": "Les cartes thématiques ne sont pas disponibles pour les grilles 28km. Utilisez la grille 2km pour l'analyse thématique détaillée.",
                "suggestion": "Passez à la grille 2km pour accéder aux cartes thématiques"
            }))
        ).into_response();
    }
    
    // Suite du code normal pour 2km...
}
```

#### Endpoint `/grid/{code}/neighbors`
```rust
// Dans services/api-geo/src/neighbors.rs

pub async fn get_neighbors(
    Path(code): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    // Détecter si c'est une maille 28km (code commence par un chiffre simple)
    let is_28km = code.chars().next()
        .map(|c| c.is_numeric() && code.len() < 10)
        .unwrap_or(false);
    
    if is_28km {
        // Option 1: Retourner un tableau vide avec message
        return Json(serde_json::json!({
            "neighbors": [],
            "message": "L'analyse des voisins n'est pas disponible pour les mailles 28km",
            "grid_level": "28km"
        })).into_response();
        
        // Option 2: Implémenter quand même (déjà fonctionnel)
        // Continuer normalement...
    }
    
    // Suite du code...
}
```

### 2. Frontend UI - Messages utilisateur clairs

#### Panneau thématique
```typescript
// Dans ui/src/thematic/thematic-panel.ts

private attachEventListeners() {
    // Bouton "Appliquer" - vérifier le niveau de grille
    this.elements.applyButton?.addEventListener('click', async () => {
        const gridLevel = (window as any).currentGridLevel || '2km';
        
        if (gridLevel === '28km') {
            this.toast('⚠️ Cartes thématiques non disponibles pour grille 28km. Passez à la grille 2km.', 'warn');
            return;
        }
        
        await this.applyThematic();
    });
    
    // Désactiver visuellement les contrôles si 28km
    (window as any).setGridLevel = (level: '2km' | '28km') => {
        const isDisabled = level === '28km';
        
        // Désactiver tous les contrôles du panneau thématique
        const thematicPanel = document.getElementById('thematicPanel');
        if (thematicPanel) {
            const inputs = thematicPanel.querySelectorAll('input, select, button');
            inputs.forEach(el => {
                (el as HTMLInputElement).disabled = isDisabled;
            });
            
            // Afficher un message d'information
            let notice = thematicPanel.querySelector('.grid-28km-notice');
            if (isDisabled && !notice) {
                notice = document.createElement('div');
                notice.className = 'grid-28km-notice';
                notice.innerHTML = `
                    <div style="padding:12px;background:#f9731622;border-left:3px solid #f97316;border-radius:4px;margin-bottom:12px">
                        <div style="font-weight:600;color:#f97316;margin-bottom:4px">
                            ⚠️ Grille 28km sélectionnée
                        </div>
                        <div style="font-size:12px;color:#cbd5e1">
                            Les cartes thématiques ne sont disponibles que pour la grille 2km.
                            Passez à la grille 2km pour accéder à cette fonctionnalité.
                        </div>
                    </div>
                `;
                thematicPanel.insertBefore(notice, thematicPanel.firstChild);
            } else if (!isDisabled && notice) {
                notice.remove();
            }
        }
    };
}
```

#### Section voisins
```typescript
// Dans ui/src/main.ts - fonction loadNeighbors

async function loadNeighbors(mailleCode: string) {
    const neighborsEl = document.getElementById('neighbors');
    if (!neighborsEl) return;
    
    // Détecter si c'est une maille 28km
    const is28km = /^\d{1,3}$/.test(mailleCode);
    
    if (is28km) {
        neighborsEl.innerHTML = `
            <div style="padding:12px;background:#64748b22;border-radius:6px;text-align:center">
                <div style="color:#94a3b8;font-size:12px">
                    ℹ️ L'analyse des voisins n'est pas disponible pour les mailles 28km
                </div>
            </div>
        `;
        return;
    }
    
    // Suite du code normal pour 2km...
}
```

### 3. CSS - Styles pour les messages

```css
/* Dans ui/index.html ou fichier CSS */

.grid-28km-notice {
    animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Désactivation visuelle */
.thematic-panel[data-grid="28km"] input,
.thematic-panel[data-grid="28km"] select,
.thematic-panel[data-grid="28km"] button {
    opacity: 0.5;
    cursor: not-allowed;
}
```

## Avantages de cette approche

### ✅ Propre
- Messages clairs et explicites
- Pas de comportement silencieux
- Code bien documenté

### ✅ Durable
- Validation côté backend (sécurité)
- Validation côté frontend (UX)
- Facile à maintenir et étendre

### ✅ Évolutif
- Facile d'activer plus tard si implémenté
- Messages peuvent être traduits
- Peut être configuré par feature flag

## Implémentation recommandée

### Phase 1: Backend (30 min)
1. Ajouter validation dans `/thematic/data`
2. Ajouter message dans `/grid/{code}/neighbors` (optionnel)
3. Tests unitaires

### Phase 2: Frontend (45 min)
1. Désactivation panneau thématique si 28km
2. Message dans section voisins
3. Styles CSS

### Phase 3: Tests (15 min)
1. Test manuel: sélectionner maille 28km
2. Vérifier messages clairs
3. Vérifier que 2km fonctionne normalement

## Alternative: Feature flags

Pour une approche encore plus flexible :

```typescript
// ui/src/config.ts
export const FEATURES = {
    THEMATIC_28KM: false,  // Désactivé pour l'instant
    NEIGHBORS_28KM: true,  // Activé (déjà implémenté)
};

// Utilisation
if (!FEATURES.THEMATIC_28KM && gridLevel === '28km') {
    // Désactiver...
}
```

## Conclusion

Cette approche garantit :
- **Clarté** pour l'utilisateur (messages explicites)
- **Maintenabilité** du code (validation centralisée)
- **Évolutivité** (facile d'activer plus tard)
- **Cohérence** entre backend et frontend

Recommandation: **Implémenter cette approche** plutôt qu'une désactivation silencieuse.
