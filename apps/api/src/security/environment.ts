export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  if (environment.NODE_ENV !== 'production') return environment;

  requireProductionSecret(environment, 'JWT_SECRET');
  requireProductionSecret(environment, 'JWT_REFRESH_SECRET');
  if (environment.CSRF_SECRET !== undefined) {
    requireProductionSecret(environment, 'CSRF_SECRET');
  }
  if (
    typeof environment.CORS_ORIGIN !== 'string' ||
    !environment.CORS_ORIGIN.trim()
  ) {
    throw new Error('CORS_ORIGIN is required in production.');
  }
  for (const origin of environment.CORS_ORIGIN.split(',').map((value) =>
    value.trim(),
  )) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('CORS_ORIGIN must contain exact HTTPS origins.');
    }
    if (parsed.protocol !== 'https:' || parsed.origin !== origin) {
      throw new Error('CORS_ORIGIN must contain exact HTTPS origins.');
    }
  }
  return environment;
}

function requireProductionSecret(
  environment: Record<string, unknown>,
  name: string,
): void {
  const value = environment[name];
  if (
    typeof value !== 'string' ||
    value.length < 32 ||
    /change[-_ ]?me/i.test(value)
  ) {
    throw new Error(
      `${name} must be a unique secret of at least 32 characters.`,
    );
  }
}
