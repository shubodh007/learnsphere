import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Share2,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MessageActionsProps {
  content: string;
  messageId?: string;
  onRegenerate?: () => void;
  onFeedback?: (type: 'positive' | 'negative') => void;
  onBookmark?: () => void;
  className?: string;
}

export function MessageActions({
  content,
  messageId,
  onRegenerate,
  onFeedback,
  onBookmark,
  className,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [isReading, setIsReading] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Message copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy message to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'LearnSphere Message',
          text: content,
        });
      } catch (error) {
        // User cancelled share
      }
    } else {
      // Fallback to copy
      handleCopy();
      toast({
        title: 'Link copied',
        description: 'Share link copied to clipboard',
      });
    }
  };

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedback(type);
    onFeedback?.(type);
    toast({
      title: type === 'positive' ? 'Thanks for the feedback!' : 'Feedback received',
      description: type === 'positive'
        ? 'Glad this was helpful!'
        : 'We\'ll work on improving',
    });
  };

  const handleBookmark = () => {
    setBookmarked(!bookmarked);
    onBookmark?.();
    toast({
      title: bookmarked ? 'Bookmark removed' : 'Bookmarked!',
      description: bookmarked
        ? 'Message removed from bookmarks'
        : 'Message saved to bookmarks',
    });
  };

  const handleTextToSpeech = () => {
    if ('speechSynthesis' in window) {
      if (isReading) {
        window.speechSynthesis.cancel();
        setIsReading(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(content);
        utterance.onend = () => setIsReading(false);
        window.speechSynthesis.speak(utterance);
        setIsReading(true);
      }
    } else {
      toast({
        title: 'Not supported',
        description: 'Text-to-speech is not supported in your browser',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className={cn(
      'message-actions flex items-center gap-1',
      'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
      className
    )}>
      <TooltipProvider delayDuration={300}>
        {/* Copy */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 w-8 p-0 transition-all duration-150 active:scale-[0.88] hover:bg-white/5 hover:shadow-[0_0_8px_rgba(96,165,250,0.2)]"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[#34d399]" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-[#63636e] hover:text-[#a1a1aa]" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-[#2a2a2a] border-[#3a3a3a] text-white text-xs">
            <p>Copy message</p>
          </TooltipContent>
        </Tooltip>

        {/* Positive Feedback */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleFeedback('positive')}
              className={cn(
                'h-8 w-8 p-0 transition-all duration-150 active:scale-[0.88] hover:bg-white/5',
                feedback === 'positive' && 'text-[#34d399] bg-[rgba(52,211,153,0.1)]'
              )}
            >
              <ThumbsUp className={cn(
                'h-3.5 w-3.5',
                feedback === 'positive' ? 'text-[#34d399]' : 'text-[#63636e] hover:text-[#a1a1aa]'
              )} />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-[#2a2a2a] border-[#3a3a3a] text-white text-xs">
            <p>Helpful</p>
          </TooltipContent>
        </Tooltip>

        {/* Negative Feedback */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleFeedback('negative')}
              className={cn(
                'h-8 w-8 p-0 transition-all duration-150 active:scale-[0.88] hover:bg-white/5',
                feedback === 'negative' && 'text-[#f87171] bg-[rgba(248,113,113,0.1)]'
              )}
            >
              <ThumbsDown className={cn(
                'h-3.5 w-3.5',
                feedback === 'negative' ? 'text-[#f87171]' : 'text-[#63636e] hover:text-[#a1a1aa]'
              )} />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-[#2a2a2a] border-[#3a3a3a] text-white text-xs">
            <p>Not helpful</p>
          </TooltipContent>
        </Tooltip>

        {/* Divider */}
        <div className="w-px h-[18px] bg-[#1e1e1e] mx-1" />

        {/* Bookmark */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBookmark}
              className={cn(
                'h-8 w-8 p-0 transition-all duration-150 active:scale-[0.88] hover:bg-white/5',
                bookmarked && 'text-[#fb923c] bg-[rgba(251,146,60,0.1)]'
              )}
            >
              <Bookmark className={cn(
                'h-3.5 w-3.5',
                bookmarked ? 'text-[#fb923c] fill-current' : 'text-[#63636e] hover:text-[#a1a1aa]'
              )} />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-[#2a2a2a] border-[#3a3a3a] text-white text-xs">
            <p>{bookmarked ? 'Remove bookmark' : 'Bookmark'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Text to Speech */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTextToSpeech}
              className={cn(
                'h-8 w-8 p-0 transition-all duration-150 active:scale-[0.88] hover:bg-white/5',
                isReading && 'text-[#60a5fa] bg-[rgba(96,165,250,0.1)]'
              )}
            >
              <Volume2 className={cn(
                'h-3.5 w-3.5',
                isReading ? 'text-[#60a5fa]' : 'text-[#63636e] hover:text-[#a1a1aa]'
              )} />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-[#2a2a2a] border-[#3a3a3a] text-white text-xs">
            <p>{isReading ? 'Stop reading' : 'Read aloud'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Divider */}
        <div className="w-px h-[18px] bg-[#1e1e1e] mx-1" />

        {/* Regenerate */}
        {onRegenerate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRegenerate}
                className="h-8 w-8 p-0 transition-all duration-150 active:scale-[0.88] hover:bg-white/5"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#63636e] hover:text-[#a1a1aa]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-[#2a2a2a] border-[#3a3a3a] text-white text-xs">
              <p>Regenerate response</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Share */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="h-8 w-8 p-0 transition-all duration-150 active:scale-[0.88] hover:bg-white/5"
            >
              <Share2 className="h-3.5 w-3.5 text-[#63636e] hover:text-[#a1a1aa]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-[#2a2a2a] border-[#3a3a3a] text-white text-xs">
            <p>Share</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
