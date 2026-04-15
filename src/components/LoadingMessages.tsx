import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const loadingMessages = [
  // Technical Mischief
  "🔐 Bypassing NASA's firewall... (don't tell them)",
  "🎓 Infiltrating IIT databases for that premium knowledge...",
  "🤖 Hacking OpenAI's GPT-5 prototype... almost there...",
  "🧠 Borrowing Claude's secret sauce... Anthropic won't notice...",
  "⚡ Downloading Google's entire search index... 2% complete...",
  "🔬 Accessing MIT's restricted research papers...",
  "💎 Unlocking DeepMind's Alpha-Everything model...",
  "🚀 Tapping into SpaceX's Starlink for extra bandwidth...",
  "🏛️ Raiding the Library of Congress... digitally, of course...",
  "🎯 Convincing Stack Overflow to share all accepted answers...",

  // Absurd Humor
  "🧙 Consulting with ancient AI spirits... they're surprisingly helpful...",
  "🔮 Reading silicon tea leaves for better predictions...",
  "🎪 Teaching quantum computers to juggle your request...",
  "🍕 Bribing the server hamsters with premium pellets...",
  "🎵 Training neural networks to beatbox while processing...",
  "🎨 Convincing pixels to arrange themselves artistically...",
  "⏰ Negotiating with time itself for faster processing...",
  "🎭 Rehearsing the perfect response... method acting takes time...",
  "🌙 Downloading additional RAM from the moon...",
  "🎲 Rolling digital dice to determine optimal response...",

  // Self-Aware Meta
  "🤔 Pretending to think really hard about this...",
  "📚 Speed-reading the entire internet... again...",
  "🎯 Calculating the meaning of life... 42... wait, wrong question...",
  "⚙️ Warming up the hamster wheels... they demand breaks...",
  "🌟 Aligning chakras with data centers...",
  "🔥 Overclocking my coffee consumption for peak performance...",
  "🎪 Performing computational acrobatics...",
  "🌈 Rendering your thoughts in 4K resolution...",
];

export function LoadingMessages() {
  const [currentMessage, setCurrentMessage] = useState(
    loadingMessages[Math.floor(Math.random() * loadingMessages.length)]
  );
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    // Rotate messages every 3 seconds
    const interval = setInterval(() => {
      const nextIndex = (messageIndex + 1) % loadingMessages.length;
      setMessageIndex(nextIndex);
      setCurrentMessage(loadingMessages[nextIndex]);
    }, 3000);

    return () => clearInterval(interval);
  }, [messageIndex]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-muted rounded-lg">
      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
      <AnimatePresence mode="wait">
        <motion.div
          key={currentMessage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-muted-foreground"
        >
          {currentMessage}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
