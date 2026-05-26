import { StyleSheet } from 'react-native';

const CHEVRON_HEIGHT = 24;
const CHEVRON_WIDTH = 24;
const LINE_LENGTH = 20;
const LINE_THICKNESS = 2.5;
const CHEVRON_ANGLE = '12deg';

export const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevron: {
    width: CHEVRON_WIDTH,
    height: CHEVRON_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  line: {
    position: 'absolute',
    width: LINE_LENGTH,
    height: LINE_THICKNESS,
    borderRadius: LINE_THICKNESS / 2,
    transformOrigin: 'left center',
  },
  lineTop: {
    left: 0,
    top: (CHEVRON_HEIGHT - LINE_THICKNESS) / 2,
    transform: [{ rotate: CHEVRON_ANGLE }],
  },
  lineBottom: {
    left: 0,
    top: (CHEVRON_HEIGHT - LINE_THICKNESS) / 2,
    transform: [{ rotate: `-${CHEVRON_ANGLE}` }],
  },
});
