import { formatIpInput } from '../formatIpInput';

describe('formatIpInput', () => {
  it('passes through a clean IP', () => {
    expect(formatIpInput('192.168.1.1', '192.168.1.1')).toBe('192.168.1.1');
  });

  it('replaces commas with dots', () => {
    expect(formatIpInput('192,168,1,1', '')).toBe('192.168.1.1');
  });

  it('removes non-numeric characters', () => {
    // 'a' is removed and trailing dot is preserved
    expect(formatIpInput('192.168.1.a', '192.168.1.')).toBe('192.168.1.');
  });

  it('splits long digit groups into 3-digit segments', () => {
    expect(formatIpInput('19216811', '')).toBe('192.168.11');
  });

  it('limits to 4 segments', () => {
    expect(formatIpInput('1.2.3.4.5', '1.2.3.4.')).toBe('1.2.3.4');
  });

  it('auto-adds dot after 3 digits when typing', () => {
    expect(formatIpInput('192', '19')).toBe('192.');
  });

  it('does not auto-add dot when deleting', () => {
    expect(formatIpInput('19', '192')).toBe('19');
  });

  it('preserves manually typed trailing dot', () => {
    expect(formatIpInput('192.', '192')).toBe('192.');
  });

  it('handles empty input', () => {
    expect(formatIpInput('', '192.168.1.1')).toBe('');
  });

  it('handles partial input with dots', () => {
    expect(formatIpInput('10.0.', '10.0')).toBe('10.0.');
  });

  it('processes mixed comma-dot separator', () => {
    expect(formatIpInput('10,0.2,2', '')).toBe('10.0.2.2');
  });
});
