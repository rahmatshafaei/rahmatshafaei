/** Reminder texts and settings helpers shared by the reminder job, actions and UI. */

export type ReminderKind = "workout" | "meal_log";

export interface ReminderCandidate {
  user_id: string;
  kind: ReminderKind | string;
  local_date: string;
  /** Name of today's planned training day (workout reminders only). */
  detail: string | null;
}

/** Payload read by public/sw.js. */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Texts only state what the data shows: a planned day, or that nothing was logged today. */
export function reminderMessage(c: Pick<ReminderCandidate, "kind" | "local_date" | "detail">): PushPayload | null {
  if (c.kind === "workout") {
    return {
      title: "Dags att träna",
      body: c.detail ? `I dag står ${c.detail} på schemat i ditt program.` : "I dag är en träningsdag i ditt program.",
      url: "/traning",
      tag: `workout-${c.local_date}`,
    };
  }
  if (c.kind === "meal_log") {
    return {
      title: "Glöm inte att logga",
      body: "Du har inte loggat några måltider i dag. Det tar bara en minut.",
      url: "/mat",
      tag: `meal-${c.local_date}`,
    };
  }
  return null;
}

export const TEST_NOTIFICATION: PushPayload = {
  title: "FormaFit",
  body: "Testnotis – påminnelser fungerar på den här enheten.",
  url: "/profil",
  tag: "test",
};

/** "18:30" or "18:30:00" from the database → "18:30" for <input type="time">. */
export function toTimeInput(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("sv-SE", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
