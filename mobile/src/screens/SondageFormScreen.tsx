import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert, Image, Pressable } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Camera, X } from 'lucide-react-native';
import { colors, radius } from '@/theme/tokens';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { locationService, type GPSPosition } from '@/services/locationService';
import { syncService } from '@/services/syncService';
import { haversineDistanceM } from '@/services/toleranceService';
import type { RootStackParamList } from '@/navigation/routes';
import { atlaspackRepository, newUuid } from '@/services/atlaspack/repository';
import { atlaspackSession } from '@/services/atlaspack/session';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'SondageForm'>;

export const SondageFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const [position, setPosition] = useState<GPSPosition | null>(
    params.lat !== undefined && params.lon !== undefined
      ? { latitude: params.lat, longitude: params.lon, accuracy: 0, altitude: null, timestamp: Date.now() }
      : null
  );
  const [depthM, setDepthM] = useState('');
  const [profileDescription, setProfileDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [pointName, setPointName] = useState('');
  const [relocationReason, setRelocationReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<Array<{ uri: string; fileName: string }>>([]);

  const addPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission caméra requise', 'Autorisez l’accès à la caméra pour joindre une photo au sondage.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotos((current) => [...current, { uri: asset.uri, fileName: asset.fileName ?? `photo-${Date.now()}.jpg` }]);
  };

  useEffect(() => {
    if (position) return;
    void locationService.getCurrentPosition().then(setPosition).catch(() => undefined);
  }, [position]);

  const onSave = async () => {
    if (!position) {
      Alert.alert('Position GPS requise');
      return;
    }
    if (params.mode === 'relocate' && (!pointName.trim() || !relocationReason.trim())) {
      Alert.alert('Champs obligatoires', 'Renseignez le nom du nouveau point et la cause du changement.');
      return;
    }
    setSaving(true);
    try {
      let capturedPosition: GPSPosition;
      try {
        capturedPosition = await locationService.getCurrentPosition();
        setPosition(capturedPosition);
      } catch {
        Alert.alert('Position GPS indisponible', 'Impossible d’obtenir une position récente. Réessayez à ciel ouvert.');
        return;
      }
      const capturedDistanceM = haversineDistanceM(
        capturedPosition.latitude, capturedPosition.longitude,
        params.plannedLat, params.plannedLon
      );
      if (params.mode === 'confirm' && capturedDistanceM > 10) {
        Alert.alert('Enregistrement bloqué', `La position récente est à ${Math.round(capturedDistanceM)} m. Approchez-vous à 10 m maximum.`);
        return;
      }
      if (params.mode === 'relocate' && capturedDistanceM <= 10) {
        Alert.alert('Utilisez la confirmation normale', 'La position récente est maintenant dans le rayon autorisé de 10 m.');
        return;
      }
      const sondageId = await syncService.createSondageOffline(
        params.missionId,
        {
          longitude: capturedPosition.longitude,
          latitude: capturedPosition.latitude,
          location_accuracy_m: capturedPosition.accuracy,
          depth_m: depthM ? parseFloat(depthM) : undefined,
          profile_description: profileDescription || undefined,
          notes: notes || undefined,
          // En confirmation, le point prévu porte déjà un nom lisible (« S2 - Centre ») :
          // sans lui, le sondage remonte au bureau sans aucune étiquette humaine.
          point_name: params.mode === 'relocate' ? pointName.trim() : params.plannedPointLabel,
          relocation_reason: params.mode === 'relocate' ? relocationReason.trim() : undefined,
        },
        params.plannedPointId,
        params.mode
      );

      const operatorUserId = atlaspackSession.get()?.operatorUserId ?? null;
      for (const photo of photos) {
        const attachmentId = newUuid();
        await atlaspackRepository.saveAttachmentDraft({
          id: attachmentId,
          missionId: params.missionId,
          sondageId,
          kind: 'photo',
          fileUri: photo.uri,
          fileName: photo.fileName,
          contentType: 'image/jpeg',
          caption: null,
          takenAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
        await atlaspackRepository.recordAuditEvent({
          eventType: 'attachment_added',
          operatorUserId,
          missionId: params.missionId,
          objectType: 'sondage',
          objectId: sondageId,
          oldValues: null,
          newValues: { attachment_id: attachmentId, file_name: photo.fileName },
          metadata: null,
        });
      }

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
        <Text style={{ fontWeight: '700', color: params.mode === 'relocate' ? '#b45309' : colors.green500 }}>
          {params.mode === 'relocate' ? 'Point alternatif justifié' : 'Confirmation dans le rayon de 10 m'}
        </Text>
        <Text style={{ fontSize: 12, color: colors.gray500 }}>{params.plannedPointLabel} · {Math.round(params.distanceM)} m du point prévu</Text>
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
        {params.mode === 'relocate' ? <>
          <TextField label="Nom du nouveau point *" value={pointName} onChangeText={setPointName} placeholder="Ex : Point alternatif nord" />
          <TextField label="Cause du changement *" value={relocationReason} onChangeText={setRelocationReason} multiline numberOfLines={3} placeholder="Accès impossible, obstacle, sécurité…" />
        </> : null}
        <TextField label="Profondeur atteinte (m)" keyboardType="decimal-pad" value={depthM} onChangeText={setDepthM} placeholder="Ex: 3.5" />
        <TextField
          label="Description du profil"
          value={profileDescription}
          onChangeText={setProfileDescription}
          multiline
          numberOfLines={4}
          placeholder="Type de sol, couleur, texture par couche"
        />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />

        <View>
          <Text style={{ fontWeight: '600', color: colors.gray900, marginBottom: 8 }}>Photos</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {photos.map((photo, index) => (
              <View key={photo.uri} style={{ width: 72, height: 72, borderRadius: radius.lg, overflow: 'hidden' }}>
                <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} />
                <Pressable
                  onPress={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                  style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.full, padding: 3 }}
                >
                  <X size={12} color={colors.white} />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() => void addPhoto()}
              style={{ width: 72, height: 72, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.gray300, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}
            >
              <Camera size={22} color={colors.gray500} />
            </Pressable>
          </View>
        </View>
      </View>

      <PrimaryButton label={params.mode === 'relocate' ? 'Enregistrer le point alternatif' : 'Confirmer le sondage'} onPress={onSave} loading={saving} disabled={!position} />
    </ScrollView>
  );
};
