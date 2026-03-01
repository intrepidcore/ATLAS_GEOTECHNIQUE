/**
 * Panel de suggestions ADM3 basé sur la nouvelle API
 * Utilise /suggestions avec candidates JSON
 */

import {
  listGeocodeSuggestions,
  getSuggestionStats,
  acceptSuggestion,
  rejectSuggestion,
  SuggestionItem,
  SuggestionStats,
} from './api/geocode';
import { toast } from './ui/toast';

export class SuggestionsAdmPanel {
  private suggestions: SuggestionItem[] = [];
  private stats: SuggestionStats | null = null;
  private loading = false;
  private currentContainerId?: string;
  private onSuccessCallback?: (msg: string) => void;
  private onErrorCallback?: (error: string) => void;

  constructor(private apiUrl: string) {}

  async refresh() {
    this.loading = true;
    try {
      this.stats = await getSuggestionStats();
      this.suggestions = await listGeocodeSuggestions({ status: 'pending', limit: 500 });
    } catch (e: any) {
      console.error('[SUGGESTIONS ADM] Error refreshing:', e);
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

    // Listen for refresh events
    window.addEventListener('atlas:refresh-stats', async () => {
      console.log('[SUGGESTIONS PANEL] Refreshing after WebSocket event...');
      try {
        await this.refresh();
        this.renderUI(containerId, onSuccess, onError);
      } catch (e) {
        console.error('[SUGGESTIONS PANEL] Error refreshing:', e);
      }
    });

    const pendingCount = this.stats?.pending || 0;
    const allDone = pendingCount === 0;

    container.innerHTML = `
      <div class="suggestions-adm-panel" style="display: flex; flex-direction: column; height: 100%; background: #0a0e17; overflow: hidden;">
        <!-- Header -->
        <div style="padding: 16px; border-bottom: 1px solid #22304d;">
          <h3 style="margin: 0 0 12px 0; color: #ecf2f8;">
            🤖 Suggestions ADM3 automatiques
            <span id="count-badge" style="margin-left: 8px; padding: 2px 8px; background: ${allDone ? '#51cf66' : '#4c6ef5'}; color: #fff; border-radius: 12px; font-size: 12px;">${pendingCount}</span>
          </h3>
          <div style="display: flex; gap: 12px; font-size: 12px; color: #94a3b8;">
            <div>Total: <strong>${this.stats?.total || 0}</strong></div>
            <div>Acceptées: <strong style="color: #51cf66;">${this.stats?.accepted || 0}</strong></div>
            <div>Rejetées: <strong style="color: #ff6b6b;">${this.stats?.rejected || 0}</strong></div>
          </div>
        </div>

        <!-- Liste -->
        <div id="suggestions-list" style="flex: 1; overflow-y: auto; padding: 16px;">
          ${this.renderSuggestionsList()}
        </div>
      </div>
    `;

    this.attachListeners();
  }

  private renderSuggestionsList(): string {
    if (this.loading) {
      return '<div style="text-align: center; padding: 40px; color: #94a3b8;">⏳ Chargement...</div>';
    }

    if (this.suggestions.length === 0) {
      return `
        <div style="text-align: center; padding: 40px; color: #94a3b8;">
          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
          <div style="font-size: 16px; font-weight: 600; color: #ecf2f8; margin-bottom: 8px;">
            Aucune suggestion en attente
          </div>
          <div style="font-size: 14px;">
            Tous les sondages ont été traités ou n'ont pas de suggestions disponibles.
          </div>
        </div>
      `;
    }

    return this.suggestions
      .map((s) => {
        let candidates: any[] = [];
        try {
          const raw = (s as any).candidates;
          
          if (!raw || raw === 'null' || raw === 'NULL') {
            // Pas de candidates, utiliser top_code
            candidates = [];
          } else if (typeof raw === 'string') {
            // Nettoyer la chaîne avant parsing
            const cleaned = raw.trim();
            if (cleaned === '' || cleaned === '{}' || cleaned === 'null') {
              candidates = [];
            } else {
              try {
                candidates = JSON.parse(cleaned);
              } catch (parseErr) {
                // Tentative de correction pour JSON mal formé
                console.warn('[SUGGESTIONS ADM] JSON mal formé, tentative de correction:', cleaned.substring(0, 50));
                candidates = [];
              }
            }
          } else if (Array.isArray(raw)) {
            candidates = raw;
          } else if (raw && typeof raw === 'object') {
            candidates = [raw];
          } else {
            console.warn('[SUGGESTIONS ADM] format inconnu pour candidates:', raw);
          }
          
          // Valider que candidates est bien un array
          if (!Array.isArray(candidates)) {
            console.warn('[SUGGESTIONS ADM] candidates n\'est pas un array après parsing:', candidates);
            candidates = [];
          }
        } catch (e) {
          console.error('[SUGGESTIONS ADM] Error parsing candidates for', s.id, e);
          candidates = [];
        }
        
        // Construire topCandidate depuis top_code si candidates est vide
        const topCandidate = candidates.length > 0 
          ? candidates[0] 
          : { code: s.top_code, name: s.top_code, score: s.top_score };

        return `
          <div class="suggestion-card" style="background: #1a2332; border: 1px solid #22304d; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
              <div>
                <div style="font-size: 14px; font-weight: 600; color: #ecf2f8; margin-bottom: 4px;">
                  📍 ${this.escapeHtml(s.localite)}
                </div>
                <div style="font-size: 12px; color: #94a3b8;">
                  Sondage: ${s.entity_id.substring(0, 8)}...
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 11px; color: #94a3b8;">Score</div>
                <div style="font-size: 18px; font-weight: 700; color: ${this.getScoreColor(parseInt(s.top_score))};">
                  ${s.top_score}%
                </div>
              </div>
            </div>

            <!-- Top Candidate -->
            <div style="background: #0f172a; border: 2px solid #4c6ef5; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
                <div style="font-size: 11px; color: #94a3b8;">🎯 Meilleur candidat</div>
                <button 
                  class="view-adm3-btn" 
                  data-code="${topCandidate.code}"
                  style="padding: 4px 8px; background: #22304d; color: #ecf2f8; border: none; border-radius: 4px; font-size: 11px; cursor: pointer; transition: background 0.2s;"
                  title="Voir sur la carte"
                >
                  👁️ Voir
                </button>
              </div>
              <div style="font-size: 14px; font-weight: 600; color: #ecf2f8; margin-bottom: 4px;">
                ${topCandidate.name || topCandidate.code}
              </div>
              <div style="font-size: 12px; color: #94a3b8;">
                Code: ${topCandidate.code}
              </div>
            </div>

            <!-- Other Candidates -->
            ${candidates.length > 1 ? `
              <details style="margin-bottom: 12px;">
                <summary style="cursor: pointer; font-size: 12px; color: #94a3b8; margin-bottom: 8px;">
                  📋 Autres candidats (${candidates.length - 1})
                </summary>
                <div style="padding-left: 12px; margin-top: 8px;">
                  ${candidates.slice(1).map((c: any) => `
                    <div style="background: #0f172a; border: 1px solid #22304d; border-radius: 4px; padding: 8px; margin-bottom: 6px;">
                      <div style="display: flex; justify-content: space-between;">
                        <span style="font-size: 13px; color: #ecf2f8;">${c.name || c.code}</span>
                        <span style="font-size: 12px; color: ${this.getScoreColor(parseInt(c.score))};">${c.score}%</span>
                      </div>
                      <div style="font-size: 11px; color: #94a3b8;">${c.code}</div>
                    </div>
                  `).join('')}
                </div>
              </details>
            ` : ''}

            <!-- Actions -->
            <div style="display: flex; gap: 8px;">
              <button 
                class="accept-btn" 
                data-id="${s.id}"
                style="flex: 1; padding: 10px; background: linear-gradient(135deg, #4c6ef5, #51cf66); color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: transform 0.2s;"
              >
                ✅ Géocoder
              </button>
              <button 
                class="reject-btn" 
                data-id="${s.id}"
                style="padding: 10px 16px; background: #ff6b6b; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: transform 0.2s;"
              >
                ❌ Rejeter
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  private attachListeners() {
    // Accept buttons
    document.querySelectorAll('.accept-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.target as HTMLElement).dataset.id!;
        await this.handleAccept(id);
      });
    });

    // Reject buttons
    document.querySelectorAll('.reject-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.target as HTMLElement).dataset.id!;
        await this.handleReject(id);
      });
    });

    // View ADM3 buttons
    document.querySelectorAll('.view-adm3-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = (e.target as HTMLElement).dataset.code!;
        this.handleViewAdm3(code);
      });
    });
  }

  private async handleAccept(id: string) {
    try {
      const result = await acceptSuggestion(id);
      toast.success(`✅ Suggestion acceptée ! Sondage ${result.sondage_id.substring(0, 8)}... géocodé avec ${result.adm3_pcode}`);
      
      // Rafraîchir
      await this.refresh();
      if (this.currentContainerId && this.onSuccessCallback && this.onErrorCallback) {
        this.renderUI(this.currentContainerId, this.onSuccessCallback, this.onErrorCallback);
      }
      
      if (this.onSuccessCallback) {
        this.onSuccessCallback(`Suggestion acceptée: ${result.adm3_pcode}`);
      }
    } catch (e: any) {
      console.error('[SUGGESTIONS ADM] Error accepting:', e);
      toast.error(`❌ ${e.message || 'Erreur lors de l\'acceptation'}`);
      if (this.onErrorCallback) {
        this.onErrorCallback(e.message || 'Erreur');
      }
    }
  }

  private async handleReject(id: string) {
    if (!confirm('Rejeter cette suggestion ?')) return;

    try {
      await rejectSuggestion(id);
      toast.success('❌ Suggestion rejetée');
      
      // Rafraîchir
      await this.refresh();
      if (this.currentContainerId && this.onSuccessCallback && this.onErrorCallback) {
        this.renderUI(this.currentContainerId, this.onSuccessCallback, this.onErrorCallback);
      }
      
      if (this.onSuccessCallback) {
        this.onSuccessCallback('Suggestion rejetée');
      }
    } catch (e: any) {
      console.error('[SUGGESTIONS ADM] Error rejecting:', e);
      toast.error(`❌ ${e.message || 'Erreur lors du rejet'}`);
      if (this.onErrorCallback) {
        this.onErrorCallback(e.message || 'Erreur');
      }
    }
  }

  private handleViewAdm3(code: string) {
    console.log('[SUGGESTIONS ADM] View ADM3:', code);
    // Dispatch custom event to trigger zoom on the map
    window.dispatchEvent(new CustomEvent('atlas:zoom-adm3', { detail: { code } }));
    toast.success(`🗺️ Zoom sur ${code}`);
  }

  private getScoreColor(score: number): string {
    if (score >= 90) return '#51cf66';
    if (score >= 75) return '#4c6ef5';
    if (score >= 60) return '#ffd43b';
    return '#ff6b6b';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
