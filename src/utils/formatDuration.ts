/**
 * Formats a duration in milliseconds to a string like "MM:SS" or "HH:MM:SS".
 * For durations >= 1 hour, includes hours prefix.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "05:30" or "01:15:30")
 */
export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  return formatDurationSec(totalSeconds);
}

/**
 * Formats a duration in seconds to a string like "MM:SS" or "HH:MM:SS".
 * For durations >= 1 hour, includes hours prefix.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "05:30" or "01:15:30")
 */
export function formatDurationSec(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const sec = Math.floor(seconds);
  if (sec === 0) return '0:00';
  const minutes = Math.floor(sec / 60);
  const secs = sec % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(remainingMinutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
