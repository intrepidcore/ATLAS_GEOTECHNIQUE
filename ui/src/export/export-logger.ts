/**
 * Module de logging pour Export Atlas
 * Bridge console F12 → Console Atlas UI
 * 
 * v3.5.2 - Capture des logs browser vers UI export
 * 
 * Fonctionnalités:
 * - Capture tous les console.log/info/warn/error pendant l'export
 * - Affiche les logs dans la console Export Atlas
 * - Permet de copier/télécharger les logs
 * - Gère l'annulation d'export avec AbortController
 */

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'success' | 'warning' | 'error' | 'step'

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  category: string
  message: string
  data?: any
}

export interface ExportLoggerOptions {
  onLog?: (entry: LogEntry) => void
  captureConsole?: boolean
  exportId?: string
}

// ============================================================================
// Classe principale
// ============================================================================

export class ExportLogger {
  private logs: LogEntry[] = []
  private originalConsole: {
    log: typeof console.log
    info: typeof console.info
    warn: typeof console.warn
    error: typeof console.error
  } | null = null
  private options: ExportLoggerOptions
  private isAttached = false
  private exportId: string
  private abortController: AbortController | null = null
  private isCancelled = false

  constructor(options: ExportLoggerOptions = {}) {
    this.options = {
      captureConsole: true,
      ...options
    }
    this.exportId = options.exportId || `export-${Date.now()}`
  }

  // ============================================================================
  // Gestion du bridge console
  // ============================================================================

  /**
   * Attache le bridge console pour capturer les logs F12
   */
  attach(): void {
    if (this.isAttached) return

    this.logs = []
    this.isCancelled = false
    this.abortController = new AbortController()

    if (this.options.captureConsole) {
      // Sauvegarder les méthodes originales
      this.originalConsole = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
      }

      // Remplacer par nos wrappers
      console.log = this.createWrapper('info', this.originalConsole.log)
      console.info = this.createWrapper('info', this.originalConsole.info)
      console.warn = this.createWrapper('warning', this.originalConsole.warn)
      console.error = this.createWrapper('error', this.originalConsole.error)
    }

    this.isAttached = true
    this.log('info', 'SYSTEM', `Console bridge started (ID: ${this.exportId})`)
    this.log('info', 'SYSTEM', `Capturing: console.log, console.info, console.warn, console.error`)
  }

  /**
   * Détache le bridge console et restaure les méthodes originales
   */
  detach(): void {
    if (!this.isAttached) return

    const totalMessages = this.logs.length
    this.log('info', 'SYSTEM', `Console bridge stopped – total messages captured=${totalMessages}`)
    
    if (this.originalConsole) {
      console.log = this.originalConsole.log
      console.info = this.originalConsole.info
      console.warn = this.originalConsole.warn
      console.error = this.originalConsole.error
      this.originalConsole = null
    }

    this.isAttached = false
  }

  /**
   * Crée un wrapper pour intercepter les appels console
   */
  private createWrapper(
    level: LogLevel,
    originalFn: (...args: any[]) => void
  ): (...args: any[]) => void {
    return (...args: any[]) => {
      // Appeler la méthode originale
      originalFn(...args)

      // Extraire le message et la catégorie des logs Atlas
      const message = args.map(a => 
        typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
      ).join(' ')

      // Parser les logs formatés [Category] Message
      const match = message.match(/^\[([^\]]+)\]\s*(.*)$/s)
      const category = match ? match[1] : 'CONSOLE'
      const cleanMessage = match ? match[2] : message

      // Ne pas re-logger nos propres logs de bridge
      if (category === 'LOGGER') return

      // Ajouter au store interne
      this.addEntry({
        timestamp: new Date(),
        level,
        category,
        message: cleanMessage
      })
    }
  }

  // ============================================================================
  // API de logging
  // ============================================================================

  /**
   * Ajoute une entrée de log
   */
  log(level: LogLevel, category: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data
    }
    this.addEntry(entry)

    // Appeler la console originale si attaché
    if (this.originalConsole) {
      const logFn = level === 'error' ? this.originalConsole.error :
                    level === 'warning' ? this.originalConsole.warn :
                    this.originalConsole.log
      logFn(`[${category}] ${message}`, data || '')
    }
  }

  private addEntry(entry: LogEntry): void {
    this.logs.push(entry)

    // Notifier le callback
    if (this.options.onLog) {
      this.options.onLog(entry)
    }
  }

  // ============================================================================
  // Gestion de l'annulation
  // ============================================================================

  /**
   * Retourne le signal d'annulation pour les fetch
   */
  getAbortSignal(): AbortSignal | undefined {
    return this.abortController?.signal
  }

  /**
   * Annule l'export en cours
   */
  cancel(): void {
    this.isCancelled = true
    this.abortController?.abort()
    this.log('warning', 'CANCEL', 'Export annulé par l\'utilisateur')
  }

  /**
   * Vérifie si l'export a été annulé
   */
  get cancelled(): boolean {
    return this.isCancelled
  }

  // ============================================================================
  // Export des logs
  // ============================================================================

  /**
   * Retourne tous les logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  /**
   * Formate les logs en texte lisible
   */
  formatLogsAsText(): string {
    const lines: string[] = [
      `# Atlas Export Log`,
      `# ID: ${this.exportId}`,
      `# Date: ${new Date().toISOString()}`,
      `# Entries: ${this.logs.length}`,
      '',
      '---',
      ''
    ]

    for (const entry of this.logs) {
      const timestamp = entry.timestamp.toISOString().replace('T', ' ').substring(0, 23)
      const levelIcon = this.getLevelIcon(entry.level)
      lines.push(`[${timestamp}] ${levelIcon} [${entry.category}] ${entry.message}`)
      if (entry.data) {
        lines.push(`  Data: ${JSON.stringify(entry.data)}`)
      }
    }

    return lines.join('\n')
  }

  /**
   * Formate les logs en Markdown
   */
  formatLogsAsMarkdown(): string {
    const lines: string[] = [
      `# Atlas Export Log`,
      '',
      `- **ID**: ${this.exportId}`,
      `- **Date**: ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}`,
      `- **Entrées**: ${this.logs.length}`,
      '',
      '---',
      ''
    ]

    for (const entry of this.logs) {
      const timestamp = entry.timestamp.toLocaleTimeString('fr-FR', { hour12: false })
      const levelBadge = this.getLevelBadge(entry.level)
      lines.push(`\`${timestamp}\` ${levelBadge} **[${entry.category}]** ${entry.message}`)
    }

    return lines.join('\n')
  }

  private getLevelIcon(level: LogLevel): string {
    switch (level) {
      case 'debug': return '🔍'
      case 'info': return 'ℹ️'
      case 'success': return '✅'
      case 'warning': return '⚠️'
      case 'error': return '❌'
      case 'step': return '📍'
      default: return '•'
    }
  }

  private getLevelBadge(level: LogLevel): string {
    switch (level) {
      case 'debug': return '`DEBUG`'
      case 'info': return '`INFO`'
      case 'success': return '`SUCCESS`'
      case 'warning': return '`WARNING`'
      case 'error': return '`ERROR`'
      case 'step': return '`STEP`'
      default: return ''
    }
  }

  /**
   * Copie les logs dans le presse-papiers
   */
  async copyToClipboard(): Promise<boolean> {
    try {
      const text = this.formatLogsAsText()
      await navigator.clipboard.writeText(text)
      this.log('success', 'LOGGER', 'Logs copiés dans le presse-papiers')
      return true
    } catch (e) {
      this.log('error', 'LOGGER', `Erreur copie: ${e}`)
      return false
    }
  }

  /**
   * Télécharge les logs en fichier .md
   */
  downloadLogs(): void {
    const content = this.formatLogsAsMarkdown()
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    
    const filename = `atlas_export_log_${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.md`
    
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    this.log('success', 'LOGGER', `Logs téléchargés: ${filename}`)
  }

  /**
   * Efface tous les logs
   */
  clear(): void {
    this.logs = []
  }
}

// ============================================================================
// Instance globale (singleton)
// ============================================================================

let globalLogger: ExportLogger | null = null

/**
 * Récupère ou crée le logger global
 */
export function getExportLogger(options?: ExportLoggerOptions): ExportLogger {
  if (!globalLogger) {
    globalLogger = new ExportLogger(options)
  }
  return globalLogger
}

/**
 * Détruit le logger global
 */
export function destroyExportLogger(): void {
  if (globalLogger) {
    globalLogger.detach()
    globalLogger = null
  }
}
