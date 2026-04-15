import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Bot, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MessageActions } from './MessageActions';
import { DifficultyBadge, TimeEstimate } from './EducationalFormatter';

interface ChatMessageProps {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  timeEstimate?: number;
  showActions?: boolean;
  onRegenerate?: () => void;
  onFeedback?: (type: 'positive' | 'negative') => void;
  onBookmark?: () => void;
  customAvatar?: ReactNode;
  className?: string;
}

export function ChatMessage({
  id,
  role,
  content,
  timestamp,
  difficulty,
  timeEstimate,
  showActions = true,
  onRegenerate,
  onFeedback,
  onBookmark,
  customAvatar,
  className,
}: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-3 group',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
    >
      {/* Avatar - Left side for assistant */}
      {!isUser && (
        <div className="shrink-0">
          {customAvatar || (
            <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
        </div>
      )}

      {/* Message Content */}
      <div
        className={cn(
          'flex flex-col gap-2',
          isUser ? 'items-end max-w-[80%]' : 'items-start max-w-[85%]'
        )}
      >
        {/* Metadata badges for assistant messages */}
        {!isUser && (difficulty || timeEstimate) && (
          <div className="flex gap-2">
            {difficulty && <DifficultyBadge level={difficulty} />}
            {timeEstimate && <TimeEstimate minutes={timeEstimate} />}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            'rounded-lg text-sm',
            isUser
              ? 'bg-primary text-primary-foreground px-4 py-3'
              : 'bg-muted text-foreground px-5 py-4'
          )}
        >
          {isUser ? (
            <div className="leading-relaxed">{content}</div>
          ) : (
            <MarkdownRenderer content={content || '...'} />
          )}
        </div>

        {/* Actions bar for assistant messages */}
        {!isUser && showActions && content && (
          <MessageActions
            content={content}
            messageId={id}
            onRegenerate={onRegenerate}
            onFeedback={onFeedback}
            onBookmark={onBookmark}
          />
        )}

        {/* Timestamp */}
        {timestamp && (
          <div className="text-xs text-muted-foreground px-1">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* Avatar - Right side for user */}
      {isUser && (
        <div className="shrink-0">
          {customAvatar || (
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
              <UserIcon className="h-4 w-4 text-secondary-foreground" />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// Typing indicator component
export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center shrink-0">
        <Bot className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="bg-muted rounded-lg px-4 py-3">
        <div className="flex gap-1">
          <motion.div
            className="w-2 h-2 bg-muted-foreground/50 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0 }}
          />
          <motion.div
            className="w-2 h-2 bg-muted-foreground/50 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
          />
          <motion.div
            className="w-2 h-2 bg-muted-foreground/50 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
          />
        </div>
      </div>
    </div>
  );
}
