import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { apiBaseUrl: 'http://test.local/api' } },
}));

import { LoginScreen } from '@/screens/LoginScreen';
import { AuthProvider } from '@/context/AuthContext';

describe('LoginScreen', () => {
  it('renders the email and password fields and a disabled submit button', async () => {
    const { getByText, getByPlaceholderText } = render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    );
    await waitFor(() => expect(getByText('Atlas Terrain')).toBeTruthy());
    expect(getByPlaceholderText('votre@email.com')).toBeTruthy();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('calls the login API with entered credentials on submit', async () => {
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

    fireEvent.changeText(getByPlaceholderText('votre@email.com'), 'etudiant@atlas.local');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'secret123');
    fireEvent.press(getByText('Se connecter'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      'http://test.local/api/auth/login',
      expect.objectContaining({ method: 'POST' })
    ));
  });
});
