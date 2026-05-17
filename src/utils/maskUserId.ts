export function maskUserId(id: string): string {
  const visible = id.slice(-4);
  return `****${visible}`;
}
