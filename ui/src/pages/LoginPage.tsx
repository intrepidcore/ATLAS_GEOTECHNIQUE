/**
 * Page de connexion unifiée - Atlas
 * 
 * Utilisée pour le Web desktop et la PWA mobile
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MapPin, Lock, Mail, Loader2, AlertCircle, Eye, EyeOff, Database } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: () => void;
  variant?: 'desktop' | 'mobile';
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, variant = 'desktop' }) => {
  const { login, isLoading, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Si déjà authentifié, appeler le callback
  useEffect(() => {
    if (isAuthenticated && onLoginSuccess) {
      onLoginSuccess();
    }
  }, [isAuthenticated, onLoginSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMobile = variant === 'mobile';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex ${isMobile ? 'flex-col bg-gradient-to-br from-blue-600 to-blue-800' : 'items-center justify-center bg-gray-100'}`}>
      {/* Header mobile */}
      {isMobile && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-6">
            <MapPin className="h-10 w-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Atlas Colab</h1>
          <p className="text-blue-200 text-center">Application terrain pour les missions géotechniques</p>
        </div>
      )}

      {/* Formulaire */}
      <div className={isMobile 
        ? 'bg-white rounded-t-3xl p-6 pb-10 shadow-2xl' 
        : 'w-full max-w-md'
      }>
        {/* Card desktop */}
        {!isMobile && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Database className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Atlas Géotechnique</h1>
              <p className="text-gray-500 mt-1">Connectez-vous pour accéder à l'application</p>
            </div>

            <LoginForm
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              error={error}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
            />

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Compte par défaut : <code className="bg-gray-100 px-1 rounded">admin@atlas.local</code>
              </p>
            </div>
          </div>
        )}

        {/* Form mobile */}
        {isMobile && (
          <>
            <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">Connexion</h2>
            <LoginForm
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              error={error}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
            />
            <p className="mt-6 text-center text-sm text-gray-500">
              Contactez votre administrateur si vous n'avez pas de compte
            </p>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Sous-composant formulaire
// ============================================================================

interface LoginFormProps {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  error,
  isSubmitting,
  onSubmit,
}) => (
  <form onSubmit={onSubmit} className="space-y-4">
    {error && (
      <div className="bg-red-50 text-red-700 p-3 rounded-xl flex items-center gap-2">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span className="text-sm">{error}</span>
      </div>
    )}

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@email.com"
          required
          autoComplete="email"
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>

    <button
      type="submit"
      disabled={isSubmitting || !email || !password}
      className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isSubmitting ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Connexion...
        </>
      ) : (
        'Se connecter'
      )}
    </button>
  </form>
);

export default LoginPage;
