"use client";
import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/hooks";

/**
 * Registers the service worker in production builds. In development it is removed again,
 * because dev assets are not content-hashed and must never be served from a cache.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Offline support and notifications are optional; the app works without them.
      });
    } else {
      void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()));
    }
  }, []);
  return null;
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-warning-border bg-warning-soft px-4 py-2 text-center text-sm text-warning-ink">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>Du är offline. Ändringar sparas inte förrän du är online igen – set i ett pågående pass sparas på enheten.</span>
    </div>
  );
}
