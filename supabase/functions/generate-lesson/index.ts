// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

declare const Deno: any;

import { nanoid } from 'https://esm.sh/nanoid@5';
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import {
  createSupabaseClient,
  getUser,
  getRateLimitStatus,
  logActivity,
  AuthError,
  ConfigError,
} from '../_shared/supabase.ts';
import {
  callOpenRouter,
  streamOpenRouter,
  OpenRouterMessage,
  OpenRouterError,
  extractJSON,
} from '../_shared/openrouter.ts';
import { FULL_ELITE_PROMPT, CONTINUATION_PROMPT_TEMPLATE, SYSTEM_PROMPTS, buildUserPrompt, getSystemPromptForLevel } from '../_shared/elite-prompt.ts';
import { validateEliteOutput } from '../_shared/elite-validator.ts';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';

interface GenerateLessonRequest {
  topic: string;
  difficulty?: Difficulty;
  includeQuiz?: boolean;
  forceFresh?: boolean;
  stream?: boolean;
}

interface LessonBullet {
  label: string;
  detail: string;
}

interface LessonCommonMistake {
  mistake: string;
  fix: string;
}

interface LessonCodeBlock {
  language: string;
  caption?: string;
  src: string;
}

interface LessonSection {
  heading: string;
  body: string;
  bullets: LessonBullet[];
  code?: LessonCodeBlock;
  deep_dive?: string;
  common_mistakes?: LessonCommonMistake[];
}

interface PartialLesson {
  title?: string;
  summary?: string;
  sections?: LessonSection[];
  key_takeaways?: string[];
  questions?: string[];
  difficulty?: string;
  is_complete?: boolean;
  partial?: boolean;
  next_section_index?: number;
}

interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  sectionRef?: string;
}

type QuizGenerationStatus = 'generated' | 'skipped' | 'failed';

interface QualityGateResult {
  passed: boolean;
  reasons: string[];
}

interface SimilarLessonResult {
  slug: string;
  topic: string;
}

interface GeneratedLessonResult {
  lesson: PartialLesson;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  continuationCount: number;
  regenerationCount: number;
  rawPreview: string;
  qualityReasons: string[];
  qualityFlag: 'ok' | 'below_threshold' | 'regenerated';
}

const VALID_DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
const ROLLING_DAY_MS = 24 * 60 * 60 * 1000;
const DEDUP_WINDOW_MS = 60 * ROLLING_DAY_MS;

const RATE_LIMITS = {
  free: 15,
  pro: 25,
  unlimited: 999,
} as const;

const OPENROUTER_FREE_MODEL = 'openrouter/free';

const LESSON_ROUTE_BY_DIFFICULTY = {
  beginner: 'fast',
  intermediate: 'fast',
  advanced: 'balanced',
} as const;

const LESSON_TIMEOUT_MS_BY_DIFFICULTY = {
  beginner: 30000,
  intermediate: 52000,
  advanced: 76000,
} as const;

const LESSON_MAX_TOKENS_BY_DIFFICULTY = {
  beginner: 3200,
  intermediate: 6200,
  advanced: 7800,
} as const;

const LESSON_MAX_CONTINUATIONS_BY_DIFFICULTY = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
} as const;

const LESSON_STREAM_MAX_TOKENS_BY_DIFFICULTY = {
  beginner: 3000,
  intermediate: 5000,
  advanced: 6600,
} as const;

const DEFAULT_INCLUDE_QUIZ = false;
const QUIZ_MIN_VALID_QUESTIONS = 3;
const QUIZ_MAX_ATTEMPTS = 2;
const QUIZ_TOTAL_BUDGET_MS = 14000;
const QUIZ_ATTEMPT_TIMEOUT_MS = 9000;

const LESSON_OPENROUTER_FREE_MODELS = [
  OPENROUTER_FREE_MODEL,
];

const QUIZ_OPENROUTER_FREE_MODELS = [
  OPENROUTER_FREE_MODEL,
];

const INJECTION_PATTERNS = [
  /ignore (previous|all|above)/i,
  /system\s*:/i,
  /###\s*(instruction|system|prompt)/i,
  /<script/i,
  /\[INST\]/i,
  /<<SYS>>/i,
];

const QUIZ_SYSTEM_PROMPT = `You create premium multiple-choice quizzes for LearnSphere lessons.

Preferred output format is JSON in this exact shape:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "One or two sentences explaining why the answer is correct.",
      "sectionRef": "Exact section heading this question references"
    }
  ]
}

If strict JSON is unreliable for the selected model, return plain text using this format per question:
Q1: Question text
A) Option A
B) Option B
C) Option C
D) Option D
Answer: A
Explanation: One or two sentences explaining why the answer is correct.
Section: Exact section heading this question references

Rules:
- Generate exactly 5 questions.
- Exactly 4 options per question.
- Exactly 1 correct answer.
- Make incorrect answers plausible but distinguishable.
- Use the lesson content only.
- Keep explanations concise and reinforcing.
- Prefer one question per section when possible.
- Return exactly one format (JSON or plain text blocks). No commentary outside that output.`;

class LessonParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LessonParseError';
  }
}

const log = {
  info: (event: string, data: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: 'info', service: 'learnsphere', event, ts: Date.now(), ...data })),
  warn: (event: string, data: Record<string, unknown>) =>
    console.warn(JSON.stringify({ level: 'warn', service: 'learnsphere', event, ts: Date.now(), ...data })),
  error: (event: string, data: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: 'error', service: 'learnsphere', event, ts: Date.now(), ...data })),
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, reason: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(reason)), timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function summarizeTopic(topic: string) {
  return topic.slice(0, 50);
}

function maskUserId(userId: string) {
  return userId ? userId.slice(-8) : 'unknown';
}

function buildLogContext(userId: string, topic: string, difficulty: Difficulty) {
  return {
    userId: maskUserId(userId),
    topic: summarizeTopic(topic),
    difficulty,
  };
}

function getLessonModelCandidates(route: 'fast' | 'balanced' | 'deep') {
  return LESSON_OPENROUTER_FREE_MODELS;
}

function getQuizModelCandidates(route: 'fast' | 'balanced') {
  return QUIZ_OPENROUTER_FREE_MODELS;
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeForStorage(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function cleanText(value: unknown): string {
  return typeof value === 'string'
    ? sanitizeForStorage(value.replace(/\s+/g, ' ').trim())
    : '';
}

function cleanRichText(value: unknown): string {
  return typeof value === 'string'
    ? sanitizeForStorage(value.replace(/\r/g, '').trim())
    : '';
}

function dedupeStrings(values: string[]): string[] {
  return values.filter((item, index, list) =>
    list.findIndex((candidate) => candidate.trim().toLowerCase() === item.trim().toLowerCase()) === index
  );
}

function normalizeBullets(value: unknown): LessonBullet[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const label = cleanText(item?.label);
      const detail = cleanText(item?.detail);
      if (!label || !detail) return null;
      return {
        label,
        detail: detail.endsWith('.') ? detail : `${detail}.`,
      };
    })
    .filter(Boolean);
}

function normalizeCommonMistakes(value: unknown): LessonCommonMistake[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const mistake = cleanText(item?.mistake);
      const fix = cleanText(item?.fix);
      if (!mistake || !fix) return null;
      return { mistake, fix };
    })
    .filter(Boolean);
}

function normalizeSection(section: unknown, index: number): LessonSection | null {
  if (!section || typeof section !== 'object') return null;

  const heading = cleanText(section.heading) || `${index + 1}. Section ${index + 1}`;
  const body = cleanRichText(section.body);
  const bullets = normalizeBullets(section.bullets);
  const deepDive = cleanRichText(section.deep_dive);
  const commonMistakes = normalizeCommonMistakes(section.common_mistakes);
  const codeSrc = typeof section.code?.src === 'string' ? section.code.src.trim() : '';

  if (!body) return null;

  return {
    heading,
    body,
    bullets,
    code: codeSrc
      ? {
          language: cleanText(section.code?.language) || 'text',
          caption: cleanText(section.code?.caption) || undefined,
          src: codeSrc,
        }
      : undefined,
    deep_dive: deepDive || undefined,
    common_mistakes: commonMistakes.length > 0 ? commonMistakes : undefined,
  };
}

function normalizeLesson(rawLesson: PartialLesson, difficulty: Difficulty, topic: string): PartialLesson {
  const sections = Array.isArray(rawLesson.sections)
    ? rawLesson.sections
        .map((section, index) => normalizeSection(section, index))
        .filter(Boolean)
    : [];

  return {
    title: cleanText(rawLesson.title) || sanitizeForStorage(topic),
    summary: cleanRichText(rawLesson.summary) || `A ${difficulty} lesson about ${sanitizeForStorage(topic)}.`,
    sections,
    key_takeaways: dedupeStrings(
      Array.isArray(rawLesson.key_takeaways)
        ? rawLesson.key_takeaways.map(cleanText).filter(Boolean)
        : []
    ).slice(0, 7),
    questions: dedupeStrings(
      Array.isArray(rawLesson.questions)
        ? rawLesson.questions.map(cleanText).filter(Boolean)
        : []
    ).slice(0, 5),
    difficulty,
    is_complete: rawLesson.is_complete,
    partial: rawLesson.partial,
    next_section_index: typeof rawLesson.next_section_index === 'number'
      ? rawLesson.next_section_index
      : undefined,
  };
}

function mergeLesson(base: PartialLesson, continuation: PartialLesson): PartialLesson {
  const byHeading = new Map<string, LessonSection>();

  for (const section of [...(base.sections || []), ...(continuation.sections || [])]) {
    const key = cleanText(section.heading).toLowerCase();
    if (!key || byHeading.has(key)) continue;
    byHeading.set(key, section);
  }

  return {
    title: base.title || continuation.title,
    summary: base.summary || continuation.summary,
    difficulty: base.difficulty || continuation.difficulty,
    sections: Array.from(byHeading.values()),
    key_takeaways: dedupeStrings([...(base.key_takeaways || []), ...(continuation.key_takeaways || [])]),
    questions: dedupeStrings([...(base.questions || []), ...(continuation.questions || [])]),
    is_complete: continuation.is_complete ?? base.is_complete ?? false,
    partial: continuation.partial,
    next_section_index: continuation.next_section_index,
  };
}

function sectionsToMarkdown(lesson: PartialLesson): string {
  const parts: string[] = [];

  if (lesson.title) {
    parts.push(`# ${lesson.title}`);
    parts.push('');
  }

  if (lesson.summary) {
    parts.push(`**TL;DR:** ${lesson.summary}`);
    parts.push('');
  }

  for (const section of lesson.sections || []) {
    parts.push(`## ${section.heading}`);
    parts.push('');
    parts.push(section.body);
    parts.push('');

    if (section.bullets?.length) {
      for (const bullet of section.bullets) {
        parts.push(`- **${bullet.label}**: ${bullet.detail}`);
      }
      parts.push('');
    }

    if (section.deep_dive) {
      parts.push(`> **Deep Dive** ${section.deep_dive}`);
      parts.push('');
    }

    if (section.code?.src) {
      if (section.code.caption) {
        parts.push(`*${section.code.caption}*`);
      }
      parts.push(`\`\`\`${section.code.language || 'text'}`);
      parts.push(section.code.src);
      parts.push('```');
      parts.push('');
    }

    if (section.common_mistakes?.length) {
      parts.push('### Common Mistakes');
      parts.push('');
      for (const item of section.common_mistakes) {
        parts.push(`- **${item.mistake}** -> ${item.fix}`);
      }
      parts.push('');
    }
  }

  if (lesson.key_takeaways?.length) {
    parts.push('## Key Takeaways');
    parts.push('');
    for (const takeaway of lesson.key_takeaways) {
      parts.push(`- ${takeaway}`);
    }
    parts.push('');
  }

  if (lesson.questions?.length) {
    parts.push('## Practice Questions');
    parts.push('');
    lesson.questions.forEach((question, index) => {
      parts.push(`${index + 1}. ${question}`);
    });
    parts.push('');
  }

  return parts.join('\n').trim();
}

function buildInitialPrompt(topic: string, difficulty: Difficulty, qualityReasons: string[] = []) {
  // Use the enhanced user prompt template with level-specific context
  const userPrompt = buildUserPrompt(topic, difficulty, 'general', []);

  if (qualityReasons.length > 0) {
    return `${userPrompt}\n\nIMPORTANT: The previous response was incomplete. Fix these issues: ${qualityReasons.join(', ')}. Regenerate the lesson with all required sections, takeaways, and meaningful content.`;
  }

  return userPrompt;
}

function buildMarkdownFallbackPrompt(prompt: string) {
  return `${prompt}\n\nDo not return JSON in this attempt. Return markdown only with:\n# Title\n**TL;DR:** Summary\n## 1. Section heading\nBody paragraph\n- **Label**: detail\n> **Deep Dive** optional deeper note\n### Common Mistakes\n- mistake -> fix\n## Key Takeaways\n- takeaway\n## Practice Questions\n1. question\nis_complete: true|false\npartial: true|false (optional)\nnext_section_index: number (only if partial).`;
}

function parseLessonFromMarkdown(raw: string, difficulty: Difficulty, topic: string): PartialLesson | null {
  const normalized = String(raw || '').replace(/\r/g, '').trim();
  if (!normalized) return null;

  const titleMatch = normalized.match(/^#\s+(.+)$/m) || normalized.match(/^title\s*:\s*(.+)$/im);
  const tldrMatch = normalized.match(/^\*\*TL;DR:\*\*\s*(.+)$/im)
    || normalized.match(/^TL;DR\s*:\s*(.+)$/im)
    || normalized.match(/^summary\s*:\s*(.+)$/im);

  const sections: LessonSection[] = [];
  const keyTakeaways: string[] = [];
  const questions: string[] = [];

  const lines = normalized.split('\n');
  let currentHeading = '';
  let currentBuffer: string[] = [];

  const flushHeading = () => {
    if (!currentHeading) return;

    const headingLower = currentHeading.toLowerCase();
    const blockLines = currentBuffer.slice();
    const blockText = blockLines.join('\n').trim();

    if (headingLower.includes('key takeaway')) {
      for (const line of blockLines) {
        const takeawayMatch = line.match(/^\s*[-*]\s+(.+)$/);
        if (takeawayMatch?.[1]) {
          keyTakeaways.push(takeawayMatch[1].trim());
        }
      }
      return;
    }

    if (headingLower.includes('practice question') || headingLower.includes('quiz')) {
      for (const line of blockLines) {
        const questionMatch = line.match(/^\s*(?:\d+[.)]|[-*])\s+(.+)$/);
        if (questionMatch?.[1]) {
          questions.push(questionMatch[1].trim());
        }
      }
      return;
    }

    const bulletItems: LessonBullet[] = [];
    const commonMistakes: LessonCommonMistake[] = [];
    let deepDiveText = '';
    let inCodeFence = false;
    let inCommonMistakes = false;
    const collectedBody: string[] = [];

    for (const line of blockLines) {
      const trimmed = line.trim();

      if (/^```/.test(trimmed)) {
        inCodeFence = !inCodeFence;
        continue;
      }

      if (inCodeFence) {
        continue;
      }

      if (/^###\s+Common Mistakes/i.test(trimmed)) {
        inCommonMistakes = true;
        continue;
      }

      if (/^###\s+/.test(trimmed) && !/^###\s+Common Mistakes/i.test(trimmed)) {
        inCommonMistakes = false;
      }

      const mistakeMatch = trimmed.match(/^-\s+\*\*(.+?)\*\*\s*->\s*(.+)$/)
        || trimmed.match(/^-\s+(.+?)\s*->\s*(.+)$/);
      if (inCommonMistakes && mistakeMatch?.[1] && mistakeMatch?.[2]) {
        commonMistakes.push({
          mistake: mistakeMatch[1].trim(),
          fix: mistakeMatch[2].trim(),
        });
        continue;
      }

      const deepDiveMatch = trimmed.match(/^>\s*\*\*Deep Dive\*\*\s*(.+)$/i)
        || trimmed.match(/^Deep Dive\s*:\s*(.+)$/i);
      if (deepDiveMatch?.[1]) {
        deepDiveText = deepDiveMatch[1].trim();
        continue;
      }

      const bulletMatch = trimmed.match(/^-\s+\*\*(.+?)\*\*:\s*(.+)$/)
        || trimmed.match(/^-\s+([^:]{2,60})\s*:\s*(.+)$/);
      if (bulletMatch?.[1] && bulletMatch?.[2]) {
        bulletItems.push({
          label: bulletMatch[1].trim(),
          detail: bulletMatch[2].trim(),
        });
        continue;
      }

      if (trimmed.startsWith('>')) {
        continue;
      }

      if (trimmed.startsWith('*') && trimmed.endsWith('*')) {
        continue;
      }

      if (!inCommonMistakes) {
        collectedBody.push(line);
      }
    }

    const codeMatch = blockText.match(/```([a-zA-Z0-9+#._-]*)\n([\s\S]*?)```/);
    let code: LessonCodeBlock | undefined;
    if (codeMatch?.[2]) {
      const language = codeMatch[1]?.trim() || 'text';
      const source = codeMatch[2].trim();
      if (source) {
        const captionMatch = blockText
          .slice(0, codeMatch.index || 0)
          .match(/\*([^*\n]{3,140})\*\s*$/);

        code = {
          language,
          caption: captionMatch?.[1]?.trim() || undefined,
          src: source,
        };
      }
    }

    const body = collectedBody
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!body && bulletItems.length === 0 && !code) {
      return;
    }

    sections.push({
      heading: currentHeading,
      body: body || `This section covers ${currentHeading.toLowerCase()} in the context of ${topic}.`,
      bullets: bulletItems,
      code,
      deep_dive: deepDiveText || undefined,
      common_mistakes: commonMistakes.length > 0 ? commonMistakes : undefined,
    });
  };

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch?.[1]) {
      flushHeading();
      currentHeading = headingMatch[1].trim();
      currentBuffer = [];
      continue;
    }

    if (currentHeading) {
      currentBuffer.push(line);
    }
  }

  flushHeading();

  if (sections.length === 0) {
    return null;
  }

  const inferredSummary = (() => {
    if (tldrMatch?.[1]) {
      return tldrMatch[1].trim();
    }

    const preface = normalized.split(/\n##\s+/)[0] || '';
    const cleaned = preface
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !/^title\s*:/i.test(line))
      .join(' ');

    return cleaned || `A practical ${difficulty} lesson about ${topic}.`;
  })();

  const isCompleteMatch = normalized.match(/(?:^|\n)is_complete\s*[:=]\s*(true|false)/i);
  const partialMatch = normalized.match(/(?:^|\n)partial\s*[:=]\s*(true|false)/i);
  const nextSectionMatch = normalized.match(/(?:^|\n)next_section_index\s*[:=]\s*(\d+)/i);

  return {
    title: titleMatch?.[1]?.trim() || `${topic} lesson`,
    summary: inferredSummary,
    sections,
    key_takeaways: keyTakeaways,
    questions,
    difficulty,
    is_complete: isCompleteMatch ? isCompleteMatch[1].toLowerCase() === 'true' : true,
    partial: partialMatch ? partialMatch[1].toLowerCase() === 'true' : false,
    next_section_index: nextSectionMatch ? Number.parseInt(nextSectionMatch[1], 10) : undefined,
  };
}

function safeParseLesson(
  raw: string,
  topic: string,
  difficulty: Difficulty,
  context: Record<string, unknown> = {}
): PartialLesson | null {
  try {
    const extracted = extractJSON(raw);
    if (extracted && extracted.length >= 10) {
      const parsed = JSON.parse(extracted);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as PartialLesson;
      }
    }
  } catch {
    // Ignore JSON parsing errors and fall through to markdown parsing.
  }

  const markdownParsed = parseLessonFromMarkdown(raw, difficulty, topic);
  if (markdownParsed) {
    log.info('parse_markdown_fallback', {
      ...context,
      topic: summarizeTopic(topic),
      difficulty,
      rawLength: raw?.length ?? 0,
      preview: raw?.slice(0, 200) ?? '',
    });
    return markdownParsed;
  }

  log.warn('parse_failure', {
    ...context,
    topic: summarizeTopic(topic),
    difficulty,
    rawLength: raw?.length ?? 0,
    preview: raw?.slice(0, 200) ?? '',
    error: 'Unable to parse JSON or markdown lesson format',
  });

  return null;
}

type LessonOpenRouterOptions = {
  maxTokens?: number;
  temperature?: number;
  models?: string[];
  responseFormat?: Record<string, unknown>;
  route?: 'fast' | 'balanced' | 'deep';
  intent?: 'writing' | 'analysis' | 'general' | 'coding' | 'debugging' | 'brainstorm' | 'comparison';
  timeoutMs?: number;
  allowAnthropicFallback?: boolean;
};

function isTransientModelError(error: unknown, statusCode?: number) {
  if (statusCode === 429 || (typeof statusCode === 'number' && statusCode >= 500)) {
    return true;
  }

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes('timeout')
    || message.includes('timed out')
    || message.includes('abort')
    || message.includes('fetch failed')
    || message.includes('network')
    || message.includes('connection');
}

function isTokenBudgetError(error: unknown, statusCode?: number) {
  if (statusCode === 400 || statusCode === 413) {
    return true;
  }

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes('max_tokens')
    || message.includes('max tokens')
    || message.includes('token limit')
    || message.includes('context length')
    || message.includes('prompt is too long')
    || message.includes('request too large');
}

function buildTokenBudgetCandidates(maxTokens: number) {
  const primary = Math.max(1800, Math.floor(maxTokens));
  const candidates = [primary];

  // Keep beginner-like budgets to a single pass to avoid worker-limit spikes.
  if (primary >= 4500) {
    candidates.push(Math.max(1800, Math.floor(maxTokens * 0.78)));
  }

  return Array.from(new Set(candidates));
}

async function callWithRetry(
  messages: OpenRouterMessage[],
  options: LessonOpenRouterOptions,
  maxRetries = 2,
  context: Record<string, unknown> = {}
) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callOpenRouter(messages, {
        ...options,
        allowAnthropicFallback: options.allowAnthropicFallback ?? false,
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const statusCode = err instanceof OpenRouterError ? err.statusCode : undefined;
      const isRetryable = isTransientModelError(err, statusCode);

      if (!isRetryable || attempt === maxRetries) break;

      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 8000);
      log.warn('openrouter_retry', {
        ...context,
        attempt: attempt + 1,
        backoffMs,
        statusCode,
        error: lastError.message,
      });
      await sleep(backoffMs);
    }
  }

  throw lastError || new Error('OpenRouter call failed');
}

async function callLessonWithAdaptiveTokens(
  messages: OpenRouterMessage[],
  options: LessonOpenRouterOptions,
  maxRetries = 2,
  context: Record<string, unknown> = {}
) {
  const baseMaxTokens = options.maxTokens || 2600;
  const tokenBudgets = buildTokenBudgetCandidates(baseMaxTokens);
  let lastError: Error | null = null;

  for (let budgetIndex = 0; budgetIndex < tokenBudgets.length; budgetIndex++) {
    const tokenBudget = tokenBudgets[budgetIndex];
    try {
      return await callWithRetry(
        messages,
        {
          ...options,
          maxTokens: tokenBudget,
        },
        maxRetries,
        {
          ...context,
          tokenBudget,
          tokenBudgetAttempt: budgetIndex + 1,
        }
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const statusCode = error instanceof OpenRouterError ? error.statusCode : undefined;
      const canLowerTokenBudget =
        isTokenBudgetError(error, statusCode) && budgetIndex < tokenBudgets.length - 1;

      if (!canLowerTokenBudget) {
        throw lastError;
      }

      log.warn('openrouter_token_budget_fallback', {
        ...context,
        tokenBudget,
        nextTokenBudget: tokenBudgets[budgetIndex + 1],
        statusCode,
        error: lastError.message,
      });
    }
  }

  throw lastError || new Error('OpenRouter call failed');
}

function accumulateUsage(
  totalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  systemPromptTokenEstimate: number
) {
  if (!usage) return;

  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const adjustedPromptTokens = totalUsage.prompt_tokens === 0
    ? promptTokens
    : Math.max(0, promptTokens - systemPromptTokenEstimate);

  totalUsage.prompt_tokens += adjustedPromptTokens;
  totalUsage.completion_tokens += completionTokens;
  totalUsage.total_tokens += usage.total_tokens || promptTokens + completionTokens;
}

function normalizeTopicWords(topic: string) {
  return Array.from(
    new Set(
      (topic.toLowerCase().match(/[a-z0-9]+/g) || [])
        .map((word) => word.trim())
        .filter((word) => word.length >= 3)
    )
  );
}

function wordOverlapScore(inputTopic: string, candidateTopic: string) {
  const inputWords = normalizeTopicWords(inputTopic);
  const candidateWords = new Set(normalizeTopicWords(candidateTopic));

  if (inputWords.length === 0) return 0;

  const overlap = inputWords.filter((word) => candidateWords.has(word)).length;
  return overlap / inputWords.length;
}

function hasPlaceholderHeading(heading: string) {
  const normalized = heading.replace(/^\d+[.)]?\s*/, '').trim().toLowerCase();
  return !normalized || /^section\s+\d+$/.test(normalized);
}

function checkQualityGate(
  lesson: PartialLesson,
  quizQuestions: QuizQuestion[] = [],
  requireQuiz: boolean = true
): QualityGateResult {
  const reasons: string[] = [];
  const sections = lesson.sections || [];
  const takeaways = lesson.key_takeaways || [];

  if (sections.length < 3) reasons.push('fewer than 3 sections');
  if (takeaways.length < 2) reasons.push('fewer than 2 takeaways');
  if (sections.some((section) => cleanRichText(section.body).length < 50)) reasons.push('section body too short');
  if (sections.some((section) => hasPlaceholderHeading(section.heading))) reasons.push('placeholder section heading');
  if (requireQuiz && quizQuestions.length < QUIZ_MIN_VALID_QUESTIONS) reasons.push('fewer than 3 quiz questions');

  return { passed: reasons.length === 0, reasons };
}

function determineQuizGenerationStatus(includeQuiz: boolean, quizQuestions: QuizQuestion[]): QuizGenerationStatus {
  if (!includeQuiz) return 'skipped';
  return quizQuestions.length >= QUIZ_MIN_VALID_QUESTIONS ? 'generated' : 'failed';
}

function summarizeQuizFailure(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason || 'Unknown quiz generation failure');
  return cleanText(message).slice(0, 240) || 'Unknown quiz generation failure';
}

function estimateWordCount(lesson: PartialLesson) {
  const allText = [
    lesson.summary || '',
    ...(lesson.sections || []).flatMap((section) => [
      section.body,
      ...(section.bullets || []).map((bullet) => `${bullet.label} ${bullet.detail}`),
      section.deep_dive || '',
    ]),
    ...(lesson.key_takeaways || []),
  ]
    .join(' ')
    .trim();

  return allText ? allText.split(/\s+/).filter(Boolean).length : 0;
}

function estimateReadTimeMinutes(lesson: PartialLesson) {
  const wordCount = estimateWordCount(lesson);
  return Math.max(1, Math.ceil(wordCount / 200));
}

function buildQuizPrompt(topic: string, difficulty: Difficulty, lesson: PartialLesson) {
  const sections = (lesson.sections || [])
    .slice(0, 6)
    .map((section, index) => {
      const bullets = (section.bullets || [])
        .map((item) => `${item.label}: ${item.detail}`)
        .join(' | ');
      const mistakes = (section.common_mistakes || [])
        .map((item) => `${item.mistake} -> ${item.fix}`)
        .join(' | ');

      return [
        `Section ${index + 1}: ${section.heading}`,
        section.body,
        bullets ? `Bullets: ${bullets}` : '',
        section.deep_dive ? `Deep dive: ${section.deep_dive}` : '',
        mistakes ? `Common mistakes: ${mistakes}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return [
    `Topic: ${topic}`,
    `Difficulty: ${difficulty}`,
    lesson.summary ? `Summary: ${lesson.summary}` : '',
    lesson.key_takeaways?.length ? `Key takeaways: ${lesson.key_takeaways.join(' | ')}` : '',
    lesson.questions?.length ? `Open practice prompts: ${lesson.questions.join(' | ')}` : '',
    'Generate exactly 5 multiple-choice questions based on this lesson content:',
    sections,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function normalizeQuizQuestions(rawQuestions: unknown): QuizQuestion[] {
  if (!Array.isArray(rawQuestions)) {
    throw new Error('Quiz payload did not contain a questions array');
  }

  return rawQuestions
    .map((question) => {
      const title = cleanText(question?.question);
      const options = Array.isArray(question?.options)
        ? question.options.map(cleanText).filter(Boolean).slice(0, 4)
        : [];
      const explanation = cleanText(question?.explanation);
      const sectionRef = cleanText(question?.sectionRef || question?.sectionHeading) || undefined;
      const numericCorrectIndex = typeof question?.correctIndex === 'number'
        ? question.correctIndex
        : Number.parseInt(String(question?.correctIndex ?? ''), 10);

      if (!title || options.length !== 4 || !Number.isInteger(numericCorrectIndex) || numericCorrectIndex < 0 || numericCorrectIndex > 3) {
        return null;
      }

      return {
        question: title,
        options: [options[0], options[1], options[2], options[3]] as [string, string, string, string],
        correctIndex: numericCorrectIndex as 0 | 1 | 2 | 3,
        explanation: explanation || 'Review the matching section and compare each option carefully.',
        sectionRef,
      };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function parseQuizQuestionsFromPlainText(raw: string): QuizQuestion[] {
  const lines = String(raw || '').replace(/\r/g, '').split('\n');
  const blocks: string[][] = [];
  let currentBlock: string[] = [];
  const questionStartPattern = /^\s*(?:Q(?:uestion)?\s*\d*[:.)-]|\d+[.)])\s+/i;

  for (const line of lines) {
    if (questionStartPattern.test(line)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = [line.trim()];
      continue;
    }

    if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  return blocks
    .map((block) => {
      if (block.length === 0) return null;

      const title = cleanText(block[0].replace(/^\s*(?:Q(?:uestion)?\s*\d*[:.)-]|\d+[.)])\s*/i, ''));
      if (!title) return null;

      const options: string[] = [];
      let answerToken = '';
      let explanation = '';
      let sectionRef = '';

      for (const line of block.slice(1)) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const optionMatch = trimmed.match(/^\s*([A-D]|[1-4])[).:\-]\s*(.+)$/i);
        if (optionMatch?.[2]) {
          options.push(cleanText(optionMatch[2]));
          continue;
        }

        const answerMatch = trimmed.match(/^(?:Answer|Correct(?:\s+Answer)?|CorrectIndex)\s*[:\-]\s*(.+)$/i);
        if (answerMatch?.[1]) {
          answerToken = cleanText(answerMatch[1]).toUpperCase();
          continue;
        }

        const explanationMatch = trimmed.match(/^Explanation\s*[:\-]\s*(.+)$/i);
        if (explanationMatch?.[1]) {
          explanation = cleanText(explanationMatch[1]);
          continue;
        }

        const sectionMatch = trimmed.match(/^(?:Section|Section Heading|SectionRef)\s*[:\-]\s*(.+)$/i);
        if (sectionMatch?.[1]) {
          sectionRef = cleanText(sectionMatch[1]);
        }
      }

      if (options.length !== 4) {
        return null;
      }

      let correctIndex = -1;
      if (/^[A-D]$/.test(answerToken)) {
        correctIndex = answerToken.charCodeAt(0) - 65;
      } else {
        const parsedNumber = Number.parseInt(answerToken, 10);
        if (Number.isInteger(parsedNumber)) {
          if (parsedNumber >= 0 && parsedNumber <= 3) {
            correctIndex = parsedNumber;
          } else if (parsedNumber >= 1 && parsedNumber <= 4) {
            correctIndex = parsedNumber - 1;
          }
        }
      }

      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        return null;
      }

      return {
        question: title,
        options: [options[0], options[1], options[2], options[3]] as [string, string, string, string],
        correctIndex: correctIndex as 0 | 1 | 2 | 3,
        explanation: explanation || 'Review the matching section and compare each option carefully.',
        sectionRef: sectionRef || undefined,
      };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function parseGeneratedQuizQuestions(raw: string): QuizQuestion[] {
  try {
    const parsed = JSON.parse(extractJSON(raw));
    return normalizeQuizQuestions(parsed.questions);
  } catch {
    const plainTextQuestions = parseQuizQuestionsFromPlainText(raw);
    if (plainTextQuestions.length >= QUIZ_MIN_VALID_QUESTIONS) {
      return plainTextQuestions;
    }
    throw new Error('Quiz response could not be parsed as JSON or plain-text quiz format');
  }
}

async function generateQuizQuestions(topic: string, difficulty: Difficulty, lesson: PartialLesson) {
  const prompt = buildQuizPrompt(topic, difficulty, lesson);

  const strategies = [
    {
      route: 'fast' as const,
      intent: 'writing' as const,
      maxTokens: 1600,
      timeoutMs: 28000,
      models: getQuizModelCandidates('fast'),
    },
    {
      route: 'balanced' as const,
      intent: 'analysis' as const,
      maxTokens: 1800,
      timeoutMs: 34000,
      models: getQuizModelCandidates('balanced'),
    },
  ];

  let lastError: unknown = null;

  for (const strategy of strategies) {
    try {
      const result = await callWithRetry(
        [
          { role: 'system', content: QUIZ_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        {
          maxTokens: strategy.maxTokens,
          temperature: 0.3,
          models: strategy.models,
          route: strategy.route,
          intent: strategy.intent,
          timeoutMs: strategy.timeoutMs,
          allowAnthropicFallback: false,
        },
        2,
        {
          topic: summarizeTopic(topic),
          difficulty,
          route: strategy.route,
          phase: 'quiz_generation',
        }
      );

      const parsedQuestions = parseGeneratedQuizQuestions(result.content);
      return {
        provider: 'openrouter' as const,
        questions: parsedQuestions,
      };
    } catch (error) {
      lastError = error;
      log.warn('quiz_generation_complete', {
        topic: summarizeTopic(topic),
        difficulty,
        provider: 'openrouter',
        success: false,
        route: strategy.route,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Quiz generation failed');
}

function inferPlanTier(user: any) {
  const candidates = [
    user?.app_metadata?.plan,
    user?.user_metadata?.plan,
    user?.app_metadata?.subscription,
    user?.user_metadata?.subscription,
  ];

  const normalized = String(candidates.find(Boolean) || 'free').toLowerCase();
  if (normalized === 'pro') return 'pro';
  if (normalized === 'unlimited') return 'unlimited';
  return 'free';
}

function isExactTopicMatch(candidateTopic: unknown, requestedTopic: string) {
  return String(candidateTopic || '').trim().toLowerCase() === requestedTopic.trim().toLowerCase();
}

async function findExistingLesson(
  supabase: any,
  userId: string,
  topic: string,
  difficulty: Difficulty
) {
  const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();

  const { data: exactCandidates, error: exactError } = await supabase
    .from('lessons')
    .select('*')
    .eq('user_id', userId)
    .eq('difficulty_level', difficulty)
    .eq('is_deleted', false)
    .gte('created_at', dedupSince)
    .order('created_at', { ascending: false })
    .limit(25);

  if (exactError) {
    throw exactError;
  }

  const exactMatch = (exactCandidates || []).find((candidate: any) =>
    isExactTopicMatch(candidate.topic, topic)
  ) || null;

  const { data: recentLessons, error: recentError } = await supabase
    .from('lessons')
    .select('slug, topic, created_at, difficulty_level')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .gte('created_at', dedupSince)
    .order('created_at', { ascending: false })
    .limit(20);

  if (recentError) {
    throw recentError;
  }

  let similarLesson: SimilarLessonResult | null = null;
  let bestScore = 0;

  for (const candidate of recentLessons || []) {
    if (isExactTopicMatch(candidate.topic, topic)) continue;
    const score = wordOverlapScore(topic, String(candidate.topic || ''));
    if (score >= 0.8 && score > bestScore) {
      bestScore = score;
      similarLesson = {
        slug: candidate.slug,
        topic: candidate.topic,
      };
    }
  }

  return { exactMatch, similarLesson };
}

function buildLessonResponse(options: {
  lessonId?: string | null;
  slug: string;
  displayTitle: string;
  topic: string;
  summary: string;
  difficulty: Difficulty;
  content: string;
  sections: LessonSection[];
  keyTakeaways: string[];
  questions: string[];
  quizQuestions: QuizQuestion[];
  estimatedReadTimeMinutes: number;
  generationTimeMs: number;
  modelUsed: string;
  cached: boolean;
  qualityFlag: 'ok' | 'below_threshold' | 'regenerated';
  quizStatus: QuizGenerationStatus;
  quizRequested: boolean;
  quizProvider?: string | null;
  quizFailureReason?: string | null;
  similarLesson?: SimilarLessonResult | null;
}) {
  const normalizedSections = (Array.isArray(options.sections) ? options.sections : [])
    .map((section, index) => normalizeSection(section, index))
    .filter(Boolean);
  const normalizedKeyTakeaways = Array.isArray(options.keyTakeaways)
    ? options.keyTakeaways.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];
  const normalizedQuestions = Array.isArray(options.questions)
    ? options.questions.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];
  const normalizedQuizQuestions = Array.isArray(options.quizQuestions)
    ? options.quizQuestions.filter((item) => Boolean(item?.question) && Array.isArray(item?.options))
    : [];

  const hasCodeExamples = normalizedSections.some((section) => Boolean(section.code?.src));
  const hasDeepDives = normalizedSections.some((section) => Boolean(section.deep_dive));

  return {
    id: options.lessonId || null,
    slug: options.slug,
    title: options.displayTitle,
    topic: options.topic,
    summary: options.summary,
    difficulty: options.difficulty,
    content: options.content,
    sections: normalizedSections,
    key_takeaways: normalizedKeyTakeaways,
    questions: normalizedQuestions,
    quiz_questions: normalizedQuizQuestions,
    estimated_read_time_minutes: options.estimatedReadTimeMinutes,
    section_count: normalizedSections.length,
    has_code_examples: hasCodeExamples,
    has_deep_dives: hasDeepDives,
    generation_time_ms: options.generationTimeMs,
    generationTimeMs: options.generationTimeMs,
    model_used: options.modelUsed,
    cached: options.cached,
    quality_flag: options.qualityFlag,
    quiz_status: options.quizStatus,
    quiz_requested: options.quizRequested,
    quiz_generation: {
      status: options.quizStatus,
      requested: options.quizRequested,
      question_count: normalizedQuizQuestions.length,
      provider: options.quizProvider || null,
      failure_reason: options.quizFailureReason || null,
    },
    similar_lesson: options.similarLesson || null,
  };
}

function buildResponseHeaders(remaining: number, resetAt: string) {
  return {
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': resetAt,
  };
}

async function generateLessonWithContinuation(
  topic: string,
  difficulty: Difficulty,
  logContext: Record<string, unknown>,
  qualityReasons: string[] = []
): Promise<{ lesson: PartialLesson; model: string; usage: any; continuationCount: number; rawPreview: string }> {
  const route = LESSON_ROUTE_BY_DIFFICULTY[difficulty];
  const maxContinuations = LESSON_MAX_CONTINUATIONS_BY_DIFFICULTY[difficulty];
  const modelCandidates = getLessonModelCandidates(route);
  const timeoutMs = LESSON_TIMEOUT_MS_BY_DIFFICULTY[difficulty];
  const maxTokens = LESSON_MAX_TOKENS_BY_DIFFICULTY[difficulty];

  // Use level-specific system prompt
  const systemPrompt = getSystemPromptForLevel(difficulty);
  const systemPromptTokenEstimate = estimateTokens(systemPrompt);

  let accumulated: PartialLesson = {};
  let usedModel = '';
  let continuationCount = 0;
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let lastRawPreview = '';
  let userPrompt = buildInitialPrompt(topic, difficulty, qualityReasons);

  while (continuationCount <= maxContinuations) {
    const promptVariants = [userPrompt, buildMarkdownFallbackPrompt(userPrompt)];
    let parsedLesson: PartialLesson | null = null;
    const maxRetriesForDifficulty = difficulty === 'beginner' ? 0 : 1;

    for (let parseAttempt = 0; parseAttempt < promptVariants.length; parseAttempt++) {
      const messages: OpenRouterMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptVariants[parseAttempt] },
      ];

      log.info('parse_attempt', {
        ...logContext,
        continuationCount,
        parseAttempt: parseAttempt + 1,
      });

      const result = await callLessonWithAdaptiveTokens(
        messages,
        {
          maxTokens,
          temperature: difficulty === 'advanced' ? 0.45 : 0.35,
          models: modelCandidates,
          route,
          intent: 'writing',
          timeoutMs,
        },
        maxRetriesForDifficulty,
        {
          ...logContext,
          continuationCount,
          parseAttempt: parseAttempt + 1,
          route,
        }
      );

      usedModel = result.model;
      lastRawPreview = result.content.slice(0, 240);
      accumulateUsage(totalUsage, result.usage, systemPromptTokenEstimate);

      log.info('token_usage', {
        ...logContext,
        continuationCount,
        parseAttempt: parseAttempt + 1,
        model: usedModel,
        prompt_tokens: result.usage?.prompt_tokens || 0,
        completion_tokens: result.usage?.completion_tokens || 0,
        total_tokens: result.usage?.total_tokens || 0,
        accumulated_prompt_tokens: totalUsage.prompt_tokens,
        accumulated_completion_tokens: totalUsage.completion_tokens,
        accumulated_total_tokens: totalUsage.total_tokens,
      });

      const parsed = safeParseLesson(result.content, topic, difficulty, {
        ...logContext,
        continuationCount,
        parseAttempt: parseAttempt + 1,
        model: usedModel,
      });
      if (!parsed) {
        continue;
      }

      parsedLesson = normalizeLesson(parsed, difficulty, topic);
      log.info('parse_success', {
        ...logContext,
        continuationCount,
        parseAttempt: parseAttempt + 1,
        sectionCount: parsedLesson.sections?.length || 0,
      });
      break;
    }

    if (!parsedLesson) {
      throw new LessonParseError('AI returned malformed content, please try again');
    }

    accumulated = continuationCount === 0 ? parsedLesson : mergeLesson(accumulated, parsedLesson);

    if ((accumulated.sections || []).length === 0) {
      throw new Error('The lesson response did not contain any usable sections.');
    }

    if (parsedLesson.is_complete === true && !parsedLesson.partial) {
      return {
        lesson: accumulated,
        model: usedModel,
        usage: totalUsage,
        continuationCount,
        rawPreview: lastRawPreview,
      };
    }

    if (continuationCount >= maxContinuations) {
      accumulated.is_complete = true;
      break;
    }

    continuationCount += 1;
    const completedSections = (accumulated.sections || []).map((section) => section.heading);
    userPrompt = CONTINUATION_PROMPT_TEMPLATE(
      topic,
      difficulty,
      completedSections,
      parsedLesson.next_section_index || completedSections.length + 1,
      accumulated.title || topic,
      accumulated.summary || ''
    );
  }

  return {
    lesson: accumulated,
    model: usedModel,
    usage: totalUsage,
    continuationCount,
    rawPreview: lastRawPreview,
  };
}

async function generateLessonWithQualityGate(
  topic: string,
  difficulty: Difficulty,
  logContext: Record<string, unknown>
): Promise<GeneratedLessonResult> {
  const firstPass = await generateLessonWithContinuation(topic, difficulty, logContext);
  const firstGate = checkQualityGate(firstPass.lesson, [], false);

  log.info('quality_gate_result', {
    ...logContext,
    attempt: 1,
    passed: firstGate.passed,
    reasons: firstGate.reasons,
    preview: firstPass.rawPreview,
  });

  if (firstGate.passed) {
    return {
      ...firstPass,
      regenerationCount: 0,
      qualityReasons: firstGate.reasons,
      qualityFlag: 'ok',
    };
  }

  const secondPass = await generateLessonWithContinuation(topic, difficulty, logContext, firstGate.reasons);
  const secondGate = checkQualityGate(secondPass.lesson, [], false);

  log.info('quality_gate_result', {
    ...logContext,
    attempt: 2,
    passed: secondGate.passed,
    reasons: secondGate.reasons,
    preview: secondPass.rawPreview,
  });

  return {
    ...secondPass,
    regenerationCount: 1,
    qualityReasons: secondGate.reasons,
    qualityFlag: secondGate.passed ? 'regenerated' : 'below_threshold',
  };
}

function buildStreamingMarkdownPrompt(topic: string, difficulty: Difficulty) {
  return [
    `Create a ${difficulty} lesson about "${topic}" and stream it progressively.`,
    'Do not return JSON in this mode. Return markdown only.',
    'Write sections in order and fully complete each section before starting the next one.',
    'Use this structure exactly:',
    '# Title',
    '**TL;DR:** Short summary',
    '## 1. Section heading',
    'Section body paragraph',
    '- **Bullet label**: bullet detail',
    '> **Deep Dive** optional deeper point',
    '### Common Mistakes',
    '- mistake -> fix',
    '## Key Takeaways',
    '- takeaway',
    '## Practice Questions',
    '1. question',
    'At the end include: is_complete: true',
  ].join('\n');
}

function emitNewStreamedSections(
  markdown: string,
  topic: string,
  difficulty: Difficulty,
  emittedHeadings: Set<string>,
  onSection: (section: LessonSection, sectionCount: number, targetSectionCount: number) => void,
  targetSectionCount: number
) {
  const parsed = parseLessonFromMarkdown(markdown, difficulty, topic);
  if (!parsed?.sections?.length) return;

  for (let index = 0; index < parsed.sections.length; index++) {
    const candidate = parsed.sections[index];
    const headingKey = cleanText(candidate.heading).toLowerCase();
    if (!headingKey || emittedHeadings.has(headingKey)) continue;

    const normalizedSection = normalizeSection(candidate, index);
    if (!normalizedSection) continue;

    // Avoid emitting extremely short partial fragments.
    if (cleanRichText(normalizedSection.body).length < 30) continue;

    emittedHeadings.add(headingKey);
    onSection(normalizedSection, emittedHeadings.size, targetSectionCount);
  }
}

async function generateLessonWithStreamingChunks(
  topic: string,
  difficulty: Difficulty,
  logContext: Record<string, unknown>,
  onSection: (section: LessonSection, sectionCount: number, targetSectionCount: number) => void
): Promise<GeneratedLessonResult> {
  const route = LESSON_ROUTE_BY_DIFFICULTY[difficulty];
  const modelCandidates = getLessonModelCandidates(route);
  const streamingModels = modelCandidates;
  const timeoutMs = Math.max(22000, LESSON_TIMEOUT_MS_BY_DIFFICULTY[difficulty]);
  const maxTokens = LESSON_STREAM_MAX_TOKENS_BY_DIFFICULTY[difficulty];
  const targetSectionCount = difficulty === 'advanced' ? 6 : 5;

  // Use level-specific system prompt
  const systemPrompt = getSystemPromptForLevel(difficulty);

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildStreamingMarkdownPrompt(topic, difficulty) },
  ];

  const emittedHeadings = new Set<string>();
  let rawStreamed = '';
  let usedModel = '';

  try {
    for await (const part of streamOpenRouter(messages, {
      maxTokens,
      temperature: difficulty === 'advanced' ? 0.4 : 0.3,
      models: streamingModels,
      route,
      intent: 'writing',
      timeoutMs,
    })) {
      if (part.model && !usedModel) {
        usedModel = part.model;
      }

      if (!part.delta) {
        continue;
      }

      rawStreamed += part.delta;
      emitNewStreamedSections(
        rawStreamed,
        topic,
        difficulty,
        emittedHeadings,
        onSection,
        targetSectionCount
      );
    }
  } catch (error) {
    log.warn('stream_generation_non_stream_recovery', {
      ...logContext,
      error: error instanceof Error ? error.message : String(error),
      note: 'Streaming generation failed, retrying once with non-stream openrouter/free.',
    });

    const nonStreamResult = await callLessonWithAdaptiveTokens(
      messages,
      {
        maxTokens,
        temperature: difficulty === 'advanced' ? 0.4 : 0.3,
        models: [OPENROUTER_FREE_MODEL],
        route,
        intent: 'writing',
        timeoutMs: Math.max(28000, timeoutMs + 8000),
        allowAnthropicFallback: false,
      },
      1,
      {
        ...logContext,
        phase: 'stream_non_stream_recovery',
      }
    );

    if (!usedModel) {
      usedModel = nonStreamResult.model || OPENROUTER_FREE_MODEL;
    }

    rawStreamed = nonStreamResult.content || rawStreamed;
    emitNewStreamedSections(
      rawStreamed,
      topic,
      difficulty,
      emittedHeadings,
      onSection,
      targetSectionCount
    );
  }

  const parsedLesson = safeParseLesson(rawStreamed, topic, difficulty, {
    ...logContext,
    phase: 'streaming_final_parse',
    model: usedModel,
  });

  if (!parsedLesson) {
    throw new LessonParseError('AI returned malformed content, please try again');
  }

  const normalizedLesson = normalizeLesson(parsedLesson, difficulty, topic);
  const finalizedSections = Array.isArray(normalizedLesson.sections) ? normalizedLesson.sections : [];

  for (let index = 0; index < finalizedSections.length; index++) {
    const section = finalizedSections[index];
    const headingKey = cleanText(section.heading).toLowerCase();
    if (!headingKey || emittedHeadings.has(headingKey)) continue;
    emittedHeadings.add(headingKey);
    onSection(section, emittedHeadings.size, targetSectionCount);
  }

  if (!normalizedLesson.key_takeaways?.length) {
    normalizedLesson.key_takeaways = finalizedSections
      .slice(0, 5)
      .map((section) => `Understand the key idea behind ${cleanText(section.heading).replace(/^\d+[.)]?\s*/, '')}.`);
  }

  if (!normalizedLesson.questions?.length) {
    normalizedLesson.questions = finalizedSections
      .slice(0, 4)
      .map((section) => `How would you apply ${cleanText(section.heading).replace(/^\d+[.)]?\s*/, '')} in a practical scenario?`);
  }

  const qualityGate = checkQualityGate(normalizedLesson, [], false);

  return {
    lesson: normalizedLesson,
    model: usedModel || modelCandidates[0],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
    continuationCount: 0,
    regenerationCount: 0,
    rawPreview: rawStreamed.slice(0, 240),
    qualityReasons: qualityGate.reasons,
    qualityFlag: qualityGate.passed ? 'ok' : 'below_threshold',
  };
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const requestStartedAt = Date.now();
  log.info('request_received', { method: req.method, ts: requestStartedAt });

  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }

    const supabase = createSupabaseClient(req);
    const user = await getUser(supabase);

    let body: GenerateLessonRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400, 'INVALID_JSON');
    }

    const topic = body.topic;
    if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
      return errorResponse('Topic is required and must be at least 2 characters', 400, 'TOPIC_REQUIRED');
    }

    if (topic.length > 500) {
      return errorResponse('Topic is too long (max 500 characters)', 400, 'TOPIC_TOO_LONG');
    }

    const trimmedTopic = topic.trim();
    const alphabeticCount = (trimmedTopic.match(/[a-z]/gi) || []).length;
    if (alphabeticCount < 3) {
      return errorResponse('Topic must contain at least 3 alphabetic characters', 400, 'TOPIC_NOT_MEANINGFUL');
    }

    if (INJECTION_PATTERNS.some((pattern) => pattern.test(trimmedTopic))) {
      return errorResponse('Topic contains invalid content', 400, 'TOPIC_INJECTION_DETECTED');
    }

    const difficultyInput = String(body.difficulty || 'beginner').toLowerCase();
    if (!VALID_DIFFICULTIES.includes(difficultyInput as Difficulty)) {
      return errorResponse(
        `difficulty must be one of: beginner, intermediate, advanced. Got: "${difficultyInput}"`,
        400,
        'INVALID_DIFFICULTY'
      );
    }

    const normalizedDifficulty = difficultyInput as Difficulty;
    const includeQuiz = body.includeQuiz === true ? true : DEFAULT_INCLUDE_QUIZ;
    const forceFresh = body.forceFresh === true;
    const streamRequested = body.stream === true;
    const logContext = buildLogContext(user.id, trimmedTopic, normalizedDifficulty);

    log.info('auth_success', logContext);
    log.info('request_options', {
      ...logContext,
      includeQuiz,
      forceFresh,
      streamRequested,
    });

    let exactMatch: any = null;
    let similarLesson: SimilarLessonResult | null = null;

    if (!forceFresh) {
      const existingLesson = await findExistingLesson(
        supabase,
        user.id,
        trimmedTopic,
        normalizedDifficulty
      );

      exactMatch = existingLesson.exactMatch;
      similarLesson = existingLesson.similarLesson;

      log.info('dedup_check', {
        ...logContext,
        dedupSkipped: false,
        exactMatch: Boolean(exactMatch),
        similarLesson: similarLesson?.slug || null,
      });
    } else {
      log.info('dedup_check', {
        ...logContext,
        dedupSkipped: true,
        exactMatch: false,
        similarLesson: null,
      });
    }

    const planTier = inferPlanTier(user);
    const rateLimitStatus = await getRateLimitStatus(
      supabase,
      user.id,
      'lesson_generated',
      RATE_LIMITS[planTier],
      ROLLING_DAY_MS
    );

    log.info('rate_limit_checked', {
      ...logContext,
      planTier,
      count: rateLimitStatus.count,
      remaining: rateLimitStatus.remaining,
      resetAt: rateLimitStatus.resetAt,
      withinLimit: rateLimitStatus.withinLimit,
    });

    if (exactMatch && !streamRequested) {
      const cachedSections = Array.isArray(exactMatch.metadata?.sections) ? exactMatch.metadata.sections : [];
      const cachedQuizQuestions = Array.isArray(exactMatch.quiz_questions) ? exactMatch.quiz_questions : [];
      const cachedTakeaways = Array.isArray(exactMatch.key_takeaways) ? exactMatch.key_takeaways : [];
      const cachedQuestions = Array.isArray(exactMatch.questions) ? exactMatch.questions : [];
      const cachedQuizStatus = determineQuizGenerationStatus(includeQuiz, cachedQuizQuestions);
      const cachedQuizFailureReason = includeQuiz && cachedQuizQuestions.length < QUIZ_MIN_VALID_QUESTIONS
        ? 'No valid quiz questions are available in the cached lesson.'
        : null;
      const cachedEstimatedReadTime = typeof exactMatch.estimated_read_time_minutes === 'number'
        ? exactMatch.estimated_read_time_minutes
        : estimateReadTimeMinutes({
            summary: exactMatch.summary || '',
            sections: cachedSections,
            key_takeaways: cachedTakeaways,
          });

      const payload = buildLessonResponse({
        lessonId: exactMatch.id,
        slug: exactMatch.slug,
        displayTitle: exactMatch.metadata?.generated_title || exactMatch.topic,
        topic: exactMatch.topic,
        summary: exactMatch.summary || '',
        difficulty: exactMatch.difficulty_level,
        content: exactMatch.content || '',
        sections: cachedSections,
        keyTakeaways: cachedTakeaways,
        questions: cachedQuestions,
        quizQuestions: cachedQuizQuestions,
        estimatedReadTimeMinutes: cachedEstimatedReadTime,
        generationTimeMs: exactMatch.generation_time_ms || 0,
        modelUsed: exactMatch.ai_model_used || '',
        cached: true,
        qualityFlag: exactMatch.quality_flag || 'ok',
        quizStatus: cachedQuizStatus,
        quizRequested: includeQuiz,
        quizProvider: exactMatch.metadata?.generation_strategy?.quiz_provider || null,
        quizFailureReason: cachedQuizFailureReason,
        similarLesson: null,
      });

      log.info('response_sent', {
        ...logContext,
        cached: true,
        durationMs: Date.now() - requestStartedAt,
      });

      return jsonResponse(
        payload,
        200,
        buildResponseHeaders(rateLimitStatus.remaining, rateLimitStatus.resetAt)
      );
    }

    if (streamRequested) {
      const streamHeaders = {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        ...buildResponseHeaders(rateLimitStatus.remaining, rateLimitStatus.resetAt),
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
                topic: trimmedTopic,
                difficulty: normalizedDifficulty,
              });

              if (exactMatch) {
                const cachedSections = Array.isArray(exactMatch.metadata?.sections) ? exactMatch.metadata.sections : [];
                const cachedQuizQuestions = Array.isArray(exactMatch.quiz_questions) ? exactMatch.quiz_questions : [];
                const cachedTakeaways = Array.isArray(exactMatch.key_takeaways) ? exactMatch.key_takeaways : [];
                const cachedQuestions = Array.isArray(exactMatch.questions) ? exactMatch.questions : [];
                const cachedQuizStatus = determineQuizGenerationStatus(includeQuiz, cachedQuizQuestions);
                const cachedQuizFailureReason = includeQuiz && cachedQuizQuestions.length < QUIZ_MIN_VALID_QUESTIONS
                  ? 'No valid quiz questions are available in the cached lesson.'
                  : null;
                const cachedEstimatedReadTime = typeof exactMatch.estimated_read_time_minutes === 'number'
                  ? exactMatch.estimated_read_time_minutes
                  : estimateReadTimeMinutes({
                      summary: exactMatch.summary || '',
                      sections: cachedSections,
                      key_takeaways: cachedTakeaways,
                    });

                for (let index = 0; index < cachedSections.length; index++) {
                  emit('section', {
                    section: cachedSections[index],
                    section_count: index + 1,
                    target_sections: cachedSections.length,
                    cached: true,
                  });
                }

                const payload = buildLessonResponse({
                  lessonId: exactMatch.id,
                  slug: exactMatch.slug,
                  displayTitle: exactMatch.metadata?.generated_title || exactMatch.topic,
                  topic: exactMatch.topic,
                  summary: exactMatch.summary || '',
                  difficulty: exactMatch.difficulty_level,
                  content: exactMatch.content || '',
                  sections: cachedSections,
                  keyTakeaways: cachedTakeaways,
                  questions: cachedQuestions,
                  quizQuestions: cachedQuizQuestions,
                  estimatedReadTimeMinutes: cachedEstimatedReadTime,
                  generationTimeMs: exactMatch.generation_time_ms || 0,
                  modelUsed: exactMatch.ai_model_used || '',
                  cached: true,
                  qualityFlag: exactMatch.quality_flag || 'ok',
                  quizStatus: cachedQuizStatus,
                  quizRequested: includeQuiz,
                  quizProvider: exactMatch.metadata?.generation_strategy?.quiz_provider || null,
                  quizFailureReason: cachedQuizFailureReason,
                  similarLesson: null,
                });

                emit('complete', {
                  ...payload,
                  rate_limit_remaining: rateLimitStatus.remaining,
                  rate_limit_reset: rateLimitStatus.resetAt,
                });

                log.info('response_sent', {
                  ...logContext,
                  cached: true,
                  streamRequested: true,
                  durationMs: Date.now() - requestStartedAt,
                });

                return;
              }

              if (!rateLimitStatus.withinLimit) {
                emit('error', {
                  error: `Daily lesson generation limit reached (${RATE_LIMITS[planTier]}/day)`,
                  code: 'RATE_LIMIT_EXCEEDED',
                  status: 429,
                  rate_limit_remaining: rateLimitStatus.remaining,
                  rate_limit_reset: rateLimitStatus.resetAt,
                });
                return;
              }

              emit('status', { message: 'generation_started' });
              const generationStartedAt = Date.now();
              const generated = await generateLessonWithStreamingChunks(
                trimmedTopic,
                normalizedDifficulty,
                logContext,
                (section, sectionCount, targetSectionCount) => {
                  emit('section', {
                    section,
                    section_count: sectionCount,
                    target_sections: targetSectionCount,
                    cached: false,
                  });
                }
              );

              const lessonData = generated.lesson;
              const generationTimeMs = Date.now() - generationStartedAt;
              const lessonSections = Array.isArray(lessonData.sections) ? lessonData.sections : [];

              log.info('generation_complete', {
                ...logContext,
                durationMs: generationTimeMs,
                sectionCount: lessonSections.length,
                continuationCount: generated.continuationCount,
                regenerationCount: generated.regenerationCount,
                model: generated.model,
                streamRequested: true,
              });

              if (lessonSections.length === 0) {
                emit('error', {
                  error: 'Failed to generate lesson content',
                  code: 'GENERATION_FAILED',
                  status: 502,
                });
                return;
              }

              emit('status', { message: 'quiz_generation' });
              let quizQuestions: QuizQuestion[] = [];
              let quizProvider = '';
              let quizFailureReason: string | null = null;
              let quizAttempts = 0;

              if (includeQuiz) {
                const quizDeadlineMs = Date.now() + QUIZ_TOTAL_BUDGET_MS;

                for (let quizAttempt = 1; quizAttempt <= QUIZ_MAX_ATTEMPTS; quizAttempt++) {
                  quizAttempts = quizAttempt;
                  const remainingBudgetMs = quizDeadlineMs - Date.now();
                  if (remainingBudgetMs <= 0) {
                    quizFailureReason = `Quiz budget exceeded (${QUIZ_TOTAL_BUDGET_MS}ms).`;
                    break;
                  }

                  const attemptTimeoutMs = Math.min(QUIZ_ATTEMPT_TIMEOUT_MS, remainingBudgetMs);
                  const [quizResult] = await Promise.allSettled([
                    withTimeout(
                      generateQuizQuestions(trimmedTopic, normalizedDifficulty, lessonData),
                      attemptTimeoutMs,
                      `Quiz generation attempt exceeded ${attemptTimeoutMs}ms.`
                    ),
                  ]);

                  if (quizResult.status === 'fulfilled') {
                    quizQuestions = quizResult.value.questions;
                    quizProvider = quizResult.value.provider;
                    if (quizQuestions.length >= QUIZ_MIN_VALID_QUESTIONS) {
                      quizFailureReason = null;
                      break;
                    }
                    quizFailureReason = `Only ${quizQuestions.length} valid questions returned.`;
                  } else {
                    quizFailureReason = summarizeQuizFailure(quizResult.reason);
                  }
                }

                if (quizQuestions.length < QUIZ_MIN_VALID_QUESTIONS && !quizFailureReason) {
                  quizFailureReason = 'Quiz generation did not return enough valid questions.';
                }
              }

              const quizStatus = determineQuizGenerationStatus(includeQuiz, quizQuestions);

              const finalQuality = checkQualityGate(lessonData, quizQuestions, includeQuiz);
              const qualityFlag = generated.qualityFlag === 'regenerated' && finalQuality.passed
                ? 'regenerated'
                : finalQuality.passed
                  ? 'ok'
                  : 'below_threshold';

              const markdownContent = sectionsToMarkdown(lessonData);
              const validationReport = validateEliteOutput(markdownContent);
              const wordCount = estimateWordCount(lessonData);
              const estimatedReadTime = estimateReadTimeMinutes(lessonData);
              const finalTitle = lessonData.title || sanitizeForStorage(trimmedTopic);
              const finalSummary = lessonData.summary || `A comprehensive ${normalizedDifficulty} lesson about ${sanitizeForStorage(trimmedTopic)}.`;
              const finalKeyTakeaways = Array.isArray(lessonData.key_takeaways) ? lessonData.key_takeaways : [];
              const finalQuestions = Array.isArray(lessonData.questions) ? lessonData.questions : [];
              const hasCodeExamples = lessonSections.some((section) => Boolean(section.code?.src));
              const hasDeepDives = lessonSections.some((section) => Boolean(section.deep_dive));

              let slug = `${toKebabCase(finalTitle || trimmedTopic) || toKebabCase(trimmedTopic)}-${nanoid(6)}`;
              let lesson = null;
              let insertError = null;

              for (let attempt = 0; attempt < 2; attempt++) {
                const insertResult = await supabase
                  .from('lessons')
                  .insert({
                    user_id: user.id,
                    topic: trimmedTopic,
                    slug,
                    content: markdownContent,
                    summary: finalSummary,
                    key_takeaways: finalKeyTakeaways,
                    examples: [],
                    questions: finalQuestions,
                    quiz_questions: quizQuestions,
                    difficulty_level: normalizedDifficulty,
                    ai_model_used: generated.model,
                    generation_time_ms: generationTimeMs,
                    estimated_read_time_minutes: estimatedReadTime,
                    quality_flag: qualityFlag,
                    has_code_examples: hasCodeExamples,
                    has_deep_dives: hasDeepDives,
                    word_count: wordCount,
                    metadata: {
                      generated_title: finalTitle,
                      usage: generated.usage,
                      sections: lessonSections,
                      structured_format: true,
                      validation: validationReport,
                      generation_strategy: {
                        route: LESSON_ROUTE_BY_DIFFICULTY[normalizedDifficulty],
                        timeout_ms: LESSON_TIMEOUT_MS_BY_DIFFICULTY[normalizedDifficulty],
                        continuation_count: generated.continuationCount,
                        regeneration_count: generated.regenerationCount,
                        include_quiz: includeQuiz,
                        force_fresh: forceFresh,
                        quiz_provider: quizProvider || null,
                        quiz_status: quizStatus,
                        quiz_attempts: quizAttempts,
                        quiz_question_count: quizQuestions.length,
                        quiz_failure_reason: quizFailureReason,
                        stream_requested: true,
                      },
                      quality_gate: {
                        passed: finalQuality.passed,
                        reasons: finalQuality.reasons,
                      },
                    },
                  })
                  .select()
                  .single();

                lesson = insertResult.data;
                insertError = insertResult.error;

                if (insertError?.code === '23505' && insertError.message?.includes('slug') && attempt === 0) {
                  slug = `${toKebabCase(finalTitle || trimmedTopic) || toKebabCase(trimmedTopic)}-${nanoid(6)}`;
                  continue;
                }

                break;
              }

              if (insertError || !lesson) {
                emit('error', {
                  error: 'Failed to save lesson',
                  code: 'DB_INSERT_FAILED',
                  status: 500,
                });
                return;
              }

              logActivity(supabase, user.id, 'lesson_generated', 'lesson', lesson.id, {
                topic: trimmedTopic,
                model: generated.model,
                generation_time_ms: generationTimeMs,
                section_count: lessonSections.length,
                continuation_count: generated.continuationCount,
                quality_flag: qualityFlag,
                quiz_requested: includeQuiz,
                quiz_generated: quizStatus === 'generated',
                quiz_status: quizStatus,
                quiz_question_count: quizQuestions.length,
                quiz_failure_reason: quizFailureReason,
                estimated_read_time_minutes: estimatedReadTime,
                stream_requested: true,
              }).catch((error) => {
                log.error('activity_log_failed', {
                  ...logContext,
                  lessonId: lesson.id,
                  error: error instanceof Error ? error.message : String(error),
                });
              });

              const payload = buildLessonResponse({
                lessonId: lesson.id,
                slug: lesson.slug,
                displayTitle: finalTitle,
                topic: trimmedTopic,
                summary: finalSummary,
                difficulty: normalizedDifficulty,
                content: markdownContent,
                sections: lessonSections,
                keyTakeaways: finalKeyTakeaways,
                questions: finalQuestions,
                quizQuestions,
                estimatedReadTimeMinutes: estimatedReadTime,
                generationTimeMs,
                modelUsed: generated.model,
                cached: false,
                qualityFlag,
                quizStatus,
                quizRequested: includeQuiz,
                quizProvider: quizProvider || null,
                quizFailureReason,
                similarLesson,
              });

              emit('complete', {
                ...payload,
                rate_limit_remaining: Math.max(0, rateLimitStatus.remaining - 1),
                rate_limit_reset: rateLimitStatus.resetAt,
              });

              log.info('response_sent', {
                ...logContext,
                cached: false,
                durationMs: Date.now() - requestStartedAt,
                qualityFlag,
                includeQuiz,
                quizCount: quizQuestions.length,
                quizStatus,
                streamRequested: true,
              });
            } catch (error) {
              log.error('response_sent', {
                error: error instanceof Error ? error.message : String(error),
                durationMs: Date.now() - requestStartedAt,
                streamRequested: true,
              });

              const defaultMessage = error instanceof Error ? error.message : 'Internal server error';
              const message = error instanceof OpenRouterError
                ? 'Free model pool is busy right now. Please retry in a few seconds.'
                : defaultMessage;
              const code = error instanceof LessonParseError
                ? 'PARSE_FAILED'
                : error instanceof OpenRouterError
                  ? 'GENERATION_FAILED'
                  : error instanceof AuthError
                    ? 'UNAUTHORIZED'
                    : 'UNKNOWN_ERROR';
              const status = error instanceof LessonParseError || error instanceof OpenRouterError
                ? 502
                : error instanceof AuthError
                  ? 401
                  : 500;

              emit('error', {
                error: message,
                code,
                status,
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

    if (!rateLimitStatus.withinLimit) {
      return errorResponse(
        `Daily lesson generation limit reached (${RATE_LIMITS[planTier]}/day)`,
        429,
        'RATE_LIMIT_EXCEEDED',
        buildResponseHeaders(rateLimitStatus.remaining, rateLimitStatus.resetAt)
      );
    }

    log.info('generation_start', logContext);
    const generationStartedAt = Date.now();
    const generated = await generateLessonWithQualityGate(trimmedTopic, normalizedDifficulty, logContext);

    const lessonData = generated.lesson;
    const generationTimeMs = Date.now() - generationStartedAt;
    const lessonSections = Array.isArray(lessonData.sections) ? lessonData.sections : [];

    log.info('generation_complete', {
      ...logContext,
      durationMs: generationTimeMs,
      sectionCount: lessonSections.length,
      continuationCount: generated.continuationCount,
      regenerationCount: generated.regenerationCount,
      model: generated.model,
    });

    if (lessonSections.length === 0) {
      return errorResponse('Failed to generate lesson content', 502, 'GENERATION_FAILED');
    }

    let quizQuestions: QuizQuestion[] = [];
    let quizProvider = '';
    let quizFailureReason: string | null = null;
    let quizAttempts = 0;

    if (includeQuiz) {
      const quizDeadlineMs = Date.now() + QUIZ_TOTAL_BUDGET_MS;

      for (let quizAttempt = 1; quizAttempt <= QUIZ_MAX_ATTEMPTS; quizAttempt++) {
        quizAttempts = quizAttempt;
        const remainingBudgetMs = quizDeadlineMs - Date.now();
        if (remainingBudgetMs <= 0) {
          quizFailureReason = `Quiz budget exceeded (${QUIZ_TOTAL_BUDGET_MS}ms).`;
          log.warn('quiz_generation_complete', {
            ...logContext,
            attempt: quizAttempt,
            success: false,
            error: `Quiz budget exceeded (${QUIZ_TOTAL_BUDGET_MS}ms).`,
          });
          break;
        }

        const attemptTimeoutMs = Math.min(QUIZ_ATTEMPT_TIMEOUT_MS, remainingBudgetMs);
        const [quizResult] = await Promise.allSettled([
          withTimeout(
            generateQuizQuestions(trimmedTopic, normalizedDifficulty, lessonData),
            attemptTimeoutMs,
            `Quiz generation attempt exceeded ${attemptTimeoutMs}ms.`
          ),
        ]);

        if (quizResult.status === 'fulfilled') {
          quizQuestions = quizResult.value.questions;
          quizProvider = quizResult.value.provider;
          log.info('quiz_generation_complete', {
            ...logContext,
            attempt: quizAttempt,
            success: true,
            provider: quizProvider,
            questionCount: quizQuestions.length,
          });

          if (quizQuestions.length >= QUIZ_MIN_VALID_QUESTIONS) {
            quizFailureReason = null;
            break;
          }

          quizFailureReason = `Only ${quizQuestions.length} valid questions returned.`;

          if (quizAttempt < QUIZ_MAX_ATTEMPTS) {
            log.warn('quiz_generation_complete', {
              ...logContext,
              attempt: quizAttempt,
              success: false,
              error: `Only ${quizQuestions.length} valid questions returned; retrying.`,
            });
          }
        } else {
          quizFailureReason = summarizeQuizFailure(quizResult.reason);
          log.warn('quiz_generation_complete', {
            ...logContext,
            attempt: quizAttempt,
            success: false,
            error: quizResult.reason instanceof Error
              ? quizResult.reason.message
              : String(quizResult.reason),
          });
        }
      }
    } else {
      log.info('quiz_generation_skipped', {
        ...logContext,
        reason: 'includeQuiz=false',
      });
    }

    if (quizQuestions.length < QUIZ_MIN_VALID_QUESTIONS && includeQuiz && !quizFailureReason) {
      quizFailureReason = 'Quiz generation did not return enough valid questions.';
    }

    const quizStatus = determineQuizGenerationStatus(includeQuiz, quizQuestions);

    const finalQuality = checkQualityGate(lessonData, quizQuestions, includeQuiz);
    const qualityFlag = generated.qualityFlag === 'regenerated' && finalQuality.passed
      ? 'regenerated'
      : finalQuality.passed
        ? 'ok'
        : 'below_threshold';

    log.info('quality_gate_result', {
      ...logContext,
      attempt: generated.regenerationCount + 1,
      passed: finalQuality.passed,
      reasons: finalQuality.reasons,
      preview: generated.rawPreview,
    });

    const markdownContent = sectionsToMarkdown(lessonData);
    const validationReport = validateEliteOutput(markdownContent);
    const wordCount = estimateWordCount(lessonData);
    const estimatedReadTime = estimateReadTimeMinutes(lessonData);
    const finalTitle = lessonData.title || sanitizeForStorage(trimmedTopic);
    const finalSummary = lessonData.summary || `A comprehensive ${normalizedDifficulty} lesson about ${sanitizeForStorage(trimmedTopic)}.`;
    const finalKeyTakeaways = Array.isArray(lessonData.key_takeaways) ? lessonData.key_takeaways : [];
    const finalQuestions = Array.isArray(lessonData.questions) ? lessonData.questions : [];
    const hasCodeExamples = lessonSections.some((section) => Boolean(section.code?.src));
    const hasDeepDives = lessonSections.some((section) => Boolean(section.deep_dive));

    let slug = `${toKebabCase(finalTitle || trimmedTopic) || toKebabCase(trimmedTopic)}-${nanoid(6)}`;
    let lesson = null;
    let insertError = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const insertResult = await supabase
        .from('lessons')
        .insert({
          user_id: user.id,
          topic: trimmedTopic,
          slug,
          content: markdownContent,
          summary: finalSummary,
          key_takeaways: finalKeyTakeaways,
          examples: [],
          questions: finalQuestions,
          quiz_questions: quizQuestions,
          difficulty_level: normalizedDifficulty,
          ai_model_used: generated.model,
          generation_time_ms: generationTimeMs,
          estimated_read_time_minutes: estimatedReadTime,
          quality_flag: qualityFlag,
          has_code_examples: hasCodeExamples,
          has_deep_dives: hasDeepDives,
          word_count: wordCount,
          metadata: {
            generated_title: finalTitle,
            usage: generated.usage,
            sections: lessonSections,
            structured_format: true,
            validation: validationReport,
            generation_strategy: {
              route: LESSON_ROUTE_BY_DIFFICULTY[normalizedDifficulty],
              timeout_ms: LESSON_TIMEOUT_MS_BY_DIFFICULTY[normalizedDifficulty],
              continuation_count: generated.continuationCount,
              regeneration_count: generated.regenerationCount,
              include_quiz: includeQuiz,
              force_fresh: forceFresh,
              quiz_provider: quizProvider || null,
              quiz_status: quizStatus,
              quiz_attempts: quizAttempts,
              quiz_question_count: quizQuestions.length,
              quiz_failure_reason: quizFailureReason,
            },
            quality_gate: {
              passed: finalQuality.passed,
              reasons: finalQuality.reasons,
            },
          },
        })
        .select()
        .single();

      lesson = insertResult.data;
      insertError = insertResult.error;

      if (insertError?.code === '23505' && insertError.message?.includes('slug') && attempt === 0) {
        slug = `${toKebabCase(finalTitle || trimmedTopic) || toKebabCase(trimmedTopic)}-${nanoid(6)}`;
        continue;
      }

      break;
    }

    if (insertError || !lesson) {
      log.error('db_insert_failed', {
        ...logContext,
        error: insertError?.message || 'Unknown insert error',
      });
      return errorResponse('Failed to save lesson', 500, 'DB_INSERT_FAILED');
    }

    log.info('db_insert_success', {
      ...logContext,
      lessonId: lesson.id,
      sectionCount: lessonSections.length,
    });

    logActivity(supabase, user.id, 'lesson_generated', 'lesson', lesson.id, {
      topic: trimmedTopic,
      model: generated.model,
      generation_time_ms: generationTimeMs,
      section_count: lessonSections.length,
      continuation_count: generated.continuationCount,
      quality_flag: qualityFlag,
      quiz_requested: includeQuiz,
      quiz_generated: quizStatus === 'generated',
      quiz_status: quizStatus,
      quiz_question_count: quizQuestions.length,
      quiz_failure_reason: quizFailureReason,
      estimated_read_time_minutes: estimatedReadTime,
    }).catch((error) => {
      log.error('activity_log_failed', {
        ...logContext,
        lessonId: lesson.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    const payload = buildLessonResponse({
      lessonId: lesson.id,
      slug: lesson.slug,
      displayTitle: finalTitle,
      topic: trimmedTopic,
      summary: finalSummary,
      difficulty: normalizedDifficulty,
      content: markdownContent,
      sections: lessonSections,
      keyTakeaways: finalKeyTakeaways,
      questions: finalQuestions,
      quizQuestions,
      estimatedReadTimeMinutes: estimatedReadTime,
      generationTimeMs,
      modelUsed: generated.model,
      cached: false,
      qualityFlag,
      quizStatus,
      quizRequested: includeQuiz,
      quizProvider: quizProvider || null,
      quizFailureReason,
      similarLesson,
    });

    log.info('response_sent', {
      ...logContext,
      cached: false,
      durationMs: Date.now() - requestStartedAt,
      qualityFlag,
      includeQuiz,
      quizCount: quizQuestions.length,
      quizStatus,
    });

    return jsonResponse(
      payload,
      200,
      buildResponseHeaders(Math.max(0, rateLimitStatus.remaining - 1), rateLimitStatus.resetAt)
    );
  } catch (error) {
    log.error('response_sent', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - requestStartedAt,
    });

    if (error instanceof AuthError) {
      return errorResponse(error.message, 401, 'UNAUTHORIZED');
    }

    if (error instanceof ConfigError) {
      return errorResponse('Service configuration error', 500, 'CONFIG_ERROR');
    }

    if (error instanceof LessonParseError) {
      return errorResponse(error.message, 502, 'PARSE_FAILED');
    }

    if (error instanceof OpenRouterError) {
      return errorResponse('AI service unavailable', 502, 'GENERATION_FAILED');
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500, 'UNKNOWN_ERROR');
  }
});
