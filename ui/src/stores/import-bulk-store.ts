/**
 * Store Svelte pour l'état de l'import bulk
 */

import { writable, derived } from 'svelte/store';
import type { MappingConfig, GeolocationConfig, PreviewRow, ImportJob } from '../services/import-bulk-api';

export type WizardStep = 'upload' | 'mapping' | 'geolocation' | 'preview' | 'progress';

interface ImportBulkState {
  // Navigation
  currentStep: WizardStep;
  canGoNext: boolean;
  canGoPrevious: boolean;

  // Step 1: Upload
  file: File | null;
  fileFormat: 'csv' | 'xlsx' | 'json';
  columns: string[];

  // Step 2: Mapping
  mapping: MappingConfig;
  dataStructure: 'long' | 'large';

  // Step 3: Geolocation
  geolocation: GeolocationConfig;

  // Step 4: Preview
  previewData: PreviewRow[];
  previewStats: {
    total: number;
    ok: number;
    warnings: number;
    errors: number;
  };

  // Step 5: Progress
  importJob: ImportJob | null;
  pollingInterval: number | null;

  // Errors
  error: string | null;
  loading: boolean;
}

const initialState: ImportBulkState = {
  currentStep: 'upload',
  canGoNext: false,
  canGoPrevious: false,

  file: null,
  fileFormat: 'csv',
  columns: [],

  mapping: {
    structure: 'long',
  },
  dataStructure: 'long',

  geolocation: {
    mode: 'centroid',
  },

  previewData: [],
  previewStats: {
    total: 0,
    ok: 0,
    warnings: 0,
    errors: 0,
  },

  importJob: null,
  pollingInterval: null,

  error: null,
  loading: false,
};

export const importBulkStore = writable<ImportBulkState>(initialState);

// Derived stores
export const currentStep = derived(importBulkStore, $store => $store.currentStep);
export const file = derived(importBulkStore, $store => $store.file);
export const mapping = derived(importBulkStore, $store => $store.mapping);
export const geolocation = derived(importBulkStore, $store => $store.geolocation);
export const previewData = derived(importBulkStore, $store => $store.previewData);
export const importJob = derived(importBulkStore, $store => $store.importJob);

// Actions
export const importBulkActions = {
  /**
   * Reset store
   */
  reset() {
    importBulkStore.set(initialState);
  },

  /**
   * Navigation
   */
  goToStep(step: WizardStep) {
    importBulkStore.update(state => ({
      ...state,
      currentStep: step,
      canGoPrevious: step !== 'upload',
      canGoNext: this.canGoNextFromStep(step, state),
    }));
  },

  nextStep() {
    importBulkStore.update(state => {
      const steps: WizardStep[] = ['upload', 'mapping', 'geolocation', 'preview', 'progress'];
      const currentIndex = steps.indexOf(state.currentStep);
      const nextStep = steps[currentIndex + 1] || state.currentStep;

      return {
        ...state,
        currentStep: nextStep,
        canGoPrevious: nextStep !== 'upload',
        canGoNext: this.canGoNextFromStep(nextStep, state),
      };
    });
  },

  previousStep() {
    importBulkStore.update(state => {
      const steps: WizardStep[] = ['upload', 'mapping', 'geolocation', 'preview', 'progress'];
      const currentIndex = steps.indexOf(state.currentStep);
      const prevStep = steps[currentIndex - 1] || state.currentStep;

      return {
        ...state,
        currentStep: prevStep,
        canGoPrevious: prevStep !== 'upload',
        canGoNext: this.canGoNextFromStep(prevStep, state),
      };
    });
  },

  canGoNextFromStep(step: WizardStep, state: ImportBulkState): boolean {
    switch (step) {
      case 'upload':
        return state.file !== null && state.columns.length > 0;
      case 'mapping':
        return this.isMappingValid(state.mapping);
      case 'geolocation':
        return this.isGeolocationValid(state.geolocation, state.mapping);
      case 'preview':
        return state.previewStats.errors === 0;
      case 'progress':
        return false;
      default:
        return false;
    }
  },

  isMappingValid(mapping: MappingConfig): boolean {
    // Au moins localité ou code requis
    if (!mapping.localite && !mapping.code) return false;

    // Date requise
    if (!mapping.date) return false;

    // Type essai requis
    if (!mapping.type_essai) return false;

    // Profondeur requise (sauf format large)
    if (mapping.structure === 'long' && !mapping.profondeur_m) return false;

    // Valeur ou analyse qualitative requise
    if (!mapping.valeur && !mapping.analyse_qualitative) return false;

    return true;
  },

  isGeolocationValid(geoloc: GeolocationConfig, mapping: MappingConfig): boolean {
    switch (geoloc.mode) {
      case 'exact':
        // Nécessite longitude/latitude mappées
        return mapping.localite !== undefined;
      case 'centroid':
      case 'random':
        // Nécessite ADM3 ou ADM2
        return mapping.adm3 !== undefined || mapping.adm2 !== undefined;
      case 'maille':
        // Nécessite code maille
        return mapping.maille_code !== undefined;
      case 'unknown':
        return true;
      default:
        return false;
    }
  },

  /**
   * Upload
   */
  setFile(file: File, format: 'csv' | 'xlsx' | 'json', columns: string[]) {
    importBulkStore.update(state => ({
      ...state,
      file,
      fileFormat: format,
      columns,
      canGoNext: columns.length > 0,
      error: null,
    }));
  },

  /**
   * Mapping
   */
  setMapping(mapping: Partial<MappingConfig>) {
    importBulkStore.update(state => {
      const newMapping = { ...state.mapping, ...mapping };
      return {
        ...state,
        mapping: newMapping,
        canGoNext: this.isMappingValid(newMapping),
      };
    });
  },

  setDataStructure(structure: 'long' | 'large') {
    importBulkStore.update(state => ({
      ...state,
      dataStructure: structure,
      mapping: {
        ...state.mapping,
        structure,
      },
    }));
  },

  autoMap(columns: string[]) {
    // Détection automatique des colonnes
    const mapping: Partial<MappingConfig> = {
      structure: 'long',
    };

    const colLower = columns.map(c => c.toLowerCase());

    // Localité
    const localiteIdx = colLower.findIndex(c =>
      c.includes('localit') || c.includes('commune') || c.includes('village')
    );
    if (localiteIdx >= 0) mapping.localite = columns[localiteIdx];

    // Code
    const codeIdx = colLower.findIndex(c =>
      c.includes('code') && !c.includes('maille')
    );
    if (codeIdx >= 0) mapping.code = columns[codeIdx];

    // Date
    const dateIdx = colLower.findIndex(c =>
      c.includes('date')
    );
    if (dateIdx >= 0) mapping.date = columns[dateIdx];

    // Type essai
    const typeIdx = colLower.findIndex(c =>
      c.includes('type') && c.includes('essai')
    );
    if (typeIdx >= 0) mapping.type_essai = columns[typeIdx];

    // Profondeur
    const profIdx = colLower.findIndex(c =>
      c.includes('profondeur') || c.includes('depth')
    );
    if (profIdx >= 0) mapping.profondeur_m = columns[profIdx];

    // Valeur
    const valeurIdx = colLower.findIndex(c =>
      c.includes('valeur') || c.includes('value') || c.includes('result')
    );
    if (valeurIdx >= 0) mapping.valeur = columns[valeurIdx];

    // Unité
    const uniteIdx = colLower.findIndex(c =>
      c.includes('unit') || c.includes('unité')
    );
    if (uniteIdx >= 0) mapping.unite = columns[uniteIdx];

    // ADM3
    const adm3Idx = colLower.findIndex(c =>
      c.includes('adm3') || c.includes('commune')
    );
    if (adm3Idx >= 0) mapping.adm3 = columns[adm3Idx];

    this.setMapping(mapping);
  },

  /**
   * Geolocation
   */
  setGeolocation(geoloc: Partial<GeolocationConfig>) {
    importBulkStore.update(state => {
      const newGeoloc = { ...state.geolocation, ...geoloc };
      return {
        ...state,
        geolocation: newGeoloc,
        canGoNext: this.isGeolocationValid(newGeoloc, state.mapping),
      };
    });
  },

  /**
   * Preview
   */
  setPreviewData(data: PreviewRow[], stats: typeof initialState.previewStats) {
    importBulkStore.update(state => ({
      ...state,
      previewData: data,
      previewStats: stats,
      canGoNext: stats.errors === 0,
    }));
  },

  /**
   * Progress
   */
  setImportJob(job: ImportJob) {
    importBulkStore.update(state => ({
      ...state,
      importJob: job,
    }));
  },

  startPolling(intervalId: number) {
    importBulkStore.update(state => ({
      ...state,
      pollingInterval: intervalId,
    }));
  },

  stopPolling() {
    importBulkStore.update(state => {
      if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
      }
      return {
        ...state,
        pollingInterval: null,
      };
    });
  },

  /**
   * Errors & Loading
   */
  setError(error: string | null) {
    importBulkStore.update(state => ({
      ...state,
      error,
      loading: false,
    }));
  },

  setLoading(loading: boolean) {
    importBulkStore.update(state => ({
      ...state,
      loading,
      error: loading ? null : state.error,
    }));
  },
};
