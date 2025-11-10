import React from "react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Change {
  field: string
  old_value: any
  new_value: any
  operation: "INSERT" | "UPDATE" | "DELETE"
}

interface DiffViewerProps {
  changes: Change[]
  title?: string
}

export function DiffViewer({ changes, title = "Changements" }: DiffViewerProps) {
  const inserts = changes.filter((c) => c.operation === "INSERT")
  const updates = changes.filter((c) => c.operation === "UPDATE")
  const deletes = changes.filter((c) => c.operation === "DELETE")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex gap-2">
          <Badge variant="success">{inserts.length} insertions</Badge>
          <Badge variant="warning">{updates.length} modifications</Badge>
          <Badge variant="destructive">{deletes.length} suppressions</Badge>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">Tous ({changes.length})</TabsTrigger>
          <TabsTrigger value="insert">Insertions ({inserts.length})</TabsTrigger>
          <TabsTrigger value="update">Modifications ({updates.length})</TabsTrigger>
          <TabsTrigger value="delete">Suppressions ({deletes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-2">
          {changes.map((change, idx) => (
            <ChangeItem key={idx} change={change} />
          ))}
        </TabsContent>

        <TabsContent value="insert" className="space-y-2">
          {inserts.map((change, idx) => (
            <ChangeItem key={idx} change={change} />
          ))}
        </TabsContent>

        <TabsContent value="update" className="space-y-2">
          {updates.map((change, idx) => (
            <ChangeItem key={idx} change={change} />
          ))}
        </TabsContent>

        <TabsContent value="delete" className="space-y-2">
          {deletes.map((change, idx) => (
            <ChangeItem key={idx} change={change} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ChangeItem({ change }: { change: Change }) {
  const getBadgeVariant = (op: string) => {
    switch (op) {
      case "INSERT":
        return "success"
      case "UPDATE":
        return "warning"
      case "DELETE":
        return "destructive"
      default:
        return "default"
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={getBadgeVariant(change.operation)}>
          {change.operation}
        </Badge>
        <span className="font-medium">{change.field}</span>
      </div>

      {change.operation === "UPDATE" && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-slate-500">Ancienne valeur</div>
            <div className="rounded bg-red-50 p-2 text-red-900 font-mono">
              {formatValue(change.old_value)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-slate-500">Nouvelle valeur</div>
            <div className="rounded bg-green-50 p-2 text-green-900 font-mono">
              {formatValue(change.new_value)}
            </div>
          </div>
        </div>
      )}

      {change.operation === "INSERT" && (
        <div className="text-sm">
          <div className="text-slate-500">Valeur</div>
          <div className="rounded bg-green-50 p-2 text-green-900 font-mono mt-1">
            {formatValue(change.new_value)}
          </div>
        </div>
      )}

      {change.operation === "DELETE" && (
        <div className="text-sm">
          <div className="text-slate-500">Valeur supprimée</div>
          <div className="rounded bg-red-50 p-2 text-red-900 font-mono mt-1">
            {formatValue(change.old_value)}
          </div>
        </div>
      )}
    </div>
  )
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "object") return JSON.stringify(value, null, 2)
  return String(value)
}
