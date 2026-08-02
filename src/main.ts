import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  // Railway (and any PaaS) puts the app behind a proxy. Without this, every
  // request looks like it comes from the proxy IP and ThrottlerGuard would
  // rate-limit all users as a single bucket.
  if (isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(helmet());
  app.setGlobalPrefix('api/v1');

  // A native mobile client sends no Origin header, so CORS is irrelevant to
  // it — the allowlist exists for the browser build. Unset in dev = allow all.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : !isProduction,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger documents every endpoint and payload shape, so it stays off in
  // production unless SWAGGER_ENABLED is explicitly set.
  const swaggerEnabled =
    process.env.SWAGGER_ENABLED === 'true' || !isProduction;
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Apsara Wallet API')
      .setDescription('Backend for the Apsara Wallet mobile app')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  // Let in-flight requests finish when the platform sends SIGTERM on redeploy.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(
    `Apsara Wallet API listening on :${port}` +
      (swaggerEnabled ? ' (docs at /docs)' : ''),
  );
}

void bootstrap();
