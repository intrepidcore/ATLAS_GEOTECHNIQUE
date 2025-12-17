import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Users, Shield, Key, Plus, Trash2, Edit, AlertTriangle, Loader2, RefreshCw, LogIn, LogOut, GraduationCap, Building2, Phone, Hash, BookOpen, Search, Filter, UserCheck, UserX } from 'lucide-react'
import {
  usersApi,
  rolesApi,
  permissionsApi,
  authApi,
  tokenStorage,
  type User as ApiUser,
  type Role as ApiRole,
  type Permission as ApiPermission,
  type PermissionsByResource,
} from '@/services/auth-api'
import { UserWizard } from './UserWizard'

interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  is_system: boolean
  created_at: string
  user_count?: number
}

interface User {
  id: string
  email: string
  username: string
  first_name?: string
  last_name?: string
  roles: string[]
  is_active: boolean
  last_login_at?: string
}

// Champs spécifiques par rôle
interface StudentFields {
  matricule?: string
  school?: string
  program?: string
  level?: string
  phone?: string
}

interface SupervisorFields {
  organization?: string
  title?: string
  specialty?: string
}

interface Permission {
  id: string
  resource: string
  action: string
  description?: string
}

interface RBACManagerProps {
  open: boolean
  onClose: () => void
}

export const RBACManager: React.FC<RBACManagerProps> = ({ open, onClose }) => {
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [permissionsByResource, setPermissionsByResource] = useState<PermissionsByResource[]>([])
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newUserPassword, setNewUserPassword] = useState('')
  
  // Champs adaptatifs selon le rôle
  const [studentFields, setStudentFields] = useState<StudentFields>({})
  const [supervisorFields, setSupervisorFields] = useState<SupervisorFields>({})
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!tokenStorage.getAccessToken())
  const [loginEmail, setLoginEmail] = useState('admin@atlas.local')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState(tokenStorage.getUser())

  const handleLogin = async () => {
    setLoginLoading(true)
    setLoginError(null)
    try {
      const response = await authApi.login({ email: loginEmail, password: loginPassword })
      setIsAuthenticated(true)
      setCurrentUser(response.user)
      setLoginPassword('')
    } catch (err: any) {
      setLoginError(err.message || 'Erreur de connexion')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch (e) {
      // Ignorer les erreurs de logout
    }
    setIsAuthenticated(false)
    setCurrentUser(null)
    setUsers([])
    setRoles([])
    setPermissions([])
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Charger les utilisateurs
      const usersResponse = await usersApi.list({ per_page: 100 })
      setUsers(
        usersResponse.users.map(u => ({
          id: u.id,
          email: u.email,
          username: u.username,
          first_name: u.first_name,
          last_name: u.last_name,
          roles: u.roles.map(r => r.id),
          is_active: u.is_active,
          last_login_at: u.last_login_at,
        }))
      )

      // Charger les rôles avec permissions
      const rolesData = await rolesApi.list({ include_permissions: true, include_user_count: true })
      setRoles(
        rolesData.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description || '',
          permissions: r.permissions?.map(p => p.id) || [],
          is_system: r.is_system,
          created_at: r.created_at,
          user_count: r.user_count,
        }))
      )

      // Charger les permissions groupées
      const permGrouped = await permissionsApi.listGrouped()
      setPermissionsByResource(permGrouped)
      
      // Flatten permissions
      const allPerms: Permission[] = []
      permGrouped.forEach(g => {
        g.permissions.forEach(p => allPerms.push(p))
      })
      setPermissions(allPerms)
    } catch (err: any) {
      console.error('Error loading RBAC data:', err)
      setError(err.message || 'Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && isAuthenticated) {
      loadData()
    }
  }, [open, isAuthenticated, loadData])

  const handleSaveUser = async () => {
    if (!editingUser) return
    setLoading(true)
    setError(null)
    try {
      if (editingUser.id) {
        // Update existing user
        await usersApi.update(editingUser.id, {
          email: editingUser.email,
          username: editingUser.username,
          first_name: editingUser.first_name,
          last_name: editingUser.last_name,
          is_active: editingUser.is_active,
        })
        // Update roles
        await usersApi.assignRoles(editingUser.id, editingUser.roles)
      } else {
        // Create new user
        if (!newUserPassword) {
          setError('Le mot de passe est requis pour un nouvel utilisateur')
          setLoading(false)
          return
        }
        await usersApi.create({
          email: editingUser.email,
          username: editingUser.username,
          password: newUserPassword,
          first_name: editingUser.first_name,
          last_name: editingUser.last_name,
          is_active: editingUser.is_active,
          roles: editingUser.roles,
        })
      }
      setShowUserModal(false)
      setEditingUser(null)
      setNewUserPassword('')
      setStudentFields({})
      setSupervisorFields({})
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRole = async () => {
    if (!editingRole) return
    setLoading(true)
    setError(null)
    try {
      if (editingRole.id && roles.find(r => r.id === editingRole.id)) {
        // Update existing role
        await rolesApi.update(editingRole.id, {
          name: editingRole.name,
          description: editingRole.description,
        })
        await rolesApi.setPermissions(editingRole.id, editingRole.permissions)
      } else {
        // Create new role
        await rolesApi.create({
          id: editingRole.id || editingRole.name.toLowerCase().replace(/\s+/g, '_'),
          name: editingRole.name,
          description: editingRole.description,
          permissions: editingRole.permissions,
        })
      }
      setShowRoleModal(false)
      setEditingRole(null)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Supprimer cet utilisateur ?')) return
    setLoading(true)
    try {
      await usersApi.delete(userId)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    const role = roles.find(r => r.id === roleId)
    if (role?.is_system) {
      setError('Impossible de supprimer un rôle système')
      return
    }
    if (!confirm('Supprimer ce rôle ?')) return
    setLoading(true)
    try {
      await rolesApi.delete(roleId)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression')
    } finally {
      setLoading(false)
    }
  }

  const togglePermission = (permId: string) => {
    if (editingRole) {
      const perms = editingRole.permissions.includes(permId)
        ? editingRole.permissions.filter(p => p !== permId)
        : [...editingRole.permissions, permId]
      setEditingRole({ ...editingRole, permissions: perms })
    }
  }

  const toggleUserRole = (roleId: string) => {
    if (editingUser) {
      const userRoles = editingUser.roles.includes(roleId)
        ? editingUser.roles.filter(r => r !== roleId)
        : [...editingUser.roles, roleId]
      setEditingUser({ ...editingUser, roles: userRoles })
    }
  }

  const getUserDisplayName = (user: User) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim()
    }
    return user.username
  }

  // Si non authentifié, afficher le formulaire de login
  if (!isAuthenticated) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              Connexion requise
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">
              Connectez-vous pour accéder à la gestion des utilisateurs et des rôles.
            </p>

            {loginError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="admin@atlas.local"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            <div className="text-xs text-slate-500">
              <strong>Compte par défaut:</strong> admin@atlas.local / Atlas2024!
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={handleLogin} disabled={loginLoading}>
              {loginLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <LogIn className="h-4 w-4 mr-2" />
              Se connecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestion RBAC - Rôles & Permissions
            <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <div className="flex-1" />
            {currentUser && (
              <div className="flex items-center gap-2 text-sm font-normal">
                <span className="text-slate-500">Connecté:</span>
                <Badge variant="outline">{currentUser.username}</Badge>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Utilisateurs ({users.length})
            </TabsTrigger>
            <TabsTrigger value="roles">
              <Key className="h-4 w-4 mr-2" />
              Rôles ({roles.length})
            </TabsTrigger>
            <TabsTrigger value="permissions">
              <Shield className="h-4 w-4 mr-2" />
              Permissions ({permissions.length})
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="flex-1 overflow-auto">
            {/* Barre d'actions et filtres */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Button
                onClick={() => {
                  setEditingUser(null)
                  setShowUserModal(true)
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvel utilisateur
              </Button>
              
              {/* Recherche */}
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher..."
                  className="pl-10"
                  onChange={(e) => {
                    // Filtrage local simple
                    const query = e.target.value.toLowerCase()
                    // TODO: Implémenter le filtrage côté state
                  }}
                />
              </div>
              
              {/* Stats rapides */}
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <UserCheck className="h-4 w-4 text-green-500" />
                  {users.filter(u => u.is_active).length} actifs
                </span>
                <span className="flex items-center gap-1">
                  <UserX className="h-4 w-4 text-gray-400" />
                  {users.filter(u => !u.is_active).length} inactifs
                </span>
              </div>
            </div>

            {/* Liste des utilisateurs avec design moderne */}
            <div className="space-y-3">
              {users.map(user => {
                // Couleurs par rôle principal
                const primaryRole = user.roles[0]
                const roleColors: Record<string, string> = {
                  admin: 'border-l-red-500',
                  editor: 'border-l-blue-500',
                  viewer: 'border-l-gray-400',
                  student: 'border-l-green-500',
                  supervisor: 'border-l-purple-500',
                  data_manager: 'border-l-orange-500',
                  geo_analyst: 'border-l-cyan-500',
                }
                const borderColor = roleColors[primaryRole] || 'border-l-gray-300'
                
                // Avatar avec initiales
                const initials = (user.first_name?.[0] || '') + (user.last_name?.[0] || user.username[0] || '')
                
                return (
                  <div
                    key={user.id}
                    className={`border rounded-lg p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors border-l-4 ${borderColor}`}
                  >
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                      user.is_active ? 'bg-blue-500' : 'bg-gray-400'
                    }`}>
                      {initials.toUpperCase()}
                    </div>
                    
                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{getUserDisplayName(user)}</h3>
                        <span className="text-sm text-slate-500">@{user.username}</span>
                        {!user.is_active && (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                            Inactif
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 truncate">{user.email}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {user.roles.map(roleId => {
                          const role = roles.find(r => r.id === roleId)
                          const badgeColors: Record<string, string> = {
                            admin: 'bg-red-100 text-red-800 border-red-200',
                            editor: 'bg-blue-100 text-blue-800 border-blue-200',
                            viewer: 'bg-gray-100 text-gray-800 border-gray-200',
                            student: 'bg-green-100 text-green-800 border-green-200',
                            supervisor: 'bg-purple-100 text-purple-800 border-purple-200',
                            data_manager: 'bg-orange-100 text-orange-800 border-orange-200',
                            geo_analyst: 'bg-cyan-100 text-cyan-800 border-cyan-200',
                          }
                          return (
                            <Badge 
                              key={roleId} 
                              className={`text-xs ${badgeColors[roleId] || 'bg-gray-100 text-gray-800'}`}
                            >
                              {role?.name || roleId}
                            </Badge>
                          )
                        })}
                      </div>
                      {user.last_login_at && (
                        <p className="text-xs text-slate-400 mt-1">
                          Dernière connexion: {new Date(user.last_login_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingUser(user)
                          setShowUserModal(true)
                        }}
                        title="Modifier"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
              
              {users.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Aucun utilisateur trouvé</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles" className="flex-1 overflow-auto">
            <div className="mb-4">
              <Button
                onClick={() => {
                  setEditingRole({
                    id: '',
                    name: '',
                    description: '',
                    permissions: [],
                    is_system: false,
                    created_at: '',
                  })
                  setShowRoleModal(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouveau rôle
              </Button>
            </div>

            <div className="space-y-2">
              {roles.map(role => (
                <div
                  key={role.id}
                  className="border rounded-lg p-4 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{role.name}</h3>
                        {role.is_system && <Badge variant="secondary">Système</Badge>}
                        {role.user_count !== undefined && (
                          <span className="text-xs text-slate-500">
                            ({role.user_count} utilisateur{role.user_count !== 1 ? 's' : ''})
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">{role.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingRole(role)
                          setShowRoleModal(true)
                        }}
                        disabled={role.is_system}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteRole(role.id)}
                        disabled={role.is_system}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map(permId => {
                      const perm = permissions.find(p => p.id === permId)
                      return (
                        <Badge key={permId} variant="secondary" className="text-xs">
                          {perm?.description || permId}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="flex-1 overflow-auto">
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Les permissions sont définies au niveau du code. Utilisez les rôles pour les assigner aux utilisateurs.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {permissionsByResource.map(group => (
                <div key={group.resource} className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 capitalize">{group.resource}</h3>
                  <div className="space-y-2">
                    {group.permissions.map(perm => (
                      <div key={perm.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{perm.action}</p>
                          <p className="text-xs text-slate-500">{perm.description}</p>
                        </div>
                        <Badge variant="outline">{perm.id}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* User Wizard Modal */}
      <UserWizard
        open={showUserModal}
        onClose={() => {
          setShowUserModal(false)
          setEditingUser(null)
        }}
        onSuccess={loadData}
        editUser={editingUser}
        availableRoles={roles.map(r => ({ id: r.id, name: r.name, description: r.description }))}
      />

      {/* Role Edit Modal */}
      {showRoleModal && editingRole && (
        <Dialog open={showRoleModal} onOpenChange={setShowRoleModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRole.id && roles.find(r => r.id === editingRole.id)
                  ? 'Modifier rôle'
                  : 'Nouveau rôle'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {!roles.find(r => r.id === editingRole.id) && (
                <div>
                  <Label>ID (unique)</Label>
                  <Input
                    value={editingRole.id}
                    onChange={e => setEditingRole({ ...editingRole, id: e.target.value })}
                    placeholder="ex: data_analyst"
                  />
                </div>
              )}

              <div>
                <Label>Nom</Label>
                <Input
                  value={editingRole.name}
                  onChange={e => setEditingRole({ ...editingRole, name: e.target.value })}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  value={editingRole.description}
                  onChange={e => setEditingRole({ ...editingRole, description: e.target.value })}
                />
              </div>

              <div>
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-64 overflow-y-auto border rounded p-2">
                  {permissions.map(perm => (
                    <div key={perm.id} className="flex items-start gap-2">
                      <Checkbox
                        checked={editingRole.permissions.includes(perm.id)}
                        onCheckedChange={() => togglePermission(perm.id)}
                      />
                      <div className="flex-1">
                        <Label className="cursor-pointer text-sm">{perm.description || perm.id}</Label>
                        <p className="text-xs text-slate-400">{perm.id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRoleModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveRole} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}
