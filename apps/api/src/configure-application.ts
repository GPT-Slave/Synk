import { ValidationPipe } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { httpsEnforcement } from './security/https-enforcement';

export function configureApplication(
  app: NestExpressApplication,
  config: ConfigService,
): void {
  const production = config.get<string>('NODE_ENV') === 'production';
  const corsOrigins = (
    config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const trustProxy = config.get<string>('TRUST_PROXY') === 'true';

  app.set('trust proxy', trustProxy ? 1 : false);
  app.use(
    httpsEnforcement({
      enabled: production,
      trustProxy,
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      frameguard: { action: 'deny' },
      hsts: production
        ? { maxAge: 63_072_000, includeSubDomains: true, preload: true }
        : false,
    }),
  );
  app.use(json({ limit: '128kb', strict: true }));
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Participant-Session'],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableShutdownHooks();
}
