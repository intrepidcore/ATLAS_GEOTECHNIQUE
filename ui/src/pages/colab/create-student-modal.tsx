import React, { useState } from 'react';
import { AlertCircle, Loader2, Plus, X } from 'lucide-react';
import { CreateStudentRequest, CreateStudentResponse, studentsApi } from '../../services/colab-api';
import { Button, Input } from './ui';

const CreateStudentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialForm?: Partial<CreateStudentRequest>;
  onCreatedStudent?: (student: any) => void;
  onOpenExistingStudent?: (studentId: string) => void;
}> = ({ isOpen, onClose, onCreated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateStudentResponse | null>(null);
  const [form, setForm] = useState<CreateStudentRequest>({
    email: '',
    first_name: '',
    last_name: '',
    promotion: '',
  });

  const resetAll = () => {
    setError(null);
    setCreated(null);
    setForm({
      email: '',
      first_name: '',
      last_name: '',
      promotion: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setLoading(true);

    try {
      const res = await studentsApi.create(form);
      setCreated(res);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
      const payload = (err as any)?.payload;
      if (payload?.existing_student_id) {
        (window as any).__lastCreateStudentErrorPayload = payload;
      }
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
          <h2 className="text-lg font-semibold">Nouvel Étudiant</h2>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promotion *</label>
              <Input value={form.promotion} onChange={e => setForm({ ...form, promotion: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matricule</label>
              <Input value={form.matricule || ''} onChange={e => setForm({ ...form, matricule: e.target.value || undefined })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <Input value={form.telephone || ''} onChange={e => setForm({ ...form, telephone: e.target.value || undefined })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Âge</label>
              <Input
                type="number"
                value={typeof form.age === 'number' ? String(form.age) : ''}
                onChange={e => {
                  const v = e.target.value.trim();
                  setForm({ ...form, age: v ? Number(v) : undefined });
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filière</label>
            <Input value={form.filiere || ''} onChange={e => setForm({ ...form, filiere: e.target.value || undefined })} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Établissement</label>
            <Input value={form.etablissement || ''} onChange={e => setForm({ ...form, etablissement: e.target.value || undefined })} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
            <Input value={form.niveau || ''} onChange={e => setForm({ ...form, niveau: e.target.value || undefined })} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            {created ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetAll();
                    onClose();
                  }}
                >
                  Fermer
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    resetAll();
                  }}
                >
                  Ajouter un autre
                </Button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateStudentModal;
