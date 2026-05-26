import { StyleSheet } from 'react-native';

const W = 80;
const H = 80;
const RADIUS = 40;

export const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    top: 60,
    right: 12,
    width: W,
    height: H,
    borderRadius: RADIUS,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.6)',
    zIndex: 10,
  },
  video: {
    width: W,
    height: H,
    borderRadius: RADIUS,
  },
});
