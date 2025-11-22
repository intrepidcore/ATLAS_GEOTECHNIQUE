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
  private currentContainerId?: string;
  private onSuccessCallback?: (msg: string) => void;
  private onErrorCallback?: (error: string) => void;

  constructor(private apiUrl: string) {}

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
          <div style="display: flex; gap: 12px; margin-bottom: 12px;">
            <input 
              type="text" 
              id="search-input" 
              placeholder="🔍 Rechercher un sondage..." 
              value="${this.searchQuery}"
              style="flex: 1; padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px;"
            />
            <select 
              id="filter-geocoded" 
              style="padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px; cursor: pointer;"
            >
              <option value="all" ${this.filterGeocoded === 'all' ? 'selected' : ''}>Tous</option>
              <option value="geocoded" ${this.filterGeocoded === 'geocoded' ? 'selected' : ''}>Géocodés</option>
              <option value="not_geocoded" ${this.filterGeocoded === 'not_geocoded' ? 'selected' : ''}>Non géocodés</option>
            </select>
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

    return this.sondages
      .map((s) => {
        const isGeocoded = s.is_geocoded;
        const locationMode = s.location_mode || 'unknown';
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
              ` : ''}
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

    // Geocode buttons
    document.querySelectorAll('.geocode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.target as HTMLElement).dataset.id!;
        this.handleGeocode(id);
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
    // Navigate to geocode tab with this sondage selected
    if (this.onSuccessCallback) {
      this.onSuccessCallback(`Navigation vers géocodage de ${id}`);
    }
    // TODO: Implement navigation to geocode tab with pre-selected sondage
    toast.success('Navigation vers géocodage (à implémenter)');
  }

  private async handleView(id: string) {
    try {
      // Fetch sondage details
      const response = await fetch(`${this.apiUrl}/sondages/${id}`);
      if (!response.ok) throw new Error('Failed to fetch sondage');
      
      const sondage = await response.json();
      
      // Create modal
      this.showDetailsModal(sondage);
    } catch (e: any) {
      toast.error(`Erreur: ${e.message}`);
    }
  }

  private showDetailsModal(s: any) {
    // Remove existing modal if any
    const existing = document.getElementById('sondage-details-modal');
    if (existing) existing.remove();

    // Create modal
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
    `;

    const isGeocoded = s.is_geocoded || false;
    const modeLabel = this.getLocationModeLabel(s.location_mode || 'unknown');
    const coords = s.geom ? this.extractCoords(s.geom) : null;

    modal.innerHTML = `
      <div style="background: #0a0e17; border: 1px solid #22304d; border-radius: 12px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
        <!-- Header -->
        <div style="padding: 24px; border-bottom: 1px solid #22304d; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="margin: 0 0 8px 0; color: #ecf2f8; font-size: 20px;">
              📍 ${this.escapeHtml(s.code || 'N/A')}
            </h2>
            <div style="font-size: 14px; color: #94a3b8;">
              ${this.escapeHtml(s.localite || 'Localité inconnue')}
            </div>
          </div>
          <button id="close-modal-btn" style="background: #22304d; border: none; color: #ecf2f8; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 18px;">
            ✕
          </button>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">
          <!-- Status -->
          <div style="display: flex; gap: 8px; margin-bottom: 24px;">
            <span style="padding: 6px 12px; background: ${isGeocoded ? '#51cf66' : '#ff6b6b'}22; border: 1px solid ${isGeocoded ? '#51cf66' : '#ff6b6b'}; border-radius: 6px; font-size: 12px; color: ${isGeocoded ? '#51cf66' : '#ff6b6b'}; font-weight: 600;">
              ${isGeocoded ? '✅ GÉOCODÉ' : '❌ NON GÉOCODÉ'}
            </span>
            ${isGeocoded ? `<span style="padding: 6px 12px; background: #4c6ef522; border: 1px solid #4c6ef5; border-radius: 6px; font-size: 12px; color: #4c6ef5; font-weight: 600;">${modeLabel}</span>` : ''}
          </div>

          <!-- Infos grid -->
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
            <div style="background: #1a2332; padding: 16px; border-radius: 8px; border: 1px solid #22304d;">
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">🔖 Identifiants</div>
              <div style="font-size: 14px; color: #ecf2f8; line-height: 1.6;">
                <div><strong>Code:</strong> ${this.escapeHtml(s.code || '—')}</div>
                <div><strong>Localité clé:</strong> ${this.escapeHtml(s.localite_key || '—')}</div>
                <div><strong>Maille:</strong> ${this.escapeHtml(s.maille_code || '—')}</div>
              </div>
            </div>

            <div style="background: #1a2332; padding: 16px; border-radius: 8px; border: 1px solid #22304d;">
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">🌍 Localisation</div>
              <div style="font-size: 14px; color: #ecf2f8; line-height: 1.6;">
                <div><strong>ADM3:</strong> ${this.escapeHtml(s.adm3_name || '—')}</div>
                <div><strong>Mode:</strong> ${modeLabel}</div>
                ${coords ? `<div><strong>Coords:</strong> ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}</div>` : ''}
              </div>
            </div>

            <div style="background: #1a2332; padding: 16px; border-radius: 8px; border: 1px solid #22304d;">
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">📦 Import</div>
              <div style="font-size: 14px; color: #ecf2f8; line-height: 1.6;">
                <div><strong>Source:</strong> ${this.escapeHtml(s.source || '—')}</div>
                <div><strong>Opérateur:</strong> ${this.escapeHtml(s.operator || '—')}</div>
                <div><strong>Essais:</strong> ${s.n_essais || 0}</div>
              </div>
            </div>

            <div style="background: #1a2332; padding: 16px; border-radius: 8px; border: 1px solid #22304d;">
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">🕒 Audit</div>
              <div style="font-size: 14px; color: #ecf2f8; line-height: 1.6;">
                <div><strong>Créé:</strong> ${s.created_at ? new Date(s.created_at).toLocaleString('fr-FR') : '—'}</div>
                <div><strong>Mis à jour:</strong> ${s.updated_at ? new Date(s.updated_at).toLocaleString('fr-FR') : '—'}</div>
              </div>
            </div>
          </div>

          <!-- Meta -->
          ${s.meta ? `
            <div style="background: #1a2332; padding: 16px; border-radius: 8px; border: 1px solid #22304d;">
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">🧾 Meta (JSON)</div>
              <pre style="margin: 0; padding: 12px; background: #0a0e17; border-radius: 6px; font-size: 12px; color: #94a3b8; overflow-x: auto; max-height: 300px;">${JSON.stringify(s.meta, null, 2)}</pre>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeBtn = document.getElementById('close-modal-btn');
    const closeModal = () => modal.remove();
    
    closeBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    // ESC key
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
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
