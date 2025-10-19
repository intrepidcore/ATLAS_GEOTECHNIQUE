<script lang="ts">
  import { importBulkStore, importBulkActions } from '../../stores/import-bulk-store';

  $: geolocation = $importBulkStore.geolocation;
  $: mapping = $importBulkStore.mapping;

  const modes = [
    {
      value: 'exact',
      label: 'Coordonnées exactes',
      description: 'Utiliser les colonnes longitude/latitude du fichier',
      icon: '🎯',
      requires: ['longitude', 'latitude'],
    },
    {
      value: 'centroid',
      label: 'Centroïde zone administrative',
      description: 'Calculer le centre géométrique de la commune (ADM3)',
      icon: '📍',
      requires: ['adm3', 'adm2'],
    },
    {
      value: 'random',
      label: 'Point aléatoire déterministe',
      description: 'Générer un point aléatoire dans la zone avec seed reproductible',
      icon: '🎲',
      requires: ['adm3', 'adm2'],
      configurable: true,
    },
    {
      value: 'maille',
      label: 'Centroïde maille de grille',
      description: 'Utiliser le centre d\'une cellule de grille pré-définie',
      icon: '🗺️',
      requires: ['maille_code'],
    },
    {
      value: 'unknown',
      label: 'Pas de coordonnées',
      description: 'Stocker uniquement les informations administratives sans géolocalisation',
      icon: '❓',
      requires: [],
    },
  ];

  function handleModeChange(mode: string) {
    const config: any = { mode };

    // Reset config options when changing mode
    if (mode !== 'random') {
      config.seed = undefined;
      config.jitter_radius = undefined;
    } else {
      // Default values for random mode
      config.seed = config.seed || Math.floor(Math.random() * 10000);
      config.jitter_radius = config.jitter_radius || 400;
    }

    importBulkActions.setGeolocation(config);
  }

  function handleSeedChange(value: number) {
    importBulkActions.setGeolocation({ seed: value });
  }

  function handleJitterChange(value: number) {
    importBulkActions.setGeolocation({ jitter_radius: value });
  }

  function generateNewSeed() {
    const newSeed = Math.floor(Math.random() * 100000);
    handleSeedChange(newSeed);
  }

  function canUseMode(mode: any): boolean {
    if (mode.requires.length === 0) return true;

    return mode.requires.some((req: string) => mapping[req] !== undefined);
  }

  $: validationWarnings = getValidationWarnings(geolocation.mode, mapping);

  function getValidationWarnings(mode: string, m: any): string[] {
    const warnings: string[] = [];

    switch (mode) {
      case 'exact':
        if (!m.longitude) warnings.push('Colonne longitude non mappée');
        if (!m.latitude) warnings.push('Colonne latitude non mappée');
        break;
      case 'centroid':
      case 'random':
        if (!m.adm3 && !m.adm2) {
          warnings.push('ADM3 ou ADM2 requis pour calculer la position');
        }
        break;
      case 'maille':
        if (!m.maille_code) {
          warnings.push('Colonne code maille non mappée');
        }
        break;
    }

    return warnings;
  }
</script>

<div class="geolocation-step">
  <h2>Étape 3 : Configuration de la géolocalisation</h2>

  <p class="step-description">
    Choisissez la méthode pour déterminer les coordonnées géographiques des sondages.
  </p>

  <div class="modes-grid">
    {#each modes as mode}
      {@const isAvailable = canUseMode(mode)}
      {@const isSelected = geolocation.mode === mode.value}

      <label
        class="mode-card"
        class:selected={isSelected}
        class:disabled={!isAvailable}
      >
        <input
          type="radio"
          name="geolocation_mode"
          value={mode.value}
          checked={isSelected}
          disabled={!isAvailable}
          on:change={() => handleModeChange(mode.value)}
        />

        <div class="mode-icon">{mode.icon}</div>

        <div class="mode-content">
          <strong>{mode.label}</strong>
          <p class="mode-description">{mode.description}</p>

          {#if !isAvailable}
            <p class="mode-unavailable">
              ⚠️ Champs requis non mappés : {mode.requires.join(', ')}
            </p>
          {/if}

          {#if isSelected && mode.configurable}
            <div class="mode-config" on:click|stopPropagation>
              <div class="config-field">
                <label for="seed">
                  Seed aléatoire
                  <span class="help-text">Contrôle la génération aléatoire (même seed = même résultat)</span>
                </label>
                <div class="seed-input-group">
                  <input
                    id="seed"
                    type="number"
                    value={geolocation.seed || 42}
                    on:input={(e) => handleSeedChange(parseInt(e.currentTarget.value))}
                    min="0"
                    max="999999"
                  />
                  <button type="button" class="btn-regenerate" on:click={generateNewSeed}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                    </svg>
                    Nouveau
                  </button>
                </div>
              </div>

              <div class="config-field">
                <label for="jitter">
                  Rayon de dispersion (mètres)
                  <span class="help-text">Distance maximale autour du centroïde</span>
                </label>
                <div class="jitter-input-group">
                  <input
                    id="jitter"
                    type="range"
                    value={geolocation.jitter_radius || 400}
                    on:input={(e) => handleJitterChange(parseInt(e.currentTarget.value))}
                    min="50"
                    max="2000"
                    step="50"
                  />
                  <span class="jitter-value">{geolocation.jitter_radius || 400} m</span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </label>
    {/each}
  </div>

  {#if validationWarnings.length > 0}
    <div class="validation-warnings">
      <h4>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        Avertissements
      </h4>
      <ul>
        {#each validationWarnings as warning}
          <li>{warning}</li>
        {/each}
      </ul>
    </div>
  {:else}
    <div class="validation-success">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      Configuration valide !
    </div>
  {/if}

  <div class="info-panel">
    <h4>ℹ️ Informations sur les modes</h4>
    <dl>
      <dt>Mode Exact</dt>
      <dd>Utilise les coordonnées fournies dans le fichier. Aucun calcul effectué.</dd>

      <dt>Mode Centroïde</dt>
      <dd>Calcule le point central de la zone administrative (commune). Tous les sondages d'une même commune auront les mêmes coordonnées.</dd>

      <dt>Mode Aléatoire</dt>
      <dd>Génère un point aléatoire autour du centroïde. Le seed garantit la reproductibilité : même fichier + même seed = mêmes coordonnées.</dd>

      <dt>Mode Maille</dt>
      <dd>Utilise le centre d'une cellule de grille pré-définie. Utile pour les données sur grille régulière.</dd>

      <dt>Mode Inconnu</dt>
      <dd>Aucune coordonnée GPS stockée. Seules les informations administratives (région, préfecture, commune) seront enregistrées.</dd>
    </dl>
  </div>
</div>

<style>
  .geolocation-step {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  h2 {
    margin-bottom: 0.5rem;
    color: #333;
  }

  .step-description {
    margin-bottom: 2rem;
    color: #666;
    font-size: 1.05rem;
  }

  .modes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .mode-card {
    position: relative;
    display: block;
    padding: 1.5rem;
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mode-card:hover:not(.disabled) {
    border-color: #4a90e2;
    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.15);
    transform: translateY(-2px);
  }

  .mode-card.selected {
    border-color: #4a90e2;
    background: linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%);
    box-shadow: 0 6px 16px rgba(74, 144, 226, 0.25);
  }

  .mode-card.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #f5f5f5;
  }

  .mode-card input[type="radio"] {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 20px;
    height: 20px;
    cursor: pointer;
  }

  .mode-icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }

  .mode-content strong {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 1.1rem;
    color: #333;
  }

  .mode-description {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    color: #666;
    line-height: 1.5;
  }

  .mode-unavailable {
    margin: 0.75rem 0 0;
    padding: 0.5rem 0.75rem;
    background: #fff3e0;
    border-left: 3px solid #ff9800;
    border-radius: 4px;
    font-size: 0.85rem;
    color: #e65100;
  }

  .mode-config {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e0e0e0;
  }

  .config-field {
    margin-bottom: 1.25rem;
  }

  .config-field:last-child {
    margin-bottom: 0;
  }

  .config-field label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #555;
    font-size: 0.9rem;
  }

  .help-text {
    display: block;
    margin-top: 0.25rem;
    font-weight: normal;
    font-size: 0.8rem;
    color: #999;
  }

  .seed-input-group {
    display: flex;
    gap: 0.5rem;
  }

  .seed-input-group input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
  }

  .seed-input-group input:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .btn-regenerate {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.75rem 1rem;
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-regenerate:hover {
    background: #357abd;
  }

  .jitter-input-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .jitter-input-group input[type="range"] {
    flex: 1;
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
  }

  .jitter-input-group input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: #4a90e2;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .jitter-input-group input[type="range"]::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: #4a90e2;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    border: none;
  }

  .jitter-value {
    min-width: 70px;
    padding: 0.5rem 0.75rem;
    background: #f0f7ff;
    border: 1px solid #4a90e2;
    border-radius: 6px;
    text-align: center;
    font-weight: 600;
    color: #4a90e2;
    font-size: 0.9rem;
  }

  .validation-warnings {
    padding: 1.25rem;
    background: #fff3e0;
    border: 1px solid #ff9800;
    border-left: 4px solid #f57c00;
    border-radius: 8px;
    margin-bottom: 2rem;
  }

  .validation-warnings h4 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.75rem;
    color: #e65100;
    font-size: 1rem;
  }

  .validation-warnings ul {
    margin: 0;
    padding-left: 1.5rem;
    color: #e65100;
  }

  .validation-success {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem;
    background: #e8f5e9;
    border: 1px solid #66bb6a;
    border-left: 4px solid #43a047;
    border-radius: 8px;
    color: #2e7d32;
    font-weight: 500;
    margin-bottom: 2rem;
  }

  .info-panel {
    padding: 1.5rem;
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
  }

  .info-panel h4 {
    margin: 0 0 1rem;
    color: #555;
    font-size: 1rem;
  }

  .info-panel dl {
    margin: 0;
  }

  .info-panel dt {
    margin-top: 0.75rem;
    font-weight: 600;
    color: #333;
    font-size: 0.9rem;
  }

  .info-panel dd {
    margin: 0.25rem 0 0 1.5rem;
    color: #666;
    font-size: 0.875rem;
    line-height: 1.5;
  }
</style>
