import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { Student, studentsApi } from '../../services/colab-api';
import { Badge } from './ui';

const StudentDetailModal: React.FC<{
  isOpen: boolean;
  studentId: string | null;
  onClose: () => void;
}> = ({ isOpen, studentId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (!isOpen || !studentId) return;
    setLoading(true);
    setError(null);
    setStudent(null);
    studentsApi
      .get(studentId)
      .then(s => setStudent(s))
      .catch(err => setError(err instanceof Error ? err.message : 'Erreur chargement étudiant'))
      .finally(() => setLoading(false));
  }, [isOpen, studentId]);

  if (!isOpen || !studentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Détail étudiant</h2>
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
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {student && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold text-gray-900">{student.full_name}</div>
                  <div className="text-sm text-gray-600 mt-1">{student.email}</div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Badge className={student.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}>
                      {student.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                    <Badge className="bg-blue-50 text-blue-700">Promo: {student.promotion}</Badge>
                    <Badge className="bg-purple-50 text-purple-700">Missions actives: {student.active_missions}</Badge>
                    <Badge className="bg-purple-50 text-purple-700">Mailles actives: {student.active_mailles}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-gray-50">
                  <div className="text-xs text-gray-500">Téléphone</div>
                  <div className="text-sm text-gray-900">{student.telephone || '-'}</div>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <div className="text-xs text-gray-500">Âge</div>
                  <div className="text-sm text-gray-900">{student.age ?? '-'}</div>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <div className="text-xs text-gray-500">Matricule</div>
                  <div className="text-sm text-gray-900">{student.matricule || '-'}</div>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <div className="text-xs text-gray-500">Établissement</div>
                  <div className="text-sm text-gray-900">{student.etablissement || '-'}</div>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <div className="text-xs text-gray-500">Filière</div>
                  <div className="text-sm text-gray-900">{student.filiere || '-'}</div>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <div className="text-xs text-gray-500">Niveau</div>
                  <div className="text-sm text-gray-900">{student.niveau || '-'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDetailModal;
