/**
 * Panneau droit unifié v5.0 — 3 états (Fermé / Épinglé / Flottant) + Ancrage G/D
 */

export type RpsViewId = 'thematic' | 'campaign'

class RightPanelShell {
  private shell!: HTMLElement
  private header!: HTMLElement
  private backBtn!: HTMLButtonElement
  private closeBtn!: HTMLButtonElement
  private pinBtn!: HTMLButtonElement
  private dockLeftBtn!: HTMLButtonElement
  private dockRightBtn!: HTMLButtonElement
  private titleEl!: HTMLElement
  private rootEl!: HTMLElement

  private currentView: RpsViewId | null = null
  private pinned = true      // true = embedded (pousse carte), false = flottant
  private dockedLeft = false // false = ancré droite (défaut), true = ancré gauche

  private thematicOpen?: () => void
  private thematicClose?: () => void
  private floatCleanup?: () => void

  setThematicHooks(onOpen: () => void, onClose: () => void): void {
    this.thematicOpen = onOpen
    this.thematicClose = onClose
  }

  init(): void {
    this.shell        = document.getElementById('rightPanelShell') as HTMLElement
    this.header       = document.getElementById('rpsHeader')       as HTMLElement
    this.backBtn      = document.getElementById('rpsBack')         as HTMLButtonElement
    this.closeBtn     = document.getElementById('rpsClose')        as HTMLButtonElement
    this.pinBtn       = document.getElementById('rpsPin')          as HTMLButtonElement
    this.dockLeftBtn  = document.getElementById('rpsDockLeft')     as HTMLButtonElement
    this.dockRightBtn = document.getElementById('rpsDockRight')    as HTMLButtonElement
    this.titleEl      = document.getElementById('rpsTitle')        as HTMLElement
    this.rootEl       = document.getElementById('rpsRoot')         as HTMLElement

    if (!this.shell) {
      console.warn('[RPS] #rightPanelShell introuvable')
      return
    }

    this.backBtn?.addEventListener('click',      () => this.backToRoot())
    this.closeBtn?.addEventListener('click',     () => this.close())
    this.pinBtn?.addEventListener('click',       () => this.togglePin())
    this.dockLeftBtn?.addEventListener('click',  () => this.dock('left'))
    this.dockRightBtn?.addEventListener('click', () => this.dock('right'))

    document.getElementById('rpsTriggerTab')?.addEventListener('click', () => {
      this.shell.hidden ? this.openRoot() : this.close()
    })

    document.querySelectorAll<HTMLElement>('[data-rps-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openView(btn.dataset.rpsView as RpsViewId, btn.dataset.rpsTitle ?? btn.dataset.rpsView!)
      })
    })

    ;['openThematicPanel', 'openThematicPanelSidebar'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', e => {
        e.stopImmediatePropagation()
        this.openRoot()
      }, true)
    })

    document.getElementById('openCampaignPlannerBtn')?.addEventListener('click', e => {
      e.stopImmediatePropagation()
      this.openView('campaign', 'Plan de campagne terrain')
    }, true)

    document.getElementById('rpsOpenInfer')?.addEventListener('click', () => {
      document.getElementById('openInferOptiCommandCenter')?.click()
    })
    document.getElementById('rpsOpenScientific')?.addEventListener('click', () => {
      document.getElementById('openScientificDrawerBtn')?.click()
    })

    document.getElementById('closeThematicPanel')?.addEventListener('click', () => this.backToRoot())
    document.getElementById('closeCampaignPanel')?.addEventListener('click',  () => this.backToRoot())

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || this.shell.hidden) return
      if (this.currentView !== null) this.backToRoot()
      else this.close()
    })

    this.initResize()
    this.render()
  }

  // ─── Ouverture ────────────────────────────────────────────────────────────

  openView(id: RpsViewId, title: string): void {
    if (this.currentView === 'thematic' && id !== 'thematic') this.thematicClose?.()
    this.currentView = id
    this.shell.hidden = false
    this.applyOpenState()
    if (id === 'thematic') this.thematicOpen?.()
    this.render()
    this.invalidateLeafletMap()
  }

  openRoot(): void {
    if (this.currentView === 'thematic') this.thematicClose?.()
    this.currentView = null
    this.shell.hidden = false
    this.applyOpenState()
    this.render()
    this.invalidateLeafletMap()
  }

  backToRoot(): void {
    if (this.currentView === 'thematic') this.thematicClose?.()
    this.currentView = null
    this.render()
  }

  close(): void {
    if (this.currentView === 'thematic') this.thematicClose?.()
    this.currentView = null
    this.shell.hidden = true
    this.clearFloatHandler()
    document.body.classList.remove('rps-open', 'rps-floating')
    this.render()
    this.invalidateLeafletMap()
  }

  // ─── Pin / Dock ───────────────────────────────────────────────────────────

  togglePin(): void {
    this.pinned = !this.pinned
    if (!this.shell.hidden) {
      this.applyOpenState()
      this.invalidateLeafletMap()
    }
    this.render()
  }

  dock(side: 'left' | 'right'): void {
    this.dockedLeft = side === 'left'
    document.body.classList.toggle('rps-dock-left', this.dockedLeft)
    if (!this.shell.hidden) {
      this.applyOpenState()
      this.invalidateLeafletMap()
    }
    this.render()
  }

  // ─── État CSS ─────────────────────────────────────────────────────────────

  private applyOpenState(): void {
    const w = this.shell.offsetWidth
    if (w > 0) document.documentElement.style.setProperty('--rps-width', w + 'px')

    document.body.classList.toggle('rps-dock-left', this.dockedLeft)
    document.body.classList.add('rps-open')

    if (this.pinned) {
      document.body.classList.remove('rps-floating')
      this.clearFloatHandler()
    } else {
      document.body.classList.add('rps-floating')
      this.attachFloatHandler()
    }
  }

  private attachFloatHandler(): void {
    this.clearFloatHandler()
    let timer: ReturnType<typeof setTimeout>
    const onLeave  = () => { timer = setTimeout(() => this.close(), 700) }
    const onEnter  = () => clearTimeout(timer)
    this.shell.addEventListener('mouseleave', onLeave)
    this.shell.addEventListener('mouseenter', onEnter)
    this.floatCleanup = () => {
      this.shell.removeEventListener('mouseleave', onLeave)
      this.shell.removeEventListener('mouseenter', onEnter)
      clearTimeout(timer)
    }
  }

  private clearFloatHandler(): void {
    this.floatCleanup?.()
    this.floatCleanup = undefined
  }

  // ─── Resize ───────────────────────────────────────────────────────────────

  private initResize(): void {
    const handle = document.getElementById('rpsResizeHandle')
    if (!handle) return
    let startX = 0, startW = 0

    const onMove = (e: MouseEvent) => {
      // Dock gauche : glisser droite = agrandir ; dock droite : glisser gauche = agrandir
      const dx = this.dockedLeft ? (e.clientX - startX) : (startX - e.clientX)
      const newW = Math.max(280, Math.min(680, startW + dx))
      this.shell.style.width = newW + 'px'
      document.documentElement.style.setProperty('--rps-width', newW + 'px')
    }
    const onUp = () => {
      handle.classList.remove('dragging')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      this.invalidateLeafletMap(50)
    }
    handle.addEventListener('mousedown', e => {
      e.preventDefault()
      startX = e.clientX
      startW = this.shell.offsetWidth
      handle.classList.add('dragging')
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  private render(): void {
    const v = this.currentView
    const isOpen = !this.shell.hidden

    if (v === null) {
      this.header.style.display = 'flex'
      this.backBtn.style.display = 'none'
      this.titleEl.textContent = 'Cartographie & IA'
      this.rootEl.style.display = 'flex'
    } else {
      this.header.style.display = 'flex'
      this.backBtn.style.display = ''
      this.titleEl.textContent = this.viewTitle(v)
      this.rootEl.style.display = 'none'
    }

    const views: RpsViewId[] = ['thematic', 'campaign']
    views.forEach(id => {
      const slot = document.getElementById(`rpsSlot-${id}`)
      if (slot) slot.hidden = v !== id
    })

    this.renderPinBtn()
    this.renderDockBtns()
    this.renderTriggerTab(isOpen)
  }

  private renderPinBtn(): void {
    if (!this.pinBtn) return
    const pinned = this.pinned
    this.pinBtn.classList.toggle('active', pinned)
    this.pinBtn.title = pinned ? 'Épinglé (incrusté) — cliquer pour flottant' : 'Flottant — cliquer pour épingler'
    // Solid fill = pinned ; outline stroke = floating
    this.pinBtn.innerHTML = pinned
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M16 3a1 1 0 0 1 .707 1.707L14.414 7l.879 5.268A1 1 0 0 1 15 13.32L12 16v4.586l-1-1V16l-3-2.68a1 1 0 0 1-.293-1.052L8.586 7 6.293 4.707A1 1 0 0 1 7 3h9z"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M16 3H7a1 1 0 0 0-.707 1.707L8.586 7 7.707 12.268A1 1 0 0 0 8 13.32L11 16v4.586l1 1V16l3-2.68a1 1 0 0 0 .293-1.052L14.414 7l2.293-2.293A1 1 0 0 0 16 3z"/></svg>`
  }

  private renderDockBtns(): void {
    this.dockLeftBtn?.classList.toggle('active',  this.dockedLeft)
    this.dockRightBtn?.classList.toggle('active', !this.dockedLeft)
  }

  private renderTriggerTab(isOpen: boolean): void {
    const tab  = document.getElementById('rpsTriggerTab')
    const icon = document.getElementById('rpsTriggerIcon')
    if (!tab) return

    // Masquer l'onglet quand le panneau est épinglé et ouvert (le X du header suffit)
    tab.style.display = (isOpen && this.pinned) ? 'none' : 'flex'

    // Position selon ancrage
    if (this.dockedLeft) {
      tab.style.left          = '380px'
      tab.style.right         = ''
      tab.style.borderRadius  = '0 6px 6px 0'
      tab.style.borderRight   = '1px solid var(--field-border)'
      tab.style.borderLeft    = 'none'
    } else {
      tab.style.left          = ''
      tab.style.right         = '0'
      tab.style.borderRadius  = '6px 0 0 6px'
      tab.style.borderRight   = 'none'
      tab.style.borderLeft    = '1px solid var(--field-border)'
    }

    // Chevron : pointe vers la carte quand fermé (inviter à ouvrir),
    // pointe vers l'extérieur quand ouvert en mode flottant (inviter à fermer)
    if (!icon) return
    const pointLeft = this.dockedLeft ? isOpen : !isOpen
    icon.setAttribute('viewBox', '0 0 24 24')
    icon.innerHTML = pointLeft
      ? `<path d="m15 18-6-6 6-6"/>`
      : `<path d="m9 18 6-6-6-6"/>`
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private invalidateLeafletMap(delay = 350): void {
    setTimeout(() => {
      const m = (window as any).leafletMap ?? (window as any).map
      if (m && typeof m.invalidateSize === 'function') {
        try { m.invalidateSize({ animate: false }) } catch {}
      }
    }, delay)
  }

  private viewTitle(id: RpsViewId): string {
    return id === 'thematic' ? 'Cartes thématiques' : 'Plan de campagne terrain'
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: RightPanelShell | null = null

export function initRightPanelShell(): RightPanelShell {
  _instance = new RightPanelShell()
  _instance.init()
  ;(window as any).rightPanelShell = _instance
  return _instance
}

export function getRightPanelShell(): RightPanelShell | null {
  return _instance
}
