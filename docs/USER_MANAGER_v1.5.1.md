	# 👥 User Manager - Atlas Géotechnique v1.5.1

**Statut** : 📋 Spécification  
**Implémentation** : v1.5.1  
**Date** : 2025-10-20

---

## 🎯 Objectif

Système complet de gestion des utilisateurs avec :
- **Rôles** : Viewer, Editor, Admin
- **Authentification** : Sessions sécurisées
- **Audit** : Traçabilité complète
- **Sécurité** : Politique de mots de passe, sessions expirables

---

## 👤 Rôles & Permissions

### Viewer (Lecture seule)

**Permissions** :
- ✅ Voir la carte et les mailles
- ✅ Consulter les sondages
- ✅ Appliquer des cartes thématiques
- ✅ Exporter PNG/PDF (lecture)
- ❌ Créer/modifier des données
- ❌ Gérer les utilisateurs
- ❌ Accès aux configurations système

**Cas d'usage** : Testeurs, consultants externes

### Editor (Édition)

**Permissions** :
- ✅ Toutes les permissions Viewer
- ✅ Créer des sondages
- ✅ Modifier ses propres sondages
- ✅ Créer des configurations thématiques locales
- ✅ Importer des données (CSV/Bulk)
- ✅ Géocoder des sondages
- ❌ Modifier les sondages d'autres utilisateurs
- ❌ Gérer les utilisateurs
- ❌ Refresh MV

**Cas d'usage** : Géotechniciens, ingénieurs de terrain

### Admin (Administration)

**Permissions** :
- ✅ Toutes les permissions Editor
- ✅ Gérer les utilisateurs (CRUD)
- ✅ Modifier tous les sondages
- ✅ Refresh MV manuellement
- ✅ Accès aux logs d'audit
- ✅ Exporter les données complètes
- ✅ Gérer les configurations système
- ✅ Désactiver/activer des comptes

**Cas d'usage** : Administrateurs système, responsables labo

---

## 🗄️ Structure Base de Données

### Table `users` (enrichie)

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('viewer', 'editor', 'admin')),
  
  -- Nouveaux champs
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ DEFAULT NOW(),
  must_change_password BOOLEAN DEFAULT false,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ,
  
  -- Préférences
  preferences JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Index
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;
```

### Table `user_sessions`

```sql
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  
  -- Informations de session
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  
  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
);

-- Index
CREATE INDEX idx_sessions_user ON user_sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_token ON user_sessions(token) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at) WHERE revoked_at IS NULL;

-- Nettoyage automatique des sessions expirées
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions 
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
```

### Table `audit_users`

```sql
CREATE TABLE IF NOT EXISTS audit_users (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  
  -- Détails
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_user_id UUID REFERENCES users(id),
  
  -- Contexte
  ip_address INET,
  user_agent TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Index
CREATE INDEX idx_audit_users_user ON audit_users(user_id);
CREATE INDEX idx_audit_users_action ON audit_users(action);
CREATE INDEX idx_audit_users_created ON audit_users(created_at DESC);
CREATE INDEX idx_audit_users_target ON audit_users(target_user_id);

-- Partitionnement par mois (optionnel, pour gros volumes)
-- CREATE TABLE audit_users_2025_10 PARTITION OF audit_users
-- FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

### Table `password_reset_tokens`

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX idx_reset_tokens_token ON password_reset_tokens(token) WHERE used_at IS NULL;
```

---

## 🔌 API Endpoints

### Authentification

```
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
GET    /auth/me
POST   /auth/change-password
POST   /auth/forgot-password
POST   /auth/reset-password
```

#### POST /auth/login

**Request** :
```json
{
  "username": "john.doe",
  "password": "SecureP@ss123"
}
```

**Response** :
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "john.doe",
    "email": "john@example.com",
    "role": "editor",
    "must_change_password": false
  },
  "expires_at": "2025-10-21T16:00:00Z"
}
```

**Erreurs** :
- `401` : Identifiants invalides
- `403` : Compte désactivé ou verrouillé
- `429` : Trop de tentatives (rate limiting)

#### POST /auth/logout

**Headers** : `Authorization: Bearer <token>`

**Response** :
```json
{
  "message": "Déconnexion réussie"
}
```

### Gestion des Utilisateurs

```
GET    /users              - Liste (Admin)
POST   /users              - Créer (Admin)
GET    /users/:id          - Détails (Admin/Self)
PUT    /users/:id          - Modifier (Admin/Self partiel)
DELETE /users/:id          - Désactiver (Admin)
POST   /users/:id/activate - Réactiver (Admin)
POST   /users/:id/reset    - Réinitialiser mot de passe (Admin)
GET    /users/:id/sessions - Sessions actives (Admin/Self)
DELETE /users/:id/sessions - Révoquer toutes sessions (Admin/Self)
GET    /users/:id/audit    - Historique (Admin)
```

#### GET /users

**Query params** :
- `page` : Numéro de page (défaut: 1)
- `limit` : Résultats par page (défaut: 20, max: 100)
- `role` : Filtrer par rôle
- `is_active` : Filtrer par statut
- `search` : Recherche dans username/email

**Response** :
```json
{
  "users": [
    {
      "id": "uuid",
      "username": "john.doe",
      "email": "john@example.com",
      "role": "editor",
      "is_active": true,
      "last_login": "2025-10-20T14:30:00Z",
      "created_at": "2025-10-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

#### POST /users

**Request** :
```json
{
  "username": "jane.smith",
  "email": "jane@example.com",
  "password": "TempP@ss123",
  "role": "viewer",
  "must_change_password": true
}
```

**Validation** :
- Username : 3-50 caractères, alphanumériques + underscore
- Email : Format valide
- Password : Min 10 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 spécial
- Role : viewer|editor|admin

**Response** :
```json
{
  "id": "uuid",
  "username": "jane.smith",
  "email": "jane@example.com",
  "role": "viewer",
  "must_change_password": true,
  "created_at": "2025-10-20T16:00:00Z"
}
```

#### PUT /users/:id

**Request** (Admin peut tout modifier, Self peut modifier email/password) :
```json
{
  "email": "new.email@example.com",
  "role": "editor",
  "is_active": true
}
```

#### POST /users/:id/reset

**Response** :
```json
{
  "message": "Email de réinitialisation envoyé",
  "token": "reset_token_for_local_use"
}
```

---

## 🎨 Interface Utilisateur

### 1. Page de Connexion

**Éléments** :
- Logo Atlas
- Champs : Username, Password
- Bouton "Se connecter"
- Lien "Mot de passe oublié ?"
- Message d'erreur clair

**Validation** :
- Afficher erreurs en temps réel
- Bloquer après 5 tentatives (15 min)
- Afficher compte verrouillé si applicable

### 2. Panneau User Manager (Admin)

**Layout** :
```
┌─────────────────────────────────────────────────────────┐
│ 👥 Gestion des Utilisateurs                             │
├─────────────────────────────────────────────────────────┤
│ [🔍 Rechercher...] [Rôle ▼] [Statut ▼] [+ Créer]       │
├─────────────────────────────────────────────────────────┤
│ Username    │ Email         │ Rôle   │ Statut │ Actions│
├─────────────┼───────────────┼────────┼────────┼────────┤
│ john.doe    │ john@ex.com   │ Editor │ ✅ Actif│ [⚙️]   │
│ jane.smith  │ jane@ex.com   │ Viewer │ ✅ Actif│ [⚙️]   │
│ admin       │ admin@ex.com  │ Admin  │ ✅ Actif│ [⚙️]   │
└─────────────────────────────────────────────────────────┘
```

**Actions (menu ⚙️)** :
- ✏️ Modifier
- 🔑 Réinitialiser mot de passe
- 🔒 Désactiver/Activer
- 📋 Voir audit
- 🚪 Déconnecter toutes sessions

### 3. Modal Création/Modification

**Champs** :
- Username (requis, unique)
- Email (requis, unique)
- Rôle (select: Viewer, Editor, Admin)
- Mot de passe temporaire (auto-généré)
- ☑️ Forcer changement au premier login

**Validation en temps réel** :
- ✅ Username disponible
- ✅ Email valide et disponible
- ✅ Mot de passe conforme à la politique

### 4. Page Audit (Admin)

**Filtres** :
- Utilisateur
- Action (create, update, delete, login, logout)
- Période (aujourd'hui, 7 jours, 30 jours, personnalisé)

**Tableau** :
```
Date/Heure          │ Utilisateur │ Action  │ Détails           │ IP
────────────────────┼─────────────┼─────────┼───────────────────┼──────────
2025-10-20 16:00:00 │ admin       │ create  │ Créé user: jane   │ 192.168.1.10
2025-10-20 15:30:00 │ john.doe    │ login   │ Connexion réussie │ 192.168.1.20
2025-10-20 14:00:00 │ admin       │ update  │ Rôle: viewer→editor│ 192.168.1.10
```

### 5. Page Mon Profil (Tous)

**Sections** :
- **Informations** : Username, Email, Rôle
- **Sécurité** : Changer mot de passe, Sessions actives
- **Préférences** : Langue, Thème, Notifications
- **Activité** : Dernières connexions

---

## 🔒 Sécurité

### Politique de Mots de Passe

**Règles** :
- Minimum 10 caractères
- Au moins 1 majuscule
- Au moins 1 minuscule
- Au moins 1 chiffre
- Au moins 1 caractère spécial (@$!%*?&)
- Pas dans la liste noire (password, 123456, etc.)
- Pas identique au username

**Implémentation** :
```rust
fn validate_password(password: &str, username: &str) -> Result<(), String> {
    if password.len() < 10 {
        return Err("Minimum 10 caractères".to_string());
    }
    if !password.chars().any(|c| c.is_uppercase()) {
        return Err("Au moins 1 majuscule".to_string());
    }
    if !password.chars().any(|c| c.is_lowercase()) {
        return Err("Au moins 1 minuscule".to_string());
    }
    if !password.chars().any(|c| c.is_numeric()) {
        return Err("Au moins 1 chiffre".to_string());
    }
    if !password.chars().any(|c| "@$!%*?&".contains(c)) {
        return Err("Au moins 1 caractère spécial".to_string());
    }
    if password.to_lowercase() == username.to_lowercase() {
        return Err("Ne peut pas être identique au nom d'utilisateur".to_string());
    }
    
    // Liste noire
    let blacklist = ["password", "123456", "qwerty", "admin"];
    if blacklist.iter().any(|&p| password.to_lowercase().contains(p)) {
        return Err("Mot de passe trop commun".to_string());
    }
    
    Ok(())
}
```

### Sessions

**Configuration** :
- Durée : 12 heures (labo)
- Refresh automatique si activité < 30 min
- Révocation possible par l'admin
- Limite : 3 sessions simultanées par utilisateur

**Token JWT** :
```json
{
  "sub": "user_id",
  "username": "john.doe",
  "role": "editor",
  "exp": 1729526400,
  "iat": 1729483200
}
```

### Rate Limiting

**Règles** :
- Login : 5 tentatives / 15 minutes
- API : 100 requêtes / minute / utilisateur
- Export : 10 / heure / utilisateur

### Audit Trail

**Actions tracées** :
- `user.create` : Création utilisateur
- `user.update` : Modification utilisateur
- `user.delete` : Désactivation utilisateur
- `user.activate` : Réactivation utilisateur
- `user.reset_password` : Réinitialisation mot de passe
- `auth.login` : Connexion
- `auth.logout` : Déconnexion
- `auth.failed_login` : Tentative échouée
- `role.change` : Changement de rôle
- `session.revoke` : Révocation session

**Format** :
```json
{
  "user_id": "uuid",
  "action": "user.update",
  "details": {
    "target_user": "jane.smith",
    "changes": {
      "role": ["viewer", "editor"]
    }
  },
  "ip_address": "192.168.1.10",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2025-10-20T16:00:00Z"
}
```

---

## 📊 Statistiques & Monitoring

### Dashboard Admin

**Métriques** :
- Utilisateurs actifs (aujourd'hui, 7 jours, 30 jours)
- Connexions par jour (graphique)
- Répartition par rôle (pie chart)
- Tentatives de connexion échouées
- Sessions actives

### Alertes

**Déclencheurs** :
- Plus de 10 tentatives échouées en 1 heure
- Création de compte Admin
- Changement de rôle Admin
- Export massif de données

---

## 🚀 Implémentation v1.5.1

### Phase 1 : Backend (Semaine 1)

1. **SQL** : Créer tables + migrations
2. **Auth** : Implémenter login/logout/refresh
3. **CRUD Users** : Endpoints de base
4. **Audit** : Logger toutes les actions

### Phase 2 : Frontend (Semaine 2)

1. **Login Page** : Interface de connexion
2. **User Manager** : Tableau + CRUD
3. **Mon Profil** : Page utilisateur
4. **Audit Viewer** : Historique

### Phase 3 : Sécurité (Semaine 3)

1. **Rate Limiting** : Protection brute-force
2. **Sessions** : Gestion avancée
3. **Password Policy** : Validation stricte
4. **Tests** : Tests d'intégration

---

## ✅ Checklist de Déploiement

### Base de Données
- [ ] Créer tables (users, sessions, audit, reset_tokens)
- [ ] Créer index
- [ ] Créer triggers
- [ ] Créer utilisateur admin initial

### Backend
- [ ] Implémenter endpoints auth
- [ ] Implémenter endpoints users
- [ ] Implémenter middleware auth
- [ ] Implémenter rate limiting
- [ ] Tests unitaires

### Frontend
- [ ] Page de connexion
- [ ] Panneau User Manager
- [ ] Modal création/modification
- [ ] Page Mon Profil
- [ ] Page Audit

### Sécurité
- [ ] HTTPS (certificat)
- [ ] CORS restreint
- [ ] Headers sécurité (CSP, HSTS)
- [ ] Validation inputs
- [ ] Tests de pénétration

---

**Version** : 1.5.1 (spécification)  
**Date** : 2025-10-20  
**Auteur** : Atlas Team
[[GO_LIVE_CHECKLIST]]