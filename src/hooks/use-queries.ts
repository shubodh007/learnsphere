import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  Lesson,
  Profile,
  ActivityLog,
  DailyStats,
  LearningStreak,
  GenerateLessonResponse,
  GenerateCodeRequest,
  GenerateCodeResponse,
} from '@/lib/types';

const GENERATE_LESSON_TIMEOUT_MS = 120000;
const GENERATE_LESSON_RETRY_DELAY_MS = 300;
const GENERATE_LESSON_MAX_ATTEMPTS = 3;
const LESSON_GENERATION_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const LESSON_TIMEOUT_RECOVERY_DELAY_MS = 2500;
const LESSON_TIMEOUT_RECOVERY_LOOKBACK_MS = 20 * 60 * 1000;
const LESSON_TIMEOUT_RECOVERY_ATTEMPTS = 4;
const LESSON_TIMEOUT_RECOVERY_POLL_MS = 2000;
const GENERATE_CODE_TIMEOUT_MS = 45000;
const GENERATE_CODE_RETRY_DELAY_MS = 250;
const GENERATE_CODE_MAX_ATTEMPTS = 3;
const CODE_GENERATION_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const TOKEN_REFRESH_BUFFER_MS = 60_000;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createFunctionError(message: string, code?: string) {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
}

function getFunctionsBaseUrl() {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (typeof baseUrl !== 'string' || baseUrl.trim().length === 0) {
    throw new Error('VITE_SUPABASE_URL is not configured. Set it in your environment variables.');
  }

  return baseUrl.replace(/\/$/, '');
}

function tryParseJson(text: string): unknown {
  const normalized = text.trim();
  if (!normalized) return null;

  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function normalizeTopicForComparison(topic: string) {
  return topic.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toLessonResponseFromRecord(lesson: Lesson): GenerateLessonResponse {
  const metadata = lesson.metadata && typeof lesson.metadata === 'object'
    ? lesson.metadata as Record<string, unknown>
    : {};
  const sections = Array.isArray(metadata.sections) ? metadata.sections : [];
  const generatedTitle = typeof metadata.generated_title === 'string' && metadata.generated_title.trim().length > 0
    ? metadata.generated_title
    : lesson.topic;

  return normalizeGenerateLessonResponse({
    id: lesson.id,
    title: generatedTitle,
    topic: lesson.topic,
    slug: lesson.slug,
    summary: lesson.summary || 'Your lesson is ready.',
    content: lesson.content || '',
    sections,
    key_takeaways: Array.isArray(lesson.key_takeaways) ? lesson.key_takeaways : [],
    questions: Array.isArray(lesson.questions) ? lesson.questions : [],
    quiz_questions: Array.isArray(lesson.quiz_questions) ? lesson.quiz_questions : [],
    difficulty: lesson.difficulty_level,
    estimated_read_time_minutes: typeof lesson.estimated_read_time_minutes === 'number'
      ? lesson.estimated_read_time_minutes
      : 1,
    section_count: sections.length,
    has_code_examples: Boolean(lesson.has_code_examples),
    has_deep_dives: Boolean(lesson.has_deep_dives),
    generation_time_ms: typeof lesson.generation_time_ms === 'number' ? lesson.generation_time_ms : 0,
    generationTimeMs: typeof lesson.generation_time_ms === 'number' ? lesson.generation_time_ms : 0,
    model_used: lesson.ai_model_used || '',
    cached: true,
    quality_flag: lesson.quality_flag === 'below_threshold' || lesson.quality_flag === 'regenerated'
      ? lesson.quality_flag
      : 'ok',
    similar_lesson: null,
  });
}

async function recoverRecentLessonAfterTimeout({
  topic,
  difficulty,
}: {
  topic: string;
  difficulty: GenerateLessonResponse['difficulty'];
}): Promise<GenerateLessonResponse | null> {
  const normalizedTopic = normalizeTopicForComparison(topic);
  const createdAfter = new Date(Date.now() - LESSON_TIMEOUT_RECOVERY_LOOKBACK_MS).toISOString();

  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('is_deleted', false)
    .eq('difficulty_level', difficulty)
    .gte('created_at', createdAfter)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const matchedLesson = data.find((lesson) =>
    normalizeTopicForComparison(String((lesson as Record<string, unknown>).topic || '')) === normalizedTopic
  );

  if (!matchedLesson) {
    return null;
  }

  return toLessonResponseFromRecord(matchedLesson as Lesson);
}

async function getSessionAccessToken({
  actionLabel,
  forceRefresh = false,
}: {
  actionLabel: string;
  forceRefresh?: boolean;
}) {
  if (forceRefresh) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session?.access_token) {
      throw new Error(`Session expired. Please sign in again to ${actionLabel}.`);
    }

    return data.session.access_token;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error(`Please sign in to ${actionLabel}.`);
  }

  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
  const shouldRefresh = expiresAt > 0 && expiresAt - Date.now() < TOKEN_REFRESH_BUFFER_MS;

  if (!shouldRefresh) {
    return session.access_token;
  }

  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session?.access_token) {
    throw new Error(`Session expired. Please sign in again to ${actionLabel}.`);
  }

  return data.session.access_token;
}

function normalizeGenerateCodeResponse(data: unknown): GenerateCodeResponse {
  if (!data || typeof data !== 'object') {
    throw new Error('The generator returned an invalid response.');
  }

  const candidate = data as Record<string, unknown>;
  const code = typeof candidate.code === 'string'
    ? candidate.code.trim()
    : typeof candidate.generated_code === 'string'
      ? candidate.generated_code.trim()
      : '';
  if (!code) {
    throw new Error('The generator returned an empty code result.');
  }

  const language = typeof candidate.language === 'string' && candidate.language.trim()
    ? candidate.language.trim()
    : typeof candidate.lang === 'string' && candidate.lang.trim()
      ? candidate.lang.trim()
    : 'Code';
  const summary = typeof candidate.summary === 'string' && candidate.summary.trim()
    ? candidate.summary.trim()
    : typeof candidate.description === 'string' && candidate.description.trim()
      ? candidate.description.trim()
    : 'A solution was generated for your request.';
  const explanation = typeof candidate.explanation === 'string' && candidate.explanation.trim()
    ? candidate.explanation.trim()
    : typeof candidate.details === 'string' && candidate.details.trim()
      ? candidate.details.trim()
    : 'A walkthrough is not available yet for this result.';
  const complexity = typeof candidate.complexity === 'string' && candidate.complexity.trim()
    ? candidate.complexity.trim()
    : typeof candidate.time_complexity === 'string' && candidate.time_complexity.trim()
      ? candidate.time_complexity.trim()
    : 'Estimated Time: O(n) | Estimated Space: O(n)';
  const rawDebuggingTips = Array.isArray(candidate.debuggingTips)
    ? candidate.debuggingTips
    : Array.isArray(candidate.debugging_tips)
      ? candidate.debugging_tips
      : [];
  const debuggingTips = Array.isArray(rawDebuggingTips)
    ? rawDebuggingTips
        .filter((tip): tip is string => typeof tip === 'string' && tip.trim().length > 0)
        .map((tip) => tip.trim())
    : [];
  const optimizationCandidate = typeof candidate.optimization === 'string'
    ? candidate.optimization
    : typeof candidate.optimization_level === 'string'
      ? candidate.optimization_level
      : '';
  const optimization = optimizationCandidate === 'bruteforce' ||
    optimizationCandidate === 'optimized' ||
    optimizationCandidate === 'highly-optimized'
    ? optimizationCandidate
    : 'optimized';
  const modeCandidate = typeof candidate.mode === 'string'
    ? candidate.mode
    : typeof candidate.generation_mode === 'string'
      ? candidate.generation_mode
      : '';
  const mode = modeCandidate === 'deep' ? 'deep' : 'fast';
  const generationTimeSource = typeof candidate.generationTimeMs === 'number'
    ? candidate.generationTimeMs
    : typeof candidate.generation_time_ms === 'number'
      ? candidate.generation_time_ms
      : 0;
  const generationTimeMs = Number.isFinite(generationTimeSource)
    ? generationTimeSource
    : 0;

  return {
    code,
    language,
    summary,
    explanation,
    complexity,
    debuggingTips,
    optimization,
    mode,
    generationTimeMs,
  };
}

function normalizeGenerateLessonResponse(data: unknown): GenerateLessonResponse {
  if (!data || typeof data !== 'object') {
    throw new Error('The generator returned an invalid lesson response.');
  }

  const candidate = data as Record<string, unknown>;
  const metadata = candidate.metadata && typeof candidate.metadata === 'object'
    ? candidate.metadata as Record<string, unknown>
    : null;
  const sections = Array.isArray(candidate.sections)
    ? candidate.sections
    : Array.isArray(metadata?.sections)
      ? metadata.sections
      : [];
  const keyTakeaways = Array.isArray(candidate.key_takeaways)
    ? candidate.key_takeaways
    : Array.isArray(candidate.keyTakeaways)
      ? candidate.keyTakeaways
      : [];
  const questions = Array.isArray(candidate.questions)
    ? candidate.questions
    : Array.isArray(candidate.practice_questions)
      ? candidate.practice_questions
      : [];
  const quizQuestions = Array.isArray(candidate.quiz_questions)
    ? candidate.quiz_questions
    : Array.isArray(candidate.quizQuestions)
      ? candidate.quizQuestions
      : [];
  const title = typeof candidate.title === 'string' && candidate.title.trim()
    ? candidate.title.trim()
    : typeof candidate.topic === 'string' && candidate.topic.trim()
      ? candidate.topic.trim()
      : 'Untitled lesson';
  const slug = typeof candidate.slug === 'string' && candidate.slug.trim()
    ? candidate.slug.trim()
    : '';
  const summary = typeof candidate.summary === 'string' && candidate.summary.trim()
    ? candidate.summary.trim()
    : 'Your lesson is ready.';
  const content = typeof candidate.content === 'string' && candidate.content.trim()
    ? candidate.content
    : sections.length > 0
      ? sections
          .map((section) => {
            if (!section || typeof section !== 'object') return '';
            const item = section as Record<string, unknown>;
            const heading = typeof item.heading === 'string' ? item.heading.trim() : '';
            const body = typeof item.body === 'string' ? item.body.trim() : '';
            if (!heading && !body) return '';
            return `## ${heading || 'Section'}\n\n${body}`;
          })
          .filter((section): section is string => section.length > 0)
          .join('\n\n')
    : '';

  if (!slug) {
    throw new Error('The generator returned an incomplete lesson.');
  }

  const difficultyCandidate = typeof candidate.difficulty === 'string'
    ? candidate.difficulty
    : typeof candidate.difficulty_level === 'string'
      ? candidate.difficulty_level
      : '';
  const difficulty = difficultyCandidate === 'beginner' ||
    difficultyCandidate === 'intermediate' ||
    difficultyCandidate === 'advanced'
    ? difficultyCandidate
    : 'beginner';

  return {
    id: typeof candidate.id === 'string' ? candidate.id : null,
    title,
    topic: typeof candidate.topic === 'string' && candidate.topic.trim() ? candidate.topic.trim() : title,
    slug,
    summary,
    content,
    sections,
    key_takeaways: Array.isArray(keyTakeaways)
      ? keyTakeaways.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
    questions: Array.isArray(questions)
      ? questions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
    quiz_questions: Array.isArray(quizQuestions)
      ? quizQuestions.filter((item): item is GenerateLessonResponse['quiz_questions'][number] => {
          if (!item || typeof item !== 'object') return false;
          const options = (item as Record<string, unknown>).options;
          return typeof (item as Record<string, unknown>).question === 'string' &&
            Array.isArray(options) &&
            options.length === 4;
        })
      : [],
    difficulty,
    estimated_read_time_minutes: typeof candidate.estimated_read_time_minutes === 'number'
      ? candidate.estimated_read_time_minutes
      : 1,
    section_count: typeof candidate.section_count === 'number'
      ? candidate.section_count
      : sections.length > 0
        ? sections.length
        : 0,
    has_code_examples: typeof candidate.has_code_examples === 'boolean'
      ? candidate.has_code_examples
      : Boolean(candidate.hasCodeExamples),
    has_deep_dives: typeof candidate.has_deep_dives === 'boolean'
      ? candidate.has_deep_dives
      : Boolean(candidate.hasDeepDives),
    generation_time_ms: typeof candidate.generation_time_ms === 'number'
      ? candidate.generation_time_ms
      : typeof candidate.generationTimeMs === 'number'
        ? candidate.generationTimeMs
        : 0,
    generationTimeMs: typeof candidate.generationTimeMs === 'number'
      ? candidate.generationTimeMs
      : typeof candidate.generation_time_ms === 'number'
        ? candidate.generation_time_ms
        : 0,
    model_used: typeof candidate.model_used === 'string'
      ? candidate.model_used
      : typeof candidate.model === 'string'
        ? candidate.model
        : '',
    cached: Boolean(candidate.cached),
    quality_flag: candidate.quality_flag === 'below_threshold' || candidate.quality_flag === 'regenerated'
      ? candidate.quality_flag
      : 'ok',
    similar_lesson: candidate.similar_lesson && typeof candidate.similar_lesson === 'object' &&
        typeof (candidate.similar_lesson as Record<string, unknown>).slug === 'string' &&
        typeof (candidate.similar_lesson as Record<string, unknown>).topic === 'string'
      ? {
          slug: String((candidate.similar_lesson as Record<string, unknown>).slug),
          topic: String((candidate.similar_lesson as Record<string, unknown>).topic),
        }
      : null,
  };
}

// Lessons queries
export const useLessonsQuery = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['lessons', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');

      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data as Lesson[]).filter((lesson) => lesson.ai_model_used !== 'template-fallback');
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
};

export const useLessonQuery = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['lesson', slug],
    queryFn: async () => {
      if (!slug) throw new Error('Lesson slug required');

      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('slug', slug)
        .eq('is_deleted', false)
        .single();

      if (error) throw error;
      return data as Lesson;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });
};

// Profile queries
export const useProfileQuery = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data as Profile;
    },
    enabled: !!userId,
  });
};

// Analytics queries
export const useAnalyticsQuery = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['analytics', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');

      // Fetch streak
      const { data: streak } = await supabase
        .from('learning_streaks')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Fetch last 30 days of stats
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: dailyStats, error: statsError } = await supabase
        .from('daily_stats')
        .select('*')
        .eq('user_id', userId)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (statsError) throw statsError;

      // Fetch recent activity
      const { data: recentActivity, error: activityError } = await supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (activityError) throw activityError;

      return {
        streak: streak as LearningStreak | null,
        dailyStats: dailyStats as DailyStats[],
        recentActivity: recentActivity as ActivityLog[],
      };
    },
    enabled: !!userId,
  });
};

// Dashboard stats query
export const useDashboardStatsQuery = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['dashboardStats', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');

      // Fetch streak
      const { data: streak } = await supabase
        .from('learning_streaks')
        .select('current_streak')
        .eq('user_id', userId)
        .single();

      // Fetch daily stats totals
      const { data: dailyStats } = await supabase
        .from('daily_stats')
        .select('lessons_completed, code_generated, time_spent_minutes')
        .eq('user_id', userId);

      // Calculate totals
      const totals = (dailyStats || []).reduce(
        (acc, day) => ({
          lessonsCompleted: acc.lessonsCompleted + (day.lessons_completed || 0),
          codeGenerated: acc.codeGenerated + (day.code_generated || 0),
          timeSpentMinutes: acc.timeSpentMinutes + (day.time_spent_minutes || 0),
        }),
        { lessonsCompleted: 0, codeGenerated: 0, timeSpentMinutes: 0 }
      );

      // Fetch recent activity
      const { data: recentActivity } = await supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        lessonsCompleted: totals.lessonsCompleted,
        currentStreak: streak?.current_streak || 0,
        timeSpentMinutes: totals.timeSpentMinutes,
        codeGenerated: totals.codeGenerated,
        recentActivity: recentActivity || [],
      };
    },
    enabled: !!userId,
  });
};

// Mutation hooks with error handling and invalidation
export const useGenerateLessonMutation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ topic, difficulty }: { topic: string; difficulty?: string }) => {
      let accessToken = await getSessionAccessToken({ actionLabel: 'generate a lesson' });
      const normalizedDifficulty: GenerateLessonResponse['difficulty'] =
        difficulty === 'intermediate' || difficulty === 'advanced' ? difficulty : 'beginner';

      const url = `${getFunctionsBaseUrl()}/functions/v1/generate-lesson`;
      let response: Response | null = null;
      let responseText = '';
      let lastFetchError: Error | null = null;

      for (let attempt = 1; attempt <= GENERATE_LESSON_MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), GENERATE_LESSON_TIMEOUT_MS);

        try {
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              topic,
              difficulty: normalizedDifficulty,
              includeQuiz: false,
              forceFresh: true,
              requestId: crypto.randomUUID(),
            }),
            signal: controller.signal,
          });
          responseText = await response.text();
          lastFetchError = null;

          if (response.status === 401 && attempt < GENERATE_LESSON_MAX_ATTEMPTS) {
            accessToken = await getSessionAccessToken({ actionLabel: 'generate a lesson', forceRefresh: true });
            const retryDelayMs = GENERATE_LESSON_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            await delay(retryDelayMs);
            continue;
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            for (let probeAttempt = 1; probeAttempt <= LESSON_TIMEOUT_RECOVERY_ATTEMPTS; probeAttempt++) {
              const waitMs = probeAttempt === 1
                ? LESSON_TIMEOUT_RECOVERY_DELAY_MS
                : LESSON_TIMEOUT_RECOVERY_POLL_MS;
              await delay(waitMs);

              const recoveredLesson = await recoverRecentLessonAfterTimeout({
                topic,
                difficulty: normalizedDifficulty,
              });

              if (recoveredLesson) {
                return recoveredLesson;
              }
            }

            throw new Error('Lesson generation is taking longer than expected. Please retry in a few seconds. If generation completed, you will get the cached lesson instantly.');
          }

          lastFetchError = error instanceof Error ? error : new Error('Failed to reach the lesson generator.');
          if (attempt === GENERATE_LESSON_MAX_ATTEMPTS) {
            throw lastFetchError;
          }

          const retryDelayMs = GENERATE_LESSON_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await delay(retryDelayMs);
          continue;
        } finally {
          window.clearTimeout(timeoutId);
        }

        const shouldRetry = LESSON_GENERATION_RETRYABLE_STATUSES.has(response.status)
          && attempt < GENERATE_LESSON_MAX_ATTEMPTS;

        if (!shouldRetry) {
          break;
        }

        const retryDelayMs = GENERATE_LESSON_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await delay(retryDelayMs);
      }

      if (!response) {
        throw lastFetchError || new Error('No response received from the lesson generator.');
      }

      if (!response.ok) {
        let errorMessage = 'Failed to generate lesson';
        let errorCode: string | undefined;
        const parsedError = tryParseJson(responseText);
        if (parsedError && typeof parsedError === 'object') {
          const errorData = parsedError as Record<string, unknown>;
          errorMessage = typeof errorData.error === 'string'
            ? errorData.error
            : typeof errorData.message === 'string'
              ? errorData.message
              : errorMessage;
          errorCode = typeof errorData.code === 'string' ? errorData.code : undefined;
        } else {
          errorMessage = responseText || errorMessage;
        }

        if (response.status === 401) {
          throw createFunctionError('Session expired. Please sign in again.', 'UNAUTHORIZED');
        }

        if (response.status === 429 && errorCode === 'RATE_LIMIT_EXCEEDED') {
          const remaining = response.headers.get('X-RateLimit-Remaining');
          throw createFunctionError(
            remaining === '0'
              ? 'You have reached today\'s lesson limit. Please try again after the reset window.'
              : errorMessage,
            errorCode
          );
        }

        if ((response.status === 502 || response.status === 503) && errorCode === 'PARSE_FAILED') {
          throw createFunctionError('The AI returned malformed lesson content. Please try again.', errorCode);
        }

        if (response.status === 502 || response.status === 503) {
          throw createFunctionError('The lesson generator could not secure a model right now. Please try again.', errorCode);
        }

        throw createFunctionError(errorMessage, errorCode);
      }

      const rawData = tryParseJson(responseText);
      if (!rawData) {
        throw new Error('The lesson generator returned malformed JSON.');
      }

      const normalized = normalizeGenerateLessonResponse(rawData);
      const remainingHeader = Number.parseInt(response.headers.get('X-RateLimit-Remaining') || '', 10);
      normalized.rate_limit_remaining = Number.isFinite(remainingHeader) ? remainingHeader : undefined;
      normalized.rate_limit_reset = response.headers.get('X-RateLimit-Reset');
      return normalized;
    },
    onSuccess: (data) => {
      const similarLessonHint = !data.cached && data.similar_lesson
        ? ` Similar lesson found: "${data.similar_lesson.topic}".`
        : '';

      toast({
        title: data.cached ? 'Existing lesson found' : 'Lesson generated!',
        description: data.cached
          ? `You already have "${data.title}". Opening it now.`
          : data.rate_limit_remaining >= 0
            ? `Your lesson "${data.title}" is ready. ${data.rate_limit_remaining} lesson${data.rate_limit_remaining === 1 ? '' : 's'} remaining today.${similarLessonHint}`
            : `Your lesson "${data.title}" is ready.${similarLessonHint}`,
      });
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      queryClient.invalidateQueries({ queryKey: ['lesson', data.slug] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => {
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate lesson',
        variant: 'destructive',
      });
    },
  });
};

export const useGenerateCodeMutation = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      topic,
      language,
      optimization,
      mode,
    }: GenerateCodeRequest): Promise<GenerateCodeResponse> => {
      let accessToken = await getSessionAccessToken({ actionLabel: 'generate code' });

      const url = `${getFunctionsBaseUrl()}/functions/v1/generate-code`;

      let response: Response | null = null;
      let responseText = '';

      for (let attempt = 1; attempt <= GENERATE_CODE_MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), GENERATE_CODE_TIMEOUT_MS);

        try {
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ topic, language, optimization, mode }),
            signal: controller.signal,
          });
          responseText = await response.text();

          if (response.status === 401 && attempt < GENERATE_CODE_MAX_ATTEMPTS) {
            accessToken = await getSessionAccessToken({ actionLabel: 'generate code', forceRefresh: true });
            await delay(GENERATE_CODE_RETRY_DELAY_MS * Math.pow(2, attempt - 1));
            continue;
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error('Code generation timed out. Please try again.');
          }

          throw error instanceof Error ? error : new Error('Failed to reach the code generator.');
        } finally {
          window.clearTimeout(timeoutId);
        }

        if (!CODE_GENERATION_RETRYABLE_STATUSES.has(response.status) || attempt === GENERATE_CODE_MAX_ATTEMPTS) {
          break;
        }

        await delay(GENERATE_CODE_RETRY_DELAY_MS * Math.pow(2, attempt - 1));
      }

      if (!response) {
        throw new Error('No response received from the generator.');
      }

      if (!response.ok) {
        let errorMessage = `Error ${response.status}`;
        const parsedError = tryParseJson(responseText);
        if (parsedError && typeof parsedError === 'object') {
          const errorData = parsedError as Record<string, unknown>;
          errorMessage = typeof errorData.error === 'string'
            ? errorData.error
            : typeof errorData.message === 'string'
              ? errorData.message
              : errorMessage;
        } else {
          errorMessage = responseText || errorMessage;
        }

        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.');
        } else if (response.status === 429) {
          throw new Error('The free coding models are under heavy load. Please try again in a minute.');
        } else if (response.status === 502 || response.status === 503) {
          throw new Error('The generator could not secure a free model right now. Please try again shortly.');
        }

        throw new Error(errorMessage);
      }

      const rawData = tryParseJson(responseText);
      if (!rawData) {
        throw new Error('The generator returned malformed JSON.');
      }

      const data = normalizeGenerateCodeResponse(rawData);

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Code generated!',
        description: `${data.language || 'Code'} ready with ${data.optimization || 'optimized'} approach.`,
      });
    },
    onError: (error) => {
      console.error('Generation error:', error);
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateProfileMutation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<Profile> }) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast({
        title: 'Profile updated',
        description: 'Your profile has been saved.',
      });
      queryClient.invalidateQueries({ queryKey: ['profile', variables.userId] });
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });
};

export const useIncrementLessonViewMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lessonId }: { lessonId: string; currentCount?: number }) => {
      const { error } = await supabase.rpc('increment_lesson_views', {
        p_lesson_id: lessonId,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // Invalidate lesson queries to refresh view count
      queryClient.invalidateQueries({ queryKey: ['lesson'] });
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
    },
  });
};
