/**
 * Decides which parts of the user's own data are relevant to a coach question. Only the
 * relevant summaries are sent to the model – never raw tables or unrelated personal data.
 */
export type ContextTopic = "nutrition" | "training" | "progress";

const KEYWORDS: Record<ContextTopic, RegExp> = {
  nutrition: /(?<!\p{L})(mat|kost|kalori|kcal|protein|kolhydrat|fett|makro|äta|åt|ät|måltid|frukost|lunch|middag|mellanmål|recept|diet|vatten|livsmedel|ersätt|byt)/iu,
  training: /(?<!\p{L})(träning|träna|pass|övning|set|reps|repetition|program|styrka|progression|bänk|knäböj|marklyft|muskel|vila|split|gym|1rm|personbästa)/iu,
  progress: /(?<!\p{L})(framsteg|vikt|väg|utveckling|trend|vecka|veckan|månad|sammanfatta|resultat|gått|ligger jag|mått|midja)/iu,
};

export function relevantTopics(message: string): ContextTopic[] {
  const topics = (Object.keys(KEYWORDS) as ContextTopic[]).filter((t) => KEYWORDS[t].test(message));
  return topics;
}

export interface CoachProfile {
  goal: string | null;
  experience: string | null;
  allergies: string[];
  dietPreferences: string[];
  targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
}

export interface CoachData {
  nutrition?: { days: number; avgKcal: number | null; avgProtein: number | null; loggedDays: number };
  training?: { sessions: { date: string; name: string; sets: number }[]; activeProgram: string | null };
  progress?: { weights: { date: string; weightKg: number }[] };
}

export function buildContextText(profile: CoachProfile, data: CoachData, shareLogs: boolean): string {
  const lines: string[] = ["Användarens profil (från appen):"];
  lines.push(`- Mål: ${profile.goal ?? "ej angivet"}; erfarenhet: ${profile.experience ?? "ej angiven"}`);
  if (profile.targets) {
    lines.push(`- Dagliga mål: ${profile.targets.calories} kcal, protein ${profile.targets.protein_g} g, kolhydrater ${profile.targets.carbs_g} g, fett ${profile.targets.fat_g} g`);
  }
  if (profile.allergies.length) lines.push(`- Allergier/intoleranser: ${profile.allergies.join(", ")}`);
  if (profile.dietPreferences.length) lines.push(`- Kostpreferenser: ${profile.dietPreferences.join(", ")}`);
  if (!shareLogs) {
    lines.push("Användaren har valt att inte dela sina loggar med coachen. Hänvisa till appens framstegsvy vid frågor om historik.");
    return lines.join("\n");
  }
  if (data.nutrition) {
    const n = data.nutrition;
    lines.push(
      n.loggedDays
        ? `Kost senaste ${n.days} dagarna: loggat ${n.loggedDays} dagar, snitt ${Math.round(n.avgKcal ?? 0)} kcal och ${Math.round(n.avgProtein ?? 0)} g protein per loggad dag.`
        : `Kost: inga loggade måltider de senaste ${n.days} dagarna.`,
    );
  }
  if (data.training) {
    const t = data.training;
    lines.push(`Aktivt program: ${t.activeProgram ?? "inget"}.`);
    lines.push(
      t.sessions.length
        ? `Genomförda pass senaste 4 veckorna: ${t.sessions.map((s) => `${s.date} ${s.name} (${s.sets} set)`).join("; ")}.`
        : "Inga genomförda pass de senaste 4 veckorna.",
    );
  }
  if (data.progress) {
    const w = data.progress.weights;
    lines.push(w.length ? `Vägningar: ${w.map((x) => `${x.date}: ${x.weightKg} kg`).join("; ")}.` : "Inga vägningar loggade.");
  }
  lines.push("Påstå aldrig något om data som inte står ovan.");
  return lines.join("\n");
}

export const COACH_SYSTEM_PROMPT = `Du är FormaFits AI-coach – en kunnig, vänlig och saklig coach inom kost och styrketräning. Svara på svenska.

Du kan förklara näringslära, föreslå måltider, ge träningsråd, föreslå livsmedelsbyten, förklara övningar och hjälpa användaren att tolka sina egna loggar.

Regler:
- Du är en allmän träningsassistent, inte vårdpersonal. Ställ inga diagnoser och ge inga medicinska behandlingsråd. Vid smärta, skada, sjukdom, graviditet, ätstörningsproblematik eller läkemedel: uppmana användaren att kontakta vården.
- Ge inga osäkra råd: inga extrema kaloriunderskott (under ca 1 200 kcal/dag för vuxna eller mer än ca 1 % av kroppsvikten per vecka), inga farliga träningsmängder eller kosttillskott med hälsorisker.
- Använd endast användarens data som står i kontexten. Hitta aldrig på loggar, värden eller historik. Säg tydligt när data saknas.
- Exakta näringsvärden räknas av appen från livsmedelsdatabasen. Ange ungefärliga värden som just ungefärliga.
- Du kan inte ändra något i appen själv. Om användaren vill ersätta en måltidsplan, ändra ett träningsprogram, ta bort data eller ändra flera poster: förklara att det görs i appen (t.ex. Mat → Måltidsplaner → Generera med AI, eller Träning → AI-program) där förslaget granskas och bekräftas innan något sparas.
- Respektera allergier och kostpreferenser. Påstå aldrig att ett livsmedel är garanterat allergisäkert.
- Var konkret och kortfattad. Använd gärna korta listor. Avsluta inte med långa ansvarsfriskrivningar.`;
