import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
  Easing,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { styles } from './styles';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SWIPE_THRESHOLD = 80;

interface BottomSheetPromptProps {
  visible: boolean;
  currentNickname: string;
  onSave: (nickname: string) => void;
  onCancel: () => void;
}

export const BottomSheetPrompt = React.memo(function BottomSheetPrompt({
  visible,
  currentNickname,
  onSave,
  onCancel,
}: BottomSheetPromptProps): React.JSX.Element {
  const [localVisible, setLocalVisible] = useState(false);
  const [nickname, setNickname] = useState(currentNickname);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const insets = useSafeAreaInsets();
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
              paddingBottom: keyboardHeight + insets.bottom + 20,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.dragIndicator} />
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
});
