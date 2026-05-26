import { StyleSheet } from 'react-native';
import { Colors } from '../../theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark || '#F0C080',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
