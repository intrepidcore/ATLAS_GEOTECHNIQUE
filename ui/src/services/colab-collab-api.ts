/**
 * API Service pour Atlas Colab - Collaboration
 * 
 * Commentaires, Notifications, Q&A et Gamification
 */

import { API_BASE_URL } from './api';

// ============================================================================
// Types - Commentaires
// ============================================================================

export interface Comment {
  id: string;
  entity_type: 'mission' | 'sondage' | 'essai' | 'document';
  entity_id: string;
  content: string;
  parent_comment_id: string | null;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  author_id: string;
  author_username: string;
  author_email: string;
  replies_count: number;
}

export interface CreateCommentRequest {
  entity_type: string;
  entity_id: string;
  content: string;
  parent_comment_id?: string;
}

// ============================================================================
// Types - Notifications
// ============================================================================

export interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string | null;
  payload: Record<string, unknown>;
  mission_id: string | null;
  sondage_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
  total: number;
}

// ============================================================================
// Types - Q&A
// ============================================================================

export interface Question {
  id: string;
  title: string;
  body: string;
  author_id: string;
  author_username: string;
  mission_id: string | null;
  mission_title: string | null;
  is_closed: boolean;
  is_pinned: boolean;
  score: number;
  views_count: number;
  answers_count: number;
  created_at: string;
  updated_at: string;
  has_best_answer: boolean;
}

export interface QuestionListItem {
  id: string;
  title: string;
  author_username: string;
  is_closed: boolean;
  is_pinned: boolean;
  score: number;
  views_count: number;
  answers_count: number;
  created_at: string;
  has_best_answer: boolean;
}

export interface Answer {
  id: string;
  question_id: string;
  body: string;
  author_id: string;
  author_username: string;
  is_best: boolean;
  is_accepted: boolean;
  score: number;
  created_at: string;
  updated_at: string;
  author_reputation: number | null;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  usage_count: number;
}

export interface CreateQuestionRequest {
  title: string;
  body: string;
  tags?: string[];
  mission_id?: string;
  sondage_id?: string;
  maille_id?: string;
}

export interface CreateAnswerRequest {
  body: string;
}

export interface QuestionDetail {
  question: Question;
  tags: Tag[];
  answers: Answer[];
  user_vote: number | null;
}

// ============================================================================
// Types - Gamification
// ============================================================================

export interface UserStats {
  user_id: string;
  username: string;
  questions_count: number;
  answers_count: number;
  best_answers_count: number;
  reputation_points: number;
  badges_count: number;
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
  points: number;
}

// ============================================================================
// Helpers
// ============================================================================

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('atlas_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error || error.message || `Erreur ${response.status}`);
  }
  return response.json();
}

// ============================================================================
// API Commentaires
// ============================================================================

export const commentsApi = {
  /**
   * Lister les commentaires d'une entité
   */
  async list(entityType: string, entityId: string): Promise<{ comments: Comment[]; count: number }> {
    const params = new URLSearchParams({ entity_type: entityType, entity_id: entityId });
    const response = await fetch(`${API_BASE_URL}/colab/comments?${params}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Récupérer les réponses à un commentaire
   */
  async getReplies(commentId: string): Promise<{ replies: Comment[]; count: number }> {
    const response = await fetch(`${API_BASE_URL}/colab/comments/${commentId}/replies`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Créer un commentaire
   */
  async create(data: CreateCommentRequest): Promise<{ id: string; mentions_count: number; message: string }> {
    const response = await fetch(`${API_BASE_URL}/colab/comments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  /**
   * Supprimer un commentaire
   */
  async delete(commentId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/colab/comments/${commentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// API Notifications
// ============================================================================

export const notificationsApi = {
  /**
   * Lister mes notifications
   */
  async list(limit = 50, offset = 0): Promise<NotificationsResponse> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const response = await fetch(`${API_BASE_URL}/colab/notifications?${params}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Marquer une notification comme lue
   */
  async markRead(notificationId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/colab/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Marquer toutes les notifications comme lues
   */
  async markAllRead(): Promise<{ marked_count: number; message: string }> {
    const response = await fetch(`${API_BASE_URL}/colab/notifications/read-all`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// API Questions
// ============================================================================

export const questionsApi = {
  /**
   * Lister les questions
   */
  async list(params?: {
    tag?: string;
    mission_id?: string;
    search?: string;
    sort?: 'score' | 'date' | 'views';
    limit?: number;
    offset?: number;
  }): Promise<{ questions: QuestionListItem[]; total: number; page: number; per_page: number }> {
    const searchParams = new URLSearchParams();
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.mission_id) searchParams.set('mission_id', params.mission_id);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));

    const response = await fetch(`${API_BASE_URL}/colab/questions?${searchParams}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Récupérer une question avec ses réponses
   */
  async get(questionId: string): Promise<QuestionDetail> {
    const response = await fetch(`${API_BASE_URL}/colab/questions/${questionId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Créer une question
   */
  async create(data: CreateQuestionRequest): Promise<{ id: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/colab/questions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  /**
   * Voter sur une question
   */
  async vote(questionId: string, vote: 1 | -1): Promise<{ new_score: number; message: string }> {
    const response = await fetch(`${API_BASE_URL}/colab/questions/${questionId}/vote`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ vote }),
    });
    return handleResponse(response);
  },

  /**
   * Fermer une question
   */
  async close(questionId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/colab/questions/${questionId}/close`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// API Réponses
// ============================================================================

export const answersApi = {
  /**
   * Créer une réponse
   */
  async create(questionId: string, data: CreateAnswerRequest): Promise<{ id: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/colab/questions/${questionId}/answers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  /**
   * Voter sur une réponse
   */
  async vote(answerId: string, vote: 1 | -1): Promise<{ new_score: number; message: string }> {
    const response = await fetch(`${API_BASE_URL}/colab/answers/${answerId}/vote`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ vote }),
    });
    return handleResponse(response);
  },

  /**
   * Marquer comme meilleure réponse
   */
  async markBest(answerId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/colab/answers/${answerId}/mark-best`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// API Tags
// ============================================================================

export const tagsApi = {
  /**
   * Lister tous les tags
   */
  async list(): Promise<{ tags: Tag[] }> {
    const response = await fetch(`${API_BASE_URL}/colab/tags`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// API Leaderboard & Stats
// ============================================================================

export const leaderboardApi = {
  /**
   * Récupérer le classement
   */
  async get(limit = 20): Promise<{ leaderboard: UserStats[] }> {
    const response = await fetch(`${API_BASE_URL}/colab/leaderboard?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Récupérer les stats d'un utilisateur
   */
  async getUserStats(userId: string): Promise<{ stats: UserStats | null; badges: Badge[] }> {
    const response = await fetch(`${API_BASE_URL}/colab/users/${userId}/stats`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// Helpers UI
// ============================================================================

export const notificationTypeLabels: Record<string, string> = {
  comment_mention: 'Mention',
  comment_reply: 'Réponse',
  comment_entity: 'Nouveau commentaire',
  status_change: 'Changement de statut',
  mission_assigned: 'Mission assignée',
  sondage_validated: 'Sondage validé',
  document_uploaded: 'Document ajouté',
  deadline_reminder: 'Rappel échéance',
};

export const badgeCategoryColors: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-800',
  silver: 'bg-gray-100 text-gray-800',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
};

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ============================================================================
// Export par défaut
// ============================================================================

export default {
  comments: commentsApi,
  notifications: notificationsApi,
  questions: questionsApi,
  answers: answersApi,
  tags: tagsApi,
  leaderboard: leaderboardApi,
};
