import { ViewStyle } from 'react-native';
import { Colors } from './colors';

export const Spacing = {
  padding: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 24,
  },
  margin: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  gap: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  iconSize: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
} as const;

// Переиспользуемые стили границ
export const Borders = {
  standard: {
    borderWidth: Colors.borderStandardWidth,
    borderColor: Colors.border,
  } as ViewStyle,
  gold: {
    borderWidth: Colors.borderStandardWidth,
    borderColor: Colors.borderGold,
  } as ViewStyle,
  bottom: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  } as ViewStyle,
};

// Переиспользуемые тени с белым отливом
export const Shadows = {
  card: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  } as ViewStyle,
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  } as ViewStyle,
  banner: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  } as ViewStyle,
};
