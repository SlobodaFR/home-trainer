import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { applySecurityHeaders } from './interfaces/http/security-headers';
import { applyTrustProxy } from './interfaces/http/throttling';
import { setupSwagger } from './interfaces/http/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Keeps the exact bytes of JSON bodies: the logout webhook signature is computed over them.
    rawBody: true,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // Lets providers clean up on SIGTERM (runtime health monitor, OpenFeature client).
  app.enableShutdownHooks();
  // First middleware: every response (API, SPA files, /api/docs) gets the security headers.
  applySecurityHeaders(app, { authBaseUrl: process.env.AUTH_SERVICE_URL });
  applyTrustProxy(app, process.env.TRUST_PROXY_HOPS);
  app.setGlobalPrefix('api', { exclude: ['healthz'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });

  setupSwagger(app, process.env.NODE_ENV);

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

void bootstrap();
