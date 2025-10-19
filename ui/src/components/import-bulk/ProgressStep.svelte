<!-- ============================================================================
  ProgressStep.svelte - Étape 5: Suivi de progression de l'import
  ============================================================================
  Description: Affiche la progression en temps réel de l'import bulk
  Features:
  - Polling automatique du statut toutes les 2 secondes
  - Barre de progression animée
  - Statistiques en temps réel (succès, erreurs, warnings)
  - Affichage des messages de statut
  - Bouton d'annulation pendant l'import
  - Téléchargement du rapport final
  - Affichage des erreurs détaillées
  - Retry sur échec
  ============================================================================
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { importBulkStore, importBulkActions } from '../../stores/import-bulk-store';
  import { ImportBulkAPI } from '../../services/import-bulk-api';
  import type { ImportJob, ImportStatus as ImportStatusType } from '../../services/import-bulk-api';

  // ============================================================================
  // PROPS
  // ============================================================================

  export let onComplete: () => void = () => {};
  export let onError: (error: string) => void = () => {};

  // ============================================================================
  // STATE
  // ============================================================================

  let pollingInterval: number | null = null;
  let isPolling = false;
  let errorDetails: string | null = null;
  let showErrorDetails = false;
  let isDownloadingReport = false;
  let isCancelling = false;

  // Reactive job status
  $: job = $importBulkStore.importJob;
  $: status = job?.status || 'pending';
  $: progress = job?.progress || 0;
  $: stats = job?.stats;
  $: errorMessage = job?.error_message;
  $: startedAt = job?.started_at;
  $: completedAt = job?.completed_at;

  // Status display helpers
  $: isRunning = status === 'running' || status === 'pending';
  $: isCompleted = status === 'succeeded' || status === 'partial';
  $: isFailed = status === 'failed';
  $: isCancelled = status === 'cancelled';
  $: isTerminated = isCompleted || isFailed || isCancelled;

  // Status colors
  $: statusColor = {
    pending: '#6c757d',
    running: '#007bff',
    succeeded: '#28a745',
    partial: '#ffc107',
    failed: '#dc3545',
    cancelled: '#6c757d'
  }[status] || '#6c757d';

  // Status icons
  $: statusIcon = {
    pending: '⏳',
    running: '⚙️',
    succeeded: '✅',
    partial: '⚠️',
    failed: '❌',
    cancelled: '🚫'
  }[status] || '⏳';

  // Status labels
  $: statusLabel = {
    pending: 'En attente...',
    running: 'Import en cours...',
    succeeded: 'Import réussi !',
    partial: 'Import partiel',
    failed: 'Échec de l\'import',
    cancelled: 'Import annulé'
  }[status] || 'Statut inconnu';

  // Duration calculation
  $: duration = calculateDuration(startedAt, completedAt);

  // ============================================================================
  // POLLING
  // ============================================================================

  async function pollJobStatus() {
    if (!job?.job_id || isPolling) return;

    isPolling = true;
    try {
      const updatedJob = await ImportBulkAPI.getStatus(job.job_id);
      importBulkActions.setImportJob(updatedJob);

      // Si terminé, arrêter le polling
      if (['succeeded', 'partial', 'failed', 'cancelled'].includes(updatedJob.status)) {
        stopPolling();

        if (updatedJob.status === 'succeeded' || updatedJob.status === 'partial') {
          onComplete();
        } else if (updatedJob.status === 'failed') {
          onError(updatedJob.error_message || 'Erreur inconnue');
        }
      }
    } catch (error) {
      console.error('Erreur polling status:', error);
      errorDetails = error instanceof Error ? error.message : String(error);
    } finally {
      isPolling = false;
    }
  }

  function startPolling() {
    if (pollingInterval) return;

    // Poll immédiatement
    pollJobStatus();

    // Puis toutes les 2 secondes
    pollingInterval = window.setInterval(() => {
      pollJobStatus();
    }, 2000);
  }

  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  // ============================================================================
  // ACTIONS
  // ============================================================================

  async function handleCancel() {
    if (!job?.job_id || isCancelling) return;

    const confirm = window.confirm('Êtes-vous sûr de vouloir annuler cet import ?');
    if (!confirm) return;

    isCancelling = true;
    try {
      await ImportBulkAPI.cancelImport(job.job_id);
      await pollJobStatus(); // Refresh status
    } catch (error) {
      console.error('Erreur annulation:', error);
      alert('Erreur lors de l\'annulation de l\'import');
    } finally {
      isCancelling = false;
    }
  }

  async function handleDownloadReport() {
    if (!job?.job_id || isDownloadingReport) return;

    isDownloadingReport = true;
    try {
      const report = await ImportBulkAPI.getReport(job.job_id);

      // Créer un blob CSV
      const blob = new Blob([report], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      // Télécharger
      const link = document.createElement('a');
      link.href = url;
      link.download = `import_report_${job.job_id}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur téléchargement rapport:', error);
      alert('Erreur lors du téléchargement du rapport');
    } finally {
      isDownloadingReport = false;
    }
  }

  function handleRetry() {
    // Reset wizard to upload step
    importBulkActions.reset();
    importBulkActions.goToStep(0);
  }

  function handleNewImport() {
    // Reset completely
    importBulkActions.reset();
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  function calculateDuration(start: string | null | undefined, end: string | null | undefined): string {
    if (!start) return '-';

    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate.getTime() - startDate.getTime();

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  function formatNumber(n: number | undefined): string {
    return n?.toLocaleString('fr-FR') || '0';
  }

  function formatDate(date: string | null | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleString('fr-FR');
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  onMount(() => {
    if (job?.job_id && isRunning) {
      startPolling();
    }
  });

  onDestroy(() => {
    stopPolling();
  });

  // Watch status changes to start/stop polling
  $: if (job?.job_id) {
    if (isRunning && !pollingInterval) {
      startPolling();
    } else if (isTerminated && pollingInterval) {
      stopPolling();
    }
  }
</script>

<!-- ============================================================================
  TEMPLATE
  ============================================================================ -->

<div class="progress-step">
  <!-- Header -->
  <div class="progress-header">
    <h2>
      <span class="status-icon" style="color: {statusColor}">{statusIcon}</span>
      {statusLabel}
    </h2>
    {#if job?.job_id}
      <div class="job-id">
        <span class="label">Job ID:</span>
        <code>{job.job_id}</code>
      </div>
    {/if}
  </div>

  <!-- Progress Bar -->
  <div class="progress-bar-container">
    <div class="progress-bar">
      <div
        class="progress-fill {isRunning ? 'animated' : ''}"
        style="width: {progress}%; background-color: {statusColor};"
      ></div>
    </div>
    <div class="progress-label">
      {progress.toFixed(1)}%
    </div>
  </div>

  <!-- Statistics -->
  {#if stats}
    <div class="stats-grid">
      <div class="stat-card total">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-label">Total</div>
          <div class="stat-value">{formatNumber(stats.total)}</div>
        </div>
      </div>

      <div class="stat-card success">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-label">Succès</div>
          <div class="stat-value">{formatNumber(stats.succeeded)}</div>
        </div>
      </div>

      <div class="stat-card warning">
        <div class="stat-icon">⚠️</div>
        <div class="stat-content">
          <div class="stat-label">Avertissements</div>
          <div class="stat-value">{formatNumber(stats.warnings)}</div>
        </div>
      </div>

      <div class="stat-card error">
        <div class="stat-icon">❌</div>
        <div class="stat-content">
          <div class="stat-label">Erreurs</div>
          <div class="stat-value">{formatNumber(stats.errors)}</div>
        </div>
      </div>

      {#if stats.duplicates > 0}
        <div class="stat-card duplicate">
          <div class="stat-icon">🔄</div>
          <div class="stat-content">
            <div class="stat-label">Doublons</div>
            <div class="stat-value">{formatNumber(stats.duplicates)}</div>
          </div>
        </div>
      {/if}

      {#if stats.skipped > 0}
        <div class="stat-card skipped">
          <div class="stat-icon">⏭️</div>
          <div class="stat-content">
            <div class="stat-label">Ignorés</div>
            <div class="stat-value">{formatNumber(stats.skipped)}</div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Timeline -->
  <div class="timeline">
    {#if startedAt}
      <div class="timeline-item">
        <span class="timeline-label">Démarré:</span>
        <span class="timeline-value">{formatDate(startedAt)}</span>
      </div>
    {/if}

    {#if completedAt}
      <div class="timeline-item">
        <span class="timeline-label">Terminé:</span>
        <span class="timeline-value">{formatDate(completedAt)}</span>
      </div>
    {/if}

    {#if duration !== '-'}
      <div class="timeline-item">
        <span class="timeline-label">Durée:</span>
        <span class="timeline-value">{duration}</span>
      </div>
    {/if}
  </div>

  <!-- Error Message -->
  {#if errorMessage}
    <div class="error-container">
      <div class="error-header">
        <span class="error-icon">❌</span>
        <span class="error-title">Erreur lors de l'import</span>
      </div>
      <div class="error-message">{errorMessage}</div>
      {#if errorDetails}
        <button
          class="toggle-details-btn"
          on:click={() => showErrorDetails = !showErrorDetails}
        >
          {showErrorDetails ? 'Masquer' : 'Afficher'} les détails
        </button>
        {#if showErrorDetails}
          <pre class="error-details">{errorDetails}</pre>
        {/if}
      {/if}
    </div>
  {/if}

  <!-- Status Messages -->
  {#if isRunning}
    <div class="status-message running">
      <div class="spinner"></div>
      <div>
        <strong>Import en cours...</strong>
        <p>Veuillez patienter pendant que vos données sont importées. Cette opération peut prendre plusieurs minutes.</p>
      </div>
    </div>
  {/if}

  {#if isCompleted}
    <div class="status-message success">
      <span class="message-icon">✅</span>
      <div>
        <strong>Import terminé avec succès !</strong>
        <p>
          {#if stats}
            {formatNumber(stats.succeeded)} sondage(s) importé(s) sur {formatNumber(stats.total)}.
            {#if stats.warnings > 0}
              {formatNumber(stats.warnings)} avertissement(s).
            {/if}
            {#if stats.errors > 0}
              {formatNumber(stats.errors)} erreur(s).
            {/if}
          {/if}
        </p>
      </div>
    </div>
  {/if}

  {#if isFailed}
    <div class="status-message error">
      <span class="message-icon">❌</span>
      <div>
        <strong>L'import a échoué</strong>
        <p>Une erreur s'est produite lors de l'import. Veuillez consulter les détails ci-dessus et réessayer.</p>
      </div>
    </div>
  {/if}

  {#if isCancelled}
    <div class="status-message cancelled">
      <span class="message-icon">🚫</span>
      <div>
        <strong>Import annulé</strong>
        <p>L'import a été annulé par l'utilisateur.</p>
      </div>
    </div>
  {/if}

  <!-- Actions -->
  <div class="actions">
    {#if isRunning}
      <button
        class="btn btn-danger"
        on:click={handleCancel}
        disabled={isCancelling}
      >
        {isCancelling ? 'Annulation...' : 'Annuler l\'import'}
      </button>
    {/if}

    {#if isCompleted && job?.job_id}
      <button
        class="btn btn-primary"
        on:click={handleDownloadReport}
        disabled={isDownloadingReport}
      >
        {isDownloadingReport ? 'Téléchargement...' : '📥 Télécharger le rapport'}
      </button>
      <button
        class="btn btn-secondary"
        on:click={handleNewImport}
      >
        Nouvel import
      </button>
    {/if}

    {#if isFailed}
      <button
        class="btn btn-primary"
        on:click={handleRetry}
      >
        🔄 Réessayer
      </button>
      <button
        class="btn btn-secondary"
        on:click={handleNewImport}
      >
        Nouvel import
      </button>
    {/if}

    {#if isCancelled}
      <button
        class="btn btn-primary"
        on:click={handleRetry}
      >
        🔄 Réessayer
      </button>
      <button
        class="btn btn-secondary"
        on:click={handleNewImport}
      >
        Nouvel import
      </button>
    {/if}
  </div>
</div>

<!-- ============================================================================
  STYLES
  ============================================================================ -->

<style>
  .progress-step {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem;
  }

  /* Header */
  .progress-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .progress-header h2 {
    font-size: 1.8rem;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .status-icon {
    font-size: 2rem;
  }

  .job-id {
    font-size: 0.9rem;
    color: #6c757d;
    margin-top: 0.5rem;
  }

  .job-id .label {
    font-weight: 600;
    margin-right: 0.5rem;
  }

  .job-id code {
    background: #f8f9fa;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  /* Progress Bar */
  .progress-bar-container {
    margin-bottom: 2rem;
  }

  .progress-bar {
    width: 100%;
    height: 30px;
    background: #e9ecef;
    border-radius: 15px;
    overflow: hidden;
    position: relative;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
  }

  .progress-fill {
    height: 100%;
    transition: width 0.5s ease;
    border-radius: 15px;
    position: relative;
  }

  .progress-fill.animated::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.3),
      transparent
    );
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  .progress-label {
    text-align: center;
    font-size: 1.2rem;
    font-weight: 600;
    margin-top: 0.5rem;
    color: #495057;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border-left: 4px solid #dee2e6;
  }

  .stat-card.total { border-left-color: #6c757d; }
  .stat-card.success { border-left-color: #28a745; }
  .stat-card.warning { border-left-color: #ffc107; }
  .stat-card.error { border-left-color: #dc3545; }
  .stat-card.duplicate { border-left-color: #17a2b8; }
  .stat-card.skipped { border-left-color: #6c757d; }

  .stat-icon {
    font-size: 2rem;
    opacity: 0.8;
  }

  .stat-content {
    flex: 1;
  }

  .stat-label {
    font-size: 0.85rem;
    color: #6c757d;
    margin-bottom: 0.25rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #212529;
  }

  /* Timeline */
  .timeline {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 2rem;
  }

  .timeline-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #dee2e6;
  }

  .timeline-item:last-child {
    border-bottom: none;
  }

  .timeline-label {
    font-weight: 600;
    color: #495057;
  }

  .timeline-value {
    color: #6c757d;
  }

  /* Error Container */
  .error-container {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 2rem;
  }

  .error-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .error-icon {
    font-size: 1.5rem;
  }

  .error-title {
    font-weight: 700;
    color: #721c24;
  }

  .error-message {
    color: #721c24;
    margin-bottom: 0.5rem;
    line-height: 1.5;
  }

  .toggle-details-btn {
    background: none;
    border: none;
    color: #721c24;
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    font-size: 0.9rem;
  }

  .toggle-details-btn:hover {
    color: #491217;
  }

  .error-details {
    background: white;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
    padding: 1rem;
    margin-top: 0.5rem;
    font-size: 0.85rem;
    overflow-x: auto;
    max-height: 200px;
    overflow-y: auto;
  }

  /* Status Messages */
  .status-message {
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 2rem;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .status-message.running {
    background: #cfe2ff;
    border: 1px solid #9ec5fe;
  }

  .status-message.success {
    background: #d1e7dd;
    border: 1px solid #a3cfbb;
  }

  .status-message.error {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
  }

  .status-message.cancelled {
    background: #e2e3e5;
    border: 1px solid #d3d6d8;
  }

  .message-icon {
    font-size: 1.5rem;
  }

  .status-message strong {
    display: block;
    margin-bottom: 0.5rem;
  }

  .status-message p {
    margin: 0;
    line-height: 1.5;
  }

  /* Spinner */
  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid rgba(0,0,0,0.1);
    border-top-color: #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Actions */
  .actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #007bff;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0056b3;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  }

  .btn-secondary {
    background: #6c757d;
    color: white;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #545b62;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  }

  .btn-danger {
    background: #dc3545;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #c82333;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .progress-step {
      padding: 1rem;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .actions {
      flex-direction: column;
    }

    .btn {
      width: 100%;
    }
  }
</style>
