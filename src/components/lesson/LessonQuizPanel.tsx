import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Lightbulb, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type {
  GenerateLessonQuizResponse,
  Lesson,
  LessonQuizQuestion,
  LessonSection,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface LessonQuizPanelProps {
  lesson: Lesson;
  sections: Array<LessonSection & { id: string }>;
  active: boolean;
  onBackToLesson: () => void;
}

const TOKEN_REFRESH_BUFFER_MS = 60_000;

function getFunctionsBaseUrl() {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (typeof baseUrl !== 'string' || baseUrl.trim().length === 0) {
    throw new Error('VITE_SUPABASE_URL is not configured. Set it in your environment variables.');
  }

  return baseUrl.replace(/\/$/, '');
}

function tryParseJson<T>(text: string): T | null {
  const normalized = text.trim();
  if (!normalized) return null;

  try {
    return JSON.parse(normalized) as T;
  } catch {
    return null;
  }
}

async function getSessionAccessToken(actionLabel: string, forceRefresh = false) {
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

function ConfettiBurst({ trigger }: { trigger: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!trigger) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const colors = ['#6366f1', '#38bdf8', '#10b981', '#f59e0b'];
    const particles = Array.from({ length: 48 }, () => ({
      x: rect.width / 2,
      y: rect.height / 2,
      angle: Math.random() * Math.PI * 2,
      speed: 1.4 + Math.random() * 3.2,
      radius: 2 + Math.random() * 3,
      alpha: 1,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let raf = 0;
    let start = 0;

    const tick = (time: number) => {
      if (!start) start = time;
      const elapsed = time - start;
      ctx.clearRect(0, 0, rect.width, rect.height);

      particles.forEach((particle) => {
        particle.x += Math.cos(particle.angle) * particle.speed;
        particle.y += Math.sin(particle.angle) * particle.speed + elapsed * 0.0009;
        particle.alpha = Math.max(0, 1 - elapsed / 1500);

        ctx.save();
        ctx.globalAlpha = particle.alpha;
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.radius * 2.2, particle.radius);
        ctx.restore();
      });

      if (elapsed < 1500) {
        raf = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [trigger]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

export function LessonQuizPanel({ lesson, sections, active, onBackToLesson }: LessonQuizPanelProps) {
  const requestedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [provider, setProvider] = useState<'anthropic' | 'openrouter' | 'stored' | null>(null);
  const [questions, setQuestions] = useState<LessonQuizQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Array<{ selectedIndex: number; isCorrect: boolean }>>([]);
  const [confettiTick, setConfettiTick] = useState(0);

  const currentQuestion = questions[currentIndex];
  const isFinished = status === 'ready' && answers.length === questions.length && questions.length > 0;
  const storedQuestions = useMemo(
    () => (Array.isArray(lesson.quiz_questions)
      ? lesson.quiz_questions
          .filter((question): question is LessonQuizQuestion => {
            return Boolean(question?.question) && Array.isArray(question?.options) && question.options.length === 4;
          })
          .map((question) => ({
            ...question,
            sectionHeading: question.sectionHeading || question.sectionRef,
          }))
      : []),
    [lesson.quiz_questions]
  );

  const resetQuiz = useCallback(() => {
    setCurrentIndex(0);
    setSelectedIndex(null);
    setRevealed(false);
    setAnswers([]);
  }, []);

  const retryGeneration = useCallback(() => {
    requestedRef.current = false;
    setProvider(null);
    setQuestions([]);
    setError(null);
    setStatus('idle');
    resetQuiz();
  }, [resetQuiz]);

  useEffect(() => {
    if (!active || requestedRef.current) return;

    requestedRef.current = true;
    if (storedQuestions.length >= 3) {
      setQuestions(storedQuestions);
      setProvider('stored');
      setStatus('ready');
      setError(null);
      return;
    }

    setStatus('loading');
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const url = `${getFunctionsBaseUrl()}/functions/v1/generate-quiz`;
    const requestBody = {
      topic: lesson.topic,
      difficulty: lesson.difficulty_level,
      summary: lesson.summary,
      keyTakeaways: lesson.key_takeaways || [],
      sections,
      existingQuestions: lesson.questions || [],
      count: 6,
    };

    const run = async () => {
      try {
        let accessToken = await getSessionAccessToken('generate a quiz');

        const callQuizEndpoint = (token: string) => fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        let response = await callQuizEndpoint(accessToken);

        if (response.status === 401) {
          accessToken = await getSessionAccessToken('generate a quiz', true);
          response = await callQuizEndpoint(accessToken);
        }

        const text = await response.text();
        const payload = tryParseJson<GenerateLessonQuizResponse & {
          error?: string;
          message?: string;
        }>(text);

        if (!response.ok) {
          const message = payload?.error || payload?.message || text || 'Quiz generation failed.';
          throw new Error(message);
        }

        if (!payload || !Array.isArray(payload.questions)) {
          throw new Error('Quiz generator returned an invalid response.');
        }

        const normalizedQuestions = payload.questions
          .filter((question): question is LessonQuizQuestion => {
            return Boolean(question?.question) && Array.isArray(question?.options) && question.options.length === 4;
          })
          .map((question) => ({
            ...question,
            sectionHeading: question.sectionHeading || question.sectionRef,
          }));

        if (normalizedQuestions.length < 3) {
          throw new Error('Quiz generator returned too few valid questions. Please retry.');
        }

        setQuestions(normalizedQuestions);
        setProvider(payload.provider === 'anthropic' ? 'anthropic' : 'openrouter');
        setStatus('ready');
      } catch (generationError) {
        if (generationError instanceof DOMException && generationError.name === 'AbortError') return;
        setError(generationError instanceof Error ? generationError.message : 'Failed to generate quiz.');
        setStatus('error');
      }
    };

    run();
    return () => controller.abort();
  }, [active, lesson, sections, storedQuestions]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const handleAnswer = (index: number) => {
    if (revealed) return;
    setSelectedIndex(index);
    window.setTimeout(() => setRevealed(true), 300);
  };

  const handleNext = () => {
    if (!currentQuestion || selectedIndex === null) return;

    const nextAnswer = {
      selectedIndex,
      isCorrect: selectedIndex === currentQuestion.correctIndex,
    };

    const nextAnswers = [...answers, nextAnswer];
    setAnswers(nextAnswers);
    setSelectedIndex(null);
    setRevealed(false);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((value) => value + 1);
      return;
    }

    if (nextAnswers.every((answer) => answer.isCorrect)) {
      setConfettiTick((value) => value + 1);
    }
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="lesson-surface rounded-[1.9rem] p-5 sm:p-7 lg:p-8">
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/42">Preparing your quiz...</p>
        <div className="mt-8 space-y-3">
          <div className="lesson-skeleton-line h-4 w-40" />
          <div className="lesson-skeleton-line h-4 w-full" />
          <div className="lesson-skeleton-line h-4 w-[86%]" />
        </div>
        <div className="mt-8 grid gap-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="lesson-skeleton-line h-16 w-full rounded-[1rem]" />
          ))}
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="lesson-surface rounded-[1.9rem] p-5 sm:p-7 lg:p-8">
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/42">Quiz unavailable</p>
        <p className="mt-4 text-[15px] leading-7 text-white/72">{error}</p>
        <Button
          onClick={retryGeneration}
          className="lesson-pill lesson-pill-primary mt-6 border px-5 py-2.5 text-sm normal-case tracking-normal text-white"
        >
          Try again
        </Button>
      </div>
    );
  }

  if (isFinished) {
    const correctCount = answers.filter((answer) => answer.isCorrect).length;
    const percentage = Math.round((correctCount / Math.max(questions.length, 1)) * 100);

    return (
      <div className="lesson-results-card p-6 sm:p-10">
        <ConfettiBurst trigger={confettiTick} />
        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <p className="text-[11px] uppercase tracking-[0.12em] text-white/42">
            Quiz complete {provider ? `· ${provider === 'anthropic' ? 'Anthropic' : provider === 'openrouter' ? 'OpenRouter' : 'Saved quiz'}` : ''}
          </p>
          <div className="mt-5 font-editorial text-4xl text-white sm:text-6xl">
            {correctCount} / {questions.length}
          </div>
          <p className="mt-3 text-sm text-white/60">{percentage}% correct</p>

          <div className="mt-8 flex justify-center gap-2">
            {answers.map((answer, index) => (
              <span
                key={index}
                className={cn(
                  'h-3 w-3 rounded-full',
                  answer.isCorrect ? 'bg-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.34)]' : 'bg-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.24)]'
                )}
              />
            ))}
          </div>

          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-7 text-white/78">
            {correctCount === questions.length
              ? 'Excellent grasp. You landed every answer cleanly.'
              : percentage >= 80
                ? 'Strong work. You clearly understand the core ideas.'
                : percentage >= 60
                  ? 'Good start. Revisit the lesson and take another pass.'
                  : 'There is a solid base here. Review the lesson and try again.'}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={resetQuiz} className="lesson-pill lesson-pill-primary w-full justify-center border px-5 py-2.5 text-sm normal-case tracking-normal text-white sm:w-auto">
              Retake quiz
            </Button>
            <Button variant="outline" onClick={onBackToLesson} className="w-full border-white/10 bg-white/5 text-white/82 hover:bg-white/10 sm:w-auto">
              Back to lesson
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lesson-surface rounded-[1.9rem] p-5 sm:p-8 lg:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 sm:mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-white/42">Practice quiz</p>
          <p className="mt-2 text-sm text-white/62">
            Question {currentIndex + 1} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-white/42">
          <WandSparkles className="h-4 w-4" />
          {provider === 'anthropic' ? 'Anthropic' : provider === 'openrouter' ? 'OpenRouter' : 'Saved quiz'}
        </div>
      </div>

      <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1 sm:mb-8 sm:gap-2">
        {questions.map((_, index) => (
          <span
            key={index}
            className={cn(
              'h-2.5 w-10 shrink-0 rounded-full bg-white/8 sm:w-12',
              index < currentIndex && 'bg-emerald-400/80 shadow-[0_0_18px_rgba(16,185,129,0.18)]',
              index === currentIndex && 'bg-indigo-400/80 shadow-[0_0_20px_rgba(99,102,241,0.22)]'
            )}
          />
        ))}
      </div>

      {currentQuestion && (
        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/42">
              {currentQuestion.sectionHeading || currentQuestion.sectionRef || 'Lesson comprehension'}
            </p>
            <h2 className="font-editorial text-[20px] leading-snug text-white sm:text-[26px] sm:leading-tight">
              {currentQuestion.question}
            </h2>
          </div>

          <div className="grid gap-3 sm:gap-4">
            {currentQuestion.options.map((option, index) => {
              const letter = String.fromCharCode(65 + index);
              const isSelected = selectedIndex === index;
              const isCorrect = revealed && index === currentQuestion.correctIndex;
              const isWrong = revealed && isSelected && index !== currentQuestion.correctIndex;

              return (
                <button
                  key={`${currentQuestion.question}-${index}`}
                  type="button"
                  onClick={() => handleAnswer(index)}
                  disabled={revealed}
                  className={cn(
                    'lesson-quiz-option flex w-full items-start gap-3 px-3 py-3.5 text-left sm:items-center sm:gap-4 sm:px-4 sm:py-4',
                    isSelected && 'is-selected',
                    isCorrect && 'is-correct',
                    isWrong && 'is-wrong'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-mono sm:h-9 sm:w-9 sm:text-xs',
                      isCorrect
                        ? 'border-emerald-400/40 bg-emerald-400/18 text-emerald-200'
                        : isWrong
                          ? 'border-rose-400/35 bg-rose-400/18 text-rose-200'
                          : 'border-white/12 bg-white/5 text-white/64'
                    )}
                  >
                    {letter}
                  </span>
                  <span className="flex-1 text-sm leading-6 text-white/86 sm:text-[15px] sm:leading-7">{option}</span>
                  {revealed && isCorrect && <Check className="h-5 w-5 shrink-0 text-emerald-300" />}
                </button>
              );
            })}
          </div>

          <div
            className="lesson-quiz-explanation overflow-y-auto"
            style={{
              maxHeight: revealed ? 360 : 0,
              opacity: revealed ? 1 : 0,
              marginTop: revealed ? 0 : -8,
            }}
          >
            <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
              <Lightbulb className="mt-0.5 h-4 w-4 text-sky-300" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-sky-300/88">Explanation</p>
                <p className="mt-2 text-sm leading-6 text-white/72 sm:text-[15px] sm:leading-7">{currentQuestion.explanation}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-2">
            <p className="w-full text-xs text-white/52 sm:w-auto sm:text-sm sm:text-white/48">
              {revealed
                ? selectedIndex === currentQuestion.correctIndex
                  ? 'Correct answer revealed.'
                  : 'The correct answer has been highlighted.'
                : 'Choose an answer to continue.'}
            </p>
            <Button
              onClick={handleNext}
              disabled={!revealed || selectedIndex === null}
              className="lesson-pill lesson-pill-primary w-full justify-center border px-5 py-2.5 text-sm normal-case tracking-normal text-white disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              Next question
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
