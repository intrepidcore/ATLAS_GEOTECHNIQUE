/**
 * Menu profil utilisateur
 * Atlas Géotechnique v3.0
 * 
 * Menu dropdown professionnel avec:
 * - Informations utilisateur
 * - Liens vers la carte et les paramètres
 * - Aide et documentation
 * - Déconnexion
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  LogOut, 
  Settings, 
  HelpCircle, 
  Map, 
  ChevronDown,
  Shield,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UserProfileMenuProps {
  user: {
    username?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    roles?: string[];
  } | null;
  onLogout: () => void;
}

export function UserProfileMenu({ user, onLogout }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Obtenir les initiales de l'utilisateur
  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
    }
    return user?.username?.charAt(0).toUpperCase() || 'U';
  };

  // Obtenir le nom d'affichage
  const getDisplayName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user?.username || 'Utilisateur';
  };

  // Obtenir le rôle principal
  const getPrimaryRole = () => {
    if (!user?.roles || user.roles.length === 0) return 'Utilisateur';
    
    const roleLabels: Record<string, string> = {
      'admin': 'Administrateur',
      'super-admin': 'Super Admin',
      'supervisor': 'Superviseur',
      'data_manager': 'Gestionnaire de données',
      'geo_analyst': 'Analyste géotechnique',
      'editor': 'Éditeur',
      'viewer': 'Lecteur',
      'student': 'Étudiant',
      'contributor': 'Contributeur',
      'validator': 'Validateur'
    };

    // Retourner le premier rôle avec un label
    for (const role of user.roles) {
      if (roleLabels[role]) {
        return roleLabels[role];
      }
    }
    return user.roles[0];
  };

  // Naviguer vers la carte
  const goToMap = () => {
    window.location.href = '/index.html';
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Bouton du menu */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:bg-slate-100 rounded-lg px-2 py-1.5"
      >
        {/* Avatar */}
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm shadow-sm">
          {getInitials()}
        </div>
        
        {/* Nom (caché sur mobile) */}
        <div className="hidden sm:block text-left">
          <div className="text-sm font-medium text-slate-900 leading-tight">
            {getDisplayName()}
          </div>
          <div className="text-xs text-slate-500 leading-tight">
            {getPrimaryRole()}
          </div>
        </div>
        
        {/* Chevron */}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {/* Menu dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
          {/* En-tête avec infos utilisateur */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                {getInitials()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 truncate">
                  {getDisplayName()}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {user?.email || user?.username}
                </div>
              </div>
            </div>
            
            {/* Badges des rôles */}
            {user?.roles && user.roles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {user.roles.slice(0, 3).map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                  >
                    {role}
                  </span>
                ))}
                {user.roles.length > 3 && (
                  <span className="text-xs text-slate-400">
                    +{user.roles.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Liens de navigation */}
          <div className="py-1">
            <button
              onClick={goToMap}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Map className="h-4 w-4 text-slate-400" />
              <span>Voir la carte</span>
              <ExternalLink className="h-3 w-3 text-slate-300 ml-auto" />
            </button>
            
            <button
              onClick={() => {
                setIsOpen(false);
                // TODO: Ouvrir les paramètres
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings className="h-4 w-4 text-slate-400" />
              <span>Paramètres</span>
            </button>

            {/* Lien admin si rôle admin */}
            {user?.roles?.some(r => ['admin', 'super-admin'].includes(r)) && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  // TODO: Ouvrir l'admin
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Shield className="h-4 w-4 text-slate-400" />
                <span>Administration</span>
              </button>
            )}
          </div>

          {/* Séparateur */}
          <div className="border-t border-slate-100 my-1" />

          {/* Aide */}
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                window.open('https://docs.atlas-geotechnique.com', '_blank');
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <HelpCircle className="h-4 w-4 text-slate-400" />
              <span>Aide & Documentation</span>
              <ExternalLink className="h-3 w-3 text-slate-300 ml-auto" />
            </button>
          </div>

          {/* Séparateur */}
          <div className="border-t border-slate-100 my-1" />

          {/* Déconnexion */}
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Déconnexion</span>
            </button>
          </div>

          {/* Footer avec version */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 rounded-b-xl">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Atlas Géotechnique</span>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span>v3.0.0</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserProfileMenu;
