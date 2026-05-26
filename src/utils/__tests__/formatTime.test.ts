import { formatTime } from '../formatTime';

describe('formatTime', () => {
  it('formats a known timestamp', () => {
    // Jan 1, 2024 14:30:00 — local time (toLocaleTimeString depends on timezone)
    const ts = new Date(2024, 0, 1, 14, 30, 0).getTime();
    const result = formatTime(ts);
    expect(result).toContain('14');
    expect(result).toContain('30');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('formats midnight', () => {
    const ts = new Date(2024, 0, 1, 0, 0, 0).getTime();
    const result = formatTime(ts);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('formats with hours < 10', () => {
    const ts = new Date(2024, 0, 1, 8, 5, 0).getTime();
    const result = formatTime(ts);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
    expect(result).toContain('05');
  });
});
