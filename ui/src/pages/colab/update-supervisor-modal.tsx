import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { SupervisorSummary, supervisorsApi, UpdateSupervisorRequest } from '../../services/colab-api';
import { usersApi } from '../../services/auth-api';
import { Button, Input } from './ui';

const UpdateSupervisorModal: React.FC<{
  isOpen: boolean;
  supervisor: SupervisorSummary | null;
  onClose: () => void;
  onUpdated: () => void;
}> = ({ isOpen, supervisor, onClose, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<UpdateSupervisorRequest>({});

  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (!supervisor) return;
    setNewPassword('');
    setForm({
      email: (supervisor as any).email || undefined,
      first_name: (supervisor as any).first_name || undefined,
      last_name: (supervisor as any).last_name || undefined,
      specialite: supervisor.specialite || undefined,
      institution: supervisor.institution || undefined,
      is_active: (supervisor as any).is_active ?? true,
    });
  }, [supervisor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisor) return;
    setError(null);
    setLoading(true);

    try {
      await supervisorsApi.update(supervisor.id, form);
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!supervisor) return;
    if (!newPassword.trim()) {
      setError('Veuillez saisir un nouveau mot de passe');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await usersApi.resetPassword(supervisor.user_id, newPassword.trim());
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !supervisor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Modifier Superviseur</h2>
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

          <div className="text-sm text-gray-700">
            <div className="font-medium">{supervisor.full_name}</div>
            <div className="text-gray-500">{supervisor.username}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <Input value={form.first_name || ''} onChange={e => setForm({ ...form, first_name: e.target.value || undefined })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <Input value={form.last_name || ''} onChange={e => setForm({ ...form, last_name: e.target.value || undefined })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value || undefined })} />
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

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
            Actif
          </label>

          <div className="border rounded-lg p-3">
            <div className="text-sm font-medium text-gray-900">Réinitialiser le mot de passe</div>
            <div className="mt-2 flex gap-2">
              <div className="flex-1">
                <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nouveau mot de passe" />
              </div>
              <Button variant="outline" onClick={handleResetPassword} disabled={loading}>
                Reset
              </Button>
            </div>
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

export default UpdateSupervisorModal;
