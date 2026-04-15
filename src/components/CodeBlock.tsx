import { useState, ReactNode } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  language: string;
  children: ReactNode;
  className?: string;
}

export function CodeBlock({ language, children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // Extract text content from children
    const codeElement = document.querySelector(`[data-code-id="${language}-${Date.now}"]`);
    const textContent = typeof children === 'string'
      ? children
      : (children as any)?.props?.children || '';

    try {
      await navigator.clipboard.writeText(String(textContent).replace(/\n$/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className={cn(
      'code-block-wrapper my-5 rounded-[10px] overflow-hidden',
      'border border-[#2d2d2d] bg-[#1e1e1e]',
      'shadow-[0_4px_12px_rgba(0,0,0,0.5)]',
      'transition-all duration-300 ease-out',
      'hover:shadow-[0_4px_12px_rgba(0,0,0,0.5),0_0_25px_rgba(96,165,250,0.08)]',
      'hover:border-[rgba(96,165,250,0.18)]',
      'group/codeblock',
      className
    )}>
      {/* Header Bar */}
      <div className="code-header flex items-center justify-between h-[42px] px-4 bg-[#252526] border-b border-[#2d2d2d]">
        {/* Language indicator with green pulse */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34d399] shadow-[0_0_6px_rgba(52,211,153,0.5)]"></span>
          </span>
          <span className="text-[0.73rem] font-mono font-medium text-[#63636e] lowercase tracking-wider">
            {language || 'text'}
          </span>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md',
            'text-[0.72rem] font-medium',
            'bg-white/5 border-0 cursor-pointer',
            'transition-all duration-150 ease-out',
            'opacity-0 group-hover/codeblock:opacity-100',
            'active:scale-[0.94]',
            copied
              ? 'text-[#34d399] bg-[rgba(52,211,153,0.1)]'
              : 'text-[#63636e] hover:text-[#a1a1aa] hover:bg-white/10'
          )}
        >
          <span className="relative w-[13px] h-[13px]">
            {copied ? (
              <Check className="w-[13px] h-[13px] animate-in fade-in-0 zoom-in-50 duration-150" />
            ) : (
              <Copy className="w-[13px] h-[13px]" />
            )}
          </span>
          <span>{copied ? 'Copied!' : 'Copy code'}</span>
        </button>
      </div>

      {/* Code Body */}
      <pre className={cn(
        'm-0 p-[18px_20px] overflow-x-auto bg-[#1e1e1e]',
        'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#333]'
      )}>
        <code className={cn(
          'font-mono text-[0.82rem] leading-[1.7] text-[#d4d4d4]',
          'whitespace-pre block',
          `language-${language}`
        )}>
          {children}
        </code>
      </pre>
    </div>
  );
}

// Inline code component
export function InlineCode({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code className={cn(
      'px-[7px] py-[2.5px]',
      'bg-[rgba(110,118,129,0.22)] dark:bg-[rgba(110,118,129,0.22)]',
      'border border-[rgba(110,118,129,0.12)]',
      'rounded-[5px]',
      'font-mono text-[0.84em] font-medium',
      'text-[#79c0ff]',
      'whitespace-nowrap',
      'transition-colors duration-150',
      'hover:bg-[rgba(110,118,129,0.32)]',
      className
    )}>
      {children}
    </code>
  );
}
