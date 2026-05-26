/**
 * Formats an IP address input string as the user types.
 *
 * Rules:
 * - Replaces commas with dots (common on number-pad keyboards)
 * - Removes any non-numeric and non-dot characters
 * - Splits long digit groups into segments of max 3 digits
 * - Limits to 4 segments (IPv4)
 * - Auto-inserts a dot after a 3-digit segment while typing (not deleting)
 * - Preserves manually typed trailing dots
 *
 * @param text - Current raw input text
 * @param prevIp - Previous IP value (to detect deletion vs typing)
 * @returns Formatted IP string
 */
export function formatIpInput(text: string, prevIp: string): string {
  const isDeleting = text.length < prevIp.length;
  let clean = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const endsWithDot = clean.endsWith('.');
  const rawSegments = clean.split('.');

  // Split long digit groups into segments of max 3
  const processed: string[] = [];
  for (const segment of rawSegments) {
    if (segment === '') continue;
    for (let i = 0; i < segment.length; i += 3) {
      if (processed.length >= 4) break;
      processed.push(segment.slice(i, i + 3));
    }
    if (processed.length >= 4) break;
  }

  const final = processed.slice(0, 4);
  let result = final.join('.');

  // Auto-add dot after a 3-digit segment (only when typing, not deleting)
  if (!isDeleting && !endsWithDot && final.length < 4) {
    const last = final[final.length - 1];
    if (last && last.length === 3) {
      result += '.';
    }
  }

  // Preserve manually typed trailing dot (for segments < 3 digits)
  if (endsWithDot && final.length < 4) {
    result += '.';
  }

  return result;
}
