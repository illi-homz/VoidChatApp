import { StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

export const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.background,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },

  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Text ---

  textBlock: {
    alignItems: 'center',
    marginTop: 32,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  titleLine: {
    width: 28,
    height: 1,
    backgroundColor: Colors.skullWhite,
    opacity: 0.35,
  },

  titleText: {
    color: Colors.skullWhite,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 10,
    fontFamily: 'monospace',
  },

  subtitleText: {
    color: Colors.skullWhite,
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 8,
    fontFamily: 'monospace',
    marginTop: 10,
  },
});
