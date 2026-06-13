import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MapPin,
  MoreVertical,
  Pause,
  Users,
  XCircle,
} from 'lucide-react';
import {
  formatDate,
  getStatusColor,
  getStatusLabel,
  getThemeLabel,
  MissionListItem,
  OperationalAction,
} from '../../services/colab-api';
import { Badge } from './ui';

// ============================================================================
// Composant Stats Card
// ============================================================================

export const StatsCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, icon, color }) => (
  <div className={`rounded-xl p-4 ${color}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium opacity-80">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </div>
      <div className="opacity-80">{icon}</div>
    </div>
  </div>
);

// ============================================================================
// Composant Mission Card
// ============================================================================

const STATUS_TRANSITIONS: Record<string, { next: string; label: string }> = {
  draft: { next: 'planned', label: 'Planifier la mission' },
  planned: { next: 'in_progress', label: 'Démarrer la mission' },
  in_progress: { next: 'completed', label: 'Marquer terminée' },
};

export const MissionCard: React.FC<{
  mission: MissionListItem;
  onClick: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onTransfer?: () => void;
  onStatusChange?: (mission: MissionListItem, newStatus: string) => void;
  onOperationalAction?: (mission: MissionListItem, action: OperationalAction) => void;
}> = ({ mission, onClick, onDelete, onEdit, onTransfer, onStatusChange, onOperationalAction }) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const statusIcon =
    {
      draft: <FileText className="w-4 h-4" />,
      planned: <Clock className="w-4 h-4" />,
      in_progress: <Loader2 className="w-4 h-4 animate-spin" />,
      completed: <CheckCircle2 className="w-4 h-4" />,
      cancelled: <XCircle className="w-4 h-4" />,
      suspended: <Pause className="w-4 h-4" />,
    }[mission.status] || <FileText className="w-4 h-4" />;

  const operationalBadgeClass =
    mission.operational_status === 'ok'
      ? 'bg-green-50 text-green-700'
      : mission.operational_status === 'warning'
        ? 'bg-amber-50 text-amber-700'
        : mission.operational_status === 'blocked'
          ? 'bg-red-50 text-red-700'
          : 'bg-gray-100 text-gray-700';

  const operationalLabel =
    mission.operational_status === 'ok'
      ? 'OK'
      : mission.operational_status === 'warning'
        ? 'À vérifier'
        : mission.operational_status === 'blocked'
          ? 'Bloquée'
          : mission.operational_status;

  const issues = mission.operational_issues || [];
  const issuesToRender =
    issues.length > 0
      ? issues
      : mission.operational_status !== 'ok' && mission.operational_reason
        ? [
            {
              code: 'operational_reason',
              severity: 'warning',
              scope: 'mission',
              message: mission.operational_reason,
              actions: [{ code: 'open_mission', label: 'Ouvrir la mission', payload: { action: 'open_mission' } }],
            },
          ]
        : [];

  const menuActions = useMemo(() => {
    const seen = new Set<string>();
    const out: OperationalAction[] = [];
    for (const issue of issuesToRender) {
      for (const a of issue.actions || []) {
        const key = `${a.code}:${a.payload?.action || ''}:${a.payload?.student_id || ''}:${a.payload?.mission_id || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(a);
      }
    }
    return out;
  }, [issuesToRender]);

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-gray-500 truncate">{mission.code}</span>
          <Badge className={getStatusColor(mission.status)}>
            {statusIcon}
            <span className="ml-1">{getStatusLabel(mission.status)}</span>
          </Badge>
        </div>

        <div className="relative">
          <button
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={e => {
              e.stopPropagation();
              setMenuOpen(v => !v);
            }}
            title="Actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {menuActions.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Résoudre</div>
                  {menuActions.map((action, idx) => (
                    <button
                      key={`${action.code}-${idx}`}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => {
                        setMenuOpen(false);
                        onOperationalAction?.(mission, action);
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                  <div className="h-px bg-slate-100 dark:bg-slate-800" />
                </>
              )}

              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => {
                  setMenuOpen(false);
                  onClick();
                }}
              >
                Ouvrir
              </button>

              {onEdit && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                >
                  Modifier
                </button>
              )}

              {onTransfer && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => {
                    setMenuOpen(false);
                    onTransfer();
                  }}
                >
                  Transférer mission
                </button>
              )}

              {(mission.operational_reason || mission.conflict_mission_id) && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => {
                    setMenuOpen(false);
                    setDetailsOpen(v => !v);
                  }}
                >
                  {detailsOpen ? 'Masquer détails' : 'Afficher détails'}
                </button>
              )}

              {onStatusChange && STATUS_TRANSITIONS[mission.status] && (
                <>
                  <div className="h-px bg-slate-100 dark:bg-slate-800" />
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-medium transition-colors"
                    onClick={() => {
                      setMenuOpen(false);
                      onStatusChange(mission, STATUS_TRANSITIONS[mission.status].next);
                    }}
                  >
                    {STATUS_TRANSITIONS[mission.status].label}
                  </button>
                </>
              )}

              {onDelete && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  Supprimer
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mb-2">
        <h3 className="font-semibold text-gray-900 line-clamp-1">{mission.title}</h3>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <Badge className={operationalBadgeClass}>{operationalLabel}</Badge>
        {mission.operational_status === 'blocked_conflict' && <Badge className="bg-red-50 text-red-700">Conflit</Badge>}
        <Badge className="bg-gray-50 text-gray-700">{mission.assigned_students_count} étudiant(s)</Badge>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>{mission.zone_label || mission.commune || mission.region || 'Non défini'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>
            {mission.start_date ? formatDate(mission.start_date) : 'Non planifié'}
            {mission.end_date && ` → ${formatDate(mission.end_date)}`}
          </span>
        </div>
        {mission.supervisor_name && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span>{mission.supervisor_name}</span>
          </div>
        )}
      </div>

      {detailsOpen && (mission.operational_reason || mission.conflict_mission_id) && (
        <div className="mt-3 text-xs text-gray-600 bg-gray-50 border rounded-lg p-2">
          {mission.operational_reason && <div className="truncate">{mission.operational_reason}</div>}
          {mission.conflict_mission_id && (
            <div className="mt-1 truncate">
              Conflit: {mission.conflict_holder_name || mission.conflict_holder_email || mission.conflict_mission_id}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <Badge className="bg-purple-100 text-purple-800">{getThemeLabel(mission.theme)}</Badge>
        <span className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {mission.linked_sondages_count}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {mission.documents_count}
          </span>
        </span>
      </div>
    </div>
  );
};
