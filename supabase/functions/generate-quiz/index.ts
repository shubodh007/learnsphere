// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

declare const Deno: any;

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import {
  createSupabaseClient,
  getUser,
  AuthError,
  ConfigError,
} from '../_shared/supabase.ts';
import {
  callOpenRouter,
  extractJSON,
  OpenRouterError,
} from '../_shared/openrouter.ts';

interface QuizRequest {
  topic: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  summary?: string;
  keyTakeaways?: string[];
  sections?: Array<{
    heading: string;
    body: string;
    bullets?: Array<{ label: string; detail: string }>;
    deep_dive?: string;
    common_mistakes?: Array<{ mistake: string; fix: string }>;
  }>;
  existingQuestions?: string[];
  count?: number;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sectionHeading?: string;
}

const QUIZ_SYSTEM_PROMPT = `You create premium multiple-choice quizzes for coding and learning lessons.

Preferred output format is JSON in this shape:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "Why the answer is correct and why the learner should care.",
      "sectionHeading": "Optional section heading"
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
Explanation: Why the answer is correct and why the learner should care.
Section: Optional section heading

Rules:
- Generate 5 to 8 questions.
- Exactly 4 options per question.
- Exactly 1 correct answer.
- Make distractors plausible.
- Test understanding, application, and common mistakes, not trivia.
- Use the lesson context only. Do not invent unrelated facts.
- Explanations must be concise but useful.
- Keep the language aligned with the lesson difficulty.
- Return exactly one format (JSON or plain text blocks) without extra commentary.`;

const OPENROUTER_FREE_MODEL = 'openrouter/free';

const QUIZ_OPENROUTER_FREE_MODELS = [
  OPENROUTER_FREE_MODEL,
];

function getQuizModelCandidates(route: 'fast' | 'balanced') {
  return QUIZ_OPENROUTER_FREE_MODELS;
}

function clampQuestionCount(value: number | undefined) {
  const normalized = typeof value === 'number' ? Math.round(value) : 6;
  return Math.max(5, Math.min(8, normalized));
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function buildQuizPrompt(body: QuizRequest, desiredCount: number) {
  const sectionBlocks = (body.sections || [])
    .slice(0, 6)
    .map((section, index) => {
      const bullets = Array.isArray(section.bullets)
        ? section.bullets.map((item) => `${item.label}: ${item.detail}`).join(' | ')
        : '';
      const mistakes = Array.isArray(section.common_mistakes)
        ? section.common_mistakes.map((item) => `${item.mistake} -> ${item.fix}`).join(' | ')
        : '';

      return [
        `Section ${index + 1}: ${normalizeText(section.heading)}`,
        normalizeText(section.body),
        bullets ? `Bullets: ${bullets}` : '',
        normalizeText(section.deep_dive) ? `Deep dive: ${normalizeText(section.deep_dive)}` : '',
        mistakes ? `Common mistakes: ${mistakes}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return [
    `Topic: ${normalizeText(body.topic)}`,
    `Difficulty: ${normalizeText(body.difficulty || 'intermediate')}`,
    normalizeText(body.summary) ? `Summary: ${normalizeText(body.summary)}` : '',
    Array.isArray(body.keyTakeaways) && body.keyTakeaways.length > 0
      ? `Key takeaways: ${body.keyTakeaways.map(normalizeText).filter(Boolean).join(' | ')}`
      : '',
    Array.isArray(body.existingQuestions) && body.existingQuestions.length > 0
      ? `Existing open questions to draw from: ${body.existingQuestions.map(normalizeText).filter(Boolean).join(' | ')}`
      : '',
    `Generate ${desiredCount} multiple-choice questions based on this lesson content:`,
    sectionBlocks,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function normalizeQuestions(rawQuestions: unknown, desiredCount: number): QuizQuestion[] {
  if (!Array.isArray(rawQuestions)) {
    throw new Error('Quiz payload did not contain a questions array');
  }

  const normalized = rawQuestions
    .map((question) => {
      const title = normalizeText(question?.question);
      const options = Array.isArray(question?.options)
        ? question.options.map(normalizeText).filter(Boolean).slice(0, 4)
        : [];
      const explanation = normalizeText(question?.explanation);
      const correctIndex = typeof question?.correctIndex === 'number'
        ? question.correctIndex
        : Number.parseInt(String(question?.correctIndex ?? ''), 10);
      const sectionHeading = normalizeText(question?.sectionHeading) || undefined;

      if (!title || options.length !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        return null;
      }

      return {
        question: title,
        options,
        correctIndex,
        explanation: explanation || 'Review the lesson section and compare the options carefully.',
        sectionHeading,
      };
    })
    .filter(Boolean);

  if (normalized.length < 3) {
    throw new Error('Quiz generation returned too few valid questions');
  }

  return normalized.slice(0, desiredCount);
}

function parsePlainTextQuestions(raw: string, desiredCount: number): QuizQuestion[] {
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

  const parsed = blocks
    .map((block) => {
      if (block.length === 0) return null;

      const question = normalizeText(block[0].replace(/^\s*(?:Q(?:uestion)?\s*\d*[:.)-]|\d+[.)])\s*/i, ''));
      if (!question) return null;

      const options: string[] = [];
      let answerToken = '';
      let explanation = '';
      let sectionHeading = '';

      for (const line of block.slice(1)) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const optionMatch = trimmed.match(/^\s*([A-D]|[1-4])[).:\-]\s*(.+)$/i);
        if (optionMatch?.[2]) {
          options.push(normalizeText(optionMatch[2]));
          continue;
        }

        const answerMatch = trimmed.match(/^(?:Answer|Correct(?:\s+Answer)?|CorrectIndex)\s*[:\-]\s*(.+)$/i);
        if (answerMatch?.[1]) {
          answerToken = normalizeText(answerMatch[1]).toUpperCase();
          continue;
        }

        const explanationMatch = trimmed.match(/^Explanation\s*[:\-]\s*(.+)$/i);
        if (explanationMatch?.[1]) {
          explanation = normalizeText(explanationMatch[1]);
          continue;
        }

        const sectionMatch = trimmed.match(/^(?:Section|Section Heading|SectionRef)\s*[:\-]\s*(.+)$/i);
        if (sectionMatch?.[1]) {
          sectionHeading = normalizeText(sectionMatch[1]);
        }
      }

      if (options.length !== 4) {
        return null;
      }

      let correctIndex = -1;
      if (/^[A-D]$/.test(answerToken)) {
        correctIndex = answerToken.charCodeAt(0) - 65;
      } else {
        const numericAnswer = Number.parseInt(answerToken, 10);
        if (Number.isInteger(numericAnswer)) {
          if (numericAnswer >= 0 && numericAnswer <= 3) {
            correctIndex = numericAnswer;
          } else if (numericAnswer >= 1 && numericAnswer <= 4) {
            correctIndex = numericAnswer - 1;
          }
        }
      }

      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        return null;
      }

      return {
        question,
        options,
        correctIndex,
        explanation: explanation || 'Review the lesson section and compare the options carefully.',
        sectionHeading: sectionHeading || undefined,
      };
    })
    .filter(Boolean);

  if (parsed.length < 3) {
    throw new Error('Quiz plain-text response returned too few valid questions');
  }

  return parsed.slice(0, desiredCount);
}

function parseQuizResponse(raw: string, desiredCount: number): QuizQuestion[] {
  try {
    const parsed = JSON.parse(extractJSON(raw));
    return normalizeQuestions(parsed.questions, desiredCount);
  } catch {
    return parsePlainTextQuestions(raw, desiredCount);
  }
}

async function callOpenRouterQuiz(prompt: string, desiredCount: number) {
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
      const result = await callOpenRouter(
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
        }
      );

      const parsedQuestions = parseQuizResponse(result.content, desiredCount);
      return {
        provider: 'openrouter' as const,
        questions: parsedQuestions,
      };
    } catch (error) {
      lastError = error;
      console.error('[Generate Quiz] OpenRouter strategy failed:', strategy.route, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All OpenRouter quiz strategies failed');
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    const supabase = createSupabaseClient(req);
    await getUser(supabase);

    const body = (await req.json()) as QuizRequest;
    const topic = normalizeText(body.topic);

    if (!topic) {
      return errorResponse('Topic is required', 400);
    }

    const desiredCount = clampQuestionCount(body.count);
    const prompt = buildQuizPrompt(body, desiredCount);

    const result = await callOpenRouterQuiz(prompt, desiredCount);

    return jsonResponse(result);
  } catch (error) {
    console.error('[Generate Quiz] Error:', error);

    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }

    if (error instanceof ConfigError) {
      return errorResponse(error.message, 500);
    }

    if (error instanceof OpenRouterError) {
      return errorResponse('Quiz generation is temporarily unavailable', 502);
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
});
