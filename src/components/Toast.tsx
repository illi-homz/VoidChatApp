import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Colors } from '../theme/colors';
import { Icon, IconName } from './Icon';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastData {
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  show: () => {},
});

const TOAST_DURATION = 2500;
const TOAST_ANIMATION_IN = 300;
const TOAST_ANIMATION_OUT = 250;

/** Тёмный непрозрачный фон с лёгким оттенком статуса */
const BG_COLORS: Record<ToastType, string> = {
  success: 'rgba(0, 50, 30, 0.88)',
  error: 'rgba(80, 15, 15, 0.88)',
  warning: 'rgba(80, 55, 0, 0.88)',
  info: 'rgba(45, 40, 30, 0.88)',
};

/** Цвет границы — соответствует статусу */
const BORDER_COLORS: Record<ToastType, string> = {
  success: 'rgba(0, 204, 136, 0.35)',
  error: 'rgba(255, 68, 68, 0.35)',
  warning: 'rgba(255, 184, 0, 0.35)',
  info: 'rgba(255, 216, 144, 0.3)',
};

/** Цвет левой акцентной полосы и иконки — насыщенный и читаемый */
const ACCENT_COLORS: Record<ToastType, string> = {
  success: Colors.toastSuccess,
  error: Colors.toastError,
  warning: Colors.toastWarning,
  info: Colors.toastInfo,
};

/** Иконка для каждого статуса */
const ICON_NAMES: Record<ToastType, IconName> = {
  success: 'check',
  error: 'circle-x',
  warning: 'triangle-alert',
  info: 'message-circle',
};

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = 'info') => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setToast({ message, type });

      timerRef.current = setTimeout(() => {
        hideToast();
      }, TOAST_DURATION);
    },
    [hideToast],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast !== null && (
        <View style={[styles.toastOverlay, { paddingTop: insets.top + 16 }]} pointerEvents='box-none'>
          <Animated.View
            style={[
              styles.toast,
              {
                backgroundColor: BG_COLORS[toast.type],
                borderColor: BORDER_COLORS[toast.type],
                borderLeftColor: ACCENT_COLORS[toast.type],
              },
            ]}
            entering={FadeInUp.duration(TOAST_ANIMATION_IN).springify()}
            exiting={FadeOutUp.duration(TOAST_ANIMATION_OUT)}
            accessibilityRole='alert'
            accessibilityLabel={toast.message}
          >
            <View style={styles.toastIcon}>
              <Icon name={ICON_NAMES[toast.type]} size={16} color={ACCENT_COLORS[toast.type]} />
            </View>
            <Text style={styles.toastText}>{toast.message}</Text>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): { toast: (message: string, type?: ToastType) => void } {
  const { show } = useContext(ToastContext);
  return { toast: show };
}

const styles = StyleSheet.create({
  toastOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
    paddingRight: 14,
    paddingLeft: 10,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  toastIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
});
