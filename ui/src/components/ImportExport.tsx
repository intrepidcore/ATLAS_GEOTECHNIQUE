import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Upload, Download, FileJson, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react"
import Papa from "papaparse"
import { saveAs } from "file-saver"

interface ImportExportProps {
  open: boolean
  onClose: () => void
  tableName: string
  data: any[]
  columns: Array<{ name: string; type: string }>
  onImport: (data: any[], mapping: FieldMapping) => Promise<void>
}

interface FieldMapping {
  [csvColumn: string]: string // Maps CSV column to table field
}

interface ValidationError {
  row: number
  field: string
  value: any
  error: string
}

export function ImportExport({
  open,
  onClose,
  tableName,
  data,
  columns,
  onImport,
}: ImportExportProps) {
  const [activeTab, setActiveTab] = useState<"import" | "export">("export")
  
  // Export state
  const [exportFormat, setExportFormat] = useState<"csv" | "geojson" | "json">("csv")
  const [exportSelectedOnly, setExportSelectedOnly] = useState(false)
  const [selectedFields, setSelectedFields] = useState<string[]>(columns.map(c => c.name))

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importData, setImportData] = useState<any[]>([])
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({})
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [importStep, setImportStep] = useState<"upload" | "mapping" | "validation" | "complete">("upload")

  const handleExport = () => {
    const dataToExport = exportSelectedOnly ? data.filter((row: any) => row.selected) : data
    const fieldsToExport = selectedFields.length > 0 ? selectedFields : columns.map(c => c.name)
    
    const filteredData = dataToExport.map((row: any) => {
      const filtered: any = {}
      fieldsToExport.forEach(field => {
        filtered[field] = row[field]
      })
      return filtered
    })

    if (exportFormat === "csv") {
      const csv = Papa.unparse(filteredData)
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      saveAs(blob, `${tableName}_export.csv`)
    } else if (exportFormat === "json") {
      const json = JSON.stringify(filteredData, null, 2)
      const blob = new Blob([json], { type: "application/json;charset=utf-8;" })
      saveAs(blob, `${tableName}_export.json`)
    } else if (exportFormat === "geojson") {
      const geojson = {
        type: "FeatureCollection",
        features: filteredData.map((row: any) => ({
          type: "Feature",
          properties: row,
          geometry: row.geometry || null,
        })),
      }
      const json = JSON.stringify(geojson, null, 2)
      const blob = new Blob([json], { type: "application/geo+json;charset=utf-8;" })
      saveAs(blob, `${tableName}_export.geojson`)
    }

    onClose()
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportFile(file)

    if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setImportData(results.data)
          setImportHeaders(results.meta.fields || [])
          
          // Auto-mapping: match column names
          const autoMapping: FieldMapping = {}
          results.meta.fields?.forEach((csvCol) => {
            const matchingField = columns.find(
              (c) => c.name.toLowerCase() === csvCol.toLowerCase()
            )
            if (matchingField) {
              autoMapping[csvCol] = matchingField.name
            }
          })
          setFieldMapping(autoMapping)
          setImportStep("mapping")
        },
        error: (error) => {
          console.error("CSV parse error:", error)
        },
      })
    } else if (file.name.endsWith(".json") || file.name.endsWith(".geojson")) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string)
          const features = json.type === "FeatureCollection" ? json.features : json
          const data = features.map((f: any) => f.properties || f)
          
          setImportData(data)
          const headers = Object.keys(data[0] || {})
          setImportHeaders(headers)
          
          // Auto-mapping
          const autoMapping: FieldMapping = {}
          headers.forEach((csvCol) => {
            const matchingField = columns.find(
              (c) => c.name.toLowerCase() === csvCol.toLowerCase()
            )
            if (matchingField) {
              autoMapping[csvCol] = matchingField.name
            }
          })
          setFieldMapping(autoMapping)
          setImportStep("mapping")
        } catch (error) {
          console.error("JSON parse error:", error)
        }
      }
      reader.readAsText(file)
    }
  }

  const validateImport = () => {
    const errors: ValidationError[] = []

    importData.forEach((row, idx) => {
      Object.entries(fieldMapping).forEach(([csvCol, tableField]) => {
        const value = row[csvCol]
        const column = columns.find((c) => c.name === tableField)

        if (!column) return

        // Validation basique
        if (column.type === "integer" && value && isNaN(parseInt(value))) {
          errors.push({
            row: idx + 1,
            field: tableField,
            value,
            error: "Doit être un nombre entier",
          })
        }

        if (column.type === "double" && value && isNaN(parseFloat(value))) {
          errors.push({
            row: idx + 1,
            field: tableField,
            value,
            error: "Doit être un nombre décimal",
          })
        }
      })
    })

    setValidationErrors(errors)
    setImportStep("validation")
  }

  const handleImport = async () => {
    if (validationErrors.length > 0) {
      return
    }

    await onImport(importData, fieldMapping)
    setImportStep("complete")
  }

  const toggleFieldSelection = (fieldName: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldName)
        ? prev.filter(f => f !== fieldName)
        : [...prev, fieldName]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import/Export - {tableName}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">
              <Download className="h-4 w-4 mr-2" />
              Export
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </TabsTrigger>
          </TabsList>

          {/* EXPORT TAB */}
          <TabsContent value="export" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Format d'export</Label>
                <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        CSV (Comma Separated Values)
                      </div>
                    </SelectItem>
                    <SelectItem value="json">
                      <div className="flex items-center gap-2">
                        <FileJson className="h-4 w-4" />
                        JSON
                      </div>
                    </SelectItem>
                    <SelectItem value="geojson">
                      <div className="flex items-center gap-2">
                        <FileJson className="h-4 w-4" />
                        GeoJSON
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="exportSelected"
                  checked={exportSelectedOnly}
                  onCheckedChange={(checked) => setExportSelectedOnly(checked as boolean)}
                />
                <Label htmlFor="exportSelected">
                  Exporter uniquement les entités sélectionnées ({data.filter((r: any) => r.selected).length})
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Champs à exporter</Label>
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                  {columns.map((col) => (
                    <div key={col.name} className="flex items-center space-x-2">
                      <Checkbox
                        id={`export-${col.name}`}
                        checked={selectedFields.includes(col.name)}
                        onCheckedChange={() => toggleFieldSelection(col.name)}
                      />
                      <Label htmlFor={`export-${col.name}`} className="flex-1">
                        {col.name}
                        <Badge variant="outline" className="ml-2">
                          {col.type}
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Prêt à exporter</AlertTitle>
                <AlertDescription>
                  {exportSelectedOnly ? data.filter((r: any) => r.selected).length : data.length} lignes ×{" "}
                  {selectedFields.length} colonnes
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="space-y-4">
            {importStep === "upload" && (
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <div className="text-lg font-medium mb-2">
                      Cliquez pour sélectionner un fichier
                    </div>
                    <div className="text-sm text-slate-500">
                      CSV, JSON ou GeoJSON
                    </div>
                  </Label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv,.json,.geojson"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {importFile && (
                  <Alert variant="info">
                    <FileSpreadsheet className="h-4 w-4" />
                    <AlertTitle>Fichier sélectionné</AlertTitle>
                    <AlertDescription>
                      {importFile.name} ({(importFile.size / 1024).toFixed(2)} KB)
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {importStep === "mapping" && (
              <div className="space-y-4">
                <Alert variant="info">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Mapping des champs</AlertTitle>
                  <AlertDescription>
                    {importData.length} lignes détectées. Associez les colonnes du fichier aux champs de la table.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {importHeaders.map((header) => (
                    <div key={header} className="grid grid-cols-2 gap-4 items-center">
                      <div className="font-medium">{header}</div>
                      <Select
                        value={fieldMapping[header] || ""}
                        onValueChange={(value) =>
                          setFieldMapping((prev) => ({ ...prev, [header]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Ignorer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Ignorer</SelectItem>
                          {columns.map((col) => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.name} ({col.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setImportStep("upload")}>
                    Retour
                  </Button>
                  <Button onClick={validateImport}>Valider</Button>
                </DialogFooter>
              </div>
            )}

            {importStep === "validation" && (
              <div className="space-y-4">
                {validationErrors.length === 0 ? (
                  <Alert variant="success">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Validation réussie</AlertTitle>
                    <AlertDescription>
                      Toutes les données sont valides. Prêt à importer {importData.length} lignes.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{validationErrors.length} erreurs détectées</AlertTitle>
                    <AlertDescription>
                      Corrigez les erreurs avant d'importer.
                    </AlertDescription>
                  </Alert>
                )}

                {validationErrors.length > 0 && (
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    {validationErrors.map((error, idx) => (
                      <div key={idx} className="p-3 border-b last:border-b-0">
                        <div className="font-medium text-red-600">
                          Ligne {error.row}, Champ {error.field}
                        </div>
                        <div className="text-sm text-slate-600">
                          Valeur: {error.value} - {error.error}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setImportStep("mapping")}>
                    Retour
                  </Button>
                  <Button onClick={handleImport} disabled={validationErrors.length > 0}>
                    Importer
                  </Button>
                </DialogFooter>
              </div>
            )}

            {importStep === "complete" && (
              <div className="space-y-4">
                <Alert variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Import réussi</AlertTitle>
                  <AlertDescription>
                    {importData.length} lignes ont été importées avec succès.
                  </AlertDescription>
                </Alert>

                <DialogFooter>
                  <Button onClick={onClose}>Fermer</Button>
                </DialogFooter>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
