import { describe, expect, it } from "vitest";
import {
  applyPending,
  clearAllPending,
  countAllPending,
  enqueuePending,
  parsePending,
  PENDING_SETS_PREFIX,
  readPending,
  removePending,
  type PendingSet,
  type QueueStorage,
} from "./offline-queue";

function memoryStorage(): QueueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const entry = (setId: string, queuedAt: number, patch: Partial<PendingSet> = {}): PendingSet => ({
  setId,
  weightKg: 60,
  reps: 8,
  rir: null,
  isCompleted: true,
  completedAt: "2026-10-19T10:00:00.000Z",
  queuedAt,
  ...patch,
});

describe("offline set queue", () => {
  it("keeps only the latest values per set", () => {
    const store = memoryStorage();
    enqueuePending("s1", entry("a", 1), store);
    enqueuePending("s1", entry("b", 2), store);
    enqueuePending("s1", entry("a", 3, { weightKg: 62.5 }), store);
    const items = readPending("s1", store);
    expect(items).toHaveLength(2);
    expect(items.find((p) => p.setId === "a")).toMatchObject({ weightKg: 62.5, queuedAt: 3 });
  });

  it("only removes the version that was synced", () => {
    const store = memoryStorage();
    enqueuePending("s1", entry("a", 1), store);
    // The user changed the set while version 1 was being sent.
    enqueuePending("s1", entry("a", 2, { reps: 10 }), store);
    removePending("s1", "a", 1, store);
    expect(readPending("s1", store)).toEqual([entry("a", 2, { reps: 10 })]);
    removePending("s1", "a", 2, store);
    expect(readPending("s1", store)).toEqual([]);
    expect(store.data.has(`${PENDING_SETS_PREFIX}s1`)).toBe(false);
  });

  it("keeps sessions apart and clears everything on logout", () => {
    const store = memoryStorage();
    store.setItem("formafit:theme", "dark");
    enqueuePending("s1", entry("a", 1), store);
    enqueuePending("s2", entry("b", 1), store);
    enqueuePending("s2", entry("c", 1), store);
    expect(readPending("s1", store)).toHaveLength(1);
    expect(countAllPending(store)).toBe(3);
    clearAllPending(store);
    expect(countAllPending(store)).toBe(0);
    expect(store.getItem("formafit:theme")).toBe("dark");
  });

  it("drops malformed data instead of sending it", () => {
    expect(parsePending("not json")).toEqual([]);
    expect(parsePending(JSON.stringify({ setId: "a" }))).toEqual([]);
    expect(parsePending(JSON.stringify([entry("a", 1), { setId: "b", weightKg: "60" }, null]))).toEqual([entry("a", 1)]);
  });

  it("reports failure when storage is unavailable or full", () => {
    expect(enqueuePending("s1", entry("a", 1), null)).toBe(false);
    const full = memoryStorage();
    full.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    expect(enqueuePending("s1", entry("a", 1), full)).toBe(false);
  });

  it("shows queued values on top of the server state", () => {
    const exercises = [
      { id: "e1", sets: [{ id: "a", weight_kg: null, reps: null, rir: null, is_completed: false }, { id: "b", weight_kg: 50, reps: 5, rir: 2, is_completed: true }] },
      { id: "e2", sets: [{ id: "c", weight_kg: 20, reps: 12, rir: null, is_completed: false }] },
    ];
    const shown = applyPending(exercises, [entry("a", 1)]);
    expect(shown[0].sets[0]).toEqual({ id: "a", weight_kg: 60, reps: 8, rir: null, is_completed: true });
    expect(shown[0].sets[1]).toBe(exercises[0].sets[1]);
    expect(shown[1]).toBe(exercises[1]);
    expect(applyPending(exercises, [])).toBe(exercises);
  });
});
