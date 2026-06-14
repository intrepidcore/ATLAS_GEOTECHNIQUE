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
  Bell,
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
import CreateStudentModal from './colab/create-student-modal';
import CreateSupervisorModal from './colab/create-supervisor-modal';
import MissionsTab from './colab/tabs/missions-tab';
import StudentsTab from './colab/tabs/students-tab';
import SupervisorsTab from './colab/tabs/supervisors-tab';
import DocumentsTab from './colab/tabs/documents-tab';
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
      <div className="relative bg-card text-card-foreground border border-border rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
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

          <div className="text-sm text-foreground">
            <div className="font-medium">{student.full_name}</div>
            <div className="text-muted-foreground">{student.email}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">ADM code (préférence 1)</label>
            <Input value={admCode} onChange={e => setAdmCode(e.target.value)} />
            {prefs && (
              <div className="mt-1 text-xs text-muted-foreground">student_id: <span className="font-mono">{prefs.student_id}</span></div>
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
  destructive?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ isOpen, title, description, confirmLabel = "Désactiver", loading = false, destructive = false, error, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            {destructive ? (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
            ) : (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            )}
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              destructive
                ? "bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 text-white"
                : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 text-white"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Traitement...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
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
  const [actionError, setActionError] = useState<string | null>(null);

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
  const [attrIncludePdf, setAttrIncludePdf] = useState(true);
  const [attrIncludeGeojson, setAttrIncludeGeojson] = useState(true);
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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Authentification requise</h2>
          <p className="text-muted-foreground">Veuillez vous connecter pour accéder à Atlas Colab Studio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-border border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Atlas Colab Studio</h1>
              <p className="text-sm text-muted-foreground mt-1">Gestion des missions terrain & partage de connaissances</p>
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
                  <div className="absolute right-0 mt-2 w-64 bg-card text-card-foreground border border-border rounded-xl shadow-lg overflow-hidden z-20">
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted/60"
                      onClick={() => {
                        setShowActionMenu(false);
                        setShowCreateModal(true);
                      }}
                    >
                      Nouvelle mission
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted/60"
                      onClick={() => {
                        setShowActionMenu(false);
                        setShowCreateStudentModal(true);
                      }}
                    >
                      Nouvel étudiant
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted/60"
                      onClick={() => {
                        setShowActionMenu(false);
                        setShowCreateSupervisorModal(true);
                      }}
                    >
                      Nouveau superviseur
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted/60"
                      onClick={() => {
                        setShowActionMenu(false);
                        setActiveTab('documents');
                        setShowUploadDocumentModal(true);
                      }}
                    >
                      Uploader un document
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted/40 text-muted-foreground cursor-not-allowed"
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
                  ? 'bg-background text-primary border-t border-x border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Missions
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'students'
                  ? 'bg-background text-primary border-t border-x border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Users className="w-4 h-4" />
              Étudiants
            </button>
            <button
              onClick={() => setActiveTab('supervisors')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'supervisors'
                  ? 'bg-background text-primary border-t border-x border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Users className="w-4 h-4" />
              Superviseurs
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'documents'
                  ? 'bg-background text-primary border-t border-x border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Documents
            </button>
            <button
              onClick={() => setActiveTab('exports')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'exports'
                  ? 'bg-background text-primary border-t border-x border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Exports
            </button>
            <button
              onClick={() => setActiveTab('attributions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'attributions'
                  ? 'bg-background text-primary border-t border-x border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
          <MissionsTab
            stats={stats}
            studentsKpiValue={studentsKpiValue}
            missions={missions}
            loading={loading}
            error={error}
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            onSearch={handleSearch}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
            filtersCommuneQuery={filtersCommuneQuery}
            onFiltersCommuneQueryChange={setFiltersCommuneQuery}
            filtersCommuneSuggestions={filtersCommuneSuggestions}
            filtersCommuneLoading={filtersCommuneLoading}
            onSelectCommune={c => {
              setFiltersCommuneQuery(c);
              handleFilterChange('commune', c);
              setFiltersCommuneSuggestions([]);
            }}
            filtersRegionQuery={filtersRegionQuery}
            onFiltersRegionQueryChange={setFiltersRegionQuery}
            filtersRegionSuggestions={filtersRegionSuggestions}
            filtersRegionLoading={filtersRegionLoading}
            onSelectRegion={r => {
              setFiltersRegionQuery(r);
              handleFilterChange('region', r);
              setFiltersRegionSuggestions([]);
            }}
            total={total}
            totalPages={totalPages}
            onPrevPage={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
            onNextPage={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
            canTransferMission={canTransferMission}
            onOpenMissionDetail={(missionId, tab) => {
              setSelectedMissionId(missionId);
              setMissionDetailDefaultTab(tab || 'details');
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
            onTransferMission={mission => {
              setSelectedMissionToTransfer(mission);
              setShowTransferMissionModal(true);
            }}
            onDeleteMission={mission => {
              setSelectedMissionToDelete(mission);
              setShowDeleteMissionModal(true);
            }}
            onStatusChange={async (mission, newStatus) => {
              try {
                await missionsApi.update(mission.id, { status: newStatus });
                await loadData();
              } catch (err) {
                console.error("Erreur changement statut:", err);
              }
            }}
            onOpenCreateMission={() => setShowCreateModal(true)}
          />
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

            <div className="bg-card text-card-foreground rounded-xl border border-border p-4 mb-6">
              <div className="text-lg font-semibold text-foreground mb-4">Exporter des données</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground mb-1">Source</div>
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
                  <div className="text-sm font-medium text-foreground mb-1">Format</div>
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
                    <div className="text-sm font-medium text-foreground mb-1">Orientation</div>
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
                  <div className="text-sm font-medium text-foreground mb-1">Template (optionnel)</div>
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
                      <div className="text-sm font-medium text-foreground mb-1">Preset Missions</div>
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
                      <div className="text-sm font-medium text-foreground mb-2">Colonnes</div>
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
                            <label key={c.key} className="flex items-center gap-2 text-sm text-foreground">
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

            <div className="bg-card text-card-foreground rounded-xl border border-border p-4 mb-6">
              <div className="text-lg font-semibold text-foreground mb-4">Historique des exports</div>
              {exportJobs.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucun export.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
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
                          <td className="px-4 py-3 text-muted-foreground">{formatDateTime(j.created_at)}</td>
                          <td className="px-4 py-3 text-foreground">{j.source}</td>
                          <td className="px-4 py-3 text-foreground">{j.format}</td>
                          <td className="px-4 py-3 text-muted-foreground">{j.status}</td>
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

            <div className="bg-card text-card-foreground rounded-xl border border-border p-4 mb-6">
              <div className="text-lg font-semibold text-foreground mb-4">Créer un template d’export</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-foreground mb-1">Nom</div>
                  <Input value={newTemplate.name} onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-foreground mb-1">Description</div>
                  <Input
                    value={newTemplate.description || ''}
                    onChange={e => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground mb-1">Source</div>
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
                  <div className="text-sm font-medium text-foreground mb-1">Format</div>
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
                  <div className="text-sm font-medium text-foreground mb-1">SQL</div>
                  <textarea
                    value={newTemplate.template_sql || ''}
                    onChange={e => setNewTemplate({ ...newTemplate, template_sql: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-foreground mb-1">Handlebars</div>
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

            <div className="bg-card text-card-foreground rounded-xl border border-border p-4 mb-6">
              <div className="text-lg font-semibold text-foreground mb-4">Planifications</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-foreground mb-1">Nom</div>
                  <Input value={newSchedule.name} onChange={e => setNewSchedule({ ...newSchedule, name: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-foreground mb-1">Description</div>
                  <Input
                    value={newSchedule.description || ''}
                    onChange={e => setNewSchedule({ ...newSchedule, description: e.target.value })}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground mb-1">Source</div>
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
                  <div className="text-sm font-medium text-foreground mb-1">Format</div>
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
                  <div className="text-sm font-medium text-foreground mb-1">Template</div>
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
                  <div className="text-sm font-medium text-foreground mb-1">CRON</div>
                  <Input value={newSchedule.cron} onChange={e => setNewSchedule({ ...newSchedule, cron: e.target.value })} />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground mb-1">Timezone</div>
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
                <div className="text-sm text-muted-foreground">Aucune planification.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium px-4 py-3">Nom</th>
                        <th className="text-left font-medium px-4 py-3">Source</th>
                        <th className="text-left font-medium px-4 py-3">Format</th>
                        <th className="text-left font-medium px-4 py-3">CRON</th>
                        <th className="text-left font-medium px-4 py-3">Actif</th>
                        <th className="text-left font-medium px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportSchedules.map(s => (
                        <tr key={s.id} className="border-t">
                          <td className="px-4 py-3 text-foreground">{s.name}</td>
                          <td className="px-4 py-3 text-foreground">{s.source}</td>
                          <td className="px-4 py-3 text-foreground">{s.format}</td>
                          <td className="px-4 py-3 text-muted-foreground font-mono">{s.cron}</td>
                          <td className="px-4 py-3 text-muted-foreground">{s.is_active ? 'Oui' : 'Non'}</td>
                          <td className="px-4 py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await schedulesApi.deactivate(s.id);
                                  setExportSchedules(prev => prev.filter(x => x.id !== s.id));
                                } catch (e) {
                                  setExportSchedulesError(e instanceof Error ? e.message : 'Erreur suppression');
                                }
                              }}
                            >
                              Désactiver
                            </Button>
                          </td>
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
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-800 dark:text-green-300 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{attrNotice}</span>
              </div>
            )}

            {attrError && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{attrError}</span>
              </div>
            )}

            {attrSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatsCard
                  title="Mailles notifiables"
                  value={attrSummary.total_assignments}
                  icon={<BarChart3 className="w-6 h-6" />}
                  color="bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200"
                />
                <StatsCard
                  title="Missions affectées"
                  value={attrSummary.missions_with_student}
                  icon={<Users className="w-6 h-6" />}
                  color="bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-200"
                />
                <StatsCard
                  title="Notifications en attente"
                  value={attrSummary.pending_notifications}
                  icon={<FileText className="w-6 h-6" />}
                  color="bg-orange-50 dark:bg-orange-900/20 text-orange-900 dark:text-orange-200"
                />
                <StatsCard
                  title="Étudiants"
                  value={attrSummary.total_students}
                  icon={<ClipboardList className="w-6 h-6" />}
                  color="bg-purple-50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-200"
                />
              </div>
            )}

            {/* Barre filtres + actions */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Recherche
                  </label>
                  <input
                    value={attrStudentFilter}
                    onChange={e => setAttrStudentFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nom, email ou matricule..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Statut notification
                  </label>
                  <select
                    value={attrNotifStatusFilter}
                    onChange={e => setAttrNotifStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Tous</option>
                    <option value="unassigned">Sans étudiant</option>
                    <option value="skipped">Non notifiable</option>
                    <option value="never">Jamais notifié</option>
                    <option value="pending">En attente d'envoi</option>
                    <option value="sent">Notification envoyée</option>
                    <option value="failed">Échec d'envoi</option>
                  </select>
                </div>
                <div className="flex items-end justify-end gap-2">
                  <Button
                    onClick={() => {
                      setAttrEnqueueError(null);
                      setAttrConfirmOpen(true);
                    }}
                    disabled={Object.values(attrSelected).filter(Boolean).length === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Notifier ({Object.values(attrSelected).filter(Boolean).length})
                  </Button>
                </div>
              </div>
            </div>

            {attrEnqueueError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {attrEnqueueError}
              </div>
            )}

            {/* Table attributions */}
            <CollapsibleCard title="Attributions missions" subtitle={`${attrItems.length} lignes`} defaultOpen>
              <div className="max-h-[65vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          className="rounded"
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
                      <th className="text-left px-4 py-3 font-semibold">Mission</th>
                      <th className="text-left px-4 py-3 font-semibold">Maille</th>
                      <th className="text-left px-4 py-3 font-semibold">Étudiant</th>
                      <th className="text-left px-4 py-3 font-semibold">Attribution</th>
                      <th className="text-left px-4 py-3 font-semibold">Notification</th>
                      <th className="text-left px-4 py-3 font-semibold">Dernier envoi</th>
                      <th className="text-right px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {attrItems.map(i => (
                      <tr key={i.mission_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="rounded"
                            disabled={i.attribution_status !== 'notifiable' || !i.assignment_id}
                            checked={!!(i.assignment_id && attrSelected[i.assignment_id])}
                            onChange={e => {
                              if (!i.assignment_id) return;
                              setAttrSelected(prev => ({ ...prev, [i.assignment_id as string]: e.target.checked }));
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100 leading-snug">
                            {i.mission_title || i.mission_code}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{i.mission_code}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                            {i.maille_code}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {i.full_name ? (
                            <>
                              <div className="font-medium text-slate-900 dark:text-slate-100">{i.full_name}</div>
                              <div className="text-xs text-slate-400 dark:text-slate-500">{i.email || ''}</div>
                            </>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic text-xs">Non attribué</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {i.attribution_status === 'notifiable' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              Prêt
                            </span>
                          )}
                          {i.attribution_status === 'unassigned' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              Sans étudiant
                            </span>
                          )}
                          {i.attribution_status === 'notified' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                              Notifié
                            </span>
                          )}
                          {i.attribution_status === 'assigned_not_notifiable' && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 cursor-help"
                              title={i.status_reason || ''}
                            >
                              Non notifiable
                            </span>
                          )}
                          {i.attribution_status === 'error' && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 cursor-help"
                              title={i.status_reason || ''}
                            >
                              Erreur
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {i.notification_status === 'sent' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                              ✓ Envoyé
                            </span>
                          )}
                          {i.notification_status === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse inline-block" />
                              En attente
                            </span>
                          )}
                          {i.notification_status === 'failed' && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 cursor-help"
                              title={i.notification_error || ''}
                            >
                              ✗ Échec
                            </span>
                          )}
                          {(!i.notification_status || i.notification_status === 'never') && (
                            <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                          {i.notification_sent_at
                            ? new Date(i.notification_sent_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {i.attribution_status === 'unassigned' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
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
                              className="text-xs"
                              disabled={i.attribution_status !== 'notifiable' || !i.assignment_id}
                              onClick={() => {
                                if (!i.assignment_id) return;
                                setAttrSelected(prev => ({ ...prev, [i.assignment_id as string]: true }));
                                setAttrConfirmOpen(true);
                              }}
                            >
                              <Bell className="w-3 h-3 mr-1" />
                              Notifier
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {attrItems.length === 0 && (
                      <tr>
                        <td className="px-4 py-10 text-center text-slate-400 dark:text-slate-500" colSpan={8}>
                          Aucune attribution pour le moment
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CollapsibleCard>

            {/* Jobs d'envoi email */}
            <div className="mt-6">
              <CollapsibleCard
                title="Historique des envois"
                subtitle={notifyJobs.length > 0 ? `${notifyJobs.length} envoi${notifyJobs.length > 1 ? 's' : ''}` : 'Aucun envoi'}
                defaultOpen={notifyJobs.length > 0}
              >
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Chaque ligne correspond à un groupe d'envois déclenché depuis l'interface.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
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
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${notifyJobsLoading ? 'animate-spin' : ''}`} />
                    Rafraîchir
                  </Button>
                </div>

                {notifyJobsError && (
                  <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {notifyJobsError}
                  </div>
                )}

                <div className="max-h-[50vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold">Envoi</th>
                        <th className="text-left px-4 py-3 font-semibold">Destinataires</th>
                        <th className="text-left px-4 py-3 font-semibold">Statut</th>
                        <th className="text-left px-4 py-3 font-semibold">Options</th>
                        <th className="text-left px-4 py-3 font-semibold">Erreur</th>
                        <th className="text-right px-4 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {notifyJobs.map(j => {
                        const recipientCount = Array.isArray(j.params?.assignment_ids) ? j.params.assignment_ids.length : null;
                        const opts = j.params?.options || {};
                        return (
                          <tr key={j.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3">
                              <div
                                className="font-medium text-slate-900 dark:text-slate-100 cursor-help"
                                title={j.id}
                              >
                                {new Date(j.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {j.started_at && (
                                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                  Traité à {new Date(j.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {recipientCount !== null ? (
                                <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                  <Users className="w-3.5 h-3.5 text-slate-400" />
                                  {recipientCount} étudiant{recipientCount > 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {j.status === 'completed' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                                  ✓ Terminé
                                </span>
                              )}
                              {j.status === 'failed' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700">
                                  ✗ Échoué
                                </span>
                              )}
                              {j.status === 'running' && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  En cours...
                                </span>
                              )}
                              {j.status === 'pending' && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse inline-block" />
                                  En attente
                                </span>
                              )}
                              {j.status === 'cancelled' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                  Annulé
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 flex-wrap">
                                {opts.include_bbox && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded">bbox</span>
                                )}
                                {opts.include_pdf && (
                                  <span className="text-xs px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 rounded">PDF</span>
                                )}
                                {opts.include_geojson && (
                                  <span className="text-xs px-1.5 py-0.5 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-300 rounded">GeoJSON</span>
                                )}
                                {opts.include_instructions && (
                                  <span className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded">instructions</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-red-500 dark:text-red-400 max-w-[180px] truncate" title={j.error || ''}>
                              {j.error || '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
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
                        );
                      })}
                      {notifyJobs.length === 0 && (
                        <tr>
                          <td className="px-4 py-10 text-center text-slate-400 dark:text-slate-500" colSpan={6}>
                            Aucun envoi pour le moment
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CollapsibleCard>
            </div>

            {/* Détail par étudiant */}
            <div className="mt-6">
              <CollapsibleCard
                title="Détail des envois par étudiant"
                subtitle={attrHistory.length > 0 ? `${attrHistory.length} entrée${attrHistory.length > 1 ? 's' : ''}` : 'Aucune entrée'}
                defaultOpen={false}
              >
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Trace individuelle de chaque notification envoyée à un étudiant. Se peuple automatiquement après chaque envoi réussi.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
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
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${attrHistoryLoading ? 'animate-spin' : ''}`} />
                    Actualiser
                  </Button>
                </div>

                {attrHistoryError && (
                  <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {attrHistoryError}
                  </div>
                )}

                <div className="max-h-[50vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold">Date d'envoi</th>
                        <th className="text-left px-4 py-3 font-semibold">Étudiant</th>
                        <th className="text-left px-4 py-3 font-semibold">Maille</th>
                        <th className="text-left px-4 py-3 font-semibold">Résultat</th>
                        <th className="text-left px-4 py-3 font-semibold">Détail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {attrHistory.map(h => (
                        <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">
                            {new Date(h.sent_at || h.requested_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900 dark:text-slate-100">{h.full_name}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500">{h.email || ''}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                              {h.maille_code}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {h.status === 'sent' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                                ✓ Envoyé
                              </span>
                            )}
                            {h.status === 'pending' && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse inline-block" />
                                En attente
                              </span>
                            )}
                            {h.status === 'failed' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700">
                                ✗ Échec
                              </span>
                            )}
                            {h.status !== 'sent' && h.status !== 'pending' && h.status !== 'failed' && (
                              <span className="text-xs text-slate-400 dark:text-slate-500">{h.status}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-red-500 dark:text-red-400 max-w-[200px] truncate" title={h.error || ''}>
                            {h.error || '—'}
                          </td>
                        </tr>
                      ))}
                      {attrHistory.length === 0 && (
                        <tr>
                          <td className="px-4 py-10 text-center" colSpan={5}>
                            <div className="text-slate-400 dark:text-slate-500 text-sm">Aucune trace d'envoi pour le moment</div>
                            <div className="text-slate-400 dark:text-slate-500 text-xs mt-1">Les données apparaîtront ici après le premier envoi réussi</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CollapsibleCard>
            </div>

            {attrConfirmOpen && (
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
                onClick={() => !attrEnqueueLoading && setAttrConfirmOpen(false)}
              >
                <div
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div>
                      <div className="text-base font-semibold">Confirmer l’envoi des notifications</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {Object.values(attrSelected).filter(Boolean).length}
                        </span> attribution(s)
                      </div>
                    </div>
                    <button
                      onClick={() => setAttrConfirmOpen(false)}
                      disabled={attrEnqueueLoading}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="px-5 py-4 space-y-1">
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Contenu du mail</p>
                    <label className="flex items-center gap-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600"
                        checked={attrIncludeBbox}
                        onChange={e => setAttrIncludeBbox(e.target.checked)}
                      />
                      <span>Inclure la BBox (emprise géographique)</span>
                    </label>
                    <label className="flex items-center gap-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600"
                        checked={attrIncludeInstructions}
                        onChange={e => setAttrIncludeInstructions(e.target.checked)}
                      />
                      <span>Inclure les instructions terrain</span>
                    </label>
                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Pièces jointes</p>
                    <label className="flex items-center gap-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600"
                        checked={attrIncludePdf}
                        onChange={e => setAttrIncludePdf(e.target.checked)}
                      />
                      <span>Joindre le PDF ordre de mission</span>
                    </label>
                    <label className="flex items-center gap-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600"
                        checked={attrIncludeGeojson}
                        onChange={e => setAttrIncludeGeojson(e.target.checked)}
                      />
                      <span>Joindre le fichier GeoJSON de la maille (ZIP)</span>
                    </label>
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-xs text-blue-700 dark:text-blue-300 leading-relaxed mt-2">
                      Les emails sont traités par le worker local. Seul l'enregistrement est effectué ici.
                    </div>
                    {attrEnqueueError && (
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-sm text-red-700 dark:text-red-300">
                        {attrEnqueueError}
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAttrConfirmOpen(false)} disabled={attrEnqueueLoading}>
                      Annuler
                    </Button>
                    <button
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
                            include_pdf: attrIncludePdf,
                            include_geojson: attrIncludeGeojson,
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
                          setAttrItems(listRes.items.map(item =>
                            ids.includes(item.assignment_id as string)
                              ? { ...item, notification_status: 'pending' }
                              : item
                          ));
                          setAttrHistory(historyRes.items || []);
                          setAttrNotice(`${ids.length} notification${ids.length > 1 ? 's' : ''} programmée${ids.length > 1 ? 's' : ''} — job en attente de traitement`);
                          window.setTimeout(() => setAttrNotice(null), 6000);
                          setAttrConfirmOpen(false);
                        } catch (e) {
                          setAttrEnqueueError(e instanceof Error ? e.message : "Erreur enregistrement");
                        } finally {
                          setAttrEnqueueLoading(false);
                        }
                      }}
                      disabled={attrEnqueueLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {attrEnqueueLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        "Confirmer"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {attrAssignOpen && attrAssignMission && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                <div className="bg-card text-card-foreground w-full max-w-lg rounded-xl shadow-lg border border-border overflow-hidden">
                  <div className="px-5 py-4 border-b">
                    <div className="text-lg font-semibold text-foreground">
                      {attrAssignMode === 'assign_student'
                        ? 'Assigner un étudiant'
                        : attrAssignMode === 'assign_holder'
                          ? 'Assigner le détenteur'
                          : 'Changer l’étudiant'}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Mission <span className="font-mono">{attrAssignMission.mission_code}</span> — maille{' '}
                      <span className="font-mono">{attrAssignMission.maille_code}</span>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <div className="text-sm font-medium text-foreground mb-1">Étudiant (recherche)</div>
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
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${
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
                    <div className="text-xs text-muted-foreground">
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
                <div className="bg-card text-card-foreground w-full max-w-lg rounded-xl shadow-lg border border-border overflow-hidden">
                  <div className="px-5 py-4 border-b">
                    <div className="text-lg font-semibold text-foreground">Reprendre la maille</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Mission <span className="font-mono">{takeoverMission.code}</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    {takeoverError && <div className="text-sm text-red-600">{takeoverError}</div>}
                    <div className="text-sm text-foreground">
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
          <StudentsTab
            stats={stats}
            error={error}
            loading={loading}
            studentsSearch={studentsSearch}
            onStudentsSearchChange={setStudentsSearch}
            studentsActiveFilter={studentsActiveFilter}
            onStudentsActiveFilterChange={v => setStudentsActiveFilter(v)}
            studentsSort={studentsSort}
            onStudentsSortChange={v => setStudentsSort(v)}
            studentsAuditMode={studentsAuditMode}
            onStudentsAuditModeChange={v => {
              setStudentsAuditMode(v);
              if (v) setStudentsIncludeDeleted(true);
            }}
            studentsIncludeDeleted={studentsIncludeDeleted}
            onStudentsIncludeDeletedChange={v => setStudentsIncludeDeleted(v)}
            studentsDuplicatesOnly={studentsDuplicatesOnly}
            onStudentsDuplicatesOnlyChange={v => setStudentsDuplicatesOnly(v)}
            filteredStudents={filteredStudents}
            total={total}
            duplicatePhones={duplicatePhones}
            actionLoading={actionLoading}
            onOpenStudentDetail={studentId => {
              setSelectedStudentId(studentId);
              setShowStudentDetailModal(true);
            }}
            onEditStudent={s => {
              setSelectedStudent(s);
              setShowUpdateStudentModal(true);
            }}
            onToggleStudentActive={s => {
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
            onDeleteStudent={s => {
              setSelectedStudent(s);
              setShowDeleteStudentModal(true);
            }}
          />
        )}

        {activeTab === 'supervisors' && (
          <SupervisorsTab
            stats={stats}
            error={error}
            loading={loading}
            supervisorsSearch={supervisorsSearch}
            onSupervisorsSearchChange={setSupervisorsSearch}
            supervisorsActiveFilter={supervisorsActiveFilter}
            onSupervisorsActiveFilterChange={v => setSupervisorsActiveFilter(v)}
            supervisorsSort={supervisorsSort}
            onSupervisorsSortChange={v => setSupervisorsSort(v)}
            filteredSupervisors={filteredSupervisors}
            total={total}
            actionLoading={actionLoading}
            onOpenSupervisorDetail={supervisorId => {
              setSelectedSupervisorId(supervisorId);
              setShowSupervisorDetailModal(true);
            }}
            onEditSupervisor={s => {
              setSelectedSupervisor(s);
              setShowUpdateSupervisorModal(true);
            }}
            onToggleSupervisorActive={s => {
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
            onDeleteSupervisor={s => {
              setSelectedSupervisor(s);
              setShowDeleteSupervisorModal(true);
            }}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentsTab
            stats={stats}
            documentsSearch={documentsSearch}
            onDocumentsSearchChange={setDocumentsSearch}
            documentsSort={documentsSort}
            onDocumentsSortChange={v => setDocumentsSort(v)}
            onOpenUpload={() => setShowUploadDocumentModal(true)}
            documentsMissionId={documentsMissionId}
            onDocumentsMissionIdChange={setDocumentsMissionId}
            documentsType={documentsType}
            onDocumentsTypeChange={setDocumentsType}
            onApplyFilters={() => loadData()}
            documentsError={documentsError}
            documentsLoading={documentsLoading}
            filteredDocuments={filteredDocuments}
            effectiveTotal={effectiveTotal}
            onDownload={async d => {
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
            onDelete={async d => {
              try {
                await documentsApi.delete(d.id);
                await loadData();
              } catch (err) {
                setDocumentsError(err instanceof Error ? err.message : 'Erreur suppression');
              }
            }}
          />
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
        description={selectedMissionToDelete ? `Confirmer la suppression de ${selectedMissionToDelete.title} ?` : "Confirmer la suppression ?"}
        confirmLabel="Supprimer"
        destructive={true}
        loading={actionLoading}
        error={actionError}
        onClose={() => { setShowDeleteMissionModal(false); setActionError(null); }}
        onConfirm={async () => {
          if (!selectedMissionToDelete) return;
          setActionLoading(true);
          setActionError(null);
          try {
            await missionsApi.delete(selectedMissionToDelete.id);
            setMissions(prev => prev.filter(m => m.id !== selectedMissionToDelete.id));
            setTotal(prev => Math.max(0, prev - 1));
            setStats(prev => (prev ? { ...prev, total_missions: Math.max(0, prev.total_missions - 1) } : prev));
            setShowDeleteMissionModal(false);
            setActionError(null);
          } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
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
        description={selectedStudent ? `Confirmer la suppression de ${selectedStudent.full_name} ?` : "Confirmer la suppression ?"}
        confirmLabel="Supprimer"
        destructive={true}
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
        description={selectedSupervisor ? `Confirmer la suppression de ${selectedSupervisor.full_name} ?` : "Confirmer la suppression ?"}
        confirmLabel="Supprimer"
        destructive={true}
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
