import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Icon } from '../../components/Icon';
import { styles } from './styles';

interface NotificationData {
  message: string;
  onPress?: () => void;
}

interface NotificationContextValue {
  notify: (data: NotificationData) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notify: () => {},
});

const BANNER_DURATION = 3000;
const ANIMATION_IN = 300;
const ANIMATION_OUT = 250;

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPressRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const hideBanner = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: ANIMATION_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: ANIMATION_OUT,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (isMountedRef.current) {
        setNotification(null);
        onPressRef.current = null;
      }
    });
  }, [translateY, opacity]);

  const notify = useCallback(
    (data: NotificationData) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      translateY.setValue(-120);
      opacity.setValue(0);

      onPressRef.current = data.onPress ?? null;
      setNotification(data);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: ANIMATION_IN,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: ANIMATION_IN,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        hideBanner();
      }, BANNER_DURATION);
    },
    [translateY, opacity, hideBanner],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handlePress = useCallback(() => {
    hideBanner();
    onPressRef.current?.();
  }, [hideBanner]);

  const ctxValue = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={ctxValue}>
      {children}
      {notification !== null && (
        <View style={styles.bannerOverlay} pointerEvents='box-none'>
          <Animated.View
            style={[
              styles.banner,
              {
                paddingTop: insets.top + 8,
                transform: [{ translateY }],
                opacity,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.bannerContent}
              onPress={handlePress}
              activeOpacity={0.8}
            >
              <View style={styles.bannerIcon}>
                <Icon name='message-circle' size={24} color={Colors.primary} />
              </View>
              <View style={styles.bannerTextContainer}>
                <Text style={styles.bannerTitle}>Новое сообщение</Text>
                <Text style={styles.bannerMessage} numberOfLines={1}>
                  {notification.message}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification(): {
  notify: (message: string, onPress?: () => void) => void;
} {
  const { notify: contextNotify } = useContext(NotificationContext);
  return {
    notify: useCallback(
      (message: string, onPress?: () => void) => {
        contextNotify({ message, onPress });
      },
      [contextNotify],
    ),
  };
}
