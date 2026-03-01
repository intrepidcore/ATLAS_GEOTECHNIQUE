import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Info, Plus, Minus, X, Divide, Calculator } from "lucide-react"

interface FieldCalculatorProps {
  open: boolean
  onClose: () => void
  tableName: string
  existingFields: Array<{ name: string; type: string }>
  selectedRowsCount: number
  onCalculate: (config: CalculatorConfig) => Promise<void>
}

export interface CalculatorConfig {
  updateSelectedOnly: boolean
  createNewField: boolean
  isVirtual: boolean
  fieldName: string
  fieldType: string
  fieldLength?: number
  fieldPrecision?: number
  updateExistingField?: string
  expression: string
  previewEntity?: number
}

const FIELD_TYPES = [
  { value: "integer", label: "Nombre entier (entier)" },
  { value: "double", label: "Nombre décimal (double)" },
  { value: "text", label: "Texte (text)" },
  { value: "boolean", label: "Booléen (boolean)" },
  { value: "date", label: "Date (date)" },
  { value: "timestamp", label: "Date et heure (timestamp)" },
]

const FUNCTION_CATEGORIES = [
  {
    name: "Agrégats",
    description: "Fonctions qui agrègent des valeurs sur des couches et des champs",
    functions: [
      { name: "sum", syntax: "sum(field)", description: "Somme des valeurs" },
      { name: "avg", syntax: "avg(field)", description: "Moyenne des valeurs" },
      { name: "count", syntax: "count(field)", description: "Compte les valeurs" },
      { name: "min", syntax: "min(field)", description: "Valeur minimale" },
      { name: "max", syntax: "max(field)", description: "Valeur maximale" },
    ],
  },
  {
    name: "Chaîne de caractères",
    description: "Fonctions de manipulation de texte",
    functions: [
      { name: "upper", syntax: "upper(string)", description: "Convertit en majuscules" },
      { name: "lower", syntax: "lower(string)", description: "Convertit en minuscules" },
      { name: "concat", syntax: "concat(str1, str2, ...)", description: "Concatène des chaînes" },
      { name: "substr", syntax: "substr(string, start, length)", description: "Extrait une sous-chaîne" },
      { name: "length", syntax: "length(string)", description: "Longueur de la chaîne" },
      { name: "trim", syntax: "trim(string)", description: "Supprime les espaces" },
      { name: "replace", syntax: "replace(string, old, new)", description: "Remplace du texte" },
    ],
  },
  {
    name: "Champs et Valeurs",
    description: "Accès aux valeurs des champs",
    functions: [
      { name: "field", syntax: '"field_name"', description: "Référence un champ" },
      { name: "attribute", syntax: 'attribute($currentfeature, "field")', description: "Valeur d\'attribut" },
    ],
  },
  {
    name: "Conditions",
    description: "Expressions conditionnelles",
    functions: [
      { name: "if", syntax: "if(condition, true_value, false_value)", description: "Condition if-then-else" },
      { name: "case", syntax: "case when ... then ... else ... end", description: "Conditions multiples" },
      { name: "coalesce", syntax: "coalesce(val1, val2, ...)", description: "Première valeur non NULL" },
    ],
  },
  {
    name: "Conversions",
    description: "Conversion de types",
    functions: [
      { name: "to_int", syntax: "to_int(value)", description: "Convertit en entier" },
      { name: "to_real", syntax: "to_real(value)", description: "Convertit en décimal" },
      { name: "to_string", syntax: "to_string(value)", description: "Convertit en texte" },
      { name: "to_date", syntax: "to_date(string)", description: "Convertit en date" },
    ],
  },
  {
    name: "Date et Heure",
    description: "Manipulation de dates",
    functions: [
      { name: "now", syntax: "now()", description: "Date et heure actuelles" },
      { name: "year", syntax: "year(date)", description: "Extrait l'année" },
      { name: "month", syntax: "month(date)", description: "Extrait le mois" },
      { name: "day", syntax: "day(date)", description: "Extrait le jour" },
      { name: "age", syntax: "age(date1, date2)", description: "Différence entre dates" },
    ],
  },
  {
    name: "Géométrie",
    description: "Fonctions géométriques",
    functions: [
      { name: "area", syntax: "area($geometry)", description: "Surface de la géométrie" },
      { name: "length", syntax: "length($geometry)", description: "Longueur de la géométrie" },
      { name: "x", syntax: "x($geometry)", description: "Coordonnée X" },
      { name: "y", syntax: "y($geometry)", description: "Coordonnée Y" },
      { name: "centroid", syntax: "centroid($geometry)", description: "Centre de la géométrie" },
      { name: "buffer", syntax: "buffer($geometry, distance)", description: "Tampon autour de la géométrie" },
    ],
  },
  {
    name: "Math",
    description: "Fonctions mathématiques",
    functions: [
      { name: "abs", syntax: "abs(value)", description: "Valeur absolue" },
      { name: "round", syntax: "round(value, decimals)", description: "Arrondi" },
      { name: "floor", syntax: "floor(value)", description: "Arrondi inférieur" },
      { name: "ceil", syntax: "ceil(value)", description: "Arrondi supérieur" },
      { name: "sqrt", syntax: "sqrt(value)", description: "Racine carrée" },
      { name: "power", syntax: "power(base, exponent)", description: "Puissance" },
      { name: "log", syntax: "log(value)", description: "Logarithme naturel" },
      { name: "sin", syntax: "sin(angle)", description: "Sinus" },
      { name: "cos", syntax: "cos(angle)", description: "Cosinus" },
      { name: "tan", syntax: "tan(angle)", description: "Tangente" },
    ],
  },
  {
    name: "Général",
    description: "Fonctions générales",
    functions: [
      { name: "row_number", syntax: "row_number()", description: "Numéro de ligne" },
      { name: "uuid", syntax: "uuid()", description: "Génère un UUID" },
      { name: "rand", syntax: "rand(min, max)", description: "Nombre aléatoire" },
    ],
  },
]

export function FieldCalculator({
  open,
  onClose,
  tableName,
  existingFields,
  selectedRowsCount,
  onCalculate,
}: FieldCalculatorProps) {
  const [updateSelectedOnly, setUpdateSelectedOnly] = useState(false)
  const [createNewField, setCreateNewField] = useState(true)
  const [isVirtual, setIsVirtual] = useState(false)
  const [fieldName, setFieldName] = useState("")
  const [fieldType, setFieldType] = useState("text")
  const [fieldLength, setFieldLength] = useState<number>(0)
  const [fieldPrecision, setFieldPrecision] = useState<number>(3)
  const [updateExistingField, setUpdateExistingField] = useState("")
  const [expression, setExpression] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedFunction, setSelectedFunction] = useState<any>(null)
  const [previewEntity, setPreviewEntity] = useState<number>(1)
  const [previewResult, setPreviewResult] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")

  const insertOperator = (op: string) => {
    setExpression((prev) => prev + op)
  }

  const insertFunction = (func: any) => {
    setExpression((prev) => prev + func.syntax)
  }

  const handleCalculate = async () => {
    const config: CalculatorConfig = {
      updateSelectedOnly,
      createNewField,
      isVirtual,
      fieldName: createNewField ? fieldName : updateExistingField,
      fieldType,
      fieldLength: fieldLength > 0 ? fieldLength : undefined,
      fieldPrecision: fieldPrecision > 0 ? fieldPrecision : undefined,
      updateExistingField: createNewField ? undefined : updateExistingField,
      expression,
      previewEntity,
    }

    await onCalculate(config)
  }

  const filteredCategories = FUNCTION_CATEGORIES.map((cat) => ({
    ...cat,
    functions: cat.functions.filter(
      (f) =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.description.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter((cat) => cat.functions.length > 0)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {tableName} — Calculatrice de champ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Zone 1: Update selected only */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="updateSelected"
              checked={updateSelectedOnly}
              onCheckedChange={(checked) => setUpdateSelectedOnly(checked as boolean)}
            />
            <Label htmlFor="updateSelected">
              Ne mettre à jour que les {selectedRowsCount} entités sélectionnées
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Zone 2: Create new field */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createNew"
                  checked={createNewField}
                  onCheckedChange={(checked) => {
                    setCreateNewField(checked as boolean)
                    if (checked) setUpdateExistingField("")
                  }}
                />
                <Label htmlFor="createNew" className="font-semibold">
                  Créer un nouveau champ
                </Label>
              </div>

              {createNewField && (
                <div className="space-y-3 pl-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="virtual"
                      checked={isVirtual}
                      onCheckedChange={(checked) => setIsVirtual(checked as boolean)}
                    />
                    <Label htmlFor="virtual">Créer un champ virtuel</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fieldName">Nom</Label>
                    <Input
                      id="fieldName"
                      value={fieldName}
                      onChange={(e) => setFieldName(e.target.value)}
                      placeholder="nom_du_champ"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fieldType">Type</Label>
                    <Select value={fieldType} onValueChange={setFieldType}>
                      <SelectTrigger id="fieldType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="fieldLength">Longueur du nouveau champ</Label>
                      <Input
                        id="fieldLength"
                        type="number"
                        value={fieldLength}
                        onChange={(e) => setFieldLength(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fieldPrecision">Précision</Label>
                      <Input
                        id="fieldPrecision"
                        type="number"
                        value={fieldPrecision}
                        onChange={(e) => setFieldPrecision(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Zone 3: Update existing field */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="updateExisting"
                  checked={!createNewField}
                  onCheckedChange={(checked) => {
                    setCreateNewField(!(checked as boolean))
                    if (checked) setFieldName("")
                  }}
                />
                <Label htmlFor="updateExisting" className="font-semibold">
                  Mise à jour d'un champ existant
                </Label>
              </div>

              {!createNewField && (
                <div className="space-y-2 pl-6">
                  <Select value={updateExistingField} onValueChange={setUpdateExistingField}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un champ..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingFields.map((field) => (
                        <SelectItem key={field.name} value={field.name}>
                          {field.name} ({field.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Zone 4: Expression editor */}
          <div className="space-y-2">
            <Tabs defaultValue="expression">
              <TabsList>
                <TabsTrigger value="expression">Expression</TabsTrigger>
                <TabsTrigger value="function">Éditeur de fonction</TabsTrigger>
              </TabsList>

              <TabsContent value="expression" className="space-y-2">
                <Textarea
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="Entrez votre expression ici..."
                  className="font-mono min-h-[120px]"
                />
              </TabsContent>

              <TabsContent value="function">
                <Alert variant="info">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    L'éditeur de fonction Python n'est pas disponible dans cette version.
                    Utilisez l'onglet Expression.
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>

            {/* Zone 5: Operators */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => insertOperator(" + ")}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => insertOperator(" - ")}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => insertOperator(" / ")}
              >
                <Divide className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => insertOperator(" * ")}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => insertOperator(" ^ ")}>
                ^
              </Button>
              <Button variant="outline" size="sm" onClick={() => insertOperator(" || ")}>
                ||
              </Button>
              <Button variant="outline" size="sm" onClick={() => insertOperator("(")}>
                (
              </Button>
              <Button variant="outline" size="sm" onClick={() => insertOperator(")")}>
                )
              </Button>
              <Button variant="outline" size="sm" onClick={() => insertOperator("\n")}>
                ↵
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Zone 6: Function list */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>

              <div className="border rounded-lg h-64 overflow-y-auto">
                {filteredCategories.map((category) => (
                  <div key={category.name}>
                    <div
                      className="px-3 py-2 bg-slate-50 font-medium text-sm cursor-pointer hover:bg-slate-100"
                      onClick={() =>
                        setSelectedCategory(
                          selectedCategory === category.name ? null : category.name
                        )
                      }
                    >
                      ▸ {category.name}
                    </div>
                    {selectedCategory === category.name && (
                      <div className="pl-4">
                        {category.functions.map((func) => (
                          <div
                            key={func.name}
                            className="px-3 py-1.5 text-sm hover:bg-blue-50 cursor-pointer"
                            onClick={() => {
                              setSelectedFunction(func)
                              insertFunction(func)
                            }}
                          >
                            {func.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Zone 7: Help panel */}
            <div className="border rounded-lg p-4 h-64 overflow-y-auto">
              {selectedFunction ? (
                <div className="space-y-2">
                  <h4 className="font-semibold">{selectedFunction.name}</h4>
                  <div className="text-sm text-slate-600">
                    {selectedFunction.description}
                  </div>
                  <div className="bg-slate-50 p-2 rounded font-mono text-sm">
                    {selectedFunction.syntax}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">
                  Sélectionnez une fonction pour voir l'aide
                </div>
              )}
            </div>
          </div>

          {/* Zone 8: Preview */}
          <div className="space-y-2 border rounded-lg p-4 bg-slate-50">
            <div className="flex items-center gap-4">
              <Label htmlFor="previewEntity">Entité</Label>
              <Select
                value={previewEntity.toString()}
                onValueChange={(v) => setPreviewEntity(parseInt(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Prévisualisation:</Label>
              <div className="bg-white p-3 rounded border font-mono text-sm min-h-[60px]">
                {previewResult || "Aucun aperçu disponible"}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <Info className="h-4 w-4 mr-2" />
            Aide
          </Button>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleCalculate}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
