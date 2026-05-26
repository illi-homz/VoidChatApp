import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
  Easing,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../Icon';
import { styles } from './styles';

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

export const BottomSheet = React.memo(function BottomSheet({
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
            {action.icon && <Icon name={action.icon} size={20} color={textColor} />}
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
                    {action.icon && <Icon name={action.icon} size={18} color={Colors.primary} />}
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
});
