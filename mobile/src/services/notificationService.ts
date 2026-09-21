import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { mobileApi } from '@/api/mobile';
import { repository } from '@/db/repository';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const notificationService = {
  async registerForPush(): Promise<void> {
    if (!Device.isDevice) return; // simulateur/web : pas de push réelle
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId || String(projectId).startsWith('REPLACE_')) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await mobileApi.registerPushToken(token, platform).catch(() => {
      // Best-effort : l'app reste utilisable sans push distante (V0.2, cf. ADR-MOBILE-005).
    });
  },

  async pollServerAlerts(): Promise<number> {
    const response = await mobileApi.getNotifications();
    const lastSeen = await repository.getSetting('last_server_notification_at');
    const unread = response.notifications
      .filter((n) => !n.is_read && (!lastSeen || n.created_at > lastSeen))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const item of unread.slice(-10)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: item.title || 'Atlas Terrain', body: item.message ?? 'Nouvelle notification', data: { notificationId: item.id, missionId: item.mission_id } },
        trigger: null,
      });
    }
    const newest = response.notifications.reduce<string | null>((value, n) => !value || n.created_at > value ? n.created_at : value, lastSeen);
    if (newest) await repository.setSetting('last_server_notification_at', newest);
    return response.unread_count;
  },

  // Rappel local (pas de dépendance serveur) avant/pendant une mission.
  async scheduleReminder(missionTitle: string, fireDate: Date): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rappel de mission',
        body: `Mission "${missionTitle}" à préparer.`,
      },
      trigger: fireDate,
    });
  },

  async cancelReminder(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
};
