import { StyleSheet } from 'react-native';

const W = 86;
const H = 128;
const RADIUS = 26;

export const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    top: 60,
    right: 12,
    width: W,
    height: H,
    borderRadius: RADIUS,
    overflow: 'hidden',
    zIndex: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.6)',
  },
  video: {
    width: W,
    height: H,
    borderRadius: RADIUS,
  },
});
