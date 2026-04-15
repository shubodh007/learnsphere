import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Brain,
  Copy,
  Gauge,
  History,
  ImagePlus,
  Library,
  Loader2,
  MoreVertical,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  StopCircle,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { EducationalLoadingMessages } from '@/components/EducationalLoadingMessages';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { chatConfig } from '@/config/chat-config';

type ChatMode = 'fast' | 'balanced' | 'deep';
type SidebarTab = 'library' | 'recents';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

interface ConversationSummary {
  id: string;
  title: string | null;
  message_count: number | null;
  last_message_at: string | null;
  created_at: string | null;
}

const modeOptions: Array<{ value: ChatMode; label: string; icon: typeof Zap }> = [
  { value: 'fast', label: 'Fast', icon: Zap },
  { value: 'balanced', label: 'Balanced', icon: Gauge },
  { value: 'deep', label: 'Deep', icon: Brain },
];

const suggestionCards = [
  {
    title: 'Service Discovery Patterns',
    body: 'Explore decentralized registry options for high-scale clusters.',
    prompt: 'Explain service discovery patterns for high-scale microservices.',
  },
  {
    title: 'Latency Specs',
    body: 'Review gRPC vs WebSockets for low-latency streaming.',
    prompt: 'Compare gRPC vs WebSockets for low-latency data streams.',
  },
];

const promptSuggestions = chatConfig.suggestedPrompts.prompts.slice(0, 4);

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

function formatConversationTime(value?: string | null) {
  if (!value) return 'No activity yet';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No activity yet';

  return new Intl.DateTimeFormat([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function toTimestamp(value: string | null) {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function toMessagePreview(content: string) {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= 76) return compact;
  return compact.slice(0, 73) + '...';
}

export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id: routeConversationId } = useParams<{ id?: string }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isConversationsLoading, setIsConversationsLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('recents');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [streamStatus, setStreamStatus] = useState('');
  const [pendingAttachmentNames, setPendingAttachmentNames] = useState<string[]>([]);
  const [mode, setMode] = useState<ChatMode>(() => {
    if (typeof window === 'undefined') return 'balanced';
    const savedMode = window.localStorage.getItem('learnsphere-chat-mode');
    return savedMode === 'fast' || savedMode === 'deep' || savedMode === 'balanced'
      ? savedMode
      : 'balanced';
  });

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastLoadedConversationIdRef = useRef<string | null>(null);

  const userLabel =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'Learner';

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant' && message.content.trim()),
    [messages]
  );

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.trim().toLowerCase();
    return conversations.filter((item) => {
      const title = (item.title || '').toLowerCase();
      return title.includes(query);
    });
  }, [conversations, searchQuery]);

  useEffect(() => {
    window.localStorage.setItem('learnsphere-chat-mode', mode);
  }, [mode]);

  useEffect(() => {
    const root = scrollViewportRef.current;
    if (!root) return;

    const handleScroll = () => {
      const distanceFromBottom = root.scrollHeight - root.scrollTop - root.clientHeight;
      setShowScrollToLatest(distanceFromBottom > 220);
    };

    handleScroll();
    root.addEventListener('scroll', handleScroll);
    return () => root.removeEventListener('scroll', handleScroll);
  }, [messages.length]);

  useEffect(() => {
    if (showScrollToLatest && !isLoading) return;

    scrollAnchorRef.current?.scrollIntoView({
      behavior: messages.length > 1 ? 'smooth' : 'auto',
      block: 'end',
    });
  }, [messages, isLoading, showScrollToLatest]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [input]);

  useEffect(() => {
    if (!showMoreMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current?.contains(event.target as Node)) return;
      setShowMoreMenu(false);
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  const loadConversations = async () => {
    if (!user) return;

    setIsConversationsLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, message_count, last_message_at, created_at')
        .order('last_message_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(40);

      if (error) throw error;
      setConversations((data as ConversationSummary[]) || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast({
        title: 'Could not load recents',
        description: 'Try refreshing in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsConversationsLoading(false);
    }
  };

  const startNewChat = (replaceRoute: boolean = true) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setConversationId(null);
    setInput('');
    setIsLoading(false);
    setIsHistoryLoading(false);
    setStreamStatus('');
    setPendingAttachmentNames([]);
    lastLoadedConversationIdRef.current = null;

    if (replaceRoute) {
      navigate('/chat', { replace: true });
    }
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setStreamStatus('');
  };

  const loadConversationMessages = async (targetConversationId: string, fromRoute: boolean = false) => {
    if (!user) return;
    if (!targetConversationId) return;

    if (lastLoadedConversationIdRef.current === targetConversationId && conversationId === targetConversationId) {
      if (!fromRoute) {
        navigate(`/chat/${targetConversationId}`, { replace: true });
      }
      return;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setIsHistoryLoading(true);
    setShowMoreMenu(false);
    setSidebarTab('recents');
    setPendingAttachmentNames([]);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', targetConversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mapped = ((data || []) as Array<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        created_at: string | null;
      }>).map((item) => ({
        id: item.id,
        role: item.role,
        content: item.content,
        createdAt: toTimestamp(item.created_at),
      }));

      setMessages(mapped);
      setConversationId(targetConversationId);
      lastLoadedConversationIdRef.current = targetConversationId;

      if (!fromRoute) {
        navigate(`/chat/${targetConversationId}`, { replace: true });
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast({
        title: 'Could not open conversation',
        description: 'Please try another one from recents.',
        variant: 'destructive',
      });
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void loadConversations();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    if (!routeConversationId) {
      if (conversationId) {
        startNewChat(false);
      }
      return;
    }

    if (routeConversationId === conversationId && lastLoadedConversationIdRef.current === routeConversationId) {
      return;
    }

    void loadConversationMessages(routeConversationId, true);
  }, [routeConversationId, user]);

  const handleSearchClick = () => {
    setSidebarTab('recents');
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const handleAttachmentPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setPendingAttachmentNames((previous) => {
      const merged = Array.from(new Set([...previous, ...files.map((file) => file.name)]));
      return merged.slice(0, 8);
    });

    event.target.value = '';
  };

  const removeAttachment = (name: string) => {
    setPendingAttachmentNames((previous) => previous.filter((item) => item !== name));
  };

  const copyLatest = async () => {
    if (!latestAssistantMessage) return;

    try {
      await navigator.clipboard.writeText(latestAssistantMessage.content);
      toast({
        title: 'Copied',
        description: 'Latest response copied to clipboard.',
      });
      setShowMoreMenu(false);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Clipboard is unavailable in this context.',
        variant: 'destructive',
      });
    }
  };

  const sendMessage = async (text?: string) => {
    const baseContent = (text || input).trim();
    const attachments = [...pendingAttachmentNames];
    const attachmentNote = attachments.length
      ? `\n\nAttached file names:\n- ${attachments.join('\n- ')}`
      : '';

    const outboundContent = `${baseContent || 'Please help me with the attached files.'}${attachmentNote}`.trim();
    if (!outboundContent || !user || isLoading) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timestamp = Date.now();
    const assistantMsgId = (timestamp + 1).toString();
    const displayUserContent = `${baseContent || 'Shared attachment context.'}${
      attachments.length ? `\n\nAttached:\n- ${attachments.join('\n- ')}` : ''
    }`;

    setInput('');
    setPendingAttachmentNames([]);
    setMessages((prev) => [
      ...prev,
      { id: timestamp.toString(), role: 'user', content: displayUserContent, createdAt: timestamp },
      { id: assistantMsgId, role: 'assistant', content: '', createdAt: timestamp + 1 },
    ]);
    setIsLoading(true);
    setStreamStatus('initializing');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const maxHistory = Math.max(2, Math.min(chatConfig.performance.maxHistoryMessages || 10, 12));
      const history = messages.slice(-maxHistory).map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: outboundContent,
          conversationId,
          history,
          mode,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send message');
      }

      const headerConversationId = response.headers.get('X-Conversation-Id');
      if (headerConversationId) {
        setConversationId(headerConversationId);
        lastLoadedConversationIdRef.current = headerConversationId;
        if (routeConversationId !== headerConversationId) {
          navigate(`/chat/${headerConversationId}`, { replace: true });
        }
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        throw new Error('No response stream available');
      }

      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventChunk of events) {
          const lines = eventChunk.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const payload = trimmed.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;

            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(payload) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (typeof parsed.error === 'string') {
              throw new Error(parsed.error);
            }

            if (typeof parsed.status === 'string') {
              setStreamStatus(parsed.status);
            }

            if (typeof parsed.conversationId === 'string') {
              const streamConversationId = parsed.conversationId;
              setConversationId(streamConversationId);
              lastLoadedConversationIdRef.current = streamConversationId;
              if (routeConversationId !== streamConversationId) {
                navigate(`/chat/${streamConversationId}`, { replace: true });
              }
            }

            if (typeof parsed.delta === 'string' && parsed.delta) {
              fullContent += parsed.delta;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantMsgId
                    ? { ...message, content: fullContent }
                    : message
                )
              );
            }
          }
        }
      }
    } catch (error) {
      const isAborted = error instanceof DOMException && error.name === 'AbortError';

      if (!isAborted) {
        console.error('Chat error:', error);
        setMessages((prev) => {
          const target = prev.find((message) => message.id === assistantMsgId);
          if (target && !target.content.trim()) {
            return prev.filter((message) => message.id !== assistantMsgId);
          }
          return prev;
        });

        toast({
          title: 'Chat unavailable',
          description: error instanceof Error ? error.message : 'Please try again in a few seconds.',
          variant: 'destructive',
        });
      } else {
        setMessages((prev) => {
          const target = prev.find((message) => message.id === assistantMsgId);
          if (target && !target.content.trim()) {
            return prev.filter((message) => message.id !== assistantMsgId);
          }
          return prev;
        });
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
      setStreamStatus('');
      void loadConversations();
    }
  };

  return (
    <div className="relative flex h-[calc(100vh-64px)] min-h-0 flex-col overflow-hidden bg-[#11131c] text-[#e1e1ef] md:h-screen">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#11131c]/85 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <span className="text-lg font-extrabold tracking-tight text-[#e1e1ef] sm:text-xl">Luminous</span>
            <nav className="hidden items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1 md:flex">
              {modeOptions.map((option) => {
                const Icon = option.icon;
                const active = mode === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMode(option.value)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                      active
                        ? 'bg-[#282933] text-[#bac3ff]'
                        : 'text-white/55 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2" ref={moreMenuRef}>
            <button
              type="button"
              onClick={handleSearchClick}
              className="rounded-lg p-2 text-[#bac3ff] transition-colors hover:bg-white/10"
              aria-label="Search recent conversations"
            >
              <Search className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className="rounded-lg p-2 text-[#bac3ff] transition-colors hover:bg-white/10"
              aria-label="More actions"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {showMoreMenu ? (
              <div className="absolute right-4 top-14 z-40 w-56 rounded-xl border border-white/10 bg-[#1b1d28] p-2 shadow-2xl">
                <button
                  type="button"
                  onClick={copyLatest}
                  disabled={!latestAssistantMessage}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Copy className="h-4 w-4" />
                  Copy latest response
                </button>
                <button
                  type="button"
                  onClick={() => {
                    startNewChat();
                    setShowMoreMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10"
                >
                  <Plus className="h-4 w-4" />
                  Start new chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    void loadConversations();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10"
                >
                  <History className="h-4 w-4" />
                  Refresh recents
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-[#191b24] lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-4 py-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#282933] text-sm font-semibold text-[#bac3ff]">
                {userLabel.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-[#bac3ff]">{userLabel}</h3>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Premium Tier</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => startNewChat()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#bac3ff] to-[#4d5fc4] px-4 py-3 text-sm font-bold text-[#11131c] transition-transform active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </button>
          </div>

          <div className="flex flex-col gap-2 p-3">
            <button
              type="button"
              onClick={() => {
                setSidebarTab('library');
                navigate('/learn');
              }}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                sidebarTab === 'library'
                  ? 'bg-[#282933] text-[#bac3ff]'
                  : 'text-white/65 hover:bg-white/5 hover:text-white'
              )}
            >
              <Library className="h-4 w-4" />
              Library
            </button>

            <button
              type="button"
              onClick={() => setSidebarTab('recents')}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                sidebarTab === 'recents'
                  ? 'bg-[#282933] text-[#bac3ff]'
                  : 'text-white/65 hover:bg-white/5 hover:text-white'
              )}
            >
              <History className="h-4 w-4" />
              Recents
            </button>

            <div className="mt-2 rounded-xl border border-white/10 bg-[#11131c]/80 px-3 py-2">
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search recents"
                className="w-full bg-transparent text-xs text-white placeholder:text-white/35 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {isConversationsLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/60">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading recents...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/55">
                No conversation history found.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredConversations.map((item) => {
                  const active = item.id === conversationId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void loadConversationMessages(item.id)}
                      className={cn(
                        'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                        active
                          ? 'border-[#bac3ff]/40 bg-[#282933]'
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.08]'
                      )}
                    >
                      <p className="line-clamp-2 text-xs font-semibold text-white/90">
                        {item.title?.trim() || 'Untitled conversation'}
                      </p>
                      <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/45">
                        {formatConversationTime(item.last_message_at || item.created_at)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#11131c]">
          <div
            ref={scrollViewportRef}
            className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {isHistoryLoading ? (
              <div className="mx-auto flex max-w-4xl items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-8 text-sm text-white/70">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading conversation...
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 pt-8">
                <div className="text-center">
                  <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                    How can I assist your workflow today?
                  </h1>
                  <p className="mx-auto mt-4 max-w-2xl text-base text-white/55">
                    Select a conductor mode and start orchestrating your ideas.
                  </p>
                </div>

                <div className="mx-auto grid w-full max-w-3xl gap-3 sm:grid-cols-2">
                  {promptSuggestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-4 text-left text-sm text-white/80 transition-colors hover:border-[#9cf0ff]/30 hover:bg-white/[0.07]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="mx-auto grid w-full max-w-4xl gap-4 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => void sendMessage(suggestionCards[0].prompt)}
                    className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 text-left transition-colors hover:border-[#9cf0ff]/30 md:col-span-2"
                  >
                    <Sparkles className="mb-3 h-4 w-4 text-[#f9abff]" />
                    <h3 className="text-lg font-bold text-white">{suggestionCards[0].title}</h3>
                    <p className="mt-2 text-xs text-white/60">{suggestionCards[0].body}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => void sendMessage(suggestionCards[1].prompt)}
                    className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 text-left transition-colors hover:border-[#9cf0ff]/30"
                  >
                    <Zap className="mb-3 h-4 w-4 text-[#9cf0ff]" />
                    <h3 className="text-lg font-bold text-white">{suggestionCards[1].title}</h3>
                    <p className="mt-2 text-xs text-white/60">{suggestionCards[1].body}</p>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-4">
                {messages.map((message) => {
                  const isUser = message.role === 'user';
                  const isThinking = message.role === 'assistant' && !message.content && isLoading;

                  return (
                    <div key={message.id} className={cn('flex gap-4', isUser ? 'justify-end' : 'justify-start')}>
                      {isUser ? (
                        <div className="max-w-[min(82%,760px)] rounded-[1.5rem_1.5rem_0.35rem_1.5rem] bg-gradient-to-br from-[#00e3fd] to-[#00daf3] px-5 py-4 text-sm font-medium leading-7 text-[#00121f] shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
                          <div className="whitespace-pre-wrap">{message.content}</div>
                          <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[#00363d]/70">
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#32343e]/70 text-[#9cf0ff] sm:flex">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div className="max-w-[min(88%,780px)] space-y-2">
                            <div className="rounded-[1.5rem_1.5rem_1.5rem_0.35rem] border border-white/10 bg-[#32343e]/45 px-5 py-5 backdrop-blur-2xl">
                              {isThinking ? (
                                <div className="space-y-4">
                                  <div className="inline-flex items-center gap-2 rounded-full border border-[#9cf0ff]/30 bg-[#9cf0ff]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9cf0ff]">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    {streamStatus ? streamStatus.replace(/_/g, ' ') : 'Synthesizing'}
                                  </div>
                                  <EducationalLoadingMessages />
                                </div>
                              ) : (
                                <MarkdownRenderer content={message.content} className="max-w-none" />
                              )}
                            </div>
                            <p className="px-2 text-[10px] uppercase tracking-[0.14em] text-white/35">
                              {formatTime(message.createdAt)} • System Conductor
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                <div ref={scrollAnchorRef} />
              </div>
            )}
          </div>

          {showScrollToLatest ? (
            <div className="pointer-events-none absolute bottom-40 right-5 z-20 sm:bottom-44 sm:right-8">
              <button
                type="button"
                onClick={() =>
                  scrollAnchorRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end',
                  })
                }
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-xl transition-colors hover:bg-black/80"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                Latest
              </button>
            </div>
          ) : null}

          <div className="relative border-t border-white/10 bg-gradient-to-t from-[#11131c] to-[#11131c]/80 p-4 sm:p-6">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleAttachmentPick}
              className="hidden"
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleAttachmentPick}
              className="hidden"
            />

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
              className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[#32343e]/40 p-2 shadow-[0_20px_40px_rgba(0,0,0,0.4)] backdrop-blur-3xl"
            >
              {pendingAttachmentNames.length ? (
                <div className="mb-2 flex flex-wrap gap-2 px-2 pt-1">
                  {pendingAttachmentNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/85"
                    >
                      {toMessagePreview(name)}
                      <button
                        type="button"
                        onClick={() => removeAttachment(name)}
                        className="rounded-full p-0.5 text-white/65 transition-colors hover:bg-white/20 hover:text-white"
                        aria-label={`Remove ${name}`}
                      >
                        <ArrowUp className="h-2.5 w-2.5 rotate-45" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex items-end gap-2">
                <div className="mb-1 ml-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-[#9cf0ff]"
                    aria-label="Attach files"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-[#f9abff]"
                    aria-label="Attach images"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    rows={1}
                    placeholder="Orchestrate your message..."
                    disabled={isLoading}
                    className="max-h-[220px] min-h-[56px] w-full resize-none bg-transparent px-3 py-3 text-sm leading-7 text-white placeholder:text-white/40 focus:outline-none"
                  />
                </div>

                <div className="mb-1 mr-1 flex items-center gap-2">
                  <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-[#11131c]/90 px-3 py-1.5 sm:flex">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9cf0ff]" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9cf0ff]">
                      {mode} mode
                    </span>
                  </div>

                  {isLoading ? (
                    <button
                      type="button"
                      onClick={stopGeneration}
                      className="inline-flex h-10 items-center justify-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white/85 transition-colors hover:bg-white/20"
                    >
                      <StopCircle className="h-3.5 w-3.5" />
                      Stop
                    </button>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isLoading || (!input.trim() && pendingAttachmentNames.length === 0)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#bac3ff] to-[#3f51b5] text-[#11131c] shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Send message"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </form>

            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/35">
              Press Enter to send • Shift + Enter for new line
            </p>
          </div>
        </main>
      </div>

      <button
        type="button"
        onClick={() => startNewChat()}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#f9abff] to-[#951faa] text-[#35003f] shadow-2xl transition-transform hover:scale-105 lg:hidden"
        aria-label="New chat"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}