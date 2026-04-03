import React from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EditableCell } from "@/components/EditableCell"
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react"

interface DataGridProps<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  onRowEdit?: (row: TData) => void
  onRowDelete?: (row: TData) => void
  onCellEdit?: (rowId: string, columnName: string, newValue: any) => void
  editable?: boolean
  showSelection?: boolean
  selection?: Set<string>
  onToggleRow?: (rowId: string, checked: boolean) => void
  rowIdKey?: string
}

export function DataGrid<TData>({
  data,
  columns,
  onRowEdit,
  onRowDelete,
  onCellEdit,
  editable = false,
  showSelection = false,
  selection,
  onToggleRow,
  rowIdKey,
}: DataGridProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  })

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Rechercher..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        <div className="ml-auto text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} lignes
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-x-auto bg-card">
        <table className="min-w-full table-auto">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {showSelection && (
                  <th className="w-8 px-2">
                    {/* Header checkbox (select all) - simple helper if needed later */}
                  </th>
                )}
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-foreground whitespace-nowrap"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={
                          header.column.getCanSort()
                            ? "flex items-center gap-2 cursor-pointer select-none"
                            : ""
                        }
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() && (
                          <ArrowUpDown className="h-4 w-4" />
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (showSelection ? 1 : 0)}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Aucune donnée
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border hover:bg-muted/40 transition-colors"
                >
                  {showSelection && (
                    <td className="px-2 align-middle">
                      {(() => {
                        const rowOriginal: any = row.original as any
                        const primary = (rowIdKey && rowOriginal?.[rowIdKey]) ?? rowOriginal?.id
                        const normalized = (val: any) => {
                          if (val === undefined || val === null) return ''
                          const s = String(val)
                          if (s.trim() === '' || s.toLowerCase() === 'nan') return ''
                          return s
                        }
                        const rowId = normalized(primary) || String(row.id)
                        const checked = selection ? selection.has(rowId) : false
                        return (
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={(e) => onToggleRow && onToggleRow(rowId, e.target.checked)}
                          />
                        )
                      })()}
                    </td>
                  )}
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id
                    const rowOriginal: any = cell.row.original as any
                    const primary = (rowIdKey && rowOriginal?.[rowIdKey]) ?? rowOriginal?.id
                    const normalized = (val: any) => {
                      if (val === undefined || val === null) return ''
                      const s = String(val)
                      if (s.trim() === '' || s.toLowerCase() === 'nan') return ''
                      return s
                    }
                    const rowId = normalized(primary) || String(cell.row.id)
                    const value = cell.getValue() as any

                    const canEdit = editable && typeof onCellEdit === "function" && normalized(primary) !== ''
                    return (
                      <td key={cell.id} className="px-4 py-2 text-sm align-middle h-8">
                        {canEdit ? (
                          <EditableCell
                            value={value}
                            columnName={colId}
                            rowId={rowId}
                            editable={true}
                            onChange={(rid, cname, newVal) => onCellEdit(rid, cname, newVal)}
                          />
                        ) : (
                          <div className={normalized(primary) === '' ? "text-gray-400 italic" : ""}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} sur{" "}
          {table.getPageCount()}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
