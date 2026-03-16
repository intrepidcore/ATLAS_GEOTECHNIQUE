import React from 'react';
import { AlertCircle, BarChart3, FileText, Loader2, Search, Trash2, Users } from 'lucide-react';
import { ColabStats, Student } from '../../../services/colab-api';
import { Badge, Button, Select } from '../ui';
import { StatsCard } from '../cards';

const StudentsTab: React.FC<{
  stats: ColabStats | null;
  error: string | null;
  loading: boolean;

  studentsSearch: string;
  onStudentsSearchChange: (value: string) => void;

  studentsActiveFilter: 'all' | 'active' | 'inactive';
  onStudentsActiveFilterChange: (value: 'all' | 'active' | 'inactive') => void;

  studentsSort: 'promotion_desc' | 'name_asc' | 'name_desc' | 'missions_desc';
  onStudentsSortChange: (value: 'promotion_desc' | 'name_asc' | 'name_desc' | 'missions_desc') => void;

  studentsAuditMode: boolean;
  onStudentsAuditModeChange: (value: boolean) => void;

  studentsIncludeDeleted: boolean;
  onStudentsIncludeDeletedChange: (value: boolean) => void;

  studentsDuplicatesOnly: boolean;
  onStudentsDuplicatesOnlyChange: (value: boolean) => void;

  filteredStudents: Student[];
  total: number;

  duplicatePhones: Set<string>;

  actionLoading: boolean;
  onOpenStudentDetail: (studentId: string) => void;
  onEditStudent: (student: Student) => void;
  onToggleStudentActive: (student: Student) => void;
  onDeleteStudent: (student: Student) => void;
}> = ({
  stats,
  error,
  loading,
  studentsSearch,
  onStudentsSearchChange,
  studentsActiveFilter,
  onStudentsActiveFilterChange,
  studentsSort,
  onStudentsSortChange,
  studentsAuditMode,
  onStudentsAuditModeChange,
  studentsIncludeDeleted,
  onStudentsIncludeDeletedChange,
  studentsDuplicatesOnly,
  onStudentsDuplicatesOnlyChange,
  filteredStudents,
  total,
  duplicatePhones,
  actionLoading,
  onOpenStudentDetail,
  onEditStudent,
  onToggleStudentActive,
  onDeleteStudent,
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
              placeholder="Rechercher (nom, email, tel, promo)..."
              value={studentsSearch}
              onChange={e => onStudentsSearchChange(e.target.value)}
              className="w-full h-10 pl-10 pr-4 border rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select
              value={studentsActiveFilter}
              onChange={e => onStudentsActiveFilterChange(e.target.value as any)}
              options={[
                { value: 'all', label: 'Tous' },
                { value: 'active', label: 'Actifs' },
                { value: 'inactive', label: 'Inactifs' },
              ]}
            />
            <Select
              value={studentsSort}
              onChange={e => onStudentsSortChange(e.target.value as any)}
              options={[
                { value: 'promotion_desc', label: 'Tri: Promotion (desc)' },
                { value: 'name_asc', label: 'Tri: Nom (A→Z)' },
                { value: 'name_desc', label: 'Tri: Nom (Z→A)' },
                { value: 'missions_desc', label: 'Tri: Missions actives (desc)' },
              ]}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-700">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={studentsAuditMode}
              onChange={e => onStudentsAuditModeChange(e.target.checked)}
            />
            Mode audit
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={studentsIncludeDeleted}
              onChange={e => onStudentsIncludeDeletedChange(e.target.checked)}
              disabled={studentsAuditMode}
            />
            Inclure supprimés
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={studentsDuplicatesOnly}
              onChange={e => onStudentsDuplicatesOnlyChange(e.target.checked)}
            />
            Voir doublons uniquement
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b text-sm text-gray-600">
            {filteredStudents.length} affichés / {total} au total
          </div>
          <div className="max-h-[65vh] overflow-auto">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Nom</th>
                    <th className="text-left font-medium px-4 py-3">Email</th>
                    <th className="text-left font-medium px-4 py-3">Téléphone</th>
                    <th className="text-left font-medium px-4 py-3">Promotion</th>
                    <th className="text-left font-medium px-4 py-3">Âge</th>
                    <th className="text-left font-medium px-4 py-3">Missions actives</th>
                    <th className="text-left font-medium px-4 py-3">Mailles actives</th>
                    <th className="text-left font-medium px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(s => (
                    <tr
                      key={s.id}
                      className="border-t cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        onOpenStudentDetail(s.id);
                      }}
                    >
                      <td className="px-4 py-3 text-gray-900">{s.full_name}</td>
                      <td className="px-4 py-3 text-gray-600">{s.email}</td>
                      <td className="px-4 py-3 text-gray-600">{s.telephone || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-2">
                          <span>{s.promotion}</span>
                          <Badge className={s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}>
                            {s.is_active ? 'Actif' : 'Inactif'}
                          </Badge>
                          {!!(s as any).deleted_at && <Badge className="bg-red-50 text-red-700">Supprimé</Badge>}
                          {!!s.telephone && duplicatePhones.has(String(s.telephone)) && (
                            <Badge className="bg-red-50 text-red-700">Doublon téléphone</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.age ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{s.active_missions}</td>
                      <td className="px-4 py-3 text-gray-600">{s.active_mailles}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            onClick={e => {
                              e.stopPropagation();
                            }}
                          >
                            <Button variant="ghost" size="sm" onClick={() => onEditStudent(s)}>
                              Modifier
                            </Button>
                          </span>
                          <span
                            onClick={e => {
                              e.stopPropagation();
                            }}
                          >
                            <Button variant="ghost" size="sm" onClick={() => onToggleStudentActive(s)} disabled={actionLoading}>
                              {s.is_active ? 'Désactiver' : 'Réactiver'}
                            </Button>
                          </span>
                          <span
                            onClick={e => {
                              e.stopPropagation();
                            }}
                          >
                            <Button variant="ghost" size="sm" onClick={() => onDeleteStudent(s)}>
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

            {!loading && filteredStudents.length === 0 && <div className="p-8 text-center text-gray-500">Aucun étudiant</div>}
          </div>
        </div>
      )}
    </>
  );
};

export default StudentsTab;
