/**
 * Composant Commentaires de Mission
 * 
 * Affiche et gère les commentaires d'une mission avec mentions @user
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Loader2,
  User,
  Clock,
  MoreVertical,
  Trash2,
  Edit2,
  Reply,
  AtSign,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Comment {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  author_role: string;
  parent_id: string | null;
  mentions: string[];
  created_at: string;
  updated_at: string;
  replies?: Comment[];
}

interface MissionCommentsProps {
  missionId: string;
  currentUserId?: string;
  className?: string;
}

// ============================================================================
// API
// ============================================================================

const API_BASE_URL = '/api';

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
    throw new Error(error.error || 'Erreur API');
  }
  
  return response.json();
}

// ============================================================================
// Composants
// ============================================================================

const CommentItem: React.FC<{
  comment: Comment;
  currentUserId?: string;
  onReply: (parentId: string) => void;
  onDelete: (id: string) => void;
  depth?: number;
}> = ({ comment, currentUserId, onReply, onDelete, depth = 0 }) => {
  const [showMenu, setShowMenu] = useState(false);
  const isOwner = currentUserId === comment.author_id;

  // Formater le contenu avec les mentions
  const formatContent = (content: string) => {
    return content.replace(/@(\w+)/g, '<span class="text-blue-600 font-medium">@$1</span>');
  };

  return (
    <div className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-100 pl-4' : ''}`}>
      <div className="bg-white rounded-lg border p-4 mb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium text-sm">
                {comment.author_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{comment.author_name}</span>
                <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                  {comment.author_role}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                {new Date(comment.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          {/* Menu actions */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border z-10">
                <button
                  onClick={() => {
                    onReply(comment.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Reply className="h-4 w-4" />
                  Répondre
                </button>
                {isOwner && (
                  <button
                    onClick={() => {
                      onDelete(comment.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Contenu */}
        <div
          className="mt-3 text-sm text-gray-700 whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: formatContent(comment.content) }}
        />

        {/* Bouton répondre */}
        <button
          onClick={() => onReply(comment.id)}
          className="mt-3 text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          <Reply className="h-3 w-3" />
          Répondre
        </button>
      </div>

      {/* Réponses */}
      {comment.replies && comment.replies.length > 0 && (
        <div>
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CommentForm: React.FC<{
  onSubmit: (content: string, parentId?: string) => Promise<void>;
  parentId?: string;
  onCancel?: () => void;
  placeholder?: string;
}> = ({ onSubmit, parentId, onCancel, placeholder = 'Ajouter un commentaire...' }) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit(content.trim(), parentId);
      setContent('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-3">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <div className="flex items-center justify-between mt-2">
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <AtSign className="h-3 w-3" />
          Utilisez @nom pour mentionner quelqu'un
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded"
            >
              Annuler
            </button>
          )}
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50"
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
    </form>
  );
};

// ============================================================================
// Composant principal
// ============================================================================

export const MissionComments: React.FC<MissionCommentsProps> = ({
  missionId,
  currentUserId,
  className = '',
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  useEffect(() => {
    loadComments();
  }, [missionId]);

  const loadComments = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchWithAuth(`/colab/comments?mission_id=${missionId}`);
      setComments(data.comments || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (content: string, parentId?: string) => {
    // Extraire les mentions du contenu
    const mentions = content.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];

    await fetchWithAuth('/colab/comments', {
      method: 'POST',
      body: JSON.stringify({
        mission_id: missionId,
        content,
        parent_id: parentId || null,
        mentions,
      }),
    });

    setReplyingTo(null);
    loadComments();
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Supprimer ce commentaire ?')) return;

    try {
      await fetchWithAuth(`/colab/comments/${commentId}`, {
        method: 'DELETE',
      });
      loadComments();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Organiser les commentaires en arbre
  const organizeComments = (flatComments: Comment[]): Comment[] => {
    const map = new Map<string, Comment>();
    const roots: Comment[] = [];

    flatComments.forEach(c => {
      map.set(c.id, { ...c, replies: [] });
    });

    flatComments.forEach(c => {
      const comment = map.get(c.id)!;
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.replies!.push(comment);
      } else {
        roots.push(comment);
      }
    });

    return roots;
  };

  const organizedComments = organizeComments(comments);

  return (
    <div className={`bg-white rounded-xl border ${className}`}>
      <div className="p-4 border-b">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          Commentaires ({comments.length})
        </h3>
      </div>

      <div className="p-4">
        {/* Formulaire nouveau commentaire */}
        <CommentForm onSubmit={handleSubmit} />

        {/* Liste des commentaires */}
        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : organizedComments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucun commentaire pour le moment</p>
              <p className="text-sm mt-1">Soyez le premier à commenter !</p>
            </div>
          ) : (
            <div className="space-y-4">
              {organizedComments.map(comment => (
                <div key={comment.id}>
                  <CommentItem
                    comment={comment}
                    currentUserId={currentUserId}
                    onReply={setReplyingTo}
                    onDelete={handleDelete}
                  />
                  {replyingTo === comment.id && (
                    <div className="ml-8 mt-2">
                      <CommentForm
                        onSubmit={handleSubmit}
                        parentId={comment.id}
                        onCancel={() => setReplyingTo(null)}
                        placeholder={`Répondre à ${comment.author_name}...`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MissionComments;
