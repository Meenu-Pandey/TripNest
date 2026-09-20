import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import {
  OllamaGenerationError,
  OllamaUnavailableError,
} from './ollamaProvider';
import type {
  IOllamaProvider,
  OllamaGenerateOptions,
  OllamaGenerateResult,
  OllamaHealthResult,
} from './ollamaProvider.interface';

interface OpenRouterChatResponse {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
  error?: {
    message?: string;
    code?: number | string;
  };
}

export class OpenRouterProvider implements IOllamaProvider {
  readonly apiKey: string | undefined;
  readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(
    apiKey = env.OPENROUTER_API_KEY,
    defaultModel = env.AI_MODEL,
    timeoutMs = 30000,
  ) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel || 'openrouter/free';
    this.timeoutMs = timeoutMs;
  }

  async checkHealth(): Promise<OllamaHealthResult> {
    if (!this.apiKey) {
      return {
        available: false,
        models: [],
        defaultModelAvailable: false,
        defaultModel: this.defaultModel,
        error: 'OPENROUTER_API_KEY is not configured on the server',
      };
    }

    return {
      available: true,
      models: [this.defaultModel],
      defaultModelAvailable: true,
      defaultModel: this.defaultModel,
    };
  }

  async generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    options?: OllamaGenerateOptions,
  ): Promise<OllamaGenerateResult> {
    if (!this.apiKey) {
      throw new OllamaUnavailableError('OpenRouter API key is not configured on the server');
    }

    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const timeout = options?.timeoutMs ?? this.timeoutMs;
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': env.APP_URL,
          'X-Title': 'TripNest AI Assistant',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: options?.temperature ?? 0.4,
        }),
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new OllamaGenerationError(
          `OpenRouter API failed with HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const data = (await response.json()) as OpenRouterChatResponse;
      if (data.error) {
        throw new OllamaGenerationError(`OpenRouter API error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new OllamaGenerationError('OpenRouter response did not contain text output');
      }

      const totalDurationMs = Date.now() - startTime;
      return {
        response: content,
        totalDurationMs,
      };
    } catch (err) {
      if (err instanceof OllamaGenerationError || err instanceof OllamaUnavailableError) {
        throw err;
      }

      const message = err instanceof Error ? err.message : 'Failed to connect to OpenRouter';
      logger.warn({ err, url }, 'OpenRouter completion generation failed');
      throw new OllamaUnavailableError(`OpenRouter AI service is unreachable or timed out: ${message}`, err);
    }
  }
}
