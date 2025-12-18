/**
 * Menu profil utilisateur pour la carte principale
 * Atlas Géotechnique v3.0
 */

import { tokenStorage } from './services/auth-api';

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
  margin-left: auto;
}

.user-menu-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #0f172a;
  border: 1px solid #22304d;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.user-menu-btn:hover {
  border-color: #3aa6ff;
  background: #131d30;
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
  font-size: 12px;
}

.user-info {
  text-align: left;
}

.user-name {
  font-size: 12px;
  font-weight: 500;
  color: #ecf2f8;
}

.user-role {
  font-size: 10px;
  color: #8aa0b5;
}

.user-chevron {
  color: #8aa0b5;
  font-size: 10px;
  transition: transform 0.2s;
}

.user-menu-btn.open .user-chevron {
  transform: rotate(180deg);
}

.user-menu-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 240px;
  background: #111a2a;
  border: 1px solid #22304d;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.4);
  z-index: 9999;
  display: none;
  overflow: hidden;
}

.user-menu-dropdown.open {
  display: block;
  animation: menuFadeIn 0.2s ease-out;
}

@keyframes menuFadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.user-menu-header {
  padding: 14px;
  border-bottom: 1px solid #1b2740;
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-menu-header .user-avatar {
  width: 36px;
  height: 36px;
  font-size: 14px;
}

.user-menu-header-info {
  flex: 1;
  min-width: 0;
}

.user-menu-header-name {
  font-size: 13px;
  font-weight: 600;
  color: #ecf2f8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-menu-header-email {
  font-size: 11px;
  color: #8aa0b5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-menu-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 14px;
  border-bottom: 1px solid #1b2740;
}

.role-badge {
  font-size: 10px;
  padding: 2px 8px;
  background: #3aa6ff22;
  color: #3aa6ff;
  border-radius: 10px;
}

.user-menu-items {
  padding: 6px 0;
}

.user-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  color: #c9d7e3;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
}

.user-menu-item:hover {
  background: #0f172a;
}

.user-menu-item.danger {
  color: #ef476f;
}

.user-menu-item.danger:hover {
  background: #6b1b2c22;
}

.user-menu-item svg {
  width: 16px;
  height: 16px;
  opacity: 0.7;
}

.user-menu-divider {
  height: 1px;
  background: #1b2740;
  margin: 6px 0;
}

.user-menu-footer {
  padding: 10px 14px;
  background: #0a1018;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: #6b778c;
}

.user-menu-footer .status-dot {
  width: 6px;
  height: 6px;
  background: #0bb07b;
  border-radius: 50%;
  margin-right: 4px;
  display: inline-block;
}
`;

// Icônes SVG
const ICONS = {
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>',
  database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
  chevron: '▼'
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
        // D'abord essayer de récupérer l'utilisateur depuis le localStorage (plus rapide)
        const cachedUser = tokenStorage.getUser();
        if (cachedUser) {
          this.user = cachedUser;
          this.updateUI();
          console.log('[UserMenu] Utilisateur chargé depuis cache:', cachedUser.username);
          return;
        }
        
        // Sinon, appeler l'API
        const token = tokenStorage.getAccessToken();
        if (token) {
          const response = await fetch('http://localhost:8000/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.ok) {
            this.user = await response.json();
            // Sauvegarder pour les prochaines fois
            if (this.user) {
              tokenStorage.setUser(this.user as any);
            }
            this.updateUI();
          } else {
            console.warn('[UserMenu] Erreur auth/me:', response.status);
            // Si 401, le token est invalide - ne pas afficher le menu
          }
        }
      }
    } catch (e) {
      console.warn('[UserMenu] Erreur chargement utilisateur:', e);
    }
  }
  
  private updateUI(): void {
    // Mettre à jour le menu si déjà monté
    if (this.container && this.user) {
      const existingMenu = this.container.parentElement;
      if (existingMenu) {
        const newElement = this.render();
        existingMenu.replaceChild(newElement, this.container);
      }
    }
  }

  private getInitials(): string {
    if (this.user?.first_name && this.user?.last_name) {
      return `${this.user.first_name.charAt(0)}${this.user.last_name.charAt(0)}`.toUpperCase();
    }
    return this.user?.username?.charAt(0).toUpperCase() || 'U';
  }

  private getDisplayName(): string {
    if (this.user?.first_name && this.user?.last_name) {
      return `${this.user.first_name} ${this.user.last_name}`;
    }
    return this.user?.username || 'Utilisateur';
  }

  private getPrimaryRole(): string {
    const roleLabels: Record<string, string> = {
      'admin': 'Administrateur',
      'super-admin': 'Super Admin',
      'supervisor': 'Superviseur',
      'data_manager': 'Gestionnaire',
      'geo_analyst': 'Analyste',
      'editor': 'Éditeur',
      'viewer': 'Lecteur',
      'student': 'Étudiant'
    };

    if (this.user?.roles && this.user.roles.length > 0) {
      for (const role of this.user.roles) {
        if (roleLabels[role]) return roleLabels[role];
      }
      return this.user.roles[0];
    }
    return 'Utilisateur';
  }

  private toggle(): void {
    this.isOpen = !this.isOpen;
    const btn = this.container?.querySelector('.user-menu-btn');
    const dropdown = this.container?.querySelector('.user-menu-dropdown');
    
    if (btn) btn.classList.toggle('open', this.isOpen);
    if (dropdown) dropdown.classList.toggle('open', this.isOpen);
  }

  private close(): void {
    this.isOpen = false;
    const btn = this.container?.querySelector('.user-menu-btn');
    const dropdown = this.container?.querySelector('.user-menu-dropdown');
    
    if (btn) btn.classList.remove('open');
    if (dropdown) dropdown.classList.remove('open');
  }

  private logout(): void {
    localStorage.removeItem('atlas_token');
    localStorage.removeItem('atlas_access_token');
    localStorage.removeItem('atlas_refresh_token');
    window.location.href = '/db-manager.html';
  }

  public render(): HTMLElement {
    if (!this.user) {
      // Pas connecté - afficher bouton de connexion
      const loginBtn = document.createElement('button');
      loginBtn.className = 'btn-sm';
      loginBtn.style.cssText = 'background:#3b82f6;border-color:#3b82f6;color:white';
      loginBtn.textContent = '🔐 Connexion';
      loginBtn.onclick = () => window.location.href = '/db-manager.html';
      return loginBtn;
    }

    this.container = document.createElement('div');
    this.container.className = 'user-menu-container';
    this.container.innerHTML = `
      <button class="user-menu-btn">
        <div class="user-avatar">${this.getInitials()}</div>
        <div class="user-info">
          <div class="user-name">${this.getDisplayName()}</div>
          <div class="user-role">${this.getPrimaryRole()}</div>
        </div>
        <span class="user-chevron">${ICONS.chevron}</span>
      </button>
      
      <div class="user-menu-dropdown">
        <div class="user-menu-header">
          <div class="user-avatar">${this.getInitials()}</div>
          <div class="user-menu-header-info">
            <div class="user-menu-header-name">${this.getDisplayName()}</div>
            <div class="user-menu-header-email">${this.user.email || this.user.username}</div>
          </div>
        </div>
        
        ${this.user.roles && this.user.roles.length > 0 ? `
          <div class="user-menu-roles">
            ${this.user.roles.slice(0, 4).map(r => `<span class="role-badge">${r}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="user-menu-items">
          <button class="user-menu-item" data-action="map">
            ${ICONS.map}
            <span>Carte principale</span>
          </button>
          <button class="user-menu-item" data-action="db">
            ${ICONS.database}
            <span>Gestion BDD</span>
          </button>
          <div class="user-menu-divider"></div>
          <button class="user-menu-item" data-action="help">
            ${ICONS.help}
            <span>Aide & Documentation</span>
          </button>
          <div class="user-menu-divider"></div>
          <button class="user-menu-item danger" data-action="logout">
            ${ICONS.logout}
            <span>Déconnexion</span>
          </button>
        </div>
        
        <div class="user-menu-footer">
          <span>Atlas Géotechnique</span>
          <span><span class="status-dot"></span>v3.0.0</span>
        </div>
      </div>
    `;

    // Event listeners
    const btn = this.container.querySelector('.user-menu-btn');
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Actions du menu
    this.container.querySelectorAll('.user-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        this.close();
        
        switch (action) {
          case 'map':
            window.location.href = '/index.html';
            break;
          case 'db':
            window.location.href = '/db-manager.html';
            break;
          case 'help':
            window.open('https://docs.atlas-geotechnique.com', '_blank');
            break;
          case 'logout':
            this.logout();
            break;
        }
      });
    });

    // Fermer le menu si on clique ailleurs
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.container?.contains(e.target as Node)) {
        this.close();
      }
    });

    return this.container;
  }

  public mount(targetSelector: string): void {
    const target = document.querySelector(targetSelector);
    if (target) {
      const element = this.render();
      // Insérer avant le badge API
      const apiBadge = target.querySelector('.badge');
      if (apiBadge) {
        target.insertBefore(element, apiBadge);
      } else {
        target.appendChild(element);
      }
    }
  }
}

export function initUserMenu(): UserMenu {
  const menu = new UserMenu();
  // Monter dans le topbar après le bouton Gestion BDD
  setTimeout(() => {
    menu.mount('#topbar');
  }, 100);
  return menu;
}

export { UserMenu };
