"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Flame, Scale, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ChipGroup, OptionCards } from "@/components/ui/choice";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, UnitInput } from "@/components/ui/input";
import { ACTIVITY_LEVELS, calculateTargets, caloriesFromMacros, suggestActivityFromSteps, type ActivityLevel, type Goal, type Sex } from "@/lib/nutrition/targets";
import { ALLERGY_OPTIONS, DIET_OPTIONS, EQUIPMENT_OPTIONS, FULL_GYM } from "@/lib/options";
import { onboardingSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "./actions";

interface State {
  displayName: string;
  age: string;
  sex: Sex;
  heightCm: string;
  weightKg: string;
  goalWeightKg: string;
  goal: Goal | null;
  activityLevel: ActivityLevel | null;
  dailySteps: string;
  trainingDaysPerWeek: string;
  dietPreferences: string[];
  allergies: string[];
  foodRestrictions: string;
  mealsPerDay: string;
  experience: "beginner" | "intermediate" | "advanced" | null;
  equipment: string[];
}

const STEPS = ["Om dig", "Mål", "Aktivitet", "Kost", "Träning", "Dina mål"] as const;
const num = (v: string) => Number(v.replace(",", "."));

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<State>({
    displayName: "",
    age: "",
    sex: "unspecified",
    heightCm: "",
    weightKg: "",
    goalWeightKg: "",
    goal: null,
    activityLevel: null,
    dailySteps: "",
    trainingDaysPerWeek: "3",
    dietPreferences: [],
    allergies: [],
    foodRestrictions: "",
    mealsPerDay: "4",
    experience: null,
    equipment: [],
  });
  const [override, setOverride] = useState<{ calories: string; protein_g: string; carbs_g: string; fat_g: string } | null>(null);
  const set = <K extends keyof State>(key: K, value: State[K]) => setS((prev) => ({ ...prev, [key]: value }));

  const payload = () => ({
    displayName: s.displayName,
    age: s.age,
    sex: s.sex,
    heightCm: s.heightCm,
    weightKg: s.weightKg,
    goalWeightKg: s.goalWeightKg,
    goal: s.goal,
    activityLevel: s.activityLevel,
    dailySteps: s.dailySteps,
    trainingDaysPerWeek: s.trainingDaysPerWeek,
    dietPreferences: s.dietPreferences,
    allergies: s.allergies,
    foodRestrictions: s.foodRestrictions.split(",").map((x) => x.trim()).filter(Boolean),
    mealsPerDay: s.mealsPerDay,
    equipment: s.equipment,
    experience: s.experience,
  });

  const STEP_FIELDS: (keyof State)[][] = [
    ["displayName", "age", "sex", "heightCm"],
    ["weightKg", "goalWeightKg", "goal"],
    ["activityLevel", "dailySteps", "trainingDaysPerWeek"],
    ["dietPreferences", "allergies", "foodRestrictions", "mealsPerDay"],
    ["experience", "equipment"],
    [],
  ];

  function validateStep(index: number) {
    const result = onboardingSchema.safeParse(payload());
    const fields = STEP_FIELDS[index] as string[];
    const next: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (fields.includes(key) && !next[key]) {
          next[key] = issue.code === "invalid_value" || issue.code === "invalid_type" ? "Gör ett val." : issue.message;
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const calc = useMemo(() => {
    if (!s.goal || !s.activityLevel) return null;
    try {
      return calculateTargets({
        sex: s.sex,
        age: num(s.age),
        heightCm: num(s.heightCm),
        weightKg: num(s.weightKg),
        activityLevel: s.activityLevel,
        goal: s.goal,
      });
    } catch {
      return null;
    }
  }, [s.sex, s.age, s.heightCm, s.weightKg, s.activityLevel, s.goal]);

  const stepsHint = s.dailySteps ? suggestActivityFromSteps(num(s.dailySteps), num(s.trainingDaysPerWeek) || 0) : null;

  async function finish() {
    setSaving(true);
    const parsedOverride = override
      ? {
          calories: Math.round(num(override.calories)),
          protein_g: num(override.protein_g),
          carbs_g: num(override.carbs_g),
          fat_g: num(override.fat_g),
        }
      : null;
    const res = await completeOnboarding(payload(), parsedOverride);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Klart! Välkommen till FormaFit.");
    router.replace("/hem");
    router.refresh();
  }

  const next = () => {
    if (validateStep(step)) setStep((v) => Math.min(v + 1, STEPS.length - 1));
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 py-6">
      <header className="flex items-center justify-between">
        <Logo />
        <span className="text-sm text-muted-foreground">
          Steg {step + 1} av {STEPS.length}
        </span>
      </header>
      <div className="mt-6 flex gap-1.5" aria-hidden>
        {STEPS.map((label, i) => (
          <div key={label} className={cn("h-1.5 flex-1 rounded-full bg-surface-muted", i <= step && "bg-primary")} />
        ))}
      </div>

      <form
        className="mt-8 flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length - 1) next();
          else void finish();
        }}
        noValidate
      >
        <h1 className="text-2xl font-semibold tracking-tight">{STEPS[step]}</h1>

        {step === 0 && (
          <div className="mt-6 flex flex-col gap-5">
            <p className="text-sm text-muted-foreground">Vi använder bara uppgifterna för att uppskatta ditt energibehov.</p>
            <Field label="Namn eller smeknamn" htmlFor="displayName" error={errors.displayName}>
              <Input id="displayName" value={s.displayName} onChange={(e) => set("displayName", e.target.value)} autoComplete="nickname" aria-invalid={!!errors.displayName} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ålder" htmlFor="age" error={errors.age}>
                <UnitInput unit="år" id="age" inputMode="numeric" value={s.age} onChange={(e) => set("age", e.target.value)} aria-invalid={!!errors.age} />
              </Field>
              <Field label="Längd" htmlFor="heightCm" error={errors.heightCm}>
                <UnitInput unit="cm" id="heightCm" value={s.heightCm} onChange={(e) => set("heightCm", e.target.value)} aria-invalid={!!errors.heightCm} />
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Kön för energiformeln</span>
              <OptionCards
                name="sex"
                label="Kön"
                columns={3}
                value={s.sex}
                onChange={(v) => set("sex", v)}
                options={[
                  { value: "female", label: "Kvinna" },
                  { value: "male", label: "Man" },
                  { value: "unspecified", label: "Vill inte ange" },
                ]}
              />
              <p className="text-xs text-muted-foreground">Formeln skiljer sig något mellan könen. Utan val används ett medelvärde.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-6 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nuvarande vikt" htmlFor="weightKg" error={errors.weightKg}>
                <UnitInput unit="kg" id="weightKg" value={s.weightKg} onChange={(e) => set("weightKg", e.target.value)} aria-invalid={!!errors.weightKg} />
              </Field>
              <Field label="Målvikt" htmlFor="goalWeightKg" optional error={errors.goalWeightKg}>
                <UnitInput unit="kg" id="goalWeightKg" value={s.goalWeightKg} onChange={(e) => set("goalWeightKg", e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Huvudmål</span>
              <OptionCards
                name="goal"
                label="Huvudmål"
                value={s.goal}
                onChange={(v) => set("goal", v)}
                options={[
                  { value: "fat_loss", label: "Gå ned i fett", description: "Måttligt kaloriunderskott med högt protein", icon: <Flame className="size-5" /> },
                  { value: "muscle_gain", label: "Bygga muskler", description: "Litet överskott för att stödja träningen", icon: <TrendingUp className="size-5" /> },
                  { value: "maintenance", label: "Bibehålla", description: "Behåll vikten och förbättra formen", icon: <Scale className="size-5" /> },
                ]}
              />
              {errors.goal ? <p className="text-sm text-danger">{errors.goal}</p> : null}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 flex flex-col gap-5">
            <OptionCards
              name="activity"
              label="Aktivitetsnivå"
              value={s.activityLevel}
              onChange={(v) => set("activityLevel", v)}
              options={(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((k) => ({
                value: k,
                label: `${ACTIVITY_LEVELS[k].label} (× ${ACTIVITY_LEVELS[k].multiplier.toLocaleString("sv-SE")})`,
                description: ACTIVITY_LEVELS[k].description,
              }))}
            />
            {errors.activityLevel ? <p className="text-sm text-danger">{errors.activityLevel}</p> : null}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Steg per dag" htmlFor="dailySteps" optional>
                <UnitInput unit="steg" id="dailySteps" inputMode="numeric" value={s.dailySteps} onChange={(e) => set("dailySteps", e.target.value)} />
              </Field>
              <Field label="Träningspass per vecka" htmlFor="trainingDays" error={errors.trainingDaysPerWeek}>
                <UnitInput unit="pass" id="trainingDays" inputMode="numeric" value={s.trainingDaysPerWeek} onChange={(e) => set("trainingDaysPerWeek", e.target.value)} />
              </Field>
            </div>
            {stepsHint && stepsHint !== s.activityLevel ? (
              <Notice>
                Utifrån steg och träning kan nivån <strong>{ACTIVITY_LEVELS[stepsHint].label.toLowerCase()}</strong> passa. Du väljer själv.
              </Notice>
            ) : null}
          </div>
        )}

        {step === 3 && (
          <div className="mt-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Kostpreferenser</span>
              <ChipGroup label="Kostpreferenser" values={s.dietPreferences} onChange={(v) => set("dietPreferences", v)} options={DIET_OPTIONS} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Allergier och intoleranser</span>
              <ChipGroup label="Allergier" values={s.allergies} onChange={(v) => set("allergies", v)} options={ALLERGY_OPTIONS} />
              <p className="text-xs text-muted-foreground">
                Vi filtrerar förslag efter detta, men allergeninformation kan vara ofullständig. Läs alltid förpackningen.
              </p>
            </div>
            <Field label="Andra restriktioner" htmlFor="restrictions" optional hint="Separera med kommatecken, t.ex. koriander, fläsk">
              <Input id="restrictions" value={s.foodRestrictions} onChange={(e) => set("foodRestrictions", e.target.value)} />
            </Field>
            <Field label="Måltider per dag" htmlFor="meals" error={errors.mealsPerDay}>
              <UnitInput unit="st" id="meals" inputMode="numeric" value={s.mealsPerDay} onChange={(e) => set("mealsPerDay", e.target.value)} className="max-w-40" />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="mt-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Träningserfarenhet</span>
              <OptionCards
                name="experience"
                label="Träningserfarenhet"
                value={s.experience}
                onChange={(v) => set("experience", v)}
                options={[
                  { value: "beginner", label: "Nybörjare", description: "Mindre än ett år av regelbunden styrketräning" },
                  { value: "intermediate", label: "Van", description: "1–3 år, kan grundövningarna" },
                  { value: "advanced", label: "Avancerad", description: "Mer än 3 år, strukturerad progression" },
                ]}
              />
              {errors.experience ? <p className="text-sm text-danger">{errors.experience}</p> : null}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Tillgänglig utrustning</span>
                <Button type="button" variant="link" size="sm" onClick={() => set("equipment", FULL_GYM)}>
                  Fullt gym
                </Button>
              </div>
              <ChipGroup label="Utrustning" values={s.equipment} onChange={(v) => set("equipment", v)} options={EQUIPMENT_OPTIONS} />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="mt-6 flex flex-col gap-5">
            {calc ? (
              <>
                <div className="rounded-3xl border bg-surface p-5 shadow-[var(--shadow-card)]">
                  <p className="text-sm text-muted-foreground">Föreslaget dagligt mål</p>
                  <p className="mt-1 text-4xl font-semibold tabular">
                    {(override ? Math.round(num(override.calories)) : calc.calories).toLocaleString("sv-SE")} <span className="text-lg font-normal text-muted-foreground">kcal</span>
                  </p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                    {([
                      ["Protein", "protein_g"],
                      ["Kolhydrater", "carbs_g"],
                      ["Fett", "fat_g"],
                    ] as const).map(([label, key]) => (
                      <div key={key} className="rounded-2xl bg-surface-muted p-3">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-semibold tabular">{override ? override[key] : calc[key]} g</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <details className="rounded-2xl border bg-surface p-4 text-sm">
                  <summary className="cursor-pointer font-medium">Så har vi räknat</summary>
                  <ul className="mt-3 space-y-1.5 text-muted-foreground">
                    <li>Vilometabolism (Mifflin–St Jeor): {Math.round(calc.bmr)} kcal</li>
                    <li>
                      Aktivitetsfaktor: × {calc.activityMultiplier.toLocaleString("sv-SE")} ({ACTIVITY_LEVELS[s.activityLevel!].label.toLowerCase()}) ={" "}
                      {Math.round(calc.tdee)} kcal
                    </li>
                    <li>Måljustering: {calc.goalAdjustmentPct > 0 ? "+" : ""}{calc.goalAdjustmentPct} %</li>
                    <li>Protein: utifrån {Math.round(calc.referenceWeightKg)} kg referensvikt. Fett: minst 25 % av energin. Resten kolhydrater.</li>
                  </ul>
                </details>
                {calc.warnings.map((w) => (
                  <Notice key={w} variant="warning">
                    {w}
                  </Notice>
                ))}
                <Notice title="En startpunkt, inte en mätning">
                  Energibehovet är en uppskattning. Följ din vikt i 2–3 veckor och justera vid behov. Vi ändrar aldrig dina mål utan att du
                  godkänner det.
                </Notice>
                {override ? (
                  <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-surface p-4 sm:grid-cols-4">
                    {([
                      ["Kalorier", "calories", "kcal"],
                      ["Protein", "protein_g", "g"],
                      ["Kolhydrater", "carbs_g", "g"],
                      ["Fett", "fat_g", "g"],
                    ] as const).map(([label, key, unit]) => (
                      <Field key={key} label={label} htmlFor={`ov-${key}`}>
                        <UnitInput unit={unit} id={`ov-${key}`} value={override[key]} onChange={(e) => setOverride({ ...override, [key]: e.target.value })} />
                      </Field>
                    ))}
                    <p className="col-span-full text-xs text-muted-foreground">
                      Makron motsvarar{" "}
                      {Math.round(caloriesFromMacros({ protein_g: num(override.protein_g) || 0, carbs_g: num(override.carbs_g) || 0, fat_g: num(override.fat_g) || 0 }))} kcal.
                    </p>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setOverride({
                        calories: String(calc.calories),
                        protein_g: String(calc.protein_g),
                        carbs_g: String(calc.carbs_g),
                        fat_g: String(calc.fat_g),
                      })
                    }
                  >
                    Justera manuellt
                  </Button>
                )}
              </>
            ) : (
              <Notice variant="warning">Vi kunde inte räkna ut ett mål. Gå tillbaka och kontrollera dina uppgifter.</Notice>
            )}
          </div>
        )}

        <div className="mt-auto flex gap-3 pt-10">
          {step > 0 ? (
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(step - 1)}>
              <ArrowLeft /> Tillbaka
            </Button>
          ) : null}
          <Button type="submit" size="lg" className="flex-1" loading={saving} disabled={step === STEPS.length - 1 && !calc}>
            {step < STEPS.length - 1 ? (
              <>
                Fortsätt <ArrowRight />
              </>
            ) : (
              "Spara och börja"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
