/** Swedish display labels for database enums and keys. */

export const MEAL_SLOT_LABELS = {
  breakfast: "Frukost",
  lunch: "Lunch",
  dinner: "Middag",
  snack: "Mellanmål",
} as const;

export const GOAL_LABELS = {
  fat_loss: "Fettminskning",
  muscle_gain: "Muskelökning",
  maintenance: "Bibehålla",
} as const;

export const EXPERIENCE_LABELS = {
  beginner: "Nybörjare",
  intermediate: "Van",
  advanced: "Avancerad",
} as const;

export const SEX_LABELS = {
  female: "Kvinna",
  male: "Man",
  unspecified: "Vill inte ange",
} as const;

export const MUSCLE_LABELS: Record<string, string> = {
  chest: "Bröst",
  lats: "Latissimus",
  upper_back: "Övre rygg",
  lower_back: "Ländrygg",
  traps: "Kappmuskel",
  shoulders: "Axlar",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Underarmar",
  quads: "Framsida lår",
  hamstrings: "Baksida lår",
  glutes: "Säte",
  calves: "Vader",
  core: "Bål",
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Skivstång",
  dumbbell: "Hantlar",
  machine: "Maskin",
  cable: "Kabel",
  bodyweight: "Kroppsvikt",
  kettlebell: "Kettlebell",
  bands: "Gummiband",
  ez_bar: "EZ-stång",
  pullup_bar: "Chinsstång",
  smith_machine: "Smithmaskin",
};

export const SPLIT_LABELS = {
  push_pull_legs: "Push/Pull/Ben",
  upper_lower: "Över-/underkropp",
  full_body: "Helkropp",
  bro_split: "5-dagars split",
  custom: "Eget program",
} as const;

export const VERIFICATION_LABELS = {
  verified: { label: "Verifierad", description: "Värden från en officiell databas." },
  community: { label: "Communitydata", description: "Från Open Food Facts – kontrollera mot förpackningen." },
  user_entered: { label: "Egen", description: "Värden du har angett själv." },
  estimated: { label: "Uppskattat", description: "Ungefärligt referensvärde – kontrollera mot förpackningen." },
} as const;

export const SOURCE_LABELS = {
  livsmedelsverket: "Livsmedelsverket",
  openfoodfacts: "Open Food Facts",
  user: "Egen registrering",
  starter_reference: "FormaFit startdata (uppskattning)",
} as const;

export const FEEDBACK_LABELS = {
  too_easy: "För lätt",
  just_right: "Lagom",
  too_hard: "För tungt",
} as const;
