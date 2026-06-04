import { StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

const WAVEFORM_BAR_COUNT = 20;
const WAVEFORM_BAR_WIDTH = 3;
const WAVEFORM_BAR_GAP = 2;
const PLAY_BUTTON_SIZE = 36;

export const VOICE_CONSTANTS = {
  WAVEFORM_BAR_COUNT,
  WAVEFORM_BAR_WIDTH,
  WAVEFORM_BAR_GAP,
  PLAY_BUTTON_SIZE,
  /** Полная ширина waveform = count * barWidth + (count-1) * gap */
  WAVEFORM_TOTAL_WIDTH:
    WAVEFORM_BAR_COUNT * WAVEFORM_BAR_WIDTH + (WAVEFORM_BAR_COUNT - 1) * WAVEFORM_BAR_GAP,
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
    maxWidth: '82%',
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
    gap: 10,
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
    gap: WAVEFORM_BAR_GAP,
    height: VOICE_CONSTANTS.BAR_MAX_HEIGHT,
  },
  waveformBar: {
    width: WAVEFORM_BAR_WIDTH,
    borderRadius: 1.5,
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
    minWidth: 34,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
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
    fontFamily: 'sans-serif',
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
    paddingLeft: 46, // align with waveform (play button + gap)
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
    fontFamily: 'sans-serif',
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
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  statusIconWrap: {
    width: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
});
