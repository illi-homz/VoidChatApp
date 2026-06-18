import React, { useEffect } from 'react';
import { DeviceEventEmitter, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

import { StartupScreen } from '../screens/StartupScreen';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
import { HomeScreen } from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ServerListScreen } from '../screens/ServerListScreen';
import { AddFriendScreen } from '../screens/AddFriendScreen';
import { AddServerScreen } from '../screens/AddServerScreen';
import { StorageScreen } from '../screens/StorageScreen';
import { CallScreen } from '../screens/CallScreen';
import { Colors } from '../theme/colors';
import { SelectionOverlay } from '../components/SelectionOverlay';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  onReady?: () => void;
}

const linking = {
  prefixes: ['voidchat://'],
  config: {
    screens: {
      AddServer: 'invite',
      Home: '',
    },
  },
};

export function AppNavigator({ onReady }: AppNavigatorProps): React.JSX.Element {
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'notification_tapped',
      (contactId: string) => {
        if (!navigationRef.isReady()) {
          const retry = setInterval(() => {
            if (navigationRef.isReady()) {
              clearInterval(retry);
              navigationRef.navigate('Chat', { contactId });
            }
          }, 100);
          setTimeout(() => clearInterval(retry), 5000);
          return;
        }
        navigationRef.navigate('Chat', { contactId });
      },
    );
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef} onReady={onReady} linking={linking}>
        <Stack.Navigator
          initialRouteName='Startup'
          screenOptions={{
            headerStyle: {
              backgroundColor: Colors.surface,
            },
            headerTintColor: Colors.primary,
            headerTitleStyle: {
              fontWeight: '700',
            },
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: Colors.background,
            },
          }}
        >
          <Stack.Screen name='Startup' component={StartupScreen} options={{ headerShown: false }} />
          <Stack.Screen name='Home' component={HomeScreen} />
          <Stack.Screen name='Chat' component={ChatScreen} options={{ title: 'Чат' }} />
          <Stack.Screen
            name='Settings'
            component={SettingsScreen}
            options={{ title: 'Настройки' }}
          />
          <Stack.Screen
            name='ServerList'
            component={ServerListScreen}
            options={{ title: 'Серверы' }}
          />
          <Stack.Screen
            name='Call'
            component={CallScreen}
            options={{ headerShown: false, presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name='AddFriend'
            component={AddFriendScreen}
            options={{ headerTitle: '' }}
          />
          <Stack.Screen
            name='AddServer'
            component={AddServerScreen}
            options={{ headerTitle: '' }}
          />
          <Stack.Screen
            name='Storage'
            component={StorageScreen}
            options={{ title: 'Управление хранилищем' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <SelectionOverlay />
    </View>
  );
}
