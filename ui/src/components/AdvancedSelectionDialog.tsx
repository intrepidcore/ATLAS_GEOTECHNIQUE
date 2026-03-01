import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Box } from 'lucide-react'

interface AdvancedSelectionDialogProps {
  onRegexSelect: (pattern: string, column: string) => void
  onBboxSelect: (bbox: [number, number, number, number]) => void
  onClose: () => void
  columns: string[]
}

export function AdvancedSelectionDialog({
  onRegexSelect,
  onBboxSelect,
  onClose,
  columns,
}: AdvancedSelectionDialogProps) {
  const [regexPattern, setRegexPattern] = useState('')
  const [regexColumn, setRegexColumn] = useState(columns[0] || '')
  const [minX, setMinX] = useState('')
  const [minY, setMinY] = useState('')
  const [maxX, setMaxX] = useState('')
  const [maxY, setMaxY] = useState('')

  const handleRegexSubmit = () => {
    if (regexPattern && regexColumn) {
      onRegexSelect(regexPattern, regexColumn)
      onClose()
    }
  }

  const handleBboxSubmit = () => {
    const bbox: [number, number, number, number] = [
      parseFloat(minX),
      parseFloat(minY),
      parseFloat(maxX),
      parseFloat(maxY),
    ]
    if (bbox.every(n => !isNaN(n))) {
      onBboxSelect(bbox)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Sélection Avancée</h2>

        <Tabs defaultValue="regex">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="regex">
              <Search className="h-4 w-4 mr-2" />
              Regex
            </TabsTrigger>
            <TabsTrigger value="bbox">
              <Box className="h-4 w-4 mr-2" />
              BBOX
            </TabsTrigger>
          </TabsList>

          <TabsContent value="regex" className="space-y-4">
            <div>
              <Label htmlFor="column">Colonne</Label>
              <select
                id="column"
                value={regexColumn}
                onChange={(e) => setRegexColumn(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              >
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="pattern">Pattern Regex</Label>
              <Input
                id="pattern"
                value={regexPattern}
                onChange={(e) => setRegexPattern(e.target.value)}
                placeholder="Ex: ^GRANU.*"
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
                Exemples: ^GRANU.* (commence par), .*BLEU.* (contient), .*01$ (finit par)
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleRegexSubmit} className="flex-1">
                Appliquer
              </Button>
              <Button onClick={onClose} variant="outline">
                Annuler
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="bbox" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minX">Min X</Label>
                <Input
                  id="minX"
                  type="number"
                  value={minX}
                  onChange={(e) => setMinX(e.target.value)}
                  placeholder="0.0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="minY">Min Y</Label>
                <Input
                  id="minY"
                  type="number"
                  value={minY}
                  onChange={(e) => setMinY(e.target.value)}
                  placeholder="0.0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="maxX">Max X</Label>
                <Input
                  id="maxX"
                  type="number"
                  value={maxX}
                  onChange={(e) => setMaxX(e.target.value)}
                  placeholder="10.0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="maxY">Max Y</Label>
                <Input
                  id="maxY"
                  type="number"
                  value={maxY}
                  onChange={(e) => setMaxY(e.target.value)}
                  placeholder="10.0"
                  className="mt-1"
                />
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Sélectionne les entités dont la géométrie intersecte cette bbox
            </p>

            <div className="flex gap-2">
              <Button onClick={handleBboxSubmit} className="flex-1">
                Appliquer
              </Button>
              <Button onClick={onClose} variant="outline">
                Annuler
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
