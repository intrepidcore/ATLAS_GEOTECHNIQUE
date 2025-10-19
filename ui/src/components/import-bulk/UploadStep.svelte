<script lang="ts">
  import { importBulkStore, importBulkActions } from '../../stores/import-bulk-store';
  import { ImportBulkAPI } from '../../services/import-bulk-api';

  let dragOver = false;
  let fileInput: HTMLInputElement;
  let loading = false;
  let error: string | null = null;
  let previewRows: any[] = [];

  $: file = $importBulkStore.file;
  $: columns = $importBulkStore.columns;

  async function handleFileDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    await loadFile(files[0]);
  }

  async function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) return;

    await loadFile(files[0]);
  }

  async function loadFile(selectedFile: File) {
    loading = true;
    error = null;

    try {
      // Vérifier taille (max 50 MB)
      const maxSize = 50 * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        throw new Error(`Fichier trop volumineux (max 50 MB). Taille: ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`);
      }

      // Détecter format
      const format = ImportBulkAPI.detectFormat(selectedFile.name);

      // Lire colonnes
      const detectedColumns = await ImportBulkAPI.detectColumns(selectedFile);

      if (detectedColumns.length === 0) {
        throw new Error('Aucune colonne détectée dans le fichier');
      }

      // Preview premières lignes
      previewRows = await readPreview(selectedFile, format);

      // Stocker dans le store
      importBulkActions.setFile(selectedFile, format, detectedColumns);
    } catch (err: any) {
      error = err.message;
      importBulkActions.setError(err.message);
    } finally {
      loading = false;
    }
  }

  async function readPreview(file: File, format: string): Promise<any[]> {
    // Lire premières 10 lignes pour preview
    if (format === 'csv') {
      const text = await file.slice(0, 4096).text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length === 0) return [];

      const separator = detectSeparator(lines[0]);
      const headers = lines[0].split(separator).map(h => h.trim().replace(/['"]/g, ''));

      return lines.slice(1, 11).map(line => {
        const values = line.split(separator);
        const row: any = {};
        headers.forEach((h, i) => {
          row[h] = values[i]?.trim().replace(/['"]/g, '') || '';
        });
        return row;
      });
    }

    return [];
  }

  function detectSeparator(line: string): string {
    const separators = [',', ';', '\t', '|'];
    const counts = separators.map(sep => line.split(sep).length);
    const maxCount = Math.max(...counts);
    const index = counts.indexOf(maxCount);
    return separators[index];
  }

  function clearFile() {
    importBulkActions.setFile(null, 'csv', []);
    previewRows = [];
    error = null;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  function downloadTemplate(type: string) {
    ImportBulkAPI.downloadTemplate(type)
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `template_${type}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(err => {
        error = `Erreur téléchargement template: ${err.message}`;
      });
  }
</script>

<div class="upload-step">
  <h2>Étape 1 : Sélectionner le fichier</h2>

  {#if !file}
    <!-- Zone de drop -->
    <div
      class="drop-zone"
      class:drag-over={dragOver}
      on:drop={handleFileDrop}
      on:dragover={e => { e.preventDefault(); dragOver = true; }}
      on:dragleave={() => { dragOver = false; }}
      on:click={() => fileInput.click()}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>

      <h3>Glissez un fichier ici</h3>
      <p>ou <button type="button" class="link-button">parcourir</button></p>
      <p class="hint">CSV, Excel ou JSON (max 50 MB)</p>
    </div>

    <input
      type="file"
      bind:this={fileInput}
      on:change={handleFileSelect}
      accept=".csv,.xlsx,.xls,.json"
      style="display: none;"
    />

    <!-- Templates -->
    <div class="templates">
      <h4>Télécharger un template :</h4>
      <div class="template-buttons">
        <button type="button" on:click={() => downloadTemplate('granulometrie')}>
          Granulométrie
        </button>
        <button type="button" on:click={() => downloadTemplate('vbs')}>
          Bleu de Méthylène (VBS)
        </button>
        <button type="button" on:click={() => downloadTemplate('atterberg')}>
          Limites d'Atterberg
        </button>
      </div>
    </div>

  {:else}
    <!-- Fichier sélectionné -->
    <div class="file-info">
      <div class="file-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <div class="file-details">
          <strong>{file.name}</strong>
          <span class="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          <span class="file-format badge">{$importBulkStore.fileFormat.toUpperCase()}</span>
        </div>
        <button type="button" class="btn-remove" on:click={clearFile}>
          Changer
        </button>
      </div>

      {#if columns.length > 0}
        <div class="columns-detected">
          <h4>Colonnes détectées ({columns.length}) :</h4>
          <div class="columns-list">
            {#each columns as col}
              <span class="column-badge">{col}</span>
            {/each}
          </div>
        </div>
      {/if}

      {#if previewRows.length > 0}
        <div class="preview-table">
          <h4>Aperçu (10 premières lignes) :</h4>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  {#each columns as col}
                    <th>{col}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each previewRows as row}
                  <tr>
                    {#each columns as col}
                      <td>{row[col] || ''}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if error}
    <div class="alert alert-error">
      <strong>Erreur :</strong> {error}
    </div>
  {/if}

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Lecture du fichier...</p>
    </div>
  {/if}
</div>

<style>
  .upload-step {
    padding: 2rem;
  }

  h2 {
    margin-bottom: 1.5rem;
    color: #333;
  }

  .drop-zone {
    border: 3px dashed #ccc;
    border-radius: 12px;
    padding: 3rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #f9f9f9;
  }

  .drop-zone:hover,
  .drop-zone.drag-over {
    border-color: #4a90e2;
    background: #f0f7ff;
  }

  .drop-zone svg {
    color: #999;
    margin-bottom: 1rem;
  }

  .drop-zone h3 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    color: #555;
  }

  .drop-zone p {
    margin: 0.25rem 0;
    color: #777;
  }

  .drop-zone .hint {
    font-size: 0.875rem;
    color: #999;
  }

  .link-button {
    background: none;
    border: none;
    color: #4a90e2;
    text-decoration: underline;
    cursor: pointer;
    font-size: inherit;
    padding: 0;
  }

  .templates {
    margin-top: 2rem;
    padding: 1.5rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .templates h4 {
    margin: 0 0 1rem;
    color: #555;
    font-size: 1rem;
  }

  .template-buttons {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .template-buttons button {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .template-buttons button:hover {
    background: #4a90e2;
    color: white;
    border-color: #4a90e2;
  }

  .file-info {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1.5rem;
    background: white;
  }

  .file-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #eee;
  }

  .file-header svg {
    color: #4a90e2;
  }

  .file-details {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .file-size {
    color: #777;
    font-size: 0.875rem;
  }

  .badge {
    padding: 0.25rem 0.5rem;
    background: #4a90e2;
    color: white;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .btn-remove {
    padding: 0.5rem 1rem;
    background: #f44336;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-remove:hover {
    background: #d32f2f;
  }

  .columns-detected {
    margin-top: 1.5rem;
  }

  .columns-detected h4 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    color: #555;
  }

  .columns-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .column-badge {
    padding: 0.4rem 0.75rem;
    background: #e3f2fd;
    color: #1976d2;
    border-radius: 20px;
    font-size: 0.875rem;
    font-family: monospace;
  }

  .preview-table {
    margin-top: 1.5rem;
  }

  .preview-table h4 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    color: #555;
  }

  .table-container {
    overflow-x: auto;
    border: 1px solid #ddd;
    border-radius: 6px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  th {
    background: #f5f5f5;
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid #ddd;
    white-space: nowrap;
  }

  td {
    padding: 0.75rem;
    border-bottom: 1px solid #eee;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  tbody tr:hover {
    background: #f9f9f9;
  }

  .alert {
    margin-top: 1rem;
    padding: 1rem;
    border-radius: 6px;
    border-left: 4px solid;
  }

  .alert-error {
    background: #ffebee;
    border-color: #f44336;
    color: #c62828;
  }

  .loading {
    text-align: center;
    padding: 2rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #4a90e2;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
