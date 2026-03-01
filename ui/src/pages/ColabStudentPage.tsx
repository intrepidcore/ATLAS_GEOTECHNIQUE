/**
 * Atlas Colab - Page Étudiant
 * 
 * Interface simplifiée pour les étudiants terrain :
 * - Mes missions assignées
 * - Questions & Réponses (poser des questions, gagner des badges)
 * - Notifications
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  MessageCircleQuestion,
  Bell,
  ChevronRight,
  Loader2,
  AlertCircle,
  Award,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ColabQAPage from './ColabQAPage';

// ============================================================================
// Types
// ============================================================================

interface StudentMission {
  id: string;
  code: string;
  name: string;
  locality: string;
  status: 'planned' | 'in_progress' | 'completed';
  start_date: string | null;
  end_date: string | null;
  total_sondages: number;
  completed_sondages: number;
  percent_done: number;
}

interface StudentStats {
  missions_count: number;
  sondages_count: number;
  questions_asked: number;
  answers_given: number;
  reputation: number;
}

// ============================================================================
// API
// ============================================================================

const API_BASE_URL = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('atlas_token') 
    || localStorage.getItem('atlas_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ============================================================================
// Composants
// ============================================================================

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  </div>
);

const MissionCard: React.FC<{
  mission: StudentMission;
  onClick: () => void;
}> = ({ mission, onClick }) => {
  const statusColors = {
    planned: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-700',
  };

  const statusLabels = {
    planned: 'Planifiée',
    in_progress: 'En cours',
    completed: 'Terminée',
  };

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl p-4 shadow-sm border hover:shadow-md transition-shadow text-left"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[mission.status]}`}>
              {statusLabels[mission.status]}
            </span>
            <span className="text-xs text-gray-400">{mission.code}</span>
          </div>
          <h3 className="font-semibold text-gray-900">{mission.name}</h3>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <MapPin className="h-3 w-3" />
            {mission.locality}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>{mission.completed_sondages}/{mission.total_sondages} sondages</span>
          <span>{Math.round(mission.percent_done)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 rounded-full transition-all"
            style={{ width: `${mission.percent_done}%` }}
          />
        </div>
      </div>
    </button>
  );
};

// ============================================================================
// Page Principale
// ============================================================================

const ColabStudentPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'missions' | 'qa' | 'notifications'>('missions');
  const [missions, setMissions] = useState<StudentMission[]>([]);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Charger les missions de l'étudiant (URL corrigée)
      const missionsRes = await fetch(`${API_BASE_URL}/colab/mobile/missions`, {
        headers: getAuthHeaders(),
      });

      if (missionsRes.ok) {
        const data = await missionsRes.json();
        const loadedMissions = data.missions || [];
        setMissions(loadedMissions);
        
        // Calculer les stats à partir des missions chargées
        const totalSondages = loadedMissions.reduce((acc: number, m: StudentMission) => acc + m.completed_sondages, 0);
        setStats({
          missions_count: loadedMissions.length,
          sondages_count: totalSondages,
          questions_asked: 0,
          answers_given: 0,
          reputation: 0,
        });
      } else {
        throw new Error('Erreur lors du chargement des missions');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMissionClick = (missionId: string) => {
    // Ouvrir la PWA mobile dans un nouvel onglet ou rediriger
    window.location.href = `/colab/mobile/missions/${missionId}`;
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] bg-gray-50">
      {/* Header avec salutation */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl mb-6">
        <h1 className="text-2xl font-bold">
          Bonjour, {user?.first_name || user?.username || 'Étudiant'} 👋
        </h1>
        <p className="text-blue-100 mt-1">
          Bienvenue sur Atlas Colab - Votre espace terrain
        </p>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<MapPin className="h-5 w-5 text-blue-600" />}
          label="Missions"
          value={missions.length}
          color="bg-blue-50"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          label="Sondages"
          value={stats?.sondages_count || 0}
          color="bg-green-50"
        />
        <StatCard
          icon={<HelpCircle className="h-5 w-5 text-purple-600" />}
          label="Questions"
          value={stats?.questions_asked || 0}
          color="bg-purple-50"
        />
        <StatCard
          icon={<Award className="h-5 w-5 text-yellow-600" />}
          label="Réputation"
          value={stats?.reputation || 0}
          color="bg-yellow-50"
        />
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-xl shadow-sm border mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('missions')}
            className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'missions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MapPin className="h-4 w-4 inline mr-2" />
            Mes Missions
          </button>
          <button
            onClick={() => setActiveTab('qa')}
            className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'qa'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageCircleQuestion className="h-4 w-4 inline mr-2" />
            Questions & Réponses
          </button>
        </div>

        {/* Contenu des onglets */}
        <div className="p-4">
          {activeTab === 'missions' && (
            <>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : error ? (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  {error}
                </div>
              ) : missions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Aucune mission assignée pour le moment</p>
                  <p className="text-sm mt-1">Vos missions apparaîtront ici</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {missions.map(mission => (
                    <MissionCard
                      key={mission.id}
                      mission={mission}
                      onClick={() => handleMissionClick(mission.id)}
                    />
                  ))}
                </div>
              )}

              {/* Lien vers PWA */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">📱 Application Terrain</h3>
                <p className="text-sm text-blue-700 mb-3">
                  Utilisez l'application mobile pour saisir vos sondages sur le terrain
                </p>
                <a
                  href="/colab/mobile/missions"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  <MapPin className="h-4 w-4" />
                  Ouvrir l'app terrain
                </a>
              </div>
            </>
          )}

          {activeTab === 'qa' && (
            <ColabQAPage />
          )}
        </div>
      </div>
    </div>
  );
};

export default ColabStudentPage;
