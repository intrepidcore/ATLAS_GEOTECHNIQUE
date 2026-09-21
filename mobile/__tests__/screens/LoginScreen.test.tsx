import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { apiBaseUrl: 'http://test.local/api', atlasPackPublicKeyB64: 'dGVzdA==' } },
}));

jest.mock('@/screens/PackageImportScreen', () => ({
  PackageImportScreen: () => null,
}));

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const stub = () => View;
  return new Proxy({}, { get: () => stub() });
});

jest.mock('@/services/atlaspack/unlock', () => ({
  unlockAtlasPack: jest.fn(),
}));

import { LoginScreen } from '@/screens/LoginScreen';
import { AuthProvider } from '@/context/AuthContext';
import { unlockAtlasPack } from '@/services/atlaspack/unlock';

describe('LoginScreen', () => {
  it('renders in offline mode by default with email/password fields', async () => {
    const { getByText, getByPlaceholderText } = render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    );
    await waitFor(() => expect(getByText('Atlas Terrain')).toBeTruthy());
    expect(getByPlaceholderText('votre@email.com')).toBeTruthy();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
    expect(getByText('Déverrouiller')).toBeTruthy();
  });

  it('calls unlockAtlasPack with entered credentials in offline mode', async () => {
    const { getByPlaceholderText, getByText } = render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    );

    fireEvent.changeText(getByPlaceholderText('votre@email.com'), 'operateur@atlas.local');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'secret123');
    fireEvent.press(getByText('Déverrouiller'));

    await waitFor(() => expect(unlockAtlasPack).toHaveBeenCalledWith('operateur@atlas.local', 'secret123'));
  });

  it('switches to online mode and calls the login API with entered credentials', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'a', refresh_token: 'r' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getByPlaceholderText, getByText } = render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    );

    fireEvent.press(getByText('En ligne'));
    fireEvent.changeText(getByPlaceholderText('votre@email.com'), 'etudiant@atlas.local');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'secret123');
    fireEvent.press(getByText('Se connecter'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      'http://test.local/api/auth/login',
      expect.objectContaining({ method: 'POST' })
    ));
  });
});
