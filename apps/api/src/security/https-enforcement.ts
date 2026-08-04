import type { RequestHandler } from 'express';

export function httpsEnforcement(options: {
  enabled: boolean;
  trustProxy: boolean;
}): RequestHandler {
  return (request, response, next) => {
    if (
      !options.enabled ||
      request.secure ||
      (options.trustProxy &&
        forwardedHttps(request.headers['x-forwarded-proto']))
    ) {
      next();
      return;
    }
    response.status(426).setHeader('Upgrade', 'TLS/1.2, HTTP/1.1').json({
      statusCode: 426,
      message: 'HTTPS is required.',
    });
  };
}

function forwardedHttps(value: string | string[] | undefined): boolean {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.split(',')[0]?.trim().toLowerCase() === 'https';
}
