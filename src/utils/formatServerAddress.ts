/**
 * Cleans and formats a server address input:
 * - Strips http:// or https:// prefixes
 * - Removes port and path components (everything after / or :)
 * - Removes invalid characters (only allows alphanumeric, dots, and hyphens)
 *
 * @param text - Raw server address input
 * @returns Cleaned hostname or IP address
 */
export function formatServerAddress(text: string): string {
  // Убираем http:// или https://
  let clean = text.replace(/^https?:\/\//, '');
  // Убираем порт и путь (всё после / или :)
  clean = clean.split(/[/:]/)[0];
  // Убираем только недопустимые символы (оставляем буквы, цифры, точки, дефисы)
  clean = clean.replace(/[^a-zA-Z0-9.-]/g, '');
  return clean;
}
