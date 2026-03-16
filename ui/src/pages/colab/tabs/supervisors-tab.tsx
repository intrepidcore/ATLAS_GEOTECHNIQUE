import React from 'react';
import { AlertCircle, BarChart3, FileText, Loader2, Search, Trash2, Users } from 'lucide-react';
import { ColabStats, SupervisorSummary } from '../../../services/colab-api';
import { Badge, Button, Select } from '../ui';
import { StatsCard } from '../cards';

const SupervisorsTab: React.FC<{
  stats: ColabStats | null;
  error: string | null;
  loading: boolean;

  supervisorsSearch: string;
  onSupervisorsSearchChange: (value: string) => void;

  supervisorsActiveFilter: 'all' | 'active' | 'inactive';
  onSupervisorsActiveFilterChange: (value: 'all' | 'active' | 'inactive') => void;

  supervisorsSort: 'name_asc' | 'name_desc' | 'institution_asc';
  onSupervisorsSortChange: (value: 'name_asc' | 'name_desc' | 'institution_asc') => void;

  filteredSupervisors: SupervisorSummary[];
  total: number;

  actionLoading: boolean;

  onOpenSupervisorDetail: (supervisorId: string) => void;
  onEditSupervisor: (supervisor: SupervisorSummary) => void;
  onToggleSupervisorActive: (supervisor: SupervisorSummary) => void;
  onDeleteSupervisor: (supervisor: SupervisorSummary) => void;
}> = ({
  stats,
  error,
  loading,
  supervisorsSearch,
  onSupervisorsSearchChange,
  supervisorsActiveFilter,
  onSupervisorsActiveFilterChange,
  supervisorsSort,
  onSupervisorsSortChange,
  filteredSupervisors,
  total,
  actionLoading,
  onOpenSupervisorDetail,
  onEditSupervisor,
  onToggleSupervisorActive,
  onDeleteSupervisor,
}) => {
  return (
    <>
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

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher (nom, institution, spécialité)..."
              value={supervisorsSearch}
              onChange={e => onSupervisorsSearchChange(e.target.value)}
              className="w-full h-10 pl-10 pr-4 border rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select
              value={supervisorsActiveFilter}
              onChange={e => onSupervisorsActiveFilterChange(e.target.value as any)}
              options={[
                { value: 'all', label: 'Tous' },
                { value: 'active', label: 'Actifs' },
                { value: 'inactive', label: 'Inactifs' },
              ]}
            />
            <Select
              value={supervisorsSort}
              onChange={e => onSupervisorsSortChange(e.target.value as any)}
              options={[
                { value: 'name_asc', label: 'Tri: Nom (A→Z)' },
                { value: 'name_desc', label: 'Tri: Nom (Z→A)' },
                { value: 'institution_asc', label: 'Tri: Institution (A→Z)' },
              ]}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b text-sm text-gray-600">
            {filteredSupervisors.length} affichés / {total} au total
          </div>
          <div className="max-h-[65vh] overflow-auto">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Nom</th>
                    <th className="text-left font-medium px-4 py-3">Spécialité</th>
                    <th className="text-left font-medium px-4 py-3">Institution</th>
                    <th className="text-left font-medium px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSupervisors.map(s => (
                    <tr
                      key={s.id}
                      className="border-t cursor-pointer hover:bg-gray-50"
                      onClick={() => onOpenSupervisorDetail(s.id)}
                    >
                      <td className="px-4 py-3 text-gray-900">{s.full_name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-2">
                          <span>{s.specialite || '-'}</span>
                          <Badge className={s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}>
                            {s.is_active ? 'Actif' : 'Inactif'}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.institution || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => onEditSupervisor(s)}>
                              Modifier
                            </Button>
                          </span>
                          <span onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => onToggleSupervisorActive(s)} disabled={actionLoading}>
                              {s.is_active ? 'Désactiver' : 'Réactiver'}
                            </Button>
                          </span>
                          <span onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => onDeleteSupervisor(s)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!loading && filteredSupervisors.length === 0 && <div className="p-8 text-center text-gray-500">Aucun superviseur</div>}
          </div>
        </div>
      )}
    </>
  );
};

export default SupervisorsTab;
