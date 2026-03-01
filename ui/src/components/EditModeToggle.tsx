import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Eye, Pencil } from 'lucide-react'

interface EditModeToggleProps {
  editMode: boolean
  onChange: (enabled: boolean) => void
}

export function EditModeToggle({ editMode, onChange }: EditModeToggleProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-lg border">
      <Eye className={editMode ? "h-4 w-4 text-slate-400" : "h-4 w-4 text-blue-600"} />
      <Switch checked={editMode} onCheckedChange={onChange} />
      <Pencil className={editMode ? "h-4 w-4 text-orange-600" : "h-4 w-4 text-slate-400"} />
      <span className="text-sm font-medium text-slate-700">
        {editMode ? "Mode Édition" : "Mode Lecture"}
      </span>
    </div>
  )
}
