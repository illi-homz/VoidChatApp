import { StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
    justifyContent: 'flex-end',
    rowGap: 4,
  },
  messageWrap: {
    flex: 1,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  myMessage: {
    backgroundColor: Colors.surface,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  theirMessage: {
    backgroundColor: Colors.surfaceLight,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    color: Colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 16,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 16,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  selectionMarker: {
    overflow: 'hidden',
    justifyContent: 'center',
    paddingLeft: 6,
  },
  selectionMarkerCircleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  selectionCircleSelected: {
    backgroundColor: Colors.primary,
  },
  selectionCheckmark: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
  messageRowSelected: {
    backgroundColor: 'rgba(255, 215, 0, 0.10)',
    borderRadius: 16,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
});
