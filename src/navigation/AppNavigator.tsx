import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { StartupScreen } from '../screens/StartupScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ServerListScreen } from '../screens/ServerListScreen';
import { AddFriendScreen } from '../screens/AddFriendScreen';
import { AddServerScreen } from '../screens/AddServerScreen';
import { CallScreen } from '../screens/CallScreen';
import { Colors } from '../theme/colors';
import { SelectionOverlay } from '../components/SelectionOverlay';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  onReady?: () => void;
}

export function AppNavigator({ onReady }: AppNavigatorProps): React.JSX.Element {
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer onReady={onReady}>
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
            options={{ title: 'Добавить контакт' }}
          />
          <Stack.Screen
            name='AddServer'
            component={AddServerScreen}
            options={{ title: 'Новый сервер' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <SelectionOverlay />
    </View>
  );
}
