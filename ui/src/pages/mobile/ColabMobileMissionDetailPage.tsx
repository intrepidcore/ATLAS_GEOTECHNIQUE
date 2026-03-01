/**
 * Page "Détail Mission" - PWA Mobile Atlas Colab
 * 
 * Affiche les détails d'une mission avec mini-carte et actions
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, MapPin, Calendar, Users, Map, Plus, 
  ChevronRight, User, Mail, Clock, Target, FileText,
  MessageCircleQuestion, Send, Loader2
} from 'lucide-react';
import { mobileApi, type MobileMissionDetail, type MobileSondage } from '@/services/colab-mobile-api';

// ============================================================================
// Composants UI
// ============================================================================

const MobileHeader: React.FC<{
  title: string;
  onBack: () => void;
}> = ({ title, onBack }) => (
  <header className="sticky top-0 z-50 bg-blue-600 text-white px-4 py-3 shadow-lg">
    <div className="flex items-center gap-3">
      <button onClick={onBack} className="p-1 -ml-1">
        <ArrowLeft className="h-6 w-6" />
      </button>
      <h1 className="text-lg font-semibold truncate">{title}</h1>
    </div>
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
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
};

const ThemeBadge: React.FC<{ theme: string }> = ({ theme }) => {
  const labels: Record<string, string> = {
    stabilisation: 'Stabilisation',
    synthese: 'Synthèse',
    reconnaissance: 'Reconnaissance',
    etude_detaillee: 'Étude détaillée',
    controle: 'Contrôle',
  };
  
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
      {labels[theme] || theme}
    </span>
  );
};

const InfoCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
    <div className="text-gray-400">{icon}</div>
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-900">{value}</div>
    </div>
  </div>
);

const ProgressRing: React.FC<{ percent: number; size?: number }> = ({ percent, size = 80 }) => {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-gray-200"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={percent >= 100 ? 'text-green-500' : 'text-blue-500'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-gray-900">{Math.round(percent)}%</span>
      </div>
    </div>
  );
};

const SondageItem: React.FC<{ sondage: MobileSondage }> = ({ sondage }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${
        sondage.validation_status === 'validated' ? 'bg-green-500' :
        sondage.validation_status === 'draft_field' ? 'bg-yellow-500' : 'bg-gray-300'
      }`} />
      <div>
        <div className="text-sm font-medium text-gray-900">{sondage.code_sondage || 'Sans code'}</div>
        <div className="text-xs text-gray-500">
          {sondage.profondeur_atteinte ? `${sondage.profondeur_atteinte}m` : 'Prof. non renseignée'}
        </div>
      </div>
    </div>
    <ChevronRight className="h-4 w-4 text-gray-400" />
  </div>
);

// ============================================================================
// Composant Q&A pour la mission
// ============================================================================

interface MissionQuestion {
  id: string;
  title: string;
  content: string;
  author_name: string;
  answers_count: number;
  created_at: string;
}

const MissionQASection: React.FC<{ missionId: string }> = ({ missionId }) => {
  const [questions, setQuestions] = useState<MissionQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, [missionId]);

  const loadQuestions = async () => {
    try {
      const token = localStorage.getItem('atlas_token');
      const res = await fetch(`/api/colab/qa/questions?mission_id=${missionId}&limit=3`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Erreur chargement questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newQuestion.trim()) return;
    setSubmitting(true);
    
    try {
      const token = localStorage.getItem('atlas_token');
      const res = await fetch('/api/colab/qa/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title: newQuestion.trim().slice(0, 100),
          content: newQuestion.trim(),
          mission_id: missionId,
          tags: []
        })
      });
      
      if (res.ok) {
        setNewQuestion('');
        setShowForm(false);
        loadQuestions();
      }
    } catch (err) {
      console.error('Erreur soumission question:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2">
          <MessageCircleQuestion className="h-4 w-4" />
          Questions / Réponses
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs text-blue-600 font-medium"
        >
          {showForm ? 'Annuler' : '+ Poser une question'}
        </button>
      </div>

      {/* Formulaire rapide */}
      {showForm && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Votre question sur cette mission..."
            rows={3}
            className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !newQuestion.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Envoyer
            </button>
          </div>
        </div>
      )}

      {/* Liste des questions */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : questions.length > 0 ? (
        <div className="space-y-3">
          {questions.map(q => (
            <div key={q.id} className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900 line-clamp-2">{q.title}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <span>{q.author_name}</span>
                <span>•</span>
                <span>{q.answers_count} réponse{q.answers_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
          {questions.length >= 3 && (
            <button className="w-full text-center text-sm text-blue-600 py-2">
              Voir toutes les questions →
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400">
          <MessageCircleQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune question pour cette mission</p>
          <p className="text-xs mt-1">Soyez le premier à poser une question !</p>
        </div>
      )}
    </section>
  );
};

// ============================================================================
// Page principale
// ============================================================================

const ColabMobileMissionDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<MobileMissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadMissionDetail(id);
    }
  }, [id]);

  const loadMissionDetail = async (missionId: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await mobileApi.getMissionDetail(missionId);
      setDetail(data);
    } catch (err: any) {
      console.error('Erreur chargement détail:', err);
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Erreur" onBack={() => navigate(-1)} />
        <div className="p-4">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg">
            {error || 'Mission non trouvée'}
          </div>
        </div>
      </div>
    );
  }

  const { mission, supervisor_name, supervisor_email, team_members, recent_sondages, bbox } = detail;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <MobileHeader title={mission.code} onBack={() => navigate(-1)} />

      <main className="p-4 space-y-4">
        {/* En-tête mission */}
        <section className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{mission.title}</h2>
              <div className="flex items-center gap-2">
                <StatusBadge status={mission.status} />
                <ThemeBadge theme={mission.theme} />
              </div>
            </div>
            <ProgressRing percent={mission.percent_done} />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {mission.commune && (
              <InfoCard
                icon={<MapPin className="h-5 w-5" />}
                label="Localité"
                value={`${mission.commune}${mission.region ? `, ${mission.region}` : ''}`}
              />
            )}
            {mission.start_date && (
              <InfoCard
                icon={<Calendar className="h-5 w-5" />}
                label="Période"
                value={
                  <>
                    {new Date(mission.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    {mission.end_date && (
                      <> → {new Date(mission.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</>
                    )}
                  </>
                }
              />
            )}
            <InfoCard
              icon={<Target className="h-5 w-5" />}
              label="Objectif"
              value={`${mission.expected_sondages} sondages`}
            />
            <InfoCard
              icon={<FileText className="h-5 w-5" />}
              label="Réalisés"
              value={`${mission.completed_sondages} sondages`}
            />
          </div>
        </section>

        {/* Mini-carte */}
        {bbox && (
          <section className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div 
              className="h-40 bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center cursor-pointer"
              onClick={() => navigate(`/missions/${id}/map`)}
            >
              <div className="text-center">
                <Map className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                <span className="text-sm text-gray-600">Appuyer pour ouvrir la carte</span>
              </div>
            </div>
          </section>
        )}

        {/* Encadrant */}
        {supervisor_name && (
          <section className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Encadrant</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">{supervisor_name}</div>
                {supervisor_email && (
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {supervisor_email}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Équipe */}
        {team_members.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-3">
              Équipe ({team_members.length})
            </h3>
            <div className="space-y-2">
              {team_members.map(member => (
                <div key={member.user_id} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{member.username}</div>
                    <div className="text-xs text-gray-500">{member.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Sondages récents */}
        <section className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500">Sondages récents</h3>
            <span className="text-xs text-gray-400">{recent_sondages.length} affichés</span>
          </div>
          {recent_sondages.length > 0 ? (
            <div>
              {recent_sondages.map(sondage => (
                <SondageItem key={sondage.id} sondage={sondage} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <FileText className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Aucun sondage enregistré</p>
            </div>
          )}
        </section>

        {/* Questions & Réponses */}
        <MissionQASection missionId={id!} />
      </main>

      {/* Boutons d'action fixes */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-area-inset-bottom">
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/missions/${id}/map`)}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-medium"
          >
            <Map className="h-5 w-5" />
            Carte terrain
          </button>
          <button
            onClick={() => navigate(`/missions/${id}/sondages/new`)}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-xl font-medium"
          >
            <Plus className="h-5 w-5" />
            Nouveau sondage
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColabMobileMissionDetailPage;
