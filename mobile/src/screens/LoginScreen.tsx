import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { colors } from '@/theme/tokens';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      Alert.alert('Connexion impossible', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.gray50, justifyContent: 'center', padding: 24 }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700', color: colors.gray900, marginBottom: 4 }}>
        Atlas Terrain
      </Text>
      <Text style={{ fontSize: 14, color: colors.gray500, marginBottom: 32 }}>
        Connectez-vous pour accéder à vos missions
      </Text>

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
        <PrimaryButton label="Se connecter" onPress={onSubmit} loading={loading} disabled={!email || !password} />
      </View>
    </KeyboardAvoidingView>
  );
};
