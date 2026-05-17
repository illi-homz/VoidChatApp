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

export function AppNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName='Welcome'
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.surface,
          },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: Colors.background,
          },
        }}
      >
        <Stack.Screen name='Welcome' component={WelcomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name='Home' component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name='Chat' component={ChatScreen} options={{ title: 'Чат' }} />
        <Stack.Screen
          name='AddFriend'
          component={AddFriendScreen}
          options={{ title: 'Добавить друга' }}
        />
        <Stack.Screen
          name='AddServer'
          component={AddServerScreen}
          options={{ title: 'Новый сервер' }}
        />
        <Stack.Screen name='ShareId' component={ShareIdScreen} options={{ title: 'Мой ID' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
