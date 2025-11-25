/**
 * filters-state.ts - État centralisé des filtres pour toutes les couches
 * Source unique de vérité pour les filtres ADM, données, sondages, essais
 */

export interface FiltersState {
  adm1: string | null;
  adm2: string | null;
  adm3: string | null;
  hasData: boolean;
  noData: boolean;
  minSondages: number;
  minEssais: number;
}

// État global des filtres
export const currentFilters: FiltersState = {
  adm1: null,
  adm2: null,
  adm3: null,
  hasData: true,
  noData: true,
  minSondages: 0,
  minEssais: 0,
};

// Statistiques filtrées
export interface FilteredStats {
  visibleCount: number;
  withDataCount: number;
  sondagesCount: number;
  echantillonsCount: number;
  essaisCount: number;
  // Par type d'essai
  atterbergCount: number;
  vbsCount: number;
  physiquesCount: number;
  classifCount: number;
}

export const filteredStats: FilteredStats = {
  visibleCount: 0,
  withDataCount: 0,
  sondagesCount: 0,
  echantillonsCount: 0,
  essaisCount: 0,
  atterbergCount: 0,
  vbsCount: 0,
  physiquesCount: 0,
  classifCount: 0,
};

/**
 * Lit les valeurs des filtres depuis le DOM et met à jour currentFilters
 */
export function syncFiltersFromDOM(): void {
  const adm1El = document.getElementById('filterAdm1') as HTMLSelectElement;
  const adm2El = document.getElementById('filterAdm2') as HTMLSelectElement;
  const adm3El = document.getElementById('filterAdm3') as HTMLSelectElement;
  const hasDataEl = document.getElementById('filterHasData') as HTMLInputElement;
  const noDataEl = document.getElementById('filterNoData') as HTMLInputElement;
  const minSondagesEl = document.getElementById('filterMinSondages') as HTMLInputElement;
  const minEssaisEl = document.getElementById('filterMinEssais') as HTMLInputElement;

  currentFilters.adm1 = adm1El?.value || null;
  currentFilters.adm2 = adm2El?.value || null;
  currentFilters.adm3 = adm3El?.value || null;
  currentFilters.hasData = hasDataEl?.checked ?? true;
  currentFilters.noData = noDataEl?.checked ?? true;
  currentFilters.minSondages = parseInt(minSondagesEl?.value) || 0;
  currentFilters.minEssais = parseInt(minEssaisEl?.value) || 0;
}

/**
 * Réinitialise les filtres à leurs valeurs par défaut
 */
export function resetFilters(): void {
  currentFilters.adm1 = null;
  currentFilters.adm2 = null;
  currentFilters.adm3 = null;
  currentFilters.hasData = true;
  currentFilters.noData = true;
  currentFilters.minSondages = 0;
  currentFilters.minEssais = 0;
}

/**
 * Vérifie si une feature (maille) correspond aux filtres actuels
 */
export function featureMatchesFilters(feature: any, filters: FiltersState = currentFilters): boolean {
  const p = feature?.properties ?? {};

  // Filtre ADM
  const matchAdm1 = !filters.adm1 || p.adm1_name === filters.adm1;
  const matchAdm2 = !filters.adm2 || p.adm2_name === filters.adm2;
  const matchAdm3 = !filters.adm3 || p.adm3_name === filters.adm3;

  // Filtre données
  const hasData = !!p.has_data;
  const matchDataFlag =
    (hasData && filters.hasData) ||
    (!hasData && filters.noData);

  // Filtre min sondages/essais
  const matchMinSondages = (p.n_sondages || 0) >= filters.minSondages;
  const matchMinEssais = (p.n_essais || 0) >= filters.minEssais;

  return matchAdm1 && matchAdm2 && matchAdm3 && matchDataFlag && matchMinSondages && matchMinEssais;
}

/**
 * Vérifie si un sondage correspond aux filtres ADM actuels
 */
export function surveyMatchesFilters(survey: any, filters: FiltersState = currentFilters): boolean {
  const matchAdm1 = !filters.adm1 || survey.adm1_name === filters.adm1;
  const matchAdm2 = !filters.adm2 || survey.adm2_name === filters.adm2;
  const matchAdm3 = !filters.adm3 || survey.adm3_name === filters.adm3;
  return matchAdm1 && matchAdm2 && matchAdm3;
}

/**
 * Calcule les statistiques pour un ensemble de features filtrées
 */
export function computeFilteredStats(features: any[]): FilteredStats {
  const stats: FilteredStats = {
    visibleCount: 0,
    withDataCount: 0,
    sondagesCount: 0,
    echantillonsCount: 0,
    essaisCount: 0,
    atterbergCount: 0,
    vbsCount: 0,
    physiquesCount: 0,
    classifCount: 0,
  };

  for (const f of features) {
    const p = f.properties ?? {};
    stats.visibleCount++;
    if (p.has_data) stats.withDataCount++;
    stats.sondagesCount += p.n_sondages || 0;
    stats.echantillonsCount += p.n_echantillons || 0;
    stats.essaisCount += p.n_essais || 0;
    // Par type (si disponible dans les propriétés)
    stats.atterbergCount += p.n_atterberg || 0;
    stats.vbsCount += p.n_vbs || 0;
    stats.physiquesCount += p.n_physiques || 0;
    stats.classifCount += p.n_classif || 0;
  }

  // Mettre à jour l'état global
  Object.assign(filteredStats, stats);

  return stats;
}

/**
 * Met à jour les éléments DOM avec les statistiques filtrées
 */
export function updateStatsDOM(stats: FilteredStats = filteredStats): void {
  // Stats principales
  const statVisible = document.getElementById('statVisible');
  const statWithData = document.getElementById('statWithData');
  const statSondages = document.getElementById('statSondages');
  const statEssais = document.getElementById('statEssais');

  if (statVisible) statVisible.textContent = stats.visibleCount.toLocaleString();
  if (statWithData) statWithData.textContent = stats.withDataCount.toLocaleString();
  if (statSondages) statSondages.textContent = stats.sondagesCount.toLocaleString();
  if (statEssais) statEssais.textContent = stats.essaisCount.toLocaleString();

  // Stats par type d'essai
  const statAtterberg = document.getElementById('statAtterberg');
  const statVbs = document.getElementById('statVbs');
  const statPhysiques = document.getElementById('statPhysiques');
  const statClassif = document.getElementById('statClassif');

  if (statAtterberg) statAtterberg.textContent = stats.atterbergCount.toLocaleString();
  if (statVbs) statVbs.textContent = stats.vbsCount.toLocaleString();
  if (statPhysiques) statPhysiques.textContent = stats.physiquesCount.toLocaleString();
  if (statClassif) statClassif.textContent = stats.classifCount.toLocaleString();

  // Barre de répartition
  const total = stats.atterbergCount + stats.vbsCount + stats.physiquesCount + stats.classifCount;
  if (total > 0) {
    const barAtterberg = document.getElementById('barAtterberg');
    const barVbs = document.getElementById('barVbs');
    const barPhysiques = document.getElementById('barPhysiques');
    const barClassif = document.getElementById('barClassif');

    if (barAtterberg) barAtterberg.style.width = `${(stats.atterbergCount / total) * 100}%`;
    if (barVbs) barVbs.style.width = `${(stats.vbsCount / total) * 100}%`;
    if (barPhysiques) barPhysiques.style.width = `${(stats.physiquesCount / total) * 100}%`;
    if (barClassif) barClassif.style.width = `${(stats.classifCount / total) * 100}%`;
  }
}

// Callbacks pour notifier les changements de filtres
type FilterChangeCallback = (filters: FiltersState, stats: FilteredStats) => void;
const filterChangeCallbacks: FilterChangeCallback[] = [];

export function onFilterChange(callback: FilterChangeCallback): void {
  filterChangeCallbacks.push(callback);
}

export function notifyFilterChange(): void {
  for (const cb of filterChangeCallbacks) {
    cb(currentFilters, filteredStats);
  }
}

export default {
  currentFilters,
  filteredStats,
  syncFiltersFromDOM,
  resetFilters,
  featureMatchesFilters,
  surveyMatchesFilters,
  computeFilteredStats,
  updateStatsDOM,
  onFilterChange,
  notifyFilterChange,
};
