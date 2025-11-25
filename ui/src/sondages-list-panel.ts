/**
 * Panel Liste complète des sondages avec recherche et filtres
 */

import { listSondages, getSondagesStats, Sondage, SondagesStats } from './api/sondages';
import { toast } from './ui/toast';

export class SondagesListPanel {
  private sondages: Sondage[] = [];
  private stats: SondagesStats | null = null;
  private loading = false;
  private searchQuery = '';
  private filterGeocoded: 'all' | 'geocoded' | 'not_geocoded' = 'all';
  private filterSource: 'all' | string = 'all';
  private filterAdm3: 'all' | string = 'all';
  private filterGeocodingMode: 'all' | 'auto' | 'manual' = 'all';
  private sortBy: 'created_at' | 'code' | 'localite' | 'is_geocoded' = 'created_at';
  private sortOrder: 'asc' | 'desc' = 'desc';
  private currentContainerId?: string;
  private onSuccessCallback?: (msg: string) => void;
  private onErrorCallback?: (error: string) => void;
  private onGeocodeRequest?: (surveyId: string) => void;
  private onDetailsRequest?: (surveyId: string) => void;

  constructor(private apiUrl: string) {}
  
  /**
   * Set callback for geocode request (called when user clicks Géocoder/Re-géocoder)
   */
  setOnGeocodeRequest(callback: (surveyId: string) => void) {
    this.onGeocodeRequest = callback;
  }

  /**
   * Set callback for details request (called when user clicks Voir détails)
   */
  setOnDetailsRequest(callback: (surveyId: string) => void) {
    this.onDetailsRequest = callback;
  }

  async refresh() {
    this.loading = true;
    try {
      this.stats = await getSondagesStats();
      
      const params: any = {
        limit: 500,
        search: this.searchQuery || undefined,
      };

      if (this.filterGeocoded === 'geocoded') {
        // Seulement les géocodés
        params.missing = undefined;
      } else if (this.filterGeocoded === 'not_geocoded') {
        params.missing = 'geom';
      }

      // Filtres avancés seront appliqués côté client pour l'instant
      // TODO: Implémenter côté serveur pour de meilleures performances

      this.sondages = await listSondages(params);
    } catch (e: any) {
      console.error('[SONDAGES LIST] Error refreshing:', e);
      throw e;
    } finally {
      this.loading = false;
    }
  }

  renderUI(containerId: string, onSuccess: (msg: string) => void, onError: (error: string) => void) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container #${containerId} not found`);
      return;
    }

    this.onSuccessCallback = onSuccess;
    this.onErrorCallback = onError;
    this.currentContainerId = containerId;

    const geocodedCount = this.stats ? this.stats.with_geom : 0;
    const notGeocodedCount = this.stats ? this.stats.total - this.stats.with_geom : 0;

    container.innerHTML = `
      <div class="sondages-list-panel" style="display: flex; flex-direction: column; height: 100%; background: #0a0e17; min-height: 0;">
        <!-- Header -->
        <div style="padding: 20px; border-bottom: 1px solid #22304d;">
          <h3 style="margin: 0 0 16px 0; color: #ecf2f8; font-size: 18px;">
            📋 Liste des sondages
          </h3>
          
          <!-- Stats -->
          <div style="display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px;">
            <div style="padding: 8px 12px; background: #1a2332; border-radius: 6px; border: 1px solid #22304d;">
              <span style="color: #94a3b8;">Total:</span>
              <strong style="color: #ecf2f8; margin-left: 6px;">${this.stats?.total || 0}</strong>
            </div>
            <div style="padding: 8px 12px; background: #1a2332; border-radius: 6px; border: 1px solid #22304d;">
              <span style="color: #94a3b8;">Géocodés:</span>
              <strong style="color: #51cf66; margin-left: 6px;">${geocodedCount}</strong>
            </div>
            <div style="padding: 8px 12px; background: #1a2332; border-radius: 6px; border: 1px solid #22304d;">
              <span style="color: #94a3b8;">Non géocodés:</span>
              <strong style="color: #ff6b6b; margin-left: 6px;">${notGeocodedCount}</strong>
            </div>
          </div>

          <!-- Filtres -->
          <div style="display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
            <input 
              type="text" 
              id="search-input" 
              placeholder="🔍 Rechercher un sondage..." 
              value="${this.searchQuery}"
              style="flex: 1; min-width: 200px; padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px;"
            />
            <select 
              id="filter-geocoded" 
              style="padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px; cursor: pointer;"
            >
              <option value="all" ${this.filterGeocoded === 'all' ? 'selected' : ''}>Tous</option>
              <option value="geocoded" ${this.filterGeocoded === 'geocoded' ? 'selected' : ''}>Géocodés</option>
              <option value="not_geocoded" ${this.filterGeocoded === 'not_geocoded' ? 'selected' : ''}>Non géocodés</option>
            </select>
            <select 
              id="filter-geocoding-mode" 
              style="padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px; cursor: pointer;"
            >
              <option value="all" ${this.filterGeocodingMode === 'all' ? 'selected' : ''}>Tous modes</option>
              <option value="auto" ${this.filterGeocodingMode === 'auto' ? 'selected' : ''}>🤖 Auto</option>
              <option value="manual" ${this.filterGeocodingMode === 'manual' ? 'selected' : ''}>👤 Manuel</option>
            </select>
          </div>
          
          <!-- Filtres avancés (ligne 2) -->
          <div style="display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
            <select 
              id="filter-source" 
              style="padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px; cursor: pointer;"
            >
              <option value="all" ${this.filterSource === 'all' ? 'selected' : ''}>Toutes sources</option>
              ${this.getUniqueSourcesOptions()}
            </select>
            <select 
              id="filter-adm3" 
              style="padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px; cursor: pointer;"
            >
              <option value="all" ${this.filterAdm3 === 'all' ? 'selected' : ''}>Toutes ADM3</option>
              ${this.getUniqueAdm3Options()}
            </select>
            <select 
              id="sort-by" 
              style="padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px; cursor: pointer;"
            >
              <option value="created_at" ${this.sortBy === 'created_at' ? 'selected' : ''}>📅 Date création</option>
              <option value="code" ${this.sortBy === 'code' ? 'selected' : ''}>🏷️ Code</option>
              <option value="localite" ${this.sortBy === 'localite' ? 'selected' : ''}>📍 Localité</option>
              <option value="is_geocoded" ${this.sortBy === 'is_geocoded' ? 'selected' : ''}>🎯 Géocodage</option>
            </select>
            <button 
              id="sort-order" 
              style="padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px; cursor: pointer;"
              title="Ordre de tri"
            >
              ${this.sortOrder === 'desc' ? '⬇️ Desc' : '⬆️ Asc'}
            </button>
          </div>
        </div>

        <!-- Liste -->
        <div id="sondages-list" style="flex: 1; min-height: 0; overflow-y: auto; padding: 16px;">
          ${this.renderSondagesList()}
        </div>
      </div>
    `;

    this.attachListeners();
  }

  private getUniqueSourcesOptions(): string {
    const uniqueSources = [...new Set(this.sondages.map(s => s.source).filter(Boolean))];
    return uniqueSources.map(source => 
      `<option value="${source}" ${this.filterSource === source ? 'selected' : ''}>${source}</option>`
    ).join('');
  }

  private getUniqueAdm3Options(): string {
    const uniqueAdm3 = [...new Set(this.sondages.map(s => s.adm3_name).filter(Boolean))];
    return uniqueAdm3.map(adm3 => 
      `<option value="${adm3}" ${this.filterAdm3 === adm3 ? 'selected' : ''}>${adm3}</option>`
    ).join('');
  }

  private rerenderList() {
    const listContainer = document.getElementById('sondages-list');
    if (listContainer) {
      listContainer.innerHTML = this.renderSondagesList();
      this.attachListeners(); // Re-attach listeners for new elements
    }
  }

  private renderSondagesList(): string {
    if (this.loading) {
      return '<div style="text-align: center; padding: 40px; color: #94a3b8;">⏳ Chargement...</div>';
    }

    if (this.sondages.length === 0) {
      return `
        <div style="text-align: center; padding: 40px; color: #94a3b8;">
          <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
          <div style="font-size: 16px; font-weight: 600; color: #ecf2f8; margin-bottom: 8px;">
            Aucun sondage trouvé
          </div>
          <div style="font-size: 14px;">
            ${this.searchQuery ? 'Essayez une autre recherche' : 'Aucun sondage dans la base de données'}
          </div>
        </div>
      `;
    }

    // Appliquer les filtres et le tri
    let filteredSondages = this.sondages.slice();

    // Filtrage par source
    if (this.filterSource !== 'all') {
      filteredSondages = filteredSondages.filter(s => s.source === this.filterSource);
    }

    // Filtrage par ADM3
    if (this.filterAdm3 !== 'all') {
      filteredSondages = filteredSondages.filter(s => s.adm3_name === this.filterAdm3);
    }

    // Filtrage par mode de géocodage
    if (this.filterGeocodingMode !== 'all') {
      filteredSondages = filteredSondages.filter(s => {
        const geocodedMode = s.meta && s.meta.geocoded_mode ? s.meta.geocoded_mode : null;
        const isAutoAccepted = geocodedMode === 'suggestion_accepted';
        const isManualAdm = geocodedMode === 'adm3';
        
        if (this.filterGeocodingMode === 'auto') {
          return isAutoAccepted || s.location_mode === 'adm_random_cell';
        } else if (this.filterGeocodingMode === 'manual') {
          return isManualAdm || s.location_mode === 'exact';
        }
        return false;
      });
    }

    // Tri
    filteredSondages.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (this.sortBy) {
        case 'code':
          aVal = a.code || '';
          bVal = b.code || '';
          break;
        case 'localite':
          aVal = a.localite || '';
          bVal = b.localite || '';
          break;
        case 'is_geocoded':
          aVal = a.is_geocoded ? 1 : 0;
          bVal = b.is_geocoded ? 1 : 0;
          break;
        case 'created_at':
        default:
          aVal = new Date(a.created_at || 0);
          bVal = new Date(b.created_at || 0);
          break;
      }

      if (aVal < bVal) return this.sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filteredSondages
      .map((s) => {
        const isGeocoded = s.is_geocoded;
        const locationMode = s.location_mode || 'unknown';
        const isAutoGeocoded = locationMode === 'adm_random_cell';
        const geocodedMode = s.meta && s.meta.geocoded_mode ? s.meta.geocoded_mode : null;
        const isAutoAccepted = geocodedMode === 'suggestion_accepted';
        const isManualAdm = geocodedMode === 'adm3';
        const statusColor = isGeocoded ? '#51cf66' : '#ff6b6b';
        const statusIcon = isGeocoded ? '✅' : '❌';
        const modeLabel = this.getLocationModeLabel(locationMode);

        return `
          <div class="sondage-card" style="background: #1a2332; border: 1px solid #22304d; border-radius: 8px; padding: 16px; margin-bottom: 12px; transition: border-color 0.2s; cursor: pointer;" data-id="${s.id}">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
              <div style="flex: 1;">
                <div style="font-size: 16px; font-weight: 600; color: #ecf2f8; margin-bottom: 4px;">
                  ${statusIcon} ${this.escapeHtml(s.code || 'N/A')}
                </div>
                <div style="font-size: 13px; color: #94a3b8;">
                  ${this.escapeHtml(s.localite || 'Localité inconnue')}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="padding: 4px 8px; background: ${statusColor}22; border: 1px solid ${statusColor}; border-radius: 4px; font-size: 11px; color: ${statusColor}; font-weight: 600; margin-bottom: 4px;">
                  ${isGeocoded ? 'GÉOCODÉ' : 'NON GÉOCODÉ'}
                </div>
                ${isAutoAccepted ? `<div style="padding: 2px 6px; background: #4c6ef522; border: 1px solid #4c6ef5; border-radius: 4px; font-size: 10px; color: #4c6ef5; font-weight: 600; margin-bottom: 2px;">🤖 AUTO</div>` : ''}
                ${isManualAdm ? `<div style="padding: 2px 6px; background: #ff922b22; border: 1px solid #ff922b; border-radius: 4px; font-size: 10px; color: #ff922b; font-weight: 600; margin-bottom: 2px;">👤 MANUEL</div>` : ''}
                ${isGeocoded ? `<div style="font-size: 11px; color: #94a3b8;">${modeLabel}</div>` : ''}
              </div>
            </div>

            <!-- Infos -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; color: #94a3b8;">
              ${s.adm3_name ? `<div><strong style="color: #ecf2f8;">ADM3:</strong> ${this.escapeHtml(s.adm3_name)}</div>` : ''}
              ${s.source ? `<div><strong style="color: #ecf2f8;">Source:</strong> ${this.escapeHtml(s.source)}</div>` : ''}
              ${s.created_at ? `<div><strong style="color: #ecf2f8;">Créé:</strong> ${new Date(s.created_at).toLocaleDateString('fr-FR')}</div>` : ''}
            </div>

            <!-- Actions -->
            <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #22304d;">
              ${!isGeocoded ? `
                <button class="geocode-btn" data-id="${s.id}" style="flex: 1; padding: 8px; background: #4c6ef5; color: #fff; border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
                  🗺️ Géocoder
                </button>
              ` : `
                <button class="regeocode-btn" data-id="${s.id}" style="flex: 1; padding: 8px; background: #ff922b; color: #fff; border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
                  🔄 Re-géocoder
                </button>
              `}
              <button class="view-btn" data-id="${s.id}" style="flex: 1; padding: 8px; background: #22304d; color: #ecf2f8; border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
                👁️ Voir détails
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  private attachListeners() {
    // Search input
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', async (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        await this.refresh();
        if (this.currentContainerId && this.onSuccessCallback && this.onErrorCallback) {
          this.renderUI(this.currentContainerId, this.onSuccessCallback, this.onErrorCallback);
        }
      });
    }

    // Filter select
    const filterSelect = document.getElementById('filter-geocoded') as HTMLSelectElement;
    if (filterSelect) {
      filterSelect.addEventListener('change', async (e) => {
        this.filterGeocoded = (e.target as HTMLSelectElement).value as any;
        await this.refresh();
        if (this.currentContainerId && this.onSuccessCallback && this.onErrorCallback) {
          this.renderUI(this.currentContainerId, this.onSuccessCallback, this.onErrorCallback);
        }
      });
    }

    // Advanced filters
    const filterGeocodingMode = document.getElementById('filter-geocoding-mode') as HTMLSelectElement;
    if (filterGeocodingMode) {
      filterGeocodingMode.addEventListener('change', () => {
        this.filterGeocodingMode = filterGeocodingMode.value as any;
        this.rerenderList();
      });
    }

    const filterSource = document.getElementById('filter-source') as HTMLSelectElement;
    if (filterSource) {
      filterSource.addEventListener('change', () => {
        this.filterSource = filterSource.value;
        this.rerenderList();
      });
    }

    const filterAdm3 = document.getElementById('filter-adm3') as HTMLSelectElement;
    if (filterAdm3) {
      filterAdm3.addEventListener('change', () => {
        this.filterAdm3 = filterAdm3.value;
        this.rerenderList();
      });
    }

    const sortBy = document.getElementById('sort-by') as HTMLSelectElement;
    if (sortBy) {
      sortBy.addEventListener('change', () => {
        this.sortBy = sortBy.value as any;
        this.rerenderList();
      });
    }

    const sortOrder = document.getElementById('sort-order') as HTMLButtonElement;
    if (sortOrder) {
      sortOrder.addEventListener('click', () => {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        this.rerenderList();
      });
    }

    // Geocode buttons
    document.querySelectorAll('.geocode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.target as HTMLElement).dataset.id!;
        this.handleGeocode(id);
      });
    });

    // Re-geocode buttons
    document.querySelectorAll('.regeocode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.target as HTMLElement).dataset.id!;
        this.handleGeocode(id); // Same handler as geocode
      });
    });

    // View buttons
    document.querySelectorAll('.view-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.target as HTMLElement).dataset.id!;
        this.handleView(id);
      });
    });

    // Card click
    document.querySelectorAll('.sondage-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id!;
        this.handleView(id);
      });
    });
  }

  private handleGeocode(id: string) {
    // Call the geocode request callback
    if (this.onGeocodeRequest) {
      this.onGeocodeRequest(id);
    } else {
      console.warn('[SONDAGES LIST] No geocode request handler set');
      toast.error('Impossible d\'ouvrir le géocodage');
    }
  }

  private async handleView(id: string) {
    if (this.onDetailsRequest) {
      // Use callback to request details view
      this.onDetailsRequest(id);
    } else {
      // Fallback to modal (legacy behavior)
      try {
        const response = await fetch(`${this.apiUrl}/sondages/${id}`);
        if (!response.ok) throw new Error('Failed to fetch sondage');
        
        const sondage = await response.json();
        this.showDetailsModal(sondage);
      } catch (e: any) {
        toast.error(`Erreur: ${e.message}`);
      }
    }
  }

  private async showDetailsModal(basicSondage: any) {
    // Remove existing modal if any
    const existing = document.getElementById('sondage-details-modal');
    if (existing) existing.remove();

    // Create modal structure
    const modal = document.createElement('div');
    modal.id = 'sondage-details-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
      backdrop-filter: blur(4px);
    `;

    // Render loading state initially
    modal.innerHTML = `
      <div style="background: #0a0e17; border: 1px solid #22304d; border-radius: 12px; width: 600px; height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div style="font-size: 32px; margin-bottom: 16px; animation: spin 1s linear infinite;">⏳</div>
        <div style="color: #ecf2f8; font-size: 16px; font-weight: 600;">Chargement des détails complets...</div>
        <div style="color: #94a3b8; font-size: 13px; margin-top: 8px;">${basicSondage.code}</div>
      </div>
      <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    `;

    document.body.appendChild(modal);

    // Close on click outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    try {
      // Fetch full details
      const response = await fetch(`${this.apiUrl}/sondages/${basicSondage.id}/details`);
      if (!response.ok) throw new Error('Erreur chargement détails');
      
      const s = await response.json();
      this.renderDetailsContent(modal, s);
    } catch (e) {
      console.error('Error loading details:', e);
      modal.innerHTML = `
        <div style="background: #0a0e17; border: 1px solid #ff6b6b; border-radius: 12px; padding: 40px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 16px;">⚠️</div>
          <h3 style="color: #ecf2f8; margin: 0 0 8px 0;">Erreur de chargement</h3>
          <p style="color: #94a3b8;">Impossible de charger les détails pour ${basicSondage.code}</p>
          <button id="close-modal-error" style="margin-top: 16px; padding: 8px 16px; background: #22304d; border: none; color: #ecf2f8; border-radius: 6px; cursor: pointer;">Fermer</button>
        </div>
      `;
      document.getElementById('close-modal-error')?.addEventListener('click', () => modal.remove());
    }
  }

  private renderDetailsContent(modal: HTMLElement, s: any) {
    const isGeocoded = s.is_geocoded || false;
    const modeLabel = this.getLocationModeLabel(s.location_mode || 'unknown');
    const coords = s.coordinates; // Structure {lat, lon} depuis l'API enrichie

    // Sections helpers
    const renderSection = (title: string, icon: string, content: string, count?: number) => `
      <details open style="margin-bottom: 16px; background: #1a2332; border: 1px solid #22304d; border-radius: 8px; overflow: hidden;">
        <summary style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; background: #22304d;">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #ecf2f8;">
            <span>${icon}</span> ${title}
            ${count !== undefined ? `<span style="background: #0a0e17; padding: 2px 8px; border-radius: 10px; font-size: 11px; color: #94a3b8;">${count}</span>` : ''}
          </div>
          <span style="font-size: 12px; color: #94a3b8;">▼</span>
        </summary>
        <div style="padding: 16px;">${content}</div>
      </details>
    `;

    // Tables helpers
    const renderTable = (headers: string[], rows: any[], renderRow: (item: any) => string) => {
      if (!rows || rows.length === 0) return '<div style="color: #94a3b8; font-style: italic; text-align: center; padding: 12px;">Aucune donnée disponible</div>';
      return `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #0a0e17; color: #94a3b8;">
                ${headers.map(h => `<th style="padding: 8px; text-align: left; border-bottom: 1px solid #22304d;">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map(renderRow).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    const html = `
      <div style="background: #0a0e17; border: 1px solid #22304d; border-radius: 12px; width: 900px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
        <!-- Header -->
        <div style="padding: 20px; border-bottom: 1px solid #22304d; display: flex; justify-content: space-between; align-items: center; background: #1a2332; border-radius: 12px 12px 0 0;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="background: #0a0e17; width: 48px; height: 48px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 1px solid #22304d;">
              📝
            </div>
            <div>
              <h2 style="margin: 0 0 4px 0; color: #ecf2f8; font-size: 20px;">
                ${this.escapeHtml(s.code || 'N/A')}
              </h2>
              <div style="display: flex; gap: 8px; align-items: center;">
                <span style="font-size: 13px; color: #94a3b8;">${this.escapeHtml(s.localite || 'Localité inconnue')}</span>
                <span style="color: #22304d;">|</span>
                <span style="font-size: 12px; color: ${isGeocoded ? '#51cf66' : '#ff6b6b'}; font-weight: 600;">
                  ${isGeocoded ? '✅ GÉOCODÉ' : '❌ NON GÉOCODÉ'}
                </span>
              </div>
            </div>
          </div>
          <button id="close-modal-btn" style="background: #22304d; border: none; color: #ecf2f8; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 18px; transition: background 0.2s;">
            ✕
          </button>
        </div>

        <!-- Scrollable Content -->
        <div style="flex: 1; overflow-y: auto; padding: 24px;">
          
          <!-- 1. Informations Générales -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div style="background: #1a2332; padding: 16px; border-radius: 8px; border: 1px solid #22304d;">
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 12px; font-weight: 600; text-transform: uppercase;">📍 Localisation</div>
              <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: #ecf2f8;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #94a3b8;">ADM3:</span>
                  <span>${this.escapeHtml(s.adm3_name || '—')}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #94a3b8;">Mode:</span>
                  <span>${modeLabel}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #94a3b8;">Coords (WGS84):</span>
                  <span>${coords ? `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}` : '—'}</span>
                </div>
                ${coords ? `
                  <button class="zoom-btn" style="margin-top: 8px; padding: 6px; background: #4c6ef5; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;">
                    🔍 Zoomer sur la carte
                  </button>
                ` : ''}
              </div>
            </div>

            <div style="background: #1a2332; padding: 16px; border-radius: 8px; border: 1px solid #22304d;">
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 12px; font-weight: 600; text-transform: uppercase;">📄 Métadonnées</div>
              <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: #ecf2f8;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #94a3b8;">Source:</span>
                  <span>${this.escapeHtml(s.source || '—')}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #94a3b8;">Maille:</span>
                  <span style="font-family: monospace; background: #0a0e17; padding: 2px 6px; border-radius: 4px;">${s.grid_code || '—'}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #94a3b8;">Mis à jour:</span>
                  <span>${s.updated_at ? new Date(s.updated_at).toLocaleDateString('fr-FR') : '—'}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Essais Géotechniques -->
          ${renderSection('Atterberg', '💧', renderTable(
            ['Prof. (m)', 'WL', 'WP', 'IP', 'Class.'],
            s.atterberg || [],
            (item) => `
              <tr style="border-bottom: 1px solid #22304d; color: #ecf2f8;">
                <td style="padding: 8px;">${item.depth_m.toFixed(1)}</td>
                <td style="padding: 8px;">${item.wl || '—'}</td>
                <td style="padding: 8px;">${item.wp || '—'}</td>
                <td style="padding: 8px; font-weight: 600; color: #4c6ef5;">${item.ip || '—'}</td>
                <td style="padding: 8px;"><span style="background: #22304d; padding: 2px 6px; border-radius: 4px;">${item.classification || '—'}</span></td>
              </tr>
            `
          ), s.atterberg?.length)}

          ${renderSection('VBS', '🔵', renderTable(
            ['Prof. (m)', 'VBS', 'Interprétation'],
            s.vbs || [],
            (item) => `
              <tr style="border-bottom: 1px solid #22304d; color: #ecf2f8;">
                <td style="padding: 8px;">${item.depth_m.toFixed(1)}</td>
                <td style="padding: 8px; font-weight: 600;">${item.vbs?.toFixed(2) || '—'}</td>
                <td style="padding: 8px; color: #94a3b8;">${item.interpretation || '—'}</td>
              </tr>
            `
          ), s.vbs?.length)}

          ${renderSection('Granulométrie', '📊', renderTable(
            ['Prof. (m)', 'D10', 'D30', 'D60', 'Cu', 'Cc', 'Type'],
            s.granulometrie || [],
            (item) => `
              <tr style="border-bottom: 1px solid #22304d; color: #ecf2f8;">
                <td style="padding: 8px;">${item.depth_m.toFixed(1)}</td>
                <td style="padding: 8px;">${item.d10 || '—'}</td>
                <td style="padding: 8px;">${item.d30 || '—'}</td>
                <td style="padding: 8px;">${item.d60 || '—'}</td>
                <td style="padding: 8px;">${item.cu || '—'}</td>
                <td style="padding: 8px;">${item.cc || '—'}</td>
                <td style="padding: 8px;">${item.type || '—'}</td>
              </tr>
            `
          ), s.granulometrie?.length)}

          ${renderSection('Échantillons', '🧪', renderTable(
            ['Prof. (m)', 'Type', 'Description'],
            s.echantillons || [],
            (item) => `
              <tr style="border-bottom: 1px solid #22304d; color: #ecf2f8;">
                <td style="padding: 8px;">${item.depth_m.toFixed(1)}</td>
                <td style="padding: 8px;"><span style="background: #22304d; padding: 2px 6px; border-radius: 4px;">${item.type || '—'}</span></td>
                <td style="padding: 8px; color: #94a3b8;">${item.description || '—'}</td>
              </tr>
            `
          ), s.echantillons?.length)}

        </div>
      </div>
    `;

    modal.innerHTML = html;

    // Event listeners
    modal.querySelector('#close-modal-btn')?.addEventListener('click', () => modal.remove());
    
    const zoomBtn = modal.querySelector('.zoom-btn');
    if (zoomBtn && coords) {
      zoomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modal.remove();
        
        // Dispatch event to zoom on map
        // This assumes we have a listener for this event in the main page or map component
        const event = new CustomEvent('atlas:zoom-coord', { 
          detail: { lat: coords.lat, lon: coords.lon, zoom: 14 } 
        });
        window.dispatchEvent(event);
        console.log(`[DETAILS] Zoom sur ${s.code} à ${coords.lat}, ${coords.lon}`);
      });
    }
  }

  private extractCoords(geom: string): { lat: number; lon: number } | null {
    // Parse WKT POINT(lon lat)
    const match = geom.match(/POINT\(([^ ]+) ([^ ]+)\)/);
    if (match) {
      return { lon: parseFloat(match[1]), lat: parseFloat(match[2]) };
    }
    return null;
  }

  private getLocationModeLabel(mode: string): string {
    const labels: Record<string, string> = {
      unknown: 'Inconnu',
      exact: 'GPS exact',
      adm3_centroid: 'Centroïde ADM3',
      random: 'Aléatoire',
      adm_random_cell: 'Aléatoire ADM',
    };
    return labels[mode] || mode;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
