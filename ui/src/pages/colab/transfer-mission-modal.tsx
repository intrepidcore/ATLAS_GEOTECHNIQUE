import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { attributionsApi, MissionListItem, studentsApi, UserSuggestItem } from '../../services/colab-api';
import { Button, Input } from './ui';

const TransferMissionModal: React.FC<{
  isOpen: boolean;
  mission: MissionListItem | null;
  onClose: () => void;
  onTransferred: () => void;
}> = ({ isOpen, mission, onClose, onTransferred }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentSuggestions, setStudentSuggestions] = useState<UserSuggestItem[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<UserSuggestItem | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setStudentQuery('');
    setStudentSuggestions([]);
    setSelectedStudent(null);
  }, [isOpen]);

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

  if (!isOpen || !mission) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold">Transférer mission</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="text-sm text-slate-700 dark:text-slate-200">
            <div className="text-xs text-slate-500 font-mono">{mission.code}</div>
            <div className="font-medium text-slate-900 dark:text-slate-100">{mission.title}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Nouvel étudiant</label>
            {selectedStudent ? (
              <div className="flex items-center justify-between bg-blue-50 text-blue-700 rounded-lg px-3 py-2 text-sm">
                <div className="truncate">{selectedStudent.label}</div>
                <button
                  type="button"
                  className="hover:text-blue-900"
                  onClick={() => {
                    setSelectedStudent(null);
                    setStudentQuery('');
                    setStudentSuggestions([]);
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input value={studentQuery} onChange={e => setStudentQuery(e.target.value)} placeholder="Rechercher un étudiant..." />
                {studentLoading && (
                  <div className="absolute right-2 top-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}
                {studentSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    {studentSuggestions.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => {
                          setSelectedStudent(s);
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
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button
              onClick={async () => {
                if (!selectedStudent) {
                  setError('Veuillez sélectionner un étudiant');
                  return;
                }
                setError(null);
                setLoading(true);
                try {
                  await attributionsApi.assign({ mission_id: mission.id, student_id: selectedStudent.id });
                  onTransferred();
                  onClose();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Erreur transfert');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading || !selectedStudent}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Transfert...
                </>
              ) : (
                'Transférer'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferMissionModal;
