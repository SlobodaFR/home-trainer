import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SameOriginGuard } from './same-origin.guard';

@Controller('things')
@UseGuards(SameOriginGuard)
class ThingsController {
  @Get()
  list(): string[] {
    return [];
  }

  @Post()
  create(): { ok: boolean } {
    return { ok: true };
  }
}

describe('SameOriginGuard (HTTP)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ FRONTEND_URL: 'https://trainer.example.test' })],
        }),
      ],
      controllers: [ThingsController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses a cross-site mutation with 403', async () => {
    await request(app.getHttpServer())
      .post('/things')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({})
      .expect(403);
  });

  it('accepts a same-origin JSON mutation', async () => {
    await request(app.getHttpServer())
      .post('/things')
      .set('Sec-Fetch-Site', 'same-origin')
      .send({})
      .expect(201);
  });

  it('accepts a trusted Origin when Sec-Fetch-Site is absent', async () => {
    await request(app.getHttpServer())
      .post('/things')
      .set('Origin', 'https://trainer.example.test')
      .send({})
      .expect(201);
  });

  it('refuses a same-origin form post with 415', async () => {
    await request(app.getHttpServer())
      .post('/things')
      .set('Sec-Fetch-Site', 'same-origin')
      .type('form')
      .send({ a: '1' })
      .expect(415);
  });

  it('never blocks reads', async () => {
    await request(app.getHttpServer())
      .get('/things')
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(200);
  });
});
