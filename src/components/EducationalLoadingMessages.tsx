import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { chatConfig } from '@/config/chat-config';

const loadingMessages = [
  "\u{1F510} Borrowing a few secrets from NASA's mainframe...",
  '\u{1F393} Sneaking through the MIT archives for better ideas...',
  '\u{1F9EA} Mixing code, caffeine, and just enough chaos...',
  '\u{1F916} Negotiating with the robots for a sharper answer...',
  '\u{1F680} Pulling extra bandwidth from a passing satellite...',
  '\u{1F9E0} Untangling the logic so the answer lands cleanly...',
  '\u{1F3AF} Calibrating the response for speed and clarity...',
  '\u{1F4DA} Speed-reading the internet one useful page at a time...',
  '\u{26A1} Tightening a few loose bits before sending this back...',
  '\u{1F3A8} Polishing the wording so it feels more human...',
  '\u{1F50D} Looking for the bug before the bug looks for us...',
  '\u{1F6E0}\u{FE0F} Turning rough thoughts into a usable answer...',
];

function getNextMessage(previous: string) {
  let next = previous;

  while (next === previous) {
    next = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
  }

  return next;
}

export function EducationalLoadingMessages() {
  const [currentMessage, setCurrentMessage] = useState(
    loadingMessages[Math.floor(Math.random() * loadingMessages.length)]
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentMessage((previous) => getNextMessage(previous));
    }, chatConfig.loading.rotationSpeed);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300" />
        Thinking
      </div>
      <p className="text-sm leading-7 text-zinc-300">{currentMessage}</p>
    </div>
  );
}

export function QuickLoader() {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
      <Loader2 className="h-3 w-3 animate-spin text-primary" />
      <span className="text-xs text-muted-foreground">Thinking...</span>
    </div>
  );
}
