import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StagingModal } from '@/components/StagingModal'
import { FieldCalculator } from '@/components/FieldCalculator'
import { ImportExport } from '@/components/ImportExport'
import { DataGrid } from '@/components/DataGrid'
import { DiffViewer } from '@/components/DiffViewer'
import { Database, Calculator, Upload, Table2, GitCompare, Loader2, Shield, Activity } from 'lucide-react'
import { RBACManager } from '@/components/RBACManager'
import { SchemaTableSelector } from '@/components/SchemaTableSelector'
import { SchemaTree } from '@/components/SchemaTree'
import { StagingPanel } from '@/components/StagingPanel'
import { ThreePanelLayout } from '@/components/ThreePanelLayout'
import { EditModeToggle } from '@/components/EditModeToggle'
import { UnsavedChangesAlert } from '@/components/UnsavedChangesAlert'
import { DataGridToolbar } from '@/components/DataGridToolbar'
import { tablesApi, stagingApi, type Table, type Column } from '@/services/api'

function App() {
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
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  // Charger les tables au démarrage
  useEffect(() => {
    loadTables()
  }, [])

  // Charger les colonnes et données quand la table change
  useEffect(() => {
    if (selectedTable) {
      loadTableData()
    }
  }, [selectedTable, selectedSchema])

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
    try {
      setLoading(true)
      setError(null)
      const [cols, data] = await Promise.all([
        tablesApi.getColumns(selectedSchema, selectedTable),
        tablesApi.getData(selectedSchema, selectedTable, 100, 0)
      ])
      setColumns(cols)
      setTableData(data)
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données')
      console.error('Error loading table data:', err)
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
  const handleSaveChanges = () => {
    console.log('Saving changes...', stagingChanges)
    setHasUnsavedChanges(false)
    setStagingChanges([])
  }

  const handleCancelChanges = () => {
    setStagingChanges([])
    setHasUnsavedChanges(false)
  }

  const handleTableSelect = (schema: string, table: string) => {
    setSelectedSchema(schema)
    setSelectedTable(table)
  }

  // Handlers toolbar
  const handleAddRow = () => console.log('Add row')
  const handleDeleteRow = () => console.log('Delete row')
  const handleAddColumn = () => console.log('Add column')
  const handleDeleteColumn = () => console.log('Delete column')
  const handleSelectAll = () => console.log('Select all')
  const handleInvertSelection = () => console.log('Invert selection')
  const handleZoomToSelection = () => console.log('Zoom to selection')

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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Atlas Géotechnique - Gestionnaire de Base de Données
                </h1>
                <p className="text-sm text-slate-500">
                  Gestion avancée des données géotechniques
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">v2.0.0</span>
              <div className="h-2 w-2 rounded-full bg-green-500" title="API Connectée" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                      />
                    )}
                  </div>
                </div>
              }
              rightPanel={
                <StagingPanel
                  changes={stagingChanges}
                  onPreview={() => console.log('Preview')}
                  onCommit={handleSaveChanges}
                  onCancel={handleCancelChanges}
                  onRemoveChange={(id) => setStagingChanges(prev => prev.filter(c => c.id !== id))}
                />
              }
              showRightPanel={editMode}
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
    </div>
  )
}

export default App
