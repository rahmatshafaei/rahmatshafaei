"use client";
import { useState, useSyncExternalStore } from "react";

/**
 * Local, editable copy of a prop that resets whenever the prop changes (e.g. after
 * router.refresh()). Uses the "adjust state during render" pattern instead of an effect.
 */
export function useSyncedState<T>(source: T) {
  const [state, setState] = useState(source);
  const [prev, setPrev] = useState(source);
  if (source !== prev) {
    setPrev(source);
    setState(source);
  }
  return [state, setState] as const;
}

/** Current time, ticking every `intervalMs`. Returns null during SSR/hydration. */
export function useNow(intervalMs = 1000): number | null {
  return useSyncExternalStore(
    (onChange) => {
      const t = setInterval(onChange, intervalMs);
      return () => clearInterval(t);
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
}

const STORAGE_EVENT = "formafit:storage";

/** A localStorage value as external state (null on the server or when storage is unavailable). */
export function useLocalStorage(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(STORAGE_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(STORAGE_EVENT, onChange);
      };
    },
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const set = (next: string | null) => {
    try {
      if (next === null) localStorage.removeItem(key);
      else localStorage.setItem(key, next);
    } catch {
      // Storage blocked: the value simply is not remembered.
    }
    window.dispatchEvent(new Event(STORAGE_EVENT));
  };
  return [value, set];
}

/** Whether a browser capability exists. Always false during SSR/hydration. */
export function useFeature(test: () => boolean): boolean {
  return useSyncExternalStore(
    () => () => {},
    test,
    () => false,
  );
}

/** Browser connectivity as reported by navigator.onLine. Assumed online during SSR/hydration. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
