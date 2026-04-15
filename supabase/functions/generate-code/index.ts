import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import {
  callOpenRouter,
  streamOpenRouter,
  extractJSON,
  OpenRouterMessage,
  OpenRouterError,
} from '../_shared/openrouter.ts';
import { createSupabaseClient, getUser, logActivity } from '../_shared/supabase.ts';

type GenerationMode = 'fast' | 'deep';
type OptimizationLevel = 'bruteforce' | 'optimized' | 'highly-optimized';

interface GenerateCodeRequest {
  topic: string;
  language?: string;
  mode?: GenerationMode;
  optimization?: OptimizationLevel;
  stream?: boolean;
}

interface GeneratedCodePayload {
  code: string;
  language: string;
  summary: string;
  complexity: string | null;
}

interface FallbackBlueprint {
  code: string;
  summary: string;
  complexity: string;
}

interface GenerationProfile {
  models: string[];
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

interface ExplanationResult {
  explanation: string;
  debuggingTips: string[];
  complexity: string;
  model: string;
}

interface GenerateCodeWorkflowResult {
  generated: GeneratedCodePayload;
  explanationResult: ExplanationResult;
  usedCodeModel: string;
  usedFallback: boolean;
  generationTimeMs: number;
}

interface ModelErrorContext {
  message: string;
  model?: string;
  statusCode?: number;
  responsePreview?: string;
}

const OPTIMIZATION_INSTRUCTIONS: Record<OptimizationLevel, string> = {
  bruteforce:
    'Use the clearest straightforward solution. Favor readability over performance and avoid advanced optimizations.',
  optimized:
    'Use standard efficient algorithms and data structures. Balance readability, performance, and maintainability.',
  'highly-optimized':
    'Use the strongest practical algorithm for this task while keeping the result robust and debuggable.',
};

const CODE_PRIMARY_MODELS = [
  'stepfun/step-3.5-flash:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-coder:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/free',
];

const EXPLANATION_MODELS = [
  'stepfun/step-3.5-flash:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/free',
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeOptimization(value?: string): OptimizationLevel {
  if (value === 'bruteforce' || value === 'optimized' || value === 'highly-optimized') {
    return value;
  }

  return 'optimized';
}

function normalizeLanguage(value?: string): string {
  return getTrimmedString(value) ?? 'JavaScript';
}

function normalizeLanguageKey(language: string): string {
  const lower = language.toLowerCase();

  if (lower.includes('type')) return 'typescript';
  if (lower.includes('python')) return 'python';
  if (lower.includes('java') && !lower.includes('javascript')) return 'java';
  if (lower.includes('c++') || lower.includes('cpp')) return 'cpp';
  if (lower.includes('go')) return 'go';
  if (lower.includes('rust')) return 'rust';

  return 'javascript';
}

function normalizeRequestedMode(value: unknown): GenerationMode | undefined {
  return value === 'fast' || value === 'deep' ? value : undefined;
}

function parseGenerateCodeRequest(raw: unknown): GenerateCodeRequest {
  if (!isRecord(raw)) {
    throw new Error('Request body must be a JSON object');
  }

  return {
    topic: typeof raw.topic === 'string' ? raw.topic : '',
    language: typeof raw.language === 'string' ? raw.language : undefined,
    mode: normalizeRequestedMode(raw.mode),
    optimization: normalizeOptimization(typeof raw.optimization === 'string' ? raw.optimization : undefined),
    stream: raw.stream === true,
  };
}

function isComplexPrompt(topic: string): boolean {
  return /step by step|in detail|in-depth|full stack|production|architecture|system design|comprehensive|detailed|robust|scalable/i.test(
    topic
  );
}

function resolveMode(
  topic: string,
  requestedMode: GenerationMode | undefined,
  optimization: OptimizationLevel
): GenerationMode {
  if (requestedMode === 'deep') {
    return 'deep';
  }

  if (optimization === 'highly-optimized' || isComplexPrompt(topic)) {
    return 'deep';
  }

  return 'fast';
}

function getGenerationProfile(mode: GenerationMode): GenerationProfile {
  if (mode === 'deep') {
    return {
      models: CODE_PRIMARY_MODELS,
      maxTokens: 4200,
      temperature: 0.2,
      timeoutMs: 45000,
    };
  }

  return {
    models: CODE_PRIMARY_MODELS,
    maxTokens: 2400,
    temperature: 0.15,
    timeoutMs: 26000,
  };
}

function resolveRouteForMode(mode: GenerationMode): 'fast' | 'balanced' | 'deep' {
  return mode === 'deep' ? 'deep' : 'balanced';
}

function emitCodeChunks(code: string, onChunk: (chunk: string) => void, chunkSize: number = 220): void {
  const normalized = String(code || '').replace(/\r/g, '');
  for (let index = 0; index < normalized.length; index += chunkSize) {
    onChunk(normalized.slice(index, index + chunkSize));
  }
}

function buildSortFallback(languageKey: string): FallbackBlueprint {
  if (languageKey === 'typescript') {
    return {
      code: `export function sortNumbers(numbers: number[]): number[] {
  // Copy first so the caller's original array is preserved.
  const copy = [...numbers];
  copy.sort((a, b) => a - b);
  return copy;
}`,
      summary: 'Generated a deterministic numeric sort helper using ascending order.',
      complexity: 'Time: O(n log n) | Space: O(n)',
    };
  }

  if (languageKey === 'python') {
    return {
      code: `def sort_numbers(numbers: list[int]) -> list[int]:
    """Return a new ascending list without mutating the original input."""
    return sorted(numbers)
`,
      summary: 'Generated a deterministic numeric sort helper using Python\'s built-in sort.',
      complexity: 'Time: O(n log n) | Space: O(n)',
    };
  }

  if (languageKey === 'java') {
    return {
      code: `import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class SortNumbers {
  public static List<Integer> sortNumbers(List<Integer> numbers) {
    List<Integer> copy = new ArrayList<>(numbers);
    Collections.sort(copy);
    return copy;
  }
}`,
      summary: 'Generated a deterministic numeric sort helper that returns a sorted copy.',
      complexity: 'Time: O(n log n) | Space: O(n)',
    };
  }

  if (languageKey === 'go') {
    return {
      code: `package main

import "slices"

func sortNumbers(numbers []int) []int {
  // Clone first so callers keep their original ordering.
  copyValues := slices.Clone(numbers)
  slices.Sort(copyValues)
  return copyValues
}`,
      summary: 'Generated a deterministic numeric sort helper using the standard slices package.',
      complexity: 'Time: O(n log n) | Space: O(n)',
    };
  }

  if (languageKey === 'rust') {
    return {
      code: `pub fn sort_numbers(numbers: &[i32]) -> Vec<i32> {
    let mut copy = numbers.to_vec();
    copy.sort();
    copy
}`,
      summary: 'Generated a deterministic numeric sort helper that returns a sorted vector copy.',
      complexity: 'Time: O(n log n) | Space: O(n)',
    };
  }

  if (languageKey === 'cpp') {
    return {
      code: `#include <algorithm>
#include <vector>

std::vector<int> sortNumbers(std::vector<int> numbers) {
  std::sort(numbers.begin(), numbers.end());
  return numbers;
}`,
      summary: 'Generated a deterministic numeric sort helper for vectors.',
      complexity: 'Time: O(n log n) | Space: O(1) extra',
    };
  }

  return {
    code: `export function sortNumbers(numbers) {
  // Copy first so we do not mutate the caller's original array.
  const copy = [...numbers];
  copy.sort((a, b) => a - b);
  return copy;
}`,
    summary: 'Generated a deterministic numeric sort helper using ascending order.',
    complexity: 'Time: O(n log n) | Space: O(n)',
  };
}

function buildHelloFallback(languageKey: string): FallbackBlueprint {
  if (languageKey === 'typescript') {
    return {
      code: `export function helloWorld(name: string = 'world'): string {
  return \`Hello, \${name}!\`;
}`,
      summary: 'Generated a deterministic greeting helper with a default name.',
      complexity: 'Time: O(1) | Space: O(1)',
    };
  }

  if (languageKey === 'python') {
    return {
      code: `def hello_world(name: str = "world") -> str:
    return f"Hello, {name}!"
`,
      summary: 'Generated a deterministic greeting helper with a default name.',
      complexity: 'Time: O(1) | Space: O(1)',
    };
  }

  if (languageKey === 'java') {
    return {
      code: `public class HelloWorld {
  public static String helloWorld(String name) {
    String safeName = (name == null || name.isBlank()) ? "world" : name;
    return "Hello, " + safeName + "!";
  }
}`,
      summary: 'Generated a deterministic greeting helper with null-safe defaults.',
      complexity: 'Time: O(1) | Space: O(1)',
    };
  }

  if (languageKey === 'go') {
    return {
      code: `package main

func helloWorld(name string) string {
  if name == "" {
    name = "world"
  }
  return "Hello, " + name + "!"
}`,
      summary: 'Generated a deterministic greeting helper with empty-input handling.',
      complexity: 'Time: O(1) | Space: O(1)',
    };
  }

  if (languageKey === 'rust') {
    return {
      code: `pub fn hello_world(name: Option<&str>) -> String {
    let safe_name = name.unwrap_or("world");
    format!("Hello, {}!", safe_name)
}`,
      summary: 'Generated a deterministic greeting helper using Option for safety.',
      complexity: 'Time: O(1) | Space: O(1)',
    };
  }

  if (languageKey === 'cpp') {
    return {
      code: `#include <string>

std::string helloWorld(const std::string& name = "world") {
  return "Hello, " + name + "!";
}`,
      summary: 'Generated a deterministic greeting helper with a default argument.',
      complexity: 'Time: O(1) | Space: O(1)',
    };
  }

  return {
    code: `export function helloWorld(name = 'world') {
  return \`Hello, \${name}!\`;
}`,
    summary: 'Generated a deterministic greeting helper with a default name.',
    complexity: 'Time: O(1) | Space: O(1)',
  };
}

function buildGenericFallback(topic: string, languageKey: string): FallbackBlueprint {
  if (languageKey === 'typescript') {
    return {
      code: `export function solveTask(input: unknown): unknown {
  // TODO: Replace this placeholder with task-specific logic.
  // Topic requested: ${topic.replace(/`/g, '')}
  return input;
}`,
      summary: 'Generated a deterministic scaffold because AI providers were temporarily unavailable.',
      complexity: 'Time: O(n) | Space: O(1)',
    };
  }

  if (languageKey === 'python') {
    return {
      code: `def solve_task(value):
    """Replace this scaffold with task-specific logic."""
    # Topic requested: ${topic.replace(/#/g, '')}
    return value
`,
      summary: 'Generated a deterministic scaffold because AI providers were temporarily unavailable.',
      complexity: 'Time: O(n) | Space: O(1)',
    };
  }

  if (languageKey === 'java') {
    return {
      code: `public class TaskSolver {
  public static Object solveTask(Object input) {
    // TODO: Replace this scaffold with task-specific logic.
    // Topic requested: ${topic.replace(/"/g, '')}
    return input;
  }
}`,
      summary: 'Generated a deterministic scaffold because AI providers were temporarily unavailable.',
      complexity: 'Time: O(n) | Space: O(1)',
    };
  }

  if (languageKey === 'go') {
    return {
      code: `package main

func solveTask[T any](input T) T {
  // TODO: Replace this scaffold with task-specific logic.
  // Topic requested: ${topic.replace(/`/g, '')}
  return input
}`,
      summary: 'Generated a deterministic scaffold because AI providers were temporarily unavailable.',
      complexity: 'Time: O(n) | Space: O(1)',
    };
  }

  if (languageKey === 'rust') {
    return {
      code: `pub fn solve_task<T>(input: T) -> T {
    // TODO: Replace this scaffold with task-specific logic.
    // Topic requested: ${topic.replace(/`/g, '')}
    input
}`,
      summary: 'Generated a deterministic scaffold because AI providers were temporarily unavailable.',
      complexity: 'Time: O(n) | Space: O(1)',
    };
  }

  if (languageKey === 'cpp') {
    return {
      code: `template <typename T>
T solveTask(T input) {
  // TODO: Replace this scaffold with task-specific logic.
  // Topic requested: ${topic.replace(/"/g, '')}
  return input;
}`,
      summary: 'Generated a deterministic scaffold because AI providers were temporarily unavailable.',
      complexity: 'Time: O(n) | Space: O(1)',
    };
  }

  return {
    code: `export function solveTask(input) {
  // TODO: Replace this scaffold with task-specific logic.
  // Topic requested: ${topic.replace(/`/g, '')}
  return input;
}`,
    summary: 'Generated a deterministic scaffold because AI providers were temporarily unavailable.',
    complexity: 'Time: O(n) | Space: O(1)',
  };
}

function buildDeterministicFallback(
  topic: string,
  language: string,
  optimization: OptimizationLevel
): GeneratedCodePayload {
  const normalizedTopic = topic.toLowerCase();
  const languageKey = normalizeLanguageKey(language);

  let blueprint: FallbackBlueprint;

  if (/\bsort|sorting|ordered|ascending|descending\b/i.test(normalizedTopic)) {
    blueprint = buildSortFallback(languageKey);
  } else if (/\bhello world|greet|greeting\b/i.test(normalizedTopic)) {
    blueprint = buildHelloFallback(languageKey);
  } else {
    blueprint = buildGenericFallback(topic, languageKey);
  }

  const optimizationSuffix = optimization === 'highly-optimized'
    ? ' The fallback favors practical efficiency where possible.'
    : optimization === 'bruteforce'
      ? ' The fallback favors straightforward readability.'
      : ' The fallback balances readability and efficiency.';

  return {
    code: blueprint.code,
    language,
    summary: `${blueprint.summary}${optimizationSuffix}`,
    complexity: blueprint.complexity,
  };
}

function buildDeterministicExplanation(
  topic: string,
  optimization: OptimizationLevel,
  generated: GeneratedCodePayload
): ExplanationResult {
  return {
    explanation: `AI providers were temporarily unavailable, so LearnSphere returned a deterministic fallback for "${topic}". The generated code is intentionally safe and runnable, with comments highlighting where you should adapt logic to your exact requirements. Optimization preference "${optimization}" was applied conservatively in the fallback path.`,
    debuggingTips: [
      'Run the function with a tiny sample input before integrating it into larger flows.',
      'Add one edge-case test (empty input, null values, or duplicates) to validate behavior.',
      'Use temporary logs or breakpoints around the main transformation line to inspect intermediate values.',
    ],
    complexity: resolveComplexity(generated.complexity, generated.code),
    model: 'deterministic-fallback',
  };
}

function buildSystemPrompt(language: string, optimization: OptimizationLevel): string {
  return `You are a senior software engineer helping a learner generate reliable code quickly.

Preferred output format is JSON with this exact structure:
{
  "code": "complete runnable code",
  "language": "${language}",
  "summary": "1-2 sentence overview of the solution",
  "complexity": "Time: O(?) | Space: O(?)"
}

If strict JSON is unreliable for your model, return plain text with this exact tagged format:
CODE:

\`\`\`${language}
complete runnable code
\`\`\`

LANGUAGE: ${language}
SUMMARY: 1-2 sentence overview of the solution
COMPLEXITY: Time: O(?) | Space: O(?)

Requirements:
- Generate correct, runnable, production-ready ${language} code.
- Add short inline comments to meaningful lines or blocks so the learner can follow the logic.
- Do not add noise comments for braces, blank lines, or obvious syntax.
- Prefer simple, robust code that is easy to debug and maintain.
- Follow this optimization guidance: ${OPTIMIZATION_INSTRUCTIONS[optimization]}
- Return exactly one format (JSON or tagged plain text), with no extra commentary outside that format.`;
}

function buildUserPrompt(topic: string, language: string, optimization: OptimizationLevel): string {
  return `Task: ${topic}

Language: ${language}
Optimization: ${OPTIMIZATION_INSTRUCTIONS[optimization]}

Please generate the solution now.`;
}

function buildRawCodePrompt(topic: string, language: string, optimization: OptimizationLevel): OpenRouterMessage[] {
  return [
    {
      role: 'system',
      content: `You are a senior software engineer generating robust ${language} code.

Return exactly one fenced code block. Do not include multiple alternatives or explanations.

Requirements:
- Generate correct, runnable, production-ready ${language} code.
- Add short inline comments only where they help understanding.
- Do not add prose before or after the code block.
- Prefer simple, maintainable code over clever but brittle code.
- The code must be complete, not pseudo-code.`,
    },
    {
      role: 'user',
      content: `Task: ${topic}

Optimization: ${OPTIMIZATION_INSTRUCTIONS[optimization]}`,
    },
  ];
}

function normalizeGeneratedPayload(raw: unknown, fallbackLanguage: string): GeneratedCodePayload {
  if (!isRecord(raw)) {
    throw new Error('Generated payload was not a JSON object');
  }

  const code = getTrimmedString(raw.code);
  if (!code) {
    throw new Error('Generated payload did not include code');
  }

  return {
    code,
    language: getTrimmedString(raw.language) ?? fallbackLanguage,
    summary: getTrimmedString(raw.summary) ?? 'Generated a ready-to-use solution for the requested task.',
    complexity: getTrimmedString(raw.complexity),
  };
}

function normalizeExplanationPayload(raw: unknown, generated: GeneratedCodePayload): ExplanationResult {
  if (!isRecord(raw)) {
    throw new Error('Explanation payload was not a JSON object');
  }

  const explanation = getTrimmedString(raw.explanation);
  if (!explanation) {
    throw new Error('Explanation payload was empty');
  }

  const debuggingTips = Array.isArray(raw.debuggingTips)
    ? raw.debuggingTips
        .filter((tip): tip is string => typeof tip === 'string' && tip.trim().length > 0)
        .map((tip) => tip.trim())
        .slice(0, 4)
    : [];

  return {
    explanation,
    debuggingTips,
    complexity: resolveComplexity(getTrimmedString(raw.complexity), generated.code),
    model: 'unknown',
  };
}

function parseStructuredCodeResponse(raw: string, fallbackLanguage: string): GeneratedCodePayload {
  try {
    const parsed = JSON.parse(extractJSON(raw));
    return normalizeGeneratedPayload(parsed, fallbackLanguage);
  } catch {
    const normalized = String(raw || '').replace(/\r/g, '').trim();
    const code = extractCodeBlock(normalized);
    if (!code) {
      throw new Error('Structured response did not include code');
    }

    const language = getTrimmedString(normalized.match(/^language\s*:\s*(.+)$/im)?.[1]) || fallbackLanguage;
    const summary = getTrimmedString(normalized.match(/^summary\s*:\s*(.+)$/im)?.[1])
      || 'Generated a ready-to-use solution for the requested task.';
    const complexity = getTrimmedString(normalized.match(/^complexity\s*:\s*(.+)$/im)?.[1]);

    return {
      code,
      language,
      summary,
      complexity,
    };
  }
}

function parseExplanationResponse(raw: string, generated: GeneratedCodePayload): ExplanationResult {
  try {
    const parsed = JSON.parse(extractJSON(raw));
    return normalizeExplanationPayload(parsed, generated);
  } catch {
    const normalized = String(raw || '').replace(/\r/g, '').trim();

    const explanationMatch = normalized.match(/(?:^|\n)explanation\s*:\s*([\s\S]*?)(?=\n(?:complexity|debugging\s*tips?|tips?)\s*:|$)/i);
    const complexityMatch = normalized.match(/(?:^|\n)complexity\s*:\s*(.+)$/im);
    const tipsSectionMatch = normalized.match(/(?:^|\n)(?:debugging\s*tips?|tips?)\s*:\s*([\s\S]*)$/i);

    const explanation = getTrimmedString(explanationMatch?.[1]) || normalized;

    let debuggingTips: string[] = [];
    if (tipsSectionMatch?.[1]) {
      debuggingTips = tipsSectionMatch[1]
        .split('\n')
        .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
        .filter((line) => line.length > 0)
        .slice(0, 4);
    }

    return {
      explanation,
      debuggingTips,
      complexity: resolveComplexity(getTrimmedString(complexityMatch?.[1]), generated.code),
      model: 'unknown',
    };
  }
}

function inferComplexityFromCode(code: string): string {
  const normalizedCode = code.toLowerCase();
  const loopMatches = normalizedCode.match(/\b(for|while)\b/g) || [];
  const hasSorting = normalizedCode.includes('.sort(') || normalizedCode.includes('sorted(');
  const usesCollectionMemory = /\b(map|set|dict|hashmap|object|arraylist|vector|list)\b/.test(normalizedCode);

  if (hasSorting) {
    return 'Estimated Time: O(n log n) | Estimated Space: O(n)';
  }

  if (loopMatches.length >= 2) {
    return `Estimated Time: O(n^2) | Estimated Space: ${usesCollectionMemory ? 'O(n)' : 'O(1)'}`;
  }

  if (loopMatches.length === 1) {
    return `Estimated Time: O(n) | Estimated Space: ${usesCollectionMemory ? 'O(n)' : 'O(1)'}`;
  }

  return `Estimated Time: O(1) | Estimated Space: ${usesCollectionMemory ? 'O(n)' : 'O(1)'}`;
}

function resolveComplexity(value: string | null | undefined, code: string): string {
  return hasText(value) ? value.trim() : inferComplexityFromCode(code);
}

function extractCodeBlock(text: string): string {
  const fencedBlockMatch = text.match(/```[a-zA-Z0-9+#.-]*\n([\s\S]*?)```/);
  if (fencedBlockMatch?.[1]?.trim()) {
    return fencedBlockMatch[1].trim();
  }

  return text.trim();
}

function getModelErrorContext(error: unknown): ModelErrorContext {
  if (error instanceof OpenRouterError) {
    return {
      message: error.message,
      model: error.model,
      statusCode: error.statusCode,
      responsePreview: error.bodyPreview,
    };
  }

  return {
    message: error instanceof Error ? error.message : String(error),
  };
}

function logModelFailure(stage: string, model: string, error: unknown): void {
  const context = getModelErrorContext(error);
  console.error(`[LearnSphere] ${stage} failed`, {
    attemptedModel: model,
    reportedModel: context.model ?? null,
    statusCode: context.statusCode ?? null,
    responsePreview: context.responsePreview ?? null,
    message: context.message,
  });
}

async function generateStructuredCode(
  messages: OpenRouterMessage[],
  profile: GenerationProfile,
  language: string
): Promise<{ generated: GeneratedCodePayload; model: string } | null> {
  for (const [index, model] of profile.models.entries()) {
    try {
      if (index > 0) {
        await delay(100);
      }

      console.log(`[LearnSphere] Generate code structured try ${index + 1}: ${model}`);

      const result = await callOpenRouter(messages, {
        maxTokens: profile.maxTokens,
        temperature: profile.temperature,
        models: [model],
        timeoutMs: profile.timeoutMs,
        stream: false,
      });

      return {
        generated: parseStructuredCodeResponse(result.content, language),
        model: result.model,
      };
    } catch (error) {
      logModelFailure('Structured code generation', model, error);
    }
  }

  return null;
}

async function generateRawCodeFallback(
  topic: string,
  language: string,
  optimization: OptimizationLevel,
  profile: GenerationProfile
): Promise<{ generated: GeneratedCodePayload; model: string } | null> {
  const rawMessages = buildRawCodePrompt(topic, language, optimization);

  for (const [index, model] of profile.models.entries()) {
    try {
      if (index > 0) {
        await delay(100);
      }

      console.log(`[LearnSphere] Generate code raw fallback try ${index + 1}: ${model}`);

      const result = await callOpenRouter(rawMessages, {
        maxTokens: profile.maxTokens,
        temperature: profile.temperature,
        models: [model],
        timeoutMs: profile.timeoutMs + 4000,
        stream: false,
      });

      const code = extractCodeBlock(result.content);
      if (!code) {
        throw new Error('Raw fallback did not return code');
      }

      return {
        generated: {
          code,
          language,
          summary: 'Generated a complete solution using the resilient fallback path.',
          complexity: null,
        },
        model: result.model,
      };
    } catch (error) {
      logModelFailure('Raw fallback code generation', model, error);
    }
  }

  return null;
}

async function generateStreamingCode(
  topic: string,
  language: string,
  optimization: OptimizationLevel,
  mode: GenerationMode,
  profile: GenerationProfile,
  onChunk: (chunk: string, model: string) => void
): Promise<{ generated: GeneratedCodePayload; model: string } | null> {
  const streamMessages = buildRawCodePrompt(topic, language, optimization);
  const route = resolveRouteForMode(mode);

  let streamed = '';
  let usedModel = '';

  try {
    const openRouterStream = streamOpenRouter(streamMessages, {
      maxTokens: profile.maxTokens,
      temperature: profile.temperature,
      models: profile.models,
      timeoutMs: profile.timeoutMs + 6000,
      route,
      intent: 'coding',
    });

    for await (const part of openRouterStream) {
      if (part.model && !usedModel) {
        usedModel = part.model;
      }

      if (!part.delta) {
        continue;
      }

      streamed += part.delta;
      onChunk(part.delta, usedModel || part.model || 'stream');
    }

    const code = extractCodeBlock(streamed);
    if (!code) {
      throw new Error('Streaming generation returned empty code.');
    }

    return {
      generated: {
        code,
        language,
        summary: 'Generated a complete solution with chunked streaming output.',
        complexity: null,
      },
      model: usedModel || 'stream-model',
    };
  } catch (error) {
    logModelFailure('Streaming code generation', 'streamOpenRouter', error);
    return null;
  }
}

async function runGenerateCodeWorkflow(options: {
  topic: string;
  language: string;
  optimization: OptimizationLevel;
  mode: GenerationMode;
  profile: GenerationProfile;
  onCodeChunk?: (chunk: string, model: string) => void;
}): Promise<GenerateCodeWorkflowResult> {
  const { topic, language, optimization, mode, profile, onCodeChunk } = options;
  const startedAt = Date.now();

  let generated: GeneratedCodePayload | null = null;
  let usedCodeModel = '';
  let usedFallback = false;
  let usedStreamingPath = false;

  if (onCodeChunk) {
    const streamedResult = await generateStreamingCode(
      topic,
      language,
      optimization,
      mode,
      profile,
      onCodeChunk
    );

    if (streamedResult) {
      generated = streamedResult.generated;
      usedCodeModel = streamedResult.model;
      usedStreamingPath = true;
    }
  }

  if (!generated) {
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: buildSystemPrompt(language, optimization) },
      { role: 'user', content: buildUserPrompt(topic, language, optimization) },
    ];

    const structuredResult = await generateStructuredCode(messages, profile, language);
    if (structuredResult) {
      generated = structuredResult.generated;
      usedCodeModel = structuredResult.model;
    } else {
      const rawFallbackResult = await generateRawCodeFallback(topic, language, optimization, profile);
      if (rawFallbackResult) {
        generated = rawFallbackResult.generated;
        usedCodeModel = rawFallbackResult.model;
      }
    }
  }

  if (!generated) {
    generated = buildDeterministicFallback(topic, language, optimization);
    usedCodeModel = 'deterministic-fallback';
    usedFallback = true;
  }

  if (onCodeChunk && !usedStreamingPath && generated.code.trim().length > 0) {
    emitCodeChunks(generated.code, (chunk) => onCodeChunk(chunk, usedCodeModel));
  }

  generated.complexity = resolveComplexity(generated.complexity, generated.code);

  const explanationResult = usedFallback
    ? buildDeterministicExplanation(topic, optimization, generated)
    : await generateExplanation(topic, optimization, generated);

  return {
    generated,
    explanationResult,
    usedCodeModel,
    usedFallback,
    generationTimeMs: Date.now() - startedAt,
  };
}

async function generateExplanation(
  topic: string,
  optimization: OptimizationLevel,
  generated: GeneratedCodePayload
): Promise<ExplanationResult> {
  const explanationMessages: OpenRouterMessage[] = [
    {
      role: 'system',
      content: `You are a senior software engineer explaining generated code to a learner.

Preferred output format is JSON with this exact structure:
{
  "explanation": "A detailed but clear walkthrough of how the code works, why the approach fits the task, important edge cases, and how to extend it.",
  "complexity": "Time: O(?) | Space: O(?)",
  "debuggingTips": ["tip 1", "tip 2", "tip 3"]
}

If strict JSON is unreliable for your model, return plain text with this tagged format:
EXPLANATION: A detailed but clear walkthrough of how the code works, why the approach fits the task, important edge cases, and how to extend it.
COMPLEXITY: Time: O(?) | Space: O(?)
DEBUGGING_TIPS:
- tip 1
- tip 2
- tip 3

Requirements:
- Explain the actual code that was generated.
- Always provide a concrete time and space complexity line.
- Keep the explanation practical and concrete.
- Provide 2 to 4 debugging tips.
- If the code is trivial (under ~10 lines), keep the explanation to 3-4 sentences. Do not pad.
- Return exactly one format (JSON or tagged plain text), with no extra commentary outside that format.`,
    },
    {
      role: 'user',
      content: `Task: ${topic}
Optimization: ${optimization}
Language: ${generated.language}
Summary: ${generated.summary}
Complexity: ${generated.complexity ?? 'Not provided'}

Code:
\`\`\`${generated.language}
${generated.code}
\`\`\``,
    },
  ];

  for (const [index, model] of EXPLANATION_MODELS.entries()) {
    try {
      if (index > 0) {
        await delay(100);
      }

      console.log(`[LearnSphere] Generate explanation try ${index + 1}: ${model}`);

      const result = await callOpenRouter(explanationMessages, {
        maxTokens: 1000,
        temperature: 0.2,
        models: [model],
        timeoutMs: 22000,
        stream: false,
      });

      const normalized = parseExplanationResponse(result.content, generated);
      return {
        ...normalized,
        model: result.model,
      };
    } catch (error) {
      logModelFailure('Explanation generation', model, error);
    }
  }

  return {
    explanation: `${generated.summary}

1. Check the function signature and expected output first.
2. Trace the main branch or loop with a tiny sample input.
3. Verify the edge-case path such as empty or invalid values.
4. Log the intermediate state near the key transformation if results look off.`,
    debuggingTips: [
      'Run the code with a tiny sample input first.',
      'Check one edge case like empty input or duplicates.',
      'Log intermediate values around the main branch if behavior looks wrong.',
    ],
    complexity: resolveComplexity(generated.complexity, generated.code),
    model: 'fallback',
  };
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    const supabase = createSupabaseClient(req);
    const user = await getUser(supabase);

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const body = parseGenerateCodeRequest(rawBody);
    const topic = getTrimmedString(body.topic);

    if (!topic) {
      return errorResponse('Topic is required', 400);
    }

    const language = normalizeLanguage(body.language);
    const optimization = normalizeOptimization(body.optimization);
    const mode = resolveMode(topic, body.mode, optimization);
    const profile = getGenerationProfile(mode);

    if (body.stream === true) {
      const streamHeaders = {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      };

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          let closed = false;

          const emit = (event: string, payload: Record<string, unknown>) => {
            if (closed) return;
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
            );
          };

          const close = () => {
            if (closed) return;
            closed = true;
            controller.close();
          };

          const heartbeat = setInterval(() => {
            if (closed) return;
            controller.enqueue(encoder.encode(': keep-alive\n\n'));
          }, 4000);

          (async () => {
            try {
              emit('status', {
                message: 'connected',
                topic,
                language,
                optimization,
                mode,
              });
              emit('status', { message: 'generating_code' });

              const workflow = await runGenerateCodeWorkflow({
                topic,
                language,
                optimization,
                mode,
                profile,
                onCodeChunk: (chunk, model) => {
                  emit('chunk', { chunk, model });
                },
              });

              emit('status', { message: 'finalizing' });

              const responseComplexity = resolveComplexity(
                workflow.explanationResult.complexity,
                workflow.generated.code
              );

              await logActivity(supabase, user.id, 'code_generated', 'code', undefined, {
                topic,
                language: workflow.generated.language,
                optimization,
                mode,
                codeModel: workflow.usedCodeModel,
                explanationModel: workflow.explanationResult.model,
                usedFallback: workflow.usedFallback,
                generationTimeMs: workflow.generationTimeMs,
              });

              emit('complete', {
                ...workflow.generated,
                explanation: workflow.explanationResult.explanation,
                complexity: responseComplexity,
                debuggingTips: workflow.explanationResult.debuggingTips,
                optimization,
                mode,
                degraded: workflow.usedFallback,
                generationTimeMs: workflow.generationTimeMs,
              });
            } catch (error) {
              console.error('[LearnSphere] Generate code stream error:', error);
              emit('error', {
                error: error instanceof Error ? error.message : 'Code generation failed',
                code: 'GENERATION_FAILED',
                status: 502,
              });
            } finally {
              clearInterval(heartbeat);
              close();
            }
          })();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: streamHeaders,
      });
    }

    const workflow = await runGenerateCodeWorkflow({
      topic,
      language,
      optimization,
      mode,
      profile,
    });
    const responseComplexity = resolveComplexity(
      workflow.explanationResult.complexity,
      workflow.generated.code
    );

    await logActivity(supabase, user.id, 'code_generated', 'code', undefined, {
      topic,
      language: workflow.generated.language,
      optimization,
      mode,
      codeModel: workflow.usedCodeModel,
      explanationModel: workflow.explanationResult.model,
      usedFallback: workflow.usedFallback,
      generationTimeMs: workflow.generationTimeMs,
    });

    return jsonResponse({
      ...workflow.generated,
      explanation: workflow.explanationResult.explanation,
      complexity: responseComplexity,
      debuggingTips: workflow.explanationResult.debuggingTips,
      optimization,
      mode,
      degraded: workflow.usedFallback,
      generationTimeMs: workflow.generationTimeMs,
    });
  } catch (error) {
    console.error('[LearnSphere] Generate code error:', error);

    if (error instanceof OpenRouterError) {
      if (error.message.includes('OPENROUTER_API_KEY not configured')) {
        return errorResponse('OPENROUTER_API_KEY is not configured for the generate-code function.', 500);
      }

      if (error.statusCode === 401 || error.statusCode === 403) {
        return errorResponse('The AI provider credentials are invalid or expired.', 502);
      }

      return errorResponse('AI service unavailable', 502);
    }

    if (error instanceof Error && error.name === 'AuthError') {
      return errorResponse(error.message, 401);
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
