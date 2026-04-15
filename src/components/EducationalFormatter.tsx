import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Target,
  Zap,
  Trophy
} from 'lucide-react';

/**
 * Educational Formatting Components
 * Optimized for LearnSphere's learning context
 */

// Difficulty Level Indicator
interface DifficultyBadgeProps {
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  className?: string;
}

export function DifficultyBadge({ level, className }: DifficultyBadgeProps) {
  const config = {
    beginner: { color: 'bg-green-500/10 text-green-600 dark:text-green-400', label: 'Beginner', icon: '⭐' },
    intermediate: { color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', label: 'Intermediate', icon: '⭐⭐' },
    advanced: { color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', label: 'Advanced', icon: '⭐⭐⭐' },
    expert: { color: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'Expert', icon: '⭐⭐⭐⭐' },
  };

  const { color, label, icon } = config[level];

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', color, className)}>
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

// Learning Callout Box
interface CalloutBoxProps {
  type: 'tip' | 'warning' | 'info' | 'success' | 'concept' | 'exercise';
  title?: string;
  children: ReactNode;
  className?: string;
}

export function CalloutBox({ type, title, children, className }: CalloutBoxProps) {
  const config = {
    tip: {
      icon: Lightbulb,
      color: 'border-yellow-500/50 bg-yellow-500/5',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      defaultTitle: '💡 Pro Tip',
    },
    warning: {
      icon: AlertTriangle,
      color: 'border-orange-500/50 bg-orange-500/5',
      iconColor: 'text-orange-600 dark:text-orange-400',
      defaultTitle: '⚠️ Common Pitfall',
    },
    info: {
      icon: BookOpen,
      color: 'border-blue-500/50 bg-blue-500/5',
      iconColor: 'text-blue-600 dark:text-blue-400',
      defaultTitle: '📚 Key Concept',
    },
    success: {
      icon: CheckCircle2,
      color: 'border-green-500/50 bg-green-500/5',
      iconColor: 'text-green-600 dark:text-green-400',
      defaultTitle: '✅ Success Indicator',
    },
    concept: {
      icon: Brain,
      color: 'border-purple-500/50 bg-purple-500/5',
      iconColor: 'text-purple-600 dark:text-purple-400',
      defaultTitle: '🧠 Core Concept',
    },
    exercise: {
      icon: Target,
      color: 'border-pink-500/50 bg-pink-500/5',
      iconColor: 'text-pink-600 dark:text-pink-400',
      defaultTitle: '🎯 Try It Yourself',
    },
  };

  const { icon: Icon, color, iconColor, defaultTitle } = config[type];

  return (
    <div className={cn('my-4 rounded-lg border p-4', color, className)}>
      <div className="flex gap-3">
        <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', iconColor)} />
        <div className="flex-1 space-y-2">
          {title && (
            <div className="font-semibold text-sm">
              {title}
            </div>
          )}
          {!title && (
            <div className="font-semibold text-sm">
              {defaultTitle}
            </div>
          )}
          <div className="text-sm leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Progress Bar for Learning Paths
interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressBar({ progress, label, showPercentage = true, className }: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={cn('space-y-2', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-xs">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showPercentage && (
            <span className="font-medium text-foreground">{clampedProgress}%</span>
          )}
        </div>
      )}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

// Step-by-Step Instructions
interface StepItemProps {
  number: number;
  title: string;
  children: ReactNode;
  isCompleted?: boolean;
}

export function StepItem({ number, title, children, isCompleted }: StepItemProps) {
  return (
    <div className="flex gap-4 pb-6 last:pb-0 relative">
      {/* Connector Line */}
      <div className="absolute left-5 top-11 bottom-0 w-0.5 bg-border" />

      {/* Step Number */}
      <div className={cn(
        'relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0 font-semibold text-sm',
        isCompleted
          ? 'bg-green-500 text-white'
          : 'bg-primary text-primary-foreground'
      )}>
        {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : number}
      </div>

      {/* Content */}
      <div className="flex-1 pt-1.5 space-y-2">
        <h4 className="font-semibold text-base">{title}</h4>
        <div className="text-sm text-muted-foreground leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

// Quick Stats Display
interface StatCardProps {
  icon?: ReactNode;
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function StatCard({ icon, label, value, trend, className }: StatCardProps) {
  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border', className)}>
      {icon && (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold">{value}</div>
          {trend && (
            <span className={cn(
              'text-xs',
              trend === 'up' && 'text-green-600 dark:text-green-400',
              trend === 'down' && 'text-red-600 dark:text-red-400',
              trend === 'neutral' && 'text-muted-foreground'
            )}>
              {trend === 'up' && '↑'}
              {trend === 'down' && '↓'}
              {trend === 'neutral' && '→'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Learning Achievement Badge
interface AchievementProps {
  title: string;
  description: string;
  icon?: ReactNode;
  earned?: boolean;
  className?: string;
}

export function Achievement({ title, description, icon, earned = true, className }: AchievementProps) {
  return (
    <div className={cn(
      'flex items-start gap-3 p-4 rounded-lg border transition-colors',
      earned
        ? 'bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30'
        : 'bg-muted/30 border-border opacity-60',
      className
    )}>
      <div className={cn(
        'flex items-center justify-center w-12 h-12 rounded-full shrink-0',
        earned ? 'bg-gradient-to-br from-yellow-500 to-orange-500' : 'bg-muted'
      )}>
        {icon || <Trophy className="h-6 w-6 text-white" />}
      </div>
      <div className="flex-1 space-y-1">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

// Time Estimate Badge
interface TimeEstimateProps {
  minutes: number;
  className?: string;
}

export function TimeEstimate({ minutes, className }: TimeEstimateProps) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const display = hours > 0
    ? `${hours}h ${mins}m`
    : `${mins}m`;

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground', className)}>
      <Zap className="h-3 w-3" />
      <span>{display}</span>
    </span>
  );
}

// Code Comparison (Before/After)
interface CodeComparisonProps {
  before: string;
  after: string;
  language?: string;
  className?: string;
}

export function CodeComparison({ before, after, language = 'javascript', className }: CodeComparisonProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4 my-4', className)}>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
          <span>❌</span>
          <span>Before (Don't)</span>
        </div>
        <div className="rounded-md overflow-hidden border border-red-500/30">
          <pre className="p-4 bg-red-500/5 overflow-x-auto text-xs">
            <code className={`language-${language}`}>{before}</code>
          </pre>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
          <span>✅</span>
          <span>After (Do)</span>
        </div>
        <div className="rounded-md overflow-hidden border border-green-500/30">
          <pre className="p-4 bg-green-500/5 overflow-x-auto text-xs">
            <code className={`language-${language}`}>{after}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
