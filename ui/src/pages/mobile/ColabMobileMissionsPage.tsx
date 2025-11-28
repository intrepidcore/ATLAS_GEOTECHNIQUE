/**
 * Page "Mes Missions" - PWA Mobile Atlas Colab
 * 
 * Liste des missions assignées à l'utilisateur connecté
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, Calendar, Users, ChevronRight, RefreshCw, 
  Wifi, WifiOff, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';
import { mobileApi, offlineStorage, syncService, type MobileMission } from '@/services/colab-mobile-api';

// ============================================================================
// Composants UI Mobile
// ============================================================================

const MobileHeader: React.FC<{
  title: string;
  isOnline: boolean;
  pendingCount: number;
  onSync: () => void;
  syncing: boolean;
}> = ({ title, isOnline, pendingCount, onSync, syncing }) => (
  <header className="sticky top-0 z-50 bg-blue-600 text-white px-4 py-3 shadow-lg">
    <div className="flex items-center justify-between">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-3">
        {pendingCount > 0 && (
          <button
            onClick={onSync}
            disabled={syncing || !isOnline}
            className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{pendingCount}</span>
          </button>
        )}
        <div className="flex items-center gap-1">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-300" />
          ) : (
            <WifiOff className="h-5 w-5 text-yellow-300" />
          )}
        </div>
      </div>
    </div>
    {!isOnline && (
      <div className="mt-2 bg-yellow-500/20 text-yellow-100 text-xs px-3 py-1 rounded-full text-center">
        Mode hors-ligne • Données non à jour
      </div>
    )}
  </header>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Brouillon' },
    planned: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Planifiée' },
    in_progress: { bg: 'bg-green-100', text: 'text-green-700', label: 'En cours' },
    completed: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Terminée' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Annulée' },
    suspended: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Suspendue' },
  };
  const { bg, text, label } = config[status] || config.draft;
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
};

const ProgressBar: React.FC<{ percent: number }> = ({ percent }) => (
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div
      className={`h-2 rounded-full transition-all ${
        percent >= 100 ? 'bg-green-500' : percent >= 50 ? 'bg-blue-500' : 'bg-yellow-500'
      }`}
      style={{ width: `${Math.min(percent, 100)}%` }}
    />
  </div>
);

const MissionCard: React.FC<{
  mission: MobileMission;
  onClick: () => void;
}> = ({ mission, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 active:bg-gray-50 transition-colors cursor-pointer"
  >
    <div className="flex items-start justify-between mb-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-gray-500">{mission.code}</span>
          <StatusBadge status={mission.status} />
        </div>
        <h3 className="font-medium text-gray-900 truncate">{mission.title}</h3>
      </div>
      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
    </div>

    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
      {mission.commune && (
        <div className="flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          <span className="truncate">{mission.commune}</span>
        </div>
      )}
      {mission.start_date && (
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span>{new Date(mission.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
        </div>
      )}
    </div>

    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Progression</span>
        <span className="font-medium">
          {mission.completed_sondages}/{mission.expected_sondages} sondages
        </span>
      </div>
      <ProgressBar percent={mission.percent_done} />
    </div>
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
      <MapPin className="h-8 w-8 text-gray-400" />
    </div>
    <p className="text-gray-500">{message}</p>
  </div>
);

const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
  </div>
);

// ============================================================================
// Page principale
// ============================================================================

const ColabMobileMissionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [missions, setMissions] = useState<MobileMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Surveiller le statut réseau
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Charger les missions
  useEffect(() => {
    loadMissions();
    loadPendingCount();
  }, []);

  // Recharger quand on revient en ligne
  useEffect(() => {
    if (isOnline) {
      loadMissions();
    }
  }, [isOnline]);

  const loadMissions = async () => {
    setLoading(true);
    setError(null);

    try {
      if (isOnline) {
        // Charger depuis l'API
        const response = await mobileApi.getMyMissions();
        setMissions(response.missions);
        // Sauvegarder en local pour le mode offline
        await offlineStorage.saveMissions(response.missions);
      } else {
        // Charger depuis le stockage local
        const localMissions = await offlineStorage.getMissions();
        setMissions(localMissions);
      }
    } catch (err: any) {
      console.error('Erreur chargement missions:', err);
      // Essayer le stockage local en cas d'erreur
      try {
        const localMissions = await offlineStorage.getMissions();
        setMissions(localMissions);
        setError('Données locales affichées (erreur réseau)');
      } catch {
        setError(err.message || 'Erreur de chargement');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPendingCount = async () => {
    const count = await offlineStorage.getPendingCount();
    setPendingCount(count);
  };

  const handleSync = async () => {
    if (!isOnline || syncing) return;

    setSyncing(true);
    try {
      const result = await syncService.syncAll();
      setPendingCount(result.remaining);
      
      if (result.synced > 0) {
        // Recharger les missions après sync
        await loadMissions();
      }
    } catch (err) {
      console.error('Erreur sync:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleMissionClick = (missionId: string) => {
    navigate(`/missions/${missionId}`);
  };

  // Grouper les missions par statut
  const activeMissions = missions.filter(m => m.status === 'in_progress');
  const plannedMissions = missions.filter(m => m.status === 'planned');
  const otherMissions = missions.filter(m => !['in_progress', 'planned'].includes(m.status));

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        title="Mes Missions"
        isOnline={isOnline}
        pendingCount={pendingCount}
        onSync={handleSync}
        syncing={syncing}
      />

      <main className="p-4 pb-20 space-y-6">
        {loading ? (
          <LoadingState />
        ) : error && missions.length === 0 ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : missions.length === 0 ? (
          <EmptyState message="Aucune mission assignée" />
        ) : (
          <>
            {/* Missions en cours */}
            {activeMissions.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  En cours ({activeMissions.length})
                </h2>
                <div className="space-y-3">
                  {activeMissions.map(mission => (
                    <MissionCard
                      key={mission.id}
                      mission={mission}
                      onClick={() => handleMissionClick(mission.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Missions planifiées */}
            {plannedMissions.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-3">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Planifiées ({plannedMissions.length})
                </h2>
                <div className="space-y-3">
                  {plannedMissions.map(mission => (
                    <MissionCard
                      key={mission.id}
                      mission={mission}
                      onClick={() => handleMissionClick(mission.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Autres missions */}
            {otherMissions.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-gray-500 mb-3">
                  Autres ({otherMissions.length})
                </h2>
                <div className="space-y-3">
                  {otherMissions.map(mission => (
                    <MissionCard
                      key={mission.id}
                      mission={mission}
                      onClick={() => handleMissionClick(mission.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Barre de navigation mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-inset-bottom">
        <div className="flex items-center justify-around">
          <button className="flex flex-col items-center gap-1 text-blue-600">
            <MapPin className="h-6 w-6" />
            <span className="text-xs">Missions</span>
          </button>
          <button 
            onClick={() => navigate('/activity')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <Users className="h-6 w-6" />
            <span className="text-xs">Activité</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default ColabMobileMissionsPage;
