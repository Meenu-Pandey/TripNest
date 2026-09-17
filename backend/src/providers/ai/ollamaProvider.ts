import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import type {
  IOllamaProvider,
  OllamaGenerateOptions,
  OllamaGenerateResult,
  OllamaHealthResult,
} from './ollamaProvider.interface';

export class OllamaUnavailableError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'OllamaUnavailableError';
  }
}

export class OllamaGenerationError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'OllamaGenerationError';
  }
}

interface OllamaTagsResponse {
  models?: { name: string }[];
}

interface OllamaGenerateApiResponse {
  response?: string;
  done?: boolean;
  total_duration?: number;
  error?: string;
}

export class OllamaProvider implements IOllamaProvider {
  readonly baseUrl: string;
  readonly defaultModel: string;
  private readonly healthTimeoutMs: number;
  private readonly generateTimeoutMs: number;

  constructor(
    baseUrl = env.OLLAMA_BASE_URL,
    defaultModel = env.OLLAMA_MODEL,
    healthTimeoutMs = 2500,
    generateTimeoutMs = 60000,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultModel = defaultModel;
    this.healthTimeoutMs = healthTimeoutMs;
    this.generateTimeoutMs = generateTimeoutMs;
  }

  async checkHealth(): Promise<OllamaHealthResult> {
    const url = `${this.baseUrl}/api/tags`;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.healthTimeoutMs),
      });

      if (!response.ok) {
        return {
          available: false,
          models: [],
          defaultModelAvailable: false,
          defaultModel: this.defaultModel,
          error: `Ollama returned HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = (await response.json()) as OllamaTagsResponse;
      const models = Array.isArray(data.models) ? data.models.map((m) => m.name) : [];
      const defaultModelAvailable = models.some(
        (m) => m === this.defaultModel || m.startsWith(`${this.defaultModel}:`),
      );

      return {
        available: true,
        models,
        defaultModelAvailable,
        defaultModel: this.defaultModel,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown connection error';
      logger.debug({ err, url }, 'Ollama health check failed');
      return {
        available: false,
        models: [],
        defaultModelAvailable: false,
        defaultModel: this.defaultModel,
        error: message,
      };
    }
  }

  async generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    options?: OllamaGenerateOptions,
  ): Promise<OllamaGenerateResult> {
    const url = `${this.baseUrl}/api/generate`;
    const timeoutMs = options?.timeoutMs ?? this.generateTimeoutMs;
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          system: systemPrompt,
          prompt: userPrompt,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.4,
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new OllamaGenerationError(
          `Ollama generate failed with HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const data = (await response.json()) as OllamaGenerateApiResponse;
      if (data.error) {
        throw new OllamaGenerationError(`Ollama error: ${data.error}`);
      }

      if (typeof data.response !== 'string') {
        throw new OllamaGenerationError('Ollama response did not contain text output');
      }

      const totalDurationMs = Date.now() - startTime;
      return {
        response: data.response,
        totalDurationMs,
      };
    } catch (err) {
      if (err instanceof OllamaGenerationError) {
        throw err;
      }

      const message = err instanceof Error ? err.message : 'Failed to connect to Ollama';
      logger.warn({ err, url }, 'Ollama completion generation failed');
      throw new OllamaUnavailableError(`Ollama is unreachable or timed out: ${message}`, err);
    }
  }
}
