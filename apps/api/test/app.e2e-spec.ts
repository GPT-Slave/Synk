import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApplication } from './../src/configure-application';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      logger: false,
    });
    configureApplication(
      app as unknown as NestExpressApplication,
      app.get(ConfigService),
    );
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('cache-control', 'no-store')
      .expect('content-security-policy', /default-src 'none'/)
      .expect('cross-origin-resource-policy', 'same-site')
      .expect('x-content-type-options', 'nosniff')
      .expect('x-frame-options', 'DENY')
      .expect('Hello World!');
  });

  it('issues a signed double-submit CSRF cookie', () => {
    return request(app.getHttpServer())
      .get('/auth/csrf')
      .expect(200)
      .expect('cache-control', 'no-store')
      .expect('set-cookie', /synk_csrf=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)
      .expect((response) => {
        const body: unknown = response.body;
        if (
          !body ||
          typeof body !== 'object' ||
          !('token' in body) ||
          typeof body.token !== 'string'
        ) {
          throw new Error('CSRF response did not contain a token.');
        }
        expect(body.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      });
  });

  it('blocks state-changing requests without a CSRF token', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'person@example.com', password: 'valid-password' })
      .expect(403)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'CSRF_INVALID' });
      });
  });

  it('rejects request bodies larger than 128 KiB', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `${'a'.repeat(132_000)}@example.com`, password: 'x' })
      .expect(413);
  });

  afterEach(async () => {
    await app.close();
  });
});
