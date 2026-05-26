import { StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

const SCAN_BOX_SIZE = 250;
const SCAN_BORDER_RADIUS = 16;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanner: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCAN_BOX_SIZE * 0.3,
    height: SCAN_BOX_SIZE * 0.3,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.primary,
    borderTopLeftRadius: SCAN_BORDER_RADIUS,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: SCAN_BOX_SIZE * 0.3,
    height: SCAN_BOX_SIZE * 0.3,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.primary,
    borderTopRightRadius: SCAN_BORDER_RADIUS,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: SCAN_BOX_SIZE * 0.3,
    height: SCAN_BOX_SIZE * 0.3,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.primary,
    borderBottomLeftRadius: SCAN_BORDER_RADIUS,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: SCAN_BOX_SIZE * 0.3,
    height: SCAN_BOX_SIZE * 0.3,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.primary,
    borderBottomRightRadius: SCAN_BORDER_RADIUS,
  },
  hint: {
    color: Colors.primary,
    fontSize: 14,
    marginTop: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
