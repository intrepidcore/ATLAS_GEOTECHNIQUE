/**
 * Paramètre thématique actif — source unique hors `window`.
 * Les mises à jour passent par setActiveThematicParameterId (émet aussi l’événement).
 */
const DEFAULT_ID = 'vbs_ked_h2'
let activeParameterId = DEFAULT_ID

export function getActiveThematicParameterId(): string {
  return activeParameterId
}

/** Met à jour l’ID courant et notifie les écouteurs (drawer, exports, etc.). */
export function setActiveThematicParameterId(parameterId: string): void {
  const next = parameterId.trim() || DEFAULT_ID
  if (next === activeParameterId) return
  activeParameterId = next
  window.dispatchEvent(
    new CustomEvent('atlas-thematic-parameter-changed', { detail: { parameterId: activeParameterId } }),
  )
}
