import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import {
  getStatusColor,
  getStatusLabel,
  getThemeLabel,
  MailleSuggestItem,
  MISSION_STATUSES,
  MISSION_THEMES,
  MissionDetail,
  missionsApi,
  maillesApi,
  SupervisorSummary,
  UpdateMissionRequest,
  formatDate,
} from '../../services/colab-api';
import { Badge, Button, Input, Select } from './ui';

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
  const [tab, setTab] = useState<'details' | 'edit'>('details');

  const [editMailleQuery, setEditMailleQuery] = useState('');
  const [editMailleSuggestions, setEditMailleSuggestions] = useState<MailleSuggestItem[]>([]);
  const [editMailleLoading, setEditMailleLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !missionId) return;
    setLoading(true);
    setError(null);
    setMission(null);
    setTab(defaultTab);
    setEditMailleQuery('');
    setEditMailleSuggestions([]);
    missionsApi
      .get(missionId)
      .then(m => {
        setMission(m);
        setStatus(m.status);
        setEditMailleQuery(m.maille_id ? (m.zone_label || '') : '');
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

  if (!isOpen || !missionId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
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
                </>
              )}

              {tab === 'edit' && (
                <div className="border rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900">Édition</div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <div className="text-xs text-gray-500 mb-1">Maille</div>
                      <div className="relative">
                        <Input
                          value={editMailleQuery}
                          onChange={e => setEditMailleQuery(e.target.value)}
                          placeholder={mission.maille_id ? 'Rechercher une autre maille…' : 'Rechercher une maille…'}
                        />
                        {(editMailleLoading || editMailleSuggestions.length > 0) && (
                          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-lg shadow max-h-56 overflow-auto">
                            {editMailleLoading && <div className="px-3 py-2 text-sm text-gray-500">Chargement…</div>}
                            {!editMailleLoading &&
                              editMailleSuggestions.map(m => (
                                <button
                                  key={m.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                  onClick={() => {
                                    setEdit(prev => ({ ...prev, maille_id: m.id, zone_label: m.code }));
                                    setEditMailleQuery(m.code);
                                    setEditMailleSuggestions([]);
                                  }}
                                >
                                  <div className="font-medium text-gray-900">{m.code}</div>
                                  <div className="text-xs text-gray-500">{[m.adm1_name, m.adm2_name, m.adm3_name].filter(Boolean).join(' / ')}</div>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Maille actuelle: {mission.maille_id ? (mission.zone_label || mission.maille_id) : 'Aucune'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">Titre</div>
                      <Input value={edit.title ?? ''} onChange={e => setEdit(prev => ({ ...prev, title: e.target.value }))} />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Thème</div>
                      <Select
                        value={edit.theme ?? mission.theme}
                        onChange={e => setEdit(prev => ({ ...prev, theme: e.target.value }))}
                        options={MISSION_THEMES}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Début</div>
                      <Input
                        type="date"
                        value={(edit.start_date ?? '').slice(0, 10)}
                        onChange={e => setEdit(prev => ({ ...prev, start_date: e.target.value || undefined }))}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Fin</div>
                      <Input
                        type="date"
                        value={(edit.end_date ?? '').slice(0, 10)}
                        onChange={e => setEdit(prev => ({ ...prev, end_date: e.target.value || undefined }))}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Superviseur</div>
                      <select
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        value={edit.supervisor_id ?? ''}
                        onChange={e => setEdit(prev => ({ ...prev, supervisor_id: e.target.value || undefined }))}
                      >
                        <option value="">Aucun</option>
                        {supervisors.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Sondages attendus</div>
                      <Input
                        type="number"
                        value={String(edit.expected_sondages ?? '')}
                        onChange={e => {
                          const v = e.target.value;
                          setEdit(prev => ({ ...prev, expected_sondages: v === '' ? undefined : Number(v) }));
                        }}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Zone</div>
                      <Input
                        value={edit.zone_label ?? ''}
                        onChange={e => setEdit(prev => ({ ...prev, zone_label: e.target.value || undefined }))}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Commune</div>
                      <Input
                        value={edit.commune ?? ''}
                        onChange={e => setEdit(prev => ({ ...prev, commune: e.target.value || undefined }))}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Région</div>
                      <Input
                        value={edit.region ?? ''}
                        onChange={e => setEdit(prev => ({ ...prev, region: e.target.value || undefined }))}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Statut</div>
                      <Select
                        value={edit.status ?? status}
                        onChange={e => {
                          setStatus(e.target.value);
                          setEdit(prev => ({ ...prev, status: e.target.value }));
                        }}
                        options={MISSION_STATUSES}
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Description</div>
                      <textarea
                        value={edit.description ?? ''}
                        onChange={e => setEdit(prev => ({ ...prev, description: e.target.value || undefined }))}
                        rows={3}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Objectifs</div>
                      <textarea
                        value={edit.objectifs ?? ''}
                        onChange={e => setEdit(prev => ({ ...prev, objectifs: e.target.value || undefined }))}
                        rows={3}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Notes internes</div>
                      <textarea
                        value={edit.notes_internal ?? ''}
                        onChange={e => setEdit(prev => ({ ...prev, notes_internal: e.target.value || undefined }))}
                        rows={3}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          setLoading(true);
                          await missionsApi.update(mission.id, edit);
                          onChanged();
                          const refreshed = await missionsApi.get(mission.id);
                          setMission(refreshed);
                          setStatus(refreshed.status);
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
                          });
                          setEditMailleQuery(refreshed.maille_id ? (refreshed.zone_label || '') : '');
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Erreur mise à jour');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                    >
                      Enregistrer
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MissionDetailModal;
