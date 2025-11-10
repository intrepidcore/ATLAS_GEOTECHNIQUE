// Classe de base pour les composants vanilla TypeScript
// Fournit un système de gestion d'état et de rendu similaire à Lit

export interface ComponentState {
  [key: string]: any
}

export abstract class BaseComponent<T extends ComponentState = ComponentState> {
  protected container: HTMLElement
  protected state: T
  private eventListeners: Map<string, Array<{ element: Element; event: string; handler: EventListener }>> = new Map()
  
  constructor(container: HTMLElement, initialState: T) {
    this.container = container
    this.state = initialState
  }
  
  /**
   * Méthode abstraite pour le rendu du composant
   */
  protected abstract render(): string
  
  /**
   * Méthode appelée après le rendu pour attacher les event listeners
   */
  protected abstract attachEventListeners(): void
  
  /**
   * Met à jour l'état et re-render le composant
   */
  protected setState(updates: Partial<T>): void {
    this.state = { ...this.state, ...updates }
    this.update()
  }
  
  /**
   * Force une mise à jour du composant
   */
  public update(): void {
    this.cleanup()
    this.container.innerHTML = this.render()
    this.attachEventListeners()
  }
  
  /**
   * Nettoie les event listeners avant un re-render
   */
  private cleanup(): void {
    this.eventListeners.forEach(listeners => {
      listeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler)
      })
    })
    this.eventListeners.clear()
  }
  
  /**
   * Helper pour attacher un event listener avec nettoyage automatique
   */
  protected addEventListener(
    selector: string,
    event: string,
    handler: EventListener,
    options?: { all?: boolean }
  ): void {
    const elements = options?.all 
      ? this.container.querySelectorAll(selector)
      : [this.container.querySelector(selector)]
    
    elements.forEach(element => {
      if (element) {
        element.addEventListener(event, handler)
        
        const key = `${selector}-${event}`
        if (!this.eventListeners.has(key)) {
          this.eventListeners.set(key, [])
        }
        this.eventListeners.get(key)!.push({ element, event, handler })
      }
    })
  }
  
  /**
   * Helper pour émettre un événement personnalisé
   */
  protected emit(eventName: string, detail?: any): void {
    this.container.dispatchEvent(new CustomEvent(eventName, {
      detail,
      bubbles: true,
      composed: true
    }))
  }
  
  /**
   * Détruit le composant et nettoie les ressources
   */
  public destroy(): void {
    this.cleanup()
    this.container.innerHTML = ''
  }
  
  /**
   * Helper pour créer un élément HTML
   */
  protected createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options?: {
      className?: string
      id?: string
      attributes?: Record<string, string>
      innerHTML?: string
      textContent?: string
    }
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag) as HTMLElement
    
    if (options?.className) element.className = options.className
    if (options?.id) element.id = options.id
    if (options?.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value)
      })
    }
    if (options?.innerHTML) element.innerHTML = options.innerHTML
    if (options?.textContent) element.textContent = options.textContent
    
    return element as HTMLElementTagNameMap[K]
  }
}
