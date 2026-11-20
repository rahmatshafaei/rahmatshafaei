"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Bell, BellOff, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { callAction } from "@/lib/offline";
import { currentSubscription, pushSupport, subscribeBrowser, unsubscribeBrowser, type PushSupport } from "@/lib/push-client";
import { toTimeInput } from "@/lib/reminders";
import {
  pushDeviceStatus,
  registerPushSubscription,
  removeAllPushSubscriptions,
  saveReminderSettings,
  sendTestNotification,
  unregisterPushSubscription,
} from "./notification-actions";

const noSubscribe = () => () => {};

/** The Permissions API is more reliable than Notification.permission (e.g. in embedded browsers). */
async function notificationPermission(): Promise<PermissionState> {
  try {
    return (await navigator.permissions.query({ name: "notifications" })).state;
  } catch {
    if (!("Notification" in window)) return "denied";
    return Notification.permission === "default" ? "prompt" : Notification.permission;
  }
}

function useBrowserValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noSubscribe, read, () => serverValue);
}

interface Settings {
  timezone: string;
  workoutTime: string | null;
  mealTime: string | null;
}

export function RemindersCard({
  vapidPublicKey,
  settings,
  hasScheduledDays,
}: {
  vapidPublicKey: string | null;
  settings: Settings;
  hasScheduledDays: boolean;
}) {
  const production = process.env.NODE_ENV === "production";
  const support = useBrowserValue<PushSupport | "unknown">(pushSupport, "unknown");
  const [device, setDevice] = useState<{ registered: boolean; devices: number; permission: PermissionState } | null>(null);
  const [statusVersion, setStatusVersion] = useState(0);
  const [busy, start] = useTransition();
  const [deniedNow, setDeniedNow] = useState(false);
  const refreshStatus = () => setStatusVersion((v) => v + 1);

  useEffect(() => {
    if (!vapidPublicKey) return;
    let cancelled = false;
    void (async () => {
      const [sub, permission] = await Promise.all([currentSubscription().catch(() => null), notificationPermission()]);
      const res = await callAction(() => pushDeviceStatus(sub?.endpoint ?? null));
      if (res.ok && !cancelled) setDevice({ ...res.data, permission });
    })();
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey, statusVersion]);

  function enable() {
    if (!vapidPublicKey) return;
    start(async () => {
      try {
        const result = await Notification.requestPermission();
        if (result !== "granted") {
          setDeniedNow(true);
          return;
        }
        const sub = (await subscribeBrowser(vapidPublicKey)).toJSON();
        const res = await callAction(() =>
          registerPushSubscription({ endpoint: sub.endpoint, keys: sub.keys, userAgent: navigator.userAgent.slice(0, 300) }),
        );
        if (!res.ok) return void toast.error(res.error);
        toast.success("Notiser är på för den här enheten.");
      } catch (e) {
        toast.error(`Notiser kunde inte aktiveras: ${(e as Error).message}`);
      }
      refreshStatus();
    });
  }

  function disable() {
    start(async () => {
      const endpoint = await unsubscribeBrowser().catch(() => null);
      if (endpoint) await callAction(() => unregisterPushSubscription(endpoint));
      toast.success("Notiser är avstängda för den här enheten.");
      refreshStatus();
    });
  }

  function removeAll() {
    start(async () => {
      await unsubscribeBrowser().catch(() => null);
      const res = await callAction(() => removeAllPushSubscriptions());
      if (!res.ok) return void toast.error(res.error);
      toast.success("Notiser är avstängda på alla enheter.");
      refreshStatus();
    });
  }

  function test() {
    start(async () => {
      const res = await callAction(() => sendTestNotification());
      if (!res.ok) return void toast.error(res.error);
      toast.success("Testnotisen är skickad.");
    });
  }

  const blocked = device?.permission === "denied" || deniedNow;

  return (
    <Card role="region" aria-labelledby="reminders-title">
      <CardHeader>
        <CardTitle id="reminders-title">Påminnelser</CardTitle>
        <CardDescription>Notiser på dagar då ditt program har ett pass, och om du inte har loggat någon mat.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!vapidPublicKey ? (
          <Notice variant="warning">Notiser är inte konfigurerade på den här servern.</Notice>
        ) : !production ? (
          <Notice>Notiser kan bara aktiveras i produktionsläge (npm run build &amp;&amp; npm start).</Notice>
        ) : support === "ios-needs-install" ? (
          <Notice title="Lägg till på hemskärmen först">
            På iPhone och iPad fungerar notiser bara när FormaFit är tillagd på hemskärmen: tryck på Dela och välj Lägg till på hemskärmen.
          </Notice>
        ) : support === "unsupported" ? (
          <Notice variant="warning">Den här webbläsaren stöder inte notiser.</Notice>
        ) : device?.registered ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-medium text-primary-strong">
              <CheckCircle2 className="size-4" aria-hidden /> Notiser är på för den här enheten
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={test} loading={busy}>
                <Send /> Skicka testnotis
              </Button>
              <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>
                <BellOff /> Stäng av här
              </Button>
            </div>
          </div>
        ) : blocked ? (
          <Notice variant="warning">Notiser är blockerade för FormaFit. Tillåt dem i webbläsarens webbplatsinställningar och försök igen.</Notice>
        ) : (
          <Button onClick={enable} loading={busy} disabled={support === "unknown" || device === null}>
            <Bell /> Aktivera notiser på den här enheten
          </Button>
        )}

        {vapidPublicKey ? <ReminderSettingsForm settings={settings} hasScheduledDays={hasScheduledDays} /> : null}

        {device && device.devices > 0 ? (
          <p className="text-xs text-muted-foreground">
            {device.devices === 1 ? "1 enhet får notiser." : `${device.devices} enheter får notiser.`}{" "}
            <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={removeAll} disabled={busy}>
              Stäng av på alla enheter
            </button>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReminderSettingsForm({ settings, hasScheduledDays }: { settings: Settings; hasScheduledDays: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const browserTz = useBrowserValue(() => Intl.DateTimeFormat().resolvedOptions().timeZone || settings.timezone, settings.timezone);
  const [workoutOn, setWorkoutOn] = useState(settings.workoutTime !== null);
  const [workoutTime, setWorkoutTime] = useState(toTimeInput(settings.workoutTime) || "17:00");
  const [mealOn, setMealOn] = useState(settings.mealTime !== null);
  const [mealTime, setMealTime] = useState(toTimeInput(settings.mealTime) || "20:00");

  return (
    <form
      className="flex flex-col gap-3 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await callAction(() =>
            saveReminderSettings({ timezone: browserTz, workoutTime: workoutOn ? workoutTime : null, mealTime: mealOn ? mealTime : null }),
          );
          if (!res.ok) return void toast.error(res.error);
          toast.success("Påminnelserna är sparade.");
          router.refresh();
        });
      }}
    >
      <ReminderRow
        id="rem-workout"
        label="Träningspåminnelse"
        hint={hasScheduledDays ? "På dagar då ditt aktiva program har ett pass och du inte redan har tränat." : "Kräver ett aktivt program där passen har veckodagar."}
        on={workoutOn}
        onToggle={setWorkoutOn}
        time={workoutTime}
        onTime={setWorkoutTime}
      />
      <ReminderRow
        id="rem-meal"
        label="Påminn mig att logga maten"
        hint="Skickas bara om du inte har loggat något den dagen."
        on={mealOn}
        onToggle={setMealOn}
        time={mealTime}
        onTime={setMealTime}
      />
      <p className="text-xs text-muted-foreground">Tiderna gäller i tidszonen {browserTz}.</p>
      <Button type="submit" variant="outline" loading={pending}>
        Spara påminnelser
      </Button>
    </form>
  );
}

function ReminderRow({
  id,
  label,
  hint,
  on,
  onToggle,
  time,
  onTime,
}: {
  id: string;
  label: string;
  hint: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  time: string;
  onTime: (time: string) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-1 size-4 accent-[var(--primary)]" checked={on} onChange={(e) => onToggle(e.target.checked)} />
      <label htmlFor={id} className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </label>
      <Input
        type="time"
        aria-label={`Tid för ${label.toLowerCase()}`}
        className="h-10 w-36 shrink-0 tabular"
        value={time}
        required={on}
        disabled={!on}
        onChange={(e) => onTime(e.target.value)}
      />
    </div>
  );
}
