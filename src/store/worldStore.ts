import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { fetchState, refreshState, sendChat, toggleFutureMode } from "../services/api";
import type { Category, ChatMessage, StateEnvelope, Transaction, WorldState } from "../types";

interface BranchSnapshot {
  id: string;
  saved_at: string;
  state: WorldState;
}

interface PersistedWorldStore {
  chat: ChatMessage[];
  selectedCategories: Category[];
  branchHistory: BranchSnapshot[];
  persistedFutureState: WorldState | null;
}

interface WorldStore extends PersistedWorldStore {
  envelope: StateEnvelope | null;
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

function buildBranchSnapshot(state: WorldState): BranchSnapshot {
  return {
    id: `${state.branch_name}-${state.updated_at}`,
    saved_at: new Date().toISOString(),
    state
  };
}

function mergeEnvelopeWithPersistedFuture(
  envelope: StateEnvelope,
  persistedFutureState: WorldState | null
): StateEnvelope {
  if (!persistedFutureState) {
    return envelope;
  }

  const persistedIsNewer =
    new Date(persistedFutureState.updated_at).getTime() >
    new Date(envelope.future_state?.updated_at ?? envelope.base_state.updated_at).getTime();

  if (!persistedIsNewer && envelope.future_state) {
    return envelope;
  }

  return {
    ...envelope,
    future_mode: true,
    future_state: persistedFutureState,
    active_state: persistedFutureState
  };
}

function dedupeBranchHistory(branchHistory: BranchSnapshot[]): BranchSnapshot[] {
  const seen = new Set<string>();
  return branchHistory.filter((entry) => {
    if (seen.has(entry.id)) {
      return false;
    }
    seen.add(entry.id);
    return true;
  });
}

export const useWorldStore = create<WorldStore>()(
  persist(
    (set, get) => ({
      envelope: null,
      chat: [],
      selectedCategories: ALL_CATEGORIES,
      selectedTransaction: null,
      loading: false,
      error: null,
      branchHistory: [],
      persistedFutureState: null,

      bootstrap: async () => {
        set({ loading: true, error: null });
        try {
          let envelope = await fetchState();
          if (envelope.active_state.transactions.length === 0) {
            envelope = await refreshState(get().selectedCategories);
          }

          const restored = mergeEnvelopeWithPersistedFuture(envelope, get().persistedFutureState);
          set({ envelope: restored, loading: false });
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
          if (!enabled) {
            if (get().persistedFutureState) {
              set((state) => ({
                envelope,
                branchHistory: dedupeBranchHistory([
                  buildBranchSnapshot(state.persistedFutureState as WorldState),
                  ...state.branchHistory
                ]),
                persistedFutureState: null,
                loading: false
              }));
              return;
            }
            set({ envelope, loading: false });
            return;
          }

          const nextFuture = envelope.future_state ?? envelope.active_state;
          set((state) => ({
            envelope,
            persistedFutureState: nextFuture,
            branchHistory: dedupeBranchHistory([buildBranchSnapshot(nextFuture), ...state.branchHistory]),
            loading: false
          }));
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
          const nextFutureState = response.envelope.future_state ?? null;
          set((state) => ({
            envelope: response.envelope,
            chat: [...state.chat, response.assistant_message],
            persistedFutureState: nextFutureState,
            branchHistory: nextFutureState
              ? dedupeBranchHistory([buildBranchSnapshot(nextFutureState), ...state.branchHistory])
              : state.branchHistory,
            loading: false
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Chat failed", loading: false });
        }
      }
    }),
    {
      name: "gts-world-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedWorldStore => ({
        chat: state.chat,
        selectedCategories: state.selectedCategories,
        branchHistory: state.branchHistory.slice(0, 12),
        persistedFutureState: state.persistedFutureState
      })
    }
  )
);
