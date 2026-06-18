import { NativeModules, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { version as currentVersion } from '../../package.json';

const GITHUB_API = 'https://api.github.com/repos/illi-homz/VoidChatApp/releases/latest';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string;
  downloadUrl: string | null;
}

/**
 * Убирает префикс 'v' из тега GitHub-релиза.
 */
export function parseGithubTag(tag: string): string {
  return tag.replace(/^v/, '');
}

/**
 * Семантическое сравнение двух версий (major.minor.patch).
 * Возвращает -1 если a < b, 0 если a === b, 1 если a > b.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * Проверяет наличие обновления на GitHub.
 * Сверяет текущую версию с последним релизом.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const response = await fetch(GITHUB_API, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'VoidChatApp',
    },
  });

  if (response.status === 403 || response.status === 429) {
    throw new Error('Превышен лимит запросов к GitHub. Попробуйте позже.');
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data: any = await response.json();
  const latestVersion = parseGithubTag(data.tag_name || '');

  if (!latestVersion) {
    return {
      hasUpdate: false,
      latestVersion: currentVersion,
      downloadUrl: null,
    };
  }

  const hasUpdate = compareVersions(latestVersion, currentVersion) === 1;

  // Ищем APK-файл среди assets релиза
  const assets: any[] = data.assets || [];
  const apkAsset = assets.find(
    (a: any) => a.name && a.name.endsWith('.apk') && a.browser_download_url,
  );

  return {
    hasUpdate,
    latestVersion,
    downloadUrl: apkAsset?.browser_download_url || null,
  };
}

/**
 * Скачивает последний APK с GitHub без проверки версии.
 * Если APK найден — сразу скачивает и запускает установку.
 */
export async function downloadLatestApk(): Promise<void> {
  const response = await fetch(GITHUB_API, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'VoidChatApp',
    },
  });

  if (response.status === 403 || response.status === 429) {
    throw new Error('Превышен лимит запросов к GitHub. Попробуйте позже.');
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data: any = await response.json();
  const tag = parseGithubTag(data.tag_name || '');
  const assets: any[] = data.assets || [];
  const apkAsset = assets.find(
    (a: any) => a.name && a.name.endsWith('.apk') && a.browser_download_url,
  );

  if (!apkAsset) {
    throw new Error('APK не найден в последнем релизе на GitHub');
  }

  const fileName = `VoidChatApp-v${tag}.apk`;
  await downloadAndInstall(apkAsset.browser_download_url, fileName);
}

/**
 * Скачивает APK из указанного URL и запускает установку.
 */
export async function downloadAndInstall(downloadUrl: string, fileName: string): Promise<void> {
  const downloadDir = ReactNativeBlobUtil.fs.dirs.CacheDir;
  const filePath = `${downloadDir}/${fileName}`;

  const res = await ReactNativeBlobUtil.config({
    path: filePath,
    fileCache: true,
    timeout: 120000,
    overwrite: true,
  }).fetch('GET', downloadUrl, {
    Accept: 'application/octet-stream',
    'User-Agent': 'VoidChatApp',
  });

  if (Platform.OS === 'android') {
    const { InstallApk } = NativeModules;
    if (InstallApk) {
      await InstallApk.installApk(res.path());
    } else {
      // Fallback на старый метод, если модуль вдруг не загрузился
      await ReactNativeBlobUtil.android.actionViewIntent(
        res.path(),
        'application/vnd.android.package-archive',
        'Установка приложения',
      );
    }

    // Cleanup: best-effort удаление старых APK из кэша.
    // Текущий файл (fileName) не удаляем — на Android 7-9 PackageInstaller
    // может читать напрямую из URI, не копируя APK.
    try {
      const cacheDir = ReactNativeBlobUtil.fs.dirs.CacheDir;
      const files = await ReactNativeBlobUtil.fs.ls(cacheDir);
      const oldApks = files.filter(
        f => f.startsWith('VoidChatApp-v') && f.endsWith('.apk') && f !== fileName,
      );
      await Promise.all(
        oldApks.map(f => ReactNativeBlobUtil.fs.unlink(`${cacheDir}/${f}`).catch(() => {})),
      );
    } catch (_e) {
      // Не критично — файлы удаляются по возможности
    }
  }
}

// ---- Cached update check ----

let _cachedUpdateResult: UpdateCheckResult | null = null;

/**
 * Проверяет наличие обновлений и кэширует результат.
 * Можно вызывать в фоне — не блокирует UI.
 */
export async function checkForUpdatesCached(): Promise<void> {
  try {
    _cachedUpdateResult = await checkForUpdates();
  } catch {
    // Не фатально — при следующем вызове перепроверится
    _cachedUpdateResult = null;
  }
}

/**
 * Возвращает закэшированный результат проверки обновлений.
 * null — проверка ещё не выполнялась.
 */
export function getCachedUpdateResult(): UpdateCheckResult | null {
  return _cachedUpdateResult;
}

/**
 * Есть ли обновление по данным кэша?
 */
export function hasPendingUpdate(): boolean {
  return _cachedUpdateResult?.hasUpdate === true;
}
