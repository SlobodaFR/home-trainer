import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** API documentation on /api/docs, outside production only: it maps the whole attack surface. */
export function setupSwagger(
  app: INestApplication,
  nodeEnv: string | undefined,
): void {
  if (nodeEnv === 'production') {
    return;
  }
  const config = new DocumentBuilder()
    .setTitle('Trainer API')
    .setDescription(
      'Strength & mobility training — goal-driven planning, session execution, LLM progress analysis',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, config),
  );
}
