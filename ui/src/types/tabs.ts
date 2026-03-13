/**
 * Types pour le système d'onglets QGIS-like
 * v2.5.0 - Phase UI-01
 */

export type TabId = 'nouveau' | 'import' | 'liste' | 'geocode' | 'database';

export interface Tab {
  id: TabId;
  label: string;
  icon: string;
  component: TabComponent;
  badge?: () => number | null;
}

export interface TabComponent {
  mount: (container: HTMLElement) => void;
  unmount: () => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
  refresh?: () => Promise<void>;
}

export interface TabsState {
  activeTab: TabId;
  previousTab: TabId | null;
}

export interface TabsManager {
  init: (container: HTMLElement, tabs: Tab[]) => void;
  switchTo: (tabId: TabId) => void;
  getActive: () => TabId;
  refresh: () => Promise<void>;
  destroy: () => void;
}
