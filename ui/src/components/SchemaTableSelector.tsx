import React, { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Database, Table2 } from 'lucide-react'
import { tablesApi } from '@/services/api'

interface SchemaTableSelectorProps {
  selectedSchema: string
  selectedTable: string
  onSchemaChange: (schema: string) => void
  onTableChange: (table: string) => void
}

export function SchemaTableSelector({
  selectedSchema,
  selectedTable,
  onSchemaChange,
  onTableChange,
}: SchemaTableSelectorProps) {
  const [schemas, setSchemas] = useState<string[]>(['public', 'atlas'])
  const [tables, setTables] = useState<{ name: string; row_count: number }[]>([])
  const [loading, setLoading] = useState(false)

  // Charger les tables quand le schéma change
  useEffect(() => {
    loadTables()
  }, [selectedSchema])

  const loadTables = async () => {
    try {
      setLoading(true)
      const data = await tablesApi.list(selectedSchema)
      setTables(data)
    } catch (err) {
      console.error('Error loading tables:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      {/* Sélecteur de schéma */}
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Schéma:</span>
        <Select value={selectedSchema} onValueChange={onSchemaChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sélectionner..." />
          </SelectTrigger>
          <SelectContent position="popper" className="z-50">
            {schemas.map((schema) => (
              <SelectItem key={schema} value={schema}>
                {schema}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sélecteur de table */}
      <div className="flex items-center gap-2">
        <Table2 className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Table:</span>
        <Select value={selectedTable} onValueChange={onTableChange} disabled={loading}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sélectionner..." />
          </SelectTrigger>
          <SelectContent position="popper" className="z-50">
            {tables.map((table) => (
              <SelectItem key={table.name} value={table.name}>
                <div className="flex items-center justify-between w-full">
                  <span>{table.name}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    ({table.row_count} lignes)
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
