import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { styles } from './styles';

interface NicknameEditModalProps {
  visible: boolean;
  currentNickname: string;
  onSave: (nickname: string) => void;
  onCancel: () => void;
}

export function NicknameEditModal({
  visible,
  currentNickname,
  onSave,
  onCancel,
}: NicknameEditModalProps): React.JSX.Element {
  const [nickname, setNickname] = useState(currentNickname);

  useEffect(() => {
    setNickname(currentNickname);
  }, [currentNickname, visible]);

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.dialog}>
          <Text style={styles.title}>Прозвище</Text>
          <Text style={styles.subtitle}>Введите прозвище для этого контакта</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder='Введите прозвище...'
            placeholderTextColor={Colors.textMuted}
            autoFocus
            maxLength={32}
          />
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => onSave(nickname.trim())}
              activeOpacity={0.7}
            >
              <Text style={styles.saveText}>Сохранить</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
