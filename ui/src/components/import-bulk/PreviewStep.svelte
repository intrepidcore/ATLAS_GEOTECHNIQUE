<script lang="ts">
  import { onMount } from 'svelte';
  import { importBulkStore, importBulkActions } from '../../stores/import-bulk-store';
  import { ImportBulkAPI } from '../../services/import-bulk-api';
  import type { PreviewRow } from '../../services/import-bulk-api';

  $: file = $importBulkStore.file;
  $: mapping = $importBulkStore.mapping;
  $: geolocation = $importBulkStore.geolocation;
  $: fileFormat = $importBulkStore.fileFormat;
  $: dataStructure = $importBulkStore.dataStructure;
  $: previewData = $importBulkStore.previewData;
  $: previewStats = $importBulkStore.previewStats;

  let loading = false;
  let error: string | null = null;
  let map: any = null;
  let showMap = true;
  let filterStatus: 'all' | 'ok' | 'warning' | 'error' = 'all';
  let currentPage = 1;
  let rowsPerPage = 20;

  $: filteredData = previewData.filter(row => {
    if (filterStatus === 'all') return true;
    return row.status === filterStatus;
  });

  $: paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  $: totalPages = Math.ceil(filteredData.length / rowsPerPage);

  onMount(async () => {
    if (previewData.length === 0) {
      await loadPreview();
    }
    if (showMap) {
      await initMap();
    }
  });

  async function loadPreview() {
    if (!file) {
      error = 'Aucun fichier sélectionné';
      return;
    }

    loading = true;
    error = null;

    try {
      const result = await ImportBulkAPI.dryRun(file, {
        format: fileFormat,
        mapping: mapping,
        geolocation: geolocation,
      });

      importBulkActions.setPreviewData(result.preview, result.stats);

      // Init map après chargement des données
      if (showMap) {
        setTimeout(() => initMap(), 100);
      }
    } catch (err: any) {
      error = err.message;
      importBulkActions.setError(err.message);
    } finally {
      loading = false;
    }
  }

  async function initMap() {
    // Vérifier si Leaflet est disponible
    if (typeof window === 'undefined' || !(window as any).L) {
      console.warn('Leaflet not loaded, skipping map');
      return;
    }

    const L = (window as any).L;

    // Détruire carte existante
    if (map) {
      map.remove();
      map = null;
    }

    // Créer nouvelle carte
    try {
      const mapContainer = document.getElementById('preview-map');
      if (!mapContainer) return;

      map = L.map('preview-map').setView([8.5, 1.0], 7);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      // Ajouter markers
      const markers = L.featureGroup();

      previewData.forEach((row, idx) => {
        if (row.longitude && row.latitude) {
          const color = getMarkerColor(row.status);
          const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          });

          const marker = L.marker([row.latitude, row.longitude], { icon })
            .bindPopup(`
              <div style="min-width: 200px;">
                <strong>${row.localite || row.code || `Ligne ${idx + 1}`}</strong><br>
                <small>
                  ${row.date || ''}<br>
                  Coords: ${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)}<br>
                  Statut: <span style="color: ${color}; font-weight: 600;">${getStatusLabel(row.status)}</span>
                </small>
                ${row.errors.length > 0 ? `<hr style="margin: 0.5rem 0;"><strong style="color: #f44336;">Erreurs:</strong><ul style="margin: 0.25rem 0; padding-left: 1.5rem; font-size: 0.85rem;">${row.errors.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
                ${row.warnings.length > 0 ? `<hr style="margin: 0.5rem 0;"><strong style="color: #ff9800;">Warnings:</strong><ul style="margin: 0.25rem 0; padding-left: 1.5rem; font-size: 0.85rem;">${row.warnings.map(w => `<li>${w}</li>`).join('')}</ul>` : ''}
              </div>
            `);

          markers.addLayer(marker);
        }
      });

      if (markers.getLayers().length > 0) {
        markers.addTo(map);
        map.fitBounds(markers.getBounds(), { padding: [50, 50] });
      }
    } catch (err) {
      console.error('Erreur initialisation carte:', err);
    }
  }

  function getMarkerColor(status: string): string {
    switch (status) {
      case 'ok': return '#43a047';
      case 'warning': return '#ff9800';
      case 'error': return '#f44336';
      default: return '#999';
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'ok': return 'Valide';
      case 'warning': return 'Avertissement';
      case 'error': return 'Erreur';
      case 'skipped': return 'Ignoré';
      default: return status;
    }
  }

  function handleRefresh() {
    loadPreview();
  }

  function handleToggleMap() {
    showMap = !showMap;
    if (showMap) {
      setTimeout(() => initMap(), 100);
    }
  }

  function handlePageChange(page: number) {
    currentPage = page;
  }

  function downloadReport() {
    const csv = generateCSVReport();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `preview-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function generateCSVReport(): string {
    const headers = ['Ligne', 'Statut', 'Localité', 'Code', 'Date', 'Longitude', 'Latitude', 'Erreurs', 'Warnings'];
    const rows = previewData.map(row => [
      row.row_idx.toString(),
      getStatusLabel(row.status),
      row.localite || '',
      row.code || '',
      row.date || '',
      row.longitude?.toString() || '',
      row.latitude?.toString() || '',
      row.errors.join('; '),
      row.warnings.join('; '),
    ]);

    return [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))
    ].join('\n');
  }
</script>

<svelte:head>
  {#if showMap}
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  {/if}
</svelte:head>

<div class="preview-step">
  <div class="header">
    <div>
      <h2>Étape 4 : Prévisualisation</h2>
      <p class="subtitle">Vérifiez les données avant l'import définitif</p>
    </div>
    <div class="header-actions">
      <button type="button" class="btn-secondary" on:click={handleRefresh} disabled={loading}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
        {loading ? 'Chargement...' : 'Actualiser'}
      </button>
      <button type="button" class="btn-secondary" on:click={handleToggleMap}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
        </svg>
        {showMap ? 'Masquer' : 'Afficher'} carte
      </button>
      <button type="button" class="btn-secondary" on:click={downloadReport} disabled={previewData.length === 0}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Exporter CSV
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading-overlay">
      <div class="spinner-large"></div>
      <p>Validation des données en cours...</p>
      <p class="loading-hint">Analyse des {mapping.structure === 'long' ? 'lignes' : 'colonnes'}, calcul des coordonnées...</p>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <div>
        <strong>Erreur lors de la prévisualisation</strong>
        <p>{error}</p>
      </div>
    </div>
  {:else if previewData.length === 0}
    <div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="12" y1="18" x2="12" y2="12"></line>
        <line x1="9" y1="15" x2="15" y2="15"></line>
      </svg>
      <h3>Aucune donnée à prévisualiser</h3>
      <p>Cliquez sur "Actualiser" pour générer la prévisualisation</p>
      <button type="button" class="btn-primary" on:click={loadPreview}>
        Générer prévisualisation
      </button>
    </div>
  {:else}
    <!-- Stats -->
    <div class="stats-panel">
      <div class="stat-card stat-total">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-value">{previewStats.total}</div>
          <div class="stat-label">Lignes analysées</div>
        </div>
      </div>

      <div class="stat-card stat-ok">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-value">{previewStats.ok}</div>
          <div class="stat-label">Valides</div>
          <div class="stat-percent">{((previewStats.ok / previewStats.total) * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div class="stat-card stat-warning">
        <div class="stat-icon">⚠️</div>
        <div class="stat-content">
          <div class="stat-value">{previewStats.warnings}</div>
          <div class="stat-label">Avertissements</div>
          <div class="stat-percent">{((previewStats.warnings / previewStats.total) * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div class="stat-card stat-error">
        <div class="stat-icon">❌</div>
        <div class="stat-content">
          <div class="stat-value">{previewStats.errors}</div>
          <div class="stat-label">Erreurs</div>
          <div class="stat-percent">{((previewStats.errors / previewStats.total) * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>

    {#if previewStats.errors > 0}
      <div class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <div>
          <strong>Import impossible</strong>
          <p>
            {previewStats.errors} ligne{previewStats.errors > 1 ? 's contiennent' : ' contient'} des erreurs critiques.
            Corrigez les erreurs dans le fichier source ou ajustez le mapping avant de continuer.
          </p>
        </div>
      </div>
    {:else if previewStats.warnings > 0}
      <div class="alert alert-warning">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <div>
          <strong>Avertissements détectés</strong>
          <p>
            {previewStats.warnings} ligne{previewStats.warnings > 1 ? 's' : ''} avec avertissements.
            L'import peut continuer mais vérifiez les données suspectes.
          </p>
        </div>
      </div>
    {:else}
      <div class="alert alert-success">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <div>
          <strong>Validation réussie !</strong>
          <p>Toutes les lignes sont valides. Vous pouvez procéder à l'import.</p>
        </div>
      </div>
    {/if}

    <div class="content-layout" class:has-map={showMap}>
      <!-- Tableau -->
      <div class="table-panel">
        <div class="table-header">
          <h3>
            Données ({filteredData.length} ligne{filteredData.length > 1 ? 's' : ''})
          </h3>

          <div class="filter-buttons">
            <button
              type="button"
              class="filter-btn"
              class:active={filterStatus === 'all'}
              on:click={() => { filterStatus = 'all'; currentPage = 1; }}
            >
              Tout ({previewStats.total})
            </button>
            <button
              type="button"
              class="filter-btn filter-ok"
              class:active={filterStatus === 'ok'}
              on:click={() => { filterStatus = 'ok'; currentPage = 1; }}
            >
              ✓ Valides ({previewStats.ok})
            </button>
            <button
              type="button"
              class="filter-btn filter-warning"
              class:active={filterStatus === 'warning'}
              on:click={() => { filterStatus = 'warning'; currentPage = 1; }}
            >
              ⚠ Warnings ({previewStats.warnings})
            </button>
            <button
              type="button"
              class="filter-btn filter-error"
              class:active={filterStatus === 'error'}
              on:click={() => { filterStatus = 'error'; currentPage = 1; }}
            >
              ✗ Erreurs ({previewStats.errors})
            </button>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th class="col-status">Statut</th>
                <th class="col-row">#</th>
                <th>Localité</th>
                <th>Code</th>
                <th>Date</th>
                <th>Coordonnées</th>
                <th>Messages</th>
              </tr>
            </thead>
            <tbody>
              {#each paginatedData as row}
                <tr class="row-{row.status}">
                  <td class="col-status">
                    <span class="status-badge status-{row.status}">
                      {#if row.status === 'ok'}✓
                      {:else if row.status === 'warning'}⚠
                      {:else if row.status === 'error'}✗
                      {:else}−{/if}
                    </span>
                  </td>
                  <td class="col-row">{row.row_idx}</td>
                  <td>{row.localite || '−'}</td>
                  <td><code>{row.code || '−'}</code></td>
                  <td>{row.date || '−'}</td>
                  <td class="col-coords">
                    {#if row.longitude && row.latitude}
                      <span class="coords" title="{row.latitude}, {row.longitude}">
                        {row.latitude.toFixed(4)}, {row.longitude.toFixed(4)}
                      </span>
                    {:else}
                      <span class="no-coords">−</span>
                    {/if}
                  </td>
                  <td class="col-messages">
                    {#if row.errors.length > 0}
                      <div class="messages messages-error">
                        <strong>Erreurs:</strong>
                        <ul>
                          {#each row.errors as error}
                            <li>{error}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                    {#if row.warnings.length > 0}
                      <div class="messages messages-warning">
                        <strong>Warnings:</strong>
                        <ul>
                          {#each row.warnings as warning}
                            <li>{warning}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                    {#if row.errors.length === 0 && row.warnings.length === 0}
                      <span class="text-muted">−</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        {#if totalPages > 1}
          <div class="pagination">
            <button
              type="button"
              class="pagination-btn"
              disabled={currentPage === 1}
              on:click={() => handlePageChange(currentPage - 1)}
            >
              ‹ Précédent
            </button>

            <span class="pagination-info">
              Page {currentPage} / {totalPages}
              <span class="text-muted">({filteredData.length} lignes)</span>
            </span>

            <button
              type="button"
              class="pagination-btn"
              disabled={currentPage === totalPages}
              on:click={() => handlePageChange(currentPage + 1)}
            >
              Suivant ›
            </button>
          </div>
        {/if}
      </div>

      <!-- Carte -->
      {#if showMap}
        <div class="map-panel">
          <div class="map-header">
            <h3>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              Carte des sondages
            </h3>
            <div class="map-legend">
              <span class="legend-item"><span class="legend-dot legend-ok"></span> Valide</span>
              <span class="legend-item"><span class="legend-dot legend-warning"></span> Warning</span>
              <span class="legend-item"><span class="legend-dot legend-error"></span> Erreur</span>
            </div>
          </div>
          <div id="preview-map" class="map-container"></div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .preview-step {
    padding: 2rem;
    max-width: 100%;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  h2 {
    margin: 0 0 0.25rem;
    color: #333;
  }

  .subtitle {
    margin: 0;
    color: #666;
    font-size: 0.95rem;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: white;
    color: #4a90e2;
    border: 1px solid #4a90e2;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #4a90e2;
    color: white;
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  .btn-primary:hover {
    background: #357abd;
  }

  .loading-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }

  .spinner-large {
    width: 64px;
    height: 64px;
    border: 6px solid #f3f3f3;
    border-top: 6px solid #4a90e2;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1.5rem;
  }

  .loading-overlay p {
    margin: 0.5rem 0;
    color: #666;
  }

  .loading-hint {
    font-size: 0.875rem;
    color: #999;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    color: #999;
  }

  .empty-state svg {
    margin-bottom: 1.5rem;
    opacity: 0.5;
  }

  .empty-state h3 {
    margin: 0 0 0.5rem;
    color: #666;
  }

  .empty-state p {
    margin: 0 0 1.5rem;
    color: #999;
  }

  .alert {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    border-left: 4px solid;
  }

  .alert svg {
    flex-shrink: 0;
  }

  .alert strong {
    display: block;
    margin-bottom: 0.25rem;
  }

  .alert p {
    margin: 0;
    font-size: 0.9rem;
  }

  .alert-error {
    background: #ffebee;
    border-color: #f44336;
    color: #c62828;
  }

  .alert-warning {
    background: #fff3e0;
    border-color: #ff9800;
    color: #e65100;
  }

  .alert-success {
    background: #e8f5e9;
    border-color: #43a047;
    color: #2e7d32;
  }

  .stats-panel {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 10px;
    transition: transform 0.2s;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .stat-icon {
    font-size: 2rem;
  }

  .stat-content {
    flex: 1;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 0.25rem;
  }

  .stat-percent {
    font-size: 0.75rem;
    color: #999;
  }

  .stat-total { border-color: #2196f3; }
  .stat-total .stat-value { color: #2196f3; }

  .stat-ok { border-color: #43a047; }
  .stat-ok .stat-value { color: #43a047; }

  .stat-warning { border-color: #ff9800; }
  .stat-warning .stat-value { color: #ff9800; }

  .stat-error { border-color: #f44336; }
  .stat-error .stat-value { color: #f44336; }

  .content-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .content-layout.has-map {
    grid-template-columns: 1fr 500px;
  }

  .table-panel,
  .map-panel {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
  }

  .table-header,
  .map-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e0e0e0;
    background: #f8f9fa;
  }

  .table-header h3,
  .map-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #333;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .filter-btn {
    padding: 0.5rem 0.875rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .filter-btn:hover {
    border-color: #4a90e2;
  }

  .filter-btn.active {
    background: #4a90e2;
    color: white;
    border-color: #4a90e2;
  }

  .filter-btn.filter-ok.active {
    background: #43a047;
    border-color: #43a047;
  }

  .filter-btn.filter-warning.active {
    background: #ff9800;
    border-color: #ff9800;
  }

  .filter-btn.filter-error.active {
    background: #f44336;
    border-color: #f44336;
  }

  .table-container {
    overflow-x: auto;
    max-height: 600px;
    overflow-y: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  th {
    position: sticky;
    top: 0;
    background: #f5f5f5;
    padding: 0.875rem;
    text-align: left;
    font-weight: 600;
    color: #555;
    border-bottom: 2px solid #ddd;
    white-space: nowrap;
    z-index: 1;
  }

  td {
    padding: 0.875rem;
    border-bottom: 1px solid #eee;
    vertical-align: top;
  }

  .col-status {
    width: 60px;
    text-align: center;
  }

  .col-row {
    width: 60px;
    text-align: right;
    color: #999;
    font-size: 0.8rem;
  }

  .col-coords {
    font-family: monospace;
    font-size: 0.8rem;
  }

  .col-messages {
    max-width: 400px;
  }

  tbody tr:hover {
    background: #f9f9f9;
  }

  tbody tr.row-error {
    background: #ffebee;
  }

  tbody tr.row-warning {
    background: #fff3e0;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .status-ok {
    background: #e8f5e9;
    color: #43a047;
  }

  .status-warning {
    background: #fff3e0;
    color: #f57c00;
  }

  .status-error {
    background: #ffebee;
    color: #f44336;
  }

  .coords {
    padding: 0.25rem 0.5rem;
    background: #e3f2fd;
    border-radius: 4px;
    display: inline-block;
  }

  .no-coords {
    color: #ccc;
  }

  .messages {
    margin: 0.25rem 0;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    font-size: 0.8rem;
  }

  .messages strong {
    display: block;
    margin-bottom: 0.25rem;
  }

  .messages ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  .messages li {
    margin: 0.125rem 0;
  }

  .messages-error {
    background: #ffebee;
    color: #c62828;
  }

  .messages-warning {
    background: #fff3e0;
    color: #e65100;
  }

  .text-muted {
    color: #ccc;
  }

  code {
    padding: 0.125rem 0.375rem;
    background: #f5f5f5;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.85em;
  }

  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e0e0e0;
  }

  .pagination-btn {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .pagination-btn:hover:not(:disabled) {
    background: #4a90e2;
    color: white;
    border-color: #4a90e2;
  }

  .pagination-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .pagination-info {
    font-size: 0.875rem;
    color: #666;
  }

  .map-legend {
    display: flex;
    gap: 1rem;
    font-size: 0.8rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }

  .legend-ok { background-color: #43a047; }
  .legend-warning { background-color: #ff9800; }
  .legend-error { background-color: #f44336; }

  .map-container {
    height: 600px;
    background: #f0f0f0;
  }

  @media (max-width: 1200px) {
    .content-layout.has-map {
      grid-template-columns: 1fr;
    }
  }
</style>
