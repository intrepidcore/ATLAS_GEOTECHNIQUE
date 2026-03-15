import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, MapPin, Plus, X } from 'lucide-react';

import {
  communesApi,
  CreateMissionRequest,
  CreateStudentRequest,
  CreateStudentResponse,
  MailleSuggestItem,
  maillesApi,
  MissionListItem,
  missionsApi,
  regionsApi,
  studentsApi,
  supervisorsApi,
  UserSuggestItem,
  MISSION_THEMES,
} from '../../services/colab-api';
import { Button, Input, Select } from './ui';

function generateMissionCode(): string {
  const ts = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}`;
  const timePart = `${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  const rnd = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `M-${datePart}-${timePart}-${rnd}`;
}

const InlineCreateStudentModal: React.FC<{
  isOpen: boolean;
  initialQuery: string;
  onClose: () => void;
  onCreated: (student: UserSuggestItem) => void;
  onOpenExistingStudent?: (studentId: string) => void;
}> = ({ isOpen, initialQuery, onClose, onCreated, onOpenExistingStudent }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingStudentId, setExistingStudentId] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateStudentResponse | null>(null);
  const [form, setForm] = useState<CreateStudentRequest>({
    email: '',
    first_name: '',
    last_name: '',
    telephone: '',
    promotion: '',
    age: undefined,
  });

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setExistingStudentId(null);
    setCreated(null);
    setForm({
      email: '',
      first_name: '',
      last_name: '',
      telephone: '',
      promotion: '',
      age: undefined,
    });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Créer un étudiant</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={async e => {
            e.preventDefault();
            setError(null);
            setCreated(null);
            setLoading(true);
            try {
              const res = await studentsApi.create(form);
              setCreated(res);
              const label = `${form.first_name} ${form.last_name} (${form.promotion})`;
              onCreated({ id: res.student_id, label });
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Erreur lors de la création';
              const payload = (err as any)?.payload;
              if (payload?.existing_student_id && (msg.includes('Téléphone déjà utilisé') || msg.includes('Email déjà utilisé'))) {
                setError(msg);
                setExistingStudentId(String(payload.existing_student_id));
              } else {
                setError(msg);
                setExistingStudentId(null);
              }
            } finally {
              setLoading(false);
            }
          }}
          className="p-4 space-y-4"
        >
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <div className="flex-1">
                <div>{error}</div>
                {(error.includes('Téléphone déjà utilisé') || error.includes('Email déjà utilisé')) && (form.telephone || form.email) && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (existingStudentId) onOpenExistingStudent?.(existingStudentId);
                      }}
                      disabled={!onOpenExistingStudent || !existingStudentId}
                    >
                      Ouvrir le compte existant
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {created && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              <div className="font-medium">Compte créé</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div>
                  Mot de passe temporaire: <span className="font-mono">{created.temp_password}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(created.temp_password)}>
                  Copier
                </Button>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500">
            Recherche initiale: <span className="font-mono">{initialQuery}</span>
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Promotion *</label>
            <Input value={form.promotion} onChange={e => setForm({ ...form, promotion: e.target.value })} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
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
          </div>
        </form>
      </div>
    </div>
  );
};

const CreateMissionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  onCreatedMission?: (mission: MissionListItem) => void;
  onOpenExistingStudent?: (studentId: string) => void;
}> = ({ isOpen, onClose, onCreated, onCreatedMission, onOpenExistingStudent }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mailleQuery, setMailleQuery] = useState('');
  const [mailleSuggestions, setMailleSuggestions] = useState<MailleSuggestItem[]>([]);
  const [mailleLoading, setMailleLoading] = useState(false);

  const [mailleLat, setMailleLat] = useState('');
  const [mailleLon, setMailleLon] = useState('');
  const [mailleResolveLoading, setMailleResolveLoading] = useState(false);
  const [mailleResolveError, setMailleResolveError] = useState<string | null>(null);

  const [communeQuery, setCommuneQuery] = useState('');
  const [communeSuggestions, setCommuneSuggestions] = useState<string[]>([]);
  const [communeLoading, setCommuneLoading] = useState(false);

  const [regionQuery, setRegionQuery] = useState('');
  const [regionSuggestions, setRegionSuggestions] = useState<string[]>([]);
  const [regionLoading, setRegionLoading] = useState(false);

  const [studentQuery, setStudentQuery] = useState('');
  const [studentSuggestions, setStudentSuggestions] = useState<UserSuggestItem[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<UserSuggestItem[]>([]);

  const [showInlineCreateStudentModal, setShowInlineCreateStudentModal] = useState(false);

  const [supervisorQuery, setSupervisorQuery] = useState('');
  const [supervisorSuggestions, setSupervisorSuggestions] = useState<UserSuggestItem[]>([]);
  const [supervisorLoading, setSupervisorLoading] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState<UserSuggestItem | null>(null);

  const [form, setForm] = useState<CreateMissionRequest>({
    code: '',
    title: '',
    theme: 'reconnaissance',
    commune: '',
    region: '',
    description: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    setMailleQuery('');
    setMailleSuggestions([]);
    setMailleLat('');
    setMailleLon('');
    setMailleResolveLoading(false);
    setMailleResolveError(null);
    setCommuneQuery('');
    setCommuneSuggestions([]);
    setRegionQuery('');
    setRegionSuggestions([]);
    setStudentQuery('');
    setStudentSuggestions([]);
    setSelectedStudents([]);
    setSupervisorQuery('');
    setSupervisorSuggestions([]);
    setSelectedSupervisor(null);
  }, [isOpen]);

  useEffect(() => {
    let cancelled = false;
    const q = mailleQuery.trim();
    if (!isOpen) return;
    if (q.length < 2) {
      setMailleSuggestions([]);
      return;
    }
    setMailleLoading(true);
    maillesApi
      .suggest(q)
      .then(res => {
        if (!cancelled) setMailleSuggestions(res);
      })
      .catch(() => {
        if (!cancelled) setMailleSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setMailleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mailleQuery, isOpen]);

  useEffect(() => {
    let cancelled = false;
    const q = studentQuery.trim();
    if (!isOpen) return;
    if (q.length < 2) {
      setStudentSuggestions([]);
      return;
    }
    setStudentLoading(true);
    studentsApi
      .suggest(q)
      .then(res => {
        if (!cancelled) setStudentSuggestions(res);
      })
      .catch(() => {
        if (!cancelled) setStudentSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setStudentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentQuery, isOpen]);

  useEffect(() => {
    let cancelled = false;
    const q = supervisorQuery.trim();
    if (!isOpen) return;
    if (q.length < 2) {
      setSupervisorSuggestions([]);
      return;
    }
    setSupervisorLoading(true);
    supervisorsApi
      .suggest(q)
      .then(res => {
        if (!cancelled) setSupervisorSuggestions(res);
      })
      .catch(() => {
        if (!cancelled) setSupervisorSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setSupervisorLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supervisorQuery, isOpen]);

  useEffect(() => {
    let cancelled = false;
    const q = communeQuery.trim();
    if (!isOpen) return;
    if (q.length < 2) {
      setCommuneSuggestions([]);
      return;
    }
    setCommuneLoading(true);
    communesApi
      .suggest(q)
      .then((res: string[]) => {
        if (!cancelled) setCommuneSuggestions(res);
      })
      .catch(() => {
        if (!cancelled) setCommuneSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setCommuneLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [communeQuery, isOpen]);

  useEffect(() => {
    let cancelled = false;
    const q = regionQuery.trim();
    if (!isOpen) return;
    if (q.length < 2) {
      setRegionSuggestions([]);
      return;
    }
    setRegionLoading(true);
    regionsApi
      .suggest(q)
      .then(res => {
        if (!cancelled) setRegionSuggestions(res);
      })
      .catch(() => {
        if (!cancelled) setRegionSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setRegionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [regionQuery, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: CreateMissionRequest = {
        ...form,
        code: generateMissionCode(),
        supervisor_id: selectedSupervisor?.id,
        assigned_student_ids: selectedStudents.map(s => s.id),
      };
      const created = await missionsApi.create(payload);
      onCreatedMission?.(created);
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Maille (autocomplétion)</label>
            <div className="relative">
              <Input placeholder="TG-0..." value={mailleQuery} onChange={e => setMailleQuery(e.target.value)} />
              {(mailleLoading || mailleSuggestions.length > 0) && (
                <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow max-h-48 overflow-auto">
                  {mailleLoading && <div className="px-3 py-2 text-sm text-gray-500">Chargement...</div>}
                  {!mailleLoading &&
                    mailleSuggestions.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => {
                          setForm({ ...form, maille_id: m.id, zone_label: m.code });
                          setMailleQuery(m.code);
                          setMailleSuggestions([]);
                        }}
                      >
                        <div className="font-medium text-gray-900">{m.code}</div>
                        <div className="text-xs text-gray-500">
                          {[m.adm1_name, m.adm2_name, m.adm3_name].filter(Boolean).join(' / ') || '—'}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
            {form.maille_id && (
              <div className="mt-1 text-xs text-gray-500">
                Sélectionné: <span className="font-mono">{form.zone_label || form.maille_id}</span>
              </div>
            )}
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-sm font-medium text-gray-900 mb-2">Résoudre une maille depuis des coordonnées</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Latitude</label>
                <Input placeholder="ex: 6.172" value={mailleLat} onChange={e => setMailleLat(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Longitude</label>
                <Input placeholder="ex: 1.231" value={mailleLon} onChange={e => setMailleLon(e.target.value)} />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="text-xs text-gray-500">
                {mailleLat && mailleLon ? (
                  <a
                    className="text-blue-700 hover:underline"
                    href={`https://www.google.com/maps?q=${encodeURIComponent(mailleLat)},${encodeURIComponent(mailleLon)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ouvrir sur Google Maps
                  </a>
                ) : (
                  <span>Renseigne lat/lon pour activer le lien</span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  setMailleResolveError(null);
                  const lat = Number(mailleLat);
                  const lon = Number(mailleLon);
                  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                    setMailleResolveError('Coordonnées invalides');
                    return;
                  }
                  setMailleResolveLoading(true);
                  try {
                    const m = await maillesApi.resolve({ lat, lon });
                    setForm(prev => ({ ...prev, maille_id: m.id, zone_label: m.code }));
                    setMailleQuery(m.code);
                    setMailleSuggestions([]);
                  } catch (e) {
                    setMailleResolveError(e instanceof Error ? e.message : 'Erreur résolution');
                  } finally {
                    setMailleResolveLoading(false);
                  }
                }}
                disabled={mailleResolveLoading}
              >
                <MapPin className={`w-4 h-4 mr-2 ${mailleResolveLoading ? 'animate-pulse' : ''}`} />
                Résoudre
              </Button>
            </div>

            {mailleResolveError && <div className="mt-2 text-sm text-red-600">{mailleResolveError}</div>}
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
            <Select value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value })} options={MISSION_THEMES} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Superviseur (autocomplétion)</label>
            {selectedSupervisor && (
              <div className="mb-2 flex items-center justify-between bg-blue-50 text-blue-700 rounded-lg px-3 py-2 text-sm">
                <div>{selectedSupervisor.label}</div>
                <button
                  type="button"
                  className="hover:text-blue-900"
                  onClick={() => {
                    setSelectedSupervisor(null);
                    setSupervisorQuery('');
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {!selectedSupervisor && (
              <div className="relative">
                <Input placeholder="Rechercher un superviseur..." value={supervisorQuery} onChange={e => setSupervisorQuery(e.target.value)} />
                {(supervisorLoading || supervisorSuggestions.length > 0) && (
                  <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow max-h-48 overflow-auto">
                    {supervisorLoading && <div className="px-3 py-2 text-sm text-gray-500">Chargement...</div>}
                    {!supervisorLoading &&
                      supervisorSuggestions.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            setSelectedSupervisor(s);
                            setSupervisorQuery('');
                            setSupervisorSuggestions([]);
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commune</label>
              <div className="relative">
                <Input
                  placeholder="Lomé"
                  value={communeQuery}
                  onChange={e => {
                    setCommuneQuery(e.target.value);
                    setForm({ ...form, commune: e.target.value });
                  }}
                />
                {(communeLoading || communeSuggestions.length > 0) && (
                  <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow max-h-48 overflow-auto">
                    {communeLoading && <div className="px-3 py-2 text-sm text-gray-500">Chargement...</div>}
                    {!communeLoading &&
                      communeSuggestions.map(c => (
                        <button
                          key={c}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            setForm({ ...form, commune: c });
                            setCommuneQuery(c);
                            setCommuneSuggestions([]);
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Région</label>
              <div className="relative">
                <Input
                  placeholder="Maritime"
                  value={regionQuery}
                  onChange={e => {
                    setRegionQuery(e.target.value);
                    setForm({ ...form, region: e.target.value });
                  }}
                />
                {(regionLoading || regionSuggestions.length > 0) && (
                  <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow max-h-48 overflow-auto">
                    {regionLoading && <div className="px-3 py-2 text-sm text-gray-500">Chargement...</div>}
                    {!regionLoading &&
                      regionSuggestions.map(r => (
                        <button
                          key={r}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            setForm({ ...form, region: r });
                            setRegionQuery(r);
                            setRegionSuggestions([]);
                          }}
                        >
                          {r}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Étudiants assignés (multi-select)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedStudents.map(s => (
                <span key={s.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                  {s.label}
                  <button
                    type="button"
                    className="hover:text-blue-900"
                    onClick={() => setSelectedStudents(prev => prev.filter(x => x.id !== s.id))}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <Input placeholder="Rechercher un étudiant..." value={studentQuery} onChange={e => setStudentQuery(e.target.value)} />
              {(studentLoading || studentSuggestions.length > 0) && (
                <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow max-h-48 overflow-auto">
                  {studentLoading && <div className="px-3 py-2 text-sm text-gray-500">Chargement...</div>}
                  {!studentLoading &&
                    studentSuggestions.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => {
                          setSelectedStudents(prev => (prev.some(x => x.id === s.id) ? prev : [...prev, s]));
                          setStudentQuery('');
                          setStudentSuggestions([]);
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                </div>
              )}
            </div>
            {!studentLoading && studentQuery.trim().length >= 2 && studentSuggestions.length === 0 && (
              <div className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowInlineCreateStudentModal(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Créer un étudiant: {studentQuery.trim()}
                </Button>
              </div>
            )}
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
              <Input type="date" value={form.end_date || ''} onChange={e => setForm({ ...form, end_date: e.target.value || undefined })} />
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
            <Button type="submit" disabled={loading || !form.title}>
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

      <InlineCreateStudentModal
        isOpen={showInlineCreateStudentModal}
        initialQuery={studentQuery.trim()}
        onClose={() => setShowInlineCreateStudentModal(false)}
        onOpenExistingStudent={onOpenExistingStudent}
        onCreated={student => {
          setSelectedStudents(prev => (prev.some(x => x.id === student.id) ? prev : [...prev, student]));
          setStudentQuery('');
          setStudentSuggestions([]);
          setShowInlineCreateStudentModal(false);
        }}
      />
    </div>
  );
};

export default CreateMissionModal;
