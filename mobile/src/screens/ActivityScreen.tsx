import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius } from '@/theme/tokens';
import { repository, type SondageDraft } from '@/db/repository';
import { StatusBadge } from '@/components/StatusBadge';
import { mobileApi, type MobileNotification } from '@/api/mobile';

export const ActivityScreen: React.FC = () => {
  const [drafts, setDrafts] = useState<SondageDraft[]>([]);
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);

  const refresh = React.useCallback(() => {
    void (async () => {
      const missions = await repository.getMissions();
      const all: SondageDraft[] = [];
      for (const m of missions) {
        all.push(...(await repository.getDraftsForMission(m.id)));
      }
      all.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setDrafts(all);
      const remote = await mobileApi.getNotifications().catch(() => null);
      if (remote) setNotifications(remote.notifications);
    })();
  }, []);

  useEffect(refresh, [refresh]);
  useFocusEffect(refresh);

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray50 }}>
      <FlatList
        data={drafts}
        keyExtractor={(d) => d.client_id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={notifications.length ? <View style={{ gap: 10, marginBottom: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.gray900 }}>Alertes et notifications</Text>
          {notifications.map((item) => <Pressable key={item.id} onPress={() => {
            if (!item.is_read) void mobileApi.markNotificationRead(item.id).then(refresh).catch(() => undefined);
          }} style={{ backgroundColor: item.is_read ? colors.white : '#eff6ff', borderRadius: radius.xl, padding: 14, borderWidth: item.is_read ? 0 : 1, borderColor: '#93c5fd' }}>
            <Text style={{ fontWeight: '700', color: colors.gray900 }}>{item.title}</Text>
            {item.message ? <Text style={{ color: colors.gray500, marginTop: 4, fontSize: 13 }}>{item.message}</Text> : null}
            <Text style={{ color: colors.gray400, marginTop: 5, fontSize: 11 }}>{new Date(item.created_at).toLocaleString('fr-FR')}{item.is_read ? '' : ' · Non lue'}</Text>
          </Pressable>)}
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.gray900, marginTop: 8 }}>Activité terrain</Text>
        </View> : null}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: colors.gray500, marginTop: 40 }}>
            Aucune activité terrain enregistrée
          </Text>
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 14, gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: colors.gray500 }}>
                {new Date(item.created_at).toLocaleString('fr-FR')}
              </Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={{ fontSize: 13, color: colors.gray900 }}>
              Sondage à {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
              {item.depth_m ? ` — ${item.depth_m} m` : ''}
            </Text>
          </View>
        )}
      />
    </View>
  );
};
