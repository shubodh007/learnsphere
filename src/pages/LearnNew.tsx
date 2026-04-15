import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock3,
  Lightbulb,
  Loader2,
  Microscope,
  School,
  Search,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { LessonSection } from '@/lib/types';
import { cn } from '@/lib/utils';

const difficultyDetails = {
  beginner: {
    label: 'Beginner',
    description: 'Core concepts, high-level analogies, and simplified foundations.',
    icon: School,
  },
  intermediate: {
    label: 'Intermediate',
    description: 'Deep dives into mechanics, relationships, and practical theory.',
    icon: Brain,
  },
  advanced: {
    label: 'Advanced',
    description: 'Nuanced edge cases, expert critique, and complex systemic analysis.',
    icon: Microscope,
  },
} as const;

const topicIdeas = [
  'Quantum Physics',
  'Roman History',
  'UI Design Principles',
];

function normalizeIncomingSection(raw: unknown): LessonSection | null {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as Record<string, unknown>;
  const heading = typeof candidate.heading === 'string' ? candidate.heading.trim() : '';
  const body = typeof candidate.body === 'string' ? candidate.body.trim() : '';
  if (!heading || !body) return null;

  const bullets = Array.isArray(candidate.bullets)
    ? candidate.bullets
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const bullet = item as Record<string, unknown>;
          const label = typeof bullet.label === 'string' ? bullet.label.trim() : '';
          const detail = typeof bullet.detail === 'string' ? bullet.detail.trim() : '';
          if (!label || !detail) return null;
          return { label, detail };
        })
        .filter(Boolean)
    : [];

  return {
    heading,
    body,
    bullets,
    deep_dive: typeof candidate.deep_dive === 'string' && candidate.deep_dive.trim().length > 0
      ? candidate.deep_dive.trim()
      : undefined,
    common_mistakes: Array.isArray(candidate.common_mistakes)
      ? candidate.common_mistakes
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const entry = item as Record<string, unknown>;
            const mistake = typeof entry.mistake === 'string' ? entry.mistake.trim() : '';
            const fix = typeof entry.fix === 'string' ? entry.fix.trim() : '';
            if (!mistake || !fix) return null;
            return { mistake, fix };
          })
          .filter(Boolean)
      : undefined,
    code: candidate.code && typeof candidate.code === 'object' && typeof (candidate.code as Record<string, unknown>).src === 'string'
      ? {
          language: typeof (candidate.code as Record<string, unknown>).language === 'string'
            ? String((candidate.code as Record<string, unknown>).language)
            : 'text',
          caption: typeof (candidate.code as Record<string, unknown>).caption === 'string'
            ? String((candidate.code as Record<string, unknown>).caption)
            : undefined,
          src: String((candidate.code as Record<string, unknown>).src),
        }
      : undefined,
  };
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) return null;

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

  if (dataLines.length === 0) return null;

  return {
    event,
    data: dataLines.join('\n'),
  };
}

function statusFromServerMessage(message: string) {
  switch (message) {
    case 'connected':
      return 'Connected. Preparing generation...';
    case 'generation_started':
      return 'Generating lesson sections...';
    case 'quiz_generation':
      return 'Finalizing quiz and checks...';
    case 'finalizing_lesson':
      return 'Saving lesson to your library...';
    default:
      return 'Generating lesson chunks...';
  }
}

export default function LearnNew() {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<keyof typeof difficultyDetails>('intermediate');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [streamSummary, setStreamSummary] = useState('');
  const [streamedSections, setStreamedSections] = useState<LessonSection[]>([]);
  const [completedLessonSlug, setCompletedLessonSlug] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const normalizedTopic = topic.trim();

  const handleGenerateLesson = async () => {
    if (!normalizedTopic) {
      toast({
        title: 'Topic required',
        description: 'Enter a topic so the lesson generator knows what to build.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsStreaming(true);
      setStreamStatus('Connecting to lesson stream...');
      setStreamError(null);
      setStreamTitle('');
      setStreamSummary('');
      setStreamedSections([]);
      setCompletedLessonSlug(null);

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
      if (!session?.access_token || (expiresAt > 0 && expiresAt - Date.now() < 60_000)) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed.data.session;
      }

      if (!session?.access_token) {
        throw new Error('Please sign in to generate a lesson.');
      }

      const response = await fetch(`${baseUrl}/functions/v1/generate-lesson`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          topic: normalizedTopic,
          difficulty,
          includeQuiz: false,
          forceFresh: true,
          stream: true,
          requestId: crypto.randomUUID(),
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to start lesson stream.');
      }

      if (!response.body) {
        throw new Error('Streaming response body is unavailable.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';
      let streamCompleted = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffered += decoder.decode(value, { stream: true });
        const chunks = buffered.split('\n\n');
        buffered = chunks.pop() || '';

        for (const chunk of chunks) {
          if (!chunk || chunk.startsWith(':')) continue;

          const parsedBlock = parseSseBlock(chunk);
          if (!parsedBlock) continue;

          const payload = (() => {
            try {
              return JSON.parse(parsedBlock.data) as Record<string, unknown>;
            } catch {
              return {} as Record<string, unknown>;
            }
          })();

          if (parsedBlock.event === 'status') {
            setStreamStatus(statusFromServerMessage(String(payload.message || '')));
            continue;
          }

          if (parsedBlock.event === 'section') {
            const section = normalizeIncomingSection(payload.section);
            if (!section) continue;
            setStreamedSections((current) => {
              if (current.some((item) => item.heading.toLowerCase() === section.heading.toLowerCase())) {
                return current;
              }
              return [...current, section];
            });
            continue;
          }

          if (parsedBlock.event === 'complete') {
            const title = typeof payload.title === 'string' ? payload.title : normalizedTopic;
            const summary = typeof payload.summary === 'string' ? payload.summary : '';
            const slug = typeof payload.slug === 'string' ? payload.slug : null;

            setStreamTitle(title);
            setStreamSummary(summary);
            setCompletedLessonSlug(slug);
            setStreamStatus('Lesson generated successfully.');
            streamCompleted = true;

            toast({
              title: 'Lesson generated!',
              description: `Your lesson "${title}" is ready.`,
            });

            continue;
          }

          if (parsedBlock.event === 'error') {
            const errorMessage = typeof payload.error === 'string'
              ? payload.error
              : 'Lesson stream failed.';
            throw new Error(errorMessage);
          }
        }
      }

      if (!streamCompleted) {
        throw new Error('Lesson stream ended before completion. Please try again.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate lesson stream.';
      setStreamError(message);
      setStreamStatus('Generation stopped due to an error.');
      toast({
        title: 'Generation failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0c1324] text-[#dce1fb]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 -top-20 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/60 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <span className="font-serif text-xl italic tracking-tight text-slate-100 sm:text-2xl">Celestial Editorial</span>
            <nav className="hidden items-center gap-6 md:flex">
              <Link to="/dashboard" className="text-sm font-medium tracking-wide text-slate-400 transition-colors hover:text-slate-200">
                Dashboard
              </Link>
              <Link to="/learn" className="border-b-2 border-indigo-400 pb-1 text-sm font-medium tracking-wide text-indigo-200">
                Library
              </Link>
              <Link to="/chat" className="text-sm font-medium tracking-wide text-slate-400 transition-colors hover:text-slate-200">
                Explore
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search archive..."
                className="w-64 rounded-full border-none bg-white/5 py-2 pl-10 pr-4 text-sm placeholder:text-slate-500 focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <button type="button" className="rounded-full p-2 text-slate-400 transition-all hover:bg-white/5">
              <Bell className="h-4 w-4" />
            </button>
            <button type="button" className="rounded-full p-2 text-slate-400 transition-all hover:bg-white/5">
              <WandSparkles className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 pb-24 pt-10 lg:grid-cols-12 lg:gap-12 lg:px-6">
        <section className="space-y-10 lg:col-span-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c0c1ff]/20 bg-[#c0c1ff]/10 px-4 py-1.5">
              <Sparkles className="h-4 w-4 text-[#c0c1ff]" />
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#c0c1ff]">Lesson Generator</span>
            </div>
            <h1 className="font-serif text-5xl font-light italic leading-tight text-[#dce1fb] lg:text-6xl">
              Generate a clear,
              <br />
              <span className="text-[#c0c1ff]">section-wise</span> lesson
            </h1>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[rgba(46,52,71,0.6)] p-6 shadow-[0_40px_60px_-15px_rgba(0,0,0,0.3)] backdrop-blur-[40px] lg:p-10">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#c0c1ff]/10 blur-[100px]" />

            <form
              className="relative z-10 space-y-10"
              onSubmit={(event) => {
                event.preventDefault();
                handleGenerateLesson();
              }}
            >
              <div className="space-y-4">
                <Label htmlFor="topic" className="text-sm font-medium tracking-wide text-[#c7c4d7]">
                  WHAT DO YOU WANT TO LEARN TODAY?
                </Label>
                <Textarea
                  id="topic"
                  value={topic}
                  rows={3}
                  disabled={isStreaming}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Describe your learning goal (e.g., The history of Renaissance architecture or the basics of quantum entanglement)..."
                  className="resize-none rounded-xl border-none bg-[#070d1f] p-6 text-lg text-[#dce1fb] placeholder:text-slate-600 focus:ring-2 focus:ring-[#c0c1ff]/20"
                />

                <div className="flex flex-wrap gap-2 pt-2">
                  {topicIdeas.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      disabled={isStreaming}
                      onClick={() => setTopic(idea)}
                      className="group flex items-center gap-2 rounded-full border border-white/5 bg-[#191f31] px-4 py-2 text-sm text-[#4edea3] transition-all hover:bg-[#23293c]"
                    >
                      <Lightbulb className="h-3.5 w-3.5" />
                      {idea}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <Label className="text-sm font-medium uppercase tracking-wide text-[#c7c4d7]">Select Depth of Knowledge</Label>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {(Object.keys(difficultyDetails) as Array<keyof typeof difficultyDetails>).map((level) => {
                    const option = difficultyDetails[level];
                    const Icon = option.icon;
                    const active = difficulty === level;

                    return (
                      <button
                        key={level}
                        type="button"
                        disabled={isStreaming}
                        onClick={() => setDifficulty(level)}
                        className={cn(
                          'rounded-xl border p-6 text-left transition-all',
                          active
                            ? 'border-[#c0c1ff]/35 bg-[#151b2d]'
                            : 'border-white/5 bg-[#070d1f] hover:bg-[#23293c]'
                        )}
                      >
                        <div
                          className={cn(
                            'mb-4 flex h-10 w-10 items-center justify-center rounded-full',
                            active ? 'bg-[#c0c1ff]/20 text-[#c0c1ff]' : 'bg-[#2e3447] text-[#c7c4d7]'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className={cn('font-bold', active ? 'text-[#dce1fb]' : 'text-slate-400')}>{option.label}</h3>
                        <p className="mt-2 text-xs leading-relaxed text-[#c7c4d7]">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-6 border-t border-white/5 pt-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-[#c7c4d7]">
                    <Clock3 className="h-4 w-4" />
                    <span className="text-xs font-medium">Est. 10-25s</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#c7c4d7]">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-xs font-medium">Sectioned Output</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isStreaming || !normalizedTopic}
                  className="rounded-full bg-[linear-gradient(135deg,#c0c1ff_0%,#8083ff_100%)] px-10 py-6 text-[#1000a9] shadow-lg shadow-[#c0c1ff]/20 hover:scale-[1.02] hover:opacity-95"
                >
                  {isStreaming ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Streaming lesson...
                    </>
                  ) : (
                    <>
                      Generate lesson
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            {(isStreaming || streamedSections.length > 0 || streamError || completedLessonSlug) && (
              <div className="relative z-10 mt-8 rounded-2xl border border-white/10 bg-[#0a1122]/85 p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c0c1ff]">Live Lesson Stream</p>
                    <p className="mt-1 text-sm text-[#c7c4d7]">{streamStatus || 'Waiting for the first section...'}</p>
                  </div>

                  {completedLessonSlug && (
                    <Button
                      type="button"
                      onClick={() => navigate(`/learn/${completedLessonSlug}`)}
                      className="rounded-full bg-[linear-gradient(135deg,#c0c1ff_0%,#8083ff_100%)] px-6 text-[#1000a9]"
                    >
                      Open Lesson
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>

                {streamTitle && (
                  <div className="mb-4 rounded-xl border border-white/10 bg-[#121a30] p-4">
                    <h3 className="font-serif text-xl italic text-[#dce1fb]">{streamTitle}</h3>
                    {streamSummary && <p className="mt-2 text-sm text-[#c7c4d7]">{streamSummary}</p>}
                  </div>
                )}

                <div className="space-y-4">
                  {streamedSections.map((section, index) => (
                    <div key={`${section.heading}-${index}`} className="rounded-xl border border-white/10 bg-[#11192e] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7bd0ff]">Chunk {index + 1}</p>
                      <h4 className="mt-1 text-base font-semibold text-[#dce1fb]">{section.heading}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-[#c7c4d7]">{section.body}</p>
                    </div>
                  ))}
                </div>

                {streamError && (
                  <div className="mt-4 rounded-xl border border-red-300/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                    {streamError}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6 lg:col-span-4">
          <div className="space-y-6 rounded-2xl border border-white/5 bg-[rgba(46,52,71,0.6)] p-8 backdrop-blur-[40px]">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-[#c0c1ff]" />
              <h2 className="font-serif text-2xl italic">What your lesson will include</h2>
            </div>

            <ul className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#4edea3]" />
                <div>
                  <p className="text-sm font-bold text-[#dce1fb]">Key Definitions</p>
                  <p className="text-xs leading-relaxed text-[#c7c4d7]">The foundational vocabulary required for mastery.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#4edea3]" />
                <div>
                  <p className="text-sm font-bold text-[#dce1fb]">Historical Context</p>
                  <p className="text-xs leading-relaxed text-[#c7c4d7]">Where the concept came from and why it matters now.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#4edea3]" />
                <div>
                  <p className="text-sm font-bold text-[#dce1fb]">Practical Exercise</p>
                  <p className="text-xs leading-relaxed text-[#c7c4d7]">Hands-on tasks to solidify your understanding.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#4edea3]" />
                <div>
                  <p className="text-sm font-bold text-[#dce1fb]">Knowledge Check</p>
                  <p className="text-xs leading-relaxed text-[#c7c4d7]">An interactive quiz to test your retention.</p>
                </div>
              </div>
            </ul>
          </div>

          <div className="space-y-6 rounded-2xl border border-white/5 bg-[#070d1f]/45 p-8 backdrop-blur-[40px]">
            <div className="flex items-center gap-3">
              <Lightbulb className="h-5 w-5 text-[#7bd0ff]" />
              <h2 className="font-serif text-2xl italic">Prompting tips</h2>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-[#c7c4d7]">
              <div className="rounded-lg border-l-2 border-[#7bd0ff] bg-[#151b2d] p-4">
                &quot;Be specific about your current knowledge level. For example: Explain dark matter as if I
                understand basic Newtonian physics but not relativity.&quot;
              </div>
              <div className="rounded-lg border-l-2 border-[#7bd0ff] bg-[#151b2d] p-4">
                &quot;Ask for specific real-world applications to make the theory more tangible.&quot;
              </div>
            </div>
          </div>

          <div className="group relative h-48 overflow-hidden rounded-2xl">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1Mn054SxCFwhGnzFIZbrrrSQs0s6xTIxPMmXFbzW2ZfscKs8fQT-Iro_GlXzAoLfFh02BTFSyPAaJS01QDHp-8YfR9GL8wELGXlvTFK9RpCkv_tJQPmGaZhgC30ZkpK7zDB-_UTiPBC2twIium0gQW2ic9MsR0P4Srhk8R93QsT-ubVxTOU0VWOBfkg75ljSrv1NumarXdQKQdyDvXu8S5eBRr2wPEJ3yUmHILuAKOVHbOkFAeHlnWJjUfAbMEll_uCFUKOArCxJV"
              alt="Learning environment"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent" />
            <div className="absolute bottom-4 left-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c0c1ff]">Wisdom Archive</p>
              <p className="font-serif text-sm italic text-[#dce1fb]">Deepen your focus.</p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
