import React, { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StagingModal } from '@/components/StagingModal'
import { FieldCalculator } from '@/components/FieldCalculator'
import { ImportExport } from '@/components/ImportExport'
import { DataGrid } from '@/components/DataGrid'
import { DiffViewer } from '@/components/DiffViewer'
import { Database, Calculator, Upload, Table2, GitCompare, Loader2, Shield, Activity, Users, MapPin, LogOut, Bell } from 'lucide-react'
import { UserProfileMenu } from '@/components/UserProfileMenu'
import { RBACManager } from '@/components/RBACManager'
import { SchemaTableSelector } from '@/components/SchemaTableSelector'
import { SchemaTree } from '@/components/SchemaTree'
import { StagingPanel } from '@/components/StagingPanel'
import { ThreePanelLayout } from '@/components/ThreePanelLayout'
import { EditModeToggle } from '@/components/EditModeToggle'
import { UnsavedChangesAlert } from '@/components/UnsavedChangesAlert'
import { DataGridToolbar } from '@/components/DataGridToolbar'
import { AdvancedSelectionDialog } from '@/components/AdvancedSelectionDialog'
import { MapPanel } from '@/components/MapPanel'
import ColabStudentPage from '@/pages/ColabStudentPage'
import LoginPage from '@/pages/LoginPage'
import { useAuth } from '@/contexts/AuthContext'
import { selectionApi } from '@/services/selection-api'
import { tablesApi, stagingApi, type Table, type Column, API_BASE_URL } from '@/services/api'
import { authApi, tokenStorage } from './services/auth-api'
import { stagingApiV2 } from '@/services/staging-api'
import { ApiHealthIndicator } from '@/components/ApiHealthIndicator'

const ColabPage = React.lazy(() => import('@/pages/ColabPage'))

type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>

type DbConnectionInfo = {
  database_url: string
  host: string
  port: number
  db_user: string
  db_name: string
}

function getTauriInvoke(): TauriInvoke | null {
  const w = window as any
  const invV2 = w?.__TAURI__?.core?.invoke
  if (typeof invV2 === 'function') return invV2 as TauriInvoke

  const invV1 = w?.__TAURI__?.tauri?.invoke
  if (typeof invV1 === 'function') return invV1 as TauriInvoke
  return null
}

function App() {
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<string>('sondages')
  const [selectedSchema, setSelectedSchema] = useState<string>('public')
  const [tables, setTables] = useState<Table[]>([])
  const [columns, setColumns] = useState<Column[]>([])
  const [tableData, setTableData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [stagingChanges, setStagingChanges] = useState<any[]>([])
  const [stagingId, setStagingId] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showAdvancedSelection, setShowAdvancedSelection] = useState(false)
  const [bboxToZoom, setBboxToZoom] = useState<{min_x:number;min_y:number;max_x:number;max_y:number}|null>(null)
  const [rowIdKey, setRowIdKey] = useState<string>('id')
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    const onExpired = () => {
      logout()
    }

    window.addEventListener('atlas:auth:expired', onExpired)
    return () => window.removeEventListener('atlas:auth:expired', onExpired)
  }, [logout])

  const [dbBusy, setDbBusy] = useState(false)
  const [dbStatus, setDbStatus] = useState<{ kind: 'ok' | 'err' | 'info'; msg: string } | null>(
    null,
  )
  const [restorePath, setRestorePath] = useState('')
  const [lastBackupPath, setLastBackupPath] = useState<string | null>(null)
  const [lastDiagnosticDir, setLastDiagnosticDir] = useState<string | null>(null)
  const [lastResetQuarantine, setLastResetQuarantine] = useState<string | null>(null)
  const [dbConnectionInfo, setDbConnectionInfo] = useState<DbConnectionInfo | null>(null)

  // Desktop first-run: si le marker d'installation n'existe pas, on bascule sur l'installateur
  useEffect(() => {
    const inv = getTauriInvoke()
    if (!inv) return
    let cancelled = false
    ;(async () => {
      try {
        const installed = await inv<boolean>('installer_is_installed')
        if (cancelled) return
        const path = window.location.pathname
        const skipInstallerRedirect =
          path === '/installer.html' || path === '/db-manager.html' || path === '/login.html'

        if (!installed && !skipInstallerRedirect) {
          setIsRedirecting(true)
          window.location.href = '/installer.html'
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Charger les notifications
  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications()
      // Rafraîchir toutes les 30 secondes
      const interval = setInterval(loadNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated])

  const loadNotifications = async () => {
    try {
      const token = tokenStorage.getAccessToken()
      if (!token) return

      const res = await fetch(`${API_BASE_URL}/colab/notifications?unread_only=true&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 401) {
        const refreshed = await authApi.refresh()
        if (!refreshed) {
          tokenStorage.clear()
          return
        }

        const token2 = tokenStorage.getAccessToken()
        if (!token2) return

        const res2 = await fetch(`${API_BASE_URL}/colab/notifications?unread_only=true&limit=10`, {
          headers: { Authorization: `Bearer ${token2}` },
        })

        if (!res2.ok) {
          if (res2.status === 401) tokenStorage.clear()
          return
        }

        const data = await res2.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
        return
      }

      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch (err) {
      console.error('Erreur chargement notifications:', err)
    }
  }

  const markNotificationRead = async (id: string) => {
    try {
      const token = tokenStorage.getAccessToken()
      if (!token) return
      await fetch(`${API_BASE_URL}/colab/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      loadNotifications()
    } catch (err) {
      console.error('Erreur marquage notification:', err)
    }
  }

  // Charger les tables au démarrage
  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) return
    if (!user?.roles?.includes('admin')) return
    loadTables()
  }, [authLoading, isAuthenticated, user])

  // Charger les colonnes et données quand la table change
  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) return
    if (!user?.roles?.includes('admin')) return
    if (selectedTable) {
      loadTableData()
    }
  }, [authLoading, isAuthenticated, user, selectedSchema, selectedTable])

  const loadTables = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await tablesApi.list(selectedSchema)
      setTables(data)
      if (data.length > 0 && !selectedTable) {
        setSelectedTable(data[0].name)
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des tables')
      console.error('Error loading tables:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadTableData = async () => {
    if (!selectedTable) return
    setLoading(true)
    try {
      setError(null)
      const [info, cols, data] = await Promise.all([
        tablesApi.getTableInfo(selectedSchema, selectedTable),
        tablesApi.getColumns(selectedSchema, selectedTable),
        tablesApi.getData(selectedSchema, selectedTable, 100, 0)
      ])
      const pk = (info?.primary_keys && info.primary_keys[0]) || 'id'
      setRowIdKey(pk)
      setColumns(cols)
      setTableData(data)
    } catch (e:any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const [recentChanges, setRecentChanges] = useState<any[]>([])

  const handleCalculate = async (config: any) => {
    console.log('Calculate:', config)
    // TODO: Appeler API backend
  }

  const handleImport = async (data: any[], mapping: any) => {
    console.log('Import:', data, mapping)
    // TODO: Appeler API backend
  }

  // Handlers pour le mode édition
  const handlePreviewDryRun = async () => {
    try {
      setLoading(true)
      if (!stagingId) {
        const res = await stagingApiV2.create(selectedSchema, selectedTable, 'UI preview dry-run')
        setStagingId(res.staging_id)
      }
      const preview = await stagingApiV2.preview(stagingId || (await (async () => {
        const r = await stagingApiV2.create(selectedSchema, selectedTable, 'UI preview dry-run')
        setStagingId(r.staging_id)
        return r
      })()).staging_id)
      alert(`✅ Preview prête. Inserts: ${preview.summary.inserts}, Updates: ${preview.summary.updates}, Deletes: ${preview.summary.deletes}`)
    } catch (err: any) {
      alert(`❌ Erreur dry-run: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveChanges = async () => {
    try {
      setLoading(true)
      if (!stagingId) {
        const res = await stagingApiV2.create(selectedSchema, selectedTable, 'UI commit')
        setStagingId(res.staging_id)
      }
      await stagingApiV2.validate(stagingId!)
      await stagingApiV2.commit(stagingId!)
      
      alert('✅ Modifications enregistrées avec succès!')
      setHasUnsavedChanges(false)
      setStagingChanges([])
      setStagingId(null)
      
      // Recharger les données
      await loadTableData()
    } catch (err: any) {
      alert(`❌ Erreur lors de l'enregistrement: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelChanges = async () => {
    try {
      if (stagingId) {
        await stagingApiV2.cancel(stagingId)
      }
    } catch (_) {}
    setStagingId(null)
    setStagingChanges([])
    setHasUnsavedChanges(false)
    // Recharger données d'origine
    await loadTableData()
  }

  const handleTableSelect = (schema: string, table: string) => {
    setSelectedSchema(schema)
    setSelectedTable(table)
  }

  const setDbInfo = (msg: string) => setDbStatus({ kind: 'info', msg })
  const setDbOk = (msg: string) => setDbStatus({ kind: 'ok', msg })
  const setDbErr = (msg: string) => setDbStatus({ kind: 'err', msg })

  const runDb = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    if (dbBusy) return null
    setDbBusy(true)
    try {
      return await fn()
    } catch (e: any) {
      setDbErr(e?.message ? String(e.message) : String(e))
      return null
    } finally {
      setDbBusy(false)
    }
  }

  const handleDbIntegrity = async () => {
    const inv = getTauriInvoke()
    if (!inv) {
      setDbErr("Commande Tauri indisponible (UI web). Ouvre cette page via l'app Desktop.")
      return
    }
    setDbInfo('Contrôle d’intégrité en cours…')
    const res = await runDb(() => inv<any>('db_integrity_check'))
    if (!res) return
    const ok = typeof res.ok === 'boolean' ? res.ok : false
    const details = typeof res.details === 'string' ? res.details : ''
    if (ok) setDbOk(details || '✅ Intégrité OK')
    else setDbErr(details || '❌ Intégrité KO')
  }

  const handleDbConnectionInfo = async () => {
    const inv = getTauriInvoke()
    if (!inv) {
      setDbErr("Commande Tauri indisponible (UI web). Ouvre cette page via l'app Desktop.")
      return
    }
    setDbInfo('Récupération des infos de connexion…')
    const res = await runDb(() => inv<DbConnectionInfo>('db_connection_info'))
    if (!res) return
    setDbConnectionInfo(res)
    setDbOk('✅ Infos de connexion récupérées')
  }

  const handleDbBackup = async () => {
    const inv = getTauriInvoke()
    if (!inv) {
      setDbErr("Commande Tauri indisponible (UI web). Ouvre cette page via l'app Desktop.")
      return
    }
    setDbInfo('Backup en cours…')
    const res = await runDb(() => inv<any>('db_backup'))
    if (!res) return
    const p = typeof res.path === 'string' ? res.path : null
    if (p) setLastBackupPath(p)
    setDbOk(p ? `✅ Backup créé: ${p}` : '✅ Backup terminé')
  }

  const handleDbRestore = async () => {
    const inv = getTauriInvoke()
    if (!inv) {
      setDbErr("Commande Tauri indisponible (UI web). Ouvre cette page via l'app Desktop.")
      return
    }
    const path = restorePath.trim()
    if (!path) {
      setDbErr('Chemin du backup requis')
      return
    }
    setDbInfo('Restore en cours…')
    const res = await runDb(() => inv<any>('db_restore', { backup_path: path }))
    if (!res) return
    setDbOk('✅ Restore terminé')
  }

  const handleDbReset = async () => {
    const inv = getTauriInvoke()
    if (!inv) {
      setDbErr("Commande Tauri indisponible (UI web). Ouvre cette page via l'app Desktop.")
      return
    }
    setDbInfo('Reset en cours…')
    const res = await runDb(() => inv<any>('db_reset'))
    if (!res) return
    const q = typeof res.quarantine_dir === 'string' ? res.quarantine_dir : null
    if (q) setLastResetQuarantine(q)
    setDbOk(q ? `✅ Reset terminé (quarantaine: ${q})` : '✅ Reset terminé')
  }

  const handleDiagnosticExport = async () => {
    const inv = getTauriInvoke()
    if (!inv) {
      setDbErr("Commande Tauri indisponible (UI web). Ouvre cette page via l'app Desktop.")
      return
    }
    setDbInfo('Export diagnostic en cours…')
    const res = await runDb(() => inv<any>('diagnostic_export'))
    if (!res) return
    const dir = typeof res.dir === 'string' ? res.dir : null
    if (dir) setLastDiagnosticDir(dir)
    setDbOk(dir ? `✅ Diagnostic exporté: ${dir}` : '✅ Diagnostic exporté')
  }

  // Handler édition cellule
  const handleCellEdit = async (rowId: string, columnName: string, newValue: any) => {
    try {
      // Créer staging si besoin
      let sid = stagingId
      if (!sid) {
        const res = await stagingApiV2.create(selectedSchema, selectedTable, 'UI editing session')
        sid = res.staging_id
        setStagingId(sid)
      }
      // Appliquer opération UPDATE au staging
      await stagingApiV2.applyOperation(sid!, 'update', { [columnName]: newValue }, rowId)
      // Enregistrer côté UI
      const change = {
        id: `${Date.now()}-${rowId}-${columnName}`,
        type: 'update' as const,
        table: selectedTable,
        column: columnName,
        rowId,
        newValue,
      }
      setStagingChanges(prev => [...prev, change])
      setHasUnsavedChanges(true)
      // Mettre à jour localement
      setTableData(prev => prev.map((row: any) => row.id === rowId ? { ...row, [columnName]: newValue } : row))
    } catch (e: any) {
      alert(`Erreur édition: ${e.message}`)
    }
  }

  // Handlers toolbar
  const handleAddRow = () => {
    const newRow = { id: `new-${Date.now()}`, ...Object.fromEntries(columns.map(c => [c.name, null])) }
    setTableData(prev => [...prev, newRow])
    const change = {
      id: `insert-${Date.now()}`,
      type: 'INSERT' as const,
      table: selectedTable,
      newValue: newRow,
      sql: `INSERT INTO ${selectedSchema}.${selectedTable} (${columns.map(c => c.name).join(', ')}) VALUES (...);`
    }
    setStagingChanges(prev => [...prev, change])
    setHasUnsavedChanges(true)
  }
  
  const handleDeleteRow = () => {
    if (selectedRows.size === 0) return
    const rowIds = Array.from(selectedRows)
    setTableData(prev => prev.filter((row: any) => !rowIds.includes(row.id)))
    const change = {
      id: `delete-${Date.now()}`,
      type: 'DELETE' as const,
      table: selectedTable,
      sql: `DELETE FROM ${selectedSchema}.${selectedTable} WHERE id IN (${rowIds.map(id => `'${id}'`).join(', ')});`
    }
    setStagingChanges(prev => [...prev, change])
    setHasUnsavedChanges(true)
    setSelectedRows(new Set())
  }
  
  const handleAddColumn = () => console.log('Add column')
  const handleDeleteColumn = () => console.log('Delete column')
  const handleSelectAll = () => {
    setSelectedRows(new Set(tableData.map((row: any) => row.id)))
  }
  const handleInvertSelection = () => {
    const allIds = new Set(tableData.map((row: any) => row.id))
    const newSelection = new Set<string>()
    allIds.forEach(id => {
      if (!selectedRows.has(id)) newSelection.add(id)
    })
    setSelectedRows(newSelection)
  }
  const handleZoomToSelection = async () => {
    try {
      const ids = Array.from(selectedRows)
      if (ids.length === 0) return
      
      console.log('Zoom sur sélection:', ids)
      
      const res = await fetch(`${API_BASE_URL}/db/table/${selectedSchema}/${selectedTable}/extent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids)
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Erreur extent:', errorText)
        
        // Essayer le fallback via relations
        console.log('Tentative fallback via relations...')
        const res2 = await fetch(`${API_BASE_URL}/db/table/${selectedSchema}/${selectedTable}/extent-related`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ids)
        })
        
        if (res2.ok) {
          const bbox = await res2.json().catch(() => null)
          if (bbox && bbox.min_x != null) {
            console.log('Extent trouvé via relations:', bbox)
            setBboxToZoom(bbox)
            return
          }
        }
        
        alert('Aucune géométrie trouvée pour cette sélection.\n\nLa table sélectionnée ne contient pas de géométrie directe et aucune relation vers une table géométrique n\'a été trouvée.')
        return
      }
      
      const bbox = await res.json().catch(() => null)
      if (bbox && bbox.min_x != null) {
        console.log('Extent trouvé:', bbox)
        setBboxToZoom(bbox)
      } else {
        // Fallback via relations
        console.log('Extent vide, tentative fallback via relations...')
        const res2 = await fetch(`${API_BASE_URL}/db/table/${selectedSchema}/${selectedTable}/extent-related`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ids)
        })
        
        if (res2.ok) {
          const bbox2 = await res2.json().catch(() => null)
          if (bbox2 && bbox2.min_x != null) {
            console.log('Extent trouvé via relations:', bbox2)
            setBboxToZoom(bbox2)
            return
          }
        }
        
        alert('Aucune géométrie trouvée pour cette sélection.')
      }
    } catch (e:any) {
      console.error('Erreur zoom:', e)
      alert(`Erreur zoom: ${e.message}`)
    }
  }
  
  const handleRegexSelection = async (pattern: string, _column?: string) => {
    try {
      const res = await selectionApi.selectRegex(selectedSchema, selectedTable, pattern)
      setSelectedRows(new Set(res.ids))
      // TODO: Optionnel - récupérer extent pour zoom carte si MapPanel actif
    } catch (e: any) {
      alert(`Erreur sélection regex: ${e.message}`)
    }
  }
  
  const handleBboxSelection = async (bbox: [number, number, number, number]) => {
    try {
      const res = await fetch(`${window.location.origin}${API_BASE_URL}/db/table/${selectedSchema}/${selectedTable}/select-bbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_x: bbox[0], min_y: bbox[1], max_x: bbox[2], max_y: bbox[3], srid: 4326 })
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Erreur select bbox')
      const data = await res.json()
      setSelectedRows(new Set<string>(data.ids))
    } catch (e: any) {
      alert(`Erreur sélection BBOX: ${e.message}`)
    }
  }

  // Confirmation fermeture
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Auto-save draft toutes les 15 minutes
  useEffect(() => {
    if (!editMode || stagingChanges.length === 0) return
    const interval = setInterval(() => {
      console.log('Auto-saving draft...', stagingChanges)
      localStorage.setItem('staging_draft', JSON.stringify(stagingChanges))
    }, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [editMode, stagingChanges])

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (hasUnsavedChanges) handleSaveChanges()
      }
      if (e.key === 'Escape') {
        if (hasUnsavedChanges) handleCancelChanges()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasUnsavedChanges])

  // Afficher le loader pendant le chargement de l'auth ou la redirection
  if (authLoading || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">{isRedirecting ? 'Redirection vers la carte...' : 'Chargement...'}</p>
        </div>
      </div>
    )
  }

  // Afficher la page de login si non authentifié
  if (!isAuthenticated) {
    return <LoginPage />
  }

  // Vérifier si l'utilisateur est un étudiant uniquement (pas admin/supervisor/etc.)
  const isStudentOnly = user?.roles?.includes('student') && 
    !user?.roles?.some(r => ['admin', 'supervisor', 'data_manager', 'geo_analyst', 'editor', 'viewer'].includes(r))

  // Rediriger les étudiants vers leur interface dédiée
  if (isStudentOnly) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-50">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <MapPin className="h-8 w-8" />
                <div>
                  <h1 className="text-xl font-bold flex items-center gap-2">Atlas Survey <ApiHealthIndicator /></h1>
                  <p className="text-sm text-blue-100">Espace Terrain Étudiant</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <UserProfileMenu user={user} onLogout={logout} />
              </div>
            </div>
          </div>
        </header>
        <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <ColabStudentPage />
        </main>
      </div>
    )
  }

  // Interface Gestionnaire BDD pour admin/supervisor/data_manager/etc.
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  Atlas Géotechnique - Gestionnaire de Base de Données
                  <ApiHealthIndicator />
                </h1>
                <p className="text-sm text-slate-500">
                  Gestion avancée des données géotechniques
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative text-slate-500 hover:text-slate-700"
                  title="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
                
                {/* Dropdown notifications */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border z-50">
                    <div className="p-3 border-b flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="text-xs text-slate-500">{unreadCount} non lues</span>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-sm">
                          Aucune notification
                        </div>
                      ) : (
                        notifications.map((notif: any) => (
                          <div
                            key={notif.id}
                            onClick={() => markNotificationRead(notif.id)}
                            className={`p-3 border-b hover:bg-slate-50 cursor-pointer ${
                              !notif.read_at ? 'bg-blue-50' : ''
                            }`}
                          >
                            <p className="text-sm text-slate-900">{notif.title}</p>
                            <p className="text-xs text-slate-500 mt-1">{notif.message}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {new Date(notif.created_at).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Menu profil utilisateur */}
              <UserProfileMenu user={user} onLogout={logout} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="tables" className="space-y-6">
          <TabsList>
            <TabsTrigger value="tables">
              <Table2 className="h-4 w-4 mr-2" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="staging">
              <GitCompare className="h-4 w-4 mr-2" />
              Staging
            </TabsTrigger>
            <TabsTrigger value="tools">
              <Calculator className="h-4 w-4 mr-2" />
              Outils
            </TabsTrigger>
            <TabsTrigger value="database">
              <Database className="h-4 w-4 mr-2" />
              Base de données
            </TabsTrigger>
            {/* Colab Studio - Gestion des missions terrain */}
            <TabsTrigger value="colab-studio">
              <Users className="h-4 w-4 mr-2" />
              Colab Studio
            </TabsTrigger>
          </TabsList>

          {/* Tables Tab */}
          <TabsContent value="tables" className="h-[calc(100vh-12rem)]">
            <ThreePanelLayout
              leftPanel={
                <SchemaTree
                  selectedSchema={selectedSchema}
                  selectedTable={selectedTable}
                  onSchemaSelect={setSelectedSchema}
                  onTableSelect={handleTableSelect}
                />
              }
              centerPanel={
                <div className="h-full flex flex-col bg-white">
                  {/* Header avec sélecteurs et mode édition */}
                  <div className="p-4 border-b space-y-3">
                    <div className="flex items-center justify-between">
                      <SchemaTableSelector
                        selectedSchema={selectedSchema}
                        selectedTable={selectedTable}
                        onSchemaChange={setSelectedSchema}
                        onTableChange={setSelectedTable}
                      />
                      <EditModeToggle
                        editMode={editMode}
                        onChange={setEditMode}
                      />
                    </div>
                    {editMode && hasUnsavedChanges && (
                      <UnsavedChangesAlert
                        onSave={handleSaveChanges}
                        onCancel={handleCancelChanges}
                      />
                    )}
                  </div>

                  {/* Toolbar */}
                  <DataGridToolbar
                    onAddRow={handleAddRow}
                    onDeleteRow={handleDeleteRow}
                    onAddColumn={handleAddColumn}
                    onDeleteColumn={handleDeleteColumn}
                    onSelectAll={handleSelectAll}
                    onInvertSelection={handleInvertSelection}
                    onAdvancedSelection={() => setShowAdvancedSelection(true)}
                    onZoomToSelection={handleZoomToSelection}
                    onCalculator={() => setActiveModal('calculator')}
                    onImport={() => setActiveModal('import')}
                    editMode={editMode}
                    hasSelection={selectedRows.size > 0}
                  />

                  {/* DataGrid */}
                  <div className="flex-1 overflow-auto p-4">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      </div>
                    ) : error ? (
                      <div className="text-red-600 p-4 border border-red-200 rounded-lg">
                        {error}
                      </div>
                    ) : (
                      <DataGrid
                        data={tableData}
                        columns={columns.map(col => ({
                          accessorKey: col.name,
                          header: col.name,
                        }))}
                        editable={editMode}
                        onCellEdit={handleCellEdit}
                        showSelection={true}
                        selection={selectedRows}
                        rowIdKey={rowIdKey}
                        onToggleRow={(rowId, checked) => {
                          setSelectedRows(prev => {
                            const next = new Set(prev)
                            if (checked) next.add(rowId)
                            else next.delete(rowId)
                            return next
                          })
                        }}
                      />
                    )}
                  </div>
                </div>
              }
              rightPanel={
                editMode ? (
                  <div className="h-full bg-white">
                    <StagingPanel
                      changes={stagingChanges}
                      onPreview={handlePreviewDryRun}
                      onCommit={handleSaveChanges}
                      onCancel={handleCancelChanges}
                      onRemoveChange={(id) => setStagingChanges(prev => prev.filter(c => c.id !== id))}
                    />
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    <div className="flex-1 min-h-0">
                      <MapPanel onBboxDraw={handleBboxSelection} bboxToZoom={bboxToZoom} />
                    </div>
                  </div>
                )
              }
              showRightPanel={true}
            />
          </TabsContent>

          {/* Staging Tab */}
          <TabsContent value="staging" className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-6">Gestion du Staging</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Staging Actif</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Aucun staging en cours
                  </p>
                  <Button onClick={() => setActiveModal('staging')}>
                    Créer un Staging
                  </Button>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Historique</h3>
                  <p className="text-sm text-slate-500">
                    3 commits aujourd'hui
                  </p>
                </div>
              </div>

              <DiffViewer changes={recentChanges} title="Changements récents" />
            </div>
          </TabsContent>

          {/* Tools Tab */}
          <TabsContent value="tools" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <Calculator className="h-12 w-12 text-blue-600 mb-4" />
                <h3 className="font-semibold mb-2">Calculatrice de Champs</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Créer ou mettre à jour des champs avec des expressions
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setActiveModal('calculator')}
                >
                  Ouvrir
                </Button>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <Upload className="h-12 w-12 text-green-600 mb-4" />
                <h3 className="font-semibold mb-2">Import/Export</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Importer et exporter des données (CSV, JSON, GeoJSON)
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setActiveModal('import')}
                >
                  Ouvrir
                </Button>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <GitCompare className="h-12 w-12 text-purple-600 mb-4" />
                <h3 className="font-semibold mb-2">Comparateur</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Comparer les versions et voir les différences
                </p>
                <Button variant="outline" className="w-full">
                  Ouvrir
                </Button>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <Shield className="h-12 w-12 text-orange-600 mb-4" />
                <h3 className="font-semibold mb-2">RBAC - Permissions</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Gérer les utilisateurs, rôles et permissions
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setActiveModal('rbac')}
                >
                  Ouvrir
                </Button>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <Activity className="h-12 w-12 text-red-600 mb-4" />
                <h3 className="font-semibold mb-2">Monitoring</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Dashboard Grafana et métriques Prometheus
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open('http://localhost:3000/d/atlas', '_blank')}
                >
                  Ouvrir Grafana
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="database" className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Base de données (Desktop)</h2>
                {dbBusy ? (
                  <div className="flex items-center text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Opération en cours…
                  </div>
                ) : null}
              </div>

              {dbStatus ? (
                <div
                  className={
                    dbStatus.kind === 'ok'
                      ? 'rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800'
                      : dbStatus.kind === 'err'
                        ? 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
                        : 'rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800'
                  }
                >
                  {dbStatus.msg}
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Button onClick={handleDbConnectionInfo} disabled={dbBusy} variant="outline">
                  Connexion DB (DATABASE_URL)
                </Button>
                <Button onClick={handleDbIntegrity} disabled={dbBusy} variant="outline">
                  Vérifier intégrité
                </Button>
                <Button onClick={handleDbBackup} disabled={dbBusy}>
                  Backup
                </Button>
                <Button onClick={handleDbReset} disabled={dbBusy} variant="destructive">
                  Reset
                </Button>
                <Button onClick={handleDiagnosticExport} disabled={dbBusy} variant="outline">
                  Export diagnostic
                </Button>
              </div>

              {dbConnectionInfo?.database_url ? (
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">DATABASE_URL</div>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                      readOnly
                      value={dbConnectionInfo.database_url}
                    />
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(dbConnectionInfo.database_url)
                          setDbOk('✅ DATABASE_URL copié dans le presse-papiers')
                        } catch (e: any) {
                          setDbErr(e?.message ? String(e.message) : String(e))
                        }
                      }}
                    >
                      Copier
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="text-sm text-gray-600">Restore (chemin du backup)</div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={restorePath}
                    onChange={(e) => setRestorePath(e.target.value)}
                    placeholder="C:\\...\\atlas-backup_YYYYMMDD_HHMMSS.zip"
                    disabled={dbBusy}
                  />
                  <Button onClick={handleDbRestore} disabled={dbBusy} variant="outline">
                    Restore
                  </Button>
                </div>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                {lastBackupPath ? <div>Dernier backup: {lastBackupPath}</div> : null}
                {lastDiagnosticDir ? <div>Dernier export diagnostic: {lastDiagnosticDir}</div> : null}
                {lastResetQuarantine ? <div>Dernier reset (quarantaine): {lastResetQuarantine}</div> : null}
              </div>
            </div>
          </TabsContent>

          {/* Colab Studio Tab - Gestion des missions terrain */}
          <TabsContent value="colab-studio" className="h-[calc(100vh-12rem)]">
            <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Chargement…</div>}>
              <ColabPage />
            </Suspense>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modals */}
      {activeModal === 'staging' && (
        <StagingModal
          open={true}
          onClose={() => setActiveModal(null)}
          table={selectedTable}
          schema="atlas"
          user="admin@atlas.com"
          userEmail="admin@atlas.com"
        />
      )}

      {activeModal === 'calculator' && (
        <FieldCalculator
          open={true}
          onClose={() => setActiveModal(null)}
          tableName={selectedTable}
          existingFields={columns}
          selectedRowsCount={0}
          onCalculate={handleCalculate}
        />
      )}

      {activeModal === 'import' && (
        <ImportExport
          open={true}
          onClose={() => setActiveModal(null)}
          tableName={selectedTable}
          data={tableData}
          columns={columns}
          onImport={handleImport}
        />
      )}

      {activeModal === 'rbac' && (
        <RBACManager
          open={true}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Dialog sélection avancée */}
      {showAdvancedSelection && (
        <AdvancedSelectionDialog
          onRegexSelect={handleRegexSelection}
          onBboxSelect={handleBboxSelection}
          onClose={() => setShowAdvancedSelection(false)}
          columns={columns.map(c => c.name)}
        />
      )}
    </div>
  )
}

export default App
