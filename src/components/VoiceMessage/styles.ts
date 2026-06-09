import { StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

const PLAY_BUTTON_SIZE = 36;

export const VOICE_CONSTANTS = {
  PLAY_BUTTON_SIZE,
  BAR_MIN_HEIGHT: 4,
  BAR_MAX_HEIGHT: 18,
} as const;

export const styles = StyleSheet.create({
  /* ─── Row wrapper (messageRow + messageRowMine/Theirs) ─── */
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

  /* ─── Selection marker ─── */
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
  messageRowSelected: {
    backgroundColor: 'rgba(255, 215, 0, 0.10)',
    borderRadius: 16,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },

  /* ─── Bubble ─── */
  messageWrap: {
    flex: 1,
  },
  bubble: {
    width: '100%',
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    minHeight: 56,
    justifyContent: 'center',
    gap: 6,
  },
  myBubble: {
    backgroundColor: Colors.surface,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  theirBubble: {
    backgroundColor: Colors.surfaceLight,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  /* ─── Top row: play + waveform + speed ─── */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  /* ─── Play/Pause button ─── */
  playButton: {
    width: PLAY_BUTTON_SIZE,
    height: PLAY_BUTTON_SIZE,
    borderRadius: PLAY_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonMine: {
    backgroundColor: 'rgba(255,216,144,0.15)',
  },
  playButtonMineActive: {
    backgroundColor: Colors.primary,
  },
  playButtonTheirs: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  playButtonTheirsActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  /* ─── Waveform ─── */
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    height: VOICE_CONSTANTS.BAR_MAX_HEIGHT,
    paddingHorizontal: 4,
  },
  waveformBar: {
    flex: 1,
    maxWidth: 4,
    height: '100%',
    borderRadius: 2,
  },
  waveformBarPlayedMine: {
    backgroundColor: Colors.primary,
  },
  waveformBarUnplayedMine: {
    backgroundColor: 'rgba(255,216,144,0.25)',
  },
  waveformBarPlayedTheirs: {
    backgroundColor: Colors.textSecondary,
  },
  waveformBarUnplayedTheirs: {
    backgroundColor: 'rgba(160,160,160,0.25)',
  },

  /* ─── Speed button ─── */
  speedButton: {
    width: 36,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  speedButtonMine: {
    backgroundColor: 'rgba(255,216,144,0.12)',
  },
  speedButtonTheirs: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  speedButtonText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Fonts.roboto700,
    letterSpacing: 0.2,
  },
  speedButtonTextMine: {
    color: Colors.primary,
  },
  speedButtonTextTheirs: {
    color: Colors.textSecondary,
  },

  /* ─── Bottom row: mic icon + time + status ─── */
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 0, // под кнопкой play
  },

  /* ─── Mic icon wrapping ─── */
  micIconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ─── Time text ─── */
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Fonts.roboto500,
    letterSpacing: 0.3,
  },
  timeTextMine: {
    color: Colors.primaryDark,
  },
  timeTextTheirs: {
    color: Colors.textSecondary,
  },

  /* ─── Status icon placeholder ─── */
  statusArea: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    marginRight: 4,
  },
  statusIconWrap: {
    width: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
});
