// @ts-nocheck
// Fix for IDE linting: Deno is a global in Supabase Edge Functions
declare const Deno: any;

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly model?: string,
    public readonly bodyPreview?: string
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

export type ChatRoute = 'fast' | 'balanced' | 'deep';
export type ChatIntent =
  | 'general'
  | 'coding'
  | 'debugging'
  | 'analysis'
  | 'brainstorm'
  | 'writing'
  | 'comparison';

export const CHAT_MODELS = [
  'google/gemini-2.0-flash-lite-preview-02-05:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/free' // Restored as random-access fallback
];

export const CODE_MODELS = [
  'google/gemini-2.0-flash-lite-preview-02-05:free',
  'qwen/qwen-2.5-coder-32b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/free'
];

const RETRY_DELAY_MS = 300;
const DEFAULT_TIMEOUT_MS = 3500; // Fast timeout for primary models
const DEFAULT_STREAM_TIMEOUT_MS = 8000; // Longer timeout for streaming TTFB
const MODEL_MAX_OUTPUT_FALLBACK_TOKENS = 4096;
const ANTHROPIC_FALLBACK_MODEL = 'claude-3-5-haiku-latest';
const ROUTE_TIMEOUTS_MS: Record<ChatRoute, { standard: number; streaming: number }> = {
  fast: { standard: 2200, streaming: 4500 },
  balanced: { standard: 3200, streaming: 6500 },
  deep: { standard: 5000, streaming: 9500 },
};

function dedupeModels(models: string[]): string[] {
  return Array.from(new Set(models.filter(Boolean)));
}

export function getChatModelCandidates(
  route: ChatRoute = 'balanced',
  intent: ChatIntent = 'general'
): string[] {
  const fastPriority = [
    'google/gemini-2.0-flash-lite-preview-02-05:free',
    'openrouter/free',
    'meta-llama/llama-3.3-70b-instruct:free',
  ];

  const reasoningPriority = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-lite-preview-02-05:free',
    'openrouter/free',
  ];

  const balancedPriority = [
    'google/gemini-2.0-flash-lite-preview-02-05:free',
    'openrouter/free',
    'meta-llama/llama-3.3-70b-instruct:free',
  ];

  if (route === 'fast') {
    return dedupeModels(fastPriority);
  }

  if (route === 'deep' || intent === 'analysis' || intent === 'comparison') {
    return dedupeModels(reasoningPriority);
  }

  if (intent === 'coding' || intent === 'debugging') {
    return dedupeModels([
      'google/gemini-2.0-flash-lite-preview-02-05:free',
      'openrouter/free',
      'meta-llama/llama-3.3-70b-instruct:free',
    ]);
  }

  return dedupeModels(balancedPriority);
}

export function getChatTimeoutMs(
  route: ChatRoute = 'balanced',
  streaming: boolean = false
): number {
  const timeoutGroup = ROUTE_TIMEOUTS_MS[route] || ROUTE_TIMEOUTS_MS.balanced;
  return streaming ? timeoutGroup.streaming : timeoutGroup.standard;
}

function getStreamMaxAttempts(route: ChatRoute = 'balanced'): number {
  return route === 'deep' ? 2 : 1;
}

function buildTokenVariants(
  maxTokens: number,
  useModelMaxOutput: boolean
): Array<{ useModelMaxOutput: boolean; maxTokens?: number }> {
  if (!useModelMaxOutput) {
    return [{ useModelMaxOutput: false, maxTokens }];
  }

  return [
    { useModelMaxOutput: true },
    {
      useModelMaxOutput: false,
      maxTokens: Math.max(maxTokens || 0, MODEL_MAX_OUTPUT_FALLBACK_TOKENS),
    },
  ];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterChoice {
  message?: {
    content?: string;
  };
  delta?: {
    content?: string;
  };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message?: string;
    code?: number;
  };
}

function getOpenRouterHeaders(): Record<string, string> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    throw new OpenRouterError('OPENROUTER_API_KEY not configured');
  }

  const referer = Deno.env.get('SUPABASE_URL') || 'https://learnsphere.ai';

  return {
    'Authorization': 'Bearer ' + apiKey,
    'Content-Type': 'application/json',
    'HTTP-Referer': referer,
    'X-Title': 'LearnSphere AI',
  };
}

function getAnthropicHeaders(): Record<string, string> | null {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return null;
  }

  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
}

function splitAnthropicMessages(messages: OpenRouterMessage[]) {
  const systemPrompt = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')
    .trim();

  const conversationalMessages = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    }));

  if (conversationalMessages.length === 0) {
    conversationalMessages.push({ role: 'user', content: 'Please continue.' });
  }

  return {
    systemPrompt,
    conversationalMessages,
  };
}

async function callAnthropicFallback(
  messages: OpenRouterMessage[],
  options: {
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
  }
): Promise<CallOpenRouterResult | null> {
  const headers = getAnthropicHeaders();
  if (!headers) {
    return null;
  }

  const model =
    Deno.env.get('ANTHROPIC_FALLBACK_MODEL') ||
    Deno.env.get('ANTHROPIC_QUIZ_MODEL') ||
    ANTHROPIC_FALLBACK_MODEL;
  const { systemPrompt, conversationalMessages } = splitAnthropicMessages(messages);

  const fetchStartTime = Date.now();
  const response = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: Math.max(800, options.maxTokens || 1000),
        temperature: options.temperature,
        system: systemPrompt || undefined,
        messages: conversationalMessages,
      }),
    },
    Math.max(10000, options.timeoutMs)
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new OpenRouterError(
      'Anthropic fallback HTTP error',
      response.status,
      model,
      getBodyPreview(errorText)
    );
  }

  const data = await response.json();
  const content = Array.isArray(data?.content)
    ? data.content
        .filter((item: any) => item?.type === 'text')
        .map((item: any) => String(item?.text || ''))
        .join('\n')
        .trim()
    : '';

  if (!content) {
    throw new OpenRouterError('Anthropic fallback returned empty response', undefined, model);
  }

  const promptTokens = Number(data?.usage?.input_tokens || 0);
  const completionTokens = Number(data?.usage?.output_tokens || 0);

  return {
    content,
    model: String(data?.model || model),
    latencyMs: Date.now() - fetchStartTime,
    usage: {
      prompt_tokens: Number.isFinite(promptTokens) ? promptTokens : 0,
      completion_tokens: Number.isFinite(completionTokens) ? completionTokens : 0,
      total_tokens:
        (Number.isFinite(promptTokens) ? promptTokens : 0) +
        (Number.isFinite(completionTokens) ? completionTokens : 0),
    },
  };
}

export interface CallOpenRouterResult {
  content: string;
  model: string;
  latencyMs: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function getBodyPreview(text: string): string {
  return text.slice(0, 200).trim();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Fetch with abort timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options: {
    maxTokens?: number;
    useModelMaxOutput?: boolean;
    temperature?: number;
    models?: string[];
    responseFormat?: Record<string, unknown>;
    timeoutMs?: number;
    route?: ChatRoute;
    intent?: ChatIntent;
    stream?: boolean;
    allowAnthropicFallback?: boolean;
  } = {}
): Promise<CallOpenRouterResult> {
  let headers: Record<string, string> | null = null;
  let openRouterConfigError: OpenRouterError | null = null;
  try {
    headers = getOpenRouterHeaders();
  } catch (error) {
    if (error instanceof OpenRouterError) {
      openRouterConfigError = error;
    } else {
      throw error;
    }
  }

  const { 
    maxTokens = 1000,
    useModelMaxOutput = false,
    temperature = 0.3, 
    models = CODE_MODELS, 
    responseFormat,
    timeoutMs = options.route ? getChatTimeoutMs(options.route, false) : DEFAULT_TIMEOUT_MS,
    stream = false,
    allowAnthropicFallback = true,
  } = options;

  const errors: string[] = [];
  const tokenVariants = buildTokenVariants(maxTokens, useModelMaxOutput);
  let lastOpenRouterError: OpenRouterError | null = openRouterConfigError;

  if (headers) {
    for (const model of models) {
      for (const tokenVariant of tokenVariants) {
        let attempt = 0;
        const maxAttempts = 3; // 1 standard + 2 retries

        while (attempt < maxAttempts) {
          attempt++;
          try {
            console.log('[LearnSphere] Attempt ' + attempt + ' call model: ' + model);
            const bodyRaw: Record<string, unknown> = {
              model,
              messages,
              temperature,
              stream,
            };
            if (!tokenVariant.useModelMaxOutput && typeof tokenVariant.maxTokens === 'number') {
              bodyRaw.max_tokens = tokenVariant.maxTokens;
            }
            if (responseFormat) {
              bodyRaw.response_format = responseFormat;
            }

            const fetchStartTime = Date.now();
            const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers,
              body: JSON.stringify(bodyRaw),
            }, timeoutMs);

            if (!response.ok) {
              const errorText = await response.text();
              const bodyPreview = getBodyPreview(errorText);
              console.error('[LearnSphere] Model ' + model + ' HTTP ' + response.status + ':', bodyPreview);
              lastOpenRouterError = new OpenRouterError(
                'OpenRouter HTTP error',
                response.status,
                model,
                bodyPreview
              );

              if (useModelMaxOutput && tokenVariant.useModelMaxOutput && response.status === 400) {
                break;
              }

              if (attempt === maxAttempts) {
                errors.push(model + ': HTTP ' + response.status + (bodyPreview ? ' - ' + bodyPreview : ''));
                break;
              }
              await delay(RETRY_DELAY_MS * Math.pow(3, attempt - 1));
              continue;
            }

            const data: OpenRouterResponse = await response.json();

            if (data.error) {
              console.error('[LearnSphere] Model ' + model + ' API error:', data.error);
              lastOpenRouterError = new OpenRouterError(
                data.error.message || 'API error',
                data.error.code,
                model
              );

              if (useModelMaxOutput && tokenVariant.useModelMaxOutput) {
                break;
              }

              if (attempt === maxAttempts) {
                errors.push(model + ': ' + (data.error.message || 'API error'));
                break;
              }
              await delay(RETRY_DELAY_MS * Math.pow(3, attempt - 1));
              continue;
            }

            const content = data.choices?.[0]?.message?.content;
            if (!content) {
              console.error('[LearnSphere] Model ' + model + ': Empty response');
              lastOpenRouterError = new OpenRouterError('Empty response', undefined, model);
              if (attempt === maxAttempts) {
                errors.push(model + ': Empty response');
                break;
              }
              await delay(RETRY_DELAY_MS * Math.pow(3, attempt - 1));
              continue;
            }

            const latencyMs = Date.now() - fetchStartTime;
            console.log('[LearnSphere] Success with model: ' + model + ' in ' + latencyMs + 'ms');
            return {
              content,
              model: data.model || model,
              latencyMs,
              usage: data.usage
            };
          } catch (error) {
            const errMsg = getErrorMessage(error);
            if (error instanceof OpenRouterError) {
              lastOpenRouterError = error;
            } else {
              lastOpenRouterError = new OpenRouterError(errMsg, undefined, model);
            }
            console.error('[LearnSphere] Model ' + model + ' context exception:', errMsg);
            if (attempt === maxAttempts) {
              errors.push(model + ': ' + errMsg);
              break;
            }
            await delay(RETRY_DELAY_MS * Math.pow(3, attempt - 1));
          }
        }
      }
    }
  } else {
    errors.push('openrouter-config: ' + (openRouterConfigError?.message || 'OPENROUTER_API_KEY not configured'));
  }

  const fallbackStatusCode = lastOpenRouterError?.statusCode;
  const canTryAnthropicFallback =
    allowAnthropicFallback &&
    !stream &&
    (typeof fallbackStatusCode !== 'number' || fallbackStatusCode === 429 || fallbackStatusCode >= 500);

  if (canTryAnthropicFallback) {
    try {
      const fallbackResult = await callAnthropicFallback(messages, {
        maxTokens,
        temperature,
        timeoutMs,
      });

      if (fallbackResult) {
        console.warn(
          '[LearnSphere] OpenRouter exhausted, recovered with Anthropic fallback model: ' +
            fallbackResult.model
        );
        return fallbackResult;
      }
    } catch (fallbackError) {
      const fallbackMessage = getErrorMessage(fallbackError);
      errors.push('anthropic-fallback: ' + fallbackMessage);
      console.error('[LearnSphere] Anthropic fallback failed:', fallbackMessage);
    }
  }

  throw new OpenRouterError(
    'All models failed: ' + errors.join('; '),
    lastOpenRouterError?.statusCode,
    lastOpenRouterError?.model,
    lastOpenRouterError?.bodyPreview
  );
}

export async function* streamOpenRouter(
  messages: OpenRouterMessage[],
  options: { 
    maxTokens?: number; 
    useModelMaxOutput?: boolean;
    temperature?: number;
    models?: string[];
    timeoutMs?: number;
    route?: ChatRoute;
    intent?: ChatIntent;
  } = {}
): AsyncGenerator<{ delta: string; done: boolean; model?: string }> {
  const headers = getOpenRouterHeaders();
  const { 
    maxTokens = 1500,
    useModelMaxOutput = false,
    temperature = 0.4, 
    models = getChatModelCandidates(options.route, options.intent),
    timeoutMs = options.route
      ? getChatTimeoutMs(options.route, true)
      : DEFAULT_STREAM_TIMEOUT_MS
  } = options;

  const errors: string[] = [];
  const maxAttempts = getStreamMaxAttempts(options.route);
  const tokenVariants = buildTokenVariants(maxTokens, useModelMaxOutput);

  for (const model of models) {
    for (const tokenVariant of tokenVariants) {
      let attempt = 0;

      while (attempt < maxAttempts) {
        attempt++;
        try {
          console.log('[LearnSphere] Attempt ' + attempt + ' streaming with model: ' + model);
          
          const fetchStartTime = Date.now();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          const requestBody: Record<string, unknown> = {
            model,
            messages,
            temperature,
            stream: true,
          };
          if (!tokenVariant.useModelMaxOutput && typeof tokenVariant.maxTokens === 'number') {
            requestBody.max_tokens = tokenVariant.maxTokens;
          }

          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers,
            signal: controller.signal,
            body: JSON.stringify(requestBody),
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[LearnSphere] Model ' + model + ' HTTP ' + response.status + ':', errorText);

            if (useModelMaxOutput && tokenVariant.useModelMaxOutput && response.status === 400) {
              break;
            }

            if (attempt === maxAttempts) errors.push(model + ': HTTP ' + response.status);
            await delay(RETRY_DELAY_MS);
            continue;
          }

          if (!response.body) {
            console.error('[LearnSphere] Model ' + model + ': No response body');
            if (attempt === maxAttempts) errors.push(model + ': No response body');
            await delay(RETRY_DELAY_MS);
            continue;
          }

          console.log('[LearnSphere] TTFB for ' + model + ': ' + (Date.now() - fetchStartTime) + 'ms');

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let sawContent = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;

              const data = trimmed.slice(6);
              if (data === '[DONE]') {
                if (sawContent) {
                  yield { delta: '', done: true, model };
                  return;
                }
                break;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.error?.message) {
                  throw new OpenRouterError(parsed.error.message, parsed.error.code, model);
                }
                const delta = parsed.choices?.[0]?.delta?.content || '';
                if (delta) {
                  sawContent = true;
                  yield { delta, done: false, model };
                }
              } catch (error) {
                if (error instanceof OpenRouterError) {
                  throw error;
                }
                // Skip invalid JSON chunks
              }
            }
          }

          if (sawContent) {
            yield { delta: '', done: true, model };
            return;
          }

          console.error('[LearnSphere] Model ' + model + ': Stream ended without content');
          if (attempt === maxAttempts) errors.push(model + ': Empty stream');
          await delay(RETRY_DELAY_MS);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error('[LearnSphere] Model ' + model + ' stream exception:', errMsg);
          if (attempt === maxAttempts) errors.push(model + ': ' + errMsg);
          await delay(RETRY_DELAY_MS);
        }
      }
    }
  }

  throw new OpenRouterError('All models failed streaming: ' + errors.join('; '));
}

export function extractJSON(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const cleaned = fenceMatch?.[1]?.trim() || trimmed;

  const directObjectStart = cleaned.startsWith('{') ? 0 : cleaned.indexOf('{');
  if (directObjectStart === -1) {
    throw new Error('No JSON object found in model response');
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let index = directObjectStart; index < cleaned.length; index++) {
    const character = cleaned[index];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (character === '\\') {
      escapeNext = true;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        return cleaned.slice(directObjectStart, index + 1).trim();
      }
    }
  }

  throw new Error('Could not extract a complete JSON object from model response');
}
