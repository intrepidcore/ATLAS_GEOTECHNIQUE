import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { supervisorsApi } from '../../services/colab-api';
import { Badge } from './ui';

const SupervisorDetailModal: React.FC<{
  isOpen: boolean;
  supervisorId: string | null;
  onClose: () => void;
}> = ({ isOpen, supervisorId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supervisor, setSupervisor] = useState<{
    id: string;
    user_id: string;
    username: string;
    email: string;
    full_name: string;
    telephone?: string | null;
    is_active: boolean;
    specialite?: string | null;
    institution?: string | null;
    titre?: string | null;
    departement?: string | null;
    notes?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !supervisorId) return;
    setLoading(true);
    setError(null);
    setSupervisor(null);
    supervisorsApi
      .get(supervisorId)
      .then(s => setSupervisor(s))
      .catch(err => setError(err instanceof Error ? err.message : 'Erreur chargement superviseur'))
      .finally(() => setLoading(false));
  }, [isOpen, supervisorId]);

  if (!isOpen || !supervisorId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Détail superviseur</h2>
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

          {supervisor && (
            <div className="space-y-4">
              <div>
                <div className="text-xl font-semibold text-gray-900">{supervisor.full_name}</div>
                <div className="text-sm text-gray-600 mt-1">{supervisor.email}</div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <Badge className={supervisor.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {supervisor.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                  {supervisor.institution && <Badge className="bg-blue-50 text-blue-700">{supervisor.institution}</Badge>}
                  {supervisor.specialite && <Badge className="bg-purple-50 text-purple-700">{supervisor.specialite}</Badge>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-gray-50">
                  <div className="text-xs text-gray-500">Téléphone</div>
                  <div className="text-sm text-gray-900">{supervisor.telephone || '-'}</div>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <div className="text-xs text-gray-500">Titre</div>
                  <div className="text-sm text-gray-900">{supervisor.titre || '-'}</div>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <div className="text-xs text-gray-500">Département</div>
                  <div className="text-sm text-gray-900">{supervisor.departement || '-'}</div>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50 md:col-span-2">
                  <div className="text-xs text-gray-500">Notes</div>
                  <div className="text-sm text-gray-900 whitespace-pre-wrap">{supervisor.notes || '-'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupervisorDetailModal;
