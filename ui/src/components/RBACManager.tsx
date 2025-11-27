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
import { Users, Shield, Key, Plus, Trash2, Edit, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import {
  usersApi,
  rolesApi,
  permissionsApi,
  type User as ApiUser,
  type Role as ApiRole,
  type Permission as ApiPermission,
  type PermissionsByResource,
} from '@/services/auth-api'

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
    if (open) {
      loadData()
    }
  }, [open, loadData])

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
            <div className="mb-4">
              <Button
                onClick={() => {
                  setEditingUser({
                    id: '',
                    email: '',
                    username: '',
                    roles: [],
                    is_active: true,
                  })
                  setNewUserPassword('')
                  setShowUserModal(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvel utilisateur
              </Button>
            </div>

            <div className="space-y-2">
              {users.map(user => (
                <div
                  key={user.id}
                  className="border rounded-lg p-4 flex items-center justify-between hover:bg-slate-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{getUserDisplayName(user)}</h3>
                      <span className="text-sm text-slate-500">@{user.username}</span>
                      {!user.is_active && <Badge variant="secondary">Inactif</Badge>}
                    </div>
                    <p className="text-sm text-slate-600">{user.email}</p>
                    <div className="flex gap-1 mt-2">
                      {user.roles.map(roleId => {
                        const role = roles.find(r => r.id === roleId)
                        return (
                          <Badge key={roleId} variant="outline">
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
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingUser(user)
                        setShowUserModal(true)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
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

      {/* User Edit Modal */}
      {showUserModal && editingUser && (
        <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser.id ? 'Modifier utilisateur' : 'Nouvel utilisateur'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Username</Label>
                <Input
                  value={editingUser.username}
                  onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                  disabled={!!editingUser.id}
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editingUser.email}
                  onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                />
              </div>

              {!editingUser.id && (
                <div>
                  <Label>Mot de passe</Label>
                  <Input
                    type="password"
                    value={newUserPassword}
                    onChange={e => setNewUserPassword(e.target.value)}
                    placeholder="Min. 8 caractères"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prénom</Label>
                  <Input
                    value={editingUser.first_name || ''}
                    onChange={e => setEditingUser({ ...editingUser, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={editingUser.last_name || ''}
                    onChange={e => setEditingUser({ ...editingUser, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Rôles</Label>
                <div className="space-y-2 mt-2">
                  {roles.map(role => (
                    <div key={role.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={editingUser.roles.includes(role.id)}
                        onCheckedChange={() => toggleUserRole(role.id)}
                      />
                      <Label className="cursor-pointer">{role.name}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingUser.is_active}
                  onCheckedChange={checked =>
                    setEditingUser({ ...editingUser, is_active: checked as boolean })
                  }
                />
                <Label>Actif</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUserModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveUser} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
