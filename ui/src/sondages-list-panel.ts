/**
 * Panel Liste complète des sondages avec recherche et filtres
 */

import { getMailleFeature, listSondages, getSondagesStats, legacyLookupGridCode, MailleFeature, Sondage, SondagesStats } from './api/sondages';
import { toast } from './ui/toast';
import { computeGeocodeBadgeFromSurvey, GeocodeBadgeType } from './types/survey-details';

export class SondagesListPanel {
  private sondages: Sondage[] = [];
  private stats: SondagesStats | null = null;
  private loading = false;
  private searchQuery = '';
  private emptyStateContext: null | {
    kind: 'maille';
    maille: MailleFeature;
    isLegacyRedirect: boolean;
    oldCode?: string;
    best?: any;
  } = null;
  private filterGeocoded: 'all' | 'geocoded' | 'not_geocoded' = 'all';
  private filterSource: 'all' | string = 'all';
  private filterAdm3: 'all' | string = 'all';
  private filterGeocodingMode: 'all' | 'auto' | 'manual' = 'all';
  private gridCodeFilter: string | null = null; // Filtre par code maille
  private legacyLookupTriedForGridCode: string | null = null;
  private legacyLookupTriedForSearchQuery: string | null = null;
  private sortBy: 'created_at' | 'code' | 'localite' | 'is_geocoded' = 'created_at';
  private sortOrder: 'asc' | 'desc' = 'desc';
  private currentContainerId?: string;
  private onSuccessCallback?: (msg: string) => void;
  private onErrorCallback?: (error: string) => void;
  private onGeocodeRequest?: (surveyId: string) => void;
  private onDetailsRequest?: (surveyId: string) => void;

  constructor(private apiUrl: string) {}
  
  /**
   * Set grid code filter (workflow maille → sondages)
   */
  setGridCodeFilter(gridCode: string | null) {
    this.gridCodeFilter = gridCode;
  }

  private renderEmptyStateMailleHtml(): string {
    const ctx = this.emptyStateContext;
    if (!ctx || ctx.kind !== 'maille') return '';

    const props = ctx.maille?.properties || {};
    const code = props.code || '—';
    const adm1 = props.adm1_name || '—';
    const adm2 = props.adm2_name || '—';
    const adm3 = props.adm3_name || props.pref_name || '—';

    const center = this.computeCenterLonLat(ctx.maille);
    const coordsHtml = center
      ? `<div style="grid-column: span 2; border-top: 1px solid #334155; margin-top: 8px; padding-top: 8px; font-family: monospace; color: #64748b;">
           🎯 WGS84: ${center.lat.toFixed(6)} / ${center.lon.toFixed(6)}
         </div>`
      : '';

    const legacyAlert = ctx.isLegacyRedirect
      ? `<div style="background: #451a03; border: 1px solid #f59e0b; color: #fbbf24; padding: 10px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; display: flex; align-items: center; gap: 8px; text-align:left; max-width: 520px; margin-left: auto; margin-right: auto;">
           <span>⚠️</span>
           <div>
             <strong>Redirection :</strong> Vous avez cherché <span style="text-decoration: line-through; opacity: 0.8">${this.escapeHtml(ctx.oldCode || '')}</span>.<br>
             Voici la nouvelle maille standard correspondante.
           </div>
         </div>`
      : '';

    const pct = ctx.best && typeof ctx.best.coverage_pct === 'number' ? ctx.best.coverage_pct : null;
    const pctStr = pct === null ? '' : ` (${pct.toFixed(1)}%)`;
    const legacyHint = ctx.isLegacyRedirect
      ? `<div style="font-size: 12px; color:#94a3b8; margin-top: 6px;">Match: ${this.escapeHtml(ctx.best?.match_type || '')}${pctStr}</div>`
      : '';

    // Stocker center dans data-* pour le listener
    const centerAttrs = center
      ? `data-center-lon="${center.lon}" data-center-lat="${center.lat}"`
      : '';

    return `
      <div style="text-align: center; padding: 40px; color: #94a3b8;" id="empty-maille" data-code="${this.escapeHtml(code)}" ${centerAttrs}>
        ${legacyAlert}
        <div style="font-size: 48px; margin-bottom: 16px;">📍</div>
        <div style="font-size: 16px; font-weight: 600; color: #ecf2f8; margin-bottom: 8px;">
          Maille active : ${this.escapeHtml(code)}
        </div>
        <div style="font-size: 14px; margin-bottom: 24px; color: #94a3b8;">
          Cette zone est vide. Soyez le premier à ajouter des données !
          ${legacyHint}
        </div>

        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; text-align: left; max-width: 520px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 12px; font-weight: 700;">
            Localisation Administrative
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; color: #e2e8f0;">
            <div><span style="color:#64748b">Région:</span><br>${this.escapeHtml(adm1)}</div>
            <div><span style="color:#64748b">Préfecture:</span><br>${this.escapeHtml(adm2)}</div>
            <div style="grid-column: span 2"><span style="color:#64748b">Commune:</span> <strong>${this.escapeHtml(adm3)}</strong></div>
            ${coordsHtml}
          </div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 32px;">
          <button id="btn-create-prefilled" style="padding: 10px 24px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.5); transition: all 0.2s;">
            ✨ Créer un sondage ici
          </button>
          ${ctx.isLegacyRedirect ? `<button id="btn-apply-legacy" style="padding: 10px 24px; background: transparent; color: #fbbf24; border: 1px solid #f59e0b; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s;">Basculer le filtre</button>` : ''}
          <button id="btn-clear-search" style="padding: 10px 24px; background: transparent; color: #94a3b8; border: 1px solid #475569; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s;">
            Annuler
          </button>
        </div>
      </div>
    `;
  }

  private attachEmptyStateActionListeners() {
    if (!this.emptyStateContext || this.emptyStateContext.kind !== 'maille') return;

    const root = document.getElementById('empty-maille');
    if (!root) return;

    const code = root.getAttribute('data-code') || '';
    const lonAttr = root.getAttribute('data-center-lon');
    const latAttr = root.getAttribute('data-center-lat');
    const center = lonAttr && latAttr ? { lon: Number(lonAttr), lat: Number(latAttr) } : null;

    const createBtn = root.querySelector('#btn-create-prefilled');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        window.dispatchEvent(
          new CustomEvent('navigate:create-sondage', {
            detail: {
              gridCode: code,
              center,
            },
          })
        );
      });
    }

    const applyLegacyBtn = root.querySelector('#btn-apply-legacy');
    if (applyLegacyBtn && this.emptyStateContext.isLegacyRedirect) {
      applyLegacyBtn.addEventListener('click', async () => {
        this.gridCodeFilter = code;
        window.location.hash = `#/sondages?grid=${encodeURIComponent(code)}`;
        await this.refresh();
        if (this.currentContainerId && this.onSuccessCallback && this.onErrorCallback) {
          this.renderUI(this.currentContainerId, this.onSuccessCallback, this.onErrorCallback);
        }
      });
    }

    const clearBtn = root.querySelector('#btn-clear-search');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        this.searchQuery = '';
        this.emptyStateContext = null;
        const input = document.getElementById('list-search-input') as HTMLInputElement;
        if (input) input.value = '';
        await this.refresh();
        this.rerenderList();
      });
    }
  }
  
  /**
   * Clear grid code filter
   */
  clearGridCodeFilter() {
    this.gridCodeFilter = null;
  }
  
  /**
   * Get current grid code filter
   */
  getGridCodeFilter(): string | null {
    return this.gridCodeFilter;
  }
  
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
      
      // Filtre par code maille (workflow maille → sondages)
      if (this.gridCodeFilter) {
        params.grid_code = this.gridCodeFilter;
      }

      // Filtres avancés seront appliqués côté client pour l'instant
      // TODO: Implémenter côté serveur pour de meilleures performances

      this.sondages = await listSondages(params);

      // Reset empty-state context on refresh; it will be recomputed if needed
      this.emptyStateContext = null;

      const queryNormalized = this.normalizeSearchQuery(this.searchQuery);
      if (queryNormalized !== this.searchQuery) {
        this.searchQuery = queryNormalized;
      }

      const queryTrim = (this.searchQuery || '').trim();
      const looksLikeGridCode = this.isProbablyGridCode(queryTrim);
      const filteredForDisplay = this.getFilteredSondages();

      // Déclencher le fallback basé sur le résultat affiché (après filtres), pas seulement la réponse API brute
      if (!this.gridCodeFilter && looksLikeGridCode && filteredForDisplay.length === 0) {
        await this.tryFillEmptyStateForGridSearch(queryTrim);
      }

      if (this.gridCodeFilter && this.sondages.length === 0 && this.legacyLookupTriedForGridCode !== this.gridCodeFilter) {
        const legacyCode = this.gridCodeFilter;
        this.legacyLookupTriedForGridCode = legacyCode;
        try {
          const suggestions = await legacyLookupGridCode(legacyCode);
          const best = Array.isArray(suggestions) && suggestions.length > 0 ? suggestions[0] : null;
          if (best?.new_code) {
            const pct = typeof best.coverage_pct === 'number' ? best.coverage_pct : null;
            const pctStr = pct === null ? '' : ` (${pct.toFixed(1)}%)`;
            const msg = `Code obsolète: ${legacyCode} → ${best.new_code}${pctStr}`;
            const go = window.confirm(`${msg}\n\nBasculer le filtre maille vers le nouveau code ?`);
            if (go) {
              this.gridCodeFilter = best.new_code;
              window.location.hash = `#/sondages?grid=${encodeURIComponent(best.new_code)}`;
              await this.refresh();
            }
          }
        } catch (e: any) {
          console.warn('[SONDAGES LIST] Legacy lookup failed:', e);
        }
      }
    } catch (e: any) {
      console.error('[SONDAGES LIST] Error refreshing:', e);
      throw e;
    } finally {
      this.loading = false;
    }
  }

  private normalizeSearchQuery(value: string): string {
    const raw = (value || '').trim();
    if (!raw) return '';

    // Normalize separators (spaces/underscores) to dashes
    const compact = raw.replace(/[\s_]+/g, '-');
    const upper = compact.toUpperCase();

    // If user typed TG 0857 0162 01 -> TG-0857-0162-01
    const m = upper.match(/^TG-?(\d{4})-?(\d{4})-?(\d{2})(?:-?(\d{2}))?$/);
    if (!m) return compact; // keep user formatting for non-grid queries

    const part4 = m[4] ? `-${m[4]}` : '';
    return `TG-${m[1]}-${m[2]}-${m[3]}${part4}`;
  }

  private isProbablyGridCode(value: string): boolean {
    if (!value) return false;
    return /^TG-\d{4}-\d{4}-\d{2}$/i.test(value) || /^TG-\d{4}-\d{4}-\d{2}-\d{2}$/i.test(value);
  }

  private getFilteredSondages(): Sondage[] {
    let filteredSondages = this.sondages.slice();

    if (this.filterSource !== 'all') {
      filteredSondages = filteredSondages.filter(s => s.source === this.filterSource);
    }

    if (this.filterAdm3 !== 'all') {
      filteredSondages = filteredSondages.filter(s => s.adm3_name === this.filterAdm3);
    }

    if (this.filterGeocodingMode !== 'all') {
      filteredSondages = filteredSondages.filter(s => {
        const badgeType = computeGeocodeBadgeFromSurvey(s);
        return badgeType === this.filterGeocodingMode;
      });
    }

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

    return filteredSondages;
  }

  private computeCenterLonLat(feature: MailleFeature): { lon: number; lat: number } | null {
    try {
      const coords = feature?.geometry?.coordinates;
      if (!coords) return null;
      const ring = coords?.[0];
      if (!Array.isArray(ring) || ring.length === 0) return null;

      let sumLon = 0;
      let sumLat = 0;
      let n = 0;
      for (const pt of ring) {
        if (!Array.isArray(pt) || pt.length < 2) continue;
        sumLon += Number(pt[0]);
        sumLat += Number(pt[1]);
        n += 1;
      }
      if (n === 0) return null;
      return { lon: sumLon / n, lat: sumLat / n };
    } catch {
      return null;
    }
  }

  private async tryFillEmptyStateForGridSearch(gridCode: string) {
    try {
      const maille = await getMailleFeature(gridCode);
      this.emptyStateContext = {
        kind: 'maille',
        maille,
        isLegacyRedirect: false,
      };
    } catch (e: any) {
      const msg = String(e?.message || '');
      const is404 = msg.includes('HTTP 404');

      if (!is404) return;

      if (this.legacyLookupTriedForSearchQuery === gridCode) return;
      this.legacyLookupTriedForSearchQuery = gridCode;

      try {
        const suggestions = await legacyLookupGridCode(gridCode);
        const best = Array.isArray(suggestions) && suggestions.length > 0 ? suggestions[0] : null;
        if (!best?.new_code) return;

        const newMaille = await getMailleFeature(best.new_code);
        this.emptyStateContext = {
          kind: 'maille',
          maille: newMaille,
          isLegacyRedirect: true,
          oldCode: gridCode,
          best,
        };
      } catch (e2: any) {
        console.warn('[SONDAGES LIST] EmptyState grid lookup failed:', e2);
      }
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

    // Bandeau filtre maille
    const gridFilterBanner = this.gridCodeFilter ? `
      <div id="grid-filter-banner" style="padding: 12px 20px; background: #1a365d; border-bottom: 1px solid #2563eb; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">📍</span>
          <span style="color: #93c5fd; font-size: 13px;">
            Filtre maille actif : <strong style="color: #ecf2f8;">${this.gridCodeFilter}</strong>
            <span style="color: #94a3b8; margin-left: 8px;">(${this.sondages.length} sondage${this.sondages.length > 1 ? 's' : ''})</span>
          </span>
        </div>
        <button id="clear-grid-filter-btn" style="padding: 4px 10px; background: #22304d; color: #ecf2f8; border: 1px solid #4c6ef5; border-radius: 4px; cursor: pointer; font-size: 11px;">
          ✕ Retirer le filtre
        </button>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="sondages-list-panel" style="display: flex; flex-direction: column; height: 100%; background: #0a0e17; min-height: 0;">
        ${gridFilterBanner}
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
              id="list-search-input" 
              placeholder="🔍 Rechercher un sondage..." 
              value="${this.searchQuery}"
              style="flex: 1; min-width: 200px; padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px;"
            />
            <select 
              id="list-filter-geocoded" 
              style="padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px; cursor: pointer;"
            >
              <option value="all" ${this.filterGeocoded === 'all' ? 'selected' : ''}>Tous</option>
              <option value="geocoded" ${this.filterGeocoded === 'geocoded' ? 'selected' : ''}>Géocodés</option>
              <option value="not_geocoded" ${this.filterGeocoded === 'not_geocoded' ? 'selected' : ''}>Non géocodés</option>
            </select>
            <select 
              id="list-filter-geocoding-mode" 
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
              id="list-filter-source" 
              style="padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px; cursor: pointer;"
            >
              <option value="all" ${this.filterSource === 'all' ? 'selected' : ''}>Toutes sources</option>
              ${this.getUniqueSourcesOptions()}
            </select>
            <select 
              id="list-filter-adm3" 
              style="padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px; cursor: pointer;"
            >
              <option value="all" ${this.filterAdm3 === 'all' ? 'selected' : ''}>Toutes ADM3</option>
              ${this.getUniqueAdm3Options()}
            </select>
            <select 
              id="list-sort-by" 
              style="padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px; cursor: pointer;"
            >
              <option value="created_at" ${this.sortBy === 'created_at' ? 'selected' : ''}>📅 Date création</option>
              <option value="code" ${this.sortBy === 'code' ? 'selected' : ''}>🏷️ Code</option>
              <option value="localite" ${this.sortBy === 'localite' ? 'selected' : ''}>📍 Localité</option>
              <option value="is_geocoded" ${this.sortBy === 'is_geocoded' ? 'selected' : ''}>🎯 Géocodage</option>
            </select>
            <button 
              id="list-sort-order" 
              style="padding: 10px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px; cursor: pointer;"
              title="Ordre de tri"
            >
              ${this.sortOrder === 'desc' ? '⬇️ Desc' : '⬆️ Asc'}
            </button>
          </div>
        </div>

        <!-- Liste -->
        <div id="list-sondages-list" style="flex: 1; min-height: 0; overflow-y: auto; padding: 16px;">
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
    const listContainer = document.getElementById('list-sondages-list');
    if (listContainer) {
      listContainer.innerHTML = this.renderSondagesList();
      this.attachItemListeners(); // Re-attach only item listeners (not filter/sort)
      this.attachEmptyStateActionListeners();
    }
  }

  private renderSondagesList(): string {
    if (this.loading) {
      return '<div style="text-align: center; padding: 40px; color: #94a3b8;">⏳ Chargement...</div>';
    }

    if (this.sondages.length === 0) {
      if (this.emptyStateContext?.kind === 'maille') {
        return this.renderEmptyStateMailleHtml();
      }
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

    const filteredSondages = this.getFilteredSondages();

    // Résultat vide après filtres => si un contexte maille existe, afficher l'empty-state enrichi
    if (filteredSondages.length === 0 && this.emptyStateContext?.kind === 'maille') {
      return this.renderEmptyStateMailleHtml();
    }

    if (filteredSondages.length === 0) {
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

    return filteredSondages
      .map((s) => {
        const isGeocoded = s.is_geocoded;
        const locationMode = s.location_mode || 'unknown';
        const badgeType = computeGeocodeBadgeFromSurvey(s);
        const statusColor = isGeocoded ? '#51cf66' : '#ff6b6b';
        const statusIcon = isGeocoded ? '✅' : '❌';
        const modeLabel = this.getLocationModeLabel(locationMode);
        
        // Badges AUTO/MANUEL
        const getBadgeHtml = (type: GeocodeBadgeType) => {
          switch (type) {
            case 'auto':
              return `<div style="padding: 2px 6px; background: #4c6ef522; border: 1px solid #4c6ef5; border-radius: 4px; font-size: 10px; color: #4c6ef5; font-weight: 600; margin-bottom: 2px;">🤖 AUTO</div>`;
            case 'manual':
              return `<div style="padding: 2px 6px; background: #ff922b22; border: 1px solid #ff922b; border-radius: 4px; font-size: 10px; color: #ff922b; font-weight: 600; margin-bottom: 2px;">👤 MANUEL</div>`;
            default:
              return '';
          }
        };

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
                ${getBadgeHtml(badgeType)}
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
    this.attachControlListeners();
    this.attachItemListeners();
  }

  private attachControlListeners() {
    // Bouton retirer filtre maille
    const clearGridFilterBtn = document.getElementById('clear-grid-filter-btn');
    if (clearGridFilterBtn) {
      clearGridFilterBtn.addEventListener('click', async () => {
        this.gridCodeFilter = null;
        // Retirer le paramètre grid de l'URL
        window.location.hash = '#/sondages';
        await this.refresh();
        // Re-render complet pour retirer le bandeau
        if (this.currentContainerId && this.onSuccessCallback && this.onErrorCallback) {
          this.renderUI(this.currentContainerId, this.onSuccessCallback, this.onErrorCallback);
        }
      });
    }
    
    // Search input
    const searchInput = document.getElementById('list-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', async (e) => {
        const raw = (e.target as HTMLInputElement).value;
        const normalized = this.normalizeSearchQuery(raw);
        this.searchQuery = normalized;
        if (normalized !== raw) {
          (e.target as HTMLInputElement).value = normalized;
        }
        console.log('[LIST] Search query:', this.searchQuery);
        await this.refresh();
        // Ne pas recréer tout le HTML, juste la liste
        this.rerenderList();
      });
    }

    // Filter select
    const filterSelect = document.getElementById('list-filter-geocoded') as HTMLSelectElement;
    if (filterSelect) {
      filterSelect.addEventListener('change', async (e) => {
        this.filterGeocoded = (e.target as HTMLSelectElement).value as any;
        await this.refresh();
        // Ne pas recréer tout le HTML, juste la liste
        this.rerenderList();
      });
    }

    // Advanced filters
    const filterGeocodingMode = document.getElementById('list-filter-geocoding-mode') as HTMLSelectElement;
    if (filterGeocodingMode) {
      filterGeocodingMode.addEventListener('change', () => {
        this.filterGeocodingMode = filterGeocodingMode.value as any;
        console.log('[LIST] Filter geocoding mode:', this.filterGeocodingMode);
        this.rerenderList();
      });
    }

    const filterSource = document.getElementById('list-filter-source') as HTMLSelectElement;
    if (filterSource) {
      filterSource.addEventListener('change', () => {
        this.filterSource = filterSource.value;
        console.log('[LIST] Filter source:', this.filterSource);
        this.rerenderList();
      });
    }

    const filterAdm3 = document.getElementById('list-filter-adm3') as HTMLSelectElement;
    if (filterAdm3) {
      filterAdm3.addEventListener('change', () => {
        this.filterAdm3 = filterAdm3.value;
        console.log('[LIST] Filter ADM3:', this.filterAdm3);
        this.rerenderList();
      });
    }

    const sortBy = document.getElementById('list-sort-by') as HTMLSelectElement;
    if (sortBy) {
      sortBy.addEventListener('change', () => {
        this.sortBy = sortBy.value as any;
        console.log('[LIST] Sort by:', this.sortBy);
        this.rerenderList();
      });
    }

    const sortOrder = document.getElementById('list-sort-order') as HTMLButtonElement;
    if (sortOrder) {
      sortOrder.addEventListener('click', () => {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        console.log('[LIST] Sort order:', this.sortOrder);
        // Update button text
        sortOrder.textContent = this.sortOrder === 'asc' ? '⬆️ Asc' : '⬇️ Desc';
        this.rerenderList();
      });
    }
  }

  private attachItemListeners() {
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
