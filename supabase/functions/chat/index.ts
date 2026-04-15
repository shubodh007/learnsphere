// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Fix for IDE linting: Deno is a global in Supabase Edge Functions
declare const Deno: any;

import { corsHeaders, handleCors, errorResponse } from '../_shared/cors.ts';
import {
  createSupabaseClient,
  getUser,
  logActivity,
  AuthError,
} from '../_shared/supabase.ts';
import {
  callOpenRouter,
  streamOpenRouter,
  OpenRouterMessage,
  getChatModelCandidates,
  getChatTimeoutMs,
} from '../_shared/openrouter.ts';

const CHAT_CONTEXT_FETCH_LIMIT = 12;
const CLIENT_HISTORY_TRUST_THRESHOLD = 4;
const RAW_CONTEXT_WINDOW = {
  fast: 4,
  balanced: 6,
  deep: 10,
} as const;

interface ChatRequest {
  message: string;
  conversationId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  mode?: 'fast' | 'balanced' | 'deep';
}

const USER_FACING_CHAT_ERROR =
  'The chat service is temporarily busy. Please try again in a few seconds.';

function normalizeText(value: string = ''): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number): string {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength - 3).trimEnd() + '...';
}

function squashAdjacentDuplicateTurns(
  turns: Array<{ role: 'user' | 'assistant'; content: string }>
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const result: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const turn of turns) {
    const normalizedContent = normalizeText(turn.content);
    if (!normalizedContent) continue;

    const previous = result[result.length - 1];
    if (
      previous &&
      previous.role === turn.role &&
      normalizeText(previous.content) === normalizedContent
    ) {
      continue;
    }

    result.push({
      role: turn.role,
      content: normalizedContent,
    });
  }

  return result;
}

async function loadConversationTurns(
  supabase: any,
  conversationId: string | undefined,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const normalizedHistory = squashAdjacentDuplicateTurns(history);

  if (
    !conversationId ||
    normalizedHistory.length >= CLIENT_HISTORY_TRUST_THRESHOLD
  ) {
    return normalizedHistory.slice(-CHAT_CONTEXT_FETCH_LIMIT);
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(CHAT_CONTEXT_FETCH_LIMIT);

    if (error) {
      console.error('[Chat] Failed to load stored turns:', error);
      return normalizedHistory.slice(-CHAT_CONTEXT_FETCH_LIMIT);
    }

    const storedTurns = (data || [])
      .slice()
      .reverse()
      .map((item: any) => ({
        role: item.role,
        content: item.content,
      }));

    return squashAdjacentDuplicateTurns([
      ...storedTurns,
      ...normalizedHistory,
    ]).slice(-CHAT_CONTEXT_FETCH_LIMIT);
  } catch (error) {
    console.error('[Chat] Conversation load exception:', error);
    return normalizedHistory.slice(-CHAT_CONTEXT_FETCH_LIMIT);
  }
}

function detectPrimaryLanguage(text: string): string | null {
  const lower = text.toLowerCase();
  const languagePatterns: Array<[string, RegExp]> = [
    ['TypeScript', /\btypescript|tsx?\b/i],
    ['JavaScript', /\bjavascript|node\.?js|react\b/i],
    ['Python', /\bpython|django|flask|fastapi\b/i],
    ['SQL', /\bsql|postgres|mysql|database query\b/i],
    ['HTML/CSS', /\bhtml|css|tailwind|layout\b/i],
    ['Go', /\bgolang|\bgo\b/i],
    ['Java', /\bjava\b(?!script)/i],
  ];

  for (const [label, pattern] of languagePatterns) {
    if (pattern.test(lower)) {
      return label;
    }
  }

  return null;
}

function detectUserPreferences(
  turns: Array<{ role: 'user' | 'assistant'; content: string }>
): string[] {
  const userText = turns
    .filter((turn) => turn.role === 'user')
    .slice(-6)
    .map((turn) => turn.content)
    .join('\n');

  const preferences: string[] = [];

  if (/\bbrief|concise|short|quick|tl;dr\b/i.test(userText)) {
    preferences.push('The user often prefers concise answers when possible.');
  }

  if (/\bstep by step|walk me through|detailed|in depth|thorough\b/i.test(userText)) {
    preferences.push('The user values structured, step-by-step explanations.');
  }

  if (/\bbeginner|new to|explain simply|eli5\b/i.test(userText)) {
    preferences.push('The user may benefit from beginner-friendly phrasing.');
  }

  if (/\bexample|sample|show me|demo\b/i.test(userText)) {
    preferences.push('Concrete examples are usually helpful for this user.');
  }

  const primaryLanguage = detectPrimaryLanguage(userText);
  if (primaryLanguage) {
    preferences.push(`The conversation frequently involves ${primaryLanguage}.`);
  }

  return preferences.slice(0, 4);
}

function analyzeChatRequest(
  message: string,
  requestedMode: 'fast' | 'balanced' | 'deep' | undefined,
  turns: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  const normalized = normalizeText(message);
  const lower = normalized.toLowerCase();
  const wordCount = normalized ? normalized.split(/\s+/).length : 0;

  const isDebugging = /\berror|exception|stack trace|failing|fails|bug|broken|not working|undefined\b/i.test(lower);
  const isComparison = /\bcompare|comparison|vs\.?|versus|better than|tradeoffs?\b/i.test(lower);
  const isBrainstorm = /\bbrainstorm|ideas|options|name ideas|explore directions\b/i.test(lower);
  const isWriting = /\bwrite|rewrite|draft|improve wording|tone\b/i.test(lower);
  const isCoding = /\bcode|function|class|api|endpoint|sql|query|typescript|javascript|python|implement|refactor|regex\b/i.test(lower);
  const isAnalysis = /\bwhy|how|internals|analyze|architecture|design|system design|performance|optimi[sz]e\b/i.test(lower);

  let intent: 'general' | 'coding' | 'debugging' | 'analysis' | 'brainstorm' | 'writing' | 'comparison' = 'general';
  if (isDebugging) intent = 'debugging';
  else if (isComparison) intent = 'comparison';
  else if (isBrainstorm) intent = 'brainstorm';
  else if (isWriting && !isCoding) intent = 'writing';
  else if (isCoding) intent = 'coding';
  else if (isAnalysis) intent = 'analysis';

  const prefersConcise = /\bbrief|concise|short|quick|tl;dr\b/i.test(lower);
  const prefersDepth = /\bdetailed|in depth|deep dive|thorough|comprehensive|carefully\b/i.test(lower);
  const wantsSteps = /\bstep by step|walk me through|steps\b/i.test(lower);
  const wantsCode = isCoding || /\bexample|snippet|sample code|show me code\b/i.test(lower);

  let complexityScore = 0;
  if (wordCount > 25) complexityScore += 1;
  if (wordCount > 60) complexityScore += 1;
  if (turns.length > 8) complexityScore += 1;
  if (isDebugging || isComparison || isAnalysis) complexityScore += 1;
  if (wantsSteps || prefersDepth) complexityScore += 2;
  if (/\barchitecture|production|scale|latency|tradeoff|multi-tenant|state management\b/i.test(lower)) {
    complexityScore += 2;
  }

  let mode: 'fast' | 'balanced' | 'deep' = 'balanced';
  if (requestedMode === 'fast' || requestedMode === 'deep') {
    mode = requestedMode;
  } else if (prefersDepth || complexityScore >= 5) {
    mode = 'deep';
  } else if (
    (prefersConcise && complexityScore <= 2) ||
    (!prefersDepth && complexityScore <= 1 && !isAnalysis && !isComparison)
  ) {
    mode = 'fast';
  }

  const complexity = complexityScore >= 4 ? 'high' : complexityScore >= 2 ? 'medium' : 'low';
  const style = prefersConcise ? 'concise' : prefersDepth ? 'thorough' : 'adaptive';

  const temperature = intent === 'brainstorm' || intent === 'writing'
    ? 0.7
    : intent === 'coding' || intent === 'debugging'
      ? 0.25
      : 0.45;

  return {
    mode,
    intent,
    complexity,
    style,
    wantsCode,
    wantsSteps,
    temperature,
    useModelMaxOutput: true,
    models: getChatModelCandidates(mode, intent),
  };
}

function buildConversationMemory(
  turns: Array<{ role: 'user' | 'assistant'; content: string }>,
  mode: 'fast' | 'balanced' | 'deep'
): string {
  if (!turns.length || mode === 'fast') return '';

  const recentUserTurns = turns
    .filter((turn) => turn.role === 'user')
    .slice(-3)
    .map((turn) => '- ' + truncateText(turn.content, 120));

  const recentAssistantTurns = turns
    .filter((turn) => turn.role === 'assistant')
    .slice(-1)
    .map((turn) => '- ' + truncateText(turn.content, 120));

  const preferences = detectUserPreferences(turns).map((item) => '- ' + item);
  const sections: string[] = [];

  if (recentUserTurns.length) {
    sections.push('Recent user requests:\n' + recentUserTurns.join('\n'));
  }

  if (preferences.length) {
    sections.push('Observed preferences:\n' + preferences.join('\n'));
  }

  if (recentAssistantTurns.length) {
    sections.push('What has already been covered:\n' + recentAssistantTurns.join('\n'));
  }

  return sections.join('\n\n');
}

function buildSystemPrompt(
  profile: ReturnType<typeof analyzeChatRequest>,
  memory: string
): string {
  const basePrompt = `
You are LearnSphere Chat.
- answer the user's question directly
- adapt depth to the request
- be practical, specific, and honest about uncertainty
- avoid filler and repetition
- ask at most one clarifying question only when needed
- use code only when it clearly helps
`.trim();

  const modeInstructions = {
    fast: 'Fast mode: optimize for time-to-first-useful-answer. Keep the response lean, direct, and actionable.',
    balanced: 'Balanced mode: provide a crisp answer with enough explanation to be genuinely useful.',
    deep: 'Deep mode: be thorough, explain tradeoffs, and structure the response so the user can make decisions confidently.',
  };

  const intentInstructions = {
    general: 'General requests: answer directly and adapt the level of detail to the user signal.',
    coding: 'Coding requests: explain the approach, provide correct code when useful, and call out implementation tradeoffs only when they matter.',
    debugging: 'Debugging requests: identify the likely root cause first, then provide the fix, verification steps, and any important edge cases.',
    analysis: 'Analysis requests: reason explicitly, surface tradeoffs, and prioritize sound judgment over verbosity.',
    brainstorm: 'Brainstorming requests: generate strong options, vary the ideas meaningfully, and keep them grounded in the stated goal.',
    writing: 'Writing requests: match the requested tone, improve clarity, and avoid generic phrasing.',
    comparison: 'Comparison requests: make the decision criteria explicit and be clear about when each option wins.',
  };

  const responseShape = [
    profile.style === 'concise'
      ? 'The user is signaling a preference for brevity, so keep the answer tight.'
      : 'Match the user with an adaptive amount of detail rather than defaulting to a long response.',
    profile.wantsSteps
      ? 'A step-by-step structure will likely help here.'
      : 'Only use step-by-step structure if it adds real clarity.',
    profile.wantsCode
      ? 'A concrete code example will probably help, but keep it focused.'
      : 'Do not force a code sample unless it genuinely improves the answer.',
  ].join('\n');

  return [
    basePrompt,
    modeInstructions[profile.mode],
    intentInstructions[profile.intent],
    responseShape,
    memory ? 'Conversation memory for continuity only:\n' + memory : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildDeterministicChatFallback(
  message: string,
  profile: ReturnType<typeof analyzeChatRequest>
): string {
  const normalizedMessage = normalizeText(message);

  if (profile.intent === 'debugging' || profile.intent === 'coding') {
    return [
      'I could not reach the live AI provider right now, but here is a reliable fallback workflow you can use immediately:',
      '1. Reproduce the issue with the smallest possible input and write down expected vs actual behavior.',
      '2. Add focused logs around the first unexpected value, then confirm where state diverges.',
      '3. Check assumptions at boundaries: null/undefined, empty arrays, index bounds, and async timing.',
      '4. After the root cause is found, add one regression test for this exact case.',
      `Your request was: "${truncateText(normalizedMessage, 180)}". If you retry in a few seconds, I can provide a code-specific answer.`,
    ].join('\n\n');
  }

  if (profile.intent === 'comparison') {
    return [
      'The AI provider is temporarily unavailable, so here is a decision fallback template:',
      '1. Define your top 2 success metrics (for example: speed, maintainability, cost).',
      '2. Score each option 1-5 per metric.',
      '3. Choose the option that wins your top metric unless risk is unacceptable.',
      `Prompt to retry shortly: "${truncateText(normalizedMessage, 180)}" for a concrete side-by-side recommendation.`,
    ].join('\n\n');
  }

  return [
    'The AI provider is temporarily busy, but you can still move forward with this quick fallback approach:',
    '1. Write your goal in one sentence.',
    '2. List constraints (time, tools, quality target).',
    '3. Break the task into a first actionable step you can finish in 10-15 minutes.',
    `I captured your request as: "${truncateText(normalizedMessage, 180)}". Retry in a few seconds for a full AI response.`,
  ].join('\n\n');
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const supabase = createSupabaseClient(req);
    const user = await getUser(supabase);

    const body: ChatRequest = await req.json();
    const { message, conversationId, history = [], mode } = body;

    if (!message?.trim()) return errorResponse('Message is required', 400);

    const trimmedMessage = message.trim();
    const startTime = Date.now();

    const conversationTurns = await loadConversationTurns(supabase, conversationId, history);
    const requestProfile = analyzeChatRequest(trimmedMessage, mode, conversationTurns);
    const conversationMemory = buildConversationMemory(
      conversationTurns,
      requestProfile.mode
    );
    const systemPrompt = buildSystemPrompt(requestProfile, conversationMemory);

    let convId = conversationId;
    if (!convId) {
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: trimmedMessage.slice(0, 50) + (trimmedMessage.length > 50 ? '...' : ''),
        })
        .select('id')
        .single();

      if (convErr) throw new Error('Failed to create conversation: ' + convErr.message);
      convId = conv?.id;
    }

    if (!convId) throw new Error('Failed to initialize conversation');

    const rawContextTurns = conversationTurns.slice(-RAW_CONTEXT_WINDOW[requestProfile.mode]);
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      ...rawContextTurns.map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
      { role: 'user', content: trimmedMessage },
    ];

    const userMessageMetadata = {
      route: requestProfile.mode,
      intent: requestProfile.intent,
      complexity: requestProfile.complexity,
      historyTurnsUsed: rawContextTurns.length,
    };

    const userMsgPromise = supabase.from('messages').insert({
      conversation_id: convId,
      role: 'user',
      content: trimmedMessage,
      metadata: userMessageMetadata,
    });

    const countUpdatePromise = supabase.rpc('increment_message_count', { conv_id: convId });

    let fullResponse = '';
    let usedModel = '';
    let streamFailed = false;
    let streamErrorMessage = '';
    let responseStartedAt = 0;
    let deterministicFallbackUsed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            status: 'initializing',
            conversationId: convId,
            route: requestProfile.mode,
            intent: requestProfile.intent,
            complexity: requestProfile.complexity,
          })}\n\n`));

          const openRouterStream = streamOpenRouter(messages, {
            temperature: requestProfile.temperature,
            useModelMaxOutput: requestProfile.useModelMaxOutput,
            models: requestProfile.models,
            route: requestProfile.mode,
            intent: requestProfile.intent,
          });

          for await (const chunk of openRouterStream) {
            if (!responseStartedAt && chunk.delta) {
              responseStartedAt = Date.now();
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                status: 'streaming',
                conversationId: convId,
                model: chunk.model,
                firstTokenMs: responseStartedAt - startTime,
              })}\n\n`));
            }

            if (chunk.done) {
              usedModel = chunk.model || usedModel;
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              break;
            }

            if (chunk.delta) {
              usedModel = chunk.model || usedModel;
              fullResponse += chunk.delta;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                delta: chunk.delta,
                model: chunk.model,
              })}\n\n`));
            }
          }
        } catch (error) {
          streamFailed = true;
          streamErrorMessage = error instanceof Error ? error.message : String(error);
          console.error('[Chat Stream Error]', error);

          // Recover from stream-only failures by attempting one non-stream completion.
          if (!fullResponse) {
            try {
              const fallbackResult = await callOpenRouter(messages, {
                temperature: requestProfile.temperature,
                useModelMaxOutput: requestProfile.useModelMaxOutput,
                models: requestProfile.models,
                route: requestProfile.mode,
                intent: requestProfile.intent,
                timeoutMs: getChatTimeoutMs(requestProfile.mode, false),
                maxTokens: requestProfile.mode === 'deep' ? 2200 : 1400,
                stream: false,
              });

              const fallbackContent = fallbackResult.content?.trim();
              if (fallbackContent) {
                usedModel = fallbackResult.model || usedModel;
                fullResponse = fallbackContent;
                responseStartedAt = responseStartedAt || Date.now();

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  status: 'fallback',
                  conversationId: convId,
                  model: usedModel,
                  route: requestProfile.mode,
                })}\n\n`));

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  delta: fallbackContent,
                  model: usedModel,
                  fallback: true,
                })}\n\n`));

                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                streamFailed = false;
                streamErrorMessage = '';
                return;
              }
            } catch (fallbackError) {
              const fallbackMessage =
                fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
              streamErrorMessage += '; fallback failed: ' + fallbackMessage;
              console.error('[Chat Fallback Error]', fallbackError);
            }

            const deterministicContent = buildDeterministicChatFallback(
              trimmedMessage,
              requestProfile
            );
            if (deterministicContent) {
              fullResponse = deterministicContent;
              usedModel = 'deterministic-fallback';
              deterministicFallbackUsed = true;
              responseStartedAt = responseStartedAt || Date.now();

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                status: 'deterministic_fallback',
                conversationId: convId,
                model: usedModel,
                route: requestProfile.mode,
              })}\n\n`));

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                delta: deterministicContent,
                model: usedModel,
                fallback: true,
                deterministic: true,
              })}\n\n`));

              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              return;
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            error: USER_FACING_CHAT_ERROR,
            route: requestProfile.mode,
            intent: requestProfile.intent,
          })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } finally {
          const responseTimeMs = Date.now() - startTime;
          const firstTokenMs = responseStartedAt ? responseStartedAt - startTime : null;

          try {
            await Promise.allSettled([userMsgPromise, countUpdatePromise]);

            if (fullResponse) {
              await Promise.all([
                supabase.from('messages').insert({
                  conversation_id: convId,
                  role: 'assistant',
                  content: fullResponse,
                  ai_model_used: usedModel,
                  response_time_ms: responseTimeMs,
                  metadata: {
                    route: requestProfile.mode,
                    intent: requestProfile.intent,
                    complexity: requestProfile.complexity,
                    firstTokenMs,
                    temperature: requestProfile.temperature,
                    usesModelMaxOutput: requestProfile.useModelMaxOutput,
                    modelsTried: requestProfile.models,
                    streamFailed,
                    deterministicFallbackUsed,
                  },
                }),
                supabase.rpc('increment_message_count', { conv_id: convId }),
              ]);
            }

            await logActivity(supabase, user.id, 'chat_message', 'conversation', convId, {
              model: usedModel,
              route: requestProfile.mode,
              intent: requestProfile.intent,
              complexity: requestProfile.complexity,
              responseTimeMs,
              firstTokenMs,
              success: Boolean(fullResponse),
              deterministicFallbackUsed,
              error: streamFailed ? streamErrorMessage : null,
            });
          } catch (postErr) {
            console.error('[Chat Post-Process Error]', postErr);
          }

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Conversation-Id': convId,
      },
    });
  } catch (error) {
    console.error('[Chat Global Error]', error);
    const message = error instanceof AuthError
      ? error.message
      : USER_FACING_CHAT_ERROR;
    return errorResponse(message, error instanceof AuthError ? 401 : 500);
  }
});
