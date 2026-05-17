import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type ToastType = 'success' | 'error' | 'info';

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

const BG_COLORS: Record<ToastType, string> = {
  success: '#4CAF50',
  error: '#FF6B6B',
  info: '#666',
};

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toast, setToast] = useState<ToastData | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: TOAST_ANIMATION_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: TOAST_ANIMATION_OUT,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [translateY, opacity]);

  const show = useCallback(
    (message: string, type: ToastType = 'info') => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      translateY.setValue(-120);
      opacity.setValue(0);

      setToast({ message, type });

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 60,
          duration: TOAST_ANIMATION_IN,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: TOAST_ANIMATION_IN,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        hideToast();
      }, TOAST_DURATION);
    },
    [translateY, opacity, hideToast],
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
        <View style={styles.toastOverlay} pointerEvents='box-none'>
          <Animated.View
            style={[
              styles.toast,
              { backgroundColor: BG_COLORS[toast.type] },
              {
                transform: [{ translateY }],
                opacity,
              },
            ]}
            accessibilityRole='alert'
            accessibilityLabel={toast.message}
          >
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
    alignItems: 'center',
  },
  toast: {
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    maxWidth: '85%',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});
