"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  CopyPlus,
  Droplets,
  EllipsisVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
  Undo2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, Input, Select, UnitInput } from "@/components/ui/input";
import { FoodPicker } from "@/components/nutrition/food-picker";
import { MacroLine } from "@/components/nutrition/macro-bar";
import { VerificationBadge } from "@/components/nutrition/verification-badge";
import { addDays, relativeDayLabel } from "@/lib/dates";
import { MEAL_SLOT_LABELS } from "@/lib/labels";
import { formatNutrient, isValidQuantity, MEAL_SLOTS, type NutrientTotals } from "@/lib/nutrition/engine";
import type { Tables } from "@/lib/supabase/database.types";
import type { MealSlot } from "@/lib/types";
import {
  addDiaryEntry,
  addWater,
  copyDiary,
  deleteDiaryEntry,
  duplicateDiaryEntry,
  logRecipe,
  markPlannedMealEaten,
  removeWater,
  saveSlotAsMeal,
  undoConsumption,
  updateDiaryEntry,
} from "./actions";

type Entry = Tables<"diary_entries"> & { totals: NutrientTotals };

export function DateNav({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const go = (d: string) => router.push(d === today ? "/mat" : `/mat?datum=${d}`);
  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="icon" onClick={() => go(addDays(date, -1))} aria-label="Föregående dag">
        <ChevronLeft />
      </Button>
      <div className="flex flex-col items-center">
        <h1 className="text-xl font-semibold tracking-tight capitalize">{relativeDayLabel(date, today)}</h1>
        <label className="relative inline-flex items-center gap-1 text-sm text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden />
          <span>{date}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && go(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Välj datum"
          />
        </label>
      </div>
      <Button variant="ghost" size="icon" onClick={() => go(addDays(date, 1))} aria-label="Nästa dag">
        <ChevronRight />
      </Button>
    </div>
  );
}

export function DiaryMeals({
  date,
  entries,
  slotTotals,
  allergies,
  dietPreferences,
}: {
  date: string;
  entries: Entry[];
  slotTotals: Record<MealSlot, NutrientTotals>;
  allergies: string[];
  dietPreferences: string[];
}) {
  const router = useRouter();
  const [pickerSlot, setPickerSlot] = useState<MealSlot | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [copyFrom, setCopyFrom] = useState<{ slot: MealSlot | null } | null>(null);
  const [saveMealSlot, setSaveMealSlot] = useState<MealSlot | null>(null);
  const [confirmYesterday, setConfirmYesterday] = useState(false);
  const [, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (success) toast.success(success);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Måltider</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmYesterday(true)}>
            <Copy /> Kopiera gårdagen
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCopyFrom({ slot: null })} disabled={!entries.length}>
            <CopyPlus /> Kopiera dagen till…
          </Button>
        </div>
      </div>

      {MEAL_SLOTS.map((slot) => {
        const items = entries.filter((e) => e.meal_slot === slot);
        return (
          <Card key={slot}>
            <CardHeader className="flex-row items-center justify-between gap-3 pb-2">
              <div className="min-w-0">
                <CardTitle>{MEAL_SLOT_LABELS[slot]}</CardTitle>
                {items.length ? <MacroLine totals={slotTotals[slot]} className="text-xs" /> : null}
              </div>
              <div className="flex items-center gap-1">
                {items.length ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Fler val för ${MEAL_SLOT_LABELS[slot]}`}>
                        <EllipsisVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => setCopyFrom({ slot })}>
                        <CopyPlus /> Duplicera måltiden…
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setSaveMealSlot(slot)}>
                        <Save /> Spara som måltid
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
                <Button size="sm" variant="soft" onClick={() => setPickerSlot(slot)} aria-label={`Lägg till i ${MEAL_SLOT_LABELS[slot]}`}>
                  <Plus /> Lägg till
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {items.length ? (
                <ul className="divide-y">
                  {items.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-2.5">
                      <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(e)}>
                        <span className="block truncate font-medium">{e.food_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatNutrient(Number(e.quantity_g), "protein")} g
                          {e.recipe_name ? ` · ${e.recipe_name}` : ""}
                          {e.verification === "estimated" ? " · uppskattat" : ""}
                        </span>
                      </button>
                      <span className="text-sm font-medium tabular">{formatNutrient(e.totals.kcal, "kcal")} kcal</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Val för ${e.food_name}`}>
                            <EllipsisVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => setEditing(e)}>
                            <Pencil /> Ändra
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => run(() => duplicateDiaryEntry(e.id), "Duplicerad")}>
                            <Copy /> Duplicera
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive onSelect={() => run(() => deleteDiaryEntry(e.id), "Borttagen")}>
                            <Trash2 /> Ta bort
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                </ul>
              ) : (
                <button
                  onClick={() => setPickerSlot(slot)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-dashed p-3 text-sm text-muted-foreground hover:border-primary/40"
                >
                  <UtensilsCrossed className="size-4" aria-hidden /> Inget loggat – lägg till {MEAL_SLOT_LABELS[slot].toLowerCase()}
                </button>
              )}
            </CardContent>
          </Card>
        );
      })}

      <FoodPicker
        open={pickerSlot !== null}
        onOpenChange={(o) => !o && setPickerSlot(null)}
        title={pickerSlot ? `Lägg till i ${MEAL_SLOT_LABELS[pickerSlot].toLowerCase()}` : ""}
        allergies={allergies}
        dietPreferences={dietPreferences}
        onConfirm={async (food, grams) => {
          const res = await addDiaryEntry({ date, slot: pickerSlot, foodId: food.id, quantityG: grams });
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(`${food.name} tillagd`);
          router.refresh();
          return true;
        }}
        onLogRecipe={async (recipeId, portions) => {
          const res = await logRecipe({ recipeId, date, slot: pickerSlot, portions });
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success("Loggat");
          router.refresh();
          return true;
        }}
      />

      <EditEntryDialog entry={editing} onClose={() => setEditing(null)} onSaved={() => router.refresh()} />

      <CopyDialog
        open={copyFrom !== null}
        slot={copyFrom?.slot ?? null}
        date={date}
        onClose={() => setCopyFrom(null)}
        onDone={() => router.refresh()}
      />

      <SaveMealDialog slot={saveMealSlot} date={date} onClose={() => setSaveMealSlot(null)} />

      <ConfirmDialog
        open={confirmYesterday}
        onOpenChange={setConfirmYesterday}
        title="Kopiera gårdagens mat?"
        description="Alla poster från föregående dag läggs till på den här dagen. Befintliga poster behålls."
        confirmLabel="Kopiera"
        onConfirm={async () => {
          const res = await copyDiary({ from: addDays(date, -1), to: date });
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.data.count ? `${res.data.count} poster kopierade` : "Det fanns inget loggat igår.");
          router.refresh();
        }}
      />
    </div>
  );
}

function EditEntryDialog({ entry, onClose, onSaved }: { entry: Entry | null; onClose: () => void; onSaved: () => void }) {
  const [grams, setGrams] = useState("");
  const [slot, setSlot] = useState<MealSlot>("breakfast");
  const [pending, start] = useTransition();
  const [lastId, setLastId] = useState<string | null>(null);
  if (entry && entry.id !== lastId) {
    setLastId(entry.id);
    setGrams(String(Number(entry.quantity_g)));
    setSlot(entry.meal_slot);
  }
  const value = Number(grams.replace(",", "."));
  const valid = isValidQuantity(value);
  const per100 = entry ? Number(entry.kcal_per_100g ?? 0) : 0;
  return (
    <Dialog open={entry !== null} onOpenChange={(o) => !o && onClose()}>
      {entry ? (
        <DialogContent title={entry.food_name} description={entry.brand ?? undefined}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await updateDiaryEntry({ id: entry.id, quantityG: value, slot });
                if (!res.ok) return void toast.error(res.error);
                toast.success("Uppdaterad");
                onClose();
                onSaved();
              });
            }}
          >
            <VerificationBadge verification={entry.verification} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mängd" htmlFor="edit-qty" error={!valid ? "Ange 1–5000 g." : undefined}>
                <UnitInput unit="g" id="edit-qty" value={grams} onChange={(e) => setGrams(e.target.value)} />
              </Field>
              <Field label="Måltid" htmlFor="edit-slot">
                <Select id="edit-slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
                  {MEAL_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {MEAL_SLOT_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="text-sm text-muted-foreground tabular">
              {valid && entry.kcal_per_100g !== null ? `${Math.round((per100 * value) / 100)} kcal` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Näringsvärdena sparades när posten loggades, så historiken påverkas inte om livsmedlet ändras senare.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Avbryt
              </Button>
              <Button type="submit" disabled={!valid} loading={pending}>
                Spara
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function CopyDialog({ open, slot, date, onClose, onDone }: { open: boolean; slot: MealSlot | null; date: string; onClose: () => void; onDone: () => void }) {
  const [target, setTarget] = useState(addDays(date, 1));
  const [targetSlot, setTargetSlot] = useState<MealSlot | "">("");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={slot ? `Duplicera ${MEAL_SLOT_LABELS[slot].toLowerCase()}` : "Kopiera dagen"}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await copyDiary({ from: date, to: target, slot, targetSlot: slot && targetSlot ? targetSlot : null });
              if (!res.ok) return void toast.error(res.error);
              toast.success(`${res.data.count} poster kopierade`);
              onClose();
              onDone();
            });
          }}
        >
          <Field label="Till datum" htmlFor="copy-date">
            <Input id="copy-date" type="date" value={target} onChange={(e) => setTarget(e.target.value)} required />
          </Field>
          {slot ? (
            <Field label="Till måltid" htmlFor="copy-slot">
              <Select id="copy-slot" value={targetSlot} onChange={(e) => setTargetSlot(e.target.value as MealSlot | "")}>
                <option value="">Samma ({MEAL_SLOT_LABELS[slot]})</option>
                {MEAL_SLOTS.filter((s) => s !== slot).map((s) => (
                  <option key={s} value={s}>
                    {MEAL_SLOT_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" loading={pending}>
              Kopiera
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SaveMealDialog({ slot, date, onClose }: { slot: MealSlot | null; date: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog open={slot !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Spara som måltid" description="Återanvänd måltiden i dagboken och i måltidsplaner.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveSlotAsMeal({ date, slot, name });
              if (!res.ok) return void toast.error(res.error);
              toast.success("Måltiden är sparad");
              setName("");
              onClose();
            });
          }}
        >
          <Field label="Namn" htmlFor="meal-name">
            <Input id="meal-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="T.ex. Min vardagsfrukost" required />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" loading={pending}>
              Spara
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PlannedToday({
  date,
  meals,
}: {
  date: string;
  meals: { id: string; name: string; slot: MealSlot; time: string | null; planName: string; planId: string; totals: NutrientTotals; consumptionId: string | null }[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Planerat för dagen</CardTitle>
        <p className="text-sm text-muted-foreground">Markera en måltid som äten för att föra in den i dagboken.</p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {meals.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <Link href={`/mat/planer/${m.planId}`} className="block truncate font-medium hover:underline">
                  {m.name}
                </Link>
                <span className="block truncate text-xs text-muted-foreground">
                  {MEAL_SLOT_LABELS[m.slot]}
                  {m.time ? ` ${m.time.slice(0, 5)}` : ""} · {Math.round(m.totals.kcal)} kcal · {m.planName}
                </span>
              </div>
              {m.consumptionId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={pendingId === m.id}
                  onClick={async () => {
                    setPendingId(m.id);
                    const res = await undoConsumption(m.consumptionId);
                    setPendingId(null);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success("Ångrat – posterna togs bort ur dagboken");
                    router.refresh();
                  }}
                >
                  <Undo2 /> Ångra
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="soft"
                  loading={pendingId === m.id}
                  onClick={async () => {
                    setPendingId(m.id);
                    const res = await markPlannedMealEaten(m.id, date);
                    setPendingId(null);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success(res.data.created ? "Tillagd i dagboken" : "Redan registrerad");
                    router.refresh();
                  }}
                >
                  <Check /> Äten
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function WaterTracker({ date, logs, totalMl, goalMl }: { date: string; logs: Tables<"water_logs">[]; totalMl: number; goalMl: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const pct = Math.min(100, (totalMl / goalMl) * 100);
  const last = logs[logs.length - 1];
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-info-soft text-info">
              <Droplets className="size-5" aria-hidden />
            </div>
            <div>
              <p className="font-semibold">Vatten</p>
              <p className="text-sm text-muted-foreground tabular">
                {(totalMl / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} av {(goalMl / 1000).toLocaleString("sv-SE")} l
              </p>
            </div>
          </div>
          {last ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await removeWater(last.id);
                  if (!res.ok) return void toast.error(res.error);
                  router.refresh();
                })
              }
            >
              <Undo2 /> Ångra {last.amount_ml} ml
            </Button>
          ) : null}
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Vatten" aria-valuenow={totalMl} aria-valuemin={0} aria-valuemax={goalMl}>
          <div className="h-full rounded-full bg-info transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-2">
          {[250, 330, 500].map((ml) => (
            <Button
              key={ml}
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await addWater(date, ml);
                  if (!res.ok) return void toast.error(res.error);
                  router.refresh();
                })
              }
            >
              + {ml} ml
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
