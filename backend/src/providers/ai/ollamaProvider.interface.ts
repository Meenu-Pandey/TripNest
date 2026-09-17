export interface OllamaHealthResult {
  available: boolean;
  models: string[];
  defaultModelAvailable: boolean;
  defaultModel: string;
  error?: string;
}

export interface OllamaGenerateOptions {
  temperature?: number;
  timeoutMs?: number;
}

export interface OllamaGenerateResult {
  response: string;
  totalDurationMs?: number;
}

export interface IOllamaProvider {
  checkHealth(): Promise<OllamaHealthResult>;
  generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    options?: OllamaGenerateOptions,
  ): Promise<OllamaGenerateResult>;
}
