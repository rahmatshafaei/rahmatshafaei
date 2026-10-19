/**
 * Local queue for set logs that could not reach the server (e.g. no signal in the gym).
 *
 * Each entry holds the complete values of one set, so a later entry for the same set simply
 * replaces the earlier one and replaying is idempotent. `queuedAt` versions an entry: a sync
 * only removes the exact version it sent, never values the user entered meanwhile.
 * Stored per device in localStorage; cleared on logout.
 */
export interface PendingSet {
  setId: string;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  isCompleted: boolean;
  completedAt: string | null;
  queuedAt: number;
}

export const PENDING_SETS_PREFIX = "formafit:pending-sets:";
export const PENDING_SETS_EVENT = "formafit:pending-sets";

export type QueueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

function defaultStorage(): QueueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const nullableNumber = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v));

function isPendingSet(v: unknown): v is PendingSet {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.setId === "string" &&
    nullableNumber(p.weightKg) &&
    nullableNumber(p.reps) &&
    nullableNumber(p.rir) &&
    typeof p.isCompleted === "boolean" &&
    (p.completedAt === null || typeof p.completedAt === "string") &&
    typeof p.queuedAt === "number"
  );
}

/** Parses a stored queue, dropping anything malformed. */
export function parsePending(raw: string | null): PendingSet[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPendingSet) : [];
  } catch {
    return [];
  }
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PENDING_SETS_EVENT));
}

export function readPending(sessionId: string, store = defaultStorage()): PendingSet[] {
  try {
    return parsePending(store?.getItem(PENDING_SETS_PREFIX + sessionId) ?? null);
  } catch {
    return [];
  }
}

function writePending(sessionId: string, items: PendingSet[], store: QueueStorage): boolean {
  try {
    if (items.length) store.setItem(PENDING_SETS_PREFIX + sessionId, JSON.stringify(items));
    else store.removeItem(PENDING_SETS_PREFIX + sessionId);
    notify();
    return true;
  } catch {
    return false;
  }
}

/** Stores the latest values for a set. Returns false when local storage is unavailable or full. */
export function enqueuePending(sessionId: string, entry: PendingSet, store = defaultStorage()): boolean {
  if (!store) return false;
  const items = readPending(sessionId, store).filter((p) => p.setId !== entry.setId);
  items.push(entry);
  return writePending(sessionId, items, store);
}

/** Removes an entry after it was synced, but only if it has not been replaced since. */
export function removePending(sessionId: string, setId: string, queuedAt: number, store = defaultStorage()) {
  if (!store) return;
  const items = readPending(sessionId, store);
  const next = items.filter((p) => !(p.setId === setId && p.queuedAt === queuedAt));
  if (next.length !== items.length) writePending(sessionId, next, store);
}

function pendingKeys(store: QueueStorage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k?.startsWith(PENDING_SETS_PREFIX)) keys.push(k);
  }
  return keys;
}

export function countAllPending(store = defaultStorage()): number {
  if (!store) return 0;
  try {
    return pendingKeys(store).reduce((n, k) => n + parsePending(store.getItem(k)).length, 0);
  } catch {
    return 0;
  }
}

/** Removes every queued set on this device (used on logout). */
export function clearAllPending(store = defaultStorage()) {
  if (!store) return;
  try {
    pendingKeys(store).forEach((k) => store.removeItem(k));
    notify();
  } catch {
    // Storage blocked: nothing was stored either.
  }
}

interface SetLike {
  id: string;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  is_completed: boolean;
}

/** Shows queued values on top of the server state so a reload does not hide unsynced sets. */
export function applyPending<S extends SetLike, E extends { sets: S[] }>(exercises: E[], pending: PendingSet[]): E[] {
  if (pending.length === 0) return exercises;
  const bySet = new Map(pending.map((p) => [p.setId, p]));
  return exercises.map((e) =>
    e.sets.some((s) => bySet.has(s.id))
      ? {
          ...e,
          sets: e.sets.map((s) => {
            const p = bySet.get(s.id);
            return p ? { ...s, weight_kg: p.weightKg, reps: p.reps, rir: p.rir, is_completed: p.isCompleted } : s;
          }),
        }
      : e,
  );
}
