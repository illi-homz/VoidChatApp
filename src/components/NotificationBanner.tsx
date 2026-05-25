import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Icon } from '../components/Icon';

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

  return (
    <NotificationContext.Provider value={{ notify }}>
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

const styles = StyleSheet.create({
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    alignItems: 'center',
  },
  banner: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,216,144,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  bannerMessage: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
});
