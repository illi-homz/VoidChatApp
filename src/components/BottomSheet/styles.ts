import { StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginBottom: 20,
    lineHeight: 20,
  },
  actionsContainer: {
    marginTop: 0,
  },
  actionButton: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
  },
  actionIcon: {
    width: 28,
    alignItems: 'center',
    marginRight: 10,
  },
  actionText: {
    fontSize: 17,
    fontWeight: '400',
  },
  actionSeparator: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 54,
  },
  cancelContainer: {
    marginTop: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  cancelButton: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '500',
    color: Colors.primary,
  },
  dragZone: {
    paddingTop: 20,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,216,144,0.3)',
    alignSelf: 'center',
    marginBottom: 12,
  },
});
