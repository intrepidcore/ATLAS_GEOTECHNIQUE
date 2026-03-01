/**
 * Page Q&A - Questions/Réponses Atlas Colab
 * 
 * Interface Stack Overflow-like pour le partage de connaissances géotechniques
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  MessageCircleQuestion,
  Search,
  Filter,
  Plus,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Clock,
  User,
  Tag,
  MessageSquare,
  Award,
  TrendingUp,
  Loader2,
  X,
  Send,
  Link2,
  AlertCircle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Question {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_role: string;
  status: 'open' | 'answered' | 'closed';
  votes: number;
  answers_count: number;
  has_accepted_answer: boolean;
  tags: string[];
  mission_id?: string;
  mission_code?: string;
  sondage_id?: string;
  sondage_code?: string;
  created_at: string;
  updated_at: string;
}

interface Answer {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  author_role: string;
  votes: number;
  is_accepted: boolean;
  created_at: string;
}

interface QATag {
  id: string;
  name: string;
  description?: string;
  usage_count: number;
}

interface LeaderboardEntry {
  user_id: string;
  username: string;
  reputation: number;
  answers_count: number;
  accepted_answers: number;
  badges: string[];
}

// ============================================================================
// API Service
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_GEO || '/api';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('atlas_token');
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error || error.message || 'Erreur API');
  }
  
  return response.json();
}

// ============================================================================
// Composants
// ============================================================================

const ColabQAPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tags, setTags] = useState<QATag[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showMyQuestions, setShowMyQuestions] = useState(false);
  
  // Modales
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [questionsRes, tagsRes, leaderboardRes] = await Promise.all([
        fetchWithAuth('/colab/questions'),
        fetchWithAuth('/colab/tags'),
        fetchWithAuth('/colab/leaderboard?limit=5'),
      ]);
      
      setQuestions(questionsRes.questions || []);
      setTags(tagsRes.tags || []);
      setLeaderboard(leaderboardRes.leaderboard || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les questions
  const filteredQuestions = questions.filter(q => {
    if (searchQuery && !q.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !q.content.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedTags.length > 0 && !selectedTags.some(t => q.tags.includes(t))) {
      return false;
    }
    if (statusFilter !== 'all' && q.status !== statusFilter) {
      return false;
    }
    if (showMyQuestions && q.author_id !== user?.id) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircleQuestion className="h-7 w-7 text-blue-600" />
            Questions & Réponses
          </h2>
          <p className="text-gray-500 mt-1">
            Partagez vos connaissances géotechniques avec la communauté
          </p>
        </div>
        <button
          onClick={() => setShowNewQuestion(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Poser une question
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Liste des questions */}
        <div className="lg:col-span-3 space-y-4">
          {/* Barre de recherche et filtres */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher une question..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="open">Ouvertes</option>
                <option value="answered">Répondues</option>
                <option value="closed">Fermées</option>
              </select>
            </div>
            
            {/* Tags populaires */}
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 8).map(tag => (
                <button
                  key={tag.id}
                  onClick={() => {
                    setSelectedTags(prev => 
                      prev.includes(tag.name) 
                        ? prev.filter(t => t !== tag.name)
                        : [...prev, tag.name]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 transition-colors ${
                    selectedTags.includes(tag.name)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Tag className="h-3 w-3" />
                  {tag.name}
                  <span className="text-xs opacity-70">({tag.usage_count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Liste */}
          <div className="space-y-3">
            {filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
                <MessageCircleQuestion className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune question trouvée</p>
                <button
                  onClick={() => setShowNewQuestion(true)}
                  className="mt-4 text-blue-600 hover:underline"
                >
                  Poser la première question
                </button>
              </div>
            ) : (
              filteredQuestions.map(question => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  onClick={() => setSelectedQuestion(question)}
                />
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Stats utilisateur */}
          {user && (
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-500" />
                Mon profil Q&A
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Questions posées</span>
                  <span className="font-medium">{questions.filter(q => q.author_id === user.id).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Réputation</span>
                  <span className="font-medium text-blue-600">--</span>
                </div>
              </div>
              <button
                onClick={() => setShowMyQuestions(!showMyQuestions)}
                className={`mt-3 w-full py-2 rounded-lg text-sm transition-colors ${
                  showMyQuestions
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {showMyQuestions ? 'Voir toutes' : 'Mes questions'}
              </button>
            </div>
          )}

          {/* Leaderboard */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Top contributeurs
            </h3>
            <div className="space-y-3">
              {leaderboard.map((entry, index) => (
                <div key={entry.user_id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-100 text-gray-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-50 text-gray-500'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{entry.username}</div>
                    <div className="text-xs text-gray-500">
                      {entry.reputation} pts • {entry.accepted_answers} ✓
                    </div>
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  Pas encore de contributeurs
                </p>
              )}
            </div>
          </div>

          {/* Comment gagner des badges */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100 p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Award className="h-5 w-5" />
              Gagner des badges
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>🎯 Première question posée</li>
              <li>✅ Première réponse acceptée</li>
              <li>⭐ 10 votes positifs reçus</li>
              <li>🏆 Expert reconnu (50 réponses)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal nouvelle question */}
      {showNewQuestion && (
        <NewQuestionModal
          tags={tags}
          onClose={() => setShowNewQuestion(false)}
          onSubmit={async (data) => {
            await fetchWithAuth('/colab/questions', {
              method: 'POST',
              body: JSON.stringify(data),
            });
            setShowNewQuestion(false);
            loadData();
          }}
        />
      )}

      {/* Modal détail question */}
      {selectedQuestion && (
        <QuestionDetailModal
          question={selectedQuestion}
          onClose={() => setSelectedQuestion(null)}
          onUpdate={loadData}
        />
      )}
    </div>
  );
};

// ============================================================================
// Sous-composants
// ============================================================================

const QuestionCard: React.FC<{ question: Question; onClick: () => void }> = ({ question, onClick }) => {
  const statusColors = {
    open: 'bg-green-100 text-green-700',
    answered: 'bg-blue-100 text-blue-700',
    closed: 'bg-gray-100 text-gray-500',
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex gap-4">
        {/* Stats */}
        <div className="flex flex-col items-center gap-1 text-sm min-w-[60px]">
          <div className={`px-2 py-1 rounded ${question.votes > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {question.votes} votes
          </div>
          <div className={`px-2 py-1 rounded ${question.has_accepted_answer ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {question.answers_count} rép.
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-2">
            {question.title}
          </h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {question.content}
          </p>
          
          {/* Tags et meta */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {question.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                {tag}
              </span>
            ))}
            <span className={`px-2 py-0.5 rounded text-xs ${statusColors[question.status]}`}>
              {question.status === 'open' ? 'Ouverte' : question.status === 'answered' ? 'Répondue' : 'Fermée'}
            </span>
            
            {question.mission_code && (
              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                {question.mission_code}
              </span>
            )}
          </div>
          
          {/* Auteur */}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <User className="h-3 w-3" />
            <span>{question.author_name}</span>
            <span>•</span>
            <Clock className="h-3 w-3" />
            <span>{new Date(question.created_at).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const NewQuestionModal: React.FC<{
  tags: QATag[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}> = ({ tags, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [missionId, setMissionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        tags: selectedTags,
        mission_id: missionId || null,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Poser une question</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titre de la question *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Comment interpréter un essai Proctor modifié ?"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Soyez précis et concis dans votre titre
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description détaillée *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Décrivez votre question en détail. Incluez le contexte, ce que vous avez déjà essayé, et ce que vous cherchez à comprendre..."
              rows={6}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (thématiques)
            </label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    setSelectedTags(prev =>
                      prev.includes(tag.name)
                        ? prev.filter(t => t !== tag.name)
                        : [...prev, tag.name]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedTags.includes(tag.name)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !content.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const QuestionDetailModal: React.FC<{
  question: Question;
  onClose: () => void;
  onUpdate: () => void;
}> = ({ question, onClose, onUpdate }) => {
  const { user, hasPermission } = useAuth();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAnswer, setNewAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAnswers();
  }, [question.id]);

  const loadAnswers = async () => {
    try {
      const res = await fetchWithAuth(`/colab/questions/${question.id}/answers`);
      setAnswers(res.answers || []);
    } catch (err) {
      console.error('Erreur chargement réponses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (answerId: string, value: number) => {
    try {
      await fetchWithAuth(`/colab/answers/${answerId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ value }),
      });
      loadAnswers();
    } catch (err) {
      console.error('Erreur vote:', err);
    }
  };

  const handleAcceptAnswer = async (answerId: string) => {
    try {
      await fetchWithAuth(`/colab/answers/${answerId}/accept`, {
        method: 'POST',
      });
      loadAnswers();
      onUpdate();
    } catch (err) {
      console.error('Erreur acceptation:', err);
    }
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnswer.trim()) return;
    
    setSubmitting(true);
    try {
      await fetchWithAuth(`/colab/questions/${question.id}/answers`, {
        method: 'POST',
        body: JSON.stringify({ content: newAnswer.trim() }),
      });
      setNewAnswer('');
      loadAnswers();
      onUpdate();
    } catch (err) {
      console.error('Erreur soumission:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const canAcceptAnswer = question.author_id === user?.id || hasPermission('colab.answers.mark_best');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{question.title}</h2>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                <User className="h-4 w-4" />
                <span>{question.author_name}</span>
                <span>•</span>
                <Clock className="h-4 w-4" />
                <span>{new Date(question.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Question content */}
        <div className="p-6 border-b">
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap">{question.content}</p>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {question.tags.map(tag => (
              <span key={tag} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Answers */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            {answers.length} réponse{answers.length !== 1 ? 's' : ''}
          </h3>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Réponse acceptée en premier */}
              {answers.filter(a => a.is_accepted).map(answer => (
                <AnswerCard
                  key={answer.id}
                  answer={answer}
                  onVote={handleVote}
                  onAccept={handleAcceptAnswer}
                  canAccept={canAcceptAnswer}
                />
              ))}
              
              {/* Autres réponses */}
              {answers.filter(a => !a.is_accepted).map(answer => (
                <AnswerCard
                  key={answer.id}
                  answer={answer}
                  onVote={handleVote}
                  onAccept={handleAcceptAnswer}
                  canAccept={canAcceptAnswer}
                />
              ))}
            </div>
          )}

          {/* Formulaire nouvelle réponse */}
          {question.status !== 'closed' && (
            <form onSubmit={handleSubmitAnswer} className="mt-6 pt-6 border-t">
              <h4 className="font-medium text-gray-900 mb-2">Votre réponse</h4>
              <textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Partagez votre expertise..."
                rows={4}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={submitting || !newAnswer.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Répondre
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const AnswerCard: React.FC<{
  answer: Answer;
  onVote: (id: string, value: number) => void;
  onAccept: (id: string) => void;
  canAccept: boolean;
}> = ({ answer, onVote, onAccept, canAccept }) => {
  return (
    <div className={`p-4 rounded-lg border ${answer.is_accepted ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
      <div className="flex gap-4">
        {/* Votes */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => onVote(answer.id, 1)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronUp className="h-5 w-5 text-gray-400" />
          </button>
          <span className={`font-semibold ${answer.votes > 0 ? 'text-green-600' : answer.votes < 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {answer.votes}
          </span>
          <button
            onClick={() => onVote(answer.id, -1)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronDown className="h-5 w-5 text-gray-400" />
          </button>
          
          {answer.is_accepted ? (
            <CheckCircle2 className="h-6 w-6 text-green-600 mt-2" />
          ) : canAccept && (
            <button
              onClick={() => onAccept(answer.id)}
              className="p-1 hover:bg-green-100 rounded mt-2"
              title="Marquer comme meilleure réponse"
            >
              <CheckCircle2 className="h-5 w-5 text-gray-300 hover:text-green-600" />
            </button>
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1">
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap">{answer.content}</p>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
            <User className="h-3 w-3" />
            <span className="font-medium">{answer.author_name}</span>
            <span className="px-1.5 py-0.5 bg-gray-100 rounded">{answer.author_role}</span>
            <span>•</span>
            <Clock className="h-3 w-3" />
            <span>{new Date(answer.created_at).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColabQAPage;
