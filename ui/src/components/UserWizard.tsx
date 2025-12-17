/**
 * Wizard de création/édition d'utilisateur
 * Interface moderne avec stepper et champs adaptatifs selon le rôle
 */
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  User, 
  Mail, 
  Lock, 
  Shield, 
  GraduationCap, 
  Building2, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Phone,
  Hash,
  BookOpen,
  Briefcase
} from 'lucide-react'
import { usersApi } from '@/services/auth-api'

// ============================================================================
// Types
// ============================================================================

interface UserFormData {
  username: string
  email: string
  password: string
  confirmPassword: string
  first_name: string
  last_name: string
  roles: string[]
  is_active: boolean
  // Champs étudiant
  matricule?: string
  school?: string
  program?: string
  level?: string
  phone?: string
  // Champs encadreur
  organization?: string
  title?: string
  specialty?: string
}

interface UserWizardProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editUser?: {
    id: string
    username: string
    email: string
    first_name?: string
    last_name?: string
    roles: string[]
    is_active: boolean
  } | null
  availableRoles: Array<{ id: string; name: string; description?: string }>
}

// ============================================================================
// Constantes
// ============================================================================

const STEPS = [
  { id: 1, title: 'Identité', icon: User },
  { id: 2, title: 'Rôle', icon: Shield },
  { id: 3, title: 'Détails', icon: Briefcase },
  { id: 4, title: 'Confirmation', icon: Check },
]

const ROLE_ICONS: Record<string, React.ElementType> = {
  admin: Shield,
  editor: Briefcase,
  viewer: Eye,
  student: GraduationCap,
  supervisor: Building2,
  data_manager: Briefcase,
  geo_analyst: Briefcase,
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 border-red-200',
  editor: 'bg-blue-100 text-blue-800 border-blue-200',
  viewer: 'bg-gray-100 text-gray-800 border-gray-200',
  student: 'bg-green-100 text-green-800 border-green-200',
  supervisor: 'bg-purple-100 text-purple-800 border-purple-200',
  data_manager: 'bg-orange-100 text-orange-800 border-orange-200',
  geo_analyst: 'bg-cyan-100 text-cyan-800 border-cyan-200',
}

// ============================================================================
// Composant principal
// ============================================================================

export const UserWizard: React.FC<UserWizardProps> = ({
  open,
  onClose,
  onSuccess,
  editUser,
  availableRoles
}) => {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    roles: [],
    is_active: true,
  })

  // Réinitialiser le formulaire quand le dialog s'ouvre
  useEffect(() => {
    if (open) {
      if (editUser) {
        setFormData({
          username: editUser.username,
          email: editUser.email,
          password: '',
          confirmPassword: '',
          first_name: editUser.first_name || '',
          last_name: editUser.last_name || '',
          roles: editUser.roles,
          is_active: editUser.is_active,
        })
      } else {
        setFormData({
          username: '',
          email: '',
          password: '',
          confirmPassword: '',
          first_name: '',
          last_name: '',
          roles: [],
          is_active: true,
        })
      }
      setStep(1)
      setError(null)
    }
  }, [open, editUser])

  const updateField = (field: keyof UserFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleRole = (roleId: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter(r => r !== roleId)
        : [...prev.roles, roleId]
    }))
  }

  // Validation par étape
  const validateStep = (stepNum: number): string | null => {
    switch (stepNum) {
      case 1:
        if (!formData.username.trim()) return 'Le nom d\'utilisateur est requis'
        if (!formData.email.trim()) return 'L\'email est requis'
        if (!formData.email.includes('@')) return 'Email invalide'
        if (!editUser) {
          if (!formData.password) return 'Le mot de passe est requis'
          if (formData.password.length < 8) return 'Le mot de passe doit faire au moins 8 caractères'
          if (formData.password !== formData.confirmPassword) return 'Les mots de passe ne correspondent pas'
        }
        return null
      case 2:
        if (formData.roles.length === 0) return 'Sélectionnez au moins un rôle'
        return null
      case 3:
        // Champs optionnels, pas de validation stricte
        return null
      default:
        return null
    }
  }

  const canProceed = () => validateStep(step) === null

  const handleNext = () => {
    const validationError = validateStep(step)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setStep(prev => Math.min(prev + 1, 4))
  }

  const handleBack = () => {
    setError(null)
    setStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      if (editUser) {
        // Mise à jour
        await usersApi.update(editUser.id, {
          email: formData.email,
          username: formData.username,
          first_name: formData.first_name || undefined,
          last_name: formData.last_name || undefined,
          is_active: formData.is_active,
        })
        await usersApi.assignRoles(editUser.id, formData.roles)
      } else {
        // Création
        await usersApi.create({
          email: formData.email,
          username: formData.username,
          password: formData.password,
          first_name: formData.first_name || undefined,
          last_name: formData.last_name || undefined,
          is_active: formData.is_active,
          roles: formData.roles,
        })
      }

      console.log('[RBAC][CREATE_USER] role=' + formData.roles.join(',') + ' email=' + formData.email)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  // Détermine si on a besoin de l'étape 3 (champs spécifiques)
  const needsDetailsStep = formData.roles.includes('student') || formData.roles.includes('supervisor')

  // ============================================================================
  // Rendu des étapes
  // ============================================================================

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-6">
      {STEPS.map((s, idx) => {
        // Sauter l'étape 3 si pas de champs spécifiques
        if (s.id === 3 && !needsDetailsStep) return null
        
        const isActive = step === s.id
        const isCompleted = step > s.id
        const Icon = s.icon

        return (
          <React.Fragment key={s.id}>
            {idx > 0 && (
              <div className={`w-12 h-0.5 mx-1 ${isCompleted ? 'bg-blue-500' : 'bg-gray-200'}`} />
            )}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isActive
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : isCompleted
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span className={`text-xs mt-1 ${isActive ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                {s.title}
              </span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="first_name">Prénom</Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={e => updateField('first_name', e.target.value)}
            placeholder="Jean"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Nom</Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={e => updateField('last_name', e.target.value)}
            placeholder="Dupont"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Nom d'utilisateur *</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="username"
            value={formData.username}
            onChange={e => updateField('username', e.target.value)}
            placeholder="jean.dupont"
            className="pl-10"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={e => updateField('email', e.target.value)}
            placeholder="jean.dupont@example.com"
            className="pl-10"
          />
        </div>
      </div>

      {!editUser && (
        <>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={e => updateField('password', e.target.value)}
                placeholder="Min. 8 caractères"
                className="pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={e => updateField('confirmPassword', e.target.value)}
                placeholder="Confirmer le mot de passe"
                className="pl-10"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-4">
        Sélectionnez un ou plusieurs rôles pour cet utilisateur.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {availableRoles.map(role => {
          const isSelected = formData.roles.includes(role.id)
          const Icon = ROLE_ICONS[role.id] || Shield
          const colorClass = ROLE_COLORS[role.id] || 'bg-gray-100 text-gray-800 border-gray-200'

          return (
            <button
              key={role.id}
              type="button"
              onClick={() => toggleRole(role.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colorClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">{role.name}</div>
                  {role.description && (
                    <div className="text-xs text-gray-500 truncate">{role.description}</div>
                  )}
                </div>
                {isSelected && (
                  <Check className="h-5 w-5 text-blue-500 flex-shrink-0" />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderStep3 = () => {
    const isStudent = formData.roles.includes('student')
    const isSupervisor = formData.roles.includes('supervisor')

    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 mb-4">
          Informations complémentaires selon le rôle sélectionné.
        </p>

        {isStudent && (
          <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-800 flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Informations étudiant
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="matricule">Matricule</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="matricule"
                    value={formData.matricule || ''}
                    onChange={e => updateField('matricule', e.target.value)}
                    placeholder="ETU-2024-001"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    value={formData.phone || ''}
                    onChange={e => updateField('phone', e.target.value)}
                    placeholder="+228 90 00 00 00"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="school">Établissement</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="school"
                  value={formData.school || ''}
                  onChange={e => updateField('school', e.target.value)}
                  placeholder="Université de Lomé"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="program">Filière</Label>
                <div className="relative">
                  <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="program"
                    value={formData.program || ''}
                    onChange={e => updateField('program', e.target.value)}
                    placeholder="Génie Civil"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Niveau</Label>
                <Input
                  id="level"
                  value={formData.level || ''}
                  onChange={e => updateField('level', e.target.value)}
                  placeholder="Master 2"
                />
              </div>
            </div>
          </div>
        )}

        {isSupervisor && (
          <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h4 className="font-medium text-purple-800 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Informations encadreur
            </h4>

            <div className="space-y-2">
              <Label htmlFor="organization">Organisation</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="organization"
                  value={formData.organization || ''}
                  onChange={e => updateField('organization', e.target.value)}
                  placeholder="LBTP Togo"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={e => updateField('title', e.target.value)}
                  placeholder="Ingénieur géotechnicien"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialty">Spécialité</Label>
                <Input
                  id="specialty"
                  value={formData.specialty || ''}
                  onChange={e => updateField('specialty', e.target.value)}
                  placeholder="Mécanique des sols"
                />
              </div>
            </div>
          </div>
        )}

        {!isStudent && !isSupervisor && (
          <div className="text-center py-8 text-gray-500">
            <Shield className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Aucune information complémentaire requise pour ce rôle.</p>
          </div>
        )}
      </div>
    )
  }

  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <h4 className="font-medium text-gray-900">Récapitulatif</h4>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="text-gray-500">Nom complet</div>
          <div className="font-medium">
            {formData.first_name || formData.last_name 
              ? `${formData.first_name} ${formData.last_name}`.trim()
              : '—'}
          </div>
          
          <div className="text-gray-500">Nom d'utilisateur</div>
          <div className="font-medium">{formData.username}</div>
          
          <div className="text-gray-500">Email</div>
          <div className="font-medium">{formData.email}</div>
          
          <div className="text-gray-500">Statut</div>
          <div>
            <Badge variant={formData.is_active ? 'default' : 'secondary'}>
              {formData.is_active ? 'Actif' : 'Inactif'}
            </Badge>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="text-gray-500 text-sm mb-2">Rôles</div>
          <div className="flex flex-wrap gap-2">
            {formData.roles.map(roleId => {
              const role = availableRoles.find(r => r.id === roleId)
              const colorClass = ROLE_COLORS[roleId] || 'bg-gray-100 text-gray-800'
              return (
                <Badge key={roleId} className={colorClass}>
                  {role?.name || roleId}
                </Badge>
              )
            })}
          </div>
        </div>

        {formData.roles.includes('student') && formData.matricule && (
          <div className="pt-2 border-t">
            <div className="text-gray-500 text-sm mb-1">Matricule</div>
            <div className="font-medium">{formData.matricule}</div>
          </div>
        )}
      </div>

      <Alert>
        <AlertDescription>
          {editUser 
            ? 'Les modifications seront appliquées immédiatement.'
            : 'Un email de bienvenue sera envoyé à l\'utilisateur avec ses identifiants.'}
        </AlertDescription>
      </Alert>
    </div>
  )

  // ============================================================================
  // Rendu principal
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {editUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
          </DialogTitle>
        </DialogHeader>

        {renderStepIndicator()}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="min-h-[300px]">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={step === 1 ? onClose : handleBack}
            disabled={loading}
          >
            {step === 1 ? 'Annuler' : (
              <>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Précédent
              </>
            )}
          </Button>

          {step < 4 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {editUser ? 'Enregistrer' : 'Créer l\'utilisateur'}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default UserWizard
