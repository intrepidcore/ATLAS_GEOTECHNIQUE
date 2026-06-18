/**
 * Menu profil utilisateur pour la carte principale
 * Atlas Géotechnique v3.1 — Refonte SaaS Pro
 */

import { tokenStorage } from './services/auth-api';
import { APP_VERSION } from './version';
import { resetAllPanelSizes } from './components/resizable-panel';

interface UserInfo {
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  roles?: string[];
}

const MENU_STYLES = `
.user-menu-container {
  position: relative;
}

.user-menu-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: var(--field, #1E293B);
  border: 1px solid var(--field-border, #334155);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  color: var(--text, #F8FAFC);
}

.user-menu-btn:hover {
  border-color: var(--accent, #3b82f6);
  background: var(--field, #1E293B);
}

.user-avatar {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 11px;
  flex-shrink: 0;
}

.user-info {
  text-align: left;
}

.user-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text, #F8FAFC);
  line-height: 1.3;
}

.user-role-label {
  font-size: 10px;
  color: var(--muted, #94A3B8);
  line-height: 1.3;
}

.user-chevron {
  color: var(--muted, #94A3B8);
  font-size: 10px;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.user-menu-btn.open .user-chevron {
  transform: rotate(180deg);
}

.user-menu-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 272px;
  background: var(--panel, #0F172A);
  border: 1px solid var(--field-border, #334155);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.3);
  z-index: 9999;
  display: none;
  overflow: hidden;
}

.user-menu-dropdown.open {
  display: block;
  animation: umFadeIn 0.18s ease-out;
}

@keyframes umFadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* En-tête */
.user-menu-header {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--field-border, #334155);
}

.user-menu-header .user-avatar {
  width: 38px;
  height: 38px;
  font-size: 14px;
}

.user-menu-header-info {
  flex: 1;
  min-width: 0;
}

.user-menu-header-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #F8FAFC);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-menu-header-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.user-menu-header-email {
  font-size: 11px;
  color: var(--muted, #94A3B8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.user-role-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  background: rgba(59,130,246,0.15);
  color: #60a5fa;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Section label */
.user-menu-section-label {
  padding: 8px 16px 4px 16px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted, #94A3B8);
}

/* Items */
.user-menu-items {
  padding: 4px 0;
}

.user-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  color: var(--text, #C9D7E3);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  font-family: inherit;
}

.user-menu-item:hover {
  background: var(--field, rgba(255,255,255,0.06));
}

.user-menu-item svg {
  width: 15px;
  height: 15px;
  color: var(--muted, #94A3B8);
  flex-shrink: 0;
  stroke: currentColor;
}

.user-menu-item.danger {
  color: #ef4444;
}

.user-menu-item.danger svg {
  color: #ef4444;
}

.user-menu-item.danger:hover {
  background: rgba(239,68,68,0.08);
}

/* Dividers */
.user-menu-divider {
  height: 1px;
  background: var(--field-border, #334155);
  margin: 4px 0;
}

/* Footer */
.user-menu-footer {
  padding: 8px 16px;
  border-top: 1px solid var(--field-border, #334155);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: var(--muted, #6b778c);
}

.user-menu-footer .um-status-dot {
  width: 6px;
  height: 6px;
  background: #22c55e;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
}
`;

const ICONS: Record<string, string> = {
  map:      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
  database: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
  user:     '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  key:      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  help:     '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>',
  reset:    '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
  logout:   '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
};

class UserMenu {
  private container: HTMLElement | null = null;
  private isOpen = false;
  private user: UserInfo | null = null;

  constructor() {
    this.injectStyles();
    this.loadUser();
  }

  private injectStyles(): void {
    if (document.getElementById('user-menu-styles')) return;
    const style = document.createElement('style');
    style.id = 'user-menu-styles';
    style.textContent = MENU_STYLES;
    document.head.appendChild(style);
  }

  private async loadUser(): Promise<void> {
    try {
      if (tokenStorage.isAuthenticated()) {
        const cachedUser = tokenStorage.getUser<UserInfo>();
        if (cachedUser) {
          this.user = cachedUser;
          this.updateUI();
          return;
        }

        const token = tokenStorage.getAccessToken();
        if (token) {
          const response = await fetch('http://localhost:8000/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.ok) {
            this.user = await response.json();
            if (this.user) tokenStorage.setUser(this.user as any);
            this.updateUI();
          }
        }
      }
    } catch (e) {
      console.warn('[UserMenu] Erreur chargement utilisateur:', e);
    }
  }

  private updateUI(): void {
    if (this.container?.parentElement && this.user) {
      const newEl = this.render();
      this.container.parentElement.replaceChild(newEl, this.container);
    }
  }

  private getInitials(): string {
    if (this.user?.first_name && this.user?.last_name) {
      return `${this.user.first_name[0]}${this.user.last_name[0]}`.toUpperCase();
    }
    return this.user?.username?.[0]?.toUpperCase() ?? 'U';
  }

  private getDisplayName(): string {
    if (this.user?.first_name && this.user?.last_name) {
      return `${this.user.first_name} ${this.user.last_name}`;
    }
    return this.user?.username ?? 'Utilisateur';
  }

  private getPrimaryRole(): string {
    const labels: Record<string, string> = {
      'admin': 'Admin',
      'super-admin': 'Super Admin',
      'supervisor': 'Superviseur',
      'data_manager': 'Gestionnaire',
      'geo_analyst': 'Analyste',
      'editor': 'Éditeur',
      'viewer': 'Lecteur',
      'student': 'Étudiant'
    };
    const roles = this.user?.roles ?? [];
    for (const r of roles) {
      if (labels[r]) return labels[r];
    }
    return roles[0] ?? 'Utilisateur';
  }

  private toggle(): void {
    this.isOpen = !this.isOpen;
    this.container?.querySelector('.user-menu-btn')?.classList.toggle('open', this.isOpen);
    this.container?.querySelector('.user-menu-dropdown')?.classList.toggle('open', this.isOpen);
  }

  private close(): void {
    this.isOpen = false;
    this.container?.querySelector('.user-menu-btn')?.classList.remove('open');
    this.container?.querySelector('.user-menu-dropdown')?.classList.remove('open');
  }

  private logout(): void {
    localStorage.removeItem('atlas_token');
    localStorage.removeItem('atlas_access_token');
    localStorage.removeItem('atlas_refresh_token');
    window.location.href = `/login.html?returnTo=${encodeURIComponent('/index.html')}`;
  }

  private showToast(msg: string): void {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--panel);border:1px solid var(--field-border);color:var(--text);padding:10px 16px;border-radius:8px;font-size:13px;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.3)';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  public render(): HTMLElement {
    if (!this.user) {
      const btn = document.createElement('button');
      btn.style.cssText = 'background:var(--accent);border:none;color:white;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit';
      btn.textContent = 'Connexion';
      btn.onclick = () => window.location.href = `/login.html?returnTo=${encodeURIComponent('/index.html')}`;
      return btn;
    }

    this.container = document.createElement('div');
    this.container.className = 'user-menu-container';
    this.container.innerHTML = `
      <button class="user-menu-btn" aria-label="Menu utilisateur" aria-haspopup="true">
        <div class="user-avatar">${this.getInitials()}</div>
        <div class="user-info">
          <div class="user-name">${this.getDisplayName()}</div>
          <div class="user-role-label">${this.getPrimaryRole()}</div>
        </div>
        <span class="user-chevron">▾</span>
      </button>

      <div class="user-menu-dropdown" role="menu">
        <!-- En-tête -->
        <div class="user-menu-header">
          <div class="user-avatar">${this.getInitials()}</div>
          <div class="user-menu-header-info">
            <div class="user-menu-header-name">${this.getDisplayName()}</div>
            <div class="user-menu-header-meta">
              <span class="user-menu-header-email">${this.user.email ?? this.user.username ?? ''}</span>
              <span class="user-role-pill">${this.getPrimaryRole()}</span>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <div class="user-menu-items">
          <button class="user-menu-item" data-action="map" role="menuitem">
            ${ICONS.map}<span>Carte principale</span>
          </button>
          <button class="user-menu-item" data-action="db" role="menuitem">
            ${ICONS.database}<span>Gestion Base de Données</span>
          </button>
        </div>

        <div class="user-menu-divider"></div>

        <!-- Paramètres -->
        <div class="user-menu-section-label">Paramètres</div>
        <div class="user-menu-items">
          <button class="user-menu-item" data-action="profile" role="menuitem">
            ${ICONS.user}<span>Mon Profil &amp; Compte</span>
          </button>
          <button class="user-menu-item" data-action="apikeys" role="menuitem">
            ${ICONS.key}<span>Clés API &amp; Accès</span>
          </button>
          <button class="user-menu-item" data-action="preferences" role="menuitem">
            ${ICONS.settings}<span>Préférences d'affichage</span>
          </button>
        </div>

        <div class="user-menu-divider"></div>

        <!-- Aide -->
        <div class="user-menu-items">
          <button class="user-menu-item" data-action="help" role="menuitem">
            ${ICONS.help}<span>Aide &amp; Documentation</span>
          </button>
          <button class="user-menu-item" data-action="shortcuts" role="menuitem">
            ${ICONS.keyboard}<span>Raccourcis clavier</span>
          </button>
          <button class="user-menu-item" data-action="resetPanels" role="menuitem">
            ${ICONS.reset}<span>Réinitialiser l'interface</span>
          </button>
        </div>

        <div class="user-menu-divider"></div>

        <!-- Déconnexion -->
        <div class="user-menu-items">
          <button class="user-menu-item danger" data-action="logout" role="menuitem">
            ${ICONS.logout}<span>Déconnexion</span>
          </button>
        </div>

        <div class="user-menu-footer">
          <span>Atlas Géotechnique</span>
          <span><span class="um-status-dot"></span>${APP_VERSION}</span>
        </div>
      </div>
    `;

    const btn = this.container.querySelector('.user-menu-btn')!;
    btn.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(); });

    this.container.querySelectorAll('.user-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        this.close();
        switch (action) {
          case 'map':         window.location.href = '/index.html'; break;
          case 'db':          window.location.href = '/db-manager.html'; break;
          case 'help':        window.open('https://docs.atlas-geotechnique.com', '_blank'); break;
          case 'shortcuts':   this.showToast('Raccourcis : Échap (fermer), Ctrl+F (recherche), Ctrl+P (panneau)'); break;
          case 'profile':     this.showToast('Profil utilisateur — disponible dans la prochaine version'); break;
          case 'apikeys':     this.showToast('Gestion des clés API — disponible dans la prochaine version'); break;
          case 'preferences': this.showToast('Préférences — disponible dans la prochaine version'); break;
          case 'resetPanels': resetAllPanelSizes(); break;
          case 'logout':      this.logout(); break;
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.container?.contains(e.target as Node)) this.close();
    });

    return this.container;
  }

  public mount(targetSelector: string): void {
    const target = document.querySelector(targetSelector);
    if (!target) return;
    const el = this.render();
    const apiBadge = target.querySelector('.badge');
    if (apiBadge) target.insertBefore(el, apiBadge);
    else target.appendChild(el);
  }
}

export function initUserMenu(): UserMenu {
  const menu = new UserMenu();
  setTimeout(() => menu.mount('#topbar'), 100);
  return menu;
}

export { UserMenu };
