import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  BookOpen,
  Code,
  Video,
  FileText,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface RelatedTopic {
  title: string;
  description?: string;
  type?: 'lesson' | 'tutorial' | 'video' | 'article' | 'exercise';
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  timeEstimate?: number;
  icon?: React.ReactNode;
  onClick?: () => void;
}

interface RelatedTopicsProps {
  topics: RelatedTopic[];
  title?: string;
  variant?: 'compact' | 'detailed';
  onTopicClick?: (topic: RelatedTopic) => void;
  className?: string;
}

export function RelatedTopics({
  topics,
  title = '🎯 Continue Learning',
  variant = 'detailed',
  onTopicClick,
  className,
}: RelatedTopicsProps) {
  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'lesson':
        return <BookOpen className="h-4 w-4" />;
      case 'tutorial':
        return <Code className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'article':
        return <FileText className="h-4 w-4" />;
      case 'exercise':
        return <Sparkles className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'text-green-600 dark:text-green-400';
      case 'intermediate':
        return 'text-blue-600 dark:text-blue-400';
      case 'advanced':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const handleTopicClick = (topic: RelatedTopic) => {
    topic.onClick?.();
    onTopicClick?.(topic);
  };

  if (variant === 'compact') {
    return (
      <div className={cn('space-y-2', className)}>
        {title && (
          <h4 className="text-sm font-semibold text-muted-foreground">{title}</h4>
        )}
        <div className="flex flex-wrap gap-2">
          {topics.map((topic, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              onClick={() => handleTopicClick(topic)}
              className="text-xs h-7 gap-1.5"
            >
              {topic.icon || getTypeIcon(topic.type)}
              <span>{topic.title}</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {title && (
        <h4 className="text-base font-semibold flex items-center gap-2">
          <span>{title}</span>
        </h4>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {topics.map((topic, idx) => (
          <button
            key={idx}
            onClick={() => handleTopicClick(topic)}
            className={cn(
              'group flex items-start gap-3 p-3 rounded-lg border border-border',
              'bg-card hover:bg-muted/50 transition-colors text-left'
            )}
          >
            {/* Icon */}
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <span className="text-primary">
                {topic.icon || getTypeIcon(topic.type)}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h5 className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">
                  {topic.title}
                </h5>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
              </div>

              {topic.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {topic.description}
                </p>
              )}

              {/* Meta info */}
              {(topic.difficulty || topic.timeEstimate || topic.type) && (
                <div className="flex items-center gap-2 text-xs">
                  {topic.type && (
                    <span className="text-muted-foreground capitalize">
                      {topic.type}
                    </span>
                  )}
                  {topic.difficulty && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className={getDifficultyColor(topic.difficulty)}>
                        {topic.difficulty}
                      </span>
                    </>
                  )}
                  {topic.timeEstimate && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">
                        {topic.timeEstimate}m
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Learning Path component - shows a sequence of topics
interface LearningPathProps {
  title?: string;
  topics: RelatedTopic[];
  currentIndex?: number;
  onTopicClick?: (topic: RelatedTopic, index: number) => void;
  className?: string;
}

export function LearningPath({
  title = '📚 Your Learning Path',
  topics,
  currentIndex = 0,
  onTopicClick,
  className,
}: LearningPathProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {title && (
        <h4 className="text-base font-semibold">{title}</h4>
      )}

      <div className="relative space-y-0">
        {/* Progress line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

        {topics.map((topic, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isLocked = idx > currentIndex;

          return (
            <div key={idx} className="relative pb-6 last:pb-0">
              {/* Step indicator */}
              <div className="flex gap-4 items-start">
                <div
                  className={cn(
                    'relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors',
                    isCompleted && 'bg-green-500 border-green-500',
                    isCurrent && 'bg-primary border-primary',
                    isLocked && 'bg-muted border-border'
                  )}
                >
                  {isCompleted ? (
                    <span className="text-white text-sm">✓</span>
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        isCurrent && 'text-primary-foreground',
                        isLocked && 'text-muted-foreground'
                      )}
                    >
                      {idx + 1}
                    </span>
                  )}
                </div>

                {/* Content */}
                <button
                  onClick={() => !isLocked && onTopicClick?.(topic, idx)}
                  disabled={isLocked}
                  className={cn(
                    'flex-1 text-left p-3 rounded-lg border transition-colors',
                    !isLocked && 'hover:bg-muted/50 cursor-pointer',
                    isLocked && 'opacity-50 cursor-not-allowed',
                    isCurrent && 'border-primary bg-primary/5'
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-sm font-medium">{topic.title}</h5>
                      {topic.timeEstimate && (
                        <span className="text-xs text-muted-foreground">
                          {topic.timeEstimate}m
                        </span>
                      )}
                    </div>

                    {topic.description && (
                      <p className="text-xs text-muted-foreground">
                        {topic.description}
                      </p>
                    )}

                    {isCurrent && (
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <span>In Progress</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    )}

                    {isCompleted && (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        Completed ✓
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Next Step Suggestion Component
interface NextStepProps {
  title: string;
  description: string;
  action: string;
  onAction: () => void;
  className?: string;
}

export function NextStep({
  title,
  description,
  action,
  onAction,
  className,
}: NextStepProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-4 p-4 rounded-lg',
        'bg-gradient-to-r from-primary/10 to-purple-500/10',
        'border border-primary/20',
        className
      )}
    >
      <div className="flex-1 space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {title}
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      <Button
        size="sm"
        onClick={onAction}
        className="gradient-bg border-0 shrink-0"
      >
        {action}
        <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
