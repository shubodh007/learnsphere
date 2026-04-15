import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Brain,
  CheckCircle2,
  FlaskConical,
  HelpCircle,
  Loader2,
  Settings,
  Sparkles,
} from 'lucide-react';
import { EmptyState, emptyStateConfig } from '@/components/EmptyState';
import { LessonQuizPanel } from '@/components/lesson/LessonQuizPanel';
import { useLessonQuery } from '@/hooks/use-queries';
import type { Lesson, LessonSection } from '@/lib/types';
import { cn } from '@/lib/utils';

type QuizSection = LessonSection & { id: string };

const SIDEBAR_ICONS = [BookOpen, Brain, FlaskConical] as const;

function sanitizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function titleFromHeading(heading: string) {
  const match = heading.match(/^\d+[.)]?\s+(.+)$/);
  return match ? match[1] : heading;
}

function parseSectionsFromContent(content: string): QuizSection[] {
  if (!content.trim()) return [];

  const sectionRegex = /^##\s+(.+)$/gm;
  const sections: QuizSection[] = [];
  const matches = Array.from(content.matchAll(sectionRegex));

  if (matches.length === 0) {
    return [
      {
        id: 'section-1',
        heading: '1. Lesson Overview',
        body: content.trim(),
        bullets: [],
      },
    ];
  }

  matches.forEach((match, index) => {
    const heading = match[1].trim();
    const start = match.index ?? 0;
    const nextStart = matches[index + 1]?.index ?? content.length;
    const bodyWithHeading = content.slice(start, nextStart).trim();
    const body = bodyWithHeading.replace(/^##\s+.+\n?/, '').trim();

    sections.push({
      id: `section-${index + 1}`,
      heading: heading || `${index + 1}. Section ${index + 1}`,
      body,
      bullets: [],
    });
  });

  return sections;
}

function resolveQuizSections(lesson: Lesson): QuizSection[] {
  const metadata = lesson.metadata && typeof lesson.metadata === 'object'
    ? (lesson.metadata as { sections?: unknown })
    : null;

  const structuredSections = Array.isArray(metadata?.sections)
    ? metadata.sections
        .map((item, index) => {
          if (!item || typeof item !== 'object') return null;
          const section = item as LessonSection;
          const heading = sanitizeText(section.heading) || `${index + 1}. Section ${index + 1}`;
          const body = sanitizeText(section.body);
          const bullets = Array.isArray(section.bullets)
            ? section.bullets.filter((bullet): bullet is LessonSection['bullets'][number] => {
                return typeof bullet?.label === 'string' && typeof bullet?.detail === 'string';
              })
            : [];

          return {
            id: `section-${index + 1}`,
            heading,
            body,
            bullets,
            code: section.code?.src ? section.code : undefined,
            deep_dive: sanitizeText(section.deep_dive) || undefined,
            common_mistakes: Array.isArray(section.common_mistakes)
              ? section.common_mistakes.filter((mistake): mistake is LessonSection['common_mistakes'][number] => {
                  return typeof mistake?.mistake === 'string' && typeof mistake?.fix === 'string';
                })
              : undefined,
          };
        })
        .filter((section) => section !== null) as QuizSection[]
    : [];

  if (structuredSections.length > 0) {
    return structuredSections;
  }

  return parseSectionsFromContent(lesson.content || '');
}

function formatModuleIndex(totalSections: number) {
  return String(Math.max(1, totalSections)).padStart(2, '0');
}

export default function LessonQuiz() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: lesson, isLoading, error } = useLessonQuery(slug);

  const sections = useMemo(() => (lesson ? resolveQuizSections(lesson) : []), [lesson]);
  const displayedSections = sections.slice(0, 3);

  if (isLoading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <EmptyState
          {...emptyStateConfig.lessons}
          title="Lesson quiz not found"
          description="This lesson or its quiz context is unavailable."
          action={
            <Link to="/learn">
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Browse lessons</button>
            </Link>
          }
        />
      </div>
    );
  }

  const questionCount = lesson.quiz_questions?.length || 6;
  const moduleIndex = formatModuleIndex(sections.length);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0c1324] text-[#dce1fb] selection:bg-indigo-300/30">
      <header className="fixed top-0 z-50 flex w-full items-center justify-between bg-slate-950/60 px-4 py-3 shadow-2xl shadow-indigo-950/20 backdrop-blur-xl sm:px-6 sm:py-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4 md:gap-6">
          <span className="max-w-[12rem] truncate text-base font-serif italic tracking-tight text-slate-100 sm:max-w-none sm:text-xl md:text-2xl">Celestial Editorial</span>
          <nav className="hidden gap-8 md:flex">
            <Link to="/dashboard" className="text-sm font-medium tracking-wide text-slate-400 transition-colors hover:text-slate-200">Dashboard</Link>
            <Link to="/learn" className="text-sm font-medium tracking-wide text-slate-400 transition-colors hover:text-slate-200">Library</Link>
            <span className="border-b-2 border-indigo-400 pb-1 text-sm font-medium tracking-wide text-indigo-200">Final Quiz</span>
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4">
          <button type="button" className="inline-flex rounded-full p-1.5 text-indigo-300 transition-all duration-300 hover:bg-white/5 sm:p-2" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </button>
          <button type="button" className="hidden rounded-full p-1.5 text-indigo-300 transition-all duration-300 hover:bg-white/5 sm:inline-flex sm:p-2" aria-label="Magic actions">
            <Sparkles className="h-5 w-5" />
          </button>
          <div className="h-8 w-8 overflow-hidden rounded-full border border-white/10 bg-[#23293c] sm:h-10 sm:w-10" />
        </div>
      </header>

      <div className="flex min-h-screen pt-[4.5rem] sm:pt-20">
        <aside className="fixed left-0 hidden h-[calc(100vh-5rem)] w-72 flex-col border-r border-white/5 bg-slate-900/40 py-8 backdrop-blur-2xl md:flex">
          <div className="mb-8 px-6">
            <button
              type="button"
              onClick={() => navigate(`/learn/${lesson.slug}`)}
              className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#c0c1ff] transition-all hover:-translate-x-1 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Lesson
            </button>
            <h2 className="text-lg font-serif text-slate-200">Lesson Progress</h2>
            <p className="mt-1 text-xs font-medium tracking-wide text-indigo-400">Final Assessment</p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[#070d1f]">
              <div className="h-full w-full bg-gradient-to-r from-[#c0c1ff] to-[#8083ff]" />
            </div>
          </div>

          <nav className="flex flex-1 flex-col">
            {displayedSections.map((section, index) => {
              const Icon = SIDEBAR_ICONS[Math.min(index, SIDEBAR_ICONS.length - 1)];

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => navigate(`/learn/${lesson.slug}#${section.id}`)}
                  className="flex items-center gap-3 py-3 pl-6 text-left text-sm font-medium tracking-wide text-slate-500 transition-colors hover:text-slate-300"
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{titleFromHeading(section.heading)}</span>
                </button>
              );
            })}

            <div className="mr-3 mt-2 flex items-center gap-3 rounded-r-full border-l-4 border-indigo-400 bg-indigo-500/10 py-3 pl-6 text-sm font-medium tracking-wide text-indigo-300">
              <CheckCircle2 className="h-4 w-4" />
              <span>Final Quiz</span>
            </div>
          </nav>

          <div className="mt-auto px-6">
            <button
              type="button"
              onClick={() => navigate(`/learn/${lesson.slug}`)}
              className="w-full rounded-lg bg-gradient-to-r from-[#c0c1ff] to-[#8083ff] py-3 font-bold text-[#1000a9] shadow-lg shadow-indigo-500/20 transition-transform hover:scale-[1.02] active:scale-95"
            >
              Review Notes
            </button>

            <div className="mt-6 flex gap-4 border-t border-white/5 pt-6">
              <button type="button" className="text-slate-500 transition-colors hover:text-slate-300" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </button>
              <button type="button" className="text-slate-500 transition-colors hover:text-slate-300" aria-label="Settings">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </aside>

        <main className="flex flex-1 flex-col items-center justify-start px-4 pb-28 pt-4 sm:px-6 sm:pt-6 md:ml-72 md:justify-center md:px-10 md:pb-10 md:pt-8 lg:px-12">
          <div className="w-full max-w-5xl space-y-5 sm:space-y-7 md:space-y-8">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-[#7bd0ff] sm:text-xs">Module {moduleIndex} / Final Assessment</span>
                  <h1 className="mt-2 break-words text-3xl font-bold italic leading-tight text-[#dce1fb] sm:text-4xl md:text-5xl">{lesson.topic}</h1>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xs font-semibold tracking-wider text-[#dce1fb] sm:text-sm">QUESTION 01 <span className="text-[#908fa0]">/ {questionCount.toString().padStart(2, '0')}</span></span>
                </div>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#070d1f]">
                <div className="h-full w-1/6 rounded-full bg-gradient-to-r from-[#c0c1ff] to-[#8083ff] shadow-[0_0_15px_rgba(192,193,255,0.4)] transition-all duration-700" />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-[#171d2f]/60 p-1.5 shadow-2xl backdrop-blur-2xl sm:p-2 md:p-4">
              <LessonQuizPanel
                lesson={lesson}
                sections={sections}
                active
                onBackToLesson={() => navigate(`/learn/${lesson.slug}`)}
              />
            </div>
          </div>
        </main>
      </div>

      <nav className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-1rem)] max-w-sm -translate-x-1/2 justify-between gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl sm:bottom-6 sm:w-[calc(100%-2rem)] sm:px-5 sm:py-3 md:hidden">
        <button type="button" onClick={() => navigate(`/learn/${lesson.slug}`)} className="flex flex-1 flex-col items-center text-slate-500 transition-all hover:text-slate-200">
          <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="mt-1 text-[9px] uppercase tracking-widest sm:text-[10px]">Lesson</span>
        </button>
        <button type="button" onClick={() => navigate(`/learn/${lesson.slug}/quiz`)} className={cn('flex flex-1 flex-col items-center text-indigo-300 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]')}>
          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="mt-1 text-[9px] uppercase tracking-widest sm:text-[10px]">Practice</span>
        </button>
        <button type="button" onClick={() => navigate('/chat')} className="flex flex-1 flex-col items-center text-slate-500 transition-all hover:text-slate-200">
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="mt-1 text-[9px] uppercase tracking-widest sm:text-[10px]">Discuss</span>
        </button>
      </nav>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-1/4 -top-1/4 h-[800px] w-[800px] rounded-full bg-indigo-400/10 blur-[120px]" />
        <div className="absolute -bottom-1/4 -left-1/4 h-[600px] w-[600px] rounded-full bg-sky-400/10 blur-[100px]" />
      </div>
    </div>
  );
}
