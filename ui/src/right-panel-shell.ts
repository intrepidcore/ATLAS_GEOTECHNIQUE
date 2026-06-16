/**
 * Panneau droit unifié v4.0 — navigation vue-courante / racine.
 * Remplace 3 overlays indépendants par un seul #rightPanelShell.
 */

export type RpsViewId = 'thematic' | 'campaign'

class RightPanelShell {
  private shell!: HTMLElement
  private header!: HTMLElement
  private backBtn!: HTMLButtonElement
  private closeBtn!: HTMLButtonElement
  private titleEl!: HTMLElement
  private rootEl!: HTMLElement
  private currentView: RpsViewId | null = null
  private thematicOpen?: () => void
  private thematicClose?: () => void

  setThematicHooks(onOpen: () => void, onClose: () => void): void {
    this.thematicOpen = onOpen
    this.thematicClose = onClose
  }

  init(): void {
    this.shell   = document.getElementById('rightPanelShell') as HTMLElement
    this.header  = document.getElementById('rpsHeader')       as HTMLElement
    this.backBtn = document.getElementById('rpsBack')         as HTMLButtonElement
    this.closeBtn= document.getElementById('rpsClose')        as HTMLButtonElement
    this.titleEl = document.getElementById('rpsTitle')        as HTMLElement
    this.rootEl  = document.getElementById('rpsRoot')         as HTMLElement

    if (!this.shell) {
      console.warn('[RPS] #rightPanelShell introuvable')
      return
    }

    this.backBtn?.addEventListener('click', () => this.backToRoot())
    this.closeBtn?.addEventListener('click', () => this.close())

    // Root nav buttons (data-rps-view)
    document.querySelectorAll<HTMLElement>('[data-rps-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id    = btn.dataset.rpsView as RpsViewId
        const title = btn.dataset.rpsTitle ?? id
        this.openView(id, title)
      })
    })

    // Intercepter les boutons sidebar AVANT les handlers existants (capture)
    ;['openThematicPanel', 'openThematicPanelSidebar'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', e => {
        e.stopImmediatePropagation()
        this.openView('thematic', 'Cartes thématiques')
      }, true)
    })

    document.getElementById('openCampaignPlannerBtn')?.addEventListener('click', e => {
      e.stopImmediatePropagation()
      this.openView('campaign', 'Plan de campagne terrain')
    }, true)

    // Infer/Opti + Scientific conservent leurs overlays dédiés (Phase 2)
    document.getElementById('rpsOpenInfer')?.addEventListener('click', () => {
      document.getElementById('openInferOptiCommandCenter')?.click()
    })
    document.getElementById('rpsOpenScientific')?.addEventListener('click', () => {
      document.getElementById('openScientificDrawerBtn')?.click()
    })

    // Fermeture depuis l'intérieur des panneaux
    document.getElementById('closeThematicPanel')?.addEventListener('click', () => this.backToRoot())
    document.getElementById('closeCampaignPanel')?.addEventListener('click',  () => this.backToRoot())

    // Escape → retour racine si dans une vue, sinon ferme
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || this.shell.hidden) return
      if (this.currentView !== null) this.backToRoot()
      else this.close()
    })

    this.render()
  }

  openView(id: RpsViewId, title: string): void {
    if (this.currentView === 'thematic' && id !== 'thematic') this.thematicClose?.()
    this.currentView = id
    this.shell.hidden = false
    if (id === 'thematic') this.thematicOpen?.()
    this.render()
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
    this.render()
  }

  private render(): void {
    const v = this.currentView
    if (v === null) {
      // Vue racine
      this.header.style.display = 'none'
      this.rootEl.style.display = 'flex'
    } else {
      this.header.style.display = 'flex'
      this.titleEl.textContent = this.viewTitle(v)
      this.rootEl.style.display = 'none'
    }

    const views: RpsViewId[] = ['thematic', 'campaign']
    views.forEach(id => {
      const slot = document.getElementById(`rpsSlot-${id}`)
      if (slot) slot.hidden = v !== id
    })
  }

  private viewTitle(id: RpsViewId): string {
    return id === 'thematic' ? 'Cartes thématiques' : 'Plan de campagne terrain'
  }
}

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
