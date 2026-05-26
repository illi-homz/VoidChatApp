/**
 * Parses a server URL into host and port components.
 * Strips protocol prefix (http://, https://) and extracts host and port.
 *
 * @param url - Server URL (e.g., "http://192.168.1.1:9001" or "example.com:9001")
 * @returns Object with host and port
 */
export function parseServerUrl(url: string): { host: string; port: string } {
  const clean = url.replace(/^https?:\/\//, '');
  const parts = clean.split(':');
  return { host: parts[0], port: parts[1] || '9001' };
}
