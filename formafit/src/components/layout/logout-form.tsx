"use client";
import { useRef } from "react";
import { unregisterPushSubscription } from "@/app/(app)/profil/notification-actions";
import { unsubscribeBrowser, withTimeout } from "@/lib/push-client";
import { clearAllPending, countAllPending } from "@/lib/workout/offline-queue";

/** Removes this account's traces from the device: push subscription and queued set logs. */
async function cleanUpDevice() {
  clearAllPending();
  try {
    const endpoint = await withTimeout(unsubscribeBrowser(), 3000);
    if (endpoint) await withTimeout(unregisterPushSubscription(endpoint), 3000);
  } catch {
    // Logging out must never be blocked by this cleanup.
  }
}

/** POST form to /auth/logout that first cleans up device-local data. */
export function LogoutForm({ children, className }: { children: React.ReactNode; className?: string }) {
  const submitting = useRef(false);
  return (
    <form
      action="/auth/logout"
      method="post"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (submitting.current) return;
        const pending = countAllPending();
        if (pending > 0 && !window.confirm(`${pending} loggade set har inte skickats än och försvinner om du loggar ut. Logga ut ändå?`)) return;
        submitting.current = true;
        const form = e.currentTarget;
        void cleanUpDevice().finally(() => form.submit());
      }}
    >
      {children}
    </form>
  );
}
