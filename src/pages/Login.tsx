import {
  CSSProperties,
  ChangeEvent,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, GraduationCap, Loader2, Lock, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import './Login.css';

type OwlState =
  | 'neutral'
  | 'look-left'
  | 'look-right'
  | 'covering'
  | 'sleeping'
  | 'sad'
  | 'happy';
type AuthState = 'idle' | 'submitting' | 'error' | 'success';
type FocusField = 'email' | 'password' | null;

type CardTilt = {
  rotateX: number;
  rotateY: number;
  scale: number;
  glowX: number;
  glowY: number;
  owlX: number;
  owlY: number;
};

const IDLE_TIMEOUT = 12000;
const SUCCESS_REDIRECT_DELAY = 1200;
const DEFAULT_TILT: CardTilt = {
  rotateX: 0,
  rotateY: 0,
  scale: 1,
  glowX: 50,
  glowY: 18,
  owlX: 0,
  owlY: 0,
};

const OWL_ART: Record<
  OwlState,
  {
    src: string;
    alt: string;
    title: string;
    copy: string;
    accent: string;
  }
> = {
  neutral: {
    src: '/login-art/fast/neutral.jpg',
    alt: 'A neutral owl waiting beside the login form',
    title: 'Ready to help',
    copy: 'Sign in and pick up your next lesson right where you left it.',
    accent: 'rgba(99, 102, 241, 0.56)',
  },
  'look-left': {
    src: '/login-art/fast/looking-left.jpg',
    alt: 'An owl looking to the left while following the email input',
    title: 'Tracking your email',
    copy: 'The owl follows your cursor while you type.',
    accent: 'rgba(56, 189, 248, 0.58)',
  },
  'look-right': {
    src: '/login-art/fast/looking-right.jpg',
    alt: 'An owl looking to the right while following the email input',
    title: 'Still watching',
    copy: 'Move through the address and the owl keeps up.',
    accent: 'rgba(14, 165, 233, 0.56)',
  },
  covering: {
    src: '/login-art/fast/covering.jpg',
    alt: 'An owl covering its eyes while the password is being entered',
    title: 'Password shield on',
    copy: 'Your secret stays yours. The owl is not peeking.',
    accent: 'rgba(245, 158, 11, 0.54)',
  },
  sleeping: {
    src: '/login-art/fast/sleep.jpg',
    alt: 'A sleeping owl waiting for activity',
    title: 'Nap mode',
    copy: 'Too quiet. Interact with the page and the owl wakes up.',
    accent: 'rgba(148, 163, 184, 0.46)',
  },
  sad: {
    src: '/login-art/fast/sad.jpg',
    alt: 'A sad owl reacting to a failed login',
    title: 'That did not work',
    copy: 'Check your credentials and try again.',
    accent: 'rgba(244, 63, 94, 0.56)',
  },
  happy: {
    src: '/login-art/fast/happy.jpg',
    alt: 'A happy owl celebrating a successful login',
    title: 'Welcome back',
    copy: 'Success. Opening your dashboard now.',
    accent: 'rgba(16, 185, 129, 0.58)',
  },
};

function getEmailOwlState(input: HTMLInputElement | null) {
  const value = input?.value ?? '';
  const caret = input?.selectionStart ?? value.length;
  const midpoint = Math.max(1, value.length / 2);
  return caret <= midpoint ? 'look-left' : 'look-right';
}

function getContextualOwlState(field: FocusField, emailInput: HTMLInputElement | null): OwlState {
  if (field === 'password') {
    return 'covering';
  }

  if (field === 'email') {
    return getEmailOwlState(emailInput);
  }

  return 'neutral';
}

export default function Login() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { toast } = useToast();
  const { signInWithEmail, signInWithOAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [owlState, setOwlState] = useState<OwlState>('neutral');
  const [activeField, setActiveField] = useState<FocusField>(null);
  const [isIdle, setIsIdle] = useState(false);
  const [cardTilt, setCardTilt] = useState<CardTilt>(DEFAULT_TILT);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const authStateRef = useRef<AuthState>('idle');
  const activeFieldRef = useRef<FocusField>(null);
  const isIdleRef = useRef(false);

  useEffect(() => {
    authStateRef.current = authState;
  }, [authState]);

  useEffect(() => {
    activeFieldRef.current = activeField;
  }, [activeField]);

  useEffect(() => {
    isIdleRef.current = isIdle;
  }, [isIdle]);

  function setIdleTimer() {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = window.setTimeout(() => {
      if (authStateRef.current !== 'idle') {
        return;
      }

      setIsIdle(true);
      setOwlState('sleeping');
    }, IDLE_TIMEOUT);
  }

  function restoreContextualOwl(field: FocusField = activeFieldRef.current) {
    if (authStateRef.current === 'success') {
      setOwlState('happy');
      return;
    }

    if (isIdleRef.current) {
      setOwlState('sleeping');
      return;
    }

    setOwlState(getContextualOwlState(field, emailInputRef.current));
  }

  function clearErrorState() {
    if (authStateRef.current !== 'error') {
      return;
    }

    authStateRef.current = 'idle';
    setAuthState('idle');
  }

  function registerActivity() {
    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
      restoreContextualOwl();
    }

    setIdleTimer();
  }

  function syncEmailDirection(input: HTMLInputElement | null) {
    if (authStateRef.current === 'success' || activeFieldRef.current !== 'email') {
      return;
    }

    setOwlState(getEmailOwlState(input));
  }

  useEffect(() => {
    setIdleTimer();

    const handleActivity = () => {
      registerActivity();
    };

    const events: (keyof WindowEventMap)[] = ['pointermove', 'pointerdown', 'keydown', 'touchstart'];
    events.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }));

    return () => {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }

      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }

      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
    };
  }, []);

  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const sources = [...new Set(Object.values(OWL_ART).map((art) => art.src))];

    const warmAssets = () => {
      sources.forEach((src) => {
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
      });
    };

    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    if (win.requestIdleCallback) {
      idleHandle = win.requestIdleCallback(() => warmAssets(), { timeout: 1000 });
    } else {
      timeoutHandle = window.setTimeout(warmAssets, 180);
    }

    return () => {
      if (idleHandle !== null && win.cancelIdleCallback) {
        win.cancelIdleCallback(idleHandle);
      }

      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, []);

  function handleCardMouseMove(event: ReactMouseEvent<HTMLElement>) {
    if (reduceMotion) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    setCardTilt({
      rotateX: (0.5 - y) * 8,
      rotateY: (x - 0.5) * 10,
      scale: 1.015,
      glowX: x * 100,
      glowY: y * 100,
      owlX: (x - 0.5) * 16,
      owlY: (0.5 - y) * 12,
    });
  }

  function handleCardMouseLeave() {
    setCardTilt(DEFAULT_TILT);
  }

  function handleEmailFocus() {
    clearErrorState();
    isIdleRef.current = false;
    setIsIdle(false);
    activeFieldRef.current = 'email';
    setActiveField('email');
    setOwlState(getEmailOwlState(emailInputRef.current));
    setIdleTimer();
  }

  function handlePasswordFocus() {
    clearErrorState();
    isIdleRef.current = false;
    setIsIdle(false);
    activeFieldRef.current = 'password';
    setActiveField('password');
    setOwlState('covering');
    setIdleTimer();
  }

  function handleFieldBlur() {
    window.setTimeout(() => {
      if (formRef.current?.contains(document.activeElement)) {
        return;
      }

      activeFieldRef.current = null;
      setActiveField(null);
      restoreContextualOwl(null);
    }, 0);
  }

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    clearErrorState();
    isIdleRef.current = false;
    setIsIdle(false);
    setEmail(event.target.value);
    syncEmailDirection(event.target);
    setIdleTimer();
  }

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    clearErrorState();
    isIdleRef.current = false;
    setIsIdle(false);
    setPassword(event.target.value);
    if (authStateRef.current !== 'success') {
      setOwlState('covering');
    }
    setIdleTimer();
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authStateRef.current === 'submitting' || authStateRef.current === 'success') {
      return;
    }

    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
    }

    authStateRef.current = 'submitting';
    setAuthState('submitting');
    activeFieldRef.current = null;
    setActiveField(null);
    isIdleRef.current = false;
    setIsIdle(false);
    setOwlState('neutral');
    setIdleTimer();

    const { error } = await signInWithEmail(email, password);

    if (error) {
      authStateRef.current = 'error';
      setAuthState('error');
      setOwlState('sad');
      toast({
        title: 'Sign in failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    authStateRef.current = 'success';
    setAuthState('success');
    setOwlState('happy');
    toast({
      title: 'Welcome back',
      description: 'Opening your dashboard.',
    });

    successTimerRef.current = window.setTimeout(() => {
      navigate('/dashboard');
    }, reduceMotion ? 250 : SUCCESS_REDIRECT_DELAY);
  }

  async function handleOAuth(provider: 'google' | 'github') {
    registerActivity();
    clearErrorState();
    setOwlState('neutral');
    await signInWithOAuth(provider);
  }

  const currentArt = OWL_ART[owlState];
  const helperText =
    authState === 'submitting'
      ? 'Checking your credentials and preparing your workspace.'
      : authState === 'error'
        ? 'Your email or password needs another look.'
        : authState === 'success'
          ? 'Login complete. Redirecting to the dashboard.'
          : currentArt.copy;
  const statusTag =
    authState === 'submitting'
      ? 'Signing in'
      : authState === 'error'
        ? 'Try again'
        : authState === 'success'
          ? 'Success'
          : isIdle
            ? 'Idle'
            : activeField === 'password'
              ? 'Password'
              : activeField === 'email'
                ? 'Email'
                : 'Ready';
  const submitLabel =
    authState === 'submitting'
      ? 'Logging in...'
      : authState === 'success'
        ? 'Success'
        : 'Log in';
  const isBusy = authState === 'submitting' || authState === 'success';
  const cardStyle = {
    '--owl-accent': currentArt.accent,
    '--glow-x': `${cardTilt.glowX}%`,
    '--glow-y': `${cardTilt.glowY}%`,
    '--owl-x': `${cardTilt.owlX}px`,
    '--owl-y': `${cardTilt.owlY}px`,
    '--owl-rotate-x': `${cardTilt.rotateX * 0.45}deg`,
    '--owl-rotate-y': `${cardTilt.rotateY * 0.5}deg`,
    transformPerspective: 1500,
  } as CSSProperties;

  return (
    <div className="ls-login-page">
      <div className="ls-grid" aria-hidden="true" />
      <motion.div
        className="ls-floating-tag ls-floating-tag-left"
        initial={reduceMotion ? false : { opacity: 0, x: -32, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        Adaptive paths
      </motion.div>
      <motion.div
        className="ls-floating-tag ls-floating-tag-right"
        initial={reduceMotion ? false : { opacity: 0, x: 32, y: -8 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        AI study coach
      </motion.div>

      <motion.section
        className="ls-login-shell"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className={cn('ls-login-card', {
            'is-error': authState === 'error',
            'is-success': authState === 'success',
          })}
          style={cardStyle}
          onMouseMove={handleCardMouseMove}
          onMouseLeave={handleCardMouseLeave}
          animate={
            reduceMotion
              ? undefined
              : {
                rotateX: cardTilt.rotateX,
                rotateY: cardTilt.rotateY,
                scale: cardTilt.scale,
              }
          }
          transition={{ type: 'spring', stiffness: 140, damping: 18, mass: 0.8 }}
        >
          <div className="ls-card-noise" aria-hidden="true" />

          <header className="ls-card-header">
            <div className="ls-brand">
              <span className="ls-brand-mark" aria-hidden="true">
                <GraduationCap size={18} />
              </span>
              <span className="ls-brand-copy">
                <strong>LearnSphere AI</strong>
                <span>Smart sign in experience</span>
              </span>
            </div>

            <div className="ls-heading">
              <span className={cn('ls-status-pill', `is-${authState}`)}>{statusTag}</span>
              <h1>Welcome back</h1>
              <p>Log in to continue learning with your study owl beside you.</p>
            </div>
          </header>

          <section className={cn('ls-owl-panel', `is-${owlState}`)} aria-live="polite">
            <div className="ls-owl-aura" aria-hidden="true" />
            <div className="ls-owl-stage-floor" aria-hidden="true" />
            <div className="ls-owl-viewport">
              <div className="ls-owl-shadow" aria-hidden="true" />
              <div className="ls-owl-plinth" aria-hidden="true">
                <span className="ls-owl-plinth-top" />
                <span className="ls-owl-plinth-core" />
                <span className="ls-owl-plinth-glow" />
              </div>
              <div
                className={cn('ls-owl-stack', {
                  'is-sleeping': owlState === 'sleeping',
                })}
              >
                <div className="ls-owl-volume ls-owl-volume-back" aria-hidden="true" />
                <div className="ls-owl-volume ls-owl-volume-front" aria-hidden="true" />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={owlState}
                    className={cn('ls-owl-figure', `is-${owlState}`)}
                    initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.94, rotate: -3 }}
                    animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 1.03, rotate: 2 }}
                    transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <img
                      src={currentArt.src}
                      alt=""
                      aria-hidden="true"
                      className="ls-owl-image ls-owl-image-depth"
                      decoding="async"
                    />
                    <img
                      src={currentArt.src}
                      alt={currentArt.alt}
                      className="ls-owl-image ls-owl-image-main"
                      loading="eager"
                      decoding="async"
                      fetchPriority={owlState === 'neutral' ? 'high' : 'auto'}
                    />
                    <span className="ls-owl-image-shine" aria-hidden="true" />
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence>
                  {owlState === 'sleeping' && (
                    <motion.div
                      className="ls-sleep-note"
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.24 }}
                    >
                      z z z
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${owlState}-${authState}`}
                className="ls-owl-copy"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                <strong>{authState === 'submitting' ? 'Checking credentials' : currentArt.title}</strong>
                <p>{helperText}</p>
              </motion.div>
            </AnimatePresence>
          </section>

          <form ref={formRef} className="ls-form" onSubmit={handleLogin}>
            <div className={cn('ls-field', activeField === 'email' && 'is-active', email && 'is-filled')}>
              <Mail className="ls-field-icon" size={17} aria-hidden="true" />
              <input
                ref={emailInputRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="ls-input"
                value={email}
                onFocus={handleEmailFocus}
                onBlur={handleFieldBlur}
                onChange={handleEmailChange}
                onKeyUp={() => syncEmailDirection(emailInputRef.current)}
                onClick={() => syncEmailDirection(emailInputRef.current)}
                onSelect={() => syncEmailDirection(emailInputRef.current)}
                placeholder=" "
                required
                disabled={isBusy}
              />
              <label className="ls-label" htmlFor="email">
                Email
              </label>
            </div>

            <div className={cn('ls-field', activeField === 'password' && 'is-active', password && 'is-filled')}>
              <Lock className="ls-field-icon" size={17} aria-hidden="true" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="ls-input"
                value={password}
                onFocus={handlePasswordFocus}
                onBlur={handleFieldBlur}
                onChange={handlePasswordChange}
                placeholder=" "
                required
                disabled={isBusy}
              />
              <label className="ls-label" htmlFor="password">
                Password
              </label>
              <button
                type="button"
                className="ls-visibility-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isBusy}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {showPassword ? (
                    <motion.span
                      key="show"
                      initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                      transition={{ duration: 0.16 }}
                    >
                      <Eye size={16} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="hide"
                      initial={{ opacity: 0, scale: 0.8, rotate: 10 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.8, rotate: -10 }}
                      transition={{ duration: 0.16 }}
                    >
                      <EyeOff size={16} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>

            <div className="ls-form-meta">
              <Link to="/reset-password" className="ls-inline-link">
                Forgot password?
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>

            <button type="submit" className="ls-submit" disabled={isBusy}>
              {authState === 'submitting' && <Loader2 size={18} className="ls-spinner" aria-hidden="true" />}
              <span>{submitLabel}</span>
            </button>

            <div className="ls-divider" aria-hidden="true">
              <span />
              <small>or continue with</small>
              <span />
            </div>

            <div className="ls-provider-grid">
              <button type="button" className="ls-provider-button" onClick={() => void handleOAuth('google')} disabled={isBusy}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Google</span>
              </button>

              <button type="button" className="ls-provider-button" onClick={() => void handleOAuth('github')} disabled={isBusy}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .297C5.373.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.334-1.754-1.334-1.754-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297 24 5.67 18.627.297 12 .297Z" />
                </svg>
                <span>GitHub</span>
              </button>
            </div>

            <p className="ls-signup-note">
              New here? <Link to="/register">Create an account</Link>
            </p>
          </form>
        </motion.div>
      </motion.section>
    </div>
  );
}
