import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface EditableCellProps {
  value: any
  columnName: string
  rowId: string
  editable: boolean
  dataType?: string
  onChange: (rowId: string, columnName: string, newValue: any) => void
}

export function EditableCell({
  value,
  columnName,
  rowId,
  editable,
  dataType = 'text',
  onChange,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const [hasChanged, setHasChanged] = useState(false)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleDoubleClick = () => {
    if (editable) {
      setIsEditing(true)
    }
  }

  const handleBlur = () => {
    setIsEditing(false)
    if (localValue !== value) {
      setHasChanged(true)
      onChange(rowId, columnName, localValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    }
    if (e.key === 'Escape') {
      setLocalValue(value)
      setIsEditing(false)
    }
  }

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return ''
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  if (isEditing) {
    return (
      <Input
        type={dataType === 'number' ? 'number' : 'text'}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        className="h-8 text-sm"
      />
    )
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={cn(
        "px-2 py-0 cursor-pointer hover:bg-slate-50 transition-colors h-8 flex items-center",
        editable && "hover:ring-1 hover:ring-blue-200",
        hasChanged && "bg-blue-50 font-medium"
      )}
      title={editable ? "Double-clic pour éditer" : "Lecture seule"}
    >
      {formatValue(localValue)}
    </div>
  )
}
