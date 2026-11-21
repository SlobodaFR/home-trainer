import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMService } from '../../domain/analysis/llm.service';

interface OpenAIErrorBody {
  error?: { type?: unknown; code?: unknown };
}

/**
 * Status plus the parsed error type/code only: OpenAI's 401 bodies echo the (masked) API key
 * and others may echo prompt fragments, so the raw body never goes into an error message.
 */
function describeError(status: number, body: string): string {
  const base = `OpenAI error ${String(status)}`;
  try {
    const { error } = JSON.parse(body) as OpenAIErrorBody;
    const labels = [error?.type, error?.code].filter(
      (label): label is string =>
        typeof label === 'string' && /^[a-z0-9_.-]{1,64}$/i.test(label),
    );
    return labels.length > 0 ? `${base} (${labels.join('/')})` : base;
  } catch {
    return base;
  }
}

interface OpenAIResponse {
  choices: { message: { content: string } }[];
}

@Injectable()
export class OpenAILLMService extends LLMService {
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '');
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(describeError(res.status, await res.text()));
    }

    const data = (await res.json()) as OpenAIResponse;
    const content = data.choices[0]?.message.content;
    if (!content) throw new Error('OpenAI returned empty content');
    return content;
  }
}
