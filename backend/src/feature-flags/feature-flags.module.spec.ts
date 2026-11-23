import { Test } from '@nestjs/testing';
import { FeatureFlags } from '../domain/shared/feature-flags';
import { FeatureFlagsModule } from './feature-flags.module';

describe('FeatureFlagsModule', () => {
  const PIN = 'FEATURES_PIN_WIRING_SPEC_FLAG';

  afterEach(() => {
    delete process.env[PIN];
  });

  it('provides the FeatureFlags port, built from the process environment', async () => {
    process.env[PIN] = 'true';
    const module = await Test.createTestingModule({
      imports: [FeatureFlagsModule],
    }).compile();

    const flags = module.get(FeatureFlags);
    expect(await flags.isEnabled('wiring-spec-flag', false)).toBe(true);
    expect(await flags.isEnabled('another-flag', false)).toBe(false);
    await module.close();
  });

  it('is global: other modules inject the port without importing the module', async () => {
    const { Injectable, Module } = await import('@nestjs/common');

    @Injectable()
    class Consumer {
      constructor(readonly flags: FeatureFlags) {}
    }
    @Module({ providers: [Consumer], exports: [Consumer] })
    class ConsumerModule {}

    const module = await Test.createTestingModule({
      imports: [FeatureFlagsModule, ConsumerModule],
    }).compile();
    expect(module.get(Consumer).flags).toBeInstanceOf(FeatureFlags);
    await module.close();
  });
});
