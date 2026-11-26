import { ConfigService } from '@nestjs/config';
import { OPENAI_TIMEOUT_MS, OpenAILLMService } from './openai-llm.service';

function service(): OpenAILLMService {
  return new OpenAILLMService(
    new ConfigService({ OPENAI_API_KEY: 'sk-proj-test-key-0000WXYZ' }),
  );
}

function mockFetch(status: number, body: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(body, { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenAILLMService errors', () => {
  const body401 = JSON.stringify({
    error: {
      message:
        'Incorrect API key provided: sk-proj-********WXYZ. You can find your API key.',
      type: 'invalid_request_error',
      code: 'invalid_api_key',
    },
  });

  it('never puts the upstream body (masked API key) in the error message', async () => {
    mockFetch(401, body401);

    const error = await service()
      .complete('system', 'user')
      .catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    const { message } = error as Error;
    expect(message).not.toContain('sk-');
    expect(message).not.toContain('Incorrect API key');
    expect(message).toBe(
      'OpenAI error 401 (invalid_request_error/invalid_api_key)',
    );
  });

  it('keeps only the status when the body is not the expected JSON', async () => {
    mockFetch(502, '<html>Bad gateway sk-proj-abc alice@example.com</html>');

    const error = await service()
      .complete('system', 'user')
      .catch((e: Error) => e);

    expect((error as Error).message).toBe('OpenAI error 502');
  });

  it('returns the completion on success', async () => {
    mockFetch(
      200,
      JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
    );

    await expect(service().complete('s', 'u')).resolves.toBe('ok');
  });
});

describe('OpenAILLMService timeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborts a call that never answers and rejects with a clear error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
      ),
    );

    const outcome = service()
      .complete('s', 'u')
      .catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(OPENAI_TIMEOUT_MS + 1);

    const error = await outcome;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('OpenAI request timed out');
  });

  it('covers the body read: a body that stalls after the headers is aborted', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        const body = new ReadableStream({
          start(controller) {
            init.signal?.addEventListener('abort', () =>
              controller.error(new DOMException('aborted', 'AbortError')),
            );
          },
        });
        return Promise.resolve(new Response(body, { status: 200 }));
      }),
    );

    const outcome = service()
      .complete('s', 'u')
      .catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(OPENAI_TIMEOUT_MS + 1);

    expect(((await outcome) as Error).message).toBe('OpenAI request timed out');
  });

  it('clears the timer once the call is over, on success and on failure', async () => {
    vi.useFakeTimers();
    mockFetch(
      200,
      JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
    );
    await service().complete('s', 'u');
    expect(vi.getTimerCount()).toBe(0);

    mockFetch(500, '{}');
    await service()
      .complete('s', 'u')
      .catch(() => undefined);
    expect(vi.getTimerCount()).toBe(0);
  });
});
