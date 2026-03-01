import React from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Save, X } from 'lucide-react'

interface UnsavedChangesAlertProps {
  onSave: () => void
  onCancel: () => void
}

export function UnsavedChangesAlert({ onSave, onCancel }: UnsavedChangesAlertProps) {
  return (
    <Alert className="bg-orange-50 border-orange-200">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-orange-800 font-medium">
          Modifications non sauvegardées
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            className="border-orange-300 text-orange-700 hover:bg-orange-100"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            Enregistrer
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
