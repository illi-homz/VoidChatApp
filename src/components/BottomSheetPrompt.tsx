import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
} from 'react-native';
import { Colors } from '../theme/colors';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SWIPE_THRESHOLD = 80;

interface BottomSheetPromptProps {
  visible: boolean;
  currentNickname: string;
  onSave: (nickname: string) => void;
  onCancel: () => void;
}

export function BottomSheetPrompt({
  visible,
  currentNickname,
  onSave,
  onCancel,
}: BottomSheetPromptProps): React.JSX.Element {
  const [localVisible, setLocalVisible] = useState(false);
  const [nickname, setNickname] = useState(currentNickname);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const inputRef = useRef<TextInput>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return gesture.dy > 5;
      },
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > SWIPE_THRESHOLD || gesture.vy > 0.5) {
          closeWithAnimation();
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
    setNickname(currentNickname);
  }, [currentNickname]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    if (visible) {
      setLocalVisible(true);
      translateY.setValue(SCREEN_HEIGHT);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        inputRef.current?.focus();
      });
    } else {
      closeWithAnimation();
    }

    return () => {
      showSub.remove();
      hideSub.remove();
    };
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

  function handleSave(): void {
    onSave(nickname.trim());
  }

  function handleCancel(): void {
    onCancel();
  }

  return (
    <Modal
      visible={localVisible}
      transparent
      animationType='none'
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleCancel}>
          <View style={styles.overlayTouchable} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY }],
              paddingBottom: keyboardHeight + (Platform.OS === 'ios' ? 34 : 20),
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Text style={styles.title}>Прозвище</Text>
          <Text style={styles.subtitle}>Введите прозвище для этого контакта</Text>

          <TextInput
            ref={inputRef}
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder='Введите прозвище...'
            placeholderTextColor={Colors.textMuted}
            maxLength={32}
            autoCapitalize='none'
            autoCorrect={false}
            returnKeyType='done'
            onSubmitEditing={handleSave}
            accessibilityLabel='Прозвище контакта'
          />

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel='Отмена'
            >
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel='Сохранить'
            >
              <Text style={styles.saveText}>Сохранить</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
