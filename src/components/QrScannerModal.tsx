import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Colors } from '../theme/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QrScannerModalProps {
  /** Управляет видимостью модалки */
  visible: boolean;
  /** Вызывается при успешном распознавании QR-кода */
  onScan: (userId: string) => void;
  /** Вызывается при закрытии модалки */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCAN_BOX_SIZE = 250;
const SCAN_BORDER_RADIUS = 16;
const FLASH_DURATION_IN = 100;
const FLASH_DURATION_OUT = 400;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QrScannerModal({
  visible,
  onScan,
  onClose,
}: QrScannerModalProps): React.JSX.Element {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  // Guard: предотвращает повторный вызов onScan пока ref не сброшен
  const hasScannedRef = useRef(false);

  // Guard: предотвращает повторный авто-запрос разрешения за одно открытие
  const hasAutoRequestedRef = useRef(false);

  // Анимация зелёной вспышки на рамке сканирования
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Локальный флаг «пользователь отклонил разрешение»
  const [permissionDenied, setPermissionDenied] = useState(false);

  // -----------------------------------------------------------------------
  // Сброс guard-флагов и анимации при закрытии модалки
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!visible) {
      hasScannedRef.current = false;
      hasAutoRequestedRef.current = false;
      flashAnim.setValue(0);
      // Не сбрасываем permissionDenied здесь — чтобы на iOS повторное
      // открытие не триггерило диалог, который всё равно не покажется.
      // При желании пользователь закроет модалку и откроет настройки.
    }
  }, [visible, flashAnim]);

  // -----------------------------------------------------------------------
  // Авто-запрос разрешения камеры при первом открытии
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (visible && hasPermission !== true && !hasAutoRequestedRef.current) {
      hasAutoRequestedRef.current = true;
      requestPermission().then(granted => {
        if (!granted) {
          setPermissionDenied(true);
        }
      });
    }
  }, [visible, hasPermission, requestPermission]);

  // -----------------------------------------------------------------------
  // Обработчик результата сканирования
  // -----------------------------------------------------------------------
  const handleCodeScanned = useCallback(
    (codes: Array<{ value?: string }>) => {
      if (hasScannedRef.current || codes.length === 0 || !codes[0]?.value) {
        return;
      }

      hasScannedRef.current = true;

      // Зелёная вспышка
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: FLASH_DURATION_IN,
          useNativeDriver: true,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: FLASH_DURATION_OUT,
          useNativeDriver: true,
        }),
      ]).start();

      onScan(codes[0].value);
    },
    [onScan],
  );

  // -----------------------------------------------------------------------
  // Вспомогательные рендер-функции для разных состояний
  // -----------------------------------------------------------------------

  const renderPermissionLoading = (): React.JSX.Element => (
    <View style={styles.centeredContainer}>
      <ActivityIndicator size='large' color={Colors.primary} />
      <Text style={styles.statusTitle}>Проверка разрешений...</Text>
    </View>
  );

  const renderPermissionRequest = (): React.JSX.Element => (
    <View style={styles.centeredContainer}>
      <Text style={styles.statusTitle}>Разрешите доступ к камере</Text>
      <Text style={styles.statusText}>
        Для сканирования QR-кодов необходимо разрешение на использование камеры.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => {
          requestPermission().then(granted => {
            if (!granted) {
              setPermissionDenied(true);
            }
          });
        }}
        activeOpacity={0.7}
        accessibilityLabel='Предоставить доступ к камере'
        accessibilityRole='button'
      >
        <Text style={styles.primaryButtonText}>Предоставить доступ</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={onClose}
        activeOpacity={0.7}
        accessibilityLabel='Закрыть'
        accessibilityRole='button'
      >
        <Text style={styles.secondaryButtonText}>Отмена</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPermissionDenied = (): React.JSX.Element => (
    <View style={styles.centeredContainer}>
      <Text style={styles.statusTitle}>Доступ к камере запрещён</Text>
      <Text style={styles.statusText}>
        Разрешите доступ к камере в настройках устройства, чтобы сканировать QR-коды.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={onClose}
        activeOpacity={0.7}
        accessibilityLabel='Закрыть'
        accessibilityRole='button'
      >
        <Text style={styles.primaryButtonText}>Закрыть</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNoCamera = (): React.JSX.Element => (
    <View style={styles.centeredContainer}>
      <Text style={styles.statusTitle}>Камера не найдена</Text>
      <Text style={styles.statusText}>
        Не удалось найти камеру на устройстве. Проверьте, что камера работает.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={onClose}
        activeOpacity={0.7}
        accessibilityLabel='Закрыть'
        accessibilityRole='button'
      >
        <Text style={styles.primaryButtonText}>Закрыть</Text>
      </TouchableOpacity>
    </View>
  );

  // -----------------------------------------------------------------------
  // Основной рендер — камера + overlay
  // -----------------------------------------------------------------------

  const renderScanner = (): React.JSX.Element => (
    <View style={styles.container}>
      {device != null && hasPermission === true && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible}
          codeScanner={{
            codeTypes: ['qr'],
            onCodeScanned: handleCodeScanned,
          }}
        />
      )}

      {/* Полупрозрачный overlay с вырезом под область сканирования */}
      <View style={styles.overlayContainer} pointerEvents='box-none'>
        {/* Верхняя тёмная полоса */}
        <View style={styles.overlayTop} />

        {/* Средний ряд: боковые затемнения + рамка сканирования */}
        <View style={styles.overlayMiddleRow}>
          <View style={styles.overlaySide} />
          <View style={styles.scanArea}>
            {/* Золотой контур рамки */}
            <View style={styles.scanBorder} />
            {/* Зелёная вспышка при успешном сканировании */}
            <Animated.View
              style={[styles.flashOverlay, { opacity: flashAnim }]}
              pointerEvents='none'
            />
          </View>
          <View style={styles.overlaySide} />
        </View>

        {/* Нижняя тёмная полоса с подсказкой */}
        <View style={styles.overlayBottom}>
          <Text style={styles.hintText}>Наведите на QR-код</Text>
        </View>

        {/* Кнопка закрытия (✕) в правом верхнем углу */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.7}
          accessibilityLabel='Закрыть сканер'
          accessibilityRole='button'
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        {/* Заголовок в верхней части */}
        <Text style={styles.titleText}>Сканирование QR</Text>
      </View>
    </View>
  );

  // -----------------------------------------------------------------------
  // Выбор контента в зависимости от состояния
  // -----------------------------------------------------------------------

  const renderContent = (): React.JSX.Element => {
    // 1. Разрешение ещё не загружено
    if (hasPermission === undefined) {
      return renderPermissionLoading();
    }

    // 2. Разрешение не получено
    if (hasPermission === false) {
      if (permissionDenied) {
        return renderPermissionDenied();
      }
      return renderPermissionRequest();
    }

    // 3. Разрешение есть, но камера недоступна
    if (device == null) {
      return renderNoCamera();
    }

    // 4. Всё готово — показываем сканер
    return renderScanner();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {renderContent()}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ------ Полноэкранный сканер ------
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
  },

  // Четыре зоны затемнения вокруг рамки сканирования
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlayMiddleRow: {
    flexDirection: 'row',
    height: SCAN_BOX_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  // Область сканирования (прозрачная, обрамлена золотом)
  scanArea: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: SCAN_BORDER_RADIUS,
    borderWidth: 2,
    borderColor: Colors.primary, // #FFD700 — золото
  },
  flashOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: SCAN_BORDER_RADIUS,
    backgroundColor: Colors.success, // #00FF88 — зелёный
  },

  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 30,
  },
  hintText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Кнопка закрытия
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },

  // Заголовок
  titleText: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },

  // ------ Центрированные экраны (permission / error) ------
  centeredContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  statusTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: Colors.borderRadius,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
