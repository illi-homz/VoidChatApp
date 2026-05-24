import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Easing,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from './Icon';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SWIPE_THRESHOLD = 80;

export interface BottomSheetAction {
  text: string;
  icon?: IconName;
  style?: 'cancel' | 'destructive' | 'default';
  onPress?: () => void;
}

interface BottomSheetProps {
  visible: boolean;
  title?: string;
  message?: string;
  actions: BottomSheetAction[];
  onClose: () => void;
}

export function BottomSheet({
  visible,
  title,
  message,
  actions,
  onClose,
}: BottomSheetProps): React.JSX.Element {
  const [localVisible, setLocalVisible] = useState(false);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const { bottom } = useSafeAreaInsets();

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > SWIPE_THRESHOLD || gesture.vy > 0.5) {
          closeWithAnimation();
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (visible) {
      setLocalVisible(true);
      translateY.setValue(SCREEN_HEIGHT);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      closeWithAnimation();
    }
  }, [visible]);

  function closeWithAnimation(): void {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setLocalVisible(false);
    });
  }

  function handleClose(): void {
    onClose();
  }

  const cancelActions = actions.filter(a => a.style === 'cancel');
  const nonCancelActions = actions.filter(a => a.style !== 'cancel');

  function renderActionButton(
    action: BottomSheetAction,
    index: number,
    arr: BottomSheetAction[],
  ): React.JSX.Element {
    const isLast = index === arr.length - 1;
    const textColor = action.style === 'destructive' ? Colors.error : Colors.textPrimary;

    return (
      <React.Fragment key={`action-${index}-${action.text}`}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            action.onPress?.();
            handleClose();
          }}
          activeOpacity={0.6}
          accessibilityRole='button'
          accessibilityLabel={action.text}
        >
          <View style={styles.actionIcon}>
            {action.icon && (
              <Icon name={action.icon} size={20} color={textColor} />
            )}
          </View>
          <Text style={[styles.actionText, { color: textColor }]}>{action.text}</Text>
        </TouchableOpacity>
        {!isLast && <View style={styles.actionSeparator} />}
      </React.Fragment>
    );
  }

  return (
    <Modal
      visible={localVisible}
      transparent
      animationType='none'
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.overlayTouchable} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }], paddingBottom: bottom + 20 }]}
        >
          {/* Верхняя часть: ручка + заголовок — зона для драга */}
          <View {...panResponder.panHandlers} style={styles.dragZone}>
            <View style={styles.dragIndicator} />
            {title && <Text style={styles.title}>{title}</Text>}
            {message && <Text style={styles.message}>{message}</Text>}
          </View>

          {/* Экшены — без PanResponder, чтобы TouchableOpacity работали */}
          {nonCancelActions.length > 0 && (
            <View style={styles.actionsContainer}>
              {nonCancelActions.map((action, index, arr) => renderActionButton(action, index, arr))}
            </View>
          )}

          {cancelActions.length > 0 && (
            <View style={styles.cancelContainer}>
              {cancelActions.map((action, index) => (
                <TouchableOpacity
                  key={`cancel-${index}-${action.text}`}
                  style={styles.cancelButton}
                  onPress={() => {
                    action.onPress?.();
                    handleClose();
                  }}
                  activeOpacity={0.6}
                  accessibilityRole='button'
                  accessibilityLabel={action.text}
                >
                  <View style={styles.cancelButtonRow}>
                    {action.icon && (
                      <Icon name={action.icon} size={18} color={Colors.primary} />
                    )}
                    <Text style={styles.cancelText}>{action.text}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginBottom: 20,
    lineHeight: 20,
  },
  actionsContainer: {
    marginTop: 0,
  },
  actionButton: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
  },
  actionIcon: {
    width: 28,
    alignItems: 'center',
    marginRight: 10,
  },
  actionText: {
    fontSize: 17,
    fontWeight: '400',
  },
  actionSeparator: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 54,
  },
  cancelContainer: {
    marginTop: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  cancelButton: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '500',
    color: Colors.primary,
  },
  dragZone: {
    paddingTop: 20,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,216,144,0.3)',
    alignSelf: 'center',
    marginBottom: 12,
  },
});
