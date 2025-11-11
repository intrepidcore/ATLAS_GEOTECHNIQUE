import React, { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Database, Table2, Loader2 } from 'lucide-react'
import { tablesApi } from '@/services/api'
import { cn } from '@/lib/utils'

interface SchemaTreeProps {
  selectedSchema: string
  selectedTable: string
  onSchemaSelect: (schema: string) => void
  onTableSelect: (schema: string, table: string) => void
}

interface SchemaData {
  name: string
  tables: { name: string; row_count: number }[]
  expanded: boolean
}

export function SchemaTree({
  selectedSchema,
  selectedTable,
  onSchemaSelect,
  onTableSelect,
}: SchemaTreeProps) {
  const [schemas, setSchemas] = useState<SchemaData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSchemas()
  }, [])

  const loadSchemas = async () => {
    try {
      setLoading(true)
      // Charger les schémas principaux
      const schemaNames = ['public', 'atlas']
      const schemasData: SchemaData[] = []

      for (const schemaName of schemaNames) {
        const tables = await tablesApi.list(schemaName)
        schemasData.push({
          name: schemaName,
          tables: tables,
          expanded: schemaName === selectedSchema,
        })
      }

      setSchemas(schemasData)
    } catch (err) {
      console.error('Error loading schemas:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleSchema = (schemaName: string) => {
    setSchemas(prev =>
      prev.map(schema =>
        schema.name === schemaName
          ? { ...schema, expanded: !schema.expanded }
          : schema
      )
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 border-r">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Database className="h-4 w-4" />
          Schémas & Tables
        </h3>

        <div className="space-y-1">
          {schemas.map((schema) => (
            <div key={schema.name}>
              {/* Schema Header */}
              <button
                onClick={() => toggleSchema(schema.name)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                  selectedSchema === schema.name
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "hover:bg-slate-100 text-slate-700"
                )}
              >
                {schema.expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Database className="h-4 w-4" />
                <span className="flex-1 text-left">{schema.name}</span>
                <span className="text-xs text-slate-500">
                  {schema.tables.length}
                </span>
              </button>

              {/* Tables List */}
              {schema.expanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {schema.tables.map((table) => (
                    <button
                      key={table.name}
                      onClick={() => onTableSelect(schema.name, table.name)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                        selectedSchema === schema.name && selectedTable === table.name
                          ? "bg-blue-100 text-blue-700 font-medium"
                          : "hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      <Table2 className="h-3.5 w-3.5" />
                      <span className="flex-1 text-left truncate">{table.name}</span>
                      <span className="text-xs text-slate-500">
                        {table.row_count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
