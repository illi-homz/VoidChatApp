import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { AddFriendScreen } from '../screens/AddFriendScreen';
import { AddServerScreen } from '../screens/AddServerScreen';
import { ShareIdScreen } from '../screens/ShareIdScreen';
import { Colors } from '../theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  onReady?: () => void;
}

export function AppNavigator({ onReady }: AppNavigatorProps): React.JSX.Element {
  return (
    <NavigationContainer onReady={onReady}>
      <Stack.Navigator
        initialRouteName='Welcome'
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
        <Stack.Screen name='Welcome' component={WelcomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name='Home' component={HomeScreen} />
        <Stack.Screen name='Chat' component={ChatScreen} options={{ title: '⚓ Чат' }} />
        <Stack.Screen
          name='AddFriend'
          component={AddFriendScreen}
          options={{ title: 'Вербовка' }}
        />
        <Stack.Screen
          name='AddServer'
          component={AddServerScreen}
          options={{ title: 'Новый порт' }}
        />
        <Stack.Screen name='ShareId' component={ShareIdScreen} options={{ title: 'Каперское' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
