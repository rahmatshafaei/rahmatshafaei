"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeftRight, BookPlus, RefreshCw, Save, Scale, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea, UnitInput } from "@/components/ui/input";
import { MacroLine } from "@/components/nutrition/macro-bar";
import { MEAL_SLOT_LABELS } from "@/lib/labels";
import type { MealPlanDraft } from "@/lib/ai/meal-plan-draft";
import { compareToTargets, isValidQuantity, mealTotals, scalePortionsToCalories, sumNutrients, toPer100g } from "@/lib/nutrition/engine";
import type { FoodSummary, MealSlot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { addFoodsToDiary } from "../../actions";
import { generateMealPlan, regenerateMeal, saveGeneratedPlan } from "../ai-actions";
import { DraftSubstituteDialog } from "./draft-substitute";
import { todayIso } from "@/lib/dates";

interface Defaults {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  mealsPerDay: number;
  startDate: string;
}

interface EditableMeal {
  key: string;
  name: string;
  slot: MealSlot;
  time: string | null;
  prepMinutes: number | null;
  instructions: string;
  ingredients: { key: string; food: FoodSummary; quantity: string }[];
}

const toEditable = (draft: MealPlanDraft) =>
  draft.days.map((d) =>
    d.meals.map((m) => ({
      key: crypto.randomUUID(),
      name: m.name,
      slot: m.slot,
      time: m.time,
      prepMinutes: m.prepMinutes,
      instructions: m.instructions,
      ingredients: m.ingredients.map((i) => ({ key: crypto.randomUUID(), food: i.food, quantity: String(i.quantityG) })),
    })),
  );

const qty = (s: string) => Number(s.replace(",", "."));
const editableTotals = (m: EditableMeal) =>
  mealTotals(m.ingredients.filter((i) => isValidQuantity(qty(i.quantity))).map((i) => ({ per100: toPer100g(i.food), quantityG: qty(i.quantity) })));

export function MealPlanGenerator({ defaults, aiEnabled }: { defaults: Defaults; aiEnabled: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    calories: String(defaults.calories),
    protein_g: String(defaults.protein_g),
    carbs_g: String(defaults.carbs_g),
    fat_g: String(defaults.fat_g),
    mealsPerDay: String(defaults.mealsPerDay),
    days: "3",
    preferences: "",
    budget: "medium",
    maxCookingMinutes: "30",
    availableIngredients: "",
    startDate: defaults.startDate,
  });
  const [draft, setDraft] = useState<{ notes: string; discrepancies: string[]; excludedUnknown: number } | null>(null);
  const [days, setDays] = useState<EditableMeal[][]>([]);
  const [activeDay, setActiveDay] = useState(0);
  const [planName, setPlanName] = useState("AI-plan");
  const [pending, start] = useTransition();
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [substitute, setSubstitute] = useState<{ day: number; meal: string; ing: string; food: FoodSummary; grams: number } | null>(null);

  async function logMeal(meal: EditableMeal) {
    const items = meal.ingredients.filter((i) => isValidQuantity(qty(i.quantity))).map((i) => ({ foodId: i.food.id, quantityG: qty(i.quantity) }));
    const res = await addFoodsToDiary({ date: todayIso(), slot: meal.slot, label: meal.name, items });
    if (!res.ok) return void toast.error(res.error);
    toast.success(`${meal.name} loggad i dagens dagbok`);
  }

  const targets = { calories: qty(form.calories), protein_g: qty(form.protein_g), carbs_g: qty(form.carbs_g), fat_g: qty(form.fat_g) };
  const dayTotals = useMemo(() => days.map((meals) => sumNutrients(meals.map(editableTotals))), [days]);

  function updateMeal(day: number, key: string, fn: (m: EditableMeal) => EditableMeal) {
    setDays((ds) => ds.map((meals, i) => (i === day ? meals.map((m) => (m.key === key ? fn(m) : m)) : meals)));
  }

  function generate() {
    start(async () => {
      const res = await generateMealPlan(form);
      if (!res.ok) return void toast.error(res.error);
      setDraft({ notes: res.data.notes, discrepancies: res.data.discrepancies, excludedUnknown: res.data.excludedUnknown });
      setDays(toEditable(res.data));
      setActiveDay(0);
    });
  }

  async function regenerate(day: number, meal: EditableMeal) {
    setRegenerating(meal.key);
    const others = days[day].filter((m) => m.key !== meal.key);
    const otherTotals = sumNutrients(others.map(editableTotals));
    const res = await regenerateMeal({
      slot: meal.slot,
      targetKcal: Math.max(150, targets.calories - otherTotals.kcal),
      targetProtein: Math.max(10, targets.protein_g - otherTotals.protein),
      otherMealNames: others.map((m) => m.name),
      currentName: meal.name,
    });
    setRegenerating(null);
    if (!res.ok) return void toast.error(res.error);
    const m = res.data.meal;
    updateMeal(day, meal.key, () => ({
      key: meal.key,
      name: m.name,
      slot: m.slot,
      time: m.time ?? meal.time,
      prepMinutes: m.prepMinutes,
      instructions: m.instructions,
      ingredients: m.ingredients.map((i) => ({ key: crypto.randomUUID(), food: i.food, quantity: String(i.quantityG) })),
    }));
    toast.success("Ny måltid föreslagen – granska innan du sparar");
  }

  function scaleDay(day: number) {
    const meals = days[day];
    const flat = meals.flatMap((m) => m.ingredients.map((i) => ({ meal: m.key, key: i.key, per100: toPer100g(i.food), quantityG: qty(i.quantity) })));
    const valid = flat.filter((f) => isValidQuantity(f.quantityG));
    const scaled = scalePortionsToCalories(valid, targets.calories);
    const byKey = new Map(valid.map((f, i) => [f.key, scaled.portions[i].quantityG]));
    setDays((ds) =>
      ds.map((ms, i) =>
        i === day ? ms.map((m) => ({ ...m, ingredients: m.ingredients.map((ing) => (byKey.has(ing.key) ? { ...ing, quantity: String(byKey.get(ing.key)) } : ing)) })) : ms,
      ),
    );
  }

  async function save() {
    const meals = days.flatMap((ms, dayIndex) =>
      ms
        .map((m) => ({
          dayIndex,
          name: m.name,
          slot: m.slot,
          time: m.time,
          prepMinutes: m.prepMinutes,
          instructions: m.instructions,
          ingredients: m.ingredients.filter((i) => isValidQuantity(qty(i.quantity))).map((i) => ({ foodId: i.food.id, quantityG: qty(i.quantity) })),
        }))
        .filter((m) => m.ingredients.length),
    );
    setSaving(true);
    const res = await saveGeneratedPlan(
      { name: planName, startDate: form.startDate, numDays: days.length, notes: draft?.notes, meals },
      { targets, request: { preferences: form.preferences, budget: form.budget, maxCookingMinutes: form.maxCookingMinutes } },
    );
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Planen är sparad");
    router.push(`/mat/planer/${res.data.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-5">
          <form
            className="grid gap-4 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            {([
              ["calories", "Kalorier", "kcal"],
              ["protein_g", "Protein", "g"],
              ["carbs_g", "Kolhydrater", "g"],
              ["fat_g", "Fett", "g"],
            ] as const).map(([key, label, unit]) => (
              <Field key={key} label={label} htmlFor={`gen-${key}`}>
                <UnitInput unit={unit} id={`gen-${key}`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </Field>
            ))}
            <Field label="Måltider per dag" htmlFor="gen-meals">
              <UnitInput unit="st" id="gen-meals" value={form.mealsPerDay} onChange={(e) => setForm({ ...form, mealsPerDay: e.target.value })} />
            </Field>
            <Field label="Antal dagar" htmlFor="gen-days">
              <Select id="gen-days" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })}>
                {[1, 2, 3, 5, 7].map((d) => (
                  <option key={d} value={d}>
                    {d} {d === 1 ? "dag" : "dagar"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Max tid per måltid" htmlFor="gen-time">
              <UnitInput unit="min" id="gen-time" value={form.maxCookingMinutes} onChange={(e) => setForm({ ...form, maxCookingMinutes: e.target.value })} />
            </Field>
            <Field label="Budget" htmlFor="gen-budget">
              <Select id="gen-budget" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })}>
                <option value="low">Låg</option>
                <option value="medium">Normal</option>
                <option value="high">Ingen gräns</option>
              </Select>
            </Field>
            <Field label="Önskemål" htmlFor="gen-pref" optional className="sm:col-span-2">
              <Textarea id="gen-pref" rows={2} value={form.preferences} onChange={(e) => setForm({ ...form, preferences: e.target.value })} placeholder="T.ex. mycket grönsaker, enkla luncher" />
            </Field>
            <Field label="Ingredienser hemma" htmlFor="gen-avail" optional className="sm:col-span-2">
              <Textarea id="gen-avail" rows={2} value={form.availableIngredients} onChange={(e) => setForm({ ...form, availableIngredients: e.target.value })} placeholder="T.ex. ris, ägg, broccoli" />
            </Field>
            <Field label="Startdatum" htmlFor="gen-start">
              <Input id="gen-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <div className="flex items-end sm:col-span-3">
              <Button type="submit" size="lg" loading={pending} disabled={!aiEnabled}>
                <Sparkles /> {days.length ? "Generera nytt förslag" : "Generera förslag"}
              </Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">Allergier, kostpreferenser och restriktioner hämtas från din profil.</p>
        </CardContent>
      </Card>

      {pending ? (
        <Card>
          <CardContent className="flex items-center gap-3 pt-5 text-sm text-muted-foreground">
            <Sparkles className="size-4 animate-pulse text-primary" /> Skapar förslag … detta kan ta upp till en minut.
          </CardContent>
        </Card>
      ) : null}

      {draft && days.length ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">
              <Sparkles /> AI-förslag – inte sparat
            </Badge>
            <span className="text-sm text-muted-foreground">Granska och redigera innan du sparar. Näringen är omräknad från databasen.</span>
          </div>
          {draft.notes ? <Notice>{draft.notes}</Notice> : null}
          {draft.excludedUnknown ? (
            <p className="text-xs text-muted-foreground">
              {draft.excludedUnknown} livsmedel uteslöts eftersom deras allergeninformation inte är bekräftad.
            </p>
          ) : null}
          {draft.discrepancies.length ? (
            <Notice variant="warning" title="Avvikelser">
              <ul className="list-disc pl-4">
                {draft.discrepancies.slice(0, 12).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </Notice>
          ) : null}

          <div className="flex gap-2 overflow-x-auto scrollbar-none" role="tablist">
            {days.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={activeDay === i}
                onClick={() => setActiveDay(i)}
                className={cn("rounded-full border px-4 py-1.5 text-sm", activeDay === i ? "border-primary bg-primary-soft text-primary-strong" : "bg-surface")}
              >
                Dag {i + 1}
              </button>
            ))}
          </div>

          <Card>
            <CardContent className="flex flex-col gap-2 pt-5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <MacroLine totals={dayTotals[activeDay]} />
                <Button variant="outline" size="sm" onClick={() => scaleDay(activeDay)}>
                  <Scale /> Justera portioner mot {targets.calories} kcal
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {compareToTargets(dayTotals[activeDay], targets).map((c) => (
                  <div key={c.key} className={cn("rounded-xl p-2", c.withinTolerance ? "bg-primary-soft" : "bg-warning-soft")}>
                    <p className="text-xs text-muted-foreground">{{ kcal: "Energi", protein: "Protein", carbs: "Kolhydrater", fat: "Fett" }[c.key]}</p>
                    <p className="font-semibold tabular">
                      {Math.round(c.actual)} / {Math.round(c.target)} {c.key === "kcal" ? "kcal" : "g"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            {days[activeDay].map((meal) => (
              <Card key={meal.key}>
                <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
                  <div className="min-w-0 flex-1">
                    <Input aria-label="Måltidens namn" value={meal.name} onChange={(e) => updateMeal(activeDay, meal.key, (m) => ({ ...m, name: e.target.value }))} className="h-9 font-semibold" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {MEAL_SLOT_LABELS[meal.slot]}
                      {meal.time ? ` · ${meal.time}` : ""}
                      {meal.prepMinutes ? ` · ${meal.prepMinutes} min` : ""}
                    </p>
                    <MacroLine totals={editableTotals(meal)} className="text-xs" />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => logMeal(meal)} aria-label={`Logga ${meal.name} i dagens dagbok`}>
                      <BookPlus /> Logga idag
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => regenerate(activeDay, meal)} loading={regenerating === meal.key} aria-label={`Generera om ${meal.name}`}>
                      <RefreshCw /> Ny
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Ta bort ${meal.name}`}
                      onClick={() => setDays((ds) => ds.map((ms, i) => (i === activeDay ? ms.filter((m) => m.key !== meal.key) : ms)))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <ul className="divide-y rounded-2xl border">
                    {meal.ingredients.map((ing) => (
                      <li key={ing.key} className="flex items-center gap-2 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-sm">{ing.food.name}</span>
                        <UnitInput
                          unit="g"
                          className="w-24"
                          aria-label={`Mängd ${ing.food.name}`}
                          value={ing.quantity}
                          onChange={(e) =>
                            updateMeal(activeDay, meal.key, (m) => ({ ...m, ingredients: m.ingredients.map((x) => (x.key === ing.key ? { ...x, quantity: e.target.value } : x)) }))
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Byt ut ${ing.food.name}`}
                          disabled={!isValidQuantity(qty(ing.quantity))}
                          onClick={() => setSubstitute({ day: activeDay, meal: meal.key, ing: ing.key, food: ing.food, grams: qty(ing.quantity) })}
                        >
                          <ArrowLeftRight />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Ta bort ${ing.food.name}`}
                          onClick={() => updateMeal(activeDay, meal.key, (m) => ({ ...m, ingredients: m.ingredients.filter((x) => x.key !== ing.key) }))}
                        >
                          <Trash2 />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {meal.instructions ? <p className="text-sm whitespace-pre-line text-muted-foreground">{meal.instructions}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-end">
              <Field label="Namn på planen" htmlFor="plan-name" className="flex-1">
                <Input id="plan-name" value={planName} onChange={(e) => setPlanName(e.target.value)} />
              </Field>
              <Button size="lg" onClick={save} loading={saving}>
                <Save /> Spara som ny plan
              </Button>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">Sparandet skapar alltid en ny plan – befintliga planer ändras aldrig.</p>
          <DraftSubstituteDialog
            target={substitute ? { food: substitute.food, grams: substitute.grams } : null}
            onClose={() => setSubstitute(null)}
            onChoose={(food, grams) => {
              if (!substitute) return;
              updateMeal(substitute.day, substitute.meal, (m) => ({
                ...m,
                ingredients: m.ingredients.map((x) => (x.key === substitute.ing ? { ...x, food, quantity: String(grams) } : x)),
              }));
              setSubstitute(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
