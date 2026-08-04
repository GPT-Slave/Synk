import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApplication } from './configure-application';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  configureApplication(app, config);
  await app.listen(config.get<number>('PORT') ?? 4000);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
