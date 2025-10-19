<script lang="ts">
  import { importBulkStore, importBulkActions } from '../../stores/import-bulk-store';
  import { ImportBulkAPI } from '../../services/import-bulk-api';
  import type { MappingProfile } from '../../services/import-bulk-api';

  $: columns = $importBulkStore.columns;
  $: mapping = $importBulkStore.mapping;
  $: dataStructure = $importBulkStore.dataStructure;

  let draggedColumn: string | null = null;
  let dropTargetField: string | null = null;
  let showProfileDialog = false;
  let profiles: MappingProfile[] = [];
  let profileName = '';
  let profileDescription = '';
  let loadingProfiles = false;
  let savingProfile = false;

  interface FieldDefinition {
    key: string;
    label: string;
    description: string;
    required: boolean;
    category: 'identity' | 'location' | 'data' | 'metadata';
    conditionalRequired?: (mapping: any, structure: string) => boolean;
  }

  const fieldDefinitions: FieldDefinition[] = [
    // Identity
    { key: 'localite', label: 'Localité / Commune', description: 'Nom de la localité du sondage', required: false, category: 'identity', conditionalRequired: (m) => !m.code },
    { key: 'code', label: 'Code Sondage', description: 'Code unique du sondage', required: false, category: 'identity', conditionalRequired: (m) => !m.localite },
    { key: 'date', label: 'Date Sondage', description: 'Date de réalisation (format YYYY-MM-DD)', required: true, category: 'identity' },

    // Location
    { key: 'adm1', label: 'ADM1 (Région)', description: 'Région administrative niveau 1', required: false, category: 'location' },
    { key: 'adm2', label: 'ADM2 (Préfecture)', description: 'Préfecture administrative niveau 2', required: false, category: 'location' },
    { key: 'adm3', label: 'ADM3 (Commune)', description: 'Commune administrative niveau 3', required: false, category: 'location' },
    { key: 'maille_code', label: 'Code Maille', description: 'Code de la maille de grille', required: false, category: 'location' },
    { key: 'longitude', label: 'Longitude', description: 'Coordonnée longitude (degrés décimaux)', required: false, category: 'location' },
    { key: 'latitude', label: 'Latitude', description: 'Coordonnée latitude (degrés décimaux)', required: false, category: 'location' },

    // Data
    { key: 'type_essai', label: 'Type Essai', description: 'Type d\'essai géotechnique (Granulometrie, VBS, Atterberg, etc.)', required: true, category: 'data' },
    { key: 'profondeur_m', label: 'Profondeur (m)', description: 'Profondeur de l\'essai en mètres', required: false, category: 'data', conditionalRequired: (m, s) => s === 'long' },
    { key: 'valeur', label: 'Valeur', description: 'Valeur numérique du résultat', required: false, category: 'data', conditionalRequired: (m) => !m.analyse_qualitative },
    { key: 'unite', label: 'Unité', description: 'Unité de mesure (%, g/cm³, MPa, etc.)', required: false, category: 'data' },
    { key: 'analyse_qualitative', label: 'Analyse Qualitative', description: 'Interprétation qualitative (Faible, Moyen, Élevé, etc.)', required: false, category: 'data', conditionalRequired: (m) => !m.valeur },

    // Metadata
    { key: 'source', label: 'Source', description: 'Source des données (organisme, étude, etc.)', required: false, category: 'metadata' },
    { key: 'operator', label: 'Opérateur', description: 'Opérateur ayant réalisé le sondage', required: false, category: 'metadata' },
    { key: 'type_sol', label: 'Type Sol', description: 'Type de sol observé (Argile, Sable, etc.)', required: false, category: 'metadata' },
  ];

  const categories = {
    identity: { label: 'Identité du sondage', icon: '📋', color: '#4a90e2' },
    location: { label: 'Localisation', icon: '📍', color: '#43a047' },
    data: { label: 'Données d\'essai', icon: '📊', color: '#f4511e' },
    metadata: { label: 'Métadonnées', icon: '🏷️', color: '#8e24aa' },
  };

  let unmappedColumns: string[] = [];
  $: {
    const mapped = Object.values(mapping).filter(v => v);
    unmappedColumns = columns.filter(col => !mapped.includes(col));
  }

  // Drag & Drop handlers
  function handleDragStart(e: DragEvent, column: string) {
    draggedColumn = column;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', column);
    }
  }

  function handleDragOver(e: DragEvent, fieldKey: string) {
    e.preventDefault();
    dropTargetField = fieldKey;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDragLeave() {
    dropTargetField = null;
  }

  function handleDrop(e: DragEvent, fieldKey: string) {
    e.preventDefault();
    if (draggedColumn) {
      importBulkActions.setMapping({ [fieldKey]: draggedColumn });
    }
    draggedColumn = null;
    dropTargetField = null;
  }

  function handleDragEnd() {
    draggedColumn = null;
    dropTargetField = null;
  }

  function handleRemoveMapping(fieldKey: string) {
    importBulkActions.setMapping({ [fieldKey]: undefined });
  }

  function handleDirectSelect(fieldKey: string, value: string) {
    importBulkActions.setMapping({ [fieldKey]: value || undefined });
  }

  function handleStructureChange(structure: 'long' | 'large') {
    importBulkActions.setDataStructure(structure);

    // Si passage en Large, proposer de mapper les colonnes de profondeur
    if (structure === 'large') {
      detectDepthColumns();
    }
  }

  function detectDepthColumns() {
    const depthCols = columns.filter(col => {
      const lower = col.toLowerCase();
      return (
        /prof.*\d/.test(lower) ||
        /\d+m/.test(lower) ||
        /depth.*\d/.test(lower) ||
        /p\d+/.test(lower)
      );
    });

    if (depthCols.length > 0) {
      importBulkActions.setMapping({ profondeur_cols: depthCols });
    }
  }

  function handleAutoMap() {
    importBulkActions.autoMap(columns);
  }

  function getSuggestions(fieldKey: string): string[] {
    const fieldLower = fieldKey.toLowerCase();
    return columns.filter(col => {
      const colLower = col.toLowerCase();

      switch (fieldKey) {
        case 'localite':
          return /localit|commune|village|lieu/i.test(colLower);
        case 'code':
          return /code|id|ref/i.test(colLower) && !/maille/i.test(colLower);
        case 'date':
          return /date|jour|annee|year/i.test(colLower);
        case 'type_essai':
          return /type.*essai|essai|test.*type/i.test(colLower);
        case 'profondeur_m':
          return /profondeur|depth|prof(?!il)/i.test(colLower);
        case 'valeur':
          return /valeur|value|result|mesure/i.test(colLower);
        case 'unite':
          return /unit|unité/i.test(colLower);
        case 'analyse_qualitative':
          return /analyse|qualit|interpre|classe/i.test(colLower);
        case 'longitude':
          return /lon|lng|x/i.test(colLower) && !/lat/i.test(colLower);
        case 'latitude':
          return /lat|y/i.test(colLower) && !/lon/i.test(colLower);
        case 'adm1':
          return /adm1|région|region/i.test(colLower);
        case 'adm2':
          return /adm2|préfecture|prefecture/i.test(colLower);
        case 'adm3':
          return /adm3|commune/i.test(colLower);
        case 'source':
          return /source|origin|provenance/i.test(colLower);
        case 'operator':
          return /operator|operateur|technicien|labo/i.test(colLower);
        case 'type_sol':
          return /sol|soil|type.*sol/i.test(colLower);
        case 'maille_code':
          return /maille|grid|cell/i.test(colLower);
        default:
          return colLower.includes(fieldLower);
      }
    });
  }

  function isFieldRequired(field: FieldDefinition): boolean {
    if (field.required) return true;
    if (field.conditionalRequired) {
      return field.conditionalRequired(mapping, dataStructure);
    }
    return false;
  }

  function getFieldsByCategory(category: string): FieldDefinition[] {
    return fieldDefinitions.filter(f => f.category === category);
  }

  $: validationErrors = validateMapping(mapping, dataStructure);

  function validateMapping(m: any, structure: string): string[] {
    const errors: string[] = [];

    // Au moins localité ou code
    if (!m.localite && !m.code) {
      errors.push('Localité ou Code sondage requis');
    }

    // Date obligatoire
    if (!m.date) {
      errors.push('Date sondage requise');
    }

    // Type essai obligatoire
    if (!m.type_essai) {
      errors.push('Type essai requis');
    }

    // Profondeur requise en format Long
    if (structure === 'long' && !m.profondeur_m) {
      errors.push('Profondeur requise pour format Long');
    }

    // Valeur ou analyse qualitative
    if (!m.valeur && !m.analyse_qualitative) {
      errors.push('Valeur ou Analyse qualitative requise');
    }

    return errors;
  }

  // Profils
  async function loadProfiles() {
    loadingProfiles = true;
    try {
      profiles = await ImportBulkAPI.listProfiles();
    } catch (err: any) {
      console.error('Erreur chargement profils:', err);
    } finally {
      loadingProfiles = false;
    }
  }

  async function handleSaveProfile() {
    if (!profileName.trim()) {
      alert('Veuillez entrer un nom pour le profil');
      return;
    }

    savingProfile = true;
    try {
      await ImportBulkAPI.createProfile({
        name: profileName,
        description: profileDescription || undefined,
        mapping: mapping,
      });

      alert('Profil sauvegardé avec succès !');
      showProfileDialog = false;
      profileName = '';
      profileDescription = '';
      await loadProfiles();
    } catch (err: any) {
      alert(`Erreur sauvegarde profil: ${err.message}`);
    } finally {
      savingProfile = false;
    }
  }

  async function handleLoadProfile(profile: MappingProfile) {
    importBulkActions.setMapping(profile.mapping);

    // Tracker utilisation
    try {
      await ImportBulkAPI.useProfile(profile.id);
    } catch (err) {
      console.error('Erreur tracking profil:', err);
    }

    alert(`Profil "${profile.name}" chargé !`);
  }

  // Charger profils au montage
  import { onMount } from 'svelte';
  onMount(() => {
    loadProfiles();
  });
</script>

<div class="mapping-step">
  <div class="header">
    <h2>Étape 2 : Mapper les colonnes</h2>
    <div class="header-actions">
      <button type="button" class="btn-secondary" on:click={handleAutoMap}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
        Mapping auto
      </button>
      <button type="button" class="btn-secondary" on:click={() => showProfileDialog = true}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Sauvegarder profil
      </button>
    </div>
  </div>

  <!-- Structure selector -->
  <div class="structure-selector">
    <h3>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
      Structure des données
    </h3>
    <div class="radio-group">
      <label class="radio-card" class:selected={dataStructure === 'long'}>
        <input
          type="radio"
          name="structure"
          value="long"
          checked={dataStructure === 'long'}
          on:change={() => handleStructureChange('long')}
        />
        <div class="radio-content">
          <strong>Format Long</strong>
          <p>Une ligne par mesure</p>
          <code class="example">
            Localité | Date | Type | Prof | Valeur<br>
            Lomé | 2024-01 | VBS | 1.0 | 12.5<br>
            Lomé | 2024-01 | VBS | 2.0 | 18.3
          </code>
        </div>
      </label>
      <label class="radio-card" class:selected={dataStructure === 'large'}>
        <input
          type="radio"
          name="structure"
          value="large"
          checked={dataStructure === 'large'}
          on:change={() => handleStructureChange('large')}
        />
        <div class="radio-content">
          <strong>Format Large</strong>
          <p>Profondeurs en colonnes</p>
          <code class="example">
            Localité | Date | Type | Prof_1m | Prof_2m<br>
            Lomé | 2024-01 | VBS | 12.5 | 18.3
          </code>
        </div>
      </label>
    </div>
  </div>

  <div class="mapping-container">
    <!-- Colonnes source -->
    <div class="source-panel">
      <h3>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        Colonnes du fichier ({unmappedColumns.length}/{columns.length})
      </h3>
      <div class="columns-list">
        {#each unmappedColumns as column}
          <div
            class="column-chip"
            draggable="true"
            on:dragstart={(e) => handleDragStart(e, column)}
            on:dragend={handleDragEnd}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="3" y1="15" x2="21" y2="15"></line>
            </svg>
            {column}
          </div>
        {/each}
        {#if unmappedColumns.length === 0}
          <p class="empty-state">Toutes les colonnes sont mappées ✓</p>
        {/if}
      </div>
    </div>

    <!-- Champs cible -->
    <div class="target-panel">
      <h3>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
        Champs Atlas
      </h3>

      {#each Object.entries(categories) as [categoryKey, category]}
        <div class="field-category">
          <h4 style="color: {category.color}">
            <span class="category-icon">{category.icon}</span>
            {category.label}
          </h4>

          {#each getFieldsByCategory(categoryKey) as field}
            {@const isMapped = !!mapping[field.key]}
            {@const isRequired = isFieldRequired(field)}
            {@const suggestions = getSuggestions(field.key)}
            {@const isDropTarget = dropTargetField === field.key}

            <div
              class="field-row"
              class:mapped={isMapped}
              class:required={isRequired}
              class:drop-target={isDropTarget}
              on:dragover={(e) => handleDragOver(e, field.key)}
              on:dragleave={handleDragLeave}
              on:drop={(e) => handleDrop(e, field.key)}
            >
              <div class="field-label">
                <strong>
                  {field.label}
                  {#if isRequired}
                    <span class="required-badge">*</span>
                  {/if}
                </strong>
                <p class="field-description">{field.description}</p>
              </div>

              <div class="field-target">
                {#if isMapped}
                  <div class="mapped-chip">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>{mapping[field.key]}</span>
                    <button
                      type="button"
                      class="btn-remove-mapping"
                      on:click={() => handleRemoveMapping(field.key)}
                      title="Supprimer mapping"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                {:else}
                  <div class="drop-zone" class:active={isDropTarget}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <polyline points="19 12 12 19 5 12"></polyline>
                    </svg>
                    <span>Glissez colonne ici</span>
                  </div>

                  <!-- Fallback select -->
                  <select
                    class="fallback-select"
                    value={mapping[field.key] || ''}
                    on:change={(e) => handleDirectSelect(field.key, e.currentTarget.value)}
                  >
                    <option value="">-- Sélectionner --</option>
                    {#each columns as col}
                      <option value={col}>{col}</option>
                    {/each}
                  </select>
                {/if}

                {#if !isMapped && suggestions.length > 0}
                  <div class="suggestions">
                    <span class="suggestions-label">Suggestions:</span>
                    {#each suggestions.slice(0, 3) as suggestion}
                      <button
                        type="button"
                        class="suggestion-chip"
                        on:click={() => handleDirectSelect(field.key, suggestion)}
                        title="Mapper avec {suggestion}"
                      >
                        {suggestion}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <!-- Validation -->
  {#if validationErrors.length > 0}
    <div class="validation-panel">
      <h4>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        Erreurs de validation
      </h4>
      <ul>
        {#each validationErrors as error}
          <li>{error}</li>
        {/each}
      </ul>
    </div>
  {:else}
    <div class="validation-panel success">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      Mapping valide ! Vous pouvez passer à l'étape suivante.
    </div>
  {/if}

  <!-- Profils dialog -->
  {#if showProfileDialog}
    <div class="dialog-overlay" on:click={() => showProfileDialog = false}>
      <div class="dialog" on:click|stopPropagation>
        <div class="dialog-header">
          <h3>Sauvegarder le profil de mapping</h3>
          <button type="button" class="dialog-close" on:click={() => showProfileDialog = false}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="dialog-body">
          <div class="form-group">
            <label for="profile-name">
              Nom du profil <span class="required-badge">*</span>
            </label>
            <input
              id="profile-name"
              type="text"
              bind:value={profileName}
              placeholder="Ex: Import Granulométrie Standard"
              required
            />
          </div>

          <div class="form-group">
            <label for="profile-description">Description (optionnel)</label>
            <textarea
              id="profile-description"
              bind:value={profileDescription}
              placeholder="Description du profil..."
              rows="3"
            ></textarea>
          </div>

          <div class="form-actions">
            <button type="button" class="btn-secondary" on:click={() => showProfileDialog = false}>
              Annuler
            </button>
            <button
              type="button"
              class="btn-primary"
              on:click={handleSaveProfile}
              disabled={!profileName.trim() || savingProfile}
            >
              {savingProfile ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>

          {#if profiles.length > 0}
            <div class="profiles-list">
              <h4>Profils existants ({profiles.length})</h4>
              {#each profiles as profile}
                <div class="profile-item">
                  <div class="profile-info">
                    <strong>{profile.name}</strong>
                    {#if profile.description}
                      <p>{profile.description}</p>
                    {/if}
                    <span class="profile-meta">
                      Utilisé {profile.use_count} fois
                      {#if profile.last_used_at}
                        · Dernière utilisation : {new Date(profile.last_used_at).toLocaleDateString()}
                      {/if}
                    </span>
                  </div>
                  <button
                    type="button"
                    class="btn-load-profile"
                    on:click={() => handleLoadProfile(profile)}
                  >
                    Charger
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .mapping-step {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  h2 {
    margin: 0;
    color: #333;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: white;
    color: #4a90e2;
    border: 1px solid #4a90e2;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: #4a90e2;
    color: white;
  }

  .structure-selector {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
  }

  .structure-selector h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 1rem;
    font-size: 1rem;
    color: #555;
  }

  .radio-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .radio-card {
    position: relative;
    display: block;
    padding: 1.25rem;
    background: white;
    border: 2px solid #ddd;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .radio-card:hover {
    border-color: #4a90e2;
    box-shadow: 0 2px 8px rgba(74, 144, 226, 0.1);
  }

  .radio-card.selected {
    border-color: #4a90e2;
    background: #f0f7ff;
    box-shadow: 0 2px 12px rgba(74, 144, 226, 0.2);
  }

  .radio-card input {
    position: absolute;
    top: 1rem;
    right: 1rem;
  }

  .radio-content strong {
    display: block;
    margin-bottom: 0.5rem;
    color: #333;
    font-size: 1rem;
  }

  .radio-content p {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    color: #777;
  }

  .example {
    display: block;
    padding: 0.75rem;
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    font-size: 0.75rem;
    line-height: 1.6;
    color: #555;
  }

  .mapping-container {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
  }

  .source-panel,
  .target-panel {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .source-panel h3,
  .target-panel h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid #e0e0e0;
    font-size: 1rem;
    color: #333;
  }

  .columns-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .column-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 6px;
    cursor: grab;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .column-chip:active {
    cursor: grabbing;
    transform: scale(0.98);
  }

  .column-chip svg {
    opacity: 0.7;
  }

  .empty-state {
    padding: 2rem 1rem;
    text-align: center;
    color: #999;
    font-size: 0.875rem;
  }

  .field-category {
    margin-bottom: 2rem;
  }

  .field-category h4 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 1rem;
    padding: 0.75rem;
    background: #f8f9fa;
    border-left: 4px solid currentColor;
    border-radius: 4px;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .category-icon {
    font-size: 1.25rem;
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 1.5rem;
    padding: 1rem;
    margin-bottom: 0.75rem;
    background: #fafafa;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .field-row.required {
    border-left: 4px solid #f44336;
  }

  .field-row.mapped {
    background: #f0f7ff;
    border-color: #4a90e2;
  }

  .field-row.drop-target {
    background: #fff9c4;
    border-color: #fbc02d;
    border-style: dashed;
  }

  .field-label strong {
    display: block;
    margin-bottom: 0.25rem;
    color: #333;
    font-size: 0.9rem;
  }

  .required-badge {
    color: #f44336;
    font-size: 0.9rem;
    margin-left: 0.25rem;
  }

  .field-description {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: #777;
    line-height: 1.4;
  }

  .field-target {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .drop-zone {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    border: 2px dashed #ccc;
    border-radius: 6px;
    background: white;
    color: #999;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .drop-zone.active {
    border-color: #4a90e2;
    background: #f0f7ff;
    color: #4a90e2;
  }

  .drop-zone svg {
    opacity: 0.5;
  }

  .mapped-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, #43a047 0%, #66bb6a 100%);
    color: white;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(67, 160, 71, 0.3);
  }

  .mapped-chip svg {
    flex-shrink: 0;
  }

  .mapped-chip span {
    flex: 1;
  }

  .btn-remove-mapping {
    padding: 0.25rem;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-remove-mapping:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .fallback-select {
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.875rem;
    background: white;
    cursor: pointer;
  }

  .fallback-select:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
  }

  .suggestions-label {
    color: #777;
  }

  .suggestion-chip {
    padding: 0.375rem 0.75rem;
    background: #e3f2fd;
    color: #1976d2;
    border: 1px solid #bbdefb;
    border-radius: 20px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .suggestion-chip:hover {
    background: #1976d2;
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(25, 118, 210, 0.3);
  }

  .validation-panel {
    padding: 1.25rem;
    background: #ffebee;
    border: 1px solid #ef5350;
    border-left: 4px solid #f44336;
    border-radius: 8px;
    color: #c62828;
  }

  .validation-panel h4 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.75rem;
    font-size: 1rem;
  }

  .validation-panel ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .validation-panel li {
    margin: 0.375rem 0;
  }

  .validation-panel.success {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: #e8f5e9;
    border-color: #66bb6a;
    color: #2e7d32;
  }

  /* Dialog */
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: #333;
  }

  .dialog-close {
    padding: 0.5rem;
    background: none;
    border: none;
    color: #999;
    cursor: pointer;
    transition: color 0.2s;
  }

  .dialog-close:hover {
    color: #333;
  }

  .dialog-body {
    padding: 1.5rem;
    max-height: calc(80vh - 120px);
    overflow-y: auto;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #555;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    background: #357abd;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .profiles-list {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e0e0e0;
  }

  .profiles-list h4 {
    margin: 0 0 1rem;
    font-size: 1rem;
    color: #555;
  }

  .profile-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    margin-bottom: 0.75rem;
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
  }

  .profile-info {
    flex: 1;
  }

  .profile-info strong {
    display: block;
    margin-bottom: 0.25rem;
    color: #333;
  }

  .profile-info p {
    margin: 0.25rem 0;
    font-size: 0.875rem;
    color: #666;
  }

  .profile-meta {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #999;
  }

  .btn-load-profile {
    padding: 0.5rem 1rem;
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-load-profile:hover {
    background: #357abd;
  }
</style>
