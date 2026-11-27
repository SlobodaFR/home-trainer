import { ConfigService } from '@nestjs/config';
import {
  createPostHogTelemetry,
  PostHogClient,
  PostHogTelemetry,
} from './posthog-telemetry';

type CaptureMessage = Parameters<PostHogClient['capture']>[0];

class FakeClient implements PostHogClient {
  readonly captured: CaptureMessage[] = [];
  shutdownTimeouts: (number | undefined)[] = [];
  failing = false;

  capture(message: CaptureMessage): void {
    if (this.failing) {
      throw new Error('network');
    }
    this.captured.push(message);
  }

  async shutdown(timeoutMs?: number): Promise<void> {
    this.shutdownTimeouts.push(timeoutMs);
    return Promise.resolve();
  }
}

const requestEvent = {
  name: 'http_request',
  properties: {
    route: '/api/exercises/:id',
    method: 'GET',
    status: 200,
    duration_ms: 12,
  },
} as const;

describe('PostHogTelemetry', () => {
  it('is disabled without POSTHOG_API_KEY: no client is created and capture does not throw', () => {
    const factory =
      vi.fn<(apiKey: string, options: unknown) => PostHogClient>();

    const telemetry = createPostHogTelemetry(new ConfigService({}), factory);

    expect(() => {
      telemetry.capture(requestEvent);
    }).not.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });

  it('does not throw on shutdown when disabled', async () => {
    const telemetry = createPostHogTelemetry(new ConfigService({}));

    await expect(telemetry.onApplicationShutdown()).resolves.toBeUndefined();
  });

  it('treats a blank key (empty 1Password field) as absent', () => {
    const factory =
      vi.fn<(apiKey: string, options: unknown) => PostHogClient>();

    createPostHogTelemetry(new ConfigService({ POSTHOG_API_KEY: '' }), factory);

    expect(factory).not.toHaveBeenCalled();
  });

  it('creates an EU, geoip-free client with the batching options when a key is set', () => {
    const factory = vi
      .fn<(apiKey: string, options: unknown) => PostHogClient>()
      .mockReturnValue(new FakeClient());

    createPostHogTelemetry(
      new ConfigService({ POSTHOG_API_KEY: 'phc_test' }),
      factory,
    );

    expect(factory).toHaveBeenCalledWith('phc_test', {
      host: 'https://eu.i.posthog.com',
      disableGeoip: true,
      flushAt: 20,
      flushInterval: 10_000,
    });
  });

  it('honours POSTHOG_HOST', () => {
    const factory = vi
      .fn<(apiKey: string, options: unknown) => PostHogClient>()
      .mockReturnValue(new FakeClient());

    createPostHogTelemetry(
      new ConfigService({
        POSTHOG_API_KEY: 'phc_test',
        POSTHOG_HOST: 'https://us.i.posthog.com',
      }),
      factory,
    );

    expect(factory).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ host: 'https://us.i.posthog.com' }),
    );
  });

  it('sends an anonymous event: random id, no person profile, service name, no IP', () => {
    const client = new FakeClient();
    const telemetry = new PostHogTelemetry(client);

    telemetry.capture(requestEvent);
    telemetry.capture(requestEvent);

    const [first, second] = client.captured;
    expect(first.distinctId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.distinctId).not.toBe(second.distinctId);
    expect(first).toEqual({
      distinctId: first.distinctId,
      event: 'http_request',
      properties: {
        route: '/api/exercises/:id',
        method: 'GET',
        status: 200,
        duration_ms: 12,
        service: 'home-trainer',
        version: 'dev',
        $ip: null,
        $process_person_profile: false,
      },
      disableGeoip: true,
    });
  });

  it('adds the release version (APP_VERSION) to every ops event', () => {
    vi.stubEnv('APP_VERSION', '2.5.1');
    const client = new FakeClient();
    const telemetry = new PostHogTelemetry(client);

    telemetry.capture(requestEvent);
    telemetry.capture(requestEvent);

    expect(client.captured.map((c) => c.properties['version'])).toEqual([
      '2.5.1',
      '2.5.1',
    ]);
    vi.unstubAllEnvs();
  });

  it('drops properties that look like personal data', () => {
    const client = new FakeClient();

    new PostHogTelemetry(client).capture({
      name: 'http_request',
      properties: { ...requestEvent.properties, route: 'alice@example.com' },
    });

    expect(client.captured[0].properties).not.toHaveProperty('route');
    expect(JSON.stringify(client.captured)).not.toContain('alice');
  });

  it('never throws into the caller', () => {
    const client = new FakeClient();
    client.failing = true;

    expect(() => {
      new PostHogTelemetry(client).capture(requestEvent);
    }).not.toThrow();
  });

  it('flushes on application shutdown, bounded to 5 s (under the 10 s Docker stop timeout)', async () => {
    const client = new FakeClient();

    await new PostHogTelemetry(client).onApplicationShutdown();

    expect(client.shutdownTimeouts).toEqual([5000]);
  });
});
