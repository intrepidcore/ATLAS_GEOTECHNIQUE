import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { Student, studentsApi, UpdateStudentRequest } from '../../services/colab-api';
import { usersApi } from '../../services/auth-api';
import { Button, Input } from './ui';

const UpdateStudentModal: React.FC<{
  isOpen: boolean;
  student: Student | null;
  onClose: () => void;
  onUpdated: () => void;
}> = ({ isOpen, student, onClose, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<UpdateStudentRequest>({});
  const [newPassword, setNewPassword] = useState('');
  // Retour d'action propre au bloc mot de passe : la bannière générale est en
  // haut du formulaire, hors écran quand on agit sur ce bloc situé en bas.
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetOk, setResetOk] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!student) return;
    setNewPassword('');
    setResetError(null);
    setResetOk(null);
    let cancelled = false;
    (async () => {
      try {
        const u = await usersApi.get(student.user_id);
        if (cancelled) return;
        setForm({
          email: u.email,
          first_name: u.first_name || undefined,
          last_name: u.last_name || undefined,
          telephone: (u as any).telephone || undefined,
          matricule: student.matricule || undefined,
          promotion: student.promotion || undefined,
          filiere: student.filiere || undefined,
          etablissement: student.etablissement || undefined,
          niveau: student.niveau || undefined,
          age: (student as any).age || undefined,
          is_active: student.is_active,
        });
      } catch {
        if (cancelled) return;
        setForm({
          matricule: student.matricule || undefined,
          promotion: student.promotion || undefined,
          filiere: student.filiere || undefined,
          etablissement: student.etablissement || undefined,
          niveau: student.niveau || undefined,
          age: (student as any).age || undefined,
          is_active: student.is_active,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    setError(null);
    setLoading(true);

    try {
      await studentsApi.update(student.id, form);
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!student) return;
    setResetError(null);
    setResetOk(null);
    if (!newPassword.trim()) {
      setResetError('Veuillez saisir un nouveau mot de passe');
      return;
    }
    setLoading(true);
    try {
      await usersApi.resetPassword(student.user_id, newPassword.trim());
      setNewPassword('');
      // Le .atlaspack est chiffré à partir du hash du compte : le serveur en
      // relance la génération, sans quoi l'opérateur garderait un paquet qui
      // ne s'ouvre qu'avec l'ancien mot de passe.
      setResetOk(
        'Mot de passe réinitialisé. Les sessions ouvertes sont révoquées et le paquet .atlaspack est en cours de régénération.'
      );
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Erreur lors de la réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Modifier Étudiant</h2>
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
            <div className="font-medium">{student.full_name}</div>
            <div className="text-gray-500">{student.email}</div>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promotion</label>
              <Input value={form.promotion || ''} onChange={e => setForm({ ...form, promotion: e.target.value || undefined })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matricule</label>
              <Input value={form.matricule || ''} onChange={e => setForm({ ...form, matricule: e.target.value || undefined })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filière</label>
              <Input value={form.filiere || ''} onChange={e => setForm({ ...form, filiere: e.target.value || undefined })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Établissement</label>
              <Input value={form.etablissement || ''} onChange={e => setForm({ ...form, etablissement: e.target.value || undefined })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
            <Input value={form.niveau || ''} onChange={e => setForm({ ...form, niveau: e.target.value || undefined })} />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
            Actif
          </label>

          <div className="border rounded-lg p-3">
            <div className="text-sm font-medium text-gray-900">Réinitialiser le mot de passe</div>
            <div className="mt-1 text-xs text-gray-500">
              8 caractères minimum, avec au moins une majuscule, une minuscule, un chiffre et un caractère spécial.
              Le mot de passe actuel n'est pas consultable : seule une empreinte Argon2id est conservée.
            </div>
            <div className="mt-2 flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => {
                    setNewPassword(e.target.value);
                    setResetError(null);
                    setResetOk(null);
                  }}
                  placeholder="Nouveau mot de passe"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {/* Afficher ce qu'on est en train de saisir évite les fautes de
                    frappe sur un mot de passe long qu'on devra dicter ensuite.
                    Le mot de passe DÉJÀ enregistré, lui, n'est pas affichable :
                    la base ne stocke qu'une empreinte Argon2id, irréversible. */}
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button variant="outline" onClick={handleResetPassword} disabled={loading || !newPassword.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset'}
              </Button>
            </div>
            {resetOk && (
              <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{resetOk}</span>
              </div>
            )}
            {resetError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{resetError}</span>
              </div>
            )}
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

export default UpdateStudentModal;
