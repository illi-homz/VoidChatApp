import { StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  spinner: {
    marginBottom: 16,
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  errorIcon: {
    marginBottom: 16,
  } as const,
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  switchButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
