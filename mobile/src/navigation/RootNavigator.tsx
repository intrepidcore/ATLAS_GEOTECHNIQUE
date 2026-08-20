import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { useAuth } from '@/context/AuthContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { MissionsListScreen } from '@/screens/MissionsListScreen';
import { MissionDetailScreen } from '@/screens/MissionDetailScreen';
import { MissionMapScreen } from '@/screens/MissionMapScreen';
import { SondageFormScreen } from '@/screens/SondageFormScreen';
import { ActivityScreen } from '@/screens/ActivityScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { SyncStatusBanner } from '@/components/SyncStatusBanner';
import { TAB_ROUTES, type RootStackParamList, type TabParamList } from './routes';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const SCREEN_COMPONENTS: Record<TabParamList extends infer T ? keyof T : never, React.ComponentType> = {
  Missions: MissionsListScreen,
  Activity: ActivityScreen,
  Profile: ProfileScreen,
};

const Tabs: React.FC = () => (
  <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.blue600 }}>
    {TAB_ROUTES.map((route) => (
      <Tab.Screen key={route.name} name={route.name} component={SCREEN_COMPONENTS[route.name]} options={{ title: route.label }} />
    ))}
  </Tab.Navigator>
);

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.blue600} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <SyncStatusBanner />
      {isAuthenticated ? (
        <Stack.Navigator screenOptions={{ headerTintColor: colors.blue600 }}>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="MissionDetail" component={MissionDetailScreen} options={{ title: 'Mission' }} />
          <Stack.Screen name="MissionMap" component={MissionMapScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SondageForm" component={SondageFormScreen} options={{ title: 'Nouveau sondage' }} />
        </Stack.Navigator>
      ) : (
        <LoginScreen />
      )}
    </NavigationContainer>
  );
};
