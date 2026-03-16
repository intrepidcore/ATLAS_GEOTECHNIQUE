import React from 'react';
import {
  AlertCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import {
  ColabStats,
  MissionFilters,
  MissionListItem,
  MISSION_STATUSES,
  MISSION_THEMES,
  OperationalAction,
} from '../../../services/colab-api';
import { Button, Input, Select } from '../ui';
import { MissionCard, StatsCard } from '../cards';

const MissionsTab: React.FC<{
  stats: ColabStats | null;
  studentsKpiValue: number;

  missions: MissionListItem[];
  loading: boolean;
  error: string | null;

  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;

  showFilters: boolean;
  onToggleFilters: () => void;

  filters: MissionFilters;
  onFilterChange: (key: keyof MissionFilters, value: any) => void;
  onClearFilters: () => void;

  filtersCommuneQuery: string;
  onFiltersCommuneQueryChange: (value: string) => void;
  filtersCommuneSuggestions: string[];
  filtersCommuneLoading: boolean;
  onSelectCommune: (value: string) => void;

  filtersRegionQuery: string;
  onFiltersRegionQueryChange: (value: string) => void;
  filtersRegionSuggestions: string[];
  filtersRegionLoading: boolean;
  onSelectRegion: (value: string) => void;

  total: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;

  canTransferMission: boolean;

  onOpenMissionDetail: (missionId: string, tab?: 'details' | 'edit') => void;
  onOperationalAction: (mission: MissionListItem, action: OperationalAction) => void | Promise<void>;
  onTransferMission: (mission: MissionListItem) => void;
  onDeleteMission: (mission: MissionListItem) => void;

  onOpenCreateMission: () => void;
}> = ({
  stats,
  studentsKpiValue,
  missions,
  loading,
  error,
  searchInput,
  onSearchInputChange,
  onSearch,
  showFilters,
  onToggleFilters,
  filters,
  onFilterChange,
  onClearFilters,
  filtersCommuneQuery,
  onFiltersCommuneQueryChange,
  filtersCommuneSuggestions,
  filtersCommuneLoading,
  onSelectCommune,
  filtersRegionQuery,
  onFiltersRegionQueryChange,
  filtersRegionSuggestions,
  filtersRegionLoading,
  onSelectRegion,
  total,
  totalPages,
  onPrevPage,
  onNextPage,
  canTransferMission,
  onOpenMissionDetail,
  onOperationalAction,
  onTransferMission,
  onDeleteMission,
  onOpenCreateMission,
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
            value={studentsKpiValue}
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
            value={stats.total_documents}
            icon={<FileText className="w-6 h-6" />}
            color="bg-orange-50 text-orange-900"
          />
        </div>
      )}

      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher (titre, code maille, thème, opérateur...)"
                value={searchInput}
                onChange={e => onSearchInputChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onSearch()}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Button variant="secondary" onClick={onSearch}>
              Rechercher
            </Button>
          </div>
          <Button variant={showFilters ? 'primary' : 'outline'} onClick={onToggleFilters}>
            <Filter className="w-4 h-4 mr-2" />
            Filtres
          </Button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Thème</label>
              <Select
                value={filters.theme || ''}
                onChange={e => onFilterChange('theme', e.target.value)}
                options={MISSION_THEMES}
                placeholder="Tous les thèmes"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
              <Select
                value={filters.status || ''}
                onChange={e => onFilterChange('status', e.target.value)}
                options={MISSION_STATUSES}
                placeholder="Tous les statuts"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Commune</label>
              <div className="relative">
                <Input
                  placeholder="Filtrer par commune"
                  value={filtersCommuneQuery}
                  onChange={e => {
                    const v = e.target.value;
                    onFiltersCommuneQueryChange(v);
                    onFilterChange('commune', v);
                  }}
                />
                {filtersCommuneLoading && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}
                {filtersCommuneSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-lg shadow max-h-48 overflow-auto">
                    {filtersCommuneSuggestions.slice(0, 20).map(c => (
                      <button
                        key={c}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => onSelectCommune(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Région</label>
              <div className="relative">
                <Input
                  placeholder="Filtrer par région"
                  value={filtersRegionQuery}
                  onChange={e => {
                    const v = e.target.value;
                    onFiltersRegionQueryChange(v);
                    onFilterChange('region', v);
                  }}
                />
                {filtersRegionLoading && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}
                {filtersRegionSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-lg shadow max-h-48 overflow-auto">
                    {filtersRegionSuggestions.slice(0, 20).map(r => (
                      <button
                        key={r}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => onSelectRegion(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="col-span-2 md:col-span-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={onClearFilters}>
                <X className="w-4 h-4 mr-1" />
                Réinitialiser les filtres
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {!loading && missions.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {missions.map(mission => (
              <MissionCard
                key={mission.id}
                mission={mission}
                onClick={() => onOpenMissionDetail(mission.id, 'details')}
                onOperationalAction={async (m, action) => {
                  await onOperationalAction(m, action);
                }}
                onEdit={() => onOpenMissionDetail(mission.id, 'edit')}
                onTransfer={
                  canTransferMission
                    ? () => {
                        onTransferMission(mission);
                      }
                    : undefined
                }
                onDelete={() => onDeleteMission(mission)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-600">
              {total} mission{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={(filters.page || 1) === 1} onClick={onPrevPage}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Page {filters.page || 1} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={(filters.page || 1) >= totalPages} onClick={onNextPage}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {!loading && missions.length === 0 && !error && (
        <div className="text-center py-12">
          <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune mission trouvée</h3>
          <p className="text-gray-500 mb-4">
            {filters.search || filters.theme || filters.status ? 'Essayez de modifier vos filtres' : 'Créez votre première mission terrain'}
          </p>
          <Button onClick={onOpenCreateMission}>
            <Plus className="w-4 h-4 mr-2" />
            Créer une mission
          </Button>
        </div>
      )}
    </>
  );
};

export default MissionsTab;
