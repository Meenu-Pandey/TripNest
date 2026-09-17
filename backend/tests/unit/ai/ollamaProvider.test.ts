import {
  OllamaProvider,
  OllamaUnavailableError,
  OllamaGenerationError,
} from '@/providers/ai/ollamaProvider';

describe('OllamaProvider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('checkHealth', () => {
    it('returns available: true and detects default model when present', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              models: [{ name: 'llama3.2:latest' }, { name: 'mistral:latest' }],
            }),
        } as Response),
      ) as typeof fetch;

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2');
      const health = await provider.checkHealth();

      expect(health.available).toBe(true);
      expect(health.defaultModelAvailable).toBe(true);
      expect(health.defaultModel).toBe('llama3.2');
      expect(health.models).toContain('llama3.2:latest');
    });

    it('returns defaultModelAvailable: false when configured model is not installed', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              models: [{ name: 'qwen2.5:latest' }],
            }),
        } as Response),
      ) as typeof fetch;

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2');
      const health = await provider.checkHealth();

      expect(health.available).toBe(true);
      expect(health.defaultModelAvailable).toBe(false);
      expect(health.defaultModel).toBe('llama3.2');
    });

    it('returns available: false gracefully when Ollama cannot be reached (e.g. connection refused)', async () => {
      global.fetch = jest
        .fn()
        .mockImplementation(() =>
          Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:11434')),
        ) as typeof fetch;

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2');
      const health = await provider.checkHealth();

      expect(health.available).toBe(false);
      expect(health.defaultModelAvailable).toBe(false);
      expect(health.error).toContain('ECONNREFUSED');
    });

    it('returns available: false when upstream returns non-200 HTTP status', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
        } as Response),
      ) as typeof fetch;

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2');
      const health = await provider.checkHealth();

      expect(health.available).toBe(false);
      expect(health.error).toContain('502');
    });
  });

  describe('generateCompletion', () => {
    it('returns completion text and duration when Ollama succeeds', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              response: 'Here is your planned itinerary for Saturday.',
              done: true,
            }),
        } as Response),
      ) as typeof fetch;

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2');
      const result = await provider.generateCompletion(
        'System instruction',
        'Plan day for Saturday',
      );

      expect(result.response).toBe('Here is your planned itinerary for Saturday.');
      expect(typeof result.totalDurationMs).toBe('number');
    });

    it('throws OllamaGenerationError if Ollama returns an error payload', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              error: 'model "llama3.2" not found',
            }),
        } as Response),
      ) as typeof fetch;

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2');
      await expect(
        provider.generateCompletion('System instruction', 'User prompt'),
      ).rejects.toThrow(OllamaGenerationError);
    });

    it('throws OllamaUnavailableError if fetch times out or network fails', async () => {
      global.fetch = jest
        .fn()
        .mockImplementation(() =>
          Promise.reject(new Error('The operation was aborted due to timeout')),
        ) as typeof fetch;

      const provider = new OllamaProvider('http://localhost:11434', 'llama3.2');
      await expect(
        provider.generateCompletion('System instruction', 'User prompt'),
      ).rejects.toThrow(OllamaUnavailableError);
    });
  });
});
