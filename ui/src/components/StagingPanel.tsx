import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  GitCompare, 
  Play, 
  X, 
  Eye, 
  Trash2,
  Plus,
  Edit,
  AlertTriangle 
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Change {
  id: string
  type: 'INSERT' | 'UPDATE' | 'DELETE' | 'ADD_COLUMN' | 'DROP_COLUMN'
  table: string
  column?: string
  oldValue?: any
  newValue?: any
  sql?: string
}

interface StagingPanelProps {
  changes: Change[]
  onPreview: () => void
  onCommit: () => void
  onCancel: () => void
  onRemoveChange: (id: string) => void
}

export function StagingPanel({
  changes,
  onPreview,
  onCommit,
  onCancel,
  onRemoveChange,
}: StagingPanelProps) {
  const getChangeIcon = (type: Change['type']) => {
    switch (type) {
      case 'INSERT':
        return <Plus className="h-3.5 w-3.5" />
      case 'UPDATE':
        return <Edit className="h-3.5 w-3.5" />
      case 'DELETE':
        return <Trash2 className="h-3.5 w-3.5" />
      case 'ADD_COLUMN':
        return <Plus className="h-3.5 w-3.5" />
      case 'DROP_COLUMN':
        return <Trash2 className="h-3.5 w-3.5" />
      default:
        return null
    }
  }

  const getChangeColor = (type: Change['type']) => {
    switch (type) {
      case 'INSERT':
      case 'ADD_COLUMN':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'UPDATE':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'DELETE':
      case 'DROP_COLUMN':
        return 'bg-red-100 text-red-700 border-red-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="h-full flex flex-col bg-white border-l">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <GitCompare className="h-4 w-4" />
          Modifications en attente
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {changes.length} changement{changes.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Changes List */}
      <ScrollArea className="flex-1 p-4">
        {changes.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <GitCompare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune modification</p>
          </div>
        ) : (
          <div className="space-y-2">
            {changes.map((change) => (
              <div
                key={change.id}
                className={cn(
                  "p-3 rounded-md border text-sm",
                  getChangeColor(change.type)
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    {getChangeIcon(change.type)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{change.type}</div>
                      <div className="text-xs opacity-75 truncate">
                        {change.table}
                        {change.column && `.${change.column}`}
                      </div>
                      {change.sql && (
                        <pre className="text-xs mt-2 p-2 bg-black/5 rounded overflow-x-auto">
                          {change.sql}
                        </pre>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveChange(change.id)}
                    className="text-current opacity-50 hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* SQL Preview Section */}
      {changes.length > 0 && (
        <div className="p-4 border-t bg-slate-50">
          <div className="text-xs font-medium text-slate-700 mb-2">
            Preview SQL
          </div>
          <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-md overflow-x-auto max-h-32">
            {changes.map(c => c.sql).filter(Boolean).join(';\n\n') || '-- Aucun SQL généré'}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 border-t bg-white space-y-2">
        <Button
          onClick={onPreview}
          variant="outline"
          className="w-full"
          disabled={changes.length === 0}
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview (Dry-run)
        </Button>
        <div className="flex gap-2">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1"
            disabled={changes.length === 0}
          >
            <X className="h-4 w-4 mr-2" />
            Annuler
          </Button>
          <Button
            onClick={onCommit}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={changes.length === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            Commit
          </Button>
        </div>
        {changes.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Vérifiez les modifications avant commit</span>
          </div>
        )}
      </div>
    </div>
  )
}
