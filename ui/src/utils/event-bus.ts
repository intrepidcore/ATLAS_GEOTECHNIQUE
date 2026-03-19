/**
 * Event Bus typé pour communication inter-composants
 * v2.5.0 - Phase UI-01
 */

type Events = {
  'survey:created': { id: string };
  'survey:updated': { id: string };
  'survey:geocoded': { id: string };
  'suggestion:changed': { pending: number };
  'tab:changed': { from: string; to: string };
  'maille:update': { mailleId: string };
  'mission:update': { missionId: string; mailleId?: string };
};

type Handler<T> = (payload: T) => void;

export const bus = (() => {
  const handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};

  return {
    /**
     * Écoute un événement
     * @returns Fonction de cleanup
     */
    on<K extends keyof Events>(type: K, fn: Handler<Events[K]>) {
      (handlers[type] ??= new Set() as any).add(fn);
      return () => handlers[type]!.delete(fn);
    },
    
    /**
     * Émet un événement
     */
    emit<K extends keyof Events>(type: K, payload: Events[K]) {
      handlers[type]?.forEach(h => h(payload));
    },
    
    /**
     * Nettoie tous les handlers
     */
    clear() {
      (Object.keys(handlers) as (keyof Events)[]).forEach(k => handlers[k]?.clear());
    }
  };
})();
