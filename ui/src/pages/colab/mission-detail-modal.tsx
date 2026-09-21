import React, { useEffect, useState } from 'react';
import { AlertCircle, FlaskConical, Grid3x3, Loader2, Map, MapPin, X } from 'lucide-react';
import {
  communesApi,
  getStatusColor,
  getStatusLabel,
  getThemeLabel,
  MailleSuggestItem,
  MISSION_STATUSES,
  MISSION_THEMES,
  MissionDetail,
  missionsApi,
  maillesApi,
  regionsApi,
  SondagePointInput,
  SupervisorSummary,
  UpdateMissionRequest,
  formatDate,
} from '../../services/colab-api';
import { Badge, Button, Input, Select } from './ui';
import { usePermissions } from '../../hooks/use-permissions';
import { GpsPickerModal, MaillePickerModal } from './map-picker-modal';
import { LabResultsPanel } from './lab-results-panel';

const MissionDetailModal: React.FC<{
  isOpen: boolean;
  missionId: string | null;
  supervisors: SupervisorSummary[];
  defaultTab?: 'details' | 'edit';
  onClose: () => void;
  onChanged: () => void;
  onGoToDocuments: (missionId: string) => void;
}> = ({ isOpen, missionId, supervisors, defaultTab = 'details', onClose, onChanged, onGoToDocuments }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [status, setStatus] = useState('');
  const [edit, setEdit] = useState<UpdateMissionRequest>({});
  const [tab, setTab] = useState<'details' | 'edit' | 'lab'>('details');

  const { can } = usePermissions();

  const [editMailleQuery, setEditMailleQuery] = useState('');
  const [editMailleSuggestions, setEditMailleSuggestions] = useState<MailleSuggestItem[]>([]);
  const [editMailleLoading, setEditMailleLoading] = useState(false);
  const [editMaillePickerOpen, setEditMaillePickerOpen] = useState(false);

  const [editCommuneQuery, setEditCommuneQuery] = useState('');
  const [editCommuneSuggestions, setEditCommuneSuggestions] = useState<string[]>([]);
  const [editCommuneLoading, setEditCommuneLoading] = useState(false);

  const [editRegionQuery, setEditRegionQuery] = useState('');
  const [editRegionSuggestions, setEditRegionSuggestions] = useState<string[]>([]);
  const [editRegionLoading, setEditRegionLoading] = useState(false);

  const [editGpsPickerOpen, setEditGpsPickerOpen] = useState(false);
  const [editGpsPoints, setEditGpsPoints] = useState<SondagePointInput[]>([]);

  // Génération automatique du plan d'échantillonnage
  const [gridCount, setGridCount] = useState('3');
  const [gridClosePairs, setGridClosePairs] = useState(true);
  const [gridReplace, setGridReplace] = useState(false);
  const [gridBusy, setGridBusy] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);
  const [gridSummary, setGridSummary] = useState<string | null>(null);

  const generateGrid = async (replace: boolean) => {
    if (!missionId) return;
    setGridBusy(true);
    setGridError(null);
    setGridSummary(null);
    try {
      const parsed = parseInt(gridCount, 10);
      const res = await missionsApi.generateSondagePoints(missionId, {
        // La charge de terrain se raisonne par zone : on impose l'effectif à
        // chaque maille plutôt qu'un total réparti au prorata des aires.
        points_per_maille: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
        close_pairs: gridClosePairs,
        replace,
      });
      const points: SondagePointInput[] = res.points.map(p => ({
        numero: p.numero,
        label: p.label,
        lat: p.lat,
        lon: p.lon,
      }));
      setEditGpsPoints(points);
      setEdit(prev => ({ ...prev, sondage_points: points }));
      const pas = res.mailles.map(m => `${m.code} : pas ${Math.round(m.spacing_m)} m`).join(' · ');
      setGridSummary(
        `${res.generated} point(s) posé(s)${res.close_pairs > 0 ? `, dont ${res.close_pairs} en couple rapproché` : ''}. ${pas}`
      );
    } catch (e) {
      setGridError(e instanceof Error ? e.message : 'Génération impossible');
    } finally {
      setGridBusy(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !missionId) return;
    setLoading(true);
    setError(null);
    setMission(null);
    setTab(defaultTab);
    setEditMailleQuery('');
    setEditMailleSuggestions([]);
    setEditCommuneQuery('');
    setEditRegionQuery('');
    missionsApi
      .get(missionId)
      .then(m => {
        setMission(m);
        setEditGpsPoints(m.sondage_points ?? []);
        setStatus(m.status);
        setEditMailleQuery(m.maille_id ? (m.zone_label || '') : '');
        setEditCommuneQuery(m.commune || '');
        setEditRegionQuery(m.region || '');
        setEdit({
          title: m.title,
          theme: m.theme,
          status: m.status,
          maille_id: m.maille_id ?? undefined,
          zone_label: m.zone_label ?? undefined,
          commune: m.commune ?? undefined,
          region: m.region ?? undefined,
          supervisor_id: m.supervisor_id ?? undefined,
          expected_sondages: m.expected_sondages ?? undefined,
          start_date: m.start_date ?? undefined,
          end_date: m.end_date ?? undefined,
          description: m.description ?? undefined,
          objectifs: m.objectifs ?? undefined,
          notes_internal: m.notes_internal ?? undefined,
          depth_h1_m: m.depth_h1_m ?? undefined,
          depth_h2_m: m.depth_h2_m ?? undefined,
          depth_h3_m: m.depth_h3_m ?? undefined,
          sondage_points: m.sondage_points ?? [],
        });
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Erreur chargement mission'))
      .finally(() => setLoading(false));
  }, [isOpen, missionId, defaultTab]);

  useEffect(() => {
    const q = editMailleQuery.trim();
    if (!isOpen) return;
    if (tab !== 'edit') return;
    if (q.length < 2) {
      setEditMailleSuggestions([]);
      return;
    }
    let cancelled = false;
    setEditMailleLoading(true);
    maillesApi
      .suggest(q)
      .then(res => {
        if (!cancelled) setEditMailleSuggestions(res);
      })
      .catch(() => {
        if (!cancelled) setEditMailleSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setEditMailleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editMailleQuery, isOpen, tab]);

  useEffect(() => {
    const q = editCommuneQuery.trim();
    if (q.length < 2) { setEditCommuneSuggestions([]); return; }
    let cancelled = false;
    setEditCommuneLoading(true);
    communesApi.suggest(q)
      .then(res => { if (!cancelled) setEditCommuneSuggestions(res); })
      .catch(() => { if (!cancelled) setEditCommuneSuggestions([]); })
      .finally(() => { if (!cancelled) setEditCommuneLoading(false); });
    return () => { cancelled = true; };
  }, [editCommuneQuery, isOpen, tab]);

  useEffect(() => {
    const q = editRegionQuery.trim();
    if (q.length < 2) { setEditRegionSuggestions([]); return; }
    let cancelled = false;
    setEditRegionLoading(true);
    regionsApi.suggest(q)
      .then(res => { if (!cancelled) setEditRegionSuggestions(res); })
      .catch(() => { if (!cancelled) setEditRegionSuggestions([]); })
      .finally(() => { if (!cancelled) setEditRegionLoading(false); });
    return () => { cancelled = true; };
  }, [editRegionQuery, isOpen, tab]);

  if (!isOpen || !missionId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-xl w-full ${tab === 'lab' ? 'max-w-5xl' : 'max-w-3xl'} mx-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Mission</h2>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                className={`px-3 py-1 text-sm rounded-md ${tab === 'details' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                onClick={() => setTab('details')}
              >
                Détails
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-sm rounded-md ${tab === 'edit' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                onClick={() => setTab('edit')}
              >
                Édition
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded-md ${tab === 'lab' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                onClick={() => setTab('lab')}
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Laboratoire
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <div className="flex-1">
                <div>{error}</div>
              </div>
            </div>
          )}

          {mission && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-500 font-mono">{mission.code}</div>
                  <div className="text-xl font-semibold text-gray-900">{mission.title}</div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Badge className={getStatusColor(mission.status)}>{getStatusLabel(mission.status)}</Badge>
                    <Badge className="bg-purple-50 text-purple-700">{getThemeLabel(mission.theme)}</Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    onGoToDocuments(mission.id);
                    onClose();
                  }}
                >
                  Documents ({mission.documents_count})
                </Button>
              </div>

              {tab === 'details' && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="border rounded-lg p-3">
                      <div className="text-xs text-gray-500">Commune</div>
                      <div className="text-sm text-gray-900">{mission.commune || '-'}</div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-xs text-gray-500">Région</div>
                      <div className="text-sm text-gray-900">{mission.region || '-'}</div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-xs text-gray-500">Début</div>
                      <div className="text-sm text-gray-900">{formatDate(mission.start_date)}</div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-xs text-gray-500">Fin</div>
                      <div className="text-sm text-gray-900">{formatDate(mission.end_date)}</div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-900">Superviseur</div>
                    <div className="mt-1 text-sm text-gray-700">{mission.supervisor_name || '-'}</div>
                  </div>

                  <div className="border rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-900">
                      Étudiants assignés ({mission.assigned_students.length})
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {mission.assigned_students.map(s => (
                        <Badge key={s.student_id} className="bg-blue-50 text-blue-700">
                          {s.full_name}
                        </Badge>
                      ))}
                      {mission.assigned_students.length === 0 && <div className="text-sm text-gray-500">Aucun</div>}
                    </div>
                  </div>

                  {(can('colab.missions.unassign') || can('colab.missions.reassign')) && (
                    <div className="border rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-900">Réattribution</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {can('colab.missions.unassign') && (
                          <Button
                            variant="outline"
                            disabled={loading}
                            onClick={async () => {
                              try {
                                setError(null);
                                setLoading(true);
                                await missionsApi.unassignMaille(mission.id);
                                onChanged();
                                onClose();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'Erreur désassignation');
                              } finally {
                                setLoading(false);
                              }
                            }}
                          >
                            Désassigner la maille
                          </Button>
                        )}

                        {can('colab.missions.reassign') && (
                          <Button
                            disabled={loading}
                            onClick={() => {
                              setTab('edit');
                            }}
                          >
                            Réassigner…
                          </Button>
                        )}
                      </div>
                      {can('colab.missions.reassign') && (
                        <div className="mt-2 text-xs text-gray-500">
                          Pour réassigner, passez en onglet Édition et sélectionnez une nouvelle maille.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {tab === 'edit' && (
                <div className="space-y-4">
                  {!can('colab.missions.manage') && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                      Droits insuffisants pour modifier cette mission.
                    </div>
                  )}
                  {/* Maille */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Maille</label>
                      <button
                        type="button"
                        onClick={() => setEditMaillePickerOpen(true)}
                        disabled={!can('colab.missions.reassign')}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
                      >
                        <Map className="w-3.5 h-3.5" />
                        Choisir sur la carte
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        value={editMailleQuery}
                        onChange={e => setEditMailleQuery(e.target.value)}
                        placeholder={mission.maille_id ? "Rechercher une autre maille…" : "Rechercher une maille…"}
                        disabled={!can('colab.missions.reassign')}
                      />
                      {(editMailleLoading || editMailleSuggestions.length > 0) && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow max-h-56 overflow-auto">
                          {editMailleLoading && <div className="px-3 py-2 text-sm text-slate-500">Chargement…</div>}
                          {!editMailleLoading && editMailleSuggestions.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                              onClick={() => {
                                setEdit(prev => ({
                                  ...prev,
                                  maille_id: m.id,
                                  zone_label: m.code,
                                  commune: m.adm3_name || prev.commune || '',
                                  region: m.adm1_name || prev.region || '',
                                }));
                                setEditMailleQuery(m.code);
                                setEditCommuneQuery(m.adm3_name || '');
                                setEditRegionQuery(m.adm1_name || '');
                                setEditMailleSuggestions([]);
                              }}
                            >
                              <div className="font-medium text-slate-900 dark:text-slate-100">{m.code}</div>
                              <div className="text-xs text-slate-500">{[m.adm1_name, m.adm2_name, m.adm3_name].filter(Boolean).join(' / ')}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Actuelle: <span className="font-mono">{mission.maille_id ? (mission.zone_label || mission.maille_id) : 'Aucune'}</span>
                    </div>
                  </div>

                  {/* Titre + Thème */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Titre</label>
                      <Input value={edit.title ?? ''} onChange={e => setEdit(prev => ({ ...prev, title: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Thème</label>
                      <Select
                        value={edit.theme ?? mission.theme}
                        onChange={e => setEdit(prev => ({ ...prev, theme: e.target.value }))}
                        options={MISSION_THEMES}
                      />
                    </div>
                  </div>

                  {/* Superviseur + Statut */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Superviseur</label>
                      <select
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        value={edit.supervisor_id ?? ''}
                        onChange={e => setEdit(prev => ({ ...prev, supervisor_id: e.target.value || undefined }))}
                      >
                        <option value="">Aucun</option>
                        {supervisors.map(s => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Statut</label>
                      <Select
                        value={edit.status ?? status}
                        onChange={e => { setStatus(e.target.value); setEdit(prev => ({ ...prev, status: e.target.value })); }}
                        options={MISSION_STATUSES}
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Début</label>
                      <Input type="date" value={(edit.start_date ?? '').slice(0, 10)} onChange={e => setEdit(prev => ({ ...prev, start_date: e.target.value || undefined }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Fin</label>
                      <Input type="date" value={(edit.end_date ?? '').slice(0, 10)} onChange={e => setEdit(prev => ({ ...prev, end_date: e.target.value || undefined }))} />
                    </div>
                  </div>

                  {/* Commune + Région */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Commune</label>
                      <div className="relative">
                        <Input
                          value={editCommuneQuery}
                          placeholder="Lomé"
                          onChange={e => { setEditCommuneQuery(e.target.value); setEdit(prev => ({ ...prev, commune: e.target.value })); }}
                        />
                        {(editCommuneLoading || editCommuneSuggestions.length > 0) && (
                          <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow max-h-40 overflow-auto">
                            {editCommuneLoading && <div className="px-3 py-2 text-sm text-slate-500">Chargement…</div>}
                            {editCommuneSuggestions.map(c => (
                              <button key={c} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                                onClick={() => { setEditCommuneQuery(c); setEdit(prev => ({ ...prev, commune: c })); setEditCommuneSuggestions([]); }}>
                                {c}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Région</label>
                      <div className="relative">
                        <Input
                          value={editRegionQuery}
                          placeholder="Maritime"
                          onChange={e => { setEditRegionQuery(e.target.value); setEdit(prev => ({ ...prev, region: e.target.value })); }}
                        />
                        {(editRegionLoading || editRegionSuggestions.length > 0) && (
                          <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow max-h-40 overflow-auto">
                            {editRegionLoading && <div className="px-3 py-2 text-sm text-slate-500">Chargement…</div>}
                            {editRegionSuggestions.map(r => (
                              <button key={r} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                                onClick={() => { setEditRegionQuery(r); setEdit(prev => ({ ...prev, region: r })); setEditRegionSuggestions([]); }}>
                                {r}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sondages attendus */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Sondages attendus</label>
                    <input
                      type="number"
                      min={0}
                      value={String(edit.expected_sondages ?? '')}
                      onChange={e => { const v = e.target.value; setEdit(prev => ({ ...prev, expected_sondages: v === '' ? undefined : Number(v) })); }}
                      className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Localisations GPS sondages */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Localisations des sondages prévus
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditGpsPickerOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Placer sur la carte
                      </button>
                    </div>

                    {/* Plan d'échantillonnage automatique.
                        Réseau triangulaire : à densité égale c'est le plan qui
                        minimise la variance de krigeage maximale. Les couples
                        rapprochés fournissent les lags courts sans lesquels
                        l'effet de pépite n'est pas identifiable — et donc sans
                        lesquels le BLUP « stationnaire » est mal pondéré. */}
                    <div className="mb-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/20 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Grid3x3 className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                        <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">
                          Générer un plan d'échantillonnage
                        </span>
                      </div>
                      <p className="text-[11px] leading-snug text-indigo-700/80 dark:text-indigo-300/80 mb-2">
                        Réseau triangulaire équilatéral posé dans chaque maille de la mission,
                        pour minimiser la variance d'un BLUP stationnaire.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-[11px] text-indigo-800 dark:text-indigo-200">Points par maille</label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={gridCount}
                          onChange={e => setGridCount(e.target.value)}
                          aria-label="Nombre de points par maille"
                          className="w-20 rounded-md border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-slate-100"
                        />
                        <label className="flex items-center gap-1.5 text-[11px] text-indigo-800 dark:text-indigo-200">
                          <input
                            type="checkbox"
                            checked={gridClosePairs}
                            onChange={e => setGridClosePairs(e.target.checked)}
                          />
                          Couples rapprochés (pépite)
                        </label>
                        <label className="flex items-center gap-1.5 text-[11px] text-indigo-800 dark:text-indigo-200">
                          <input
                            type="checkbox"
                            checked={gridReplace}
                            onChange={e => setGridReplace(e.target.checked)}
                          />
                          Remplacer les points existants
                        </label>
                        <button
                          type="button"
                          disabled={gridBusy}
                          onClick={() => void generateGrid(gridReplace)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                        >
                          {gridBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Grid3x3 className="w-3.5 h-3.5" />}
                          {gridReplace ? 'Régénérer la grille' : 'Générer la grille'}
                        </button>
                      </div>
                      {gridSummary && (
                        <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-300">{gridSummary}</p>
                      )}
                      {gridError && (
                        <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{gridError}</p>
                      )}
                    </div>
                    {editGpsPoints.length > 0 ? (
                      <div className="space-y-1">
                        {editGpsPoints.map((pt, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white font-bold shrink-0">{idx + 1}</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{pt.label || `S${idx + 1}`}</span>
                            <span className="text-slate-400 dark:text-slate-500 font-mono ml-auto">{pt.lat.toFixed(5)}, {pt.lon.toFixed(5)}</span>
                            <button
                              type="button"
                              onClick={() => setEditGpsPoints(prev => prev.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                        Aucun point GPS défini — cliquez sur "Placer sur la carte"
                      </p>
                    )}
                  </div>

                  {/* Profondeurs */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Profondeur indicative (m)</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['depth_h1_m', 'depth_h2_m', 'depth_h3_m'] as const).map((key, i) => (
                        <div key={key}>
                          <label className="block text-xs text-slate-500 mb-1">H{i + 1}</label>
                          <input
                            type="number"
                            step="0.5"
                            min={0}
                            placeholder={i === 0 ? "ex: 6" : i === 1 ? "ex: 10" : "ex: 15"}
                            value={String(edit[key] ?? '')}
                            onChange={e => setEdit(prev => ({ ...prev, [key]: e.target.value ? Number(e.target.value) : undefined }))}
                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Textes */}
                  {(['description', 'objectifs', 'notes_internal'] as const).map(key => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1 capitalize">
                        {key === 'notes_internal' ? 'Notes internes' : key.charAt(0).toUpperCase() + key.slice(1)}
                      </label>
                      <textarea
                        value={edit[key] ?? ''}
                        onChange={e => setEdit(prev => ({ ...prev, [key]: e.target.value || undefined }))}
                        rows={3}
                        className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  ))}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setLoading(true);
                          if (!can('colab.missions.manage')) { setError('Permission insuffisante'); return; }
                          await missionsApi.update(mission.id, edit);
                          onChanged();
                          const refreshed = await missionsApi.get(mission.id);
                          setMission(refreshed);
                          setStatus(refreshed.status);
                          setEditMailleQuery(refreshed.maille_id ? (refreshed.zone_label || '') : '');
                          setEditCommuneQuery(refreshed.commune || '');
                          setEditRegionQuery(refreshed.region || '');
                          setEditGpsPoints(refreshed.sondage_points ?? []);
                          setEdit({
                            title: refreshed.title,
                            theme: refreshed.theme,
                            status: refreshed.status,
                            maille_id: refreshed.maille_id ?? undefined,
                            zone_label: refreshed.zone_label ?? undefined,
                            commune: refreshed.commune ?? undefined,
                            region: refreshed.region ?? undefined,
                            supervisor_id: refreshed.supervisor_id ?? undefined,
                            expected_sondages: refreshed.expected_sondages ?? undefined,
                            start_date: refreshed.start_date ?? undefined,
                            end_date: refreshed.end_date ?? undefined,
                            description: refreshed.description ?? undefined,
                            objectifs: refreshed.objectifs ?? undefined,
                            notes_internal: refreshed.notes_internal ?? undefined,
                            depth_h1_m: refreshed.depth_h1_m ?? undefined,
                            depth_h2_m: refreshed.depth_h2_m ?? undefined,
                            depth_h3_m: refreshed.depth_h3_m ?? undefined,
                            sondage_points: refreshed.sondage_points ?? [],
                          });
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Erreur mise à jour");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || !can('colab.missions.manage')}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Enregistrement...</> : "Enregistrer les modifications"}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'lab' && (
                <LabResultsPanel missionId={mission.id} sondages={mission.linked_sondages} />
              )}
            </>
          )}
        </div>
      </div>

      <MaillePickerModal
        isOpen={editMaillePickerOpen}
        onClose={() => setEditMaillePickerOpen(false)}
        onSelect={m => {
          setEdit(prev => ({
            ...prev,
            maille_id: m.id,
            zone_label: m.code,
            commune: m.adm3_name || prev.commune || '',
            region: m.adm1_name || prev.region || '',
          }));
          setEditMailleQuery(m.code);
          setEditCommuneQuery(m.adm3_name || '');
          setEditRegionQuery(m.adm1_name || '');
          setEditMailleSuggestions([]);
        }}
      />

      <GpsPickerModal
        isOpen={editGpsPickerOpen}
        onClose={() => setEditGpsPickerOpen(false)}
        onConfirm={pts => {
          setEditGpsPoints(pts);
          setEdit(prev => ({ ...prev, sondage_points: pts.map((point, index) => ({ ...point, numero: index + 1 })) }));
          setEditGpsPickerOpen(false);
        }}
        initialPoints={editGpsPoints}
        mailleCodes={(edit.zone_label || mission?.zone_label) ? [String(edit.zone_label || mission?.zone_label)] : []}
      />
    </div>
  );
};

export default MissionDetailModal;
