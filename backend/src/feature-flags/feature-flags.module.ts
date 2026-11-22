import { Global, Module } from '@nestjs/common';
import { FeatureFlags } from '../domain/shared/feature-flags';
import { createFeatureFlags } from '../infrastructure/feature-flags/openfeature-feature-flags';

/** Feature flags served by home-features (OFREP), injectable anywhere through the port. */
@Global()
@Module({
  providers: [
    {
      provide: FeatureFlags,
      useFactory: () => createFeatureFlags(process.env),
    },
  ],
  exports: [FeatureFlags],
})
export class FeatureFlagsModule {}
