export abstract class LLMService {
  abstract complete(systemPrompt: string, userPrompt: string): Promise<string>;
}
