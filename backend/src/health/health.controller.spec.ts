import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
const mockRes = { status: mockStatus, json: mockJson } as unknown as Response;

describe('HealthController', () => {
  let controller: HealthController;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DataSource, useValue: dataSource }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
    mockStatus.mockReturnValue({ json: mockJson });
  });

  it('returns 200 with db:ok when DB is reachable', async () => {
    dataSource.query.mockResolvedValue([]);

    await controller.check(mockRes);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.OK);
    expect(mockJson).toHaveBeenCalledWith({ status: 'ok', db: 'ok' });
  });

  it('returns 503 with db:error when DB query throws', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));

    await controller.check(mockRes);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(mockJson).toHaveBeenCalledWith({ status: 'ok', db: 'error' });
  });
});
