jest.mock('react-native-blob-util', () => ({
  fs: { dirs: { CacheDir: '/cache' } },
  config: jest.fn(() => ({
    fetch: jest.fn(() => Promise.resolve({ path: () => '/tmp/test.apk' })),
  })),
  android: { actionViewIntent: jest.fn() },
}));

import { parseGithubTag, compareVersions } from '../AppUpdater';

describe('parseGithubTag', () => {
  it('removes v prefix', () => {
    expect(parseGithubTag('v0.5.0')).toBe('0.5.0');
  });

  it('returns as-is if no v prefix', () => {
    expect(parseGithubTag('0.5.0')).toBe('0.5.0');
  });

  it('handles empty string', () => {
    expect(parseGithubTag('')).toBe('');
  });
});

describe('compareVersions', () => {
  it('returns -1 when a < b (patch)', () => {
    expect(compareVersions('0.4.10', '0.4.11')).toBe(-1);
  });

  it('returns -1 when a < b (minor)', () => {
    expect(compareVersions('0.4.10', '0.5.0')).toBe(-1);
  });

  it('returns -1 when a < b (major)', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
  });

  it('returns 1 when a > b (patch)', () => {
    expect(compareVersions('0.5.0', '0.4.10')).toBe(1);
  });

  it('returns 1 when a > b (minor)', () => {
    expect(compareVersions('0.5.0', '0.4.10')).toBe(1);
  });

  it('returns 0 when equal', () => {
    expect(compareVersions('0.4.10', '0.4.10')).toBe(0);
  });

  it('handles different length versions', () => {
    expect(compareVersions('1', '1.0.0')).toBe(0);
  });

  it('returns -1 when version length differs and a < b', () => {
    expect(compareVersions('1.0', '1.0.1')).toBe(-1);
  });

  it('returns 1 when version length differs and a > b', () => {
    expect(compareVersions('1.0.1', '1.0')).toBe(1);
  });
});
