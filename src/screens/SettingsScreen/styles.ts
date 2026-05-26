import { StyleSheet } from 'react-native';
import { Colors } from '../../theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 0,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 8,
  },
  qrPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 12,
  },
  idContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  idLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  idValue: {
    fontSize: 13,
    color: Colors.primary,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
    paddingRight: 24,
  },
  idCopyIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  serverBottomRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  serverQrButton: {
    width: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  menuIcon: {
    width: 24,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  menuText: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  menuArrow: {
    marginLeft: 8,
  } as const,
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  serverCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  serverInfoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  serverInfoBlock: {
    flex: 1,
  },
  serverInfoTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDotSm: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusTime: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginLeft: 14,
  },
  statusDetails: {
    marginTop: 2,
  },
  serverActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  serverActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  reconnectButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  serverUrlClean: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedSince: {
    fontSize: 13,
    color: Colors.textPrimary,
  },

  statusSecondary: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },

  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aboutLeft: {
    flex: 1,
    marginRight: 16,
  },
  aboutRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutLogo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  aboutVersion: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  aboutBuilt: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  aboutQrHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },

  noServerContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  noServerText: {
    fontSize: 13,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  noServerScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  noServerScanText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
});
