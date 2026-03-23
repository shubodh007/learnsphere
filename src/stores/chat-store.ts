import { create } from 'zustand';

interface ChatStore {
  activeConversationId: string | null;
  streamingMessage: string;
  setActiveConversation: (id: string | null) => void;
  setStreamingMessage: (message: string) => void;
  appendStreamingMessage: (chunk: string) => void;
  clearStreamingMessage: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  activeConversationId: null,
  streamingMessage: '',
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setStreamingMessage: (message) => set({ streamingMessage: message }),
  appendStreamingMessage: (chunk) =>
    set((state) => ({ streamingMessage: state.streamingMessage + chunk })),
  clearStreamingMessage: () => set({ streamingMessage: '' }),
}));
