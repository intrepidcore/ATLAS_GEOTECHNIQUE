import React, { useState, useEffect } from 'react'
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
import { Users, Shield, Key, Plus, Trash2, Edit, AlertTriangle } from 'lucide-react'

interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  created_at: string
}

interface User {
  id: string
  email: string
  name: string
  roles: string[]
  active: boolean
  last_login?: string
}

interface Permission {
  id: string
  resource: string
  action: string
  description: string
}

interface RBACManagerProps {
  open: boolean
  onClose: () => void
}

const AVAILABLE_PERMISSIONS: Permission[] = [
  { id: 'tables.read', resource: 'tables', action: 'read', description: 'Voir les tables' },
  { id: 'tables.write', resource: 'tables', action: 'write', description: 'Modifier les tables' },
  { id: 'tables.delete', resource: 'tables', action: 'delete', description: 'Supprimer des données' },
  { id: 'staging.create', resource: 'staging', action: 'create', description: 'Créer staging' },
  { id: 'staging.commit', resource: 'staging', action: 'commit', description: 'Commiter staging' },
  { id: 'staging.cancel', resource: 'staging', action: 'cancel', description: 'Annuler staging' },
  { id: 'schema.read', resource: 'schema', action: 'read', description: 'Voir schéma DB' },
  { id: 'schema.modify', resource: 'schema', action: 'modify', description: 'Modifier schéma' },
  { id: 'users.read', resource: 'users', action: 'read', description: 'Voir utilisateurs' },
  { id: 'users.manage', resource: 'users', action: 'manage', description: 'Gérer utilisateurs' },
  { id: 'roles.read', resource: 'roles', action: 'read', description: 'Voir rôles' },
  { id: 'roles.manage', resource: 'roles', action: 'manage', description: 'Gérer rôles' },
  { id: 'audit.read', resource: 'audit', action: 'read', description: 'Voir logs audit' },
  { id: 'backup.create', resource: 'backup', action: 'create', description: 'Créer backups' },
  { id: 'backup.restore', resource: 'backup', action: 'restore', description: 'Restaurer backups' },
]

export const RBACManager: React.FC<RBACManagerProps> = ({ open, onClose }) => {
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)

  // Mock data - à remplacer par API
  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = () => {
    // Mock users
    setUsers([
      {
        id: '1',
        email: 'admin@atlas.com',
        name: 'Admin',
        roles: ['admin'],
        active: true,
        last_login: '2025-11-10T20:00:00Z',
      },
      {
        id: '2',
        email: 'editor@atlas.com',
        name: 'Editor',
        roles: ['editor'],
        active: true,
        last_login: '2025-11-10T19:30:00Z',
      },
      {
        id: '3',
        email: 'viewer@atlas.com',
        name: 'Viewer',
        roles: ['viewer'],
        active: true,
      },
    ])

    // Mock roles
    setRoles([
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Accès complet au système',
        permissions: AVAILABLE_PERMISSIONS.map(p => p.id),
        created_at: '2025-01-01T00:00:00Z',
      },
      {
        id: 'editor',
        name: 'Editor',
        description: 'Peut modifier les données',
        permissions: [
          'tables.read',
          'tables.write',
          'staging.create',
          'staging.commit',
          'staging.cancel',
          'schema.read',
        ],
        created_at: '2025-01-01T00:00:00Z',
      },
      {
        id: 'viewer',
        name: 'Viewer',
        description: 'Lecture seule',
        permissions: ['tables.read', 'schema.read', 'audit.read'],
        created_at: '2025-01-01T00:00:00Z',
      },
    ])
  }

  const handleSaveUser = () => {
    if (editingUser) {
      if (editingUser.id) {
        // Update
        setUsers(users.map(u => (u.id === editingUser.id ? editingUser : u)))
      } else {
        // Create
        setUsers([...users, { ...editingUser, id: Date.now().toString() }])
      }
      setShowUserModal(false)
      setEditingUser(null)
    }
  }

  const handleSaveRole = () => {
    if (editingRole) {
      if (editingRole.id) {
        // Update
        setRoles(roles.map(r => (r.id === editingRole.id ? editingRole : r)))
      } else {
        // Create
        setRoles([
          ...roles,
          { ...editingRole, id: Date.now().toString(), created_at: new Date().toISOString() },
        ])
      }
      setShowRoleModal(false)
      setEditingRole(null)
    }
  }

  const handleDeleteUser = (userId: string) => {
    if (confirm('Supprimer cet utilisateur ?')) {
      setUsers(users.filter(u => u.id !== userId))
    }
  }

  const handleDeleteRole = (roleId: string) => {
    if (confirm('Supprimer ce rôle ?')) {
      setRoles(roles.filter(r => r.id !== roleId))
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestion RBAC - Rôles & Permissions
          </DialogTitle>
        </DialogHeader>

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
              Permissions ({AVAILABLE_PERMISSIONS.length})
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
                    name: '',
                    roles: [],
                    active: true,
                  })
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
                      <h3 className="font-semibold">{user.name}</h3>
                      {!user.active && <Badge variant="secondary">Inactif</Badge>}
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
                    {user.last_login && (
                      <p className="text-xs text-slate-400 mt-1">
                        Dernière connexion: {new Date(user.last_login).toLocaleString()}
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
                      <h3 className="font-semibold">{role.name}</h3>
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
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteRole(role.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map(permId => {
                      const perm = AVAILABLE_PERMISSIONS.find(p => p.id === permId)
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
              {Object.entries(
                AVAILABLE_PERMISSIONS.reduce((acc, perm) => {
                  if (!acc[perm.resource]) acc[perm.resource] = []
                  acc[perm.resource].push(perm)
                  return acc
                }, {} as Record<string, Permission[]>)
              ).map(([resource, perms]) => (
                <div key={resource} className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 capitalize">{resource}</h3>
                  <div className="space-y-2">
                    {perms.map(perm => (
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
                <Label>Nom</Label>
                <Input
                  value={editingUser.name}
                  onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
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
                  checked={editingUser.active}
                  onCheckedChange={checked =>
                    setEditingUser({ ...editingUser, active: checked as boolean })
                  }
                />
                <Label>Actif</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUserModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveUser}>Enregistrer</Button>
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
                {editingRole.id ? 'Modifier rôle' : 'Nouveau rôle'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
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
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-64 overflow-y-auto">
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <div key={perm.id} className="flex items-start gap-2">
                      <Checkbox
                        checked={editingRole.permissions.includes(perm.id)}
                        onCheckedChange={() => togglePermission(perm.id)}
                      />
                      <div className="flex-1">
                        <Label className="cursor-pointer text-sm">{perm.description}</Label>
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
              <Button onClick={handleSaveRole}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}
