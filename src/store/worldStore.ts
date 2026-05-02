import { create } from "zustand";
import { fetchState, refreshState, sendChat, toggleFutureMode } from "../services/api";
import type { Category, ChatMessage, StateEnvelope, Transaction } from "../types";

interface WorldStore {
  envelope: StateEnvelope | null;
  chat: ChatMessage[];
  selectedCategories: Category[];
  selectedTransaction: Transaction | null;
  loading: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  setSelectedCategories: (categories: Category[]) => void;
  toggleCategory: (category: Category) => void;
  setSelectedTransaction: (transaction: Transaction | null) => void;
  toggleFutureMode: (enabled: boolean) => Promise<void>;
  sendChat: (message: string) => Promise<void>;
}

const ALL_CATEGORIES: Category[] = ["Economy", "Politics", "Military", "Technology", "Climate"];

export const useWorldStore = create<WorldStore>((set, get) => ({
  envelope: null,
  chat: [],
  selectedCategories: ALL_CATEGORIES,
  selectedTransaction: null,
  loading: false,
  error: null,

  bootstrap: async () => {
    set({ loading: true, error: null });
    try {
      let envelope = await fetchState();
      if (envelope.active_state.transactions.length === 0) {
        envelope = await refreshState(get().selectedCategories);
      }
      set({ envelope, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Bootstrap failed", loading: false });
    }
  },

  refresh: async () => {
    if (get().envelope?.future_mode) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const envelope = await refreshState(get().selectedCategories);
      set({ envelope, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Refresh failed", loading: false });
    }
  },

  setSelectedCategories: (categories) => set({ selectedCategories: categories }),

  toggleCategory: (category) => {
    const current = get().selectedCategories;
    const exists = current.includes(category);
    const selectedCategories = exists ? current.filter((item) => item !== category) : [...current, category];
    set({ selectedCategories: selectedCategories.length ? selectedCategories : [category] });
  },

  setSelectedTransaction: (transaction) => set({ selectedTransaction: transaction }),

  toggleFutureMode: async (enabled) => {
    set({ loading: true, error: null });
    try {
      const envelope = await toggleFutureMode(enabled);
      set({ envelope, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Toggle failed", loading: false });
    }
  },

  sendChat: async (message) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      mode: get().envelope?.future_mode ? "future" : "reality",
      created_at: new Date().toISOString()
    };

    set((state) => ({ chat: [...state.chat, userMessage], loading: true, error: null }));

    try {
      const response = await sendChat(trimmed, get().selectedCategories);
      set((state) => ({
        envelope: response.envelope,
        chat: [...state.chat, response.assistant_message],
        loading: false
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Chat failed", loading: false });
    }
  }
}));
