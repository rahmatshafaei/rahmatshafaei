/**
 * Built-in program templates. Exercises are referenced by starter-library slug and are
 * resolved to real exercise records when a program is created from the template.
 */
export interface TemplateExercise {
  slug: string;
  sets: number;
  repMin: number;
  repMax: number;
  rest: number;
  superset?: number;
}

export interface TemplateDay {
  name: string;
  weekday: number | null;
  rest?: boolean;
  exercises: TemplateExercise[];
}

export interface ProgramTemplate {
  key: string;
  name: string;
  split: "push_pull_legs" | "upper_lower" | "full_body" | "bro_split";
  description: string;
  level: string;
  days: TemplateDay[];
}

const ex = (slug: string, sets: number, repMin: number, repMax: number, rest = 90, superset?: number): TemplateExercise => ({ slug, sets, repMin, repMax, rest, superset });

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    key: "full-body-3",
    name: "Helkropp 3 dagar",
    split: "full_body",
    level: "Nybörjare",
    description: "Tre helkroppspass i veckan med grundövningar. Bra start för nybörjare.",
    days: [
      { name: "Helkropp A", weekday: 1, exercises: [ex("knabojs", 3, 6, 10, 150), ex("bankpress", 3, 6, 10, 120), ex("sittande-kabelrodd", 3, 8, 12), ex("planka", 3, 1, 1, 60)] },
      { name: "Vila", weekday: 2, rest: true, exercises: [] },
      { name: "Helkropp B", weekday: 3, exercises: [ex("rumansk-marklyft", 3, 8, 10, 120), ex("axelpress-hantlar", 3, 8, 12), ex("latsdrag", 3, 8, 12), ex("utfall-hantlar", 2, 10, 12)] },
      { name: "Vila", weekday: 4, rest: true, exercises: [] },
      { name: "Helkropp C", weekday: 5, exercises: [ex("benpress", 3, 10, 12, 120), ex("lutande-hantelpress", 3, 8, 12), ex("hantelrodd", 3, 8, 12), ex("hantelcurl", 2, 10, 12, 60, 1), ex("triceps-pushdown", 2, 10, 12, 60, 1)] },
    ],
  },
  {
    key: "upper-lower-4",
    name: "Över/under 4 dagar",
    split: "upper_lower",
    level: "Van",
    description: "Överkropp och underkropp två gånger var per vecka.",
    days: [
      { name: "Överkropp 1", weekday: 1, exercises: [ex("bankpress", 4, 5, 8, 150), ex("skivstangsrodd", 4, 6, 10, 120), ex("axelpress-hantlar", 3, 8, 12), ex("latsdrag", 3, 8, 12), ex("skivstangscurl", 2, 10, 12, 60, 1), ex("fransk-press", 2, 10, 12, 60, 1)] },
      { name: "Underkropp 1", weekday: 2, exercises: [ex("knabojs", 4, 5, 8, 180), ex("rumansk-marklyft", 3, 8, 10, 120), ex("benspark", 3, 10, 15), ex("liggande-larcurl", 3, 10, 15), ex("vadpress-staende", 3, 10, 15, 60)] },
      { name: "Vila", weekday: 3, rest: true, exercises: [] },
      { name: "Överkropp 2", weekday: 4, exercises: [ex("lutande-hantelpress", 3, 8, 12), ex("chins", 3, 6, 10, 120), ex("sidolyft", 3, 12, 15, 60), ex("sittande-kabelrodd", 3, 10, 12), ex("hammarcurl", 2, 10, 12, 60, 1), ex("triceps-pushdown", 2, 10, 12, 60, 1)] },
      { name: "Underkropp 2", weekday: 5, exercises: [ex("marklyft", 3, 4, 6, 180), ex("benpress", 3, 10, 12, 120), ex("bulgarisk-splitbo", 3, 8, 12), ex("sittande-larcurl", 3, 10, 15), ex("hangande-benlyft", 3, 10, 15, 60)] },
    ],
  },
  {
    key: "ppl-6",
    name: "Push/Pull/Ben",
    split: "push_pull_legs",
    level: "Van–avancerad",
    description: "Klassisk PPL. Kör den två varv per vecka eller ett varv för tre pass.",
    days: [
      { name: "Push", weekday: 1, exercises: [ex("bankpress", 4, 5, 8, 150), ex("militarpress", 3, 6, 10, 120), ex("lutande-hantelpress", 3, 8, 12), ex("sidolyft", 3, 12, 15, 60), ex("triceps-pushdown", 3, 10, 12, 60)] },
      { name: "Pull", weekday: 2, exercises: [ex("pullups", 4, 6, 10, 120), ex("skivstangsrodd", 3, 6, 10, 120), ex("face-pulls", 3, 12, 15, 60), ex("hantelcurl", 3, 10, 12, 60), ex("hammarcurl", 2, 10, 12, 60)] },
      { name: "Ben", weekday: 3, exercises: [ex("knabojs", 4, 5, 8, 180), ex("rumansk-marklyft", 3, 8, 10, 120), ex("benpress", 3, 10, 12, 120), ex("liggande-larcurl", 3, 10, 15), ex("vadpress-staende", 4, 10, 15, 60)] },
      { name: "Vila", weekday: 4, rest: true, exercises: [] },
      { name: "Push 2", weekday: 5, exercises: [ex("lutande-bankpress", 4, 6, 10, 120), ex("axelpress-hantlar", 3, 8, 12), ex("kabelflyes", 3, 12, 15, 60), ex("sidolyft-kabel", 3, 12, 15, 60), ex("triceps-over-huvudet", 3, 10, 12, 60)] },
      { name: "Pull 2", weekday: 6, exercises: [ex("latsdrag", 4, 8, 12), ex("sittande-kabelrodd", 3, 8, 12), ex("omvanda-flyes", 3, 12, 15, 60), ex("scottcurl", 3, 10, 12, 60), ex("shrugs", 3, 10, 12, 60)] },
      { name: "Ben 2", weekday: 7, exercises: [ex("frontbo", 3, 6, 10, 150), ex("hip-thrust", 3, 8, 12, 120), ex("bulgarisk-splitbo", 3, 8, 12), ex("benspark", 3, 12, 15, 60), ex("vadpress-sittande", 3, 12, 15, 60)] },
    ],
  },
  {
    key: "bro-split-5",
    name: "5-dagars bodybuildingsplit",
    split: "bro_split",
    level: "Avancerad",
    description: "En muskelgrupp per dag med hög volym – för vana bodybuilders.",
    days: [
      { name: "Bröst", weekday: 1, exercises: [ex("bankpress", 4, 6, 10, 150), ex("lutande-hantelpress", 4, 8, 12), ex("brostpress-maskin", 3, 10, 12), ex("pec-deck", 3, 12, 15, 60), ex("dips", 3, 8, 12)] },
      { name: "Rygg", weekday: 2, exercises: [ex("marklyft", 3, 4, 6, 180), ex("pullups", 4, 6, 10, 120), ex("skivstangsrodd", 4, 8, 10, 120), ex("latsdrag", 3, 10, 12), ex("sittande-kabelrodd", 3, 10, 12)] },
      { name: "Axlar", weekday: 3, exercises: [ex("militarpress", 4, 6, 10, 120), ex("arnoldpress", 3, 8, 12), ex("sidolyft", 4, 12, 15, 60), ex("omvanda-flyes", 3, 12, 15, 60), ex("shrugs", 3, 10, 12, 60)] },
      { name: "Ben", weekday: 4, exercises: [ex("knabojs", 4, 6, 10, 180), ex("benpress", 4, 10, 12, 120), ex("rumansk-marklyft", 3, 8, 10, 120), ex("benspark", 3, 12, 15, 60, 1), ex("liggande-larcurl", 3, 12, 15, 60, 1), ex("vadpress-staende", 4, 10, 15, 60)] },
      { name: "Armar", weekday: 5, exercises: [ex("smal-bankpress", 3, 6, 10, 120), ex("skivstangscurl", 3, 8, 12, 60, 1), ex("fransk-press", 3, 8, 12, 60, 1), ex("hammarcurl", 3, 10, 12, 60, 2), ex("triceps-pushdown", 3, 10, 12, 60, 2), ex("scottcurl", 2, 12, 15, 60)] },
      { name: "Vila", weekday: 6, rest: true, exercises: [] },
      { name: "Vila", weekday: 7, rest: true, exercises: [] },
    ],
  },
];
