/**
 * Formulaire de création/édition de Mission - Atlas Colab Studio
 * 
 * Formulaire complet avec :
 * - Informations générales
 * - Localisation (commune entière ou sélection de mailles)
 * - Période & objectifs
 * - Encadrement
 * - Affectation étudiants
 * - Options avancées
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Calendar,
  Users,
  Target,
  Settings,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Grid3X3,
  Building2,
  GraduationCap,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================================
// Types
// ============================================================================

export interface MissionFormValues {
  // Section 1 - Informations générales
  code: string;
  title: string;
  theme: 'reconnaissance' | 'etude_detaillee' | 'controle' | 'stabilisation' | 'synthese';
  ouvrage_type: string;
  description: string;

  // Section 2 - Localisation
  zone_type: 'adm3_full' | 'mailles_selection';
  adm1_id?: string;
  adm2_id?: string;
  adm3_id?: string;
  maille_ids: string[];

  // Section 3 - Période & objectifs
  start_date?: string;
  end_date?: string;
  target_sondages?: number;
  min_sondages_per_student?: number;

  // Section 4 - Encadrement
  ue_module?: string;
  niveau?: 'L3' | 'M1' | 'M2';
  supervisor_ids: string[];

  // Section 5 - Affectation étudiants
  student_assignments: { student_id: string; role: 'responsable' | 'membre' | 'observateur' }[];
  is_open_mission: boolean;

  // Section 6 - Options avancées
  is_visible_in_mobile: boolean;
  auto_accept_requests: boolean;
  allow_sondages_outside_zone: boolean;
  security_notes?: string;
}

interface ADMOption {
  id: string;
  name: string;
  code?: string;
}

interface MailleOption {
  id: string;
  code: string;
  adm1_name: string;
  adm2_name: string;
  adm3_name: string;
}

interface SupervisorOption {
  id: string;
  name: string;
  specialty?: string;
}

interface StudentOption {
  id: string;
  name: string;
  email: string;
  matricule?: string;
}

interface MissionFormProps {
  initialValues?: Partial<MissionFormValues>;
  onSubmit: (values: MissionFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

// ============================================================================
// Constantes
// ============================================================================

const THEMES = [
  { value: 'reconnaissance', label: 'Reconnaissance' },
  { value: 'etude_detaillee', label: 'Étude détaillée' },
  { value: 'controle', label: 'Contrôle' },
  { value: 'stabilisation', label: 'Stabilisation' },
  { value: 'synthese', label: 'Synthèse' },
];

const OUVRAGE_TYPES = [
  { value: 'route', label: 'Route' },
  { value: 'batiment', label: 'Bâtiment' },
  { value: 'reservoir', label: 'Réservoir' },
  { value: 'assainissement', label: 'Ouvrage d\'assainissement' },
  { value: 'autre', label: 'Autre' },
];

const NIVEAUX = [
  { value: 'L3', label: 'Licence 3' },
  { value: 'M1', label: 'Master 1' },
  { value: 'M2', label: 'Master 2' },
];

const DEFAULT_VALUES: MissionFormValues = {
  code: '',
  title: '',
  theme: 'reconnaissance',
  ouvrage_type: '',
  description: '',
  zone_type: 'adm3_full',
  maille_ids: [],
  supervisor_ids: [],
  student_assignments: [],
  is_open_mission: false,
  is_visible_in_mobile: true,
  auto_accept_requests: false,
  allow_sondages_outside_zone: false,
};

// ============================================================================
// Composant Principal
// ============================================================================

const MissionForm: React.FC<MissionFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [values, setValues] = useState<MissionFormValues>({ ...DEFAULT_VALUES, ...initialValues });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['general', 'location']));
  
  // Options chargées depuis l'API
  const [adm1Options, setAdm1Options] = useState<ADMOption[]>([]);
  const [adm2Options, setAdm2Options] = useState<ADMOption[]>([]);
  const [adm3Options, setAdm3Options] = useState<ADMOption[]>([]);
  const [mailleSearch, setMailleSearch] = useState('');
  const [mailleResults, setMailleResults] = useState<MailleOption[]>([]);
  const [selectedMailles, setSelectedMailles] = useState<MailleOption[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loadingMailles, setLoadingMailles] = useState(false);

  // Charger les options ADM1 au montage
  useEffect(() => {
    loadADM1Options();
    loadSupervisors();
    loadStudents();
  }, []);

  // Charger ADM2 quand ADM1 change
  useEffect(() => {
    if (values.adm1_id) {
      loadADM2Options(values.adm1_id);
    } else {
      setAdm2Options([]);
      setValues(v => ({ ...v, adm2_id: undefined, adm3_id: undefined }));
    }
  }, [values.adm1_id]);

  // Charger ADM3 quand ADM2 change
  useEffect(() => {
    if (values.adm2_id) {
      loadADM3Options(values.adm2_id);
    } else {
      setAdm3Options([]);
      setValues(v => ({ ...v, adm3_id: undefined }));
    }
  }, [values.adm2_id]);

  // API calls (simulées pour l'instant)
  const loadADM1Options = async () => {
    // TODO: Appeler l'API réelle
    setAdm1Options([
      { id: '1', name: 'Maritime', code: 'MR' },
      { id: '2', name: 'Plateaux', code: 'PL' },
      { id: '3', name: 'Centrale', code: 'CE' },
      { id: '4', name: 'Kara', code: 'KR' },
      { id: '5', name: 'Savanes', code: 'SV' },
    ]);
  };

  const loadADM2Options = async (adm1Id: string) => {
    // TODO: Appeler l'API réelle
    setAdm2Options([
      { id: '1', name: 'Golfe', code: 'GLF' },
      { id: '2', name: 'Lacs', code: 'LAC' },
      { id: '3', name: 'Vo', code: 'VO' },
    ]);
  };

  const loadADM3Options = async (adm2Id: string) => {
    // TODO: Appeler l'API réelle
    setAdm3Options([
      { id: '1', name: 'Lomé Commune' },
      { id: '2', name: 'Baguida' },
      { id: '3', name: 'Agoè-Nyivé' },
    ]);
  };

  const loadSupervisors = async () => {
    // TODO: Appeler l'API réelle
    setSupervisors([
      { id: '1', name: 'Dr. Kofi Mensah', specialty: 'Géotechnique' },
      { id: '2', name: 'Prof. Ama Sika', specialty: 'Hydrogéologie' },
    ]);
  };

  const loadStudents = async () => {
    // TODO: Appeler l'API réelle
    setStudents([
      { id: '1', name: 'Jean Dupont', email: 'jean@example.com', matricule: '2024-GC-001' },
      { id: '2', name: 'Marie Koffi', email: 'marie@example.com', matricule: '2024-GC-002' },
    ]);
  };

  const searchMailles = async (query: string) => {
    if (query.length < 2) {
      setMailleResults([]);
      return;
    }
    setLoadingMailles(true);
    // TODO: Appeler l'API réelle
    setTimeout(() => {
      setMailleResults([
        { id: '1', code: 'ML-2025-001', adm1_name: 'Maritime', adm2_name: 'Golfe', adm3_name: 'Lomé' },
        { id: '2', code: 'ML-2025-002', adm1_name: 'Maritime', adm2_name: 'Golfe', adm3_name: 'Lomé' },
      ]);
      setLoadingMailles(false);
    }, 300);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleChange = <K extends keyof MissionFormValues>(field: K, value: MissionFormValues[K]) => {
    setValues(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addMaille = (maille: MailleOption) => {
    if (!selectedMailles.find(m => m.id === maille.id)) {
      setSelectedMailles(prev => [...prev, maille]);
      setValues(prev => ({ ...prev, maille_ids: [...prev.maille_ids, maille.id] }));
    }
    setMailleSearch('');
    setMailleResults([]);
  };

  const removeMaille = (mailleId: string) => {
    setSelectedMailles(prev => prev.filter(m => m.id !== mailleId));
    setValues(prev => ({ ...prev, maille_ids: prev.maille_ids.filter(id => id !== mailleId) }));
  };

  const addStudent = (student: StudentOption, role: 'responsable' | 'membre' | 'observateur' = 'membre') => {
    if (!values.student_assignments.find(a => a.student_id === student.id)) {
      setValues(prev => ({
        ...prev,
        student_assignments: [...prev.student_assignments, { student_id: student.id, role }],
      }));
    }
    setStudentSearch('');
  };

  const removeStudent = (studentId: string) => {
    setValues(prev => ({
      ...prev,
      student_assignments: prev.student_assignments.filter(a => a.student_id !== studentId),
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!values.title.trim()) newErrors.title = 'Titre requis';
    if (!values.code.trim()) newErrors.code = 'Code requis';

    if (values.zone_type === 'adm3_full' && !values.adm3_id) {
      newErrors.adm3_id = 'Commune requise';
    }
    if (values.zone_type === 'mailles_selection' && values.maille_ids.length === 0) {
      newErrors.maille_ids = 'Sélectionnez au moins une maille';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(values);
  };

  // Résumé zone
  const zoneSummary = useMemo(() => {
    if (values.zone_type === 'mailles_selection') {
      const communes = new Set(selectedMailles.map(m => m.adm3_name));
      return {
        mailles: selectedMailles.length,
        communes: communes.size,
        regions: new Set(selectedMailles.map(m => m.adm1_name)).size,
      };
    }
    return null;
  }, [selectedMailles, values.zone_type]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch) return [];
    const query = studentSearch.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.email.toLowerCase().includes(query) ||
      s.matricule?.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [studentSearch, students]);

  // ============================================================================
  // Render
  // ============================================================================

  const SectionHeader: React.FC<{ id: string; title: string; icon: React.ReactNode }> = ({ id, title, icon }) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">{icon}</div>
        <span className="font-medium text-gray-900">{title}</span>
      </div>
      {expandedSections.has(id) ? (
        <ChevronUp className="h-5 w-5 text-gray-400" />
      ) : (
        <ChevronDown className="h-5 w-5 text-gray-400" />
      )}
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Section 1 - Informations générales */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <SectionHeader id="general" title="Informations générales" icon={<FileText className="h-5 w-5" />} />
        {expandedSections.has('general') && (
          <div className="p-4 space-y-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code mission *</label>
                <input
                  type="text"
                  value={values.code}
                  onChange={e => handleChange('code', e.target.value)}
                  placeholder="M-2025-LOME-001"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.code ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.code && <p className="mt-1 text-sm text-red-600">{errors.code}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thème *</label>
                <select
                  value={values.theme}
                  onChange={e => handleChange('theme', e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {THEMES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
              <input
                type="text"
                value={values.title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder="Mission de reconnaissance géotechnique..."
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.title ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type d'ouvrage</label>
                <select
                  value={values.ouvrage_type}
                  onChange={e => handleChange('ouvrage_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Sélectionner --</option>
                  {OUVRAGE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={values.description}
                onChange={e => handleChange('description', e.target.value)}
                placeholder="Objectifs pédagogiques et techniques de la mission..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Section 2 - Localisation */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <SectionHeader id="location" title="Localisation & zone d'étude" icon={<MapPin className="h-5 w-5" />} />
        {expandedSections.has('location') && (
          <div className="p-4 space-y-4 border-t">
            {/* Type de zone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type de zone</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="zone_type"
                    value="adm3_full"
                    checked={values.zone_type === 'adm3_full'}
                    onChange={() => handleChange('zone_type', 'adm3_full')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Commune entière (ADM3)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="zone_type"
                    value="mailles_selection"
                    checked={values.zone_type === 'mailles_selection'}
                    onChange={() => handleChange('zone_type', 'mailles_selection')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <Grid3X3 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Sélection de maille(s)</span>
                </label>
              </div>
            </div>

            {/* Sélecteurs ADM */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Région (ADM1) {values.zone_type === 'adm3_full' && '*'}
                </label>
                <select
                  value={values.adm1_id || ''}
                  onChange={e => handleChange('adm1_id', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Sélectionner --</option>
                  {adm1Options.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Préfecture (ADM2) {values.zone_type === 'adm3_full' && '*'}
                </label>
                <select
                  value={values.adm2_id || ''}
                  onChange={e => handleChange('adm2_id', e.target.value || undefined)}
                  disabled={!values.adm1_id}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">-- Sélectionner --</option>
                  {adm2Options.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Commune (ADM3) {values.zone_type === 'adm3_full' && '*'}
                </label>
                <select
                  value={values.adm3_id || ''}
                  onChange={e => handleChange('adm3_id', e.target.value || undefined)}
                  disabled={!values.adm2_id}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.adm3_id ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">-- Sélectionner --</option>
                  {adm3Options.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                {errors.adm3_id && <p className="mt-1 text-sm text-red-600">{errors.adm3_id}</p>}
              </div>
            </div>

            {/* Sélection de mailles */}
            {values.zone_type === 'mailles_selection' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rechercher une maille</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={mailleSearch}
                      onChange={e => {
                        setMailleSearch(e.target.value);
                        searchMailles(e.target.value);
                      }}
                      placeholder="Rechercher par ID, code ou nom..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {loadingMailles && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                    )}
                  </div>
                  
                  {/* Résultats de recherche */}
                  {mailleResults.length > 0 && (
                    <div className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {mailleResults.map(maille => (
                        <button
                          key={maille.id}
                          type="button"
                          onClick={() => addMaille(maille)}
                          className="w-full flex items-center justify-between p-2 hover:bg-gray-50 text-left"
                        >
                          <div>
                            <span className="font-mono text-sm text-blue-600">{maille.code}</span>
                            <span className="text-sm text-gray-500 ml-2">
                              {maille.adm3_name}, {maille.adm2_name}
                            </span>
                          </div>
                          <Plus className="h-4 w-4 text-gray-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mailles sélectionnées */}
                {selectedMailles.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mailles sélectionnées ({selectedMailles.length})
                    </label>
                    <div className="border rounded-lg divide-y">
                      {selectedMailles.map((maille, idx) => (
                        <div key={maille.id} className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400">{idx + 1}</span>
                            <span className="font-mono text-sm">{maille.code}</span>
                            <span className="text-sm text-gray-500">
                              {maille.adm1_name} / {maille.adm2_name} / {maille.adm3_name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMaille(maille.id)}
                            className="p-1 hover:bg-red-50 rounded text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {errors.maille_ids && (
                  <p className="text-sm text-red-600">{errors.maille_ids}</p>
                )}

                {/* Résumé */}
                {zoneSummary && zoneSummary.mailles > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3 text-sm">
                    <p className="text-blue-800">
                      <strong>{zoneSummary.mailles}</strong> maille(s) sélectionnée(s) •{' '}
                      <strong>{zoneSummary.communes}</strong> commune(s) •{' '}
                      <strong>{zoneSummary.regions}</strong> région(s)
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 3 - Période & objectifs */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <SectionHeader id="period" title="Période & objectifs" icon={<Calendar className="h-5 w-5" />} />
        {expandedSections.has('period') && (
          <div className="p-4 space-y-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                <input
                  type="date"
                  value={values.start_date || ''}
                  onChange={e => handleChange('start_date', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                <input
                  type="date"
                  value={values.end_date || ''}
                  onChange={e => handleChange('end_date', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objectif de sondages</label>
                <input
                  type="number"
                  min="0"
                  value={values.target_sondages || ''}
                  onChange={e => handleChange('target_sondages', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Ex: 20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min. sondages par étudiant</label>
                <input
                  type="number"
                  min="0"
                  value={values.min_sondages_per_student || ''}
                  onChange={e => handleChange('min_sondages_per_student', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Ex: 5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 4 - Encadrement */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <SectionHeader id="supervision" title="Encadrement / Pédagogie" icon={<GraduationCap className="h-5 w-5" />} />
        {expandedSections.has('supervision') && (
          <div className="p-4 space-y-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UE / Module de cours</label>
                <input
                  type="text"
                  value={values.ue_module || ''}
                  onChange={e => handleChange('ue_module', e.target.value || undefined)}
                  placeholder="Ex: GC-401 Géotechnique"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
                <select
                  value={values.niveau || ''}
                  onChange={e => handleChange('niveau', e.target.value as any || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Sélectionner --</option>
                  {NIVEAUX.map(n => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Encadreurs</label>
              <div className="space-y-2">
                {supervisors.map(sup => (
                  <label key={sup.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={values.supervisor_ids.includes(sup.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          handleChange('supervisor_ids', [...values.supervisor_ids, sup.id]);
                        } else {
                          handleChange('supervisor_ids', values.supervisor_ids.filter(id => id !== sup.id));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">{sup.name}</span>
                    {sup.specialty && <span className="text-xs text-gray-500">({sup.specialty})</span>}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 5 - Affectation étudiants */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <SectionHeader id="students" title="Affectation étudiants" icon={<Users className="h-5 w-5" />} />
        {expandedSections.has('students') && (
          <div className="p-4 space-y-4 border-t">
            {/* Recherche étudiant */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ajouter un étudiant</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  placeholder="Rechercher par nom, email ou matricule..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {filteredStudents.length > 0 && (
                <div className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {filteredStudents.map(student => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => addStudent(student)}
                      className="w-full flex items-center justify-between p-2 hover:bg-gray-50 text-left"
                    >
                      <div>
                        <span className="font-medium text-sm">{student.name}</span>
                        <span className="text-sm text-gray-500 ml-2">{student.matricule}</span>
                      </div>
                      <Plus className="h-4 w-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Liste des étudiants affectés */}
            {values.student_assignments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Étudiants affectés ({values.student_assignments.length})
                </label>
                <div className="border rounded-lg divide-y">
                  {values.student_assignments.map(assignment => {
                    const student = students.find(s => s.id === assignment.student_id);
                    return (
                      <div key={assignment.student_id} className="flex items-center justify-between p-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-sm">{student?.name || 'Inconnu'}</span>
                          <select
                            value={assignment.role}
                            onChange={e => {
                              setValues(prev => ({
                                ...prev,
                                student_assignments: prev.student_assignments.map(a =>
                                  a.student_id === assignment.student_id
                                    ? { ...a, role: e.target.value as any }
                                    : a
                                ),
                              }));
                            }}
                            className="text-xs border rounded px-2 py-1"
                          >
                            <option value="responsable">Responsable</option>
                            <option value="membre">Membre</option>
                            <option value="observateur">Observateur</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStudent(assignment.student_id)}
                          className="p-1 hover:bg-red-50 rounded text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mission ouverte */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={values.is_open_mission}
                onChange={e => handleChange('is_open_mission', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm">Mission ouverte (les étudiants peuvent demander à rejoindre)</span>
            </label>
          </div>
        )}
      </div>

      {/* Section 6 - Options avancées */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <SectionHeader id="options" title="Options avancées" icon={<Settings className="h-5 w-5" />} />
        {expandedSections.has('options') && (
          <div className="p-4 space-y-4 border-t">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.is_visible_in_mobile}
                  onChange={e => handleChange('is_visible_in_mobile', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm">Visible dans l'app terrain (Flux)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.auto_accept_requests}
                  onChange={e => handleChange('auto_accept_requests', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm">Accepter automatiquement les demandes de participation</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.allow_sondages_outside_zone}
                  onChange={e => handleChange('allow_sondages_outside_zone', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm">Autoriser la création de sondages hors zone définie</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Consignes de sécurité / logistique
              </label>
              <textarea
                value={values.security_notes || ''}
                onChange={e => handleChange('security_notes', e.target.value || undefined)}
                placeholder="Équipements requis, zones à éviter, contacts d'urgence..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Créer la mission
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default MissionForm;
