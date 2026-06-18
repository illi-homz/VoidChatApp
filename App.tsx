import React, { useEffect, useCallback, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BootSplash from 'react-native-bootsplash';
import { AppNavigator } from './src/navigation/AppNavigator';
import { serverStore } from './src/stores/ServerStore';
import { appStore } from './src/stores/AppStore';
import { dbService } from './src/services/DatabaseService';
import { screenCapture } from './src/services/ScreenCapture';
import { StoreProvider } from './src/stores';
import { ToastProvider } from './src/components/Toast';
import { NotificationProvider } from './src/components/NotificationBanner';
import { SplashScreen } from './src/components/SplashScreen';

function App(): React.JSX.Element {
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await dbService.initialize();
        await serverStore.load();
        await appStore.initIdentity();
      } catch (e) {
        console.error('[App] Initialization failed', e);
      }
    })();
  }, []);

  // В debug-сборке разрешаем скриншоты с самого старта
  useEffect(() => {
    if (__DEV__) {
      screenCapture.allowScreenCapture();
    }
  }, []);

  const handleNavigationReady = useCallback(() => {
    BootSplash.hide({ fade: true });
  }, []);

  const handleSplashFinish = useCallback(() => {
    setSplashVisible(false);
  }, []);

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <ToastProvider>
          <NotificationProvider>
            <StatusBar
              barStyle="light-content"
              backgroundColor="transparent"
              translucent
              hidden={splashVisible}
            />
            <AppNavigator onReady={handleNavigationReady} />
            {splashVisible && (
              <SplashScreen
                visible={splashVisible}
                onFinish={handleSplashFinish}
                duration={2000}
              />
            )}
          </NotificationProvider>
        </ToastProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

export default App;
