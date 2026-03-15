/**
 * Page Atlas Colab Studio
 * Liste des missions terrain avec filtres et création
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Filter,
  RefreshCw,
  MapPin,
  Calendar,
  Users,
  FileText,
  MoreVertical,
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
  ClipboardList,
  Trash2,
} from 'lucide-react';
import {
  attributionsApi,
  communesApi,
  documentsApi,
  exportsApi,
  maillesApi,
  missionsApi,
  notifyApi,
  studentsApi,
  regionsApi,
  schedulesApi,
  supervisorsApi,
  templatesApi,
  MissionListItem,
  OperationalAction,
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
  UpdateMissionRequest,
  Student,
  CreateStudentRequest,
  UpdateStudentRequest,
  CreateSupervisorRequest,
  UpdateSupervisorRequest,
  CreateStudentResponse,
  CreateSupervisorResponse,
  UserSuggestItem,
  MailleSuggestItem,
  MissionDetail,
  ColabDocument,
  StudentPrefs,
  ExportDataSource,
  ExportFormat,
  ExportJobResponse,
  ExportRequest,
  NotifyJob,
  ExportTemplate,
  CreateExportTemplateRequest,
  ExportSchedule,
  CreateExportScheduleRequest,
  AttributionsSummary,
  AttributionItem,
  AttributionNotificationHistoryItem,
} from '../services/colab-api';
import { tokenStorage } from '../services/auth-api';
import { usersApi } from '../services/auth-api';
import { Badge, Button, CollapsibleCard, Input, Select } from './colab/ui';
import { MissionCard, StatsCard } from './colab/cards';
import MissionDetailModal from './colab/mission-detail-modal';
import CreateMissionModal from './colab/create-mission-modal';
import TransferMissionModal from './colab/transfer-mission-modal';
import StudentDetailModal from './colab/student-detail-modal';
import SupervisorDetailModal from './colab/supervisor-detail-modal';
import UploadDocumentModal from './colab/upload-document-modal';
import { usePermissions } from '../hooks/use-permissions';
import UpdateStudentModal from './colab/update-student-modal';
import UpdateSupervisorModal from './colab/update-supervisor-modal';

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const UpdateStudentPrefsModal: React.FC<{
  isOpen: boolean;
  student: Student | null;
  onClose: () => void;
  onUpdated: () => void;
}> = ({ isOpen, student, onClose, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<StudentPrefs | null>(null);
  const [admCode, setAdmCode] = useState('');

  useEffect(() => {
    if (!isOpen || !student) return;
    setError(null);
    setPrefs(null);
    setAdmCode('');
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const p = await studentsApi.getPrefs(student.id);
        if (cancelled) return;
        setPrefs(p);
        setAdmCode(p.adm_code_pref_1 || '');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Erreur chargement préférences');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, student]);

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Compléter ADM</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!student) return;
            setError(null);
            setLoading(true);
            try {
              await studentsApi.updatePrefs(student.id, {
                adm_code_pref_1: admCode.trim() ? admCode.trim() : '',
              });
              onUpdated();
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Erreur mise à jour');
            } finally {
              setLoading(false);
            }
          }}
          className="p-4 space-y-4"
        >
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="text-sm text-gray-700">
            <div className="font-medium">{student.full_name}</div>
            <div className="text-gray-500">{student.email}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ADM code (préférence 1)</label>
            <Input value={admCode} onChange={e => setAdmCode(e.target.value)} />
            {prefs && (
              <div className="mt-1 text-xs text-gray-500">student_id: <span className="font-mono">{prefs.student_id}</span></div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ConfirmDeactivateModal: React.FC<{
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ isOpen, title, description, confirmLabel = 'Désactiver', loading = false, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 text-sm text-gray-700">{description}</div>
        <div className="p-4 pt-0 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Traitement...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

const CreateStudentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialForm?: Partial<CreateStudentRequest>;
  onCreatedStudent?: (student: UserSuggestItem) => void;
  onOpenExistingStudent?: (studentId: string) => void;
}> = ({ isOpen, onClose, onCreated, onOpenExistingStudent }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateStudentResponse | null>(null);
  const [form, setForm] = useState<CreateStudentRequest>({
    email: '',
    first_name: '',
    last_name: '',
    promotion: '',
  });

  const resetAll = () => {
    setError(null);
    setCreated(null);
    setForm({
      email: '',
      first_name: '',
      last_name: '',
      promotion: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setLoading(true);

    try {
      const res = await studentsApi.create(form);
      setCreated(res);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
      const payload = (err as any)?.payload;
      if (payload?.existing_student_id) {
        // keep payload accessible
        (window as any).__lastCreateStudentErrorPayload = payload;
      }
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
          <h2 className="text-lg font-semibold">Nouvel Étudiant</h2>
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

          {created && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              <div className="font-medium">Compte créé</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div>
                  Mot de passe temporaire: <span className="font-mono">{created.temp_password}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(created.temp_password)}
                >
                  Copier
                </Button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
              <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promotion *</label>
              <Input value={form.promotion} onChange={e => setForm({ ...form, promotion: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matricule</label>
              <Input value={form.matricule || ''} onChange={e => setForm({ ...form, matricule: e.target.value || undefined })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <Input value={form.telephone || ''} onChange={e => setForm({ ...form, telephone: e.target.value || undefined })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Âge</label>
              <Input
                type="number"
                value={typeof form.age === 'number' ? String(form.age) : ''}
                onChange={e => {
                  const v = e.target.value.trim();
                  setForm({ ...form, age: v ? Number(v) : undefined });
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filière</label>
              <Input value={form.filiere || ''} onChange={e => setForm({ ...form, filiere: e.target.value || undefined })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Établissement</label>
              <Input value={form.etablissement || ''} onChange={e => setForm({ ...form, etablissement: e.target.value || undefined })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
            <Input value={form.niveau || ''} onChange={e => setForm({ ...form, niveau: e.target.value || undefined })} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            {created ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetAll();
                    onClose();
                  }}
                >
                  Fermer
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    resetAll();
                  }}
                >
                  Ajouter un autre
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose} disabled={loading}>
                  Fermer
                </Button>
                <Button type="submit" disabled={loading || !form.email || !form.first_name || !form.last_name || !form.promotion}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Créer
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

const CreateSupervisorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}> = ({ isOpen, onClose, onCreated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateSupervisorResponse | null>(null);
  const [form, setForm] = useState<CreateSupervisorRequest>({
    email: '',
    first_name: '',
    last_name: '',
  });

  const resetAll = () => {
    setError(null);
    setCreated(null);
    setForm({
      email: '',
      first_name: '',
      last_name: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setLoading(true);

    try {
      const res = await supervisorsApi.create(form);
      setCreated(res);
      onCreated();
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
          <h2 className="text-lg font-semibold">Nouveau Superviseur</h2>
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

          {created && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              <div className="font-medium">Compte créé</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div>
                  Mot de passe temporaire: <span className="font-mono">{created.temp_password}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(created.temp_password)}
                >
                  Copier
                </Button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
              <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Spécialité</label>
              <Input value={form.specialite || ''} onChange={e => setForm({ ...form, specialite: e.target.value || undefined })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
              <Input value={form.institution || ''} onChange={e => setForm({ ...form, institution: e.target.value || undefined })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
              <Input value={form.departement || ''} onChange={e => setForm({ ...form, departement: e.target.value || undefined })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <Input value={form.telephone || ''} onChange={e => setForm({ ...form, telephone: e.target.value || undefined })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes || ''}
              onChange={e => setForm({ ...form, notes: e.target.value || undefined })}
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            {created ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetAll();
                    onClose();
                  }}
                >
                  Fermer
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    resetAll();
                  }}
                >
                  Ajouter un autre
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose} disabled={loading}>
                  Fermer
                </Button>
                <Button type="submit" disabled={loading || !form.email || !form.first_name || !form.last_name}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Créer
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
// Page Principale
// ============================================================================

const ColabPage: React.FC = () => {
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [stats, setStats] = useState<ColabStats | null>(null);
  const [supervisors, setSupervisors] = useState<SupervisorSummary[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsTotal, setStudentsTotal] = useState<number>(0);
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
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [showCreateSupervisorModal, setShowCreateSupervisorModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'missions' | 'students' | 'supervisors' | 'documents' | 'exports' | 'attributions'>('missions');

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState<SupervisorSummary | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(null);
  const [showStudentDetailModal, setShowStudentDetailModal] = useState(false);
  const [showSupervisorDetailModal, setShowSupervisorDetailModal] = useState(false);
  const [showUpdateStudentModal, setShowUpdateStudentModal] = useState(false);
  const [showUpdateStudentPrefsModal, setShowUpdateStudentPrefsModal] = useState(false);
  const [showUpdateSupervisorModal, setShowUpdateSupervisorModal] = useState(false);
  const [showDeactivateStudentModal, setShowDeactivateStudentModal] = useState(false);
  const [showDeactivateSupervisorModal, setShowDeactivateSupervisorModal] = useState(false);
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
  const [showDeleteSupervisorModal, setShowDeleteSupervisorModal] = useState(false);
  const [showDeleteMissionModal, setShowDeleteMissionModal] = useState(false);
  const [selectedMissionToDelete, setSelectedMissionToDelete] = useState<MissionListItem | null>(null);
  const [showTransferMissionModal, setShowTransferMissionModal] = useState(false);
  const [selectedMissionToTransfer, setSelectedMissionToTransfer] = useState<MissionListItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { can } = usePermissions();
  const canTransferMission = can('colab.missions.reassign');

  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [showMissionDetailModal, setShowMissionDetailModal] = useState(false);
  const [missionDetailDefaultTab, setMissionDetailDefaultTab] = useState<'details' | 'edit'>('details');

  const [documents, setDocuments] = useState<ColabDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentsMissionId, setDocumentsMissionId] = useState<string | null>(null);
  const [documentsType, setDocumentsType] = useState<string>('');
  const [showUploadDocumentModal, setShowUploadDocumentModal] = useState(false);

  const [studentsSearch, setStudentsSearch] = useState('');
  const [studentsActiveFilter, setStudentsActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [studentsSort, setStudentsSort] = useState<'promotion_desc' | 'name_asc' | 'name_desc' | 'missions_desc'>('promotion_desc');

  const [studentsAuditMode, setStudentsAuditMode] = useState(false);
  const [studentsIncludeDeleted, setStudentsIncludeDeleted] = useState(false);
  const [studentsDuplicatesOnly, setStudentsDuplicatesOnly] = useState(false);
  const [duplicatePhones, setDuplicatePhones] = useState<Set<string>>(new Set());

  const [supervisorsSearch, setSupervisorsSearch] = useState('');
  const [supervisorsActiveFilter, setSupervisorsActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [supervisorsSort, setSupervisorsSort] = useState<'name_asc' | 'name_desc' | 'institution_asc'>('name_asc');

  const [documentsSearch, setDocumentsSearch] = useState('');
  const [documentsSort, setDocumentsSort] = useState<'date_desc' | 'date_asc' | 'title_asc'>('date_desc');

  const [filtersCommuneQuery, setFiltersCommuneQuery] = useState('');
  const [filtersCommuneSuggestions, setFiltersCommuneSuggestions] = useState<string[]>([]);
  const [filtersCommuneLoading, setFiltersCommuneLoading] = useState(false);

  const [filtersRegionQuery, setFiltersRegionQuery] = useState('');
  const [filtersRegionSuggestions, setFiltersRegionSuggestions] = useState<string[]>([]);
  const [filtersRegionLoading, setFiltersRegionLoading] = useState(false);

  const [exportSource, setExportSource] = useState<ExportDataSource>('missions');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [exportTemplateId, setExportTemplateId] = useState<string | null>(null);
  const [exportPdfOrientation, setExportPdfOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [exportMissionsPreset, setExportMissionsPreset] = useState<'terrain' | 'encadrement' | 'audit'>('terrain');
  const [exportStudentsPreset, setExportStudentsPreset] = useState<'operational' | 'audit'>('operational');
  const [exportSupervisorsPreset, setExportSupervisorsPreset] = useState<'operational' | 'audit'>('operational');
  const [exportDocumentsPreset, setExportDocumentsPreset] = useState<'operational' | 'audit'>('operational');
  const missionsColumnsAll = useMemo(
    () =>
      [
        { key: 'mission_id', label: 'Mission ID' },
        { key: 'mission_code', label: 'Code mission' },
        { key: 'mission_name', label: 'Nom mission' },
        { key: 'mission_description', label: 'Description' },
        { key: 'mission_type', label: 'Type mission' },
        { key: 'mission_status', label: 'Statut mission' },
        { key: 'maille_code', label: 'Maille (code)' },
        { key: 'bbox_wgs84', label: 'BBox WGS84' },
        { key: 'centroid_wgs84', label: 'Centroid WGS84' },
        { key: 'zone', label: 'Zone' },
        { key: 'localite', label: 'Localité' },
        { key: 'student_name', label: 'Étudiant' },
        { key: 'student_email', label: 'Email étudiant' },
        { key: 'supervisor_name', label: 'Encadrant' },
        { key: 'date_start', label: 'Date de début' },
        { key: 'date_end', label: 'Date limite terrain' },
        { key: 'date_created', label: 'Date création' },
        { key: 'date_updated', label: 'Dernière modification' },
        { key: 'operational_status', label: 'Statut opérationnel' },
        { key: 'operational_reason', label: 'Raison' },
        { key: 'notified', label: 'Notifiée' },
        { key: 'conflict', label: 'Conflit maille' },
        { key: 'conflict_mission_id', label: 'Mission concurrente' },
        { key: 'conflict_holder_name', label: 'Titulaire conflit' },
        { key: 'data_source', label: 'Source données' },
        { key: 'tool_version', label: 'Version outil' },
      ] as const,
    [],
  );

  const studentsColumnsAll = useMemo(
    () =>
      [
        { key: 'student_id', label: 'Student ID' },
        { key: 'user_id', label: 'User ID' },
        { key: 'username', label: 'Username' },
        { key: 'full_name', label: 'Nom complet' },
        { key: 'email', label: 'Email' },
        { key: 'telephone', label: 'Téléphone' },
        { key: 'matricule', label: 'Matricule' },
        { key: 'promotion', label: 'Promotion' },
        { key: 'filiere', label: 'Filière' },
        { key: 'etablissement', label: 'Établissement' },
        { key: 'niveau', label: 'Niveau' },
        { key: 'age', label: 'Âge' },
        { key: 'active_missions', label: 'Missions actives' },
        { key: 'active_mailles', label: 'Mailles actives' },
        { key: 'is_active', label: 'Actif' },
        { key: 'data_source', label: 'Source données' },
        { key: 'tool_version', label: 'Version outil' },
      ] as const,
    [],
  );

  const supervisorsColumnsAll = useMemo(
    () =>
      [
        { key: 'supervisor_id', label: 'Supervisor ID' },
        { key: 'user_id', label: 'User ID' },
        { key: 'username', label: 'Username' },
        { key: 'full_name', label: 'Nom' },
        { key: 'specialite', label: 'Spécialité' },
        { key: 'institution', label: 'Institution' },
        { key: 'is_active', label: 'Actif' },
        { key: 'data_source', label: 'Source données' },
        { key: 'tool_version', label: 'Version outil' },
      ] as const,
    [],
  );

  const documentsColumnsAll = useMemo(
    () =>
      [
        { key: 'document_id', label: 'Document ID' },
        { key: 'mission_id', label: 'Mission ID' },
        { key: 'uploaded_by', label: 'Uploadé par' },
        { key: 'title', label: 'Titre' },
        { key: 'document_type', label: 'Type' },
        { key: 'description', label: 'Description' },
        { key: 'file_name', label: 'Fichier' },
        { key: 'file_size_bytes', label: 'Taille (bytes)' },
        { key: 'mime_type', label: 'MIME' },
        { key: 'sondage_id', label: 'Sondage ID' },
        { key: 'version', label: 'Version' },
        { key: 'is_current', label: 'Courant' },
        { key: 'uploaded_at', label: 'Uploadé le' },
        { key: 'data_source', label: 'Source données' },
        { key: 'tool_version', label: 'Version outil' },
      ] as const,
    [],
  );

  const missionsPresets = useMemo<Record<'terrain' | 'encadrement' | 'audit', string[]>>(
    () => ({
      terrain: [
        'mission_id',
        'mission_name',
        'maille_code',
        'centroid_wgs84',
        'zone',
        'localite',
        'student_name',
        'student_email',
        'date_start',
        'date_end',
        'operational_status',
        'operational_reason',
      ],
      encadrement: [
        'mission_id',
        'mission_name',
        'mission_type',
        'maille_code',
        'student_name',
        'supervisor_name',
        'operational_status',
        'operational_reason',
        'date_created',
        'date_updated',
        'notified',
        'conflict',
        'conflict_mission_id',
      ],
      audit: [
        'mission_id',
        'mission_name',
        'mission_description',
        'zone',
        'maille_code',
        'student_name',
        'supervisor_name',
        'date_created',
        'date_start',
        'mission_status',
        'operational_reason',
        'data_source',
        'tool_version',
      ],
    }),
    [],
  );

  const studentsPresets = useMemo<Record<'operational' | 'audit', string[]>>(
    () => ({
      operational: ['student_id', 'full_name', 'email', 'matricule', 'promotion', 'active_missions', 'active_mailles', 'is_active'],
      audit: ['student_id', 'user_id', 'username', 'full_name', 'email', 'telephone', 'matricule', 'promotion', 'data_source', 'tool_version'],
    }),
    [],
  );

  const supervisorsPresets = useMemo<Record<'operational' | 'audit', string[]>>(
    () => ({
      operational: ['supervisor_id', 'full_name', 'institution', 'specialite', 'is_active'],
      audit: ['supervisor_id', 'user_id', 'username', 'full_name', 'institution', 'specialite', 'data_source', 'tool_version'],
    }),
    [],
  );

  const documentsPresets = useMemo<Record<'operational' | 'audit', string[]>>(
    () => ({
      operational: ['document_id', 'mission_id', 'title', 'document_type', 'file_name', 'uploaded_at', 'is_current'],
      audit: [
        'document_id',
        'mission_id',
        'title',
        'document_type',
        'description',
        'file_name',
        'file_size_bytes',
        'mime_type',
        'version',
        'is_current',
        'uploaded_at',
        'uploaded_by',
        'data_source',
        'tool_version',
      ],
    }),
    [],
  );

  const [exportMissionsColumns, setExportMissionsColumns] = useState<string[]>(() => [...missionsPresets.terrain]);
  const [exportStudentsColumns, setExportStudentsColumns] = useState<string[]>(() => [...studentsPresets.operational]);
  const [exportSupervisorsColumns, setExportSupervisorsColumns] = useState<string[]>(() => [...supervisorsPresets.operational]);
  const [exportDocumentsColumns, setExportDocumentsColumns] = useState<string[]>(() => [...documentsPresets.operational]);

  useEffect(() => {
    if (exportSource !== 'missions') return;
    setExportMissionsColumns([...missionsPresets[exportMissionsPreset]]);
  }, [exportSource, exportMissionsPreset, missionsPresets]);

  useEffect(() => {
    if (exportSource !== 'students') return;
    setExportStudentsColumns([...studentsPresets[exportStudentsPreset]]);
  }, [exportSource, exportStudentsPreset, studentsPresets]);

  useEffect(() => {
    if (exportSource !== 'supervisors') return;
    setExportSupervisorsColumns([...supervisorsPresets[exportSupervisorsPreset]]);
  }, [exportSource, exportSupervisorsPreset, supervisorsPresets]);

  useEffect(() => {
    if (exportSource !== 'documents') return;
    setExportDocumentsColumns([...documentsPresets[exportDocumentsPreset]]);
  }, [exportSource, exportDocumentsPreset, documentsPresets]);

  const [exportRunningJobId, setExportRunningJobId] = useState<string | null>(null);
  const [exportJobs, setExportJobs] = useState<ExportJobResponse[]>([]);
  const [exportJobsLoading, setExportJobsLoading] = useState(false);
  const [exportJobsError, setExportJobsError] = useState<string | null>(null);

  const [notifyJobs, setNotifyJobs] = useState<NotifyJob[]>([]);
  const [notifyJobsLoading, setNotifyJobsLoading] = useState(false);
  const [notifyJobsError, setNotifyJobsError] = useState<string | null>(null);

  const [attrNotice, setAttrNotice] = useState<string | null>(null);

  const [attrAssignOpen, setAttrAssignOpen] = useState(false);
  const [attrAssignMission, setAttrAssignMission] = useState<AttributionItem | null>(null);
  const [attrAssignStudentQuery, setAttrAssignStudentQuery] = useState('');
  const [attrAssignStudents, setAttrAssignStudents] = useState<UserSuggestItem[]>([]);
  const [attrAssignSelectedStudentId, setAttrAssignSelectedStudentId] = useState<string>('');
  const [attrAssignLoading, setAttrAssignLoading] = useState(false);
  const [attrAssignError, setAttrAssignError] = useState<string | null>(null);
  const [attrAssignMode, setAttrAssignMode] = useState<'assign_student' | 'change_student' | 'assign_holder'>('assign_student');

  const [takeoverOpen, setTakeoverOpen] = useState(false);
  const [takeoverMission, setTakeoverMission] = useState<MissionListItem | null>(null);
  const [takeoverPayload, setTakeoverPayload] = useState<any>(null);
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const [takeoverError, setTakeoverError] = useState<string | null>(null);

  const [exportTemplates, setExportTemplates] = useState<ExportTemplate[]>([]);
  const [exportTemplatesLoading, setExportTemplatesLoading] = useState(false);
  const [exportTemplatesError, setExportTemplatesError] = useState<string | null>(null);
  const [createTemplateLoading, setCreateTemplateLoading] = useState(false);
  const [createTemplateError, setCreateTemplateError] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState<CreateExportTemplateRequest>({
    name: '',
    description: '',
    source: 'missions',
    format: 'csv',
    template_sql: '',
    template_handlebars: '',
  });

  const [exportSchedules, setExportSchedules] = useState<ExportSchedule[]>([]);
  const [exportSchedulesLoading, setExportSchedulesLoading] = useState(false);
  const [exportSchedulesError, setExportSchedulesError] = useState<string | null>(null);
  const [createScheduleLoading, setCreateScheduleLoading] = useState(false);
  const [createScheduleError, setCreateScheduleError] = useState<string | null>(null);
  const [newSchedule, setNewSchedule] = useState<CreateExportScheduleRequest>({
    name: '',
    description: '',
    source: 'missions',
    format: 'csv',
    template_id: null,
    cron: '0 8 * * *',
    timezone: 'UTC',
    destinations: [],
    filters: {},
  });

  const [attrSummary, setAttrSummary] = useState<AttributionsSummary | null>(null);
  const [attrItems, setAttrItems] = useState<AttributionItem[]>([]);
  const [attrLoading, setAttrLoading] = useState(false);
  const [attrError, setAttrError] = useState<string | null>(null);
  const [attrStudentFilter, setAttrStudentFilter] = useState('');
  const [attrNotifStatusFilter, setAttrNotifStatusFilter] = useState<string>('');
  const [attrSelected, setAttrSelected] = useState<Record<string, boolean>>({});
  const [attrConfirmOpen, setAttrConfirmOpen] = useState(false);
  const [attrIncludeBbox, setAttrIncludeBbox] = useState(true);
  const [attrIncludeInstructions, setAttrIncludeInstructions] = useState(true);
  const [attrEnqueueLoading, setAttrEnqueueLoading] = useState(false);
  const [attrEnqueueError, setAttrEnqueueError] = useState<string | null>(null);
  const [attrHistory, setAttrHistory] = useState<AttributionNotificationHistoryItem[]>([]);
  const [attrHistoryLoading, setAttrHistoryLoading] = useState(false);
  const [attrHistoryError, setAttrHistoryError] = useState<string | null>(null);

  const effectiveTotal = total || (activeTab === 'documents' ? documents.length : 0);

  // Vérifier l'authentification
  const isAuthenticated = !!tokenStorage.getAccessToken();

  const openExistingStudent = useCallback(
    async (studentId: string) => {
      try {
        const s = await studentsApi.get(studentId);
        setSelectedStudent(s);
        setShowUpdateStudentModal(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur chargement étudiant');
      }
    },
    [setSelectedStudent, setShowUpdateStudentModal],
  );

  const loadData = useCallback(async () => {
    if (!isAuthenticated) {
      setError('Veuillez vous connecter pour accéder à Atlas Colab');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (activeTab === 'missions') {
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
      } else if (activeTab === 'students') {
        const [studentsRes, statsRes, duplicatesRes] = await Promise.all([
          studentsApi.list({
            audit_mode: studentsAuditMode || undefined,
            include_deleted: (!studentsAuditMode && studentsIncludeDeleted) || undefined,
            include_inactive: studentsAuditMode || undefined,
          }),
          missionsApi.getStats(),
          studentsApi.listDuplicates().catch(() => []),
        ]);
        setStudents(studentsRes.students);
        setTotal(studentsRes.total);
        setStudentsTotal(studentsRes.total);
        setStats(statsRes);

        const phones = new Set<string>();
        for (const g of duplicatesRes) {
          if (g?.telephone) phones.add(String(g.telephone));
        }
        setDuplicatePhones(phones);
      } else if (activeTab === 'supervisors') {
        const [supervisorsRes, statsRes] = await Promise.all([
          supervisorsApi.list(),
          missionsApi.getStats(),
        ]);
        setSupervisors(supervisorsRes);
        setTotal(supervisorsRes.length);
        setStats(statsRes);
      } else if (activeTab === 'documents') {
        const [statsRes, docsRes] = await Promise.all([
          missionsApi.getStats(),
          documentsApi.list({
            mission_id: documentsMissionId || undefined,
            document_type: documentsType || undefined,
          }),
        ]);
        setStats(statsRes);
        setDocuments(docsRes.documents);
        setTotal(docsRes.total);
      } else if (activeTab === 'exports') {
        const [statsRes, historyRes, schedulesRes] = await Promise.all([
          missionsApi.getStats(),
          exportsApi.history(),
          schedulesApi.list({ include_inactive: true, limit: 200 }).catch(() => ({ schedules: [], total: 0 })),
        ]);
        setStats(statsRes);
        setExportJobs(historyRes);
        setExportSchedules(schedulesRes.schedules || []);

        try {
          setExportTemplatesError(null);
          const templatesRes = await templatesApi.list({ include_inactive: true });
          setExportTemplates(templatesRes.templates);
        } catch (e) {
          setExportTemplatesError(e instanceof Error ? e.message : 'Erreur chargement templates');
        }
      } else if (activeTab === 'attributions') {
        setAttrLoading(true);
        setAttrError(null);
        try {
          const [summaryRes, listRes, historyRes, notifyRes] = await Promise.all([
            attributionsApi.summary(),
            attributionsApi.list({
              student: attrStudentFilter.trim() || undefined,
              notif_status: attrNotifStatusFilter || undefined,
              limit: 500,
            }),
            attributionsApi.history().catch(() => ({ items: [], total: 0 })),
            notifyApi.list(50).catch(() => ({ jobs: [] })),
          ]);
          setAttrSummary(summaryRes);
          setAttrItems(listRes.items);
          setAttrHistory(historyRes.items || []);
          setNotifyJobs(notifyRes.jobs || []);
        } catch (e) {
          setAttrError(e instanceof Error ? e.message : 'Erreur chargement');
        } finally {
          setAttrLoading(false);
        }
      } else {
        const statsRes = await missionsApi.getStats();
        setStats(statsRes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [
    filters,
    isAuthenticated,
    activeTab,
    documentsMissionId,
    documentsType,
    attrStudentFilter,
    attrNotifStatusFilter,
    studentsAuditMode,
    studentsIncludeDeleted,
  ]);

  const studentsKpiValue = useMemo(() => {
    if (activeTab === 'students') return studentsTotal;
    return stats?.total_students ?? 0;
  }, [activeTab, studentsTotal, stats?.total_students]);

  useEffect(() => {
    if (activeTab !== 'exports' || !exportRunningJobId) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const job = await exportsApi.getJob(exportRunningJobId);
        if (cancelled) return;
        setExportJobs(prev => {
          const next = [...prev];
          const idx = next.findIndex(j => j.job_id === job.job_id);
          if (idx >= 0) next[idx] = job;
          else next.unshift(job);
          return next;
        });

        if (job.status === 'completed' || job.status === 'failed') {
          setExportRunningJobId(null);
        }
      } catch {
        if (cancelled) return;
      }
    };

    tick();
    const id = window.setInterval(tick, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeTab, exportRunningJobId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = () => {
    setFilters({ ...filters, search: searchInput, page: 1 });
  };

  useEffect(() => {
    if (activeTab !== 'missions') return;
    const q = searchInput;
    const id = window.setTimeout(() => {
      setFilters(prev => ({ ...prev, search: q, page: 1 }));
    }, 300);
    return () => window.clearTimeout(id);
  }, [activeTab, searchInput]);

  useEffect(() => {
    setFiltersCommuneQuery(filters.commune || '');
  }, [filters.commune]);

  useEffect(() => {
    setFiltersRegionQuery(filters.region || '');
  }, [filters.region]);

  useEffect(() => {
    let cancelled = false;
    const q = filtersCommuneQuery.trim();
    if (!showFilters) return;
    if (q.length < 2) {
      setFiltersCommuneSuggestions([]);
      return;
    }
    setFiltersCommuneLoading(true);
    communesApi
      .suggest(q)
      .then((res: string[]) => {
        if (!cancelled) setFiltersCommuneSuggestions(res);
      })
      .catch(() => {
        if (!cancelled) setFiltersCommuneSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setFiltersCommuneLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filtersCommuneQuery, showFilters]);

  useEffect(() => {
    let cancelled = false;
    const q = filtersRegionQuery.trim();
    if (!showFilters) return;
    if (q.length < 2) {
      setFiltersRegionSuggestions([]);
      return;
    }
    setFiltersRegionLoading(true);
    regionsApi
      .suggest(q)
      .then((res: string[]) => {
        if (!cancelled) setFiltersRegionSuggestions(res);
      })
      .catch(() => {
        if (!cancelled) setFiltersRegionSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setFiltersRegionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filtersRegionQuery, showFilters]);

  const handleFilterChange = (key: keyof MissionFilters, value: string) => {
    setFilters({ ...filters, [key]: value || undefined, page: 1 });
  };

  const clearFilters = () => {
    setFilters({ page: 1, per_page: 12 });
    setSearchInput('');
  };

  const filteredStudents = useMemo(() => {
    const q = studentsSearch.trim().toLowerCase();
    let items = students;

    if (studentsActiveFilter !== 'all') {
      items = items.filter(s => (studentsActiveFilter === 'active' ? s.is_active : !s.is_active));
    }
    if (q) {
      items = items.filter(s => {
        const name = (s.full_name || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        const tel = (s.telephone || '').toLowerCase();
        const promo = (s.promotion || '').toLowerCase();
        return name.includes(q) || email.includes(q) || tel.includes(q) || promo.includes(q);
      });
    }

    if (studentsDuplicatesOnly) {
      items = items.filter(s => !!s.telephone && duplicatePhones.has(String(s.telephone)));
    }

    const sorted = [...items];
    sorted.sort((a, b) => {
      if (studentsSort === 'name_asc') return (a.full_name || '').localeCompare(b.full_name || '');
      if (studentsSort === 'name_desc') return (b.full_name || '').localeCompare(a.full_name || '');
      if (studentsSort === 'missions_desc') return (b.active_missions || 0) - (a.active_missions || 0);
      return (b.promotion || '').localeCompare(a.promotion || '');
    });
    return sorted;
  }, [students, studentsSearch, studentsActiveFilter, studentsSort, studentsDuplicatesOnly, duplicatePhones]);

  const filteredSupervisors = useMemo(() => {
    const q = supervisorsSearch.trim().toLowerCase();
    let items = supervisors;

    if (supervisorsActiveFilter !== 'all') {
      items = items.filter(s => (supervisorsActiveFilter === 'active' ? s.is_active : !s.is_active));
    }
    if (q) {
      items = items.filter(s => {
        const name = (s.full_name || '').toLowerCase();
        const institution = (s.institution || '').toLowerCase();
        const spec = (s.specialite || '').toLowerCase();
        return name.includes(q) || institution.includes(q) || spec.includes(q);
      });
    }

    const sorted = [...items];
    sorted.sort((a, b) => {
      if (supervisorsSort === 'name_desc') return (b.full_name || '').localeCompare(a.full_name || '');
      if (supervisorsSort === 'institution_asc') return (a.institution || '').localeCompare(b.institution || '');
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
    return sorted;
  }, [supervisors, supervisorsSearch, supervisorsActiveFilter, supervisorsSort]);

  const filteredDocuments = useMemo(() => {
    const q = documentsSearch.trim().toLowerCase();
    let items = documents;

    if (q) {
      items = items.filter(d => {
        const title = (d.title || '').toLowerCase();
        const file = (d.file_name || '').toLowerCase();
        const type = (d.document_type || '').toLowerCase();
        return title.includes(q) || file.includes(q) || type.includes(q);
      });
    }

    const sorted = [...items];
    sorted.sort((a, b) => {
      if (documentsSort === 'title_asc') return (a.title || '').localeCompare(b.title || '');
      if (documentsSort === 'date_asc') return String(a.uploaded_at || '').localeCompare(String(b.uploaded_at || ''));
      return String(b.uploaded_at || '').localeCompare(String(a.uploaded_at || ''));
    });
    return sorted;
  }, [documents, documentsSearch, documentsSort]);

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
              <p className="text-sm text-gray-500 mt-1">Gestion des missions terrain & partage de connaissances</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={loadData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>

              <div className="relative">
                <Button onClick={() => setShowActionMenu(v => !v)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau
                </Button>

                {showActionMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border rounded-xl shadow-lg overflow-hidden z-20">
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        setShowActionMenu(false);
                        setShowCreateModal(true);
                      }}
                    >
                      Nouvelle mission
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        setShowActionMenu(false);
                        setShowCreateStudentModal(true);
                      }}
                    >
                      Nouvel étudiant
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        setShowActionMenu(false);
                        setShowCreateSupervisorModal(true);
                      }}
                    >
                      Nouveau superviseur
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        setShowActionMenu(false);
                        setActiveTab('documents');
                        setShowUploadDocumentModal(true);
                      }}
                    >
                      Uploader un document
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-400 cursor-not-allowed"
                      disabled
                    >
                      Nouveau document (bientôt)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Onglets */}
          <div className="flex gap-1 mt-4 -mb-4">
            <button
              onClick={() => setActiveTab('missions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'missions'
                  ? 'bg-gray-50 text-blue-600 border-t border-x border-gray-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Missions
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'students'
                  ? 'bg-gray-50 text-blue-600 border-t border-x border-gray-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4" />
              Étudiants
            </button>
            <button
              onClick={() => setActiveTab('supervisors')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'supervisors'
                  ? 'bg-gray-50 text-blue-600 border-t border-x border-gray-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4" />
              Superviseurs
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'documents'
                  ? 'bg-gray-50 text-blue-600 border-t border-x border-gray-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Documents
            </button>
            <button
              onClick={() => setActiveTab('exports')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'exports'
                  ? 'bg-gray-50 text-blue-600 border-t border-x border-gray-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Exports
            </button>
            <button
              onClick={() => setActiveTab('attributions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'attributions'
                  ? 'bg-gray-50 text-blue-600 border-t border-x border-gray-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4" />
              Attributions & Notifications
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Contenu selon l'onglet actif */}
        {activeTab === 'missions' && (
          <>
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
                  value={studentsKpiValue}
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
                      placeholder="Rechercher (titre, code maille, thème, opérateur...)"
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
                    <div className="relative">
                      <Input
                        placeholder="Filtrer par commune"
                        value={filtersCommuneQuery}
                        onChange={e => {
                          const v = e.target.value;
                          setFiltersCommuneQuery(v);
                          handleFilterChange('commune', v);
                        }}
                      />
                      {filtersCommuneLoading && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      )}
                      {filtersCommuneSuggestions.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-lg shadow max-h-48 overflow-auto">
                          {filtersCommuneSuggestions.slice(0, 20).map(c => (
                            <button
                              key={c}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={() => {
                                setFiltersCommuneQuery(c);
                                handleFilterChange('commune', c);
                                setFiltersCommuneSuggestions([]);
                              }}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Région</label>
                    <div className="relative">
                      <Input
                        placeholder="Filtrer par région"
                        value={filtersRegionQuery}
                        onChange={e => {
                          const v = e.target.value;
                          setFiltersRegionQuery(v);
                          handleFilterChange('region', v);
                        }}
                      />
                      {filtersRegionLoading && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      )}
                      {filtersRegionSuggestions.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-lg shadow max-h-48 overflow-auto">
                          {filtersRegionSuggestions.slice(0, 20).map(r => (
                            <button
                              key={r}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={() => {
                                setFiltersRegionQuery(r);
                                handleFilterChange('region', r);
                                setFiltersRegionSuggestions([]);
                              }}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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
                        setSelectedMissionId(mission.id);
                        setShowMissionDetailModal(true);
                      }}
                      onOperationalAction={async (m, action) => {
                        const kind = action?.payload?.action;

                        if (kind === 'edit_student_matricule' && action.payload?.student_id) {
                          try {
                            const s = await studentsApi.get(action.payload.student_id);
                            setSelectedStudent(s);
                            setShowUpdateStudentModal(true);
                            return;
                          } catch {
                            setSelectedMissionId(m.id);
                            setMissionDetailDefaultTab('details');
                            setShowMissionDetailModal(true);
                            return;
                          }
                        }

                        if (kind === 'edit_student_adm' && action.payload?.student_id) {
                          try {
                            const s = await studentsApi.get(action.payload.student_id);
                            setSelectedStudent(s);
                            setShowUpdateStudentPrefsModal(true);
                            return;
                          } catch {
                            setSelectedMissionId(m.id);
                            setMissionDetailDefaultTab('details');
                            setShowMissionDetailModal(true);
                            return;
                          }
                        }

                        if (kind === 'edit_mission_maille' || kind === 'change_maille') {
                          setSelectedMissionId(m.id);
                          setMissionDetailDefaultTab('edit');
                          setShowMissionDetailModal(true);
                          return;
                        }

                        if (kind === 'assign_student' || kind === 'change_student' || kind === 'assign_holder') {
                          setAttrAssignError(null);
                          setAttrAssignStudentQuery('');
                          setAttrAssignStudents([]);
                          setAttrAssignSelectedStudentId('');
                          setAttrAssignMode(kind);
                          setAttrAssignMission({
                            mission_id: m.id,
                            mission_code: m.code,
                            maille_id: (action.payload?.maille_id as string) || (m as any).maille_id || '',
                            maille_code: (action.payload?.maille_code as string) || (m as any).zone_label || (m as any).maille_id || '-',
                          } as AttributionItem);

                          if (kind === 'assign_holder' && action.payload?.student_id) {
                            try {
                              const s = await studentsApi.get(action.payload.student_id);
                              setAttrAssignSelectedStudentId(s.id);
                              setAttrAssignStudentQuery(`${s.full_name}${s.promotion ? ` (${s.promotion})` : ''}`);
                            } catch {
                              // ignore prefill errors
                            }
                          }
                          setAttrAssignOpen(true);
                          return;
                        }

                        if (kind === 'takeover') {
                          setTakeoverError(null);
                          setTakeoverMission(m);
                          setTakeoverPayload(action.payload);
                          setTakeoverOpen(true);
                          return;
                        }

                        setSelectedMissionId(m.id);
                        setMissionDetailDefaultTab('details');
                        setShowMissionDetailModal(true);
                      }}
                      onEdit={() => {
                        setSelectedMissionId(mission.id);
                        setMissionDetailDefaultTab('edit');
                        setShowMissionDetailModal(true);
                      }}
                      onTransfer={
                        canTransferMission
                          ? () => {
                              setSelectedMissionToTransfer(mission);
                              setShowTransferMissionModal(true);
                            }
                          : undefined
                      }
                      onDelete={() => {
                        setSelectedMissionToDelete(mission);
                        setShowDeleteMissionModal(true);
                      }}
                    />
                  ))}
                </div>

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

          </>
        )}

        {activeTab === 'exports' && (
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

            {(exportJobsError || exportTemplatesError || exportSchedulesError || createTemplateError || createScheduleError) && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                <span>
                  {exportJobsError || exportTemplatesError || exportSchedulesError || createTemplateError || createScheduleError}
                </span>
              </div>
            )}

            <div className="bg-white rounded-xl border p-4 mb-6">
              <div className="text-lg font-semibold text-gray-900 mb-4">Exporter des données</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Source</div>
                  <select
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    value={exportSource}
                    onChange={e => setExportSource(e.target.value as any)}
                  >
                    <option value="missions">Missions</option>
                    <option value="students">Étudiants</option>
                    <option value="supervisors">Superviseurs</option>
                    <option value="documents">Documents</option>
                  </select>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Format</div>
                  <select
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    value={exportFormat}
                    onChange={e => setExportFormat(e.target.value as any)}
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="xlsx">XLSX</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>

                {exportFormat === 'pdf' && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Orientation</div>
                    <select
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      value={exportPdfOrientation}
                      onChange={e => setExportPdfOrientation(e.target.value as any)}
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Paysage</option>
                    </select>
                  </div>
                )}

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Template (optionnel)</div>
                  <select
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    value={exportTemplateId || ''}
                    onChange={e => setExportTemplateId(e.target.value || null)}
                    disabled={exportTemplatesLoading}
                  >
                    <option value="">Aucun</option>
                    {exportTemplates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.source}/{t.format})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end justify-end">
                  <Button
                    onClick={async () => {
                      setExportJobsError(null);
                      setExportJobsLoading(true);
                      try {
                        const job = await exportsApi.create({
                          source: exportSource,
                          format: exportFormat,
                          filters: {},
                          template_id: exportTemplateId,
                          columns:
                            exportSource === 'missions'
                              ? exportMissionsColumns
                              : exportSource === 'students'
                                ? exportStudentsColumns
                                : exportSource === 'supervisors'
                                  ? exportSupervisorsColumns
                                  : exportSource === 'documents'
                                    ? exportDocumentsColumns
                                    : null,
                          pdf_options: exportFormat === 'pdf' ? { orientation: exportPdfOrientation } : null,
                        });
                        setExportJobs(prev => [job, ...prev]);
                        setExportRunningJobId(job.job_id);
                      } catch (e) {
                        setExportJobsError(e instanceof Error ? e.message : 'Erreur export');
                      } finally {
                        setExportJobsLoading(false);
                      }
                    }}
                    disabled={exportJobsLoading}
                  >
                    {exportJobsLoading ? 'Export…' : 'Lancer export'}
                  </Button>
                </div>
              </div>

              {exportSource === 'missions' && (
                <div className="mt-4 border-t pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Preset Missions</div>
                      <select
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        value={exportMissionsPreset}
                        onChange={e => setExportMissionsPreset(e.target.value as any)}
                      >
                        <option value="terrain">Terrain</option>
                        <option value="encadrement">Encadrement</option>
                        <option value="audit">Audit / Soutenance</option>
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">Colonnes</div>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExportMissionsColumns(missionsColumnsAll.map(c => c.key))}
                        >
                          Tout
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setExportMissionsColumns([])}>
                          Aucun
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                        {missionsColumnsAll.map(c => {
                          const checked = exportMissionsColumns.includes(c.key);
                          return (
                            <label key={c.key} className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setExportMissionsColumns(prev =>
                                    prev.includes(c.key) ? prev.filter(x => x !== c.key) : [...prev, c.key],
                                  );
                                }}
                              />
                              <span>{c.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border p-4 mb-6">
              <div className="text-lg font-semibold text-gray-900 mb-4">Historique des exports</div>
              {exportJobs.length === 0 ? (
                <div className="text-sm text-gray-600">Aucun export.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left font-medium px-4 py-3">Date</th>
                        <th className="text-left font-medium px-4 py-3">Source</th>
                        <th className="text-left font-medium px-4 py-3">Format</th>
                        <th className="text-left font-medium px-4 py-3">Statut</th>
                        <th className="text-left font-medium px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportJobs.map(j => (
                        <tr key={j.job_id} className="border-t">
                          <td className="px-4 py-3 text-gray-600">{formatDateTime(j.created_at)}</td>
                          <td className="px-4 py-3 text-gray-900">{j.source}</td>
                          <td className="px-4 py-3 text-gray-900">{j.format}</td>
                          <td className="px-4 py-3 text-gray-600">{j.status}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={j.status !== 'completed'}
                                onClick={async () => {
                                  try {
                                    const blob = await exportsApi.download(j.job_id);
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `export_${j.source}_${j.job_id}.${j.format}`;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    window.URL.revokeObjectURL(url);
                                  } catch (e) {
                                    setExportJobsError(e instanceof Error ? e.message : 'Erreur téléchargement');
                                  }
                                }}
                              >
                                Télécharger
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border p-4 mb-6">
              <div className="text-lg font-semibold text-gray-900 mb-4">Créer un template d’export</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-gray-700 mb-1">Nom</div>
                  <Input value={newTemplate.name} onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-gray-700 mb-1">Description</div>
                  <Input
                    value={newTemplate.description || ''}
                    onChange={e => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Source</div>
                  <select
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    value={newTemplate.source}
                    onChange={e => setNewTemplate({ ...newTemplate, source: e.target.value as any })}
                  >
                    <option value="missions">Missions</option>
                    <option value="students">Étudiants</option>
                    <option value="supervisors">Superviseurs</option>
                    <option value="documents">Documents</option>
                  </select>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Format</div>
                  <select
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    value={newTemplate.format}
                    onChange={e => setNewTemplate({ ...newTemplate, format: e.target.value as any })}
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="xlsx">XLSX</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-gray-700 mb-1">SQL</div>
                  <textarea
                    value={newTemplate.template_sql || ''}
                    onChange={e => setNewTemplate({ ...newTemplate, template_sql: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-gray-700 mb-1">Handlebars</div>
                  <textarea
                    value={newTemplate.template_handlebars || ''}
                    onChange={e => setNewTemplate({ ...newTemplate, template_handlebars: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div className="md:col-span-4 flex justify-end">
                  <Button
                    onClick={async () => {
                      setCreateTemplateError(null);
                      setCreateTemplateLoading(true);
                      try {
                        const created = await templatesApi.create(newTemplate);
                        setExportTemplates(prev => [created, ...prev]);
                        setNewTemplate({
                          name: '',
                          description: '',
                          source: 'missions',
                          format: 'csv',
                          template_sql: '',
                          template_handlebars: '',
                        });
                      } catch (e) {
                        setCreateTemplateError(e instanceof Error ? e.message : 'Erreur création template');
                      } finally {
                        setCreateTemplateLoading(false);
                      }
                    }}
                    disabled={createTemplateLoading || !newTemplate.name.trim()}
                  >
                    {createTemplateLoading ? 'Création…' : 'Créer template'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4 mb-6">
              <div className="text-lg font-semibold text-gray-900 mb-4">Planifications</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-gray-700 mb-1">Nom</div>
                  <Input value={newSchedule.name} onChange={e => setNewSchedule({ ...newSchedule, name: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-gray-700 mb-1">Description</div>
                  <Input
                    value={newSchedule.description || ''}
                    onChange={e => setNewSchedule({ ...newSchedule, description: e.target.value })}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Source</div>
                  <select
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    value={newSchedule.source}
                    onChange={e => setNewSchedule({ ...newSchedule, source: e.target.value as any })}
                  >
                    <option value="missions">Missions</option>
                    <option value="students">Étudiants</option>
                    <option value="supervisors">Superviseurs</option>
                    <option value="documents">Documents</option>
                  </select>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Format</div>
                  <select
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    value={newSchedule.format}
                    onChange={e => setNewSchedule({ ...newSchedule, format: e.target.value })}
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="xlsx">XLSX</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Template</div>
                  <select
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    value={newSchedule.template_id || ''}
                    onChange={e => setNewSchedule({ ...newSchedule, template_id: e.target.value || null })}
                    disabled={exportTemplatesLoading}
                  >
                    <option value="">Aucun</option>
                    {exportTemplates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">CRON</div>
                  <Input value={newSchedule.cron} onChange={e => setNewSchedule({ ...newSchedule, cron: e.target.value })} />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Timezone</div>
                  <Input
                    value={newSchedule.timezone || ''}
                    onChange={e => setNewSchedule({ ...newSchedule, timezone: e.target.value })}
                  />
                </div>
                <div className="md:col-span-4 flex justify-end">
                  <Button
                    onClick={async () => {
                      setCreateScheduleError(null);
                      setCreateScheduleLoading(true);
                      try {
                        const created = await schedulesApi.create(newSchedule);
                        setExportSchedules(prev => [created, ...prev]);
                        setNewSchedule({
                          name: '',
                          description: '',
                          source: 'missions',
                          format: 'csv',
                          template_id: null,
                          cron: '0 8 * * *',
                          timezone: 'UTC',
                          destinations: [],
                        });
                      } catch (e) {
                        setCreateScheduleError(e instanceof Error ? e.message : 'Erreur création schedule');
                      } finally {
                        setCreateScheduleLoading(false);
                      }
                    }}
                    disabled={createScheduleLoading || !newSchedule.name.trim()}
                  >
                    {createScheduleLoading ? 'Création…' : 'Créer schedule'}
                  </Button>
                </div>
              </div>

              {exportSchedules.length === 0 ? (
                <div className="text-sm text-gray-600">Aucune planification.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left font-medium px-4 py-3">Nom</th>
                        <th className="text-left font-medium px-4 py-3">Source</th>
                        <th className="text-left font-medium px-4 py-3">Format</th>
                        <th className="text-left font-medium px-4 py-3">CRON</th>
                        <th className="text-left font-medium px-4 py-3">Actif</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportSchedules.map(s => (
                        <tr key={s.id} className="border-t">
                          <td className="px-4 py-3 text-gray-900">{s.name}</td>
                          <td className="px-4 py-3 text-gray-900">{s.source}</td>
                          <td className="px-4 py-3 text-gray-900">{s.format}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono">{s.cron}</td>
                          <td className="px-4 py-3 text-gray-600">{s.is_active ? 'Oui' : 'Non'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'attributions' && (
          <>
            {attrNotice && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" />
                <span>{attrNotice}</span>
              </div>
            )}

            {attrError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                <span>{attrError}</span>
              </div>
            )}

            {attrSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatsCard
                  title="Mailles notifiables"
                  value={attrSummary.total_assignments}
                  icon={<BarChart3 className="w-6 h-6" />}
                  color="bg-blue-50 text-blue-900"
                />
                <StatsCard
                  title="Missions affectées"
                  value={attrSummary.missions_with_student}
                  icon={<Users className="w-6 h-6" />}
                  color="bg-green-50 text-green-900"
                />
                <StatsCard
                  title="Notifications en attente"
                  value={attrSummary.pending_notifications}
                  icon={<FileText className="w-6 h-6" />}
                  color="bg-orange-50 text-orange-900"
                />
                <StatsCard
                  title="Étudiants"
                  value={attrSummary.total_students}
                  icon={<ClipboardList className="w-6 h-6" />}
                  color="bg-purple-50 text-purple-900"
                />
              </div>
            )}

            <div className="bg-white rounded-xl border p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-gray-700 mb-1">Filtrer (étudiant/email/matricule)</div>
                  <input
                    value={attrStudentFilter}
                    onChange={e => setAttrStudentFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="ex: Diallo / email@..."
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Statut notification</div>
                  <select
                    value={attrNotifStatusFilter}
                    onChange={e => setAttrNotifStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Tous</option>
                    <option value="unassigned">Sans étudiant</option>
                    <option value="skipped">Affectée mais non notifiable</option>
                    <option value="never">Jamais envoyée</option>
                    <option value="pending">En attente</option>
                    <option value="sent">Envoyée</option>
                    <option value="failed">Échec</option>
                  </select>
                </div>
                <div className="flex items-end justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setAttrHistoryLoading(true);
                      setAttrHistoryError(null);
                      try {
                        const h = await attributionsApi.history();
                        setAttrHistory(h.items);
                      } catch (e) {
                        setAttrHistoryError(e instanceof Error ? e.message : 'Erreur historique');
                      } finally {
                        setAttrHistoryLoading(false);
                      }
                    }}
                    disabled={attrHistoryLoading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${attrHistoryLoading ? 'animate-spin' : ''}`} />
                    Historique
                  </Button>
                  <Button
                    onClick={() => {
                      setAttrEnqueueError(null);
                      setAttrConfirmOpen(true);
                    }}
                    disabled={Object.values(attrSelected).filter(Boolean).length === 0}
                  >
                    Notifier la sélection
                  </Button>
                </div>
              </div>
            </div>

            {attrHistoryError && <div className="mt-3 text-sm text-red-600">{attrHistoryError}</div>}
            {attrEnqueueError && <div className="mt-3 text-sm text-red-600">{attrEnqueueError}</div>}

            <CollapsibleCard title="Attributions missions" subtitle={`${attrItems.length} lignes`} defaultOpen>
              <div className="max-h-[65vh] overflow-auto">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3">
                          <input
                            type="checkbox"
                            checked={
                              attrItems.filter(i => i.attribution_status === 'notifiable' && !!i.assignment_id).length > 0 &&
                              attrItems
                                .filter(i => i.attribution_status === 'notifiable' && !!i.assignment_id)
                                .every(i => !!attrSelected[i.assignment_id as string])
                            }
                            onChange={e => {
                              const checked = e.target.checked;
                              setAttrSelected(prev => {
                                const next = { ...prev };
                                for (const i of attrItems) {
                                  if (i.attribution_status !== 'notifiable' || !i.assignment_id) continue;
                                  next[i.assignment_id] = checked;
                                }
                                return next;
                              });
                            }}
                          />
                        </th>
                        <th className="text-left px-4 py-3">Mission</th>
                        <th className="text-left px-4 py-3">Maille</th>
                        <th className="text-left px-4 py-3">Étudiant</th>
                        <th className="text-left px-4 py-3">Email</th>
                        <th className="text-left px-4 py-3">Statut</th>
                        <th className="text-left px-4 py-3">Raison</th>
                        <th className="text-left px-4 py-3">Notification</th>
                        <th className="text-left px-4 py-3">Dernier envoi</th>
                        <th className="text-right px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attrItems.map(i => (
                        <tr key={i.mission_id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              disabled={i.attribution_status !== 'notifiable' || !i.assignment_id}
                              checked={!!(i.assignment_id && attrSelected[i.assignment_id])}
                              onChange={e => {
                                if (!i.assignment_id) return;
                                setAttrSelected(prev => ({ ...prev, [i.assignment_id as string]: e.target.checked }));
                              }}
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{i.mission_code}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{i.maille_code}</td>
                          <td className="px-4 py-3 text-gray-900">{i.full_name || '-'}</td>
                          <td className="px-4 py-3 text-gray-700">{i.email || '-'}</td>
                          <td className="px-4 py-3">
                            <Badge
                              className={
                                i.attribution_status === 'notifiable'
                                  ? 'bg-green-100 text-green-800'
                                  : i.attribution_status === 'notified'
                                    ? 'bg-blue-100 text-blue-800'
                                    : i.attribution_status === 'error'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-gray-100 text-gray-800'
                              }
                            >
                              {i.attribution_status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-600" title={i.status_reason || ''}>
                            {i.status_reason || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={
                                i.notification_status === 'sent'
                                  ? 'bg-green-100 text-green-800'
                                  : i.notification_status === 'pending'
                                    ? 'bg-orange-100 text-orange-800'
                                    : i.notification_status === 'failed'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-gray-100 text-gray-800'
                              }
                            >
                              {i.notification_status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {i.notification_sent_at ? new Date(i.notification_sent_at).toLocaleString('fr-FR') : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {i.attribution_status === 'unassigned' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setAttrAssignError(null);
                                  setAttrAssignStudentQuery('');
                                  setAttrAssignStudents([]);
                                  setAttrAssignSelectedStudentId('');
                                  setAttrAssignMission(i);
                                  setAttrAssignOpen(true);
                                }}
                              >
                                Attribuer
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={i.attribution_status !== 'notifiable' || !i.assignment_id}
                                onClick={() => {
                                  if (!i.assignment_id) return;
                                  setAttrSelected(prev => ({ ...prev, [i.assignment_id as string]: true }));
                                  setAttrConfirmOpen(true);
                                }}
                              >
                                Notifier
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {attrItems.length === 0 && (
                        <tr>
                          <td className="px-4 py-6 text-center text-gray-500" colSpan={10}>
                            Aucune attribution
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CollapsibleCard>

            <div className="mt-6">
              <CollapsibleCard title="Jobs email (worker local)" subtitle={`${notifyJobs.length} jobs`} defaultOpen={false}>
                <div className="p-4 border-b flex items-center justify-end">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setNotifyJobsLoading(true);
                      setNotifyJobsError(null);
                      try {
                        const res = await notifyApi.list(50);
                        setNotifyJobs(res.jobs);
                      } catch (e) {
                        setNotifyJobsError(e instanceof Error ? e.message : 'Erreur lors du chargement');
                      } finally {
                        setNotifyJobsLoading(false);
                      }
                    }}
                    disabled={notifyJobsLoading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${notifyJobsLoading ? 'animate-spin' : ''}`} />
                    Rafraîchir
                  </Button>
                </div>

                {notifyJobsError && <div className="px-4 py-3 text-sm text-red-600">{notifyJobsError}</div>}

                <div className="max-h-[50vh] overflow-auto">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-3">Job</th>
                          <th className="text-left px-4 py-3">Type</th>
                          <th className="text-left px-4 py-3">Statut</th>
                          <th className="text-left px-4 py-3">Créé</th>
                          <th className="text-left px-4 py-3">Erreur</th>
                          <th className="text-right px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {notifyJobs.map(j => (
                          <tr key={j.id} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">{j.id}</td>
                            <td className="px-4 py-3 text-gray-700">{j.job_type}</td>
                            <td className="px-4 py-3">
                              <Badge
                                className={
                                  j.status === 'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : j.status === 'failed'
                                      ? 'bg-red-100 text-red-800'
                                      : j.status === 'running'
                                        ? 'bg-blue-100 text-blue-800'
                                        : j.status === 'cancelled'
                                          ? 'bg-gray-200 text-gray-800'
                                          : 'bg-gray-100 text-gray-800'
                                }
                              >
                                {j.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{new Date(j.created_at).toLocaleString('fr-FR')}</td>
                            <td className="px-4 py-3 text-gray-600">{j.error || '-'}</td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={j.status !== 'pending'}
                                onClick={async () => {
                                  setNotifyJobsError(null);
                                  try {
                                    await notifyApi.cancel(j.id);
                                    const res = await notifyApi.list(50);
                                    setNotifyJobs(res.jobs);
                                    setAttrNotice('Job annulé');
                                    window.setTimeout(() => setAttrNotice(null), 2500);
                                  } catch (e) {
                                    setNotifyJobsError(e instanceof Error ? e.message : 'Erreur annulation');
                                  }
                                }}
                              >
                                Annuler
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {notifyJobs.length === 0 && (
                          <tr>
                            <td className="px-4 py-6 text-center text-gray-500" colSpan={6}>
                              Aucun job
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CollapsibleCard>
            </div>

            <div className="mt-6">
              <CollapsibleCard title="Historique & Logs" subtitle={`${attrHistory.length} entrées`} defaultOpen={false}>
                <div className="max-h-[50vh] overflow-auto">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-3">Date</th>
                          <th className="text-left px-4 py-3">Étudiant</th>
                          <th className="text-left px-4 py-3">Maille</th>
                          <th className="text-left px-4 py-3">Statut</th>
                          <th className="text-left px-4 py-3">Job</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attrHistory.map(h => (
                          <tr key={h.id} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-600">{new Date(h.requested_at).toLocaleString('fr-FR')}</td>
                            <td className="px-4 py-3 text-gray-900">{h.full_name}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">{h.maille_code}</td>
                            <td className="px-4 py-3">
                              <Badge
                                className={
                                  h.status === 'sent'
                                    ? 'bg-green-100 text-green-800'
                                    : h.status === 'pending'
                                      ? 'bg-orange-100 text-orange-800'
                                      : h.status === 'failed'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800'
                                }
                              >
                                {h.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">{h.email_job_id || '-'}</td>
                          </tr>
                        ))}
                        {attrHistory.length === 0 && (
                          <tr>
                            <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                              Aucun historique
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CollapsibleCard>
            </div>

            {attrConfirmOpen && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                <div className="bg-white w-full max-w-lg rounded-xl shadow-lg border overflow-hidden">
                  <div className="px-5 py-4 border-b">
                    <div className="text-lg font-semibold text-gray-900">Confirmer l’envoi des notifications</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Vous êtes sur le point de notifier <span className="font-semibold">{Object.values(attrSelected).filter(Boolean).length}</span> attribution(s).
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={attrIncludeBbox} onChange={e => setAttrIncludeBbox(e.target.checked)} />
                      Inclure la BBox des mailles
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={attrIncludeInstructions}
                        onChange={e => setAttrIncludeInstructions(e.target.checked)}
                      />
                      Inclure les instructions standard
                    </label>
                    <div className="text-xs text-gray-500">
                      Les emails seront envoyés automatiquement via le worker local. Cette action écrit uniquement en base.
                    </div>
                  </div>

                  <div className="px-5 py-4 border-t flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAttrConfirmOpen(false)} disabled={attrEnqueueLoading}>
                      Annuler
                    </Button>
                    <Button
                      onClick={async () => {
                        setAttrEnqueueError(null);
                        setAttrEnqueueLoading(true);
                        try {
                          const ids = Object.entries(attrSelected)
                            .filter(([, v]) => v)
                            .map(([k]) => k);
                          await attributionsApi.enqueueNotifications({
                            assignment_ids: ids,
                            include_bbox: attrIncludeBbox,
                            include_instructions: attrIncludeInstructions,
                          });

                          const [summaryRes, listRes, historyRes] = await Promise.all([
                            attributionsApi.summary(),
                            attributionsApi.list({
                              student: attrStudentFilter.trim() || undefined,
                              notif_status: attrNotifStatusFilter || undefined,
                              limit: 500,
                            }),
                            attributionsApi.history().catch(() => ({ items: [], total: 0 })),
                          ]);
                          setAttrSummary(summaryRes);
                          setAttrItems(listRes.items);
                          setAttrHistory(historyRes.items || []);
                          setAttrNotice('Notifications programmées (job en attente)');
                          window.setTimeout(() => setAttrNotice(null), 3500);
                          setAttrConfirmOpen(false);
                        } catch (e) {
                          setAttrEnqueueError(e instanceof Error ? e.message : 'Erreur enregistrement');
                        } finally {
                          setAttrEnqueueLoading(false);
                        }
                      }}
                      disabled={attrEnqueueLoading}
                    >
                      {attrEnqueueLoading ? 'Enregistrement…' : 'Confirmer'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {attrAssignOpen && attrAssignMission && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                <div className="bg-white w-full max-w-lg rounded-xl shadow-lg border overflow-hidden">
                  <div className="px-5 py-4 border-b">
                    <div className="text-lg font-semibold text-gray-900">
                      {attrAssignMode === 'assign_student'
                        ? 'Assigner un étudiant'
                        : attrAssignMode === 'assign_holder'
                          ? 'Assigner le détenteur'
                          : 'Changer l’étudiant'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Mission <span className="font-mono">{attrAssignMission.mission_code}</span> — maille{' '}
                      <span className="font-mono">{attrAssignMission.maille_code}</span>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Étudiant (recherche)</div>
                      <input
                        value={attrAssignStudentQuery}
                        onChange={async e => {
                          const q = e.target.value;
                          setAttrAssignStudentQuery(q);
                          setAttrAssignSelectedStudentId('');
                          setAttrAssignError(null);
                          if (q.trim().length < 2) {
                            setAttrAssignStudents([]);
                            return;
                          }
                          try {
                            const res = await studentsApi.suggest(q.trim());
                            setAttrAssignStudents(res);
                          } catch (_e) {
                            setAttrAssignStudents([]);
                          }
                        }}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Nom / email / matricule…"
                      />
                      {attrAssignStudents.length > 0 && (
                        <div className="mt-2 border rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                          {attrAssignStudents.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                attrAssignSelectedStudentId === s.id ? 'bg-blue-50' : ''
                              }`}
                              onClick={() => {
                                setAttrAssignSelectedStudentId(s.id);
                                setAttrAssignStudentQuery(s.label);
                                setAttrAssignStudents([]);
                              }}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {attrAssignError && <div className="text-sm text-red-600">{attrAssignError}</div>}
                    <div className="text-xs text-gray-500">
                      Cette action rend la mission notifiable par email.
                    </div>
                  </div>

                  <div className="px-5 py-4 border-t flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAttrAssignOpen(false);
                        setAttrAssignMission(null);
                      }}
                      disabled={attrAssignLoading}
                    >
                      Fermer
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!attrAssignMission) return;
                        if (!attrAssignSelectedStudentId) {
                          setAttrAssignError('Sélectionne un étudiant');
                          return;
                        }
                        setAttrAssignLoading(true);
                        setAttrAssignError(null);
                        try {
                          await attributionsApi.assign({
                            mission_id: attrAssignMission.mission_id,
                            student_id: attrAssignSelectedStudentId,
                          });

                          const [summaryRes, listRes] = await Promise.all([
                            attributionsApi.summary(),
                            attributionsApi.list({
                              student: attrStudentFilter.trim() || undefined,
                              notif_status: attrNotifStatusFilter || undefined,
                              limit: 500,
                            }),
                          ]);
                          setAttrSummary(summaryRes);
                          setAttrItems(listRes.items);
                          setAttrNotice('Attribution enregistrée');
                          window.setTimeout(() => setAttrNotice(null), 2500);
                          setAttrAssignOpen(false);
                          setAttrAssignMission(null);
                        } catch (e) {
                          setAttrAssignError(e instanceof Error ? e.message : 'Erreur attribution');
                        } finally {
                          setAttrAssignLoading(false);
                        }
                      }}
                      disabled={attrAssignLoading}
                    >
                      {attrAssignLoading
                        ? 'Attribution…'
                        : attrAssignMode === 'change_student'
                          ? 'Changer'
                          : attrAssignMode === 'assign_holder'
                            ? 'Assigner le détenteur'
                            : 'Assigner'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {takeoverOpen && takeoverMission && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                <div className="bg-white w-full max-w-lg rounded-xl shadow-lg border overflow-hidden">
                  <div className="px-5 py-4 border-b">
                    <div className="text-lg font-semibold text-gray-900">Reprendre la maille</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Mission <span className="font-mono">{takeoverMission.code}</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    {takeoverError && <div className="text-sm text-red-600">{takeoverError}</div>}
                    <div className="text-sm text-gray-700">
                      Cette action va résoudre le conflit en transférant la maille à cette mission.
                    </div>
                  </div>

                  <div className="px-5 py-4 border-t flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTakeoverOpen(false);
                        setTakeoverMission(null);
                        setTakeoverPayload(null);
                        setTakeoverError(null);
                      }}
                      disabled={takeoverLoading}
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!takeoverMission) return;
                        setTakeoverLoading(true);
                        setTakeoverError(null);
                        try {
                          await missionsApi.resolveConflict(takeoverMission.id, {
                            action: 'takeover',
                            payload: takeoverPayload || {},
                          });
                          await loadData();
                          setTakeoverOpen(false);
                          setTakeoverMission(null);
                          setTakeoverPayload(null);
                        } catch (e) {
                          setTakeoverError(e instanceof Error ? e.message : 'Erreur résolution');
                        } finally {
                          setTakeoverLoading(false);
                        }
                      }}
                      disabled={takeoverLoading}
                    >
                      {takeoverLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Résolution...
                        </>
                      ) : (
                        'Confirmer'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'students' && (
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
                    onChange={e => setStudentsSearch(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 border rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Select
                    value={studentsActiveFilter}
                    onChange={e => setStudentsActiveFilter(e.target.value as any)}
                    options={[
                      { value: 'all', label: 'Tous' },
                      { value: 'active', label: 'Actifs' },
                      { value: 'inactive', label: 'Inactifs' },
                    ]}
                  />
                  <Select
                    value={studentsSort}
                    onChange={e => setStudentsSort(e.target.value as any)}
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
                    onChange={e => {
                      const v = e.target.checked;
                      setStudentsAuditMode(v);
                      if (v) setStudentsIncludeDeleted(true);
                    }}
                  />
                  Mode audit
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={studentsIncludeDeleted}
                    onChange={e => setStudentsIncludeDeleted(e.target.checked)}
                    disabled={studentsAuditMode}
                  />
                  Inclure supprimés
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={studentsDuplicatesOnly}
                    onChange={e => setStudentsDuplicatesOnly(e.target.checked)}
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
              <CollapsibleCard title="Étudiants" subtitle={`${filteredStudents.length} affichés / ${total} au total`}>
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
                              setSelectedStudentId(s.id);
                              setShowStudentDetailModal(true);
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
                                {!!(s as any).deleted_at && (
                                  <Badge className="bg-red-50 text-red-700">Supprimé</Badge>
                                )}
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
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedStudent(s);
                                      setShowUpdateStudentModal(true);
                                    }}
                                  >
                                    Modifier
                                  </Button>
                                </span>
                                <span
                                  onClick={e => {
                                    e.stopPropagation();
                                  }}
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedStudent(s);
                                      if (s.is_active) {
                                        setShowDeactivateStudentModal(true);
                                      } else {
                                        setActionLoading(true);
                                        studentsApi
                                          .update(s.id, { is_active: true })
                                          .then(() => loadData())
                                          .finally(() => setActionLoading(false));
                                      }
                                    }}
                                    disabled={actionLoading}
                                  >
                                    {s.is_active ? 'Désactiver' : 'Réactiver'}
                                  </Button>
                                </span>

                                <span
                                  onClick={e => {
                                    e.stopPropagation();
                                  }}
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedStudent(s);
                                      setShowDeleteStudentModal(true);
                                    }}
                                  >
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

                  {!loading && filteredStudents.length === 0 && (
                    <div className="p-8 text-center text-gray-500">Aucun étudiant</div>
                  )}
                </div>
              </CollapsibleCard>
            )}
          </>
        )}

        {activeTab === 'supervisors' && (
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
                    onChange={e => setSupervisorsSearch(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 border rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Select
                    value={supervisorsActiveFilter}
                    onChange={e => setSupervisorsActiveFilter(e.target.value as any)}
                    options={[
                      { value: 'all', label: 'Tous' },
                      { value: 'active', label: 'Actifs' },
                      { value: 'inactive', label: 'Inactifs' },
                    ]}
                  />
                  <Select
                    value={supervisorsSort}
                    onChange={e => setSupervisorsSort(e.target.value as any)}
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
              <CollapsibleCard title="Superviseurs" subtitle={`${filteredSupervisors.length} affichés / ${total} au total`}>
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
                            onClick={() => {
                              setSelectedSupervisorId(s.id);
                              setShowSupervisorDetailModal(true);
                            }}
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
                                <span
                                  onClick={e => {
                                    e.stopPropagation();
                                  }}
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedSupervisor(s);
                                      setShowUpdateSupervisorModal(true);
                                    }}
                                  >
                                    Modifier
                                  </Button>
                                </span>
                                <span
                                  onClick={e => {
                                    e.stopPropagation();
                                  }}
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedSupervisor(s);
                                      if (s.is_active) {
                                        setShowDeactivateSupervisorModal(true);
                                      } else {
                                        setActionLoading(true);
                                        supervisorsApi
                                          .update(s.id, { is_active: true })
                                          .then(() => loadData())
                                          .finally(() => setActionLoading(false));
                                      }
                                    }}
                                    disabled={actionLoading}
                                  >
                                    {s.is_active ? 'Désactiver' : 'Réactiver'}
                                  </Button>
                                </span>

                                <span
                                  onClick={e => {
                                    e.stopPropagation();
                                  }}
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedSupervisor(s);
                                      setShowDeleteSupervisorModal(true);
                                    }}
                                  >
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

                  {!loading && filteredSupervisors.length === 0 && (
                    <div className="p-8 text-center text-gray-500">Aucun superviseur</div>
                  )}
                </div>
              </CollapsibleCard>
            )}
          </>
        )}

        {activeTab === 'documents' && (
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

            <div className="bg-white rounded-xl border p-4 mb-6">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Rechercher (titre, fichier, type)..."
                    value={documentsSearch}
                    onChange={e => setDocumentsSearch(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 border rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Select
                    value={documentsSort}
                    onChange={e => setDocumentsSort(e.target.value as any)}
                    options={[
                      { value: 'date_desc', label: 'Tri: Date (récent)' },
                      { value: 'date_asc', label: 'Tri: Date (ancien)' },
                      { value: 'title_asc', label: 'Tri: Titre (A→Z)' },
                    ]}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowUploadDocumentModal(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Uploader
                  </Button>
                </div>
              </div>
            </div>

            <CollapsibleCard title="Documents" subtitle={`${filteredDocuments.length} affichés / ${effectiveTotal} au total`}>
              <div className="p-4 border-b grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Filtrer par mission</label>
                  <Input
                    placeholder="ID mission (uuid)"
                    value={documentsMissionId || ''}
                    onChange={e => setDocumentsMissionId(e.target.value || null)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                  <Select
                    value={documentsType}
                    onChange={e => setDocumentsType(e.target.value)}
                    options={[
                      { value: '', label: 'Tous' },
                      { value: 'autre', label: 'Autre' },
                      { value: 'rapport_intermediaire', label: 'Rapport intermédiaire' },
                      { value: 'rapport_final', label: 'Rapport final' },
                      { value: 'fiche_terrain', label: 'Fiche terrain' },
                      { value: 'annexe', label: 'Annexe' },
                      { value: 'photo', label: 'Photo' },
                      { value: 'plan', label: 'Plan' },
                      { value: 'resultats_essais', label: 'Résultats essais' },
                    ]}
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      loadData();
                    }}
                  >
                    Filtrer
                  </Button>
                </div>
              </div>

              <div className="p-4">
                {documentsError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {documentsError}
                  </div>
                )}

                <div className="max-h-[65vh] overflow-auto">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 sticky top-0">
                        <tr>
                          <th className="text-left font-medium px-4 py-3">Titre</th>
                          <th className="text-left font-medium px-4 py-3">Type</th>
                          <th className="text-left font-medium px-4 py-3">Fichier</th>
                          <th className="text-left font-medium px-4 py-3">Date</th>
                          <th className="text-left font-medium px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDocuments.map(d => (
                          <tr key={d.id} className="border-t">
                            <td className="px-4 py-3 text-gray-900">{d.title}</td>
                            <td className="px-4 py-3 text-gray-600">{d.document_type}</td>
                            <td className="px-4 py-3 text-gray-600">{d.file_name}</td>
                            <td className="px-4 py-3 text-gray-600">{formatDate(d.uploaded_at)}</td>
                            <td className="px-4 py-3 text-gray-600">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const blob = await documentsApi.download(d.id);
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = d.file_name;
                                      document.body.appendChild(a);
                                      a.click();
                                      a.remove();
                                      URL.revokeObjectURL(url);
                                    } catch (err) {
                                      setDocumentsError(err instanceof Error ? err.message : 'Erreur téléchargement');
                                    }
                                  }}
                                >
                                  Télécharger
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await documentsApi.delete(d.id);
                                      await loadData();
                                    } catch (err) {
                                      setDocumentsError(err instanceof Error ? err.message : 'Erreur suppression');
                                    }
                                  }}
                                >
                                  Supprimer
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {!documentsLoading && filteredDocuments.length === 0 && (
                  <div className="p-8 text-center text-gray-500">Aucun document</div>
                )}
              </div>
            </CollapsibleCard>
          </>
        )}
      </div>

      {/* Create Modal */}
      <CreateMissionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={loadData}
        onOpenExistingStudent={openExistingStudent}
      />

      <ConfirmDeactivateModal
        isOpen={showDeleteMissionModal}
        title="Supprimer la mission"
        description={selectedMissionToDelete ? `Confirmer la suppression de ${selectedMissionToDelete.title} ?` : 'Confirmer la suppression ?'}
        confirmLabel="Supprimer"
        loading={actionLoading}
        onClose={() => setShowDeleteMissionModal(false)}
        onConfirm={async () => {
          if (!selectedMissionToDelete) return;
          setActionLoading(true);
          try {
            await missionsApi.delete(selectedMissionToDelete.id);
            setMissions(prev => prev.filter(m => m.id !== selectedMissionToDelete.id));
            setTotal(prev => Math.max(0, prev - 1));
            setStats(prev => (prev ? { ...prev, total_missions: Math.max(0, prev.total_missions - 1) } : prev));
            setShowDeleteMissionModal(false);
          } finally {
            setActionLoading(false);
          }
        }}
      />

      <CreateStudentModal
        isOpen={showCreateStudentModal}
        onClose={() => setShowCreateStudentModal(false)}
        onCreated={loadData}
        onOpenExistingStudent={openExistingStudent}
      />

      <CreateSupervisorModal
        isOpen={showCreateSupervisorModal}
        onClose={() => setShowCreateSupervisorModal(false)}
        onCreated={loadData}
      />

      <UpdateStudentModal
        isOpen={showUpdateStudentModal}
        student={selectedStudent}
        onClose={() => setShowUpdateStudentModal(false)}
        onUpdated={loadData}
      />

      <UpdateStudentPrefsModal
        isOpen={showUpdateStudentPrefsModal}
        student={selectedStudent}
        onClose={() => setShowUpdateStudentPrefsModal(false)}
        onUpdated={loadData}
      />

      <UpdateSupervisorModal
        isOpen={showUpdateSupervisorModal}
        supervisor={selectedSupervisor}
        onClose={() => setShowUpdateSupervisorModal(false)}
        onUpdated={loadData}
      />

      <ConfirmDeactivateModal
        isOpen={showDeactivateStudentModal}
        title="Désactiver l'étudiant"
        description={selectedStudent ? `Confirmer la désactivation de ${selectedStudent.full_name} ?` : 'Confirmer la désactivation ?'}
        loading={actionLoading}
        onClose={() => setShowDeactivateStudentModal(false)}
        onConfirm={async () => {
          if (!selectedStudent) return;
          setActionLoading(true);
          try {
            await studentsApi.update(selectedStudent.id, { is_active: false });
            await loadData();
            setShowDeactivateStudentModal(false);
          } finally {
            setActionLoading(false);
          }
        }}
      />

      <ConfirmDeactivateModal
        isOpen={showDeleteStudentModal}
        title="Supprimer l'étudiant"
        description={selectedStudent ? `Confirmer la suppression de ${selectedStudent.full_name} ?` : 'Confirmer la suppression ?'}
        confirmLabel="Supprimer"
        loading={actionLoading}
        onClose={() => setShowDeleteStudentModal(false)}
        onConfirm={async () => {
          if (!selectedStudent) return;
          setActionLoading(true);
          try {
            await studentsApi.delete(selectedStudent.id);
            setStudents(prev => prev.filter(s => s.id !== selectedStudent.id));
            setTotal(prev => Math.max(0, prev - 1));
            setStudentsTotal(prev => Math.max(0, prev - 1));
            setStats(prev => (prev ? { ...prev, total_students: Math.max(0, prev.total_students - 1) } : prev));
            setShowDeleteStudentModal(false);
          } finally {
            setActionLoading(false);
          }
        }}
      />

      <ConfirmDeactivateModal
        isOpen={showDeactivateSupervisorModal}
        title="Désactiver le superviseur"
        description={selectedSupervisor ? `Confirmer la désactivation de ${selectedSupervisor.full_name} ?` : 'Confirmer la désactivation ?'}
        loading={actionLoading}
        onClose={() => setShowDeactivateSupervisorModal(false)}
        onConfirm={async () => {
          if (!selectedSupervisor) return;
          setActionLoading(true);
          try {
            await supervisorsApi.update(selectedSupervisor.id, { is_active: false });
            await loadData();
            setShowDeactivateSupervisorModal(false);
          } finally {
            setActionLoading(false);
          }
        }}
      />

      <ConfirmDeactivateModal
        isOpen={showDeleteSupervisorModal}
        title="Supprimer le superviseur"
        description={selectedSupervisor ? `Confirmer la suppression de ${selectedSupervisor.full_name} ?` : 'Confirmer la suppression ?'}
        confirmLabel="Supprimer"
        loading={actionLoading}
        onClose={() => setShowDeleteSupervisorModal(false)}
        onConfirm={async () => {
          if (!selectedSupervisor) return;
          setActionLoading(true);
          try {
            await supervisorsApi.delete(selectedSupervisor.id);
            setSupervisors(prev => prev.filter(s => s.id !== selectedSupervisor.id));
            setTotal(prev => Math.max(0, prev - 1));
            setStats(prev => (prev ? { ...prev, total_supervisors: Math.max(0, prev.total_supervisors - 1) } : prev));
            setShowDeleteSupervisorModal(false);
          } finally {
            setActionLoading(false);
          }
        }}
      />

      <MissionDetailModal
        isOpen={showMissionDetailModal}
        missionId={selectedMissionId}
        supervisors={supervisors}
        defaultTab={missionDetailDefaultTab}
        onClose={() => setShowMissionDetailModal(false)}
        onChanged={loadData}
        onGoToDocuments={(missionId) => {
          setActiveTab('documents');
          setSelectedMissionId(missionId);
        }}
      />

      <TransferMissionModal
        isOpen={showTransferMissionModal}
        mission={selectedMissionToTransfer}
        onClose={() => setShowTransferMissionModal(false)}
        onTransferred={loadData}
      />

      <StudentDetailModal
        isOpen={showStudentDetailModal}
        studentId={selectedStudentId}
        onClose={() => setShowStudentDetailModal(false)}
      />

      <SupervisorDetailModal
        isOpen={showSupervisorDetailModal}
        supervisorId={selectedSupervisorId}
        onClose={() => setShowSupervisorDetailModal(false)}
      />

      <UploadDocumentModal
        isOpen={showUploadDocumentModal}
        missionId={documentsMissionId}
        onClose={() => setShowUploadDocumentModal(false)}
        onUploaded={loadData}
      />
    </div>
  );
};

export default ColabPage;
