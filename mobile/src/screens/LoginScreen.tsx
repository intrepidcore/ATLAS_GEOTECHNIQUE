import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Alert, Pressable, ScrollView } from 'react-native';
import { WifiOff, Wifi, PackagePlus } from 'lucide-react-native';
import { colors, radius } from '@/theme/tokens';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';
import { unlockAtlasPack } from '@/services/atlaspack/unlock';
import { PackageImportScreen } from './PackageImportScreen';

type Mode = 'online' | 'offline' | 'import';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>('offline');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmitOnline = async () => {
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      Alert.alert('Connexion impossible', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitOffline = async () => {
    setLoading(true);
    try {
      await unlockAtlasPack(email.trim(), password);
    } catch (err) {
      Alert.alert('Connexion hors-ligne impossible', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'import') {
    return (
      <View style={{ flex: 1 }}>
        <PackageImportScreen onImported={() => setMode('offline')} />
        <Pressable onPress={() => setMode('offline')} style={{ padding: 16, alignItems: 'center' }}>
          <Text style={{ color: colors.blue600, fontWeight: '600' }}>Retour à la connexion</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.gray50 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.gray900, marginBottom: 4 }}>
          Atlas Terrain
        </Text>
        <Text style={{ fontSize: 14, color: colors.gray500, marginBottom: 20 }}>
          {mode === 'offline'
            ? 'Connexion hors-ligne avec le paquet importé — aucun réseau requis'
            : 'Connectez-vous pour accéder à vos missions'}
        </Text>

        <View style={{ flexDirection: 'row', backgroundColor: colors.gray100, borderRadius: radius.xl, padding: 4, marginBottom: 24 }}>
          <ModeTab label="Hors-ligne" icon={WifiOff} active={mode === 'offline'} onPress={() => setMode('offline')} />
          <ModeTab label="En ligne" icon={Wifi} active={mode === 'online'} onPress={() => setMode('online')} />
        </View>

        <View style={{ gap: 16 }}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="votre@email.com"
          />
          <TextField
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          <PrimaryButton
            label={mode === 'offline' ? 'Déverrouiller' : 'Se connecter'}
            onPress={mode === 'offline' ? onSubmitOffline : onSubmitOnline}
            loading={loading}
            disabled={!email || !password}
          />
        </View>

        {mode === 'offline' && (
          <Pressable
            onPress={() => setMode('import')}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, padding: 12 }}
          >
            <PackagePlus color={colors.blue600} size={18} strokeWidth={2} />
            <Text style={{ color: colors.blue600, fontWeight: '600' }}>Importer un paquet .atlaspack</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const ModeTab: React.FC<{ label: string; icon: React.ElementType; active: boolean; onPress: () => void }> = ({
  label,
  icon: Icon,
  active,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={{
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: radius.lg,
      backgroundColor: active ? colors.white : 'transparent',
    }}
  >
    <Icon color={active ? colors.blue600 : colors.gray500} size={16} strokeWidth={2} />
    <Text style={{ color: active ? colors.blue600 : colors.gray500, fontWeight: '600', fontSize: 13 }}>{label}</Text>
  </Pressable>
);
