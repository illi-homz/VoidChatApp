import React from 'react';
import { View, LayoutChangeEvent, ViewStyle, Platform } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { styles } from './styles';

interface VideoPiPProps {
  streamURL: string | null;
  style?: ViewStyle;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * VideoPiP — self-view для видео-звонков.
 * На Android использует TextureView (через проп useTextureView),
 * который корректно обрезается overflow:hidden + borderRadius.
 */
export function VideoPiP({ streamURL, style, onLayout }: VideoPiPProps): React.JSX.Element | null {
  if (streamURL === null) {
    return null;
  }

  return (
    <View
      style={[styles.box, style]}
      onLayout={onLayout}
      accessibilityRole='none'
      accessibilityLabel='Моё видео'
    >
      <RTCView
        streamURL={streamURL}
        style={styles.video}
        objectFit='cover'
        mirror={true}
        useTextureView={Platform.OS === 'android'}
      />
    </View>
  );
}
