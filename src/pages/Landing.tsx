/*
 * LANDING PAGE AUDIT SUMMARY
 * - Removed: scroll progress bar and decorative star/particle layers because they distracted from core conversion content.
 * - Kept + redesigned: sticky nav, hero, stats, feature storytelling, how-it-works, value props, final CTA, and footer.
 * - Added: tighter stagger timing, explicit auth-safe CTA mapping, and clearer conversion copy hierarchy for each section.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useInView as useMotionInView } from 'framer-motion';
import {
  GraduationCap,
  BookOpen,
  MessageSquare,
  Code2,
  Video,
  ArrowRight,
  Zap,
  Brain,
  Layers,
  Menu,
  X,
  CheckCircle2,
} from 'lucide-react';
import './Landing.css';

// Lazy load frame modules - don't load eagerly
const frameModules = import.meta.glob('../AI_energy_crystallizing_202604051220_000/*.jpg', { eager: false });
const frameUrls = Object.keys(frameModules)
  .sort()
  .map((k) => k);


/* ────────────────────────────────────────────────────────────────
   HOOK: count-up on IntersectionObserver
──────────────────────────────────────────────────────────────── */
function useCountUp(target: number | null, active: boolean, duration = 1800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active || target === null) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setCount(Math.floor(start));
      if (start >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [active, target, duration]);
  return count;
}

/* ────────────────────────────────────────────────────────────────
   HOOK: IntersectionObserver (kept for count-up stats)
──────────────────────────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ────────────────────────────────────────────────────────────────
   Motion helpers
──────────────────────────────────────────────────────────────── */
const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const slideLeftVariants = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } },
};

const slideRightVariants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } },
};

function MotionSection({
  children,
  className,
  style,
  variants = fadeUpVariants,
}: {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  variants?: typeof fadeUpVariants;
}) {
  const ref = useRef(null);
  const isInView = useMotionInView(ref, { once: true, amount: 0.15 });
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────
   STAT ITEM (count-up)
──────────────────────────────────────────────────────────────── */
interface StatDef { numeric: number | null; prefix?: string; suffix?: string; label: string }
const statData: StatDef[] = [
  { numeric: 10, suffix: '+ Topics', label: '' },
  { numeric: 7, suffix: '+ Languages', label: '' },
  { numeric: null, suffix: 'Free AI Models', label: '' },
  { numeric: null, suffix: 'Text-to-Speech', label: '' },
];

function StatItem({ def, active }: { def: StatDef; active: boolean }) {
  const count = useCountUp(def.numeric, active);
  const display =
    def.numeric !== null
      ? `${def.prefix ?? ''}${count}${def.suffix ?? ''}`
      : def.suffix;
  return (
    <div className="ls-stat-item">
      <div className={`ls-stat-value ${def.numeric === null ? 'textual' : ''}`}>{display}</div>
      {def.label ? <div className="ls-stat-label">{def.label}</div> : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   FEATURE ROW
──────────────────────────────────────────────────────────────── */
interface FeatureDef {
  icon: React.ElementType;
  title: string;
  desc: string;
  mockup: React.ReactNode;
  color: string;
}

function FeatureRow({ feature, index }: { feature: FeatureDef; index: number }) {
  const isEven = index % 2 === 0;
  const ref = useRef(null);
  const isInView = useMotionInView(ref, { once: true, amount: 0.12 });

  return (
    <motion.div
      ref={ref}
      className={`ls-feature-row ${isEven ? '' : 'reverse'}`}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={isEven ? slideLeftVariants : slideRightVariants}
    >
      {/* Text side */}
      <div className="ls-feature-text">
        <div
          className="ls-feature-icon-box"
          style={{
            background: `linear-gradient(135deg, ${feature.color}22, ${feature.color}44)`,
            border: `1px solid ${feature.color}55`,
          }}
        >
          <feature.icon size={24} color={feature.color} />
        </div>
        <h3 className="ls-feature-title">{feature.title}</h3>
        <p className="ls-feature-desc">{feature.desc}</p>
      </div>

      {/* Mockup side */}
      <div className="ls-feature-mockup">
        <div
          className="ls-feature-mockup-card"
          style={{ boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px ${feature.color}22` }}
        >
          {feature.mockup}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Feature mockup sub-components ─── */
const LessonMockup = () => (
  <div>
    <div className="ls-mockup-status">
      <div className="ls-mockup-status-dot" />
      <span className="ls-mockup-status-text">Generating lesson…</span>
    </div>
    {['Introduction to Quantum Computing', 'What is Superposition?', 'Entanglement Explained'].map((t, i) => (
      <div key={i} className="ls-mockup-list-item">
        <CheckCircle2 size={14} color="#6366f1" />
        <span style={{ color: i === 0 ? 'var(--ls-text)' : 'var(--ls-muted)' }}>{t}</span>
      </div>
    ))}
  </div>
);

const ChatMockup = () => (
  <div className="ls-mockup-chat">
    <div className="ls-mockup-chat-user">
      Explain recursion with a simple example
    </div>
    <div className="ls-mockup-chat-ai">
      Recursion is when a function calls itself. Think of nested Russian dolls 🪆
    </div>
  </div>
);

const CodeMockup = () => (
  <div className="ls-mockup-code">
    <span className="ls-code-keyword">def </span>
    <span className="ls-code-fn">fibonacci</span>
    <span style={{ color: 'var(--ls-muted)' }}>(n):</span><br />
    <span style={{ color: 'var(--ls-muted)' }}>{'  '}</span>
    <span className="ls-code-keyword">if </span>
    <span style={{ color: 'var(--ls-muted)' }}>n {'<='} 1: </span>
    <span className="ls-code-keyword">return </span>
    <span className="ls-code-num">n</span><br />
    <span style={{ color: 'var(--ls-muted)' }}>{'  return '}</span>
    <span className="ls-code-fn">fibonacci</span>
    <span style={{ color: 'var(--ls-muted)' }}>(n-1) + </span>
    <span className="ls-code-fn">fibonacci</span>
    <span style={{ color: 'var(--ls-muted)' }}>(n-2)</span>
  </div>
);

const VideoMockup = () => (
  <div>
    {[
      { title: 'Machine Learning in 10 mins', ch: 'TechWithTim', views: '2.1M' },
      { title: 'React Hooks Explained', ch: 'Fireship', views: '890K' },
    ].map((v, i) => (
      <div key={i} className="ls-mockup-video-item">
        <div className="ls-mockup-video-thumb">
          <Video size={14} color="#8b5cf6" />
        </div>
        <div>
          <div className="ls-mockup-video-title">{v.title}</div>
          <div className="ls-mockup-video-meta">{v.ch} · {v.views} views</div>
        </div>
      </div>
    ))}
  </div>
);

/* ────────────────────────────────────────────────────────────────
   MAIN COMPONENT
──────────────────────────────────────────────────────────────── */
export default function Landing() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Custom scroll triggers
  const [statsVisible, setStatsVisible] = useState(false);
  const statsVisibleRef = useRef(false);

  // --- Scroll Animation Setup ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [framesLoaded, setFramesLoaded] = useState(false);
  const [showPreloader, setShowPreloader] = useState(true);
  const framesArrayRef = useRef<HTMLImageElement[]>([]);
  const isMobile = window.innerWidth < 768; // Initial check

  useEffect(() => {
    if (isMobile) {
      setShowPreloader(false);
      return;
    }
    
    // Defer frame loading to after page is interactive using requestIdleCallback
    const loadFrames = () => {
      Promise.all(
        frameUrls.map((modulePath) => {
          return new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img);
            // Dynamically import the module
            import(/* @vite-ignore */ modulePath).then((mod) => {
              img.src = mod.default || modulePath;
            }).catch(() => {
              resolve(img); // Resolve anyway if import fails
            });
          });
        })
      ).then((images) => {
        framesArrayRef.current = images.filter((img) => img.naturalWidth > 0);
        setFramesLoaded(true);
        setTimeout(() => setShowPreloader(false), 400);

        const canvas = canvasRef.current;
        if (canvas && framesArrayRef.current.length > 0) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(framesArrayRef.current[0], 0, 0, canvas.width, canvas.height);
        }
      });
    };

    // Use requestIdleCallback if available, otherwise defer with setTimeout
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadFrames, { timeout: 3000 });
    } else {
      setTimeout(loadFrames, 2000);
    }
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;
    if (!framesLoaded) return;

    let targetFrameIndex = 0;
    let currentFrameIndex = 0;
    let animationFrameId: number;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderLoop = () => {
      // Hollywood cinematic ultra-smooth lerp (0.015 factor creates heavy, slow-motion glide)
      currentFrameIndex += (targetFrameIndex - currentFrameIndex) * 0.015;
      
      let drawIndex = Math.floor(currentFrameIndex);
      const maxFrame = framesArrayRef.current.length - 1;
      if (drawIndex > maxFrame) drawIndex = maxFrame;
      if (drawIndex < 0) drawIndex = 0;

      if (framesArrayRef.current.length > 0 && framesArrayRef.current[drawIndex]) {
        ctx.drawImage(framesArrayRef.current[drawIndex], 0, 0, canvas.width, canvas.height);
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    const updateTargetFrame = () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      
      // Update sticky nav state
      setScrolled(scrollY > 40);

      // EXTREME SLOW MOTION: Map exactly to the first 300vh of scrolling (wrapper is 500vh)
      const maxHeroScroll = window.innerHeight * 3;
      let progress = scrollY / maxHeroScroll;
      if (progress > 1) progress = 1;
      if (progress < 0) progress = 0;

      targetFrameIndex = progress * (framesArrayRef.current.length - 1);

      // Check stats visibility (trigger at 28%)
      const currentRatio = scrollY / docHeight;
      if (currentRatio >= 0.28 && !statsVisibleRef.current) {
        statsVisibleRef.current = true;
        setStatsVisible(true);
      }
    };

    // Begin cinematic rendering loop
    animationFrameId = requestAnimationFrame(renderLoop);
    
    // Set initial target based on current load position
    updateTargetFrame();

    const handleScroll = () => {
      updateTargetFrame();
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      updateTargetFrame();
      
      if (framesArrayRef.current.length > 0) {
        let drawIndex = Math.floor(currentFrameIndex);
        if (drawIndex > framesArrayRef.current.length - 1) drawIndex = framesArrayRef.current.length - 1;
        ctx.drawImage(framesArrayRef.current[drawIndex], 0, 0, canvas.width, canvas.height);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [framesLoaded, isMobile]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const features: FeatureDef[] = [
    {
      icon: BookOpen,
      title: 'AI-Powered Lesson Generation',
      desc: 'Instantly generate comprehensive, structured lessons on any topic. From beginner to advanced — the AI adapts to your level and creates content with examples, summaries, and quizzes.',
      mockup: <LessonMockup />,
      color: '#6366f1',
    },
    {
      icon: MessageSquare,
      title: 'AI Chat Tutor',
      desc: "Got a question? Ask your AI tutor anytime. It understands context, remembers your conversation, and explains complex ideas in plain language — like having a patient teacher on demand.",
      mockup: <ChatMockup />,
      color: '#8b5cf6',
    },
    {
      icon: Code2,
      title: 'Code Generation & Sandbox',
      desc: 'Write, explain and run code in multiple programming languages. Get intelligent completions, debugging hints, and step-by-step code walkthroughs powered by state-of-the-art AI.',
      mockup: <CodeMockup />,
      color: '#06b6d4',
    },
    {
      icon: Video,
      title: 'Curated Video Tutorials',
      desc: 'Discover the best YouTube tutorials hand-picked by AI for your exact learning topic. Save videos to your library and learn through multi-modal experiences.',
      mockup: <VideoMockup />,
      color: '#f43f5e',
    },
  ];

  const whyItems = [
    { icon: Zap, title: 'Lightning Fast', desc: 'Generate full lessons in under 5 seconds — no waiting, no loading screens.', color: '#f59e0b' },
    { icon: Brain, title: 'Adaptive Learning', desc: 'AI calibrates content difficulty to your level and adjusts as you progress.', color: '#6366f1' },
    { icon: Layers, title: 'All-in-One', desc: 'Lessons, chat, code, and videos — everything in one unified workspace.', color: '#8b5cf6' },
  ];

  const navLinks: [string, string][] = [['Learn', '/learn'], ['Chat', '/chat'], ['Code', '/code'], ['Videos', '/videos']];

  return (
    <div className="ls-page" style={{ position: 'relative', zIndex: 1, backgroundColor: 'transparent' }}>
      
      {/* ─── Scroll Animation Overlay & Canvas ─── */}
      <style>{`
        @keyframes ls-spin-preloader { 100% { transform: rotate(360deg); } }
        /* Add strong text shadows to all major text blocks so they pop flawlessly over the video without messy glass blurs */
        .ls-section-title, .ls-section-desc, .ls-step-title, .ls-step-desc, .ls-why-title, .ls-why-desc {
          text-shadow: 0 4px 24px rgba(0, 0, 0, 0.95), 0 2px 10px rgba(0,0,0,0.8);
        }
        .ls-feature-title, .ls-feature-desc, .ls-feature-pill {
           text-shadow: 0 4px 24px rgba(0, 0, 0, 0.95), 0 2px 10px rgba(0,0,0,0.8);
        }
        .ls-step-item, .ls-why-card {
           filter: drop-shadow(0 10px 40px rgba(0,0,0,0.4));
        }
      `}</style>
      
      {!isMobile && showPreloader && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: '#0d0f1a', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center',
          transition: 'opacity 400ms ease-out', opacity: framesLoaded ? 0 : 1
        }}>
          <div style={{ width: 40, height: 40, border: '4px solid rgba(99, 102, 241, 0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'ls-spin-preloader 1s linear infinite' }} />
        </div>
      )}

      {!isMobile && (
        <>
          <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'none', objectFit: 'cover' }} />
          {/* Watermark obfuscator */}
          <div style={{ position: 'fixed', bottom: 0, right: 0, width: 280, height: 120, background: 'radial-gradient(ellipse at bottom right, #0d0f1a 0%, #0d0f1a 40%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
        </>
      )}
      
      {isMobile && frameUrls.length > 0 && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, backgroundImage: `url(${frameUrls[0]})`, backgroundSize: 'cover', backgroundPosition: 'center', pointerEvents: 'none' }} />
      )}


      {/* ══════════════════════════════════════════════════════════
          1. STICKY NAV
      ══════════════════════════════════════════════════════════ */}
      <nav className={`ls-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="ls-container ls-nav-inner">
          {/* Logo */}
          <Link to="/" className="ls-logo">
            <div className="ls-logo-icon">
              <GraduationCap size={20} color="#fff" />
            </div>
            <span className="ls-logo-text">LearnSphere AI</span>
          </Link>

          {/* Center nav links */}
          <div className="ls-nav-links-center">
            {navLinks.map(([label, path]) => (
              <Link
                key={label}
                to={path}
                className={`ls-nav-link ${location.pathname.startsWith(path) ? 'active' : ''}`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="ls-desktop-ctas" style={{ display: 'flex', gap: 10 }}>
            <Link to="/login">
              <button className="ls-nav-btn-login">Log In</button>
            </Link>
            <Link to="/register">
              <button className="ls-cta-btn ls-cta-btn-nav">Get Started</button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="ls-mobile-trigger"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* Mobile full-screen menu */}
      <div className={`ls-mobile-menu ${menuOpen ? 'open' : ''}`} role="dialog" aria-label="Mobile navigation">
        <button
          className="ls-mobile-menu-close"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        >
          <X size={28} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>
          {navLinks.map(([label, path]) => (
            <Link key={label} to={path} onClick={() => setMenuOpen(false)} className="ls-mobile-menu-link">
              {label}
            </Link>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Link to="/login" onClick={() => setMenuOpen(false)}>
            <button className="ls-nav-btn-login" style={{ padding: '12px 28px', fontSize: '1rem', borderRadius: 12 }}>
              Log In
            </button>
          </Link>
          <Link to="/register" onClick={() => setMenuOpen(false)}>
            <button className="ls-cta-btn" style={{ padding: '12px 28px', fontSize: '1rem', borderRadius: 12 }}>
              Get Started
            </button>
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          2. HERO
      ══════════════════════════════════════════════════════════ */}
      <div style={{ height: '500vh', position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
          <section className="ls-hero" style={{ width: '100vw', minHeight: 'auto' }}>
            {/* Aurora blobs */}
            <div className="ls-aurora-container">
              <div className="ls-aurora-blob ls-aurora-blob-1" />
              <div className="ls-aurora-blob ls-aurora-blob-2" />
              <div className="ls-aurora-blob ls-aurora-blob-3" />
              <div className="ls-aurora-blob ls-aurora-blob-4" />
            </div>

        <div className="ls-container ls-hero-content" style={{ paddingLeft: '48px', justifyContent: 'flex-start', background: 'radial-gradient(ellipse at 15% 50%, rgba(13,15,26,0.7) 0%, rgba(13,15,26,0) 65%)' }}>
          {/* Left: text */}
          <div className="ls-hero-text" style={{ backdropFilter: 'blur(0px)', margin: 0, padding: 0 }}>
            <h1 className="ls-hero-headline" style={{
              fontFamily: 'Rubik, sans-serif',
              fontWeight: 800,
              fontSize: 'clamp(2.8rem, 6vw, 4.5rem)',
              textShadow: '0 2px 40px rgba(0,0,0,0.8)',
              textAlign: 'left'
            }}>
              Learn Anything with <span className="ls-gradient-text">AI</span>
            </h1>

            <p className="ls-hero-sub" style={{
              color: '#94a3b8',
              fontSize: '1.1rem',
              maxWidth: '480px',
              textAlign: 'left'
            }}>
              Generate AI lessons in seconds, ask follow-up questions, and practice with chat, code, and videos in one learning flow.
            </p>

            <div className="ls-hero-ctas">
              <Link to="/register">
                <button className="ls-cta-btn ls-cta-btn-hero">
                  Start Learning <ArrowRight size={18} />
                </button>
              </Link>
              <Link to="/login">
                <button className="ls-btn-secondary">
                  Sign In
                </button>
              </Link>
            </div>

            {/* Trust strip */}
            <div className="ls-trust-strip">
              {['Free AI Models', 'No Credit Card', '10+ Topics', '7+ Languages'].map(t => (
                <div key={t} className="ls-trust-item">
                  <div className="ls-trust-dot" />
                  <span className="ls-trust-label">{t}</span>
                </div>
              ))}
            </div>
          </div>


        </div>
      </section>
      </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          3. STATS STRIP
      ══════════════════════════════════════════════════════════ */}
      <section
        className="ls-stats-section"
        style={{ background: '#1e1b4b99', backdropFilter: 'blur(32px)', border: 'none' }}
      >
        <div className="ls-container ls-stats-grid">
          {statData.map((def, i) => (
            <motion.div
              key={def.suffix}
              initial={{ opacity: 0, y: 20 }}
              animate={statsVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
            >
              <StatItem def={def} active={statsVisible} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          4. FEATURE STORYTELLING
      ══════════════════════════════════════════════════════════ */}
      <section className="ls-features-section" style={{ background: 'rgba(13, 15, 26, 0.65)', backdropFilter: 'blur(16px)' }}>
        <div className="ls-container">
          <MotionSection className="ls-section-header">
            <h2 className="ls-section-title">
              Everything You Need{' '}
              <span className="ls-gradient-text">to Learn</span>
            </h2>
            <p className="ls-section-desc">
              A complete AI-powered learning platform with tools for every learning style.
            </p>
          </MotionSection>

          <div className="ls-features-list">
            {features.map((f, i) => (
              <FeatureRow key={f.title} feature={f} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          5. HOW IT WORKS
      ══════════════════════════════════════════════════════════ */}
      <section className="ls-how-section" style={{ background: 'rgba(13, 15, 26, 0.65)', backdropFilter: 'blur(16px)' }}>
        <div className="ls-container">
          <MotionSection className="ls-section-header">
            <h2 className="ls-section-title">
              How It <span className="ls-gradient-text">Works</span>
            </h2>
            <p className="ls-section-desc" style={{ maxWidth: 380 }}>
              Three steps to start learning smarter
            </p>
          </MotionSection>

          <div className="ls-steps">
            {[
              { n: '01', title: 'Pick a topic', desc: 'Choose anything from Python to Philosophy. The AI handles the rest.' },
              { n: '02', title: 'AI generates your lesson', desc: 'A full structured lesson with examples, code, and quizzes is created instantly.' },
              { n: '03', title: 'Learn with chat, code & videos', desc: 'Use tutor chat, code generation, and curated videos to lock in learning.' },
            ].map((step, i) => (
              <MotionSection
                key={step.n}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.18, ease: [0.16, 1, 0.3, 1] } },
                }}
                style={{ display: 'contents' }}
              >
                <div className="ls-step-item">
                  <div className="ls-step-number-wrap">
                    <div className="ls-step-number-bg">{step.n}</div>
                    <div className="ls-step-number-circle">{i + 1}</div>
                  </div>
                  <h3 className="ls-step-title">{step.title}</h3>
                  <p className="ls-step-desc">{step.desc}</p>
                </div>
                {i < 2 && <div className="ls-step-connector" />}
              </MotionSection>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          6. WHY LEARNSPHERE AI
      ══════════════════════════════════════════════════════════ */}
      <section className="ls-why-section" style={{ background: 'rgba(13, 15, 26, 0.65)', backdropFilter: 'blur(16px)' }}>
        <div className="ls-container">
          <MotionSection className="ls-section-header">
            <h2 className="ls-section-title">
              Why <span className="ls-gradient-text">LearnSphere AI</span>
            </h2>
            <p className="ls-section-desc" style={{ maxWidth: 400 }}>
              Built differently, for learners who want results
            </p>
          </MotionSection>

          <div className="ls-why-grid">
            {whyItems.map((item, i) => (
              <MotionSection
                key={item.title}
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] } },
                }}
              >
                <div className="ls-why-card">
                  <div
                    className="ls-why-icon-box"
                    style={{
                      background: `linear-gradient(135deg, ${item.color}22, ${item.color}44)`,
                      border: `1px solid ${item.color}44`,
                    }}
                  >
                    <item.icon size={24} color={item.color} />
                  </div>
                  <h3 className="ls-why-title">{item.title}</h3>
                  <p className="ls-why-desc">{item.desc}</p>
                </div>
              </MotionSection>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          7. FINAL CTA SECTION
      ══════════════════════════════════════════════════════════ */}
      <section className="ls-final-cta" style={{ background: 'rgba(13, 15, 26, 0.65)', backdropFilter: 'blur(16px)' }}>
        {/* Animated bg gradient */}
        <div className="ls-final-cta-bg">
          <div className="ls-final-cta-bg-gradient" />
          <div className="ls-final-cta-bg-blob" />
        </div>

        <MotionSection className="ls-container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 className="ls-final-cta-headline">
            Ready to <span className="ls-gradient-text">Learn?</span>
          </h2>
          <p className="ls-final-cta-sub">
            Join LearnSphere AI and start your journey today — no credit card required.
          </p>
          <Link to="/register">
            <button className="ls-cta-btn ls-cta-btn-final">
              Get Started - It's Free <ArrowRight size={20} />
            </button>
          </Link>
        </MotionSection>
      </section>

      {/* ══════════════════════════════════════════════════════════
          8. FOOTER
      ══════════════════════════════════════════════════════════ */}
      <footer className="ls-footer">
        <div className="ls-container ls-footer-inner">
          {/* Logo + tagline */}
          <div className="ls-footer-brand">
            <div className="ls-footer-logo-icon">
              <GraduationCap size={16} color="#fff" />
            </div>
            <div>
              <div className="ls-footer-name">LearnSphere AI</div>
              <div className="ls-footer-tagline">Learn anything with AI</div>
            </div>
          </div>

          {/* Center links */}
          <div className="ls-footer-links">
            {navLinks.map(([label, path]) => (
              <Link key={label} to={path} className="ls-footer-link">
                {label}
              </Link>
            ))}
          </div>

          {/* Copyright */}
          <p className="ls-footer-copyright">
            © {new Date().getFullYear()} LearnSphere AI. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  );
}
