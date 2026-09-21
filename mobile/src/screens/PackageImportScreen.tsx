import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, Pressable } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { PackageCheck, FileWarning, Lock, Trash2 } from 'lucide-react-native';
import { colors, radius, spacing } from '@/theme/tokens';
import { PrimaryButton } from '@/components/PrimaryButton';
import { importAtlasPack, ImportPreview, AtlasPackImportError } from '@/services/atlaspack/importPackage';
import { atlaspackRepository, type AtlasPackMeta } from '@/services/atlaspack/repository';

interface Props {
  onImported?: (preview: ImportPreview) => void;
}

/** Étapes annoncées pendant l'import — l'opérateur voit où en est la vérification. */
const STEPS = [
  'Lecture de l’archive…',
  'Vérification de la signature du bureau…',
  'Déchiffrement et enregistrement…',
] as const;

export const PackageImportScreen: React.FC<Props> = ({ onImported }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<AtlasPackMeta | null>(null);
  const [checking, setChecking] = useState(true);
  const [unloading, setUnloading] = useState(false);

  const refreshActive = useCallback(async () => {
    setChecking(true);
    try {
      setActive(await atlaspackRepository.getActivePackageMeta());
    } catch {
      setActive(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshActive();
  }, [refreshActive]);

  const pickAndImport = async () => {
    // Un seul paquet à la fois : deux jeux de missions cohabitant sur le même
    // appareil, l'opérateur ne saurait plus à quelle campagne appartient sa
    // saisie, et l'export officiel mélangerait les deux.
    if (active) {
      Alert.alert(
        'Un paquet est déjà chargé',
        `Le paquet de ${active.operatorEmail} occupe cet appareil. Déchargez-le avant d’en importer un autre.`,
      );
      return;
    }

    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/octet-stream', 'application/zip', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setLoading(true);
    setStep(STEPS[0]);
    // Les étapes ne sont pas instrumentées dans l'importeur : on les fait
    // défiler pour que l'écran ne reste pas muet pendant la vérification, qui
    // peut durer plusieurs secondes sur un gros fond de carte.
    const timers = [
      setTimeout(() => setStep(STEPS[1]), 600),
      setTimeout(() => setStep(STEPS[2]), 1800),
    ];
    try {
      const p = await importAtlasPack(result.assets[0].uri);
      setPreview(p);
      await refreshActive();
      onImported?.(p);
      Alert.alert(
        'Paquet chargé',
        `Signature vérifiée. ${p.missionsCount} mission(s) pour ${p.operatorEmail}.\n\nRetournez à l’écran de connexion et entrez le mot de passe reçu par mail.`,
      );
    } catch (e) {
      const message = e instanceof AtlasPackImportError ? e.message : `Erreur inattendue : ${String(e)}`;
      setError(message);
      Alert.alert('Import refusé', message);
    } finally {
      timers.forEach(clearTimeout);
      setStep(null);
      setLoading(false);
    }
  };

  const confirmUnload = async () => {
    const pending = await atlaspackRepository.countPendingFieldData();
    if (pending.total > 0) {
      const detail = [
        pending.sondages > 0 ? `${pending.sondages} sondage(s)` : null,
        pending.labResults > 0 ? `${pending.labResults} fiche(s) de laboratoire` : null,
        pending.attachments > 0 ? `${pending.attachments} photo(s)` : null,
        pending.fieldLogs > 0 ? `${pending.fieldLogs} note(s) de terrain` : null,
      ]
        .filter(Boolean)
        .join(', ');
      Alert.alert(
        'Déchargement refusé',
        `Cet appareil contient ${detail} qui ne sont pas encore parties au bureau.\n\nProduisez d’abord un export .atlasreturn depuis Profil → Exporter les données. Le déchargement effacerait définitivement ce travail.`,
      );
      return;
    }

    Alert.alert(
      'Décharger le paquet ?',
      'Toutes les missions et données locales de ce paquet seront effacées de l’appareil. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Décharger',
          style: 'destructive',
          onPress: async () => {
            setUnloading(true);
            try {
              const res = await atlaspackRepository.unloadActivePackage();
              if (!res.unloaded) {
                // Une saisie a pu apparaître entre la vérification et la
                // confirmation : le dépôt revérifie, et c'est lui qui tranche.
                Alert.alert(
                  'Déchargement refusé',
                  `${res.pendingTotal} élément(s) non exporté(s) sont apparus. Exportez-les d’abord.`,
                );
                return;
              }
              setPreview(null);
              setError(null);
              await refreshActive();
              Alert.alert('Paquet déchargé', 'L’appareil est prêt à recevoir un nouveau paquet .atlaspack.');
            } catch (e) {
              Alert.alert('Déchargement impossible', String(e));
            } finally {
              setUnloading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: 'center', backgroundColor: colors.gray50 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.gray900, marginBottom: 4 }}>
        Importer un paquet terrain
      </Text>
      <Text style={{ fontSize: 14, color: colors.gray500, marginBottom: 24 }}>
        Sélectionnez le fichier .atlaspack reçu du bureau Atlas Colab (USB, WhatsApp, Bluetooth, carte mémoire...).
        Son intégrité et sa signature sont vérifiées automatiquement avant tout import.
      </Text>

      {checking ? (
        <ActivityIndicator color={colors.blue600} />
      ) : active ? (
        <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Lock color={colors.blue600} size={22} strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: colors.gray900 }}>Un paquet est déjà chargé</Text>
              <Text style={{ color: colors.gray700, marginTop: 4 }}>Opérateur : {active.operatorEmail}</Text>
              <Text style={{ color: colors.gray700 }}>{active.missionIds.length} mission(s)</Text>
              <Text style={{ color: colors.gray500, fontSize: 12, marginTop: 4 }}>
                Importé le {new Date(active.importedAt).toLocaleDateString('fr-FR')}
              </Text>
              <Text style={{ color: colors.gray500, fontSize: 12, marginTop: 8 }}>
                L’import d’un autre paquet est bloqué tant que celui-ci est en place.
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void confirmUnload()}
            disabled={unloading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: colors.red500,
              borderRadius: radius.xl,
              paddingVertical: 13,
              opacity: unloading ? 0.6 : 1,
            }}
          >
            {unloading ? (
              <ActivityIndicator color={colors.red500} />
            ) : (
              <Trash2 color={colors.red500} size={18} strokeWidth={2} />
            )}
            <Text style={{ color: colors.red500, fontWeight: '700' }}>Décharger le paquet</Text>
          </Pressable>
        </View>
      ) : (
        <PrimaryButton label="Choisir le fichier .atlaspack" onPress={pickAndImport} loading={loading} />
      )}

      {loading && step && (
        <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <ActivityIndicator color={colors.blue600} />
          <Text style={{ color: colors.gray700 }}>{step}</Text>
        </View>
      )}

      {preview && (
        <View style={{ marginTop: 24, backgroundColor: colors.green50, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', gap: spacing.md }}>
          <PackageCheck color={colors.green500} size={22} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.gray900 }}>Paquet importé et vérifié</Text>
            <Text style={{ color: colors.gray700, marginTop: 4 }}>Opérateur : {preview.operatorEmail}</Text>
            <Text style={{ color: colors.gray700 }}>{preview.missionsCount} mission(s)</Text>
            <Text style={{ color: colors.gray500, fontSize: 12, marginTop: 4 }}>
              Valide jusqu’au {new Date(preview.expiresAt).toLocaleDateString('fr-FR')}
            </Text>
            <Text style={{ color: colors.gray500, fontSize: 12, marginTop: 8 }}>
              Retournez à l’écran de connexion et entrez le mot de passe fourni par le bureau.
            </Text>
          </View>
        </View>
      )}

      {error && !preview && (
        <View style={{ marginTop: 24, backgroundColor: colors.red50, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', gap: spacing.md }}>
          <FileWarning color={colors.red500} size={22} strokeWidth={2} />
          <Text style={{ flex: 1, color: colors.gray900 }}>{error}</Text>
        </View>
      )}
    </ScrollView>
  );
};
