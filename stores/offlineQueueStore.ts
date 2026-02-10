import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createPersistConfig, CACHE_LIMITS, trimArray } from "@/lib/storage";

export type OfflineActionStatus = "queued" | "processing" | "failed";

export interface OfflineAction<P = unknown> {
  readonly id: string;
  readonly type: string;
  readonly payload: P;
  readonly meta?: {
    readonly description?: string;
    readonly entityId?: string;
  };
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly attempts: number;
  readonly status: OfflineActionStatus;
  readonly lastError?: string;
  readonly nextAttemptAt?: number | null;
}

export type OfflineActionHandler = (action: OfflineAction) => Promise<void>;

export type OfflineActionHandlerMap = Record<string, OfflineActionHandler>;

interface OfflineQueueState {
  queue: OfflineAction[];
  isProcessing: boolean;
  lastProcessedAt: number | null;

  enqueue: <P>(
    type: string,
    payload: P,
    meta?: OfflineAction<P>["meta"]
  ) => OfflineAction<P>;
  remove: (id: string) => void;
  clear: () => void;
  clearFailed: () => void;
  retryFailed: () => void;
  processQueue: (
    handlers: OfflineActionHandlerMap,
    options?: { maxPerRun?: number; maxAttempts?: number }
  ) => Promise<void>;
}

type OfflineQueuePersistedState = Pick<
  OfflineQueueState,
  "queue" | "lastProcessedAt"
>;

const createActionId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const getRetryDelayMs = (attempts: number) => {
  const schedule = [5000, 15000, 30000, 60000, 120000, 300000];
  const index = Math.min(attempts - 1, schedule.length - 1);
  return schedule[index];
};

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      isProcessing: false,
      lastProcessedAt: null,

      enqueue: (type, payload, meta) => {
        const now = Date.now();
        const action: OfflineAction<typeof payload> = {
          id: createActionId(),
          type,
          payload,
          meta,
          createdAt: now,
          updatedAt: now,
          attempts: 0,
          status: "queued",
        };

        set((state) => ({
          queue: trimArray([...state.queue, action], CACHE_LIMITS.offlineQueue, "end"),
        }));

        return action;
      },

      remove: (id) => {
        set((state) => ({
          queue: state.queue.filter((action) => action.id !== id),
        }));
      },

      clear: () => {
        set({ queue: [] });
      },

      clearFailed: () => {
        set((state) => ({
          queue: state.queue.filter((action) => action.status !== "failed"),
        }));
      },

      retryFailed: () => {
        set((state) => ({
          queue: state.queue.map((action) =>
            action.status === "failed"
              ? {
                  ...action,
                  status: "queued",
                  nextAttemptAt: null,
                  updatedAt: Date.now(),
                }
              : action
          ),
        }));
      },

      processQueue: async (handlers, options) => {
        const maxPerRun = options?.maxPerRun ?? 5;
        const maxAttempts = options?.maxAttempts ?? 6;
        const { queue, isProcessing } = get();

        if (isProcessing) return;
        if (queue.length === 0) return;

        const now = Date.now();
        const candidates = queue.filter((action) => {
          if (!handlers[action.type]) return false;
          if (action.status === "queued") return true;
          if (action.status === "failed" && action.nextAttemptAt) {
            return action.nextAttemptAt <= now;
          }
          return false;
        });

        if (candidates.length === 0) return;

        set({ isProcessing: true });

        let processed = 0;
        for (const action of candidates) {
          if (processed >= maxPerRun) break;

          const handler = handlers[action.type];
          if (!handler) continue;

          const nextAttempts = action.attempts + 1;

          set((state) => ({
            queue: state.queue.map((item) =>
              item.id === action.id
                ? {
                    ...item,
                    attempts: nextAttempts,
                    status: "processing",
                    updatedAt: Date.now(),
                  }
                : item
            ),
          }));

          try {
            await handler(action);
            set((state) => ({
              queue: state.queue.filter((item) => item.id !== action.id),
            }));
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Offline action failed";

            const nextAttemptAt =
              nextAttempts >= maxAttempts
                ? null
                : Date.now() + getRetryDelayMs(nextAttempts);

            set((state) => ({
              queue: state.queue.map((item) =>
                item.id === action.id
                  ? {
                      ...item,
                      status: "failed",
                      lastError: message,
                      nextAttemptAt,
                      updatedAt: Date.now(),
                    }
                  : item
              ),
            }));
          }

          processed += 1;
        }

        set({ isProcessing: false, lastProcessedAt: Date.now() });
      },
    }),
    createPersistConfig<OfflineQueueState, OfflineQueuePersistedState>(
      "offline-queue-storage",
      {
        partialize: (state) => ({
          queue: trimArray(state.queue, CACHE_LIMITS.offlineQueue, "end"),
          lastProcessedAt: state.lastProcessedAt,
        }),
      }
    )
  )
);
