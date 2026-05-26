/**
 * Formats a timestamp (milliseconds since epoch) to a localized time string.
 * Uses 24-hour format by default.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string (e.g., "14:30" or "02:30 PM" depending on locale)
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
