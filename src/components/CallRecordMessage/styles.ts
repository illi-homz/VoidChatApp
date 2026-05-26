import { StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    gap: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapMissed: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
  },
  textWrap: {
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  duration: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.3,
  },
});
