import { formatDurationMs, formatDurationSec } from '../formatDuration';

describe('formatDurationMs', () => {
  it('formats zero', () => {
    expect(formatDurationMs(0)).toBe('0:00');
  });
  it('formats negative', () => {
    expect(formatDurationMs(-100)).toBe('0:00');
  });
  it('formats seconds only', () => {
    expect(formatDurationMs(5000)).toBe('00:05'); // 5000ms = 5s
  });
  it('formats minutes and seconds', () => {
    expect(formatDurationMs(65000)).toBe('01:05'); // 65000ms = 1m5s
  });
  it('formats hours', () => {
    expect(formatDurationMs(3661000)).toBe('01:01:01'); // 3661000ms = 1h1m1s
  });
  it('handles Infinity', () => {
    expect(formatDurationMs(Infinity)).toBe('0:00');
  });
});

describe('formatDurationSec', () => {
  it('formats zero', () => {
    expect(formatDurationSec(0)).toBe('0:00');
  });
  it('formats seconds only', () => {
    expect(formatDurationSec(5)).toBe('00:05');
  });
  it('formats minutes and seconds', () => {
    expect(formatDurationSec(65)).toBe('01:05');
  });
  it('formats hours', () => {
    expect(formatDurationSec(3661)).toBe('01:01:01');
  });
  it('handles negative', () => {
    expect(formatDurationSec(-10)).toBe('0:00');
  });
});
