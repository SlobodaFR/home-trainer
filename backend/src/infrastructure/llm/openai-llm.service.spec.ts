import { ConfigService } from '@nestjs/config';
import { OpenAILLMService } from './openai-llm.service';

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
