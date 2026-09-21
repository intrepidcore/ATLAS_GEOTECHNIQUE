/**
 * Épinglage d'un opérateur sous la barre de recherche.
 *
 * Sélectionner un opérateur dans l'autocomplétion isole sa maille : la grille
 * nationale disparaît, seule sa zone reste à l'écran. Une puce nommée s'ancre
 * sous le champ de recherche pour que cet état ne soit jamais implicite — un
 * utilisateur qui ne verrait plus rien sur la carte doit comprendre pourquoi
 * en un coup d'œil, et pouvoir revenir en un clic.
 */

import { currentFilters, type FocusedOperator } from './filters-state'

const PIN_ID = 'operatorFocusPin'

/** Rappelé après chaque changement pour que la carte se recalcule. */
let onChange: (() => void) | null = null

export function initOperatorFocus(applyFilters: () => void): void {
  onChange = applyFilters
  render()
}

export function focusOperator(operator: FocusedOperator): void {
  currentFilters.focusedOperator = operator
  render()
  onChange?.()
}

export function clearOperatorFocus(): void {
  if (!currentFilters.focusedOperator) return
  currentFilters.focusedOperator = null
  render()
  onChange?.()
}

export function focusedOperator(): FocusedOperator | null {
  return currentFilters.focusedOperator
}

function render(): void {
  const input = document.getElementById('unifiedSearch')
  const bar = input?.parentElement
  if (!bar) return

  let pin = document.getElementById(PIN_ID)
  const focus = currentFilters.focusedOperator

  if (!focus) {
    pin?.remove()
    return
  }

  if (!pin) {
    pin = document.createElement('div')
    pin.id = PIN_ID
    pin.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:8px',
      'margin-top:6px',
      'padding:5px 10px',
      'border-radius:999px',
      'background:rgba(190,24,93,0.12)',
      'border:1px solid rgba(190,24,93,0.45)',
      'font-size:12px',
      'color:#be185d',
      'font-weight:600',
    ].join(';')
    bar.appendChild(pin)
  }

  const zone =
    focus.mailleCodes.length === 0
      ? ' · aucune maille'
      : focus.mailleCodes.length === 1
        ? ` · ${focus.mailleCodes[0]}`
        : ` · ${focus.mailleCodes.length} mailles`
  pin.innerHTML = ''

  const label = document.createElement('span')
  label.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
  label.textContent = `${focus.name}${zone}`
  if (focus.mailleCodes.length > 1) label.title = focus.mailleCodes.join(', ')
  pin.appendChild(label)

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.setAttribute('aria-label', `Désépingler ${focus.name}`)
  btn.title = 'Désépingler — la vue complète revient'
  btn.textContent = '✕'
  btn.style.cssText =
    'border:0;background:transparent;color:inherit;cursor:pointer;font-size:13px;line-height:1;padding:0 2px'
  btn.addEventListener('click', () => clearOperatorFocus())
  pin.appendChild(btn)
}
