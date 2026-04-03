import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Trash2,
  MousePointer,
  CheckSquare,
  XSquare,
  ZoomIn,
  Copy,
  Calculator,
  Upload,
  Search,
} from 'lucide-react'

interface DataGridToolbarProps {
  onAddRow: () => void
  onDeleteRow: () => void
  onAddColumn: () => void
  onDeleteColumn: () => void
  onSelectAll: () => void
  onInvertSelection: () => void
  onAdvancedSelection: () => void
  onZoomToSelection: () => void
  onCalculator: () => void
  onImport: () => void
  editMode: boolean
  hasSelection: boolean
}

export function DataGridToolbar({
  onAddRow,
  onDeleteRow,
  onAddColumn,
  onDeleteColumn,
  onSelectAll,
  onInvertSelection,
  onAdvancedSelection,
  onZoomToSelection,
  onCalculator,
  onImport,
  editMode,
  hasSelection,
}: DataGridToolbarProps) {
  return (
    <div className="flex items-center gap-2 p-3 bg-muted/40 border-b border-border">
      {/* Édition */}
      {editMode && (
        <>
          <div className="flex items-center gap-1 pr-2 border-r">
            <Button size="sm" variant="outline" onClick={onAddRow} title="Ajouter une ligne">
              <Plus className="h-4 w-4 mr-1" />
              Ligne
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDeleteRow}
              disabled={!hasSelection}
              title="Supprimer la sélection"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Supprimer
            </Button>
          </div>

          <div className="flex items-center gap-1 pr-2 border-r">
            <Button size="sm" variant="outline" onClick={onAddColumn} title="Ajouter une colonne">
              <Plus className="h-4 w-4 mr-1" />
              Colonne
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDeleteColumn}
              disabled={!hasSelection}
              title="Supprimer colonne"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {/* Sélection */}
      <div className="flex items-center gap-1 pr-2 border-r">
        <Button size="sm" variant="ghost" onClick={onSelectAll} title="Tout sélectionner">
          <CheckSquare className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onInvertSelection} title="Inverser sélection">
          <XSquare className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onAdvancedSelection} title="Sélection avancée (Regex/BBOX)">
          <Search className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onZoomToSelection}
          disabled={!hasSelection}
          title="Zoom sur sélection"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Outils */}
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={onCalculator} title="Calculatrice de champs">
          <Calculator className="h-4 w-4 mr-1" />
          Calculatrice
        </Button>
        <Button size="sm" variant="outline" onClick={onImport} title="Import/Export">
          <Upload className="h-4 w-4 mr-1" />
          Import/Export
        </Button>
      </div>
    </div>
  )
}
