import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { mobileApi } from '@/api/mobile';

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

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await mobileApi.registerPushToken(token, platform).catch(() => {
      // Best-effort : l'app reste utilisable sans push distante (V0.2, cf. ADR-MOBILE-005).
    });
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
