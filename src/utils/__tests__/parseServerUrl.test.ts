import { parseServerUrl } from '../parseServerUrl';

describe('parseServerUrl', () => {
  it('parses full URL with http://', () => {
    expect(parseServerUrl('http://192.168.1.1:9001')).toEqual({ host: '192.168.1.1', port: '9001' });
  });
  it('parses host and port without protocol', () => {
    expect(parseServerUrl('example.com:9001')).toEqual({ host: 'example.com', port: '9001' });
  });
  it('uses default port when missing', () => {
    expect(parseServerUrl('http://example.com')).toEqual({ host: 'example.com', port: '9001' });
  });
  it('handles https:// protocol', () => {
    expect(parseServerUrl('https://server.voidchat.com:443')).toEqual({ host: 'server.voidchat.com', port: '443' });
  });
  it('handles IP without port', () => {
    expect(parseServerUrl('10.0.2.2')).toEqual({ host: '10.0.2.2', port: '9001' });
  });
});
