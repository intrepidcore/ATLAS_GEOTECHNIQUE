<!-- ============================================================================
  ImportBulkWizard.svelte - Wizard d'import bulk principal
  ============================================================================
  Description: Conteneur principal orchestrant les 5 étapes de l'import bulk
  Features:
  - Navigation entre les 5 étapes (Upload, Mapping, Geolocation, Preview, Progress)
  - Indicateur de progression visuel
  - Validation à chaque étape
  - Gestion du state global via store
  - Boutons Previous/Next avec validation
  - Reset et annulation
  - Responsive design
  ============================================================================
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import { importBulkStore, importBulkActions } from '../../stores/import-bulk-store';

  // Import des composants de chaque étape
  import UploadStep from './UploadStep.svelte';
  import MappingStep from './MappingStep.svelte';
  import GeolocationStep from './GeolocationStep.svelte';
  import PreviewStep from './PreviewStep.svelte';
  import ProgressStep from './ProgressStep.svelte';

  // ============================================================================
  // PROPS
  // ============================================================================

  export let onClose: () => void = () => {};
  export let onComplete: () => void = () => {};

  // ============================================================================
  // STATE
  // ============================================================================

  // Reactive store values
  $: currentStep = $importBulkStore.currentStep;
  $: file = $importBulkStore.file;
  $: mapping = $importBulkStore.mapping;
  $: geolocationConfig = $importBulkStore.geolocationConfig;
  $: previewData = $importBulkStore.previewData;
  $: importJob = $importBulkStore.importJob;
  $: validation = $importBulkStore.validation;

  // Step configuration
  const steps = [
    {
      id: 0,
      name: 'upload',
      title: 'Chargement',
      icon: '📁',
      description: 'Charger votre fichier de données'
    },
    {
      id: 1,
      name: 'mapping',
      title: 'Mapping',
      icon: '🗺️',
      description: 'Associer les colonnes aux champs'
    },
    {
      id: 2,
      name: 'geolocation',
      title: 'Géolocalisation',
      icon: '📍',
      description: 'Configurer la géolocalisation'
    },
    {
      id: 3,
      name: 'preview',
      title: 'Aperçu',
      icon: '👁️',
      description: 'Vérifier les données'
    },
    {
      id: 4,
      name: 'progress',
      title: 'Import',
      icon: '⚙️',
      description: 'Import en cours'
    }
  ];

  // Computed
  $: currentStepConfig = steps[currentStep];
  $: isFirstStep = currentStep === 0;
  $: isLastStep = currentStep === steps.length - 1;
  $: isProgressStep = currentStep === 4;
  $: canGoNext = isStepValid(currentStep);
  $: canGoPrevious = currentStep > 0 && !isProgressStep;

  // ============================================================================
  // VALIDATION
  // ============================================================================

  function isStepValid(step: number): boolean {
    switch (step) {
      case 0: // Upload
        return validation.upload.valid && file !== null;

      case 1: // Mapping
        return validation.mapping.valid && mapping !== null;

      case 2: // Geolocation
        return validation.geolocation.valid && geolocationConfig !== null;

      case 3: // Preview
        return validation.preview.valid && previewData !== null;

      case 4: // Progress
        return importJob !== null;

      default:
        return false;
    }
  }

  function getStepStatus(stepIndex: number): 'completed' | 'current' | 'pending' | 'invalid' {
    if (stepIndex < currentStep) {
      return isStepValid(stepIndex) ? 'completed' : 'invalid';
    } else if (stepIndex === currentStep) {
      return 'current';
    } else {
      return 'pending';
    }
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  function handleNext() {
    if (!canGoNext) {
      alert('Veuillez compléter cette étape avant de continuer.');
      return;
    }

    if (currentStep < steps.length - 1) {
      importBulkActions.nextStep();
    }
  }

  function handlePrevious() {
    if (canGoPrevious) {
      importBulkActions.previousStep();
    }
  }

  function handleGoToStep(stepIndex: number) {
    // Ne peut aller qu'aux étapes précédentes ou à la suivante si valide
    if (stepIndex < currentStep) {
      importBulkActions.goToStep(stepIndex);
    } else if (stepIndex === currentStep + 1 && canGoNext) {
      importBulkActions.nextStep();
    }
  }

  function handleCancel() {
    const confirm = window.confirm('Êtes-vous sûr de vouloir annuler l\'import ? Toutes les données seront perdues.');
    if (confirm) {
      importBulkActions.reset();
      onClose();
    }
  }

  function handleReset() {
    const confirm = window.confirm('Êtes-vous sûr de vouloir recommencer ? Toutes les données seront perdues.');
    if (confirm) {
      importBulkActions.reset();
    }
  }

  // ============================================================================
  // STEP COMPLETION HANDLERS
  // ============================================================================

  function handleUploadComplete() {
    importBulkActions.nextStep();
  }

  function handleMappingComplete() {
    importBulkActions.nextStep();
  }

  function handleGeolocationComplete() {
    importBulkActions.nextStep();
  }

  function handlePreviewComplete() {
    // Preview calls the API to start import, which updates the store
    // Just go to progress step
    importBulkActions.nextStep();
  }

  function handleProgressComplete() {
    // Import completed successfully
    onComplete();
  }

  function handleProgressError(error: string) {
    console.error('Import error:', error);
    // Stay on progress step to show error and retry options
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  onMount(() => {
    // Reset on mount
    importBulkActions.reset();
  });
</script>

<!-- ============================================================================
  TEMPLATE
  ============================================================================ -->

<div class="import-wizard">
  <!-- Header -->
  <div class="wizard-header">
    <div class="header-content">
      <h1>
        <span class="header-icon">📊</span>
        Import Bulk de Sondages
      </h1>
      <p class="header-description">
        Importez vos données de sondages géotechniques en quelques étapes simples
      </p>
    </div>
    <button class="close-btn" on:click={handleCancel} title="Fermer">✕</button>
  </div>

  <!-- Progress Indicator -->
  <div class="steps-indicator">
    {#each steps as step, index}
      <div
        class="step-indicator {getStepStatus(index)}"
        class:clickable={index < currentStep}
        on:click={() => handleGoToStep(index)}
        role="button"
        tabindex={index < currentStep ? 0 : -1}
        on:keydown={(e) => e.key === 'Enter' && handleGoToStep(index)}
      >
        <div class="step-number">
          {#if getStepStatus(index) === 'completed'}
            <span class="check-icon">✓</span>
          {:else if getStepStatus(index) === 'invalid'}
            <span class="error-icon">!</span>
          {:else}
            <span>{index + 1}</span>
          {/if}
        </div>
        <div class="step-info">
          <div class="step-icon">{step.icon}</div>
          <div class="step-title">{step.title}</div>
        </div>

        {#if index < steps.length - 1}
          <div class="step-connector" class:completed={index < currentStep}></div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Current Step Title -->
  <div class="current-step-header">
    <h2>
      <span class="step-icon-large">{currentStepConfig.icon}</span>
      {currentStepConfig.title}
    </h2>
    <p class="step-description">{currentStepConfig.description}</p>
  </div>

  <!-- Step Content -->
  <div class="step-content">
    {#if currentStep === 0}
      <UploadStep onComplete={handleUploadComplete} />
    {:else if currentStep === 1}
      <MappingStep onComplete={handleMappingComplete} />
    {:else if currentStep === 2}
      <GeolocationStep onComplete={handleGeolocationComplete} />
    {:else if currentStep === 3}
      <PreviewStep onComplete={handlePreviewComplete} />
    {:else if currentStep === 4}
      <ProgressStep
        onComplete={handleProgressComplete}
        onError={handleProgressError}
      />
    {/if}
  </div>

  <!-- Navigation Buttons -->
  {#if !isProgressStep}
    <div class="wizard-footer">
      <div class="footer-left">
        {#if !isFirstStep}
          <button
            class="btn btn-secondary"
            on:click={handlePrevious}
            disabled={!canGoPrevious}
          >
            ← Précédent
          </button>
        {/if}
      </div>

      <div class="footer-center">
        <button class="btn btn-outline" on:click={handleReset}>
          🔄 Recommencer
        </button>
      </div>

      <div class="footer-right">
        {#if !isLastStep}
          <button
            class="btn btn-primary"
            on:click={handleNext}
            disabled={!canGoNext}
          >
            Suivant →
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Validation Messages -->
  {#if !validation[currentStepConfig.name]?.valid && validation[currentStepConfig.name]?.errors.length > 0}
    <div class="validation-errors">
      <div class="error-header">
        <span class="error-icon">⚠️</span>
        <span>Erreurs de validation</span>
      </div>
      <ul>
        {#each validation[currentStepConfig.name].errors as error}
          <li>{error}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<!-- ============================================================================
  STYLES
  ============================================================================ -->

<style>
  .import-wizard {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #f8f9fa;
    overflow: hidden;
  }

  /* Header */
  .wizard-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }

  .header-content h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-icon {
    font-size: 2.5rem;
  }

  .header-description {
    margin: 0;
    opacity: 0.9;
    font-size: 1.1rem;
  }

  .close-btn {
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .close-btn:hover {
    background: rgba(255,255,255,0.3);
  }

  /* Steps Indicator */
  .steps-indicator {
    display: flex;
    justify-content: space-between;
    padding: 2rem 2rem 1rem;
    background: white;
    border-bottom: 2px solid #e9ecef;
    position: relative;
  }

  .step-indicator {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    padding: 0 1rem;
  }

  .step-indicator.clickable {
    cursor: pointer;
  }

  .step-indicator.clickable:hover .step-number {
    transform: scale(1.1);
  }

  .step-number {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
    transition: all 0.3s;
    z-index: 2;
  }

  .step-indicator.pending .step-number {
    background: #e9ecef;
    color: #6c757d;
  }

  .step-indicator.current .step-number {
    background: #667eea;
    color: white;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(102, 126, 234, 0.1);
    }
  }

  .step-indicator.completed .step-number {
    background: #28a745;
    color: white;
  }

  .step-indicator.invalid .step-number {
    background: #dc3545;
    color: white;
  }

  .check-icon, .error-icon {
    font-size: 1.5rem;
  }

  .step-info {
    text-align: center;
  }

  .step-icon {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }

  .step-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: #495057;
  }

  .step-indicator.current .step-title {
    color: #667eea;
  }

  .step-connector {
    position: absolute;
    top: 25px;
    left: 50%;
    width: 100%;
    height: 2px;
    background: #e9ecef;
    z-index: 1;
  }

  .step-connector.completed {
    background: #28a745;
  }

  .step-indicator:last-child .step-connector {
    display: none;
  }

  /* Current Step Header */
  .current-step-header {
    background: white;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e9ecef;
  }

  .current-step-header h2 {
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #212529;
  }

  .step-icon-large {
    font-size: 2rem;
  }

  .step-description {
    margin: 0;
    color: #6c757d;
    font-size: 1rem;
  }

  /* Step Content */
  .step-content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
    background: #f8f9fa;
  }

  /* Footer */
  .wizard-footer {
    background: white;
    padding: 1.5rem 2rem;
    border-top: 2px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 -4px 6px rgba(0,0,0,0.05);
  }

  .footer-left, .footer-center, .footer-right {
    flex: 1;
    display: flex;
    gap: 1rem;
  }

  .footer-left {
    justify-content: flex-start;
  }

  .footer-center {
    justify-content: center;
  }

  .footer-right {
    justify-content: flex-end;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #667eea;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #5568d3;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .btn-secondary {
    background: #6c757d;
    color: white;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #5a6268;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(108, 117, 125, 0.4);
  }

  .btn-outline {
    background: white;
    color: #667eea;
    border: 2px solid #667eea;
  }

  .btn-outline:hover {
    background: #667eea;
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  /* Validation Errors */
  .validation-errors {
    position: fixed;
    bottom: 100px;
    right: 2rem;
    background: #f8d7da;
    border: 2px solid #f5c6cb;
    border-radius: 8px;
    padding: 1rem;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    animation: slideIn 0.3s;
    z-index: 1000;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .error-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    color: #721c24;
    margin-bottom: 0.5rem;
  }

  .error-icon {
    font-size: 1.2rem;
  }

  .validation-errors ul {
    margin: 0;
    padding-left: 1.5rem;
    color: #721c24;
  }

  .validation-errors li {
    margin: 0.25rem 0;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .wizard-header {
      padding: 1.5rem;
    }

    .header-content h1 {
      font-size: 1.5rem;
    }

    .steps-indicator {
      padding: 1.5rem 1rem 1rem;
    }

    .step-indicator {
      padding: 0 0.5rem;
    }

    .step-title {
      font-size: 0.8rem;
    }

    .step-icon {
      font-size: 1.2rem;
    }

    .step-content {
      padding: 1.5rem;
    }

    .wizard-footer {
      padding: 1rem 1.5rem;
    }
  }

  @media (max-width: 768px) {
    .import-wizard {
      height: 100%;
    }

    .wizard-header {
      flex-direction: column;
      gap: 1rem;
    }

    .close-btn {
      align-self: flex-end;
    }

    .steps-indicator {
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }

    .step-indicator {
      flex-direction: row;
      padding: 0;
      width: 100%;
    }

    .step-number {
      margin-bottom: 0;
      margin-right: 1rem;
      flex-shrink: 0;
    }

    .step-info {
      text-align: left;
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .step-connector {
      display: none;
    }

    .current-step-header {
      padding: 1rem;
    }

    .current-step-header h2 {
      font-size: 1.3rem;
    }

    .step-content {
      padding: 1rem;
    }

    .wizard-footer {
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }

    .footer-left, .footer-center, .footer-right {
      width: 100%;
      justify-content: center;
    }

    .btn {
      width: 100%;
      justify-content: center;
    }

    .validation-errors {
      right: 1rem;
      left: 1rem;
      bottom: 80px;
      max-width: none;
    }
  }

  @media (max-width: 480px) {
    .header-content h1 {
      font-size: 1.2rem;
    }

    .header-icon {
      font-size: 2rem;
    }

    .header-description {
      font-size: 0.9rem;
    }

    .step-number {
      width: 40px;
      height: 40px;
      font-size: 1rem;
    }

    .step-title {
      font-size: 0.85rem;
    }

    .current-step-header h2 {
      font-size: 1.1rem;
    }

    .step-description {
      font-size: 0.9rem;
    }
  }
</style>
