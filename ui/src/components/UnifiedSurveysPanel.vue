<template>
  <div class="unified-surveys-panel">
    <div class="panel-header">
      <h2>📍 Localités Unifiées</h2>
      <div class="header-actions">
        <button @click="refreshData" class="btn-refresh" :disabled="loading">
          <span v-if="!loading">🔄 Rafraîchir</span>
          <span v-else>⏳ Chargement...</span>
        </button>
        <button @click="refreshView" class="btn-primary">
          ⚡ Refresh Vue
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_localites }}</div>
        <div class="stat-label">Localités Uniques</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_sondages }}</div>
        <div class="stat-label">Sondages Total</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">{{ stats.localites_avec_doublons }}</div>
        <div class="stat-label">Avec Doublons</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">{{ stats.total_essais }}</div>
        <div class="stat-label">Essais Total</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-value">{{ stats.sondages_sans_geom }}</div>
        <div class="stat-label">Sans Géométrie</div>
      </div>
    </div>

    <!-- Filtres -->
    <div class="filters">
      <input
        v-model="searchQuery"
        @input="debouncedSearch"
        type="text"
        placeholder="🔍 Rechercher une localité..."
        class="search-input"
      />
      <select v-model="filterGeometry" @change="loadSurveys" class="filter-select">
        <option value="">Toutes</option>
        <option value="true">Avec géométrie</option>
        <option value="false">Sans géométrie</option>
      </select>
    </div>

    <!-- Liste -->
    <div class="surveys-list" v-if="!loading">
      <div
        v-for="survey in surveys"
        :key="survey.localite_key"
        class="survey-card"
        @click="selectSurvey(survey)"
        :class="{ selected: selectedSurvey?.localite_key === survey.localite_key }"
      >
        <div class="survey-header">
          <h3>{{ survey.localite }}</h3>
          <span class="badge" v-if="survey.variants > 1">
            {{ survey.variants }} variantes
          </span>
        </div>

        <div class="survey-meta">
          <span v-if="survey.adm3_name" class="meta-item">
            📍 {{ survey.adm3_name }}
          </span>
          <span v-if="survey.latest_date" class="meta-item">
            📅 {{ formatDate(survey.latest_date) }}
          </span>
          <span class="meta-item" :class="{ 'text-danger': !survey.has_geometry }">
            {{ survey.has_geometry ? '✅ Géocodé' : '❌ Non géocodé' }}
          </span>
        </div>

        <div class="survey-types">
          <span v-if="survey.has_granulo" class="type-badge granulo">
            🪨 Granulo ({{ survey.granulo_count }})
          </span>
          <span v-if="survey.has_bleu" class="type-badge vbs">
            💧 VBS ({{ survey.vbs_count }})
          </span>
          <span v-if="survey.has_limite" class="type-badge atterberg">
            📊 Atterberg ({{ survey.atterberg_count }})
          </span>
        </div>

        <div class="survey-footer">
          <span class="total-essais">
            {{ survey.total_essais }} essais • {{ survey.echantillons_count }} échantillons
          </span>
        </div>
      </div>

      <div v-if="surveys.length === 0" class="empty-state">
        <p>Aucune localité trouvée</p>
      </div>
    </div>

    <div v-else class="loading-state">
      <p>⏳ Chargement des localités...</p>
    </div>

    <!-- Détails -->
    <div v-if="selectedSurvey" class="survey-details-modal" @click.self="selectedSurvey = null">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ selectedSurvey.localite }}</h2>
          <button @click="selectedSurvey = null" class="btn-close">✕</button>
        </div>

        <div class="modal-body">
          <div class="detail-section">
            <h3>Sondages ({{ selectedSurvey.survey_codes.length }})</h3>
            <ul class="codes-list">
              <li v-for="code in selectedSurvey.survey_codes" :key="code">
                {{ code }}
              </li>
            </ul>
          </div>

          <div class="detail-section">
            <h3>Statistiques</h3>
            <table class="stats-table">
              <tr>
                <td>Granulométrie:</td>
                <td><strong>{{ selectedSurvey.granulo_count }}</strong> points</td>
              </tr>
              <tr>
                <td>VBS:</td>
                <td><strong>{{ selectedSurvey.vbs_count }}</strong> essais</td>
              </tr>
              <tr>
                <td>Atterberg:</td>
                <td><strong>{{ selectedSurvey.atterberg_count }}</strong> essais</td>
              </tr>
              <tr>
                <td>Échantillons:</td>
                <td><strong>{{ selectedSurvey.echantillons_count }}</strong></td>
              </tr>
              <tr class="total-row">
                <td>Total:</td>
                <td><strong>{{ selectedSurvey.total_essais }}</strong> essais</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { debounce } from 'lodash-es';

interface UnifiedSurvey {
  localite_key: string;
  localite: string;
  survey_ids: string[];
  survey_codes: string[];
  has_bleu: boolean;
  has_limite: boolean;
  has_granulo: boolean;
  has_vbs: boolean;
  variants: number;
  adm3_id: string | null;
  adm3_name: string | null;
  has_geometry: boolean;
  latest_date: string | null;
  atterberg_count: number;
  granulo_count: number;
  vbs_count: number;
  echantillons_count: number;
  total_essais: number;
}

interface UnifiedStats {
  total_localites: number;
  total_sondages: number;
  localites_avec_doublons: number;
  total_essais: number;
  sondages_sans_geom: number;
}

const surveys = ref<UnifiedSurvey[]>([]);
const stats = ref<UnifiedStats | null>(null);
const loading = ref(false);
const searchQuery = ref('');
const filterGeometry = ref('');
const selectedSurvey = ref<UnifiedSurvey | null>(null);

const loadSurveys = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (searchQuery.value) params.append('q', searchQuery.value);
    if (filterGeometry.value) params.append('has_geometry', filterGeometry.value);
    params.append('limit', '100');

    const response = await fetch(`/api/surveys/unified?${params}`);
    surveys.value = await response.json();
  } catch (error) {
    console.error('Erreur chargement localités:', error);
  } finally {
    loading.value = false;
  }
};

const loadStats = async () => {
  try {
    const response = await fetch('/api/surveys/unified/stats');
    stats.value = await response.json();
  } catch (error) {
    console.error('Erreur chargement stats:', error);
  }
};

const refreshView = async () => {
  try {
    await fetch('/api/surveys/unified/refresh', { method: 'POST' });
    await refreshData();
    alert('✅ Vue matérialisée rafraîchie!');
  } catch (error) {
    console.error('Erreur refresh:', error);
    alert('❌ Erreur lors du refresh');
  }
};

const refreshData = async () => {
  await Promise.all([loadSurveys(), loadStats()]);
};

const debouncedSearch = debounce(() => {
  loadSurveys();
}, 300);

const selectSurvey = (survey: UnifiedSurvey) => {
  selectedSurvey.value = survey;
};

const formatDate = (date: string | null) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('fr-FR');
};

onMounted(() => {
  refreshData();
});
</script>

<style scoped>
.unified-surveys-panel {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.panel-header h2 {
  margin: 0;
  font-size: 24px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn-refresh,
.btn-primary {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-refresh {
  background: #6c757d;
  color: white;
}

.btn-refresh:hover:not(:disabled) {
  background: #5a6268;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.stat-card.warning {
  border-left: 4px solid #ffc107;
}

.stat-card.success {
  border-left: 4px solid #28a745;
}

.stat-card.danger {
  border-left: 4px solid #dc3545;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.search-input,
.filter-select {
  padding: 10px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;
}

.search-input {
  flex: 1;
}

.filter-select {
  min-width: 200px;
}

.surveys-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 15px;
}

.survey-card {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.2s;
}

.survey-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.survey-card.selected {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.survey-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.survey-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.badge {
  background: #007bff;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.survey-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #666;
}

.meta-item {
  display: inline-block;
}

.text-danger {
  color: #dc3545;
}

.survey-types {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.type-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.type-badge.granulo {
  background: #e3f2fd;
  color: #1976d2;
}

.type-badge.vbs {
  background: #e8f5e9;
  color: #388e3c;
}

.type-badge.atterberg {
  background: #fff3e0;
  color: #f57c00;
}

.survey-footer {
  padding-top: 10px;
  border-top: 1px solid #eee;
  font-size: 13px;
  color: #666;
}

.total-essais {
  font-weight: 500;
}

.empty-state,
.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
  font-size: 16px;
}

.survey-details-modal {
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

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #dee2e6;
}

.modal-header h2 {
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.btn-close:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #333;
}

.codes-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.codes-list li {
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 5px;
  font-family: monospace;
  font-size: 13px;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
}

.stats-table tr {
  border-bottom: 1px solid #eee;
}

.stats-table td {
  padding: 10px 0;
}

.stats-table td:last-child {
  text-align: right;
}

.stats-table .total-row {
  border-top: 2px solid #333;
  font-weight: bold;
}
</style>
