import { useMemo, useState } from 'react';
import { Check, ChevronRight, Copy, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import CodeEditor from '@/components/CodeEditor';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { GenerateCodeResponse, GenerationMode, OptimizationLevel } from '@/lib/types';
import { cn } from '@/lib/utils';

const languages = ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'Go', 'Rust'];
const DEFAULT_SUMMARY = 'Generated a working solution for your request.';
const DEFAULT_EXPLANATION = 'A detailed walkthrough is being prepared for this generated code.';
const DEFAULT_COMPLEXITY = 'Estimated Time: O(n) | Estimated Space: O(n)';
const DEFAULT_DEBUGGING_TIPS = 'Try the result with a tiny sample input first, then test one edge case.';
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const GENERATE_CODE_STREAM_TIMEOUT_MS = 120_000;

const starterPrompts = [
  'Build an API endpoint with validation and error handling.',
  'Write a clean sorting function and explain each important step.',
  'Create a React component with loading, empty, and error states.',
];

const optimizationOptions: Array<{
  value: OptimizationLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'bruteforce',
    label: 'Simple',
    description: 'Best for learning the base idea first.',
  },
  {
    value: 'optimized',
    label: 'Balanced',
    description: 'Clean default with solid performance.',
  },
  {
    value: 'highly-optimized',
    label: 'Maximum',
    description: 'Pushes for the strongest practical performance.',
  },
];

function inferMode(task: string, optimization: OptimizationLevel): GenerationMode {
  if (optimization === 'highly-optimized') {
    return 'deep';
  }

  return /architecture|full stack|system design|production|detailed|in depth|step by step|multiple files/i.test(task)
    ? 'deep'
    : 'fast';
}

function getNonEmptyText(value: string | null | undefined, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function buildDetailedExplanation(result: GenerateCodeResponse) {
  const explanation = getNonEmptyText(result.explanation, DEFAULT_EXPLANATION);
  const complexity = getNonEmptyText(result.complexity, DEFAULT_COMPLEXITY);
  const sections = [
    `Summary\n${getNonEmptyText(result.summary, DEFAULT_SUMMARY)}`,
    `How It Works\n${explanation}`,
    `Complexity\n${complexity}`,
  ];

  if (Array.isArray(result.debuggingTips) && result.debuggingTips.length > 0) {
    sections.push(`Debugging Tips\n${result.debuggingTips.map((tip, index) => `${index + 1}. ${tip}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join('\n'),
  };
}

function statusFromCodeStreamMessage(message: string): string {
  switch (message) {
    case 'connected':
      return 'Connected. Preparing chunked generation...';
    case 'generating_code':
      return 'Generating code in chunks...';
    case 'finalizing':
      return 'Finalizing explanation and complexity notes...';
    default:
      return 'Streaming response...';
  }
}

function buildStreamingPlaceholder(
  language: string,
  optimization: OptimizationLevel,
  mode: GenerationMode
): GenerateCodeResponse {
  return {
    code: '',
    language,
    summary: 'Generating your solution in chunks...',
    explanation: 'Code is still streaming. Explanation will appear when generation completes.',
    complexity: DEFAULT_COMPLEXITY,
    debuggingTips: [],
    optimization,
    mode,
    generationTimeMs: 0,
  };
}

function normalizeStreamCompletePayload(
  payload: Record<string, unknown>,
  options: {
    fallbackCode: string;
    language: string;
    optimization: OptimizationLevel;
    mode: GenerationMode;
  }
): GenerateCodeResponse {
  const codeCandidate = typeof payload.code === 'string' ? payload.code.trimEnd() : '';
  const code = codeCandidate || options.fallbackCode;
  if (!code) {
    throw new Error('The generator returned an empty code result.');
  }

  const language = typeof payload.language === 'string' && payload.language.trim().length > 0
    ? payload.language.trim()
    : options.language;
  const summary = typeof payload.summary === 'string' && payload.summary.trim().length > 0
    ? payload.summary.trim()
    : DEFAULT_SUMMARY;
  const explanation = typeof payload.explanation === 'string' && payload.explanation.trim().length > 0
    ? payload.explanation.trim()
    : DEFAULT_EXPLANATION;
  const complexity = typeof payload.complexity === 'string' && payload.complexity.trim().length > 0
    ? payload.complexity.trim()
    : DEFAULT_COMPLEXITY;

  const rawTips = Array.isArray(payload.debuggingTips)
    ? payload.debuggingTips
    : Array.isArray(payload.debugging_tips)
      ? payload.debugging_tips
      : [];
  const debuggingTips = rawTips
    .filter((tip): tip is string => typeof tip === 'string' && tip.trim().length > 0)
    .map((tip) => tip.trim());

  const optimizationValue = payload.optimization;
  const optimization = optimizationValue === 'bruteforce' ||
    optimizationValue === 'optimized' ||
    optimizationValue === 'highly-optimized'
    ? optimizationValue
    : options.optimization;

  const modeValue = payload.mode;
  const mode = modeValue === 'fast' || modeValue === 'deep'
    ? modeValue
    : options.mode;

  const generationTimeMsCandidate = typeof payload.generationTimeMs === 'number'
    ? payload.generationTimeMs
    : typeof payload.generation_time_ms === 'number'
      ? payload.generation_time_ms
      : 0;
  const generationTimeMs = Number.isFinite(generationTimeMsCandidate)
    ? generationTimeMsCandidate
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

export default function CodePage() {
  const { toast } = useToast();

  const [task, setTask] = useState('');
  const [language, setLanguage] = useState('JavaScript');
  const [optimization, setOptimization] = useState<OptimizationLevel>('optimized');
  const [generatedResult, setGeneratedResult] = useState<GenerateCodeResponse | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<'code' | 'explanation' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamStatus, setStreamStatus] = useState('');

  const activeMode = useMemo(() => inferMode(task, optimization), [task, optimization]);
  const detailedExplanation = useMemo(
    () => (generatedResult ? buildDetailedExplanation(generatedResult) : ''),
    [generatedResult]
  );

  const resetCopyState = (target: 'code' | 'explanation') => {
    setCopiedTarget(target);
    window.setTimeout(() => {
      setCopiedTarget((current) => (current === target ? null : current));
    }, 1800);
  };

  const copyText = async (value: string, target: 'code' | 'explanation') => {
    try {
      await navigator.clipboard.writeText(value);
      resetCopyState(target);
      toast({
        title: target === 'code' ? 'Code copied' : 'Explanation copied',
        description: 'The content is now in your clipboard.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleGenerate = async () => {
    const trimmedTask = task.trim();

    if (!trimmedTask) {
      toast({
        title: 'Task required',
        description: 'Describe what you want to generate first.',
        variant: 'destructive',
      });
      return;
    }

    let timeoutId: number | null = null;

    try {
      const mode = inferMode(trimmedTask, optimization);

      setIsGenerating(true);
      setStreamStatus('Connecting to code stream...');
      setGeneratedResult(buildStreamingPlaceholder(language, optimization, mode));

      const baseUrl = typeof import.meta.env.VITE_SUPABASE_URL === 'string'
        ? import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')
        : '';

      if (!baseUrl) {
        throw new Error('VITE_SUPABASE_URL is missing.');
      }

      let {
        data: { session },
      } = await supabase.auth.getSession();

      const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
      if (!session?.access_token || (expiresAt > 0 && expiresAt - Date.now() < TOKEN_REFRESH_BUFFER_MS)) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed.data.session;
      }

      if (!session?.access_token) {
        throw new Error('Please sign in to generate code.');
      }

      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), GENERATE_CODE_STREAM_TIMEOUT_MS);

      const response = await fetch(`${baseUrl}/functions/v1/generate-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          topic: trimmedTask,
          language,
          optimization,
          mode,
          stream: true,
          requestId: crypto.randomUUID(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText || `Error ${response.status}`;

        try {
          const parsed = JSON.parse(errorText) as Record<string, unknown>;
          if (typeof parsed.error === 'string') {
            errorMessage = parsed.error;
          } else if (typeof parsed.message === 'string') {
            errorMessage = parsed.message;
          }
        } catch {
          // Keep original response text when parsing fails.
        }

        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error('Streaming response body is unavailable.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';
      let fullCode = '';
      let streamCompleted = false;

      const handleParsedBlock = (event: string, payload: Record<string, unknown>) => {
        if (event === 'status') {
          setStreamStatus(statusFromCodeStreamMessage(String(payload.message || '')));
          return;
        }

        if (event === 'chunk') {
          const streamedChunk = typeof payload.chunk === 'string' ? payload.chunk : '';
          if (!streamedChunk) {
            return;
          }

          fullCode += streamedChunk;
          setGeneratedResult((current) => {
            const base = current ?? buildStreamingPlaceholder(language, optimization, mode);
            return {
              ...base,
              code: `${base.code}${streamedChunk}`,
            };
          });
          return;
        }

        if (event === 'complete') {
          const normalized = normalizeStreamCompletePayload(payload, {
            fallbackCode: fullCode,
            language,
            optimization,
            mode,
          });

          setGeneratedResult(normalized);
          setStreamStatus('Code generated successfully.');
          streamCompleted = true;

          toast({
            title: 'Code generated!',
            description: `${normalized.language || 'Code'} ready with ${normalized.optimization || 'optimized'} approach.`,
          });
          return;
        }

        if (event === 'error') {
          const errorMessage = typeof payload.error === 'string'
            ? payload.error
            : 'Code stream failed.';
          throw new Error(errorMessage);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffered += decoder.decode(value, { stream: true });
        const chunks = buffered.split('\n\n');
        buffered = chunks.pop() || '';

        for (const chunk of chunks) {
          if (!chunk || chunk.startsWith(':')) {
            continue;
          }

          const parsedBlock = parseSseBlock(chunk);
          if (!parsedBlock) {
            continue;
          }

          const payload = (() => {
            try {
              return JSON.parse(parsedBlock.data) as Record<string, unknown>;
            } catch {
              return {} as Record<string, unknown>;
            }
          })();

          handleParsedBlock(parsedBlock.event, payload);
        }
      }

      if (buffered.trim()) {
        const parsedBlock = parseSseBlock(buffered);
        if (parsedBlock) {
          const payload = (() => {
            try {
              return JSON.parse(parsedBlock.data) as Record<string, unknown>;
            } catch {
              return {} as Record<string, unknown>;
            }
          })();

          handleParsedBlock(parsedBlock.event, payload);
        }
      }

      if (!streamCompleted) {
        throw new Error('Code stream ended before completion. Please try again.');
      }
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Code generation timed out. Please try again.'
        : error instanceof Error
          ? error.message
          : 'Please try again.';

      setStreamStatus('Generation stopped due to an error.');
      toast({
        title: 'Generation failed',
        description: message,
        variant: 'destructive',
      });
      return;
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.18),transparent_40%)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-sky-200">
            <Sparkles className="h-3.5 w-3.5" />
            Code generation
          </div>
          <div className="max-w-3xl space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Generate clean code with a full explanation.
            </h1>
            <p className="text-sm leading-7 text-muted-foreground md:text-base">
              The flow is intentionally simple: describe the task, choose the language, generate the code, then review the
              detailed walkthrough below it.
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="border-white/10 bg-black/30 shadow-[0_18px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <CardHeader className="space-y-3">
              <CardTitle className="text-lg text-white">Describe the code you want</CardTitle>
              <p className="text-sm leading-6 text-zinc-400">
                The generator uses a faster profile for short requests and a deeper profile when the task needs more reasoning.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="code-language">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="code-language" className="h-11 border-white/10 bg-white/[0.03]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Optimization</Label>
                <div className="grid gap-2">
                  {optimizationOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setOptimization(option.value)}
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left transition-colors',
                        optimization === option.value
                          ? 'border-sky-400/40 bg-sky-400/10'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-white">{option.label}</span>
                        {optimization === option.value ? (
                          <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[11px] font-medium text-sky-200">
                            Selected
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-zinc-400">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="code-task">Task</Label>
                <Textarea
                  id="code-task"
                  value={task}
                  onChange={(event) => setTask(event.target.value)}
                  placeholder="Example: Build a debounce utility in TypeScript and explain the important lines."
                  className="min-h-[200px] resize-none border-white/10 bg-white/[0.03] px-4 py-3 leading-7"
                />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Quick starters</p>
                <div className="grid gap-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setTask(prompt)}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm leading-6 text-zinc-200 transition-colors hover:bg-white/[0.05]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Response profile</p>
                <div className="mt-2 flex items-center gap-2 text-sm text-zinc-300">
                  <ChevronRight className="h-4 w-4 text-sky-300" />
                  <span>{activeMode === 'fast' ? 'Fast response' : 'Deep response'}</span>
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !task.trim()}
                className="h-12 w-full rounded-2xl border-0 bg-[linear-gradient(135deg,rgba(56,189,248,1),rgba(37,99,235,1))] text-sm font-semibold text-slate-950 shadow-[0_16px_34px_rgba(37,99,235,0.28)] hover:opacity-95"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate code'
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-white/10 bg-black/30 shadow-[0_18px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
              <CardHeader className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-lg text-white">Generated output</CardTitle>
                  <p className="text-sm leading-6 text-zinc-400">
                    Clean code first, then the full walkthrough below so the result stays easy to scan.
                  </p>
                </div>

                {generatedResult ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {isGenerating ? (
                      <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-xs text-sky-100">
                        {streamStatus || 'Streaming response...'}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
                      {generatedResult.language}
                    </span>
                    {generatedResult.generationTimeMs > 0 ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
                        {(generatedResult.generationTimeMs / 1000).toFixed(1)}s
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
                      {generatedResult.mode === 'fast' ? 'Fast' : 'Deep'}
                    </span>
                  </div>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-6 pt-6">
                {generatedResult ? (
                  <>
                    <div className="flex items-start justify-between gap-4 rounded-2xl border border-sky-400/15 bg-sky-400/8 px-4 py-4">
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-200">Summary</p>
                        <p className="text-sm leading-6 text-zinc-100">{getNonEmptyText(generatedResult.summary, DEFAULT_SUMMARY)}</p>
                        {isGenerating ? (
                          <p className="text-xs text-sky-100/90">{streamStatus || 'Generating code in chunks...'}</p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => copyText(generatedResult.code, 'code')}
                        disabled={!generatedResult.code.trim()}
                        className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-zinc-100 hover:bg-white/[0.08]"
                      >
                        {copiedTarget === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copiedTarget === 'code' ? 'Copied' : 'Copy code'}
                      </Button>
                    </div>

                    <CodeEditor code={generatedResult.code} language={generatedResult.language} readOnly height="460px" />

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-white">Detailed walkthrough</h3>
                            <p className="text-sm text-zinc-400">A full explanation of what the code is doing and how to reason about it.</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => copyText(detailedExplanation, 'explanation')}
                            disabled={!detailedExplanation.trim()}
                            className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-zinc-100 hover:bg-white/[0.08]"
                          >
                            {copiedTarget === 'explanation' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copiedTarget === 'explanation' ? 'Copied' : 'Copy text'}
                          </Button>
                        </div>
                        <div className="min-h-[260px] rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm leading-7 text-zinc-200 whitespace-pre-wrap">
                          {detailedExplanation || DEFAULT_EXPLANATION}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Complexity</p>
                          <p className="mt-3 text-sm leading-6 text-zinc-200">
                            {getNonEmptyText(generatedResult.complexity, DEFAULT_COMPLEXITY)}
                          </p>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Debugging tips</p>
                          <div className="mt-3 space-y-2">
                            {generatedResult.debuggingTips.length > 0 ? (
                              generatedResult.debuggingTips.map((tip) => (
                                <div key={tip} className="rounded-2xl bg-white/[0.03] px-3 py-3 text-sm leading-6 text-zinc-200">
                                  {tip}
                                </div>
                              ))
                            ) : (
                              <p className="text-sm leading-6 text-zinc-400">{DEFAULT_DEBUGGING_TIPS}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[540px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
                    <div className="space-y-3">
                      <h2 className="text-2xl font-semibold text-white">Ready when you are</h2>
                      <p className="mx-auto max-w-xl text-sm leading-7 text-zinc-400">
                        Your generated code will appear here with a detailed explanation, complexity notes, and debugging guidance.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
