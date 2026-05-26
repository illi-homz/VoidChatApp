import { StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

const SCAN_BOX_SIZE = 250;

const OVERLAY_BG = 'rgba(0, 0, 0, 0.75)';

export const styles = StyleSheet.create({
  /* --- Корневой контейнер (камера + overlay) --- */
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  /* --- Полупрозрачный overlay с вырезом --- */
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: OVERLAY_BG,
  },
  overlayMiddleRow: {
    flexDirection: 'row',
    height: SCAN_BOX_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: OVERLAY_BG,
  },
  scanArea: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.success,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: OVERLAY_BG,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 24,
  },
  hintText: {
    color: Colors.primary,
    fontSize: 14,
  },

  /* --- Кнопка закрытия --- */
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* --- Состояния: permission / нет камеры --- */
  centeredContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
