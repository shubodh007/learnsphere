import { CSSProperties, ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, GraduationCap, Loader2, Lock, Mail, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import './Login.css';

type AuthState = 'idle' | 'submitting' | 'error' | 'success';
type ActiveField = 'fullName' | 'email' | 'password' | null;

const SUCCESS_REDIRECT_DELAY = 1200;

const REGISTER_ART: Record<
  AuthState,
  {
    src: string;
    alt: string;
    title: string;
    copy: string;
    accent: string;
    owlClass: 'neutral' | 'covering' | 'sad' | 'happy';
  }
> = {
  idle: {
    src: '/login-art/fast/neutral.jpg',
    alt: 'A neutral owl waiting beside the sign up form',
    title: 'Ready to onboard',
    copy: 'Create your account and begin your personalized learning path.',
    accent: 'rgba(99, 102, 241, 0.56)',
    owlClass: 'neutral',
  },
  submitting: {
    src: '/login-art/fast/covering.jpg',
    alt: 'An owl focused while account details are being processed',
    title: 'Setting things up',
    copy: 'Creating your account and preparing your starter dashboard.',
    accent: 'rgba(56, 189, 248, 0.58)',
    owlClass: 'covering',
  },
  error: {
    src: '/login-art/fast/sad.jpg',
    alt: 'A sad owl indicating there was an issue during sign up',
    title: 'Needs another try',
    copy: 'Please review your details and submit again.',
    accent: 'rgba(244, 63, 94, 0.56)',
    owlClass: 'sad',
  },
  success: {
    src: '/login-art/fast/happy.jpg',
    alt: 'A happy owl celebrating a successful account creation',
    title: 'Account created',
    copy: 'Check your email for the confirmation link, then sign in.',
    accent: 'rgba(16, 185, 129, 0.58)',
    owlClass: 'happy',
  },
};

export default function Register() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { toast } = useToast();
  const { signUpWithEmail, signInWithOAuth } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [activeField, setActiveField] = useState<ActiveField>(null);

  const successTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }
    },
    [],
  );

  function clearErrorState() {
    if (authState === 'error') {
      setAuthState('idle');
    }
  }

  function handleFieldBlur() {
    setActiveField(null);
  }

  function handleFullNameChange(event: ChangeEvent<HTMLInputElement>) {
    clearErrorState();
    setFullName(event.target.value);
  }

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    clearErrorState();
    setEmail(event.target.value);
  }

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    clearErrorState();
    setPassword(event.target.value);
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authState === 'submitting' || authState === 'success') {
      return;
    }

    if (password.length < 8) {
      setAuthState('error');
      toast({
        title: 'Password too short',
        description: 'Use at least 8 characters for your password.',
        variant: 'destructive',
      });
      return;
    }

    setAuthState('submitting');
    setActiveField(null);

    const { error } = await signUpWithEmail(email, password, fullName);

    if (error) {
      setAuthState('error');
      toast({
        title: 'Sign up failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setAuthState('success');
    toast({
      title: 'Account created',
      description: 'Check your email for a confirmation link.',
    });

    successTimerRef.current = window.setTimeout(() => {
      navigate('/login');
    }, reduceMotion ? 250 : SUCCESS_REDIRECT_DELAY);
  }

  async function handleOAuth(provider: 'google' | 'github') {
    clearErrorState();
    setAuthState('submitting');

    try {
      await signInWithOAuth(provider);
    } catch (error) {
      setAuthState('error');
      toast({
        title: 'OAuth sign up failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setAuthState('idle');
  }

  const currentArt = REGISTER_ART[authState];
  const statusTag =
    authState === 'submitting'
      ? 'Creating'
      : authState === 'error'
        ? 'Try again'
        : authState === 'success'
          ? 'Success'
          : 'Ready';
  const submitLabel =
    authState === 'submitting'
      ? 'Creating account...'
      : authState === 'success'
        ? 'Success'
        : 'Create account';
  const isBusy = authState === 'submitting' || authState === 'success';
  const cardStyle = {
    '--owl-accent': currentArt.accent,
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
        Guided onboarding
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
        >
          <div className="ls-card-noise" aria-hidden="true" />

          <header className="ls-card-header">
            <div className="ls-brand">
              <span className="ls-brand-mark" aria-hidden="true">
                <GraduationCap size={18} />
              </span>
              <span className="ls-brand-copy">
                <strong>LearnSphere AI</strong>
                <span>Smart sign up experience</span>
              </span>
            </div>

            <div className="ls-heading">
              <span className={cn('ls-status-pill', `is-${authState}`)}>{statusTag}</span>
              <h1>Create account</h1>
              <p>Sign up to start learning with the same guided experience as sign in.</p>
            </div>
          </header>

          <section className={cn('ls-owl-panel', `is-${currentArt.owlClass}`)} aria-live="polite">
            <div className="ls-owl-aura" aria-hidden="true" />
            <div className="ls-owl-stage-floor" aria-hidden="true" />
            <div className="ls-owl-viewport">
              <div className="ls-owl-shadow" aria-hidden="true" />
              <div className="ls-owl-plinth" aria-hidden="true">
                <span className="ls-owl-plinth-top" />
                <span className="ls-owl-plinth-core" />
                <span className="ls-owl-plinth-glow" />
              </div>
              <div className="ls-owl-stack">
                <div className="ls-owl-volume ls-owl-volume-back" aria-hidden="true" />
                <div className="ls-owl-volume ls-owl-volume-front" aria-hidden="true" />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={authState}
                    className={cn('ls-owl-figure', `is-${currentArt.owlClass}`)}
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
                    />
                    <span className="ls-owl-image-shine" aria-hidden="true" />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={authState}
                className="ls-owl-copy"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                <strong>{currentArt.title}</strong>
                <p>{currentArt.copy}</p>
              </motion.div>
            </AnimatePresence>
          </section>

          <form className="ls-form" onSubmit={handleRegister}>
            <div className={cn('ls-field', activeField === 'fullName' && 'is-active', fullName && 'is-filled')}>
              <User className="ls-field-icon" size={17} aria-hidden="true" />
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                className="ls-input"
                value={fullName}
                onFocus={() => setActiveField('fullName')}
                onBlur={handleFieldBlur}
                onChange={handleFullNameChange}
                placeholder=" "
                required
                disabled={isBusy}
              />
              <label className="ls-label" htmlFor="fullName">
                Full name
              </label>
            </div>

            <div className={cn('ls-field', activeField === 'email' && 'is-active', email && 'is-filled')}>
              <Mail className="ls-field-icon" size={17} aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="ls-input"
                value={email}
                onFocus={() => setActiveField('email')}
                onBlur={handleFieldBlur}
                onChange={handleEmailChange}
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
                autoComplete="new-password"
                className="ls-input"
                value={password}
                onFocus={() => setActiveField('password')}
                onBlur={handleFieldBlur}
                onChange={handlePasswordChange}
                placeholder=" "
                required
                disabled={isBusy}
              />
              <label className="ls-label" htmlFor="password">
                Password (min 8 chars)
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
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </form>
        </motion.div>
      </motion.section>
    </div>
  );
}
