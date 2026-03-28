import React from 'react';
import { AlertCircle, BarChart3, FileText, Plus, Search, Users } from 'lucide-react';
import { ColabDocument, ColabStats, formatDate } from '../../../services/colab-api';
import { Button, Input, Select } from '../ui';
import { StatsCard } from '../cards';

const DocumentsTab: React.FC<{
  stats: ColabStats | null;

  documentsSearch: string;
  onDocumentsSearchChange: (value: string) => void;

  documentsSort: 'date_desc' | 'date_asc' | 'title_asc';
  onDocumentsSortChange: (value: 'date_desc' | 'date_asc' | 'title_asc') => void;

  onOpenUpload: () => void;

  documentsMissionId: string | null;
  onDocumentsMissionIdChange: (value: string | null) => void;

  documentsType: string;
  onDocumentsTypeChange: (value: string) => void;

  onApplyFilters: () => void;

  documentsError: string | null;
  documentsLoading: boolean;

  filteredDocuments: ColabDocument[];
  effectiveTotal: number;

  onDownload: (doc: ColabDocument) => void | Promise<void>;
  onDelete: (doc: ColabDocument) => void | Promise<void>;
}> = ({
  stats,
  documentsSearch,
  onDocumentsSearchChange,
  documentsSort,
  onDocumentsSortChange,
  onOpenUpload,
  documentsMissionId,
  onDocumentsMissionIdChange,
  documentsType,
  onDocumentsTypeChange,
  onApplyFilters,
  documentsError,
  documentsLoading,
  filteredDocuments,
  effectiveTotal,
  onDownload,
  onDelete,
}) => {
  return (
    <>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatsCard
            title="Total Missions"
            value={stats.total_missions}
            icon={<BarChart3 className="w-6 h-6" />}
            color="bg-blue-50 text-blue-900"
          />
          <StatsCard
            title="Étudiants"
            value={stats.total_students}
            icon={<Users className="w-6 h-6" />}
            color="bg-green-50 text-green-900"
          />
          <StatsCard
            title="Superviseurs"
            value={stats.total_supervisors}
            icon={<Users className="w-6 h-6" />}
            color="bg-purple-50 text-purple-900"
          />
          <StatsCard
            title="Documents"
            value={filteredDocuments.length}
            icon={<FileText className="w-6 h-6" />}
            color="bg-orange-50 text-orange-900"
          />
        </div>
      )}

      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher (titre, fichier, type)..."
              value={documentsSearch}
              onChange={e => onDocumentsSearchChange(e.target.value)}
              className="w-full h-10 pl-10 pr-4 border rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select
              value={documentsSort}
              onChange={e => onDocumentsSortChange(e.target.value as any)}
              options={[
                { value: 'date_desc', label: 'Tri: Date (récent)' },
                { value: 'date_asc', label: 'Tri: Date (ancien)' },
                { value: 'title_asc', label: 'Tri: Titre (A→Z)' },
              ]}
            />
            <Button variant="outline" onClick={onOpenUpload}>
              <Plus className="w-4 h-4 mr-2" />
              Uploader
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Filtrer par mission</label>
            <Input
              placeholder="ID mission (uuid)"
              value={documentsMissionId || ''}
              onChange={e => onDocumentsMissionIdChange(e.target.value || null)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <Select
              value={documentsType}
              onChange={e => onDocumentsTypeChange(e.target.value)}
              options={[
                { value: '', label: 'Tous' },
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
          <div className="md:col-span-2 flex justify-end">
            <Button variant="outline" onClick={onApplyFilters}>
              Filtrer
            </Button>
          </div>
        </div>

        <div className="p-4">
          {documentsError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {documentsError}
            </div>
          )}

          <div className="text-sm text-gray-600 mb-3">
            {filteredDocuments.length} affichés / {effectiveTotal} au total
          </div>

          <div className="max-h-[65vh] overflow-auto">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Titre</th>
                    <th className="text-left font-medium px-4 py-3">Type</th>
                    <th className="text-left font-medium px-4 py-3">Fichier</th>
                    <th className="text-left font-medium px-4 py-3">Date</th>
                    <th className="text-left font-medium px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map(d => (
                    <tr key={d.id} className="border-t">
                      <td className="px-4 py-3 text-gray-900">{d.title}</td>
                      <td className="px-4 py-3 text-gray-600">{d.document_type}</td>
                      <td className="px-4 py-3 text-gray-600">{d.file_name}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(d.uploaded_at)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => onDownload(d)}>
                            Télécharger
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onDelete(d)}>
                            Supprimer
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!documentsLoading && filteredDocuments.length === 0 && <div className="p-8 text-center text-gray-500">Aucun document</div>}
          </div>
        </div>
      </div>
    </>
  );
};

export default DocumentsTab;
