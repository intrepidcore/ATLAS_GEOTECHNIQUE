import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Download, FileWarning, Loader2, PackageCheck, RefreshCw, Upload,
} from 'lucide-react';
import { atlaspackApi, studentsApi, AtlasPackPackage, AtlasPackReturn } from '../../services/colab-api';

const inputClass = 'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

const STATUS_LABEL: Record<AtlasPackPackage['status'], string> = {
  not_prepared: 'Non préparé',
  preparing: 'Préparation en cours…',
  ready: 'Prêt',
  stale: 'Obsolète (à régénérer)',
  failed: 'Échec de génération',
};

const STATUS_COLOR: Record<AtlasPackPackage['status'], string> = {
  not_prepared: 'bg-slate-100 text-slate-600',
  preparing: 'bg-blue-100 text-blue-700',
  ready: 'bg-green-100 text-green-700',
  stale: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
};

function formatBytes(n: number | null): string {
  if (n === null) return '—';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

const StatusBadge: React.FC<{ status: AtlasPackPackage['status'] }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}>
    {status === 'preparing' && <Loader2 size={12} className="animate-spin" />}
    {STATUS_LABEL[status]}
  </span>
);

/**
 * Vue d'ensemble des paquets .atlaspack (un par opérateur) et des retours
 * terrain .atlasreturn réimportés. Panneau autonome, ajouté à ColabPage
 * comme un onglet supplémentaire (aucune modification des onglets existants).
 */
export const AtlasPackPanel: React.FC = () => {
  const [packages, setPackages] = useState<AtlasPackPackage[]>([]);
  const [returns, setReturns] = useState<AtlasPackReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pkgs, rets] = await Promise.all([atlaspackApi.listPackages(), atlaspackApi.listReturns()]);
      setPackages(pkgs.items);
      setReturns(rets.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // Rafraîchissement léger tant qu'au moins un paquet est en préparation —
  // évite de laisser l'écran figé sur "Préparation en cours…".
  useEffect(() => {
    if (!packages.some(p => p.status === 'preparing')) return;
    const t = setTimeout(() => void load(), 4000);
    return () => clearTimeout(t);
  }, [packages]);

  const onRegenerate = async (pkg: AtlasPackPackage) => {
    if (!pkg.student_id) return;
    setBusyId(pkg.id);
    try {
      await atlaspackApi.generate(pkg.student_id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Régénération impossible');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Génère les paquets des opérateurs qui n'en ont AUCUN.
   *
   * Le bouton "Régénérer" ci-dessous ne fonctionne que sur un paquet déjà
   * existant : un opérateur nouvellement affecté n'apparaissait donc nulle
   * part dans cet écran, et il n'existait aucun moyen depuis l'interface de
   * lui préparer son paquet. Les envois sont séquentiels : le worker traite
   * de toute façon un job à la fois, et 30 requêtes simultanées ne feraient
   * qu'encombrer le navigateur sans rien accélérer.
   */
  const onGenerateMissing = async () => {
    setBulkBusy(true);
    setError(null);
    setBulkProgress('Recherche des opérateurs sans paquet…');
    try {
      const { students } = await studentsApi.list();
      const withPackage = new Set(packages.map(p => p.student_id).filter(Boolean) as string[]);
      const missing = students.filter(
        st => st.is_active && st.active_missions > 0 && !withPackage.has(st.id),
      );
      if (missing.length === 0) {
        setBulkProgress('Tous les opérateurs affectés ont déjà un paquet.');
        return;
      }
      let done = 0;
      const failed: string[] = [];
      for (const st of missing) {
        setBulkProgress(`Mise en file ${done + 1}/${missing.length} — ${st.full_name}`);
        try {
          await atlaspackApi.generate(st.id);
        } catch {
          failed.push(st.full_name);
        }
        done += 1;
      }
      setBulkProgress(
        failed.length === 0
          ? `${done} paquet(s) mis en file de génération.`
          : `${done - failed.length}/${done} mis en file — échecs : ${failed.join(', ')}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Génération groupée impossible');
    } finally {
      setBulkBusy(false);
    }
  };

  const onDownload = async (pkg: AtlasPackPackage) => {
    setBusyId(pkg.id);
    try {
      const blob = await atlaspackApi.download(pkg.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operateur-${pkg.matricule || pkg.operator_email}-${pkg.id.slice(0, 8)}.atlaspack`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Téléchargement impossible');
    } finally {
      setBusyId(null);
    }
  };

  const onImportFile = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    setError(null);
    try {
      const result = await atlaspackApi.importReturn(file);
      const summary = result.already_imported
        ? 'Cet export avait déjà été importé précédemment — aucune donnée dupliquée.'
        : `${result.sondages_count} sondage(s), ${result.essais_count} essai(s), ${result.attachments_count} pièce(s) jointe(s) importé(s) sur ${result.missions_count} mission(s).`;
      setImportResult(summary + (result.warnings.length ? ` (${result.warnings.length} avertissement(s))` : ''));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import du retour terrain refusé');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <PackageCheck className="mt-0.5 text-blue-600" size={20} />
        <div className="text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Paquets opérateur hors-ligne (.atlaspack)</p>
          <p className="mt-1 text-slate-600">
            Générés et rafraîchis automatiquement à chaque attribution ou modification de mission. Téléchargez le
            fichier ci-dessous puis transmettez-le à l'opérateur par tout moyen hors réseau (USB, WhatsApp,
            Bluetooth, carte mémoire).
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Paquets par opérateur</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void onGenerateMissing()}
              disabled={bulkBusy}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {bulkBusy ? <Loader2 size={13} className="animate-spin" /> : <PackageCheck size={13} />}
              Générer les paquets manquants
            </button>
            <button onClick={() => void load()} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
              <RefreshCw size={13} /> Actualiser
            </button>
          </div>
        </div>
        {bulkProgress && (
          <div className="border-b border-slate-100 bg-blue-50 px-4 py-2 text-xs text-blue-800">{bulkProgress}</div>
        )}
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500">Chargement…</div>
        ) : packages.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">Aucun paquet généré pour le moment.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Opérateur</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Missions</th>
                <th className="px-4 py-2 text-left">Tuiles</th>
                <th className="px-4 py-2 text-left">Taille</th>
                <th className="px-4 py-2 text-left">Expire</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {packages.map(pkg => (
                <tr key={pkg.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{pkg.operator_name || pkg.operator_email}</div>
                    <div className="text-xs text-slate-500">{pkg.operator_email}{pkg.matricule ? ` · ${pkg.matricule}` : ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={pkg.status} />
                    {pkg.error && <div className="mt-1 max-w-xs text-xs text-red-600">{pkg.error}</div>}
                    {pkg.tiles_truncated && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                        <FileWarning size={11} /> Zoom réduit : {pkg.tiles_truncation_reason}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{pkg.mission_count}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {pkg.tile_count !== null ? `${pkg.tile_count} (z${pkg.tile_zoom_min}-${pkg.tile_zoom_max})` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatBytes(pkg.file_size_bytes)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {pkg.expires_at ? new Date(pkg.expires_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => void onRegenerate(pkg)}
                        disabled={busyId === pkg.id || pkg.status === 'preparing'}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <RefreshCw size={13} /> Régénérer
                      </button>
                      <button
                        onClick={() => void onDownload(pkg)}
                        disabled={busyId === pkg.id || (pkg.status !== 'ready' && pkg.status !== 'stale')}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Download size={13} /> Télécharger
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Upload className="text-blue-600" size={18} />
          <h3 className="text-sm font-semibold text-slate-900">Réimporter un retour terrain (.atlasreturn)</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Intégrité vérifiée automatiquement (empreintes SHA-256 + contrôle HMAC) avant toute écriture. Réimporter
          deux fois le même fichier ne duplique rien.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".atlasreturn"
          className={`${inputClass} mt-3`}
          disabled={importing}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) void onImportFile(file);
          }}
        />
        {importing && <p className="mt-2 flex items-center gap-1 text-xs text-blue-600"><Loader2 size={12} className="animate-spin" /> Vérification et import en cours…</p>}
        {importResult && <p className="mt-2 flex items-center gap-1 text-xs text-green-700"><CheckCircle2 size={13} /> {importResult}</p>}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Historique des retours terrain reçus</h3>
        </div>
        {returns.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">Aucun retour terrain reçu pour le moment.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Opérateur</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Contenu</th>
                <th className="px-4 py-2 text-left">Reçu le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returns.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-slate-900">{r.operator_email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      r.status === 'applied' ? 'bg-green-100 text-green-700'
                        : r.status === 'rejected' ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      {r.status === 'applied' && <CheckCircle2 size={12} />}
                      {r.status === 'rejected' && <AlertTriangle size={12} />}
                      {r.status === 'received' && <Clock size={12} />}
                      {r.status}
                    </span>
                    {r.rejection_reason && <div className="mt-1 max-w-xs text-xs text-red-600">{r.rejection_reason}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.sondages_count} sondage(s) · {r.essais_count} essai(s) · {r.attachments_count} pièce(s) jointe(s)
                  </td>
                  <td className="px-4 py-3 text-slate-700">{new Date(r.received_at).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
