import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius } from '@/theme/tokens';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { locationService, type GPSPosition } from '@/services/locationService';
import { syncService } from '@/services/syncService';
import type { RootStackParamList } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'SondageForm'>;

export const SondageFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const [position, setPosition] = useState<GPSPosition | null>(
    params.lat && params.lon
      ? { latitude: params.lat, longitude: params.lon, accuracy: 0, altitude: null, timestamp: Date.now() }
      : null
  );
  const [depthM, setDepthM] = useState('');
  const [layersCount, setLayersCount] = useState('');
  const [profileDescription, setProfileDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (position) return;
    void locationService.getCurrentPosition().then(setPosition).catch(() => undefined);
  }, [position]);

  const onSave = async () => {
    if (!position) {
      Alert.alert('Position GPS requise');
      return;
    }
    setSaving(true);
    try {
      await syncService.createSondageOffline(
        params.missionId,
        {
          longitude: position.longitude,
          latitude: position.latitude,
          location_accuracy_m: position.accuracy,
          depth_m: depthM ? parseFloat(depthM) : undefined,
          layers_count: layersCount ? parseInt(layersCount, 10) : undefined,
          profile_description: profileDescription || undefined,
          notes: notes || undefined,
        },
        params.plannedPointId ?? null
      );
      Alert.alert('Enregistré', 'Le sondage a été sauvegardé et sera synchronisé automatiquement.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.gray50 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 16, gap: 4 }}>
        <Text style={{ fontWeight: '600', color: colors.gray900 }}>Position GPS</Text>
        {position ? (
          <>
            <Text style={{ fontSize: 13, color: colors.gray500 }}>
              {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
            </Text>
            <Text style={{ fontSize: 12, color: colors.gray400 }}>±{Math.round(position.accuracy)} m</Text>
          </>
        ) : (
          <Text style={{ fontSize: 13, color: colors.gray400 }}>En attente…</Text>
        )}
      </View>

      <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 16, gap: 12 }}>
        <TextField label="Profondeur atteinte (m)" keyboardType="decimal-pad" value={depthM} onChangeText={setDepthM} placeholder="Ex: 3.5" />
        <TextField label="Nombre de couches" keyboardType="number-pad" value={layersCount} onChangeText={setLayersCount} placeholder="Ex: 4" />
        <TextField
          label="Description du profil"
          value={profileDescription}
          onChangeText={setProfileDescription}
          multiline
          numberOfLines={4}
          placeholder="Type de sol, couleur, texture par couche"
        />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
      </View>

      <PrimaryButton label="Enregistrer" onPress={onSave} loading={saving} disabled={!position} />
    </ScrollView>
  );
};
