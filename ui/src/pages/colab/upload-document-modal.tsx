import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Plus, X } from 'lucide-react';
import {
  documentsApi,
  missionsApi,
  MissionListItem,
} from '../../services/colab-api';
import { Button, Input, Select } from './ui';
import CreateMissionModal from './create-mission-modal';

const UploadDocumentModal: React.FC<{
  isOpen: boolean;
  missionId: string | null;
  onClose: () => void;
  onUploaded: () => void | Promise<void>;
}> = ({ isOpen, missionId, onClose, onUploaded }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('autre');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [missionIdInput, setMissionIdInput] = useState('');

  const [missionQuery, setMissionQuery] = useState('');
  const [missionSuggestions, setMissionSuggestions] = useState<MissionListItem[]>([]);
  const [missionLoading, setMissionLoading] = useState(false);
  const [selectedMission, setSelectedMission] = useState<MissionListItem | null>(null);

  const [showInlineCreateMissionModal, setShowInlineCreateMissionModal] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setTitle('');
    setDescription('');
    setDocumentType('autre');
    setFile(null);
    setMissionIdInput(missionId || '');

    setSelectedMission(null);
    setMissionQuery('');
    setMissionSuggestions([]);
    setShowInlineCreateMissionModal(false);
  }, [isOpen]);

  useEffect(() => {
    let cancelled = false;
    const q = missionQuery.trim();
    if (!isOpen) return;
    if (missionId) return;
    if (q.length < 2) {
      setMissionSuggestions([]);
      return;
    }
    setMissionLoading(true);
    missionsApi
      .list({ search: q, per_page: 10 })
      .then(res => {
        if (!cancelled) setMissionSuggestions(res.missions || []);
      })
      .catch(() => {
        if (!cancelled) setMissionSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setMissionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [missionQuery, isOpen, missionId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Uploader un document</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          className="p-4 space-y-4"
          onSubmit={async e => {
            e.preventDefault();
            const effectiveMissionId = (missionId || missionIdInput || '').trim();
            if (!effectiveMissionId) {
              setError('Mission requise');
              return;
            }
            if (!file) {
              setError('Fichier requis');
              return;
            }
            if (!title.trim()) {
              setError('Titre requis');
              return;
            }
            setError(null);
            setLoading(true);
            try {
              await documentsApi.upload({
                mission_id: effectiveMissionId,
                title: title.trim(),
                document_type: documentType,
                description: description.trim() ? description.trim() : undefined,
                file,
              });
              onUploaded();
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
            } finally {
              setLoading(false);
            }
          }}
        >
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mission *</label>

            {missionId ? (
              <Input value={missionId} onChange={() => {}} placeholder="mission_id" className="opacity-60" />
            ) : (
              <div className="relative">
                {selectedMission ? (
                  <div className="flex items-center justify-between bg-blue-50 text-blue-700 rounded-lg px-3 py-2 text-sm">
                    <div className="truncate">{selectedMission.title}</div>
                    <button
                      type="button"
                      className="hover:text-blue-900"
                      onClick={() => {
                        setSelectedMission(null);
                        setMissionIdInput('');
                        setMissionQuery('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      value={missionQuery}
                      onChange={e => setMissionQuery(e.target.value)}
                      placeholder="Rechercher une mission..."
                    />

                    {(missionLoading || missionSuggestions.length > 0) && (
                      <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow max-h-56 overflow-auto">
                        {missionLoading && <div className="px-3 py-2 text-sm text-gray-500">Chargement...</div>}
                        {!missionLoading &&
                          missionSuggestions.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={() => {
                                setSelectedMission(m);
                                setMissionIdInput(m.id);
                                setMissionQuery('');
                                setMissionSuggestions([]);
                              }}
                            >
                              <div className="font-medium text-gray-900">{m.title}</div>
                              <div className="text-xs text-gray-500">{m.code}</div>
                            </button>
                          ))}
                      </div>
                    )}

                    {!missionLoading && missionQuery.trim().length >= 2 && missionSuggestions.length === 0 && (
                      <div className="mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowInlineCreateMissionModal(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Créer une mission: {missionQuery.trim()}
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {!selectedMission && missionIdInput && (
                  <div className="mt-1 text-xs text-gray-500">
                    Sélectionné: <span className="font-mono">{missionIdInput}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <Select
              value={documentType}
              onChange={e => setDocumentType(e.target.value)}
              options={[
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fichier *</label>
            <input
              type="file"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Upload...
                </>
              ) : (
                'Uploader'
              )}
            </Button>
          </div>
        </form>
      </div>

      <CreateMissionModal
        isOpen={showInlineCreateMissionModal}
        onClose={() => setShowInlineCreateMissionModal(false)}
        onCreated={() => {}}
        onCreatedMission={m => {
          setSelectedMission(m);
          setMissionIdInput(m.id);
          setMissionQuery('');
          setMissionSuggestions([]);
          setShowInlineCreateMissionModal(false);
        }}
      />
    </div>
  );
};

export default UploadDocumentModal;
