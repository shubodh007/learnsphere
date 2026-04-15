import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Eye,
  FlaskConical,
  HelpCircle,
  Loader2,
  Microscope,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Sparkles,
  Square,
  Volume2,
  WandSparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, emptyStateConfig } from '@/components/EmptyState';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { LessonQuizPanel } from '@/components/lesson/LessonQuizPanel';
import { useAuth } from '@/hooks/use-auth';
import { useIncrementLessonViewMutation, useLessonQuery } from '@/hooks/use-queries';
import type {
  Lesson,
  LessonBullet,
  LessonCodeBlock,
  LessonCommonMistake,
  LessonSection as StructuredLessonSection,
} from '@/lib/types';
import { cn } from '@/lib/utils';

type ViewerTab = 'lesson' | 'summary' | 'practice';
type ResolvedSection = StructuredLessonSection & { id: string };

const SIDEBAR_ICONS = [BookOpen, Brain, Microscope, FlaskConical, CircleHelp];
const RATE_OPTIONS = [1, 1.25, 1.5] as const;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function sanitizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function titleFromHeading(heading: string) {
  const match = heading.match(/^\d+[.)]?\s+(.+)$/);
  return match ? match[1] : heading;
}

function parseLessonContent(content: string): ResolvedSection[] {
  const lines = content.split('\n');
  const sections: ResolvedSection[] = [];

  let currentHeading = '';
  let bodyLines: string[] = [];
  let bullets: LessonBullet[] = [];
  let deepDiveLines: string[] = [];
  let mistakes: LessonCommonMistake[] = [];
  let inCommonMistakes = false;

  let inCode = false;
  let codeLanguage = 'text';
  let codeLines: string[] = [];
  let pendingCaption = '';
  let code: LessonCodeBlock | undefined;

  const flush = () => {
    if (!currentHeading) return;

    sections.push({
      id: `section-${sections.length + 1}`,
      heading: currentHeading,
      body: bodyLines.join('\n').trim(),
      bullets,
      deep_dive: deepDiveLines.join(' ').trim() || undefined,
      common_mistakes: mistakes.length > 0 ? mistakes : undefined,
      code,
    });

    bodyLines = [];
    bullets = [];
    deepDiveLines = [];
    mistakes = [];
    inCommonMistakes = false;
    code = undefined;
    codeLanguage = 'text';
    codeLines = [];
    pendingCaption = '';
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        code = {
          language: codeLanguage || 'text',
          caption: pendingCaption || undefined,
          src: codeLines.join('\n').trim(),
        };
      } else {
        codeLanguage = line.slice(3).trim() || 'text';
        codeLines = [];
      }
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (/^##\s+/.test(line)) {
      flush();
      currentHeading = line.replace(/^##\s+/, '').trim();
      continue;
    }

    if (/^\*.+\*$/.test(line.trim())) {
      pendingCaption = line.replace(/^\*/, '').replace(/\*$/, '').trim();
      continue;
    }

    if (/^###\s+Common Mistakes/i.test(line)) {
      inCommonMistakes = true;
      continue;
    }

    if (line.startsWith('>')) {
      const cleaned = line.replace(/^>\s*/, '').replace(/^\*\*Deep Dive\*\*\s*/, '').trim();
      if (cleaned) deepDiveLines.push(cleaned);
      continue;
    }

    const bulletMatch = line.match(/^-\s+\*\*(.+?)\*\*:\s*(.+)$/);
    if (bulletMatch) {
      bullets.push({
        label: bulletMatch[1].trim(),
        detail: bulletMatch[2].trim(),
      });
      continue;
    }

    if (inCommonMistakes && line.startsWith('- **')) {
      const cleaned = line.replace(/^-\s*/, '').trim();
      const [mistake, fix] = cleaned.split('->');
      if (mistake && fix) {
        mistakes.push({
          mistake: mistake.replace(/\*\*/g, '').trim(),
          fix: fix.trim(),
        });
      }
      continue;
    }

    if (currentHeading && line.trim()) {
      bodyLines.push(line);
    }
  }

  flush();
  return sections.filter((section) => section.heading || section.body);
}

function resolveLessonSections(lesson: Lesson): ResolvedSection[] {
  const metadata = lesson.metadata && typeof lesson.metadata === 'object'
    ? (lesson.metadata as { sections?: unknown })
    : null;

  const structuredSections = Array.isArray(metadata?.sections)
    ? (metadata.sections as StructuredLessonSection[])
        .map((section, index) => {
          const heading = sanitizeText(section.heading) || `${index + 1}. Section ${index + 1}`;
          const body = sanitizeText(section.body);
          const bullets = Array.isArray(section.bullets)
            ? section.bullets.filter((item): item is LessonBullet =>
                typeof item?.label === 'string' && typeof item?.detail === 'string'
              )
            : [];

          return {
            id: `section-${index + 1}`,
            heading,
            body,
            bullets,
            code: section.code?.src ? section.code : undefined,
            deep_dive: sanitizeText(section.deep_dive) || undefined,
            common_mistakes: Array.isArray(section.common_mistakes)
              ? section.common_mistakes.filter((item): item is LessonCommonMistake =>
                  typeof item?.mistake === 'string' && typeof item?.fix === 'string'
                )
              : undefined,
          };
        })
        .filter((section) => section.heading || section.body)
    : [];

  if (structuredSections.length > 0) {
    return structuredSections;
  }

  return parseLessonContent(lesson.content || '');
}

function buildNarrationText(section: ResolvedSection) {
  return [
    section.heading,
    section.body,
    ...section.bullets.map((item) => `${item.label}. ${item.detail}`),
    section.deep_dive ? `Deep dive. ${section.deep_dive}` : '',
    ...(section.common_mistakes || []).map((item) => `${item.mistake}. Fix: ${item.fix}`),
  ]
    .filter(Boolean)
    .join(' ');
}

function useReadingProgress(containerRef: React.RefObject<HTMLElement>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const element = containerRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const start = window.scrollY + rect.top - viewportHeight * 0.2;
      const total = Math.max(element.scrollHeight - viewportHeight * 0.6, 1);
      const current = window.scrollY - start;
      setProgress(Math.max(0, Math.min(1, current / total)));
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [containerRef]);

  return progress;
}

function useSectionNarration(sections: ResolvedSection[]) {
  const [isSupported, setIsSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [rate, setRate] = useState<number>(1.25);

  const speakSection = useCallback((sectionId: string, forceRate?: number) => {
    if (!('speechSynthesis' in window)) return;

    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(buildNarrationText(section));
    utterance.rate = forceRate ?? rate;
    utterance.pitch = 1;

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    setCurrentSectionId(section.id);
    setIsPlaying(true);
    setIsPaused(false);

    window.speechSynthesis.speak(utterance);
  }, [rate, sections]);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    if (!isSupported) return;

    if (currentSectionId === sectionId && isPlaying && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      return;
    }

    if (currentSectionId === sectionId && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    speakSection(sectionId);
  }, [currentSectionId, isPaused, isPlaying, isSupported, speakSection]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSectionId(null);
  }, [isSupported]);

  const replay = useCallback(() => {
    if (!currentSectionId) return;
    speakSection(currentSectionId);
  }, [currentSectionId, speakSection]);

  const next = useCallback(() => {
    if (!sections.length) return;

    if (!currentSectionId) {
      speakSection(sections[0].id);
      return;
    }

    const currentIndex = sections.findIndex((section) => section.id === currentSectionId);
    const nextSection = sections[currentIndex + 1];
    if (nextSection) {
      speakSection(nextSection.id);
    }
  }, [currentSectionId, sections, speakSection]);

  const updateRate = useCallback((nextRate: number) => {
    setRate(nextRate);

    if (currentSectionId && (isPlaying || isPaused)) {
      speakSection(currentSectionId, nextRate);
    }
  }, [currentSectionId, isPaused, isPlaying, speakSection]);

  return {
    isSupported,
    isPlaying,
    isPaused,
    currentSectionId,
    rate,
    toggleSection,
    stop,
    replay,
    next,
    updateRate,
  };
}

export default function LessonViewer() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { data: lesson, isLoading, error } = useLessonQuery(slug);
  const incrementViewMutation = useIncrementLessonViewMutation();

  const [activeTab, setActiveTab] = useState<ViewerTab>('lesson');
  const [completedBySection, setCompletedBySection] = useState<Record<string, boolean>>({});
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const incrementedRef = useRef(false);

  const sections = useMemo(() => (lesson ? resolveLessonSections(lesson) : []), [lesson]);
  const narration = useSectionNarration(sections);

  const readingProgress = useReadingProgress(contentRef);
  const completedCount = useMemo(
    () => sections.filter((section) => completedBySection[section.id]).length,
    [completedBySection, sections]
  );

  const manualProgress = sections.length > 0 ? completedCount / sections.length : 0;
  const progress = Math.max(readingProgress, manualProgress);
  const progressPercent = Math.round(progress * 100);

  const activeSectionIndex = useMemo(() => {
    if (!sections.length) return 0;
    const index = sections.findIndex((section) => section.id === activeSectionId);
    return index >= 0 ? index : 0;
  }, [activeSectionId, sections]);

  const previousSection = sections[activeSectionIndex - 1];
  const nextSection = sections[activeSectionIndex + 1];

  const currentNarrationSection = sections.find((section) => section.id === narration.currentSectionId) || null;

  const scrollToSection = useCallback((sectionId: string) => {
    const target = sectionRefs.current[sectionId];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const toggleCompletion = useCallback((sectionId: string) => {
    setCompletedBySection((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }, []);

  useEffect(() => {
    setCompletedBySection({});
    setActiveSectionId(null);
    incrementedRef.current = false;
  }, [lesson?.id]);

  useEffect(() => {
    if (!lesson || !user || incrementedRef.current) return;
    incrementedRef.current = true;
    incrementViewMutation.mutate({ lessonId: lesson.id });
  }, [incrementViewMutation, lesson, user]);

  useEffect(() => {
    if (!sections.length || activeTab !== 'lesson') return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestId: string | null = null;
        let bestRatio = 0;

        for (const entry of entries) {
          const id = entry.target.getAttribute('data-section-id');
          if (!id || !entry.isIntersecting) continue;

          if (entry.intersectionRatio >= bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestId = id;
          }
        }

        if (bestId) {
          setActiveSectionId(bestId);
        }
      },
      {
        threshold: [0.35, 0.55, 0.75],
        rootMargin: '-10% 0px -50% 0px',
      }
    );

    for (const section of sections) {
      const element = sectionRefs.current[section.id];
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, [activeTab, sections]);

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
          title="Lesson not found"
          description="This lesson does not exist or is no longer available."
          action={
            <Link to="/learn">
              <Button>Browse lessons</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0c1324] text-[#dce1fb]">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-slate-950/60 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <div className="font-serif text-2xl italic tracking-tight text-slate-100">Celestial Editorial</div>
          <nav className="hidden items-center gap-6 md:flex">
            <Link to="/dashboard" className="border-b-2 border-indigo-400 pb-1 font-serif italic text-indigo-200">Dashboard</Link>
            <Link to="/learn" className="font-serif italic text-slate-400 transition-colors hover:text-slate-200">Library</Link>
            <Link to="/chat" className="font-serif italic text-slate-400 transition-colors hover:text-slate-200">Explore</Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button type="button" className="rounded-full p-2 text-indigo-300 transition-all duration-300 hover:bg-white/5">
            <WandSparkles className="h-5 w-5" />
          </button>
          <button type="button" className="relative rounded-full p-2 text-indigo-300 transition-all duration-300 hover:bg-white/5">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#c0c1ff]" />
          </button>
          <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAk_Itt7WO63Urx0V6QvUxOX0mOXWVzHzITwEALyzszZFGJHugB9HU6MpOmAdM0OuYgkp99hx4Af-0WZh_AqfbweO8zZ9uVeKc1ZArxV8nKOiSzcGHCuthpqXdn9LXTsa28LQefZk2TY2VEql6tPvjizSus_188WdOt-uUqG1ZCnpv-1I8QSejQOmxxt3AjdOQFeLjspFwzmXK1WVLonBw0-EPtE0rBFppC0ovuJ3ssHt7bccztYaM4NPIYhB4JNYWT93Xf2Cz67SDz"
              alt="Profile"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </header>

      <div className="sticky top-[72px] z-30 h-1 w-full bg-[#070d1f]">
        <div
          className="h-full bg-gradient-to-r from-[#c0c1ff] to-[#7bd0ff] transition-all duration-500"
          style={{ width: `${Math.max(8, progressPercent)}%` }}
        />
      </div>

      <div className="mx-auto flex max-w-[1600px] pb-32">
        <aside className="hidden w-72 shrink-0 border-r border-white/5 bg-slate-900/40 px-6 py-8 backdrop-blur-2xl lg:flex lg:flex-col lg:sticky lg:top-[76px] lg:h-[calc(100vh-76px)]">
          <div className="mb-8 mt-6">
            <Link
              to="/learn"
              className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#c0c1ff] transition-all hover:-translate-x-1 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Lessons
            </Link>
            <h2 className="font-serif text-lg text-slate-200">Lesson Progress</h2>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-indigo-400">{progressPercent}% Complete</p>
          </div>

          <nav className="flex-1 space-y-2">
            {sections.map((section, index) => {
              const iconIndex = Math.min(index, SIDEBAR_ICONS.length - 1);
              const Icon = SIDEBAR_ICONS[iconIndex];
              const isActive = activeSectionId === section.id || (index === 0 && !activeSectionId);
              const isComplete = Boolean(completedBySection[section.id]);

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-r-full py-3 pl-6 pr-2 text-left transition-colors',
                    isActive
                      ? 'border-l-4 border-indigo-400 bg-indigo-500/10 text-indigo-300'
                      : 'border-l-4 border-transparent text-slate-500 hover:text-slate-300'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate text-sm font-medium tracking-wide">{titleFromHeading(section.heading)}</span>
                  <div className="ml-auto flex items-center gap-1 pr-1">
                    <button
                      type="button"
                      aria-label={isComplete ? `Mark ${titleFromHeading(section.heading)} as incomplete` : `Mark ${titleFromHeading(section.heading)} as complete`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleCompletion(section.id);
                      }}
                      className="rounded-full p-0.5"
                    >
                      <CheckCircle2 className={cn('h-4 w-4', isComplete ? 'text-[#4edea3]' : 'text-slate-500')} />
                    </button>
                    {!isComplete && <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                  </div>
                </button>
              );
            })}

            <Link
              to={`/learn/${lesson.slug}/quiz`}
              className="group flex w-full items-center gap-3 rounded-r-full border-l-4 border-indigo-400 bg-indigo-500/10 py-3 pl-6 pr-2 text-left text-indigo-300 transition-colors hover:bg-indigo-500/15"
            >
              <CircleHelp className="h-5 w-5" />
              <span className="truncate text-sm font-medium tracking-wide">Final Quiz</span>
              <ChevronRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </nav>

          <div className="mt-auto space-y-4 border-t border-white/5 pt-8">
            <button className="w-full rounded-full border border-indigo-300/30 bg-gradient-to-r from-indigo-400/20 to-sky-400/20 px-6 py-3 text-sm font-medium text-[#c0c1ff] transition-transform hover:scale-105">
              Review Notes
            </button>
            <div className="flex justify-around text-slate-500">
              <button className="flex flex-col items-center gap-1 transition-colors hover:text-slate-300">
                <HelpCircle className="h-5 w-5" />
                <span className="text-[10px] uppercase">Help</span>
              </button>
              <button className="flex flex-col items-center gap-1 transition-colors hover:text-slate-300">
                <Settings className="h-5 w-5" />
                <span className="text-[10px] uppercase">Settings</span>
              </button>
            </div>
          </div>
        </aside>

        <main ref={contentRef} className="mx-auto w-full max-w-5xl flex-1 px-6 pt-8 md:px-12">
          <section className="mb-16 mt-8">
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <span className="rounded-full bg-[#4edea3]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#4edea3]">
                {progressPercent >= 100 ? 'Completed' : 'In Progress'}
              </span>
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" /> {lesson.view_count || 0} views</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {formatDate(lesson.created_at)}</span>
                <span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" /> {Math.max(1, lesson.estimated_read_time_minutes || 1)} min read</span>
              </div>
            </div>

            <h1 className="mb-8 font-serif text-5xl italic leading-tight text-[#dce1fb] md:text-7xl">{lesson.topic}</h1>

            <div className="mb-12 inline-flex rounded-full border border-white/5 bg-[#070d1f] p-1">
              {(['lesson', 'summary', 'practice'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'rounded-full px-8 py-2 text-sm font-bold transition-all',
                    activeTab === tab
                      ? 'bg-[#23293c] text-[#c0c1ff]'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </section>

          {activeTab === 'lesson' && (
            <div className="space-y-24" id="lesson-view">
              {sections.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-[#151b2d] p-8">
                  <MarkdownRenderer content={lesson.content} />
                </div>
              ) : (
                sections.map((section, index) => {
                  const paragraphs = section.body
                    .split(/\n{2,}/)
                    .map((line) => line.trim())
                    .filter(Boolean);
                  const leadParagraph = paragraphs[0] || '';
                  const extraParagraphs = paragraphs.slice(1);
                  const isNarratingThis = narration.currentSectionId === section.id && narration.isPlaying && !narration.isPaused;
                  const isPausedThis = narration.currentSectionId === section.id && narration.isPaused;

                  return (
                    <article
                      key={section.id}
                      id={section.id}
                      ref={(node) => {
                        sectionRefs.current[section.id] = node;
                      }}
                      data-section-id={section.id}
                      className="group relative scroll-mt-28"
                    >
                      <div className="absolute -left-12 top-0 h-full w-[2px] bg-gradient-to-b from-indigo-400/40 to-transparent" />

                      <div className="mb-6 flex items-start justify-between gap-4">
                        <h2 className="font-serif text-3xl italic text-indigo-100">
                          {section.heading || `${String(index + 1).padStart(2, '0')}. Section`}
                        </h2>
                        {narration.isSupported && (
                          <button
                            type="button"
                            onClick={() => narration.toggleSection(section.id)}
                            className="flex items-center gap-2 text-[#c0c1ff] transition-colors hover:text-white"
                          >
                            {isNarratingThis ? <Pause className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                            <span className="text-xs font-bold uppercase tracking-widest">
                              {isPausedThis ? 'Resume' : isNarratingThis ? 'Pause' : 'Listen'}
                            </span>
                          </button>
                        )}
                      </div>

                      <div className="rounded-xl border border-white/5 bg-[#151b2d] p-8 shadow-xl transition-all duration-500 hover:shadow-indigo-950/10 md:p-12">
                        {leadParagraph && (
                          <p className="mb-8 border-l-4 border-indigo-400/30 pl-8 text-xl italic leading-relaxed text-[#dce1fb]/90">
                            {leadParagraph}
                          </p>
                        )}

                        <div className="space-y-6">
                          {extraParagraphs.map((paragraph, paragraphIndex) => (
                            <p key={`${section.id}-paragraph-${paragraphIndex}`} className="leading-relaxed text-slate-300">
                              {paragraph}
                            </p>
                          ))}

                          {section.bullets.length > 0 && (
                            <ul className="space-y-4">
                              {section.bullets.map((bullet) => (
                                <li key={`${section.id}-${bullet.label}`} className="flex items-start gap-3">
                                  <CheckCircle2 className="mt-1 h-4 w-4 text-[#4edea3]" />
                                  <span className="text-slate-300">
                                    <strong className="text-[#dce1fb]">{bullet.label}:</strong> {bullet.detail}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {(section.deep_dive || (section.common_mistakes && section.common_mistakes.length > 0)) && (
                            <div className="my-10 grid gap-8 md:grid-cols-2">
                              {section.deep_dive && (
                                <div className="rounded-xl border border-white/5 bg-[#23293c] p-6">
                                  <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#4edea3]">Deep Dive</h4>
                                  <p className="text-sm text-slate-400">{section.deep_dive}</p>
                                </div>
                              )}
                              {section.common_mistakes && section.common_mistakes.length > 0 && (
                                <div className="rounded-xl border border-white/5 bg-[#2e3447] p-6">
                                  <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#ffb4ab]">Common Mistakes</h4>
                                  <div className="space-y-3">
                                    {section.common_mistakes.map((item, mistakeIndex) => (
                                      <p key={`${section.id}-mistake-${mistakeIndex}`} className="text-sm text-slate-400">
                                        <span className="line-through">{item.mistake}</span>
                                        <span className="mx-2 text-[#c0c1ff]">-&gt;</span>
                                        <span>{item.fix}</span>
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {section.code?.src && (
                            <div className="overflow-x-auto rounded-lg border border-white/5 bg-[#070d1f] p-6 font-mono text-sm text-indigo-300">
                              <pre>
                                <code>{section.code.src}</code>
                              </pre>
                            </div>
                          )}

                          {index === 0 && (
                            <div className="group relative mt-12 aspect-video overflow-hidden rounded-xl">
                              <img
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOHQDQse7g6u2NaLvGmLM1LxlRyderijxOZBWIDlgUVZJ127zqf5zj8kEwEKn9TYDGVIzoywRpEncnKEJcti6buw8W1l7gSIn08DST--hxWH4WZgIWG7AFXyqFBcSlsSI1VfbI7Lm4cU0cSYC1zmQhv4rWKzPFO65WaREOiNuaYJATM-TpBX3IBQSjTHMAQQqHDYRCQLusC3g3ezLwQq6ZIwYAd2zFcmrNwW9QaLpbCxWDlsTpX2zwaQJQ3wivVWciEqFZRo0GhRj_"
                                alt="Abstract neural network"
                                className="h-full w-full scale-105 object-cover opacity-50 grayscale transition-all duration-700 group-hover:scale-100 group-hover:opacity-80 group-hover:grayscale-0"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#151b2d] via-transparent to-transparent" />
                              <div className="absolute bottom-6 left-6 right-6">
                                <p className="mb-1 text-[10px] uppercase tracking-widest text-[#c0c1ff]/70">Figure 1.1</p>
                                <p className="font-serif text-sm italic text-slate-300">Visual mapping of synaptic firing patterns during deep focus.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'summary' && (
            <div id="summary-view" className="space-y-6 pb-8">
              <div className="rounded-xl border border-white/5 bg-[#151b2d] p-8">
                <h3 className="font-serif text-3xl italic text-[#dce1fb]">Summary</h3>
                <p className="mt-4 leading-relaxed text-slate-300">{lesson.summary || 'No summary available for this lesson.'}</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-white/5 bg-[#151b2d] p-8">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#4edea3]">Key Takeaways</h4>
                  {Array.isArray(lesson.key_takeaways) && lesson.key_takeaways.length > 0 ? (
                    <ul className="mt-5 space-y-3">
                      {lesson.key_takeaways.map((item, index) => (
                        <li key={`${item}-${index}`} className="flex items-start gap-2 text-slate-300">
                          <Sparkles className="mt-1 h-4 w-4 text-[#c0c1ff]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-5 text-sm text-slate-400">No takeaways recorded.</p>
                  )}
                </div>

                <div className="rounded-xl border border-white/5 bg-[#151b2d] p-8">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#7bd0ff]">Practice Prompts</h4>
                  {Array.isArray(lesson.questions) && lesson.questions.length > 0 ? (
                    <ol className="mt-5 space-y-3 text-slate-300">
                      {lesson.questions.map((question, index) => (
                        <li key={`${question}-${index}`} className="flex gap-3">
                          <span className="text-[#c0c1ff]">{index + 1}.</span>
                          <span>{question}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-5 text-sm text-slate-400">No practice prompts recorded.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'practice' && (
            <div id="practice-view" className="pb-8">
              <LessonQuizPanel
                lesson={lesson}
                sections={sections}
                active={activeTab === 'practice'}
                onBackToLesson={() => setActiveTab('lesson')}
              />
            </div>
          )}

          {activeTab === 'lesson' && sections.length > 0 && (
            <div className="mb-12 mt-24 flex items-center justify-between border-t border-white/5 py-8">
              <button
                type="button"
                onClick={() => previousSection && scrollToSection(previousSection.id)}
                disabled={!previousSection}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous Section
              </button>

              {nextSection ? (
                <button
                  type="button"
                  onClick={() => scrollToSection(nextSection.id)}
                  className="rounded-full bg-gradient-to-r from-[#c0c1ff] to-[#8083ff] px-10 py-4 font-bold text-[#1000a9] shadow-xl shadow-indigo-900/20 transition-transform hover:scale-105 active:scale-95"
                >
                  {`Next: ${titleFromHeading(nextSection.heading)}`}
                </button>
              ) : (
                <Link
                  to={`/learn/${lesson.slug}/quiz`}
                  className="rounded-full bg-gradient-to-r from-[#4edea3] to-[#7bd0ff] px-10 py-4 font-bold text-[#06231a] shadow-xl shadow-emerald-900/20 transition-transform hover:scale-105 active:scale-95"
                >
                  Take Final Quiz
                </Link>
              )}
            </div>
          )}
        </main>
      </div>

      {narration.isSupported && narration.currentSectionId && (narration.isPlaying || narration.isPaused) && currentNarrationSection && (
        <div className="fixed bottom-8 z-50 hidden w-full justify-center md:flex">
          <div className="fixed bottom-6 left-1/2 flex min-w-[380px] -translate-x-1/2 items-center justify-between gap-10 rounded-full border border-white/10 bg-slate-900/80 px-8 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
            <div className="flex items-center gap-4">
              <div className="h-2 w-2 animate-pulse rounded-full bg-[#c0c1ff]" />
              <div>
                <p className="mb-0.5 text-[10px] uppercase leading-none tracking-widest text-slate-500">
                  Narrating {currentNarrationSection.heading}
                </p>
                <p className="text-xs font-bold leading-none text-indigo-300">{titleFromHeading(currentNarrationSection.heading)}</p>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <button type="button" onClick={narration.replay} className="text-slate-500 transition-all hover:text-slate-200">
                <RotateCcw className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={() => narration.toggleSection(currentNarrationSection.id)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c0c1ff] text-[#1000a9] shadow-lg shadow-[#c0c1ff]/20 transition-all hover:scale-110 active:scale-95"
              >
                {narration.isPaused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
              </button>

              <button type="button" onClick={narration.next} className="text-slate-500 transition-all hover:text-slate-200">
                <RotateCw className="h-6 w-6" />
              </button>
            </div>

            <div className="flex items-center gap-4 border-l border-white/10 pl-6">
              {RATE_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => narration.updateRate(speed)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors',
                    narration.rate === speed
                      ? 'border-[#c0c1ff]/40 bg-[#c0c1ff]/20 text-[#dce1fb]'
                      : 'border-white/10 text-slate-500 hover:text-slate-200'
                  )}
                >
                  {speed}x
                </button>
              ))}
              <button type="button" onClick={narration.stop} className="text-slate-500 transition-all hover:text-slate-200">
                <Square className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
