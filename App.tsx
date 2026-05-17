import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { serverStore } from './src/stores/ServerStore';
import { StoreProvider } from './src/stores';
import { ToastProvider } from './src/components/Toast';
import { NotificationProvider } from './src/components/NotificationBanner';
import { Colors } from './src/theme/colors';

function App(): React.JSX.Element {
  useEffect(() => {
    serverStore.load();
  }, []);

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <ToastProvider>
          <NotificationProvider>
            <StatusBar barStyle="light-content" backgroundColor={Colors.background} translucent />
            <AppNavigator />
          </NotificationProvider>
        </ToastProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

export default App;
