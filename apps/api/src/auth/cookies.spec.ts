import { readCookie } from './cookies';

describe('readCookie', () => {
  it('reads an encoded cookie without confusing neighboring names', () => {
    expect(
      readCookie(
        'synk_access_old=no; synk_access=hello%20world',
        'synk_access',
      ),
    ).toBe('hello world');
  });

  it('treats malformed percent encoding as a missing cookie', () => {
    expect(readCookie('synk_access=%E0%A4%A', 'synk_access')).toBeUndefined();
  });
});
