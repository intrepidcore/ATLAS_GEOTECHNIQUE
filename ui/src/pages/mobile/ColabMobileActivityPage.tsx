/**
 * Page "Activité" - PWA Mobile Atlas Colab
 * 
 * Affiche les notifications, commentaires récents et activité de l'équipe
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  MessageSquare,
  CheckCircle2,
  Award,
  MapPin,
  Clock,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read_at: string | null;
  created_at: string;
}

interface ActivityItem {
  id: string;
  type: 'comment' | 'validation' | 'badge' | 'question' | 'answer';
  actor_name: string;
  message: string;
  target?: string;
  created_at: string;
}

// ============================================================================
// Composants
// ============================================================================

const MobileHeader: React.FC<{
  title: string;
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}> = ({ title, onBack, onRefresh, refreshing }) => (
  <header className="sticky top-0 z-50 bg-blue-600 text-white px-4 py-3 shadow-lg">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1 -ml-1">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      <button onClick={onRefresh} disabled={refreshing} className="p-2">
        <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  </header>
);

const NotificationItem: React.FC<{
  notification: Notification;
  onRead: (id: string) => void;
}> = ({ notification, onRead }) => {
  const iconMap: Record<string, React.ReactNode> = {
    comment: <MessageSquare className="h-5 w-5 text-blue-500" />,
    validation: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    badge: <Award className="h-5 w-5 text-yellow-500" />,
    mention: <Users className="h-5 w-5 text-purple-500" />,
    default: <Bell className="h-5 w-5 text-gray-500" />,
  };

  return (
    <div
      onClick={() => onRead(notification.id)}
      className={`p-4 border-b border-gray-100 ${
        !notification.read_at ? 'bg-blue-50' : 'bg-white'
      }`}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {iconMap[notification.type] || iconMap.default}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{notification.title}</p>
          <p className="text-sm text-gray-600 mt-0.5">{notification.message}</p>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(notification.created_at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        {!notification.read_at && (
          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Page principale
// ============================================================================

const ColabMobileActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'notifications' | 'activity'>('notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('atlas_token');
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      // Charger les notifications
      const notifRes = await fetch('/api/colab/notifications?limit=20', { headers });
      if (notifRes.ok) {
        const data = await notifRes.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }

      // Charger l'activité récente (commentaires, validations, etc.)
      // Pour l'instant, on simule avec les notifications
      setActivities([]);
    } catch (err) {
      console.error('Erreur chargement activité:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('atlas_token');
      await fetch(`/api/colab/notifications/${id}/read`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Erreur marquage notification:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('atlas_token');
      await fetch('/api/colab/notifications/read-all', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Erreur marquage toutes notifications:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        title="Activité"
        onBack={() => navigate('/colab/mobile/missions')}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* Onglets */}
      <div className="bg-white border-b sticky top-[52px] z-40">
        <div className="flex">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'notifications'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'activity'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            Fil d'activité
          </button>
        </div>
      </div>

      {/* Contenu */}
      <main className="pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : activeTab === 'notifications' ? (
          <>
            {/* Actions */}
            {unreadCount > 0 && (
              <div className="p-3 bg-gray-50 border-b">
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 font-medium"
                >
                  Tout marquer comme lu
                </button>
              </div>
            )}

            {/* Liste des notifications */}
            {notifications.length > 0 ? (
              <div>
                {notifications.map(notif => (
                  <NotificationItem
                    key={notif.id}
                    notification={notif}
                    onRead={markAsRead}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Aucune notification</p>
              </div>
            )}
          </>
        ) : (
          /* Fil d'activité */
          <div className="text-center py-12 text-gray-400">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Fil d'activité à venir</p>
            <p className="text-xs mt-1">Commentaires, validations, badges...</p>
          </div>
        )}
      </main>

      {/* Barre de navigation mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-inset-bottom">
        <div className="flex items-center justify-around">
          <button
            onClick={() => navigate('/colab/mobile/missions')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <MapPin className="h-6 w-6" />
            <span className="text-xs">Missions</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-blue-600 relative">
            <Bell className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            <span className="text-xs">Activité</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default ColabMobileActivityPage;
