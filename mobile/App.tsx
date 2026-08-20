import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/context/AuthContext';
import { RoleProvider } from '@/context/RoleContext';
import { SyncStatusProvider } from '@/context/SyncStatusContext';
import { RootNavigator } from '@/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RoleProvider>
          <SyncStatusProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </SyncStatusProvider>
        </RoleProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
