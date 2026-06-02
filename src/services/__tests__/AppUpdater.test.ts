jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: { CacheDir: '/cache' },
    ls: jest.fn(() => Promise.resolve([])),
    unlink: jest.fn(() => Promise.resolve()),
  },
  config: jest.fn(() => ({
    fetch: jest.fn(() => Promise.resolve({ path: () => '/tmp/test.apk' })),
  })),
  android: { actionViewIntent: jest.fn() },
}));

import { Platform } from 'react-native';
import { parseGithubTag, compareVersions, downloadLatestApk } from '../AppUpdater';

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

const mockFetch = (status: number, body: any) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
};

const successBody = {
  tag_name: 'v1.5.0',
  assets: [
    { name: 'VoidChatApp-v1.5.0.apk', browser_download_url: 'https://github.com/illi-homz/VoidChatApp/releases/download/v1.5.0/app.apk' },
  ],
};

describe('downloadLatestApk', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('скачивает APK при успешном ответе GitHub API', async () => {
    mockFetch(200, successBody);
    await expect(downloadLatestApk()).resolves.not.toThrow();
  });

  it('бросает ошибку если APK не найден в assets', async () => {
    mockFetch(200, { tag_name: 'v1.5.0', assets: [] });
    await expect(downloadLatestApk()).rejects.toThrow('APK не найден в последнем релизе на GitHub');
  });

  it('бросает ошибку при 403 (rate limit)', async () => {
    mockFetch(403, { message: 'API rate limit exceeded' });
    await expect(downloadLatestApk()).rejects.toThrow('Превышен лимит запросов к GitHub');
  });

  it('бросает ошибку при 429 (rate limit)', async () => {
    mockFetch(429, { message: 'Too many requests' });
    await expect(downloadLatestApk()).rejects.toThrow('Превышен лимит запросов к GitHub');
  });

  it('бросает ошибку при 500', async () => {
    mockFetch(500, { message: 'Internal Server Error' });
    await expect(downloadLatestApk()).rejects.toThrow('GitHub API error: 500');
  });

  it('бросает ошибку если в ответе нет tag_name и APK отсутствует', async () => {
    mockFetch(200, { assets: [] });
    await expect(downloadLatestApk()).rejects.toThrow('APK не найден в последнем релизе на GitHub');
  });

  it('удаляет старые APK из кэша, сохраняя текущий', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');

    const ReactNativeBlobUtil = require('react-native-blob-util');
    const lsMock = ReactNativeBlobUtil.fs.ls;
    const unlinkMock = ReactNativeBlobUtil.fs.unlink;

    // В кэше есть старый APK + какой-то другой файл
    lsMock.mockResolvedValue([
      'VoidChatApp-v1.4.0.apk',
      'VoidChatApp-v1.3.0.apk',
      'some_other_file.tmp',
    ]);

    mockFetch(200, successBody);
    await downloadLatestApk();

    // ls вызван с CacheDir
    expect(lsMock).toHaveBeenCalledWith('/cache');

    // Удалены только старые APK (2 штуки), не текущий
    expect(unlinkMock).toHaveBeenCalledTimes(2);
    expect(unlinkMock).toHaveBeenCalledWith('/cache/VoidChatApp-v1.4.0.apk');
    expect(unlinkMock).toHaveBeenCalledWith('/cache/VoidChatApp-v1.3.0.apk');

    // Файл some_other_file.tmp не тронут
    expect(unlinkMock).not.toHaveBeenCalledWith('/cache/some_other_file.tmp');

    // Текущий APK (VoidChatApp-v1.5.0.apk) не удалён
    expect(unlinkMock).not.toHaveBeenCalledWith('/cache/VoidChatApp-v1.5.0.apk');
  });
});
