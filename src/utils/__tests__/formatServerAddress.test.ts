import { formatServerAddress } from '../formatServerAddress';

describe('formatServerAddress', () => {
  it('strips http://', () => {
    expect(formatServerAddress('http://192.168.1.1')).toBe('192.168.1.1');
  });
  it('strips https://', () => {
    expect(formatServerAddress('https://example.com')).toBe('example.com');
  });
  it('removes port', () => {
    expect(formatServerAddress('192.168.1.1:9001')).toBe('192.168.1.1');
  });
  it('removes path', () => {
    expect(formatServerAddress('example.com/path')).toBe('example.com');
  });
  it('removes invalid characters', () => {
    expect(formatServerAddress('exam ple.com!@#')).toBe('example.com');
  });
  it('handles clean input', () => {
    expect(formatServerAddress('void4217.com')).toBe('void4217.com');
  });
});
