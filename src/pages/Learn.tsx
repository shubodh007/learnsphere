import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Clock3,
  Layers3,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLessonsQuery } from '@/hooks/use-queries';

const difficultyStyles = {
  beginner: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200',
  intermediate: 'border-amber-300/30 bg-amber-400/10 text-amber-200',
  advanced: 'border-rose-300/30 bg-rose-400/10 text-rose-200',
} as const;

const difficultyLabels = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
} as const;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatGenerationTime(milliseconds: number | null) {
  if (!milliseconds) return 'Freshly generated';
  const seconds = Math.max(1, Math.round(milliseconds / 1000));
  return `Gen: ${seconds}s`;
}

function getSectionCount(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return 0;
  const candidate = metadata as { sections?: unknown };
  return Array.isArray(candidate.sections) ? candidate.sections.length : 0;
}

export default function Learn() {
  const { user } = useAuth();
  const { data: lessons = [], isLoading, error } = useLessonsQuery(user?.id);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLessons = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return lessons;

    return lessons.filter((lesson) => {
      const haystack = [
        lesson.topic,
        lesson.summary || '',
        lesson.difficulty_level,
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [lessons, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-[#0c1324]">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-300" />
      </div>
    );
  }

  const isSearchEmpty = lessons.length > 0 && filteredLessons.length === 0;
  const hasLessons = lessons.length > 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0c1324] px-4 pb-24 pt-8 text-slate-100 md:px-7 md:pb-12 md:pt-10 lg:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-20 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/55 p-4 backdrop-blur-2xl md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <p className="font-serif text-xl italic tracking-tight text-slate-100 md:text-2xl">Celestial Editorial</p>
              <span className="rounded-full border border-indigo-300/35 bg-indigo-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-200">
                Library
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              <div className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-slate-900/85 px-4 text-slate-300">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search library..."
                  className="w-40 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none md:w-56"
                />
              </div>

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-indigo-300/20 bg-indigo-500/10 text-indigo-200 transition hover:bg-indigo-500/20"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-500/10 text-cyan-200 transition hover:bg-cyan-500/20"
                aria-label="AI suggestions"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <header className="flex flex-col gap-6 rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_40px_80px_-40px_rgba(15,23,42,0.9)] backdrop-blur-xl md:flex-row md:items-end md:justify-between md:p-10">
          <div className="max-w-3xl space-y-4">
            <h1 className="font-serif text-5xl font-light italic leading-[0.95] text-slate-100 md:text-7xl">
              Lessons
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              Dive back into your personalized learning journeys. Each manuscript is architected by AI
              to match your cognitive profile and evolving curiosity.
            </p>
          </div>

          <Link to="/learn/new" className="self-start md:self-auto">
            <Button className="h-12 rounded-2xl border border-indigo-200/30 bg-gradient-to-br from-indigo-300 to-indigo-500 px-7 text-sm font-semibold tracking-wide text-slate-950 transition hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(129,140,248,0.35)]">
              <Plus className="mr-2 h-4 w-4" />
              Create Lesson
            </Button>
          </Link>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-300/30 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
            We hit a problem loading lessons. Showing any cached results while we reconnect.
          </div>
        )}

        {!hasLessons ? (
          <div className="rounded-[1.8rem] border border-dashed border-white/20 bg-white/[0.03] px-6 py-14 text-center backdrop-blur-xl md:px-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-indigo-200/30 bg-indigo-500/12">
              <BookOpen className="h-7 w-7 text-indigo-200" />
            </div>
            <h2 className="font-serif text-3xl italic text-slate-100">Expand Your Horizons</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-300 md:text-base">
              The archives are endless. Generate a new manuscript tailored to your current interests
              and bridge the gap between curiosity and mastery.
            </p>
            <Link to="/learn/new" className="mt-8 inline-flex">
              <Button className="h-11 rounded-full border border-white/15 bg-slate-900/60 px-8 text-indigo-200 hover:bg-slate-800/70">
                Generate Your First Lesson
              </Button>
            </Link>
          </div>
        ) : isSearchEmpty ? (
          <div className="rounded-[1.5rem] border border-white/15 bg-white/[0.03] px-6 py-12 text-center backdrop-blur-xl">
            <p className="text-lg text-slate-100">No lessons found for “{searchQuery.trim()}”.</p>
            <p className="mt-2 text-sm text-slate-400">Try a broader phrase or clear the search to view all manuscripts.</p>
            <Button
              variant="ghost"
              onClick={() => setSearchQuery('')}
              className="mt-6 rounded-full border border-white/15 bg-slate-900/70 px-6 text-slate-200 hover:bg-slate-800/70"
            >
              Clear search
            </Button>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredLessons.map((lesson, index) => {
              const sectionCount = getSectionCount(lesson.metadata);
              const readTime = Math.max(1, lesson.estimated_read_time_minutes || 1);

            return (
              <Link
                key={lesson.id}
                to={`/learn/${lesson.slug}`}
                className="group animate-fade-in-up"
                style={{ animationDelay: `${Math.min(index * 90, 540)}ms` }}
              >
                <article className="relative flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300/40 hover:bg-white/[0.06] hover:shadow-[0_20px_45px_-20px_rgba(129,140,248,0.45)]">
                  <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 translate-x-1/3 -translate-y-1/3 rounded-full bg-indigo-400/15 blur-3xl transition-colors group-hover:bg-indigo-300/20" />

                  <div className="mb-5 flex items-start justify-between gap-4">
                    <span className={cn(
                      'inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]',
                      difficultyStyles[lesson.difficulty_level]
                    )}>
                      {difficultyLabels[lesson.difficulty_level]}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(lesson.created_at)}</span>
                  </div>

                  <h3 className="font-serif text-2xl leading-tight text-slate-100 transition-colors group-hover:text-indigo-200">
                    {lesson.topic}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-slate-300/90 line-clamp-3">
                    {lesson.summary || 'Open this lesson to explore key ideas, examples, and guided practice prompts.'}
                  </p>

                  <div className="mt-auto pt-7">
                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-300/85">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5 text-indigo-200" />
                        <span>{readTime} min read</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Layers3 className="h-3.5 w-3.5 text-cyan-200" />
                        <span>{sectionCount} Sections</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-emerald-200" />
                        <span>{formatGenerationTime(lesson.generation_time_ms)}</span>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-sm font-semibold text-indigo-200">
                      <span>Open Lesson</span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
          </section>
        )}
      </div>
    </div>
  );
}
