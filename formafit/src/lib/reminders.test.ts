import { describe, expect, it } from "vitest";
import { isValidTimeZone, reminderMessage, toTimeInput } from "./reminders";

describe("reminder messages", () => {
  it("names the planned training day", () => {
    expect(reminderMessage({ kind: "workout", local_date: "2026-10-21", detail: "Push A" })).toEqual({
      title: "Dags att träna",
      body: "I dag står Push A på schemat i ditt program.",
      url: "/traning",
      tag: "workout-2026-10-21",
    });
    expect(reminderMessage({ kind: "workout", local_date: "2026-10-21", detail: null })?.body).toBe("I dag är en träningsdag i ditt program.");
  });

  it("only states that nothing has been logged", () => {
    const m = reminderMessage({ kind: "meal_log", local_date: "2026-10-21", detail: null });
    expect(m?.body).toBe("Du har inte loggat några måltider i dag. Det tar bara en minut.");
    expect(m?.url).toBe("/mat");
  });

  it("ignores unknown kinds", () => {
    expect(reminderMessage({ kind: "other", local_date: "2026-10-21", detail: null })).toBeNull();
  });
});

describe("reminder settings helpers", () => {
  it("formats database times for time inputs", () => {
    expect(toTimeInput("18:30:00")).toBe("18:30");
    expect(toTimeInput(null)).toBe("");
  });

  it("validates IANA time zones", () => {
    expect(isValidTimeZone("Europe/Stockholm")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});
