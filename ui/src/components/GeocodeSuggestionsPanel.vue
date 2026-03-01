<template>
  <div class="geocode-suggestions-panel">
    <div class="panel-header">
      <h2>🎯 Suggestions de Géocodage</h2>
      <button @click="refreshData" class="btn-refresh" :disabled="loading">
        <span v-if="!loading">🔄 Rafraîchir</span>
        <span v-else>⏳ Chargement...</span>
      </button>
    </div>

    <!-- Stats -->
    <div class="stats-row" v-if="stats">
      <div class="stat-item">
        <span class="stat-label">Total:</span>
        <span class="stat-value">{{ stats.total }}</span>
      </div>
      <div class="stat-item pending">
        <span class="stat-label">En attente:</span>
        <span class="stat-value">{{ stats.pending }}</span>
      </div>
      <div class="stat-item success">
        <span class="stat-label">Acceptées:</span>
        <span class="stat-value">{{ stats.accepted }}</span>
      </div>
      <div class="stat-item danger">
        <span class="stat-label">Rejetées:</span>
        <span class="stat-value">{{ stats.rejected }}</span>
      </div>
    </div>

    <!-- Filtres -->
    <div class="filters">
      <select v-model="filterStatus" @change="loadSuggestions" class="filter-select">
        <option value="">Tous les statuts</option>
        <option value="pending">En attente</option>
        <option value="done">Acceptées</option>
        <option value="rejected">Rejetées</option>
      </select>
      <select v-model="filterReason" @change="loadSuggestions" class="filter-select">
        <option value="">Toutes les raisons</option>
        <option value="missing_location">Localisation manquante</option>
        <option value="missing_geometry">Géométrie manquante</option>
      </select>
    </div>

    <!-- Liste des suggestions -->
    <div class="suggestions-list" v-if="!loading">
      <div
        v-for="suggestion in suggestions"
        :key="suggestion.id"
        class="suggestion-card"
        :class="{ 
          pending: suggestion.status === 'pending',
          done: suggestion.status === 'done',
          rejected: suggestion.status === 'rejected'
        }"
      >
        <div class="suggestion-header">
          <div>
            <h3>{{ suggestion.payload.code }}</h3>
            <p class="localite">{{ suggestion.payload.localite_base || 'N/A' }}</p>
          </div>
          <span class="status-badge" :class="suggestion.status">
            {{ getStatusLabel(suggestion.status) }}
          </span>
        </div>

        <div class="suggestion-meta">
          <span class="meta-item">
            📍 {{ suggestion.reason === 'missing_location' ? 'Localisation manquante' : 'Géométrie manquante' }}
          </span>
          <span class="meta-item">
            🏷️ {{ suggestion.payload.source }}
          </span>
          <span class="meta-item">
            📅 {{ formatDate(suggestion.created_at) }}
          </span>
        </div>

        <div v-if="suggestion.payload.adm3_name" class="suggestion-info">
          <strong>ADM3:</strong> {{ suggestion.payload.adm3_name }}
        </div>

        <div v-if="suggestion.status === 'pending'" class="suggestion-actions">
          <button
            @click="showAcceptModal(suggestion)"
            class="btn-accept"
          >
            ✅ Accepter
          </button>
          <button
            @click="rejectSuggestion(suggestion.id)"
            class="btn-reject"
          >
            ❌ Rejeter
          </button>
        </div>
      </div>

      <div v-if="suggestions.length === 0" class="empty-state">
        <p>Aucune suggestion trouvée</p>
      </div>
    </div>

    <div v-else class="loading-state">
      <p>⏳ Chargement des suggestions...</p>
    </div>

    <!-- Modal d'acceptation -->
    <div v-if="acceptModal.show" class="modal-overlay" @click.self="closeAcceptModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Accepter la suggestion</h2>
          <button @click="closeAcceptModal" class="btn-close">✕</button>
        </div>

        <div class="modal-body">
          <p><strong>Code:</strong> {{ acceptModal.suggestion?.payload.code }}</p>
          <p><strong>Localité:</strong> {{ acceptModal.suggestion?.payload.localite_base }}</p>

          <div class="accept-options">
            <h3>Choisissez le mode de géocodage:</h3>

            <div class="option-group">
              <label>
                <input type="radio" v-model="acceptModal.mode" value="adm3" />
                <span>Par ADM3 (commune)</span>
              </label>
              <select
                v-if="acceptModal.mode === 'adm3'"
                v-model="acceptModal.adm3_id"
                class="adm3-select"
              >
                <option value="">Sélectionner une commune...</option>
                <option v-for="adm in adm3List" :key="adm.id" :value="adm.id">
                  {{ adm.name }} ({{ adm.adm2_name }})
                </option>
              </select>
            </div>

            <div class="option-group">
              <label>
                <input type="radio" v-model="acceptModal.mode" value="coords" />
                <span>Par coordonnées exactes</span>
              </label>
              <div v-if="acceptModal.mode === 'coords'" class="coords-inputs">
                <input
                  v-model.number="acceptModal.lon"
                  type="number"
                  step="0.000001"
                  placeholder="Longitude"
                  class="coord-input"
                />
                <input
                  v-model.number="acceptModal.lat"
                  type="number"
                  step="0.000001"
                  placeholder="Latitude"
                  class="coord-input"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeAcceptModal" class="btn-cancel">
            Annuler
          </button>
          <button
            @click="acceptSuggestion"
            class="btn-confirm"
            :disabled="!canAccept"
          >
            ✅ Confirmer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface GeocodeSuggestion {
  id: string;
  sondage_id: string;
  reason: string;
  status: string;
  payload: {
    code: string;
    source: string;
    adm3_id: string | null;
    adm3_name: string | null;
    localite_key: string;
    localite_base: string;
  };
  created_at: string;
  updated_at: string;
}

interface GeocodeStats {
  total: number;
  accepted: number;
  pending: number;
  rejected: number;
  no_suggestion: number;
}

interface ADM3 {
  id: string;
  name: string;
  adm2_name: string;
}

const suggestions = ref<GeocodeSuggestion[]>([]);
const stats = ref<GeocodeStats | null>(null);
const adm3List = ref<ADM3[]>([]);
const loading = ref(false);
const filterStatus = ref('pending');
const filterReason = ref('');

const acceptModal = ref({
  show: false,
  suggestion: null as GeocodeSuggestion | null,
  mode: 'adm3',
  adm3_id: '',
  lon: null as number | null,
  lat: null as number | null,
});

const canAccept = computed(() => {
  if (acceptModal.value.mode === 'adm3') {
    return !!acceptModal.value.adm3_id;
  }
  return acceptModal.value.lon !== null && acceptModal.value.lat !== null;
});

const loadSuggestions = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filterStatus.value) params.append('status', filterStatus.value);
    if (filterReason.value) params.append('reason', filterReason.value);
    params.append('limit', '100');

    const response = await fetch(`/api/geocode/suggestions?${params}`);
    suggestions.value = await response.json();
  } catch (error) {
    console.error('Erreur chargement suggestions:', error);
  } finally {
    loading.value = false;
  }
};

const loadStats = async () => {
  try {
    const response = await fetch('/api/geocode/stats');
    stats.value = await response.json();
  } catch (error) {
    console.error('Erreur chargement stats:', error);
  }
};

const loadADM3 = async () => {
  try {
    const response = await fetch('/api/adm3');
    adm3List.value = await response.json();
  } catch (error) {
    console.error('Erreur chargement ADM3:', error);
  }
};

const refreshData = async () => {
  await Promise.all([loadSuggestions(), loadStats()]);
};

const showAcceptModal = (suggestion: GeocodeSuggestion) => {
  acceptModal.value = {
    show: true,
    suggestion,
    mode: 'adm3',
    adm3_id: suggestion.payload.adm3_id || '',
    lon: null,
    lat: null,
  };
};

const closeAcceptModal = () => {
  acceptModal.value = {
    show: false,
    suggestion: null,
    mode: 'adm3',
    adm3_id: '',
    lon: null,
    lat: null,
  };
};

const acceptSuggestion = async () => {
  if (!acceptModal.value.suggestion) return;

  try {
    const payload: any = {};

    if (acceptModal.value.mode === 'adm3') {
      payload.adm3_id = acceptModal.value.adm3_id;
    } else {
      payload.lon = acceptModal.value.lon;
      payload.lat = acceptModal.value.lat;
    }

    const response = await fetch(
      `/api/geocode/suggestions/${acceptModal.value.suggestion.id}/accept`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      alert('✅ Suggestion acceptée!');
      closeAcceptModal();
      await refreshData();
    } else {
      const error = await response.text();
      alert(`❌ Erreur: ${error}`);
    }
  } catch (error) {
    console.error('Erreur acceptation:', error);
    alert('❌ Erreur lors de l\'acceptation');
  }
};

const rejectSuggestion = async (id: string) => {
  if (!confirm('Êtes-vous sûr de vouloir rejeter cette suggestion?')) return;

  try {
    const response = await fetch(`/api/geocode/suggestions/${id}/reject`, {
      method: 'POST',
    });

    if (response.ok) {
      alert('✅ Suggestion rejetée');
      await refreshData();
    } else {
      alert('❌ Erreur lors du rejet');
    }
  } catch (error) {
    console.error('Erreur rejet:', error);
    alert('❌ Erreur lors du rejet');
  }
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'En attente',
    done: 'Acceptée',
    rejected: 'Rejetée',
  };
  return labels[status] || status;
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

onMounted(() => {
  refreshData();
  loadADM3();
});
</script>

<style scoped>
.geocode-suggestions-panel {
  padding: 20px;
  max-width: 1200px;
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

.btn-refresh {
  padding: 8px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-refresh:hover:not(:disabled) {
  background: #5a6268;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.stats-row {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.stat-item {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 15px 20px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.stat-item.pending {
  border-left: 4px solid #ffc107;
}

.stat-item.success {
  border-left: 4px solid #28a745;
}

.stat-item.danger {
  border-left: 4px solid #dc3545;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.filter-select {
  padding: 10px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;
  min-width: 200px;
}

.suggestions-list {
  display: grid;
  gap: 15px;
}

.suggestion-card {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  transition: all 0.2s;
}

.suggestion-card.pending {
  border-left: 4px solid #ffc107;
}

.suggestion-card.done {
  border-left: 4px solid #28a745;
  opacity: 0.7;
}

.suggestion-card.rejected {
  border-left: 4px solid #dc3545;
  opacity: 0.7;
}

.suggestion-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.suggestion-header h3 {
  margin: 0 0 5px 0;
  font-size: 16px;
  color: #333;
}

.localite {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.done {
  background: #d4edda;
  color: #155724;
}

.status-badge.rejected {
  background: #f8d7da;
  color: #721c24;
}

.suggestion-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #666;
}

.suggestion-info {
  margin-bottom: 10px;
  font-size: 14px;
}

.suggestion-actions {
  display: flex;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.btn-accept,
.btn-reject {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-accept {
  background: #28a745;
  color: white;
}

.btn-accept:hover {
  background: #218838;
}

.btn-reject {
  background: #dc3545;
  color: white;
}

.btn-reject:hover {
  background: #c82333;
}

.empty-state,
.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
  font-size: 16px;
}

.modal-overlay {
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
  font-size: 20px;
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

.modal-body p {
  margin: 10px 0;
}

.accept-options {
  margin-top: 20px;
}

.accept-options h3 {
  font-size: 16px;
  margin-bottom: 15px;
}

.option-group {
  margin-bottom: 20px;
}

.option-group label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  cursor: pointer;
}

.adm3-select,
.coord-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;
  margin-top: 10px;
}

.coords-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #dee2e6;
}

.btn-cancel,
.btn-confirm {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-cancel {
  background: #6c757d;
  color: white;
}

.btn-cancel:hover {
  background: #5a6268;
}

.btn-confirm {
  background: #28a745;
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  background: #218838;
}

.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
