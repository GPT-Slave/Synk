import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  const valid = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    CSRF_SECRET: 'c'.repeat(32),
    CORS_ORIGIN: 'https://synk.example',
  };

  it('accepts complete production security configuration', () => {
    expect(validateEnvironment(valid)).toBe(valid);
  });

  it.each([
    ['JWT_SECRET', 'short'],
    ['JWT_REFRESH_SECRET', 'change-me-change-me-change-me-change-me'],
    ['CSRF_SECRET', 'short'],
    ['CORS_ORIGIN', ''],
    ['CORS_ORIGIN', '*'],
    ['CORS_ORIGIN', 'http://synk.example'],
  ])('fails closed for an unsafe %s', (name, value) => {
    expect(() => validateEnvironment({ ...valid, [name]: value })).toThrow();
  });

  it('does not block local development defaults', () => {
    const development = { NODE_ENV: 'development' };
    expect(validateEnvironment(development)).toBe(development);
  });
});
