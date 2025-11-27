/**
 * Page Atlas Colab Studio
 * Liste des missions terrain avec filtres et création
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Filter,
  RefreshCw,
  MapPin,
  Calendar,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Pause,
  XCircle,
  BarChart3,
} from 'lucide-react';
import {
  missionsApi,
  supervisorsApi,
  MissionListItem,
  MissionFilters,
  SupervisorSummary,
  ColabStats,
  MISSION_THEMES,
  MISSION_STATUSES,
  getStatusLabel,
  getStatusColor,
  getThemeLabel,
  formatDate,
  CreateMissionRequest,
} from '../services/colab-api';
import { tokenStorage } from '../services/auth-api';

// ============================================================================
// Composants UI
// ============================================================================

const Badge: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {children}
  </span>
);

const Button: React.FC<{
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  children: React.ReactNode;
}> = ({ variant = 'primary', size = 'md', disabled, onClick, className = '', type = 'button', children }) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500',
    ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

const Input: React.FC<{
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}> = ({ type = 'text', placeholder, value, onChange, className = '' }) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${className}`}
  />
);

const Select: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, options, placeholder, className = '' }) => (
  <select
    value={value}
    onChange={onChange}
    className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${className}`}
  >
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

// ============================================================================
// Composant Stats Card
// ============================================================================

const StatsCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, icon, color }) => (
  <div className={`rounded-xl p-4 ${color}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium opacity-80">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </div>
      <div className="opacity-80">{icon}</div>
    </div>
  </div>
);

// ============================================================================
// Composant Mission Card
// ============================================================================

const MissionCard: React.FC<{
  mission: MissionListItem;
  onClick: () => void;
}> = ({ mission, onClick }) => {
  const statusIcon = {
    draft: <FileText className="w-4 h-4" />,
    planned: <Clock className="w-4 h-4" />,
    in_progress: <Loader2 className="w-4 h-4 animate-spin" />,
    completed: <CheckCircle2 className="w-4 h-4" />,
    cancelled: <XCircle className="w-4 h-4" />,
    suspended: <Pause className="w-4 h-4" />,
  }[mission.status] || <FileText className="w-4 h-4" />;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-mono text-gray-500">{mission.code}</p>
          <h3 className="font-semibold text-gray-900 mt-1 line-clamp-1">{mission.title}</h3>
        </div>
        <Badge className={getStatusColor(mission.status)}>
          {statusIcon}
          <span className="ml-1">{getStatusLabel(mission.status)}</span>
        </Badge>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>{mission.zone_label || mission.commune || mission.region || 'Non défini'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>
            {mission.start_date ? formatDate(mission.start_date) : 'Non planifié'}
            {mission.end_date && ` → ${formatDate(mission.end_date)}`}
          </span>
        </div>
        {mission.supervisor_name && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span>{mission.supervisor_name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {mission.assigned_students_count} étudiants
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          {mission.linked_sondages_count} sondages
        </span>
        <span className="flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" />
          {mission.documents_count} docs
        </span>
      </div>

      <div className="mt-3 pt-2 border-t border-gray-100">
        <Badge className="bg-purple-100 text-purple-800">{getThemeLabel(mission.theme)}</Badge>
      </div>
    </div>
  );
};

// ============================================================================
// Modal Création Mission
// ============================================================================

const CreateMissionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  supervisors: SupervisorSummary[];
}> = ({ isOpen, onClose, onCreated, supervisors }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateMissionRequest>({
    code: '',
    title: '',
    theme: 'reconnaissance',
    commune: '',
    region: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await missionsApi.create(form);
      onCreated();
      onClose();
      setForm({ code: '', title: '', theme: 'reconnaissance', commune: '', region: '', description: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Nouvelle Mission</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
            <Input
              placeholder="M-2025-LOME-001"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <Input
              placeholder="Mission de reconnaissance..."
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thème *</label>
            <Select
              value={form.theme}
              onChange={e => setForm({ ...form, theme: e.target.value })}
              options={MISSION_THEMES}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commune</label>
              <Input
                placeholder="Lomé"
                value={form.commune || ''}
                onChange={e => setForm({ ...form, commune: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Région</label>
              <Input
                placeholder="Maritime"
                value={form.region || ''}
                onChange={e => setForm({ ...form, region: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Superviseur</label>
            <Select
              value={form.supervisor_id || ''}
              onChange={e => setForm({ ...form, supervisor_id: e.target.value || undefined })}
              options={supervisors.map(s => ({ value: s.id, label: `${s.full_name} - ${s.specialite || 'N/A'}` }))}
              placeholder="Sélectionner un superviseur"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
              <Input
                type="date"
                value={form.start_date || ''}
                onChange={e => setForm({ ...form, start_date: e.target.value || undefined })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
              <Input
                type="date"
                value={form.end_date || ''}
                onChange={e => setForm({ ...form, end_date: e.target.value || undefined })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              placeholder="Description de la mission..."
              value={form.description || ''}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !form.code || !form.title}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer la mission
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// Page Principale
// ============================================================================

const ColabPage: React.FC = () => {
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [stats, setStats] = useState<ColabStats | null>(null);
  const [supervisors, setSupervisors] = useState<SupervisorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filtres
  const [filters, setFilters] = useState<MissionFilters>({
    page: 1,
    per_page: 12,
  });
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Vérifier l'authentification
  const isAuthenticated = !!tokenStorage.getAccessToken();

  const loadData = useCallback(async () => {
    if (!isAuthenticated) {
      setError('Veuillez vous connecter pour accéder à Atlas Colab');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [missionsRes, statsRes, supervisorsRes] = await Promise.all([
        missionsApi.list(filters),
        missionsApi.getStats(),
        supervisorsApi.list(),
      ]);

      setMissions(missionsRes.missions);
      setTotalPages(missionsRes.total_pages);
      setTotal(missionsRes.total);
      setStats(statsRes);
      setSupervisors(supervisorsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [filters, isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = () => {
    setFilters({ ...filters, search: searchInput, page: 1 });
  };

  const handleFilterChange = (key: keyof MissionFilters, value: string) => {
    setFilters({ ...filters, [key]: value || undefined, page: 1 });
  };

  const clearFilters = () => {
    setFilters({ page: 1, per_page: 12 });
    setSearchInput('');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentification requise</h2>
          <p className="text-gray-600">Veuillez vous connecter pour accéder à Atlas Colab Studio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Atlas Colab Studio</h1>
              <p className="text-sm text-gray-500 mt-1">Gestion des missions terrain</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={loadData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle mission
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="Total Missions"
              value={stats.total_missions}
              icon={<BarChart3 className="w-6 h-6" />}
              color="bg-blue-50 text-blue-900"
            />
            <StatsCard
              title="Étudiants"
              value={stats.total_students}
              icon={<Users className="w-6 h-6" />}
              color="bg-green-50 text-green-900"
            />
            <StatsCard
              title="Superviseurs"
              value={stats.total_supervisors}
              icon={<Users className="w-6 h-6" />}
              color="bg-purple-50 text-purple-900"
            />
            <StatsCard
              title="Documents"
              value={stats.total_documents}
              icon={<FileText className="w-6 h-6" />}
              color="bg-orange-50 text-orange-900"
            />
          </div>
        )}

        {/* Search & Filters */}
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par code ou titre..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <Button variant="secondary" onClick={handleSearch}>
                Rechercher
              </Button>
            </div>
            <Button
              variant={showFilters ? 'primary' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtres
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Thème</label>
                <Select
                  value={filters.theme || ''}
                  onChange={e => handleFilterChange('theme', e.target.value)}
                  options={MISSION_THEMES}
                  placeholder="Tous les thèmes"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
                <Select
                  value={filters.status || ''}
                  onChange={e => handleFilterChange('status', e.target.value)}
                  options={MISSION_STATUSES}
                  placeholder="Tous les statuts"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Commune</label>
                <Input
                  placeholder="Filtrer par commune"
                  value={filters.commune || ''}
                  onChange={e => handleFilterChange('commune', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Région</label>
                <Input
                  placeholder="Filtrer par région"
                  value={filters.region || ''}
                  onChange={e => handleFilterChange('region', e.target.value)}
                />
              </div>
              <div className="col-span-2 md:col-span-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Réinitialiser les filtres
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Missions Grid */}
        {!loading && missions.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {missions.map(mission => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onClick={() => {
                    // TODO: Ouvrir le détail de la mission
                    console.log('Mission clicked:', mission.id);
                  }}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between bg-white rounded-xl border p-4">
              <p className="text-sm text-gray-600">
                {total} mission{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page === 1}
                  onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Page {filters.page || 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(filters.page || 1) >= totalPages}
                  onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && missions.length === 0 && !error && (
          <div className="text-center py-12">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune mission trouvée</h3>
            <p className="text-gray-500 mb-4">
              {filters.search || filters.theme || filters.status
                ? 'Essayez de modifier vos filtres'
                : 'Créez votre première mission terrain'}
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Créer une mission
            </Button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateMissionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={loadData}
        supervisors={supervisors}
      />
    </div>
  );
};

export default ColabPage;
