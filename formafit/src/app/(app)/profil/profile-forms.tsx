"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Calculator, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/choice";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Select, UnitInput } from "@/components/ui/input";
import { ACTIVITY_LEVELS, caloriesFromMacros, type TargetResult } from "@/lib/nutrition/targets";
import { EXPERIENCE_LABELS, GOAL_LABELS, SEX_LABELS } from "@/lib/labels";
import { ALLERGY_OPTIONS, DIET_OPTIONS, EQUIPMENT_OPTIONS } from "@/lib/options";
import type { Tables } from "@/lib/supabase/database.types";
import { applyRecalculation, previewRecalculation, saveManualTargets, updatePreferences, updateProfile } from "./actions";

const n = (v: string) => Number(v.replace(",", "."));

export function TargetsCard({ targets, waterGoalMl }: { targets: Tables<"nutrition_targets"> | null; waterGoalMl: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<TargetResult | null>(null);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    calories: String(targets?.calories ?? ""),
    protein_g: String(targets?.protein_g ?? ""),
    carbs_g: String(targets?.carbs_g ?? ""),
    fat_g: String(targets?.fat_g ?? ""),
    water_ml: String(waterGoalMl),
  });

  const macroKcal = caloriesFromMacros({ protein_g: n(form.protein_g) || 0, carbs_g: n(form.carbs_g) || 0, fat_g: n(form.fat_g) || 0 });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Dagliga mål</CardTitle>
          <CardDescription>
            {targets?.is_manually_adjusted
              ? "Manuellt justerade mål."
              : targets
                ? `Beräknat med Mifflin–St Jeor × ${Number(targets.activity_multiplier).toLocaleString("sv-SE")}.`
                : "Inga mål ännu."}
          </CardDescription>
        </div>
        {targets?.is_manually_adjusted ? <Badge variant="info">Manuellt</Badge> : <Badge variant="primary">Beräknat</Badge>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!editing ? (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["Kalorier", `${targets?.calories ?? "–"} kcal`],
              ["Protein", `${targets?.protein_g ?? "–"} g`],
              ["Kolhydrater", `${targets?.carbs_g ?? "–"} g`],
              ["Fett", `${targets?.fat_g ?? "–"} g`],
              ["Vatten", `${(waterGoalMl / 1000).toLocaleString("sv-SE")} l`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-surface-muted p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-semibold tabular">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await saveManualTargets(form);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Målen är sparade.");
                setEditing(false);
                router.refresh();
              });
            }}
          >
            <Field label="Kalorier" htmlFor="t-cal">
              <UnitInput unit="kcal" id="t-cal" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} />
            </Field>
            <Field label="Protein" htmlFor="t-p">
              <UnitInput unit="g" id="t-p" value={form.protein_g} onChange={(e) => setForm({ ...form, protein_g: e.target.value })} />
            </Field>
            <Field label="Kolhydrater" htmlFor="t-c">
              <UnitInput unit="g" id="t-c" value={form.carbs_g} onChange={(e) => setForm({ ...form, carbs_g: e.target.value })} />
            </Field>
            <Field label="Fett" htmlFor="t-f">
              <UnitInput unit="g" id="t-f" value={form.fat_g} onChange={(e) => setForm({ ...form, fat_g: e.target.value })} />
            </Field>
            <Field label="Vatten" htmlFor="t-w">
              <UnitInput unit="ml" id="t-w" value={form.water_ml} onChange={(e) => setForm({ ...form, water_ml: e.target.value })} />
            </Field>
            <p className="col-span-full text-xs text-muted-foreground">
              Makronas energi: {Math.round(macroKcal)} kcal
              {Math.abs(macroKcal - n(form.calories)) > 50 ? " – skiljer sig från kalorimålet." : "."}
            </p>
            <div className="col-span-full flex gap-2">
              <Button type="submit" loading={pending}>
                Spara mål
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Avbryt
              </Button>
            </div>
          </form>
        )}
        {!editing ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <PencilLine /> Justera manuellt
            </Button>
            <Button
              variant="soft"
              loading={pending && !editing}
              onClick={() =>
                start(async () => {
                  const res = await previewRecalculation();
                  if (!res.ok) return void toast.error(res.error);
                  setPreview(res.data.result);
                })
              }
            >
              <Calculator /> Räkna om från profil
            </Button>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Målen är uppskattningar och en startpunkt. Följ vikten i några veckor och justera vid behov.
        </p>
      </CardContent>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        {preview ? (
          <DialogContent title="Nya beräknade mål" description="Granska förändringen innan du sparar.">
            <table className="w-full text-sm tabular">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1 font-normal" />
                  <th className="py-1 font-normal">Nu</th>
                  <th className="py-1 font-normal">Nytt</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ["Kalorier", targets?.calories, preview.calories, "kcal"],
                  ["Protein", targets?.protein_g, preview.protein_g, "g"],
                  ["Kolhydrater", targets?.carbs_g, preview.carbs_g, "g"],
                  ["Fett", targets?.fat_g, preview.fat_g, "g"],
                ] as const).map(([label, current, next, unit]) => (
                  <tr key={label} className="border-t">
                    <td className="py-2">{label}</td>
                    <td className="py-2 text-muted-foreground">{current ?? "–"} {unit}</td>
                    <td className="py-2 font-semibold">{next} {unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.warnings.map((w) => (
              <Notice key={w} variant="warning" className="mt-3">
                {w}
              </Notice>
            ))}
            {targets?.is_manually_adjusted ? (
              <Notice className="mt-3">Dina manuella justeringar ersätts om du sparar.</Notice>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Behåll nuvarande
              </Button>
              <Button
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const res = await applyRecalculation();
                    if (!res.ok) return void toast.error(res.error);
                    toast.success("Nya mål sparade.");
                    setPreview(null);
                    router.refresh();
                  })
                }
              >
                Spara nya mål
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </Card>
  );
}

export function ProfileForm({ profile }: { profile: Tables<"profiles"> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [s, setS] = useState({
    displayName: profile.display_name ?? "",
    age: String(profile.age ?? ""),
    sex: profile.sex,
    heightCm: String(profile.height_cm ?? ""),
    goalWeightKg: profile.goal_weight_kg ? String(profile.goal_weight_kg) : "",
    activityLevel: profile.activity_level ?? "moderate",
    dailySteps: profile.daily_steps ? String(profile.daily_steps) : "",
    trainingDaysPerWeek: String(profile.training_days_per_week ?? 3),
    goal: profile.goal ?? "maintenance",
    dietPreferences: profile.diet_preferences,
    allergies: profile.allergies,
    foodRestrictions: profile.food_restrictions.join(", "),
    mealsPerDay: String(profile.meals_per_day),
    equipment: profile.equipment,
    experience: profile.experience ?? "beginner",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((p) => ({ ...p, [k]: v }));

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateProfile({
            ...s,
            foodRestrictions: s.foodRestrictions.split(",").map((x) => x.trim()).filter(Boolean),
          });
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            return void toast.error(res.error);
          }
          setErrors({});
          toast.success("Profilen är uppdaterad.");
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Namn" htmlFor="p-name" error={errors.displayName}>
          <Input id="p-name" value={s.displayName} onChange={(e) => set("displayName", e.target.value)} />
        </Field>
        <Field label="Kön (för formeln)" htmlFor="p-sex">
          <Select id="p-sex" value={s.sex} onChange={(e) => set("sex", e.target.value as typeof s.sex)}>
            {Object.entries(SEX_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ålder" htmlFor="p-age" error={errors.age}>
          <UnitInput unit="år" id="p-age" value={s.age} onChange={(e) => set("age", e.target.value)} />
        </Field>
        <Field label="Längd" htmlFor="p-height" error={errors.heightCm}>
          <UnitInput unit="cm" id="p-height" value={s.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
        </Field>
        <Field label="Målvikt" htmlFor="p-goalw" optional error={errors.goalWeightKg}>
          <UnitInput unit="kg" id="p-goalw" value={s.goalWeightKg} onChange={(e) => set("goalWeightKg", e.target.value)} />
        </Field>
        <Field label="Mål" htmlFor="p-goal">
          <Select id="p-goal" value={s.goal} onChange={(e) => set("goal", e.target.value as typeof s.goal)}>
            {Object.entries(GOAL_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Aktivitetsnivå" htmlFor="p-act">
          <Select id="p-act" value={s.activityLevel} onChange={(e) => set("activityLevel", e.target.value as typeof s.activityLevel)}>
            {Object.entries(ACTIVITY_LEVELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l.label} (× {l.multiplier.toLocaleString("sv-SE")})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Steg per dag" htmlFor="p-steps" optional>
          <UnitInput unit="steg" id="p-steps" value={s.dailySteps} onChange={(e) => set("dailySteps", e.target.value)} />
        </Field>
        <Field label="Träningspass per vecka" htmlFor="p-days" error={errors.trainingDaysPerWeek}>
          <UnitInput unit="pass" id="p-days" value={s.trainingDaysPerWeek} onChange={(e) => set("trainingDaysPerWeek", e.target.value)} />
        </Field>
        <Field label="Måltider per dag" htmlFor="p-meals" error={errors.mealsPerDay}>
          <UnitInput unit="st" id="p-meals" value={s.mealsPerDay} onChange={(e) => set("mealsPerDay", e.target.value)} />
        </Field>
        <Field label="Erfarenhet" htmlFor="p-exp">
          <Select id="p-exp" value={s.experience} onChange={(e) => set("experience", e.target.value as typeof s.experience)}>
            {Object.entries(EXPERIENCE_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Andra restriktioner" htmlFor="p-restr" optional hint="Separera med kommatecken">
          <Input id="p-restr" value={s.foodRestrictions} onChange={(e) => set("foodRestrictions", e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Kostpreferenser</span>
        <ChipGroup label="Kostpreferenser" values={s.dietPreferences} onChange={(v) => set("dietPreferences", v)} options={DIET_OPTIONS} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Allergier och intoleranser</span>
        <ChipGroup label="Allergier" values={s.allergies} onChange={(v) => set("allergies", v)} options={ALLERGY_OPTIONS} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Utrustning</span>
        <ChipGroup label="Utrustning" values={s.equipment} onChange={(v) => set("equipment", v)} options={EQUIPMENT_OPTIONS} />
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Spara profil
        </Button>
      </div>
    </form>
  );
}

export function PreferencesForm({ prefs, aiConfigured }: { prefs: Tables<"user_preferences">; aiConfigured: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [s, setS] = useState({
    defaultRestSeconds: String(prefs.default_rest_seconds),
    weightIncrementKg: String(prefs.weight_increment_kg),
    aiShareLogs: prefs.ai_share_logs,
  });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updatePreferences({ ...s, weightIncrementKg: s.weightIncrementKg.replace(",", ".") });
          if (!res.ok) return void toast.error(res.error);
          toast.success("Inställningarna är sparade.");
          router.refresh();
        });
      }}
    >
      <Field label="Standardvila mellan set" htmlFor="pr-rest">
        <UnitInput unit="sek" id="pr-rest" value={s.defaultRestSeconds} onChange={(e) => setS({ ...s, defaultRestSeconds: e.target.value })} />
      </Field>
      <Field label="Minsta viktökning" htmlFor="pr-inc" hint="Används i progressionsförslag.">
        <UnitInput unit="kg" id="pr-inc" value={s.weightIncrementKg} onChange={(e) => setS({ ...s, weightIncrementKg: e.target.value })} />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-[var(--primary)]"
          checked={s.aiShareLogs}
          onChange={(e) => setS({ ...s, aiShareLogs: e.target.checked })}
        />
        <span>
          <span className="font-medium">Låt AI-coachen läsa sammanfattningar av mina loggar</span>
          <span className="block text-muted-foreground">Endast det som är relevant för frågan skickas.</span>
        </span>
      </label>
      {!aiConfigured ? <Notice variant="warning">AI-funktionerna är inte konfigurerade på den här servern.</Notice> : null}
      <Button type="submit" variant="outline" loading={pending}>
        Spara inställningar
      </Button>
    </form>
  );
}
