/**
 * Offline action queue for DailyRunSheet.
 * Stores actions in localStorage when offline and replays them when online.
 */

const QUEUE_KEY = "poddispatch_offline_queue";

export interface OfflineAction {
  id: string;
  url: string;
  method: string;
  body: any;
  timestamp: number;
  description: string;
}

export function getQueue(): OfflineAction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: OfflineAction[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueAction(action: Omit<OfflineAction, "id" | "timestamp">) {
  const queue = getQueue();
  queue.push({
    ...action,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });
  saveQueue(queue);
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export async function flushQueue(): Promise<{ success: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;
  const remaining: OfflineAction[] = [];

  for (const action of queue) {
    try {
      const res = await fetch(action.url, {
        method: action.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.body),
      });
      if (res.ok) {
        success++;
      } else {
        remaining.push(action);
        failed++;
      }
    } catch {
      remaining.push(action);
      failed++;
    }
  }

  saveQueue(remaining);
  return { success, failed };
}

/** Check if the browser is online */
export function isOnline(): boolean {
  return navigator.onLine;
}
