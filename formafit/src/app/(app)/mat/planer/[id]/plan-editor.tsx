"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeftRight,
  Check,
  ImagePlus,
  ChevronDown,
  Clock,
  Copy,
  CopyPlus,
  EllipsisVertical,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Scale,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Undo2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { listRecipes, markPlannedMealEaten, undoConsumption } from "@/app/(app)/mat/actions";
import { generateGroceryList } from "@/app/(app)/mat/inkop/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, Notice, PageHeader } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea, UnitInput } from "@/components/ui/input";
import { FoodPicker } from "@/components/nutrition/food-picker";
import { MacroBar, MacroLine } from "@/components/nutrition/macro-bar";
import { MediaThumb } from "@/components/shared/media-thumb";
import { addDays, formatDate } from "@/lib/dates";
import { MEAL_SLOT_LABELS } from "@/lib/labels";
import { compareToTargets, formatNutrient, isValidQuantity, mealTotals, MEAL_SLOTS, sumNutrients, toPer100g } from "@/lib/nutrition/engine";
import type { PlanDetail, PlanMeal } from "@/lib/data/plans";
import type { Tables } from "@/lib/supabase/database.types";
import type { MealSlot } from "@/lib/types";
import { WEEKDAYS_SHORT, isoWeekday } from "@/lib/workout/logic";
import { useSyncedState } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import {
  addIngredient,
  addMeal,
  copyPlanDay,
  deleteMeal,
  deletePlan,
  duplicateMeal,
  duplicatePlan,
  removeIngredient,
  reorderMeals,
  saveMealAsTemplate,
  scaleDayToTarget,
  setMealImage,
  updateIngredient,
  updateMeal,
  updatePlan,
} from "../actions";
import { SubstitutionDialog } from "./substitution-dialog";

type Targets = Tables<"nutrition_targets"> | null;

interface Props {
  detail: PlanDetail;
  targets: Targets;
  initialDay: number;
  today: string;
  allergies: string[];
  dietPreferences: string[];
  aiEnabled: boolean;
}

export function PlanEditor({ detail, targets, initialDay, today, allergies, dietPreferences, aiEnabled }: Props) {
  const router = useRouter();
  const { plan } = detail;
  const [day, setDay] = useState(initialDay);
  const [meals, setMeals] = useSyncedState(detail.meals);
  const [, start] = useTransition();
  const [dialog, setDialog] = useState<
    | null
    | { type: "edit-plan" }
    | { type: "duplicate-plan" }
    | { type: "delete-plan" }
    | { type: "grocery" }
    | { type: "add-meal" }
    | { type: "copy-day" }
    | { type: "scale-day" }
    | { type: "edit-meal"; meal: PlanMeal }
    | { type: "copy-meal"; meal: PlanMeal }
    | { type: "template"; meal: PlanMeal }
    | { type: "delete-meal"; meal: PlanMeal }
    | { type: "add-ingredient"; meal: PlanMeal }
  >(null);
  const [substituteId, setSubstituteId] = useState<string | null>(null);


  const dayDate = addDays(plan.start_date, day);
  const dayMeals = useMemo(() => meals.filter((m) => m.dayIndex === day).sort((a, b) => a.position - b.position), [meals, day]);
  const dayTotals = sumNutrients(dayMeals.map((m) => m.totals));
  const comparison = targets ? compareToTargets(dayTotals, targets) : null;
  const consumed = new Map(detail.consumptions.filter((c) => c.date === dayDate).map((c) => [c.mealId, c.id]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refresh = () => router.refresh();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (success) toast.success(success);
      refresh();
    });

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = dayMeals.map((m) => m.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setMeals((ms) => ms.map((m) => (m.dayIndex === day ? { ...m, position: next.indexOf(m.id) } : m)));
    start(async () => {
      const res = await reorderMeals({ planId: plan.id, dayIndex: day, orderedIds: next });
      if (!res.ok) {
        toast.error(res.error);
        setMeals(detail.meals);
      }
    });
  }

  /** Optimistically updates an ingredient quantity and recalculates the meal locally. */
  function setIngredientQuantity(mealId: string, ingredientId: string, quantityG: number) {
    setMeals((ms) =>
      ms.map((m) => {
        if (m.id !== mealId) return m;
        const ingredients = m.ingredients.map((i) => (i.id === ingredientId ? { ...i, quantityG } : i));
        return { ...m, ingredients, totals: mealTotals(ingredients.map((i) => ({ per100: toPer100g(i.food), quantityG: i.quantityG }))) };
      }),
    );
  }

  return (
    <>
      <PageHeader
        title={plan.name}
        eyebrow={
          <Link href="/mat/planer" className="hover:underline">
            Måltidsplaner
          </Link>
        }
        description={`${formatDate(plan.start_date)} – ${formatDate(plan.endDate)} · ${plan.num_days} ${plan.num_days === 1 ? "dag" : "dagar"}`}
        actions={
          <>
            {plan.source === "ai" ? (
              <Badge variant="info" className="self-center">
                <Sparkles /> Skapad från AI-förslag
              </Badge>
            ) : null}
            <Button variant="outline" onClick={() => setDialog({ type: "grocery" })}>
              <ShoppingBasket /> Inköpslista
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Fler val för planen">
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setDialog({ type: "edit-plan" })}>
                  <Pencil /> Redigera plan
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog({ type: "duplicate-plan" })}>
                  <Copy /> Kopiera hela planen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setDialog({ type: "delete-plan" })}>
                  <Trash2 /> Ta bort plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="-mx-4 mb-5 overflow-x-auto px-4 scrollbar-none" role="tablist" aria-label="Dagar i planen">
        <div className="flex gap-2">
          {Array.from({ length: plan.num_days }, (_, i) => {
            const date = addDays(plan.start_date, i);
            const count = meals.filter((m) => m.dayIndex === i).length;
            return (
              <button
                key={i}
                role="tab"
                aria-selected={day === i}
                onClick={() => setDay(i)}
                className={cn(
                  "flex min-w-16 flex-col items-center rounded-2xl border bg-surface px-3 py-2 text-sm transition-colors",
                  day === i ? "border-primary bg-primary-soft text-primary-strong" : "hover:border-primary/40",
                  date === today && day !== i && "border-primary/50",
                )}
              >
                <span className="text-xs font-medium uppercase">{WEEKDAYS_SHORT[isoWeekday(date) - 1]}</span>
                <span className="font-semibold">{Number(date.slice(8))}</span>
                <span className="text-[10px] text-muted-foreground">{count ? `${count} mål` : "tom"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold capitalize">{formatDate(dayDate, { weekday: "long", day: "numeric", month: "long" })}</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDialog({ type: "copy-day" })} disabled={!dayMeals.length || plan.num_days < 2}>
                <CopyPlus /> Kopiera dag
              </Button>
              <Button size="sm" onClick={() => setDialog({ type: "add-meal" })}>
                <Plus /> Måltid
              </Button>
            </div>
          </div>

          {dayMeals.length ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={dayMeals.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3">
                  {dayMeals.map((meal) => (
                    <SortableMealCard
                      key={meal.id}
                      meal={meal}
                      consumptionId={consumed.get(meal.id) ?? null}
                      onEdit={() => setDialog({ type: "edit-meal", meal })}
                      onDuplicate={() => run(() => duplicateMeal(meal.id), "Måltiden duplicerades")}
                      onCopy={() => setDialog({ type: "copy-meal", meal })}
                      onTemplate={() => setDialog({ type: "template", meal })}
                      onDelete={() => setDialog({ type: "delete-meal", meal })}
                      onAddIngredient={() => setDialog({ type: "add-ingredient", meal })}
                      onSubstitute={(id) => setSubstituteId(id)}
                      onQuantity={(ingId, q) => {
                        setIngredientQuantity(meal.id, ingId, q);
                        start(async () => {
                          const res = await updateIngredient({ id: ingId, quantityG: q });
                          if (!res.ok) {
                            toast.error(res.error);
                            refresh();
                          }
                        });
                      }}
                      onRemoveIngredient={(ingId) => run(() => removeIngredient(ingId))}
                      onEaten={() =>
                        run(async () => {
                          const res = await markPlannedMealEaten(meal.id, dayDate);
                          if (res.ok) toast.success(res.data.created ? `Tillagd i dagboken för ${formatDate(dayDate)}` : "Redan registrerad som äten");
                          return res;
                        })
                      }
                      onUndoEaten={(cid) => run(() => undoConsumption(cid), "Ångrat")}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <EmptyState
              icon={UtensilsCrossed}
              title="Inga måltider den här dagen"
              description="Lägg till en måltid, välj en sparad måltid eller kopiera en annan dag."
              action={
                <Button onClick={() => setDialog({ type: "add-meal" })}>
                  <Plus /> Lägg till måltid
                </Button>
              }
            />
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Dagens planerade energi</span>
                <span className="text-xl font-semibold tabular">{formatNutrient(dayTotals.kcal, "kcal")} kcal</span>
              </div>
              {targets ? (
                <>
                  <p className="text-xs text-muted-foreground tabular">
                    Mål {targets.calories} kcal ({dayTotals.kcal - targets.calories >= 0 ? "+" : ""}
                    {Math.round(dayTotals.kcal - targets.calories)} kcal)
                  </p>
                  <MacroBar macro="protein" value={dayTotals.protein} target={Number(targets.protein_g)} compact />
                  <MacroBar macro="carbs" value={dayTotals.carbs} target={Number(targets.carbs_g)} compact />
                  <MacroBar macro="fat" value={dayTotals.fat} target={Number(targets.fat_g)} compact />
                  {comparison && dayMeals.length && comparison.some((c) => !c.withinTolerance) ? (
                    <Button variant="outline" size="sm" onClick={() => setDialog({ type: "scale-day" })}>
                      <Scale /> Justera portioner mot kalorimålet
                    </Button>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sätt mål i profilen för att jämföra.</p>
              )}
              {dayTotals.missing.length ? <Notice variant="warning">Vissa ingredienser saknar näringsvärden.</Notice> : null}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Planen är separat från dagboken. Ändringar här påverkar inte det du redan loggat. Dra i handtaget för att ändra ordning.
          </p>
        </aside>
      </div>

      {/* Dialogs */}
      <EditPlanDialog open={dialog?.type === "edit-plan"} plan={plan} onClose={() => setDialog(null)} onSaved={refresh} />
      <DuplicatePlanDialog open={dialog?.type === "duplicate-plan"} plan={plan} onClose={() => setDialog(null)} />
      <GroceryDialog open={dialog?.type === "grocery"} plan={plan} onClose={() => setDialog(null)} />
      <AddMealDialog open={dialog?.type === "add-meal"} planId={plan.id} dayIndex={day} onClose={() => setDialog(null)} onSaved={refresh} />
      <CopyDayDialog
        open={dialog?.type === "copy-day"}
        plan={plan}
        fromDay={day}
        meals={meals}
        onClose={() => setDialog(null)}
        onSaved={(to) => {
          refresh();
          setDay(to);
        }}
      />
      {dialog?.type === "edit-meal" ? <EditMealDialog meal={dialog.meal} onClose={() => setDialog(null)} onSaved={refresh} /> : null}
      {dialog?.type === "copy-meal" ? <CopyMealDialog meal={dialog.meal} plan={plan} onClose={() => setDialog(null)} onSaved={refresh} /> : null}
      {dialog?.type === "template" ? <TemplateDialog meal={dialog.meal} onClose={() => setDialog(null)} /> : null}
      <ConfirmDialog
        open={dialog?.type === "delete-meal"}
        onOpenChange={(o) => !o && setDialog(null)}
        destructive
        title="Ta bort måltiden?"
        description="Måltiden tas bort från planen. Det du redan loggat i dagboken påverkas inte."
        confirmLabel="Ta bort"
        onConfirm={async () => {
          if (dialog?.type !== "delete-meal") return;
          const res = await deleteMeal(dialog.meal.id);
          if (!res.ok) return void toast.error(res.error);
          refresh();
        }}
      />
      <ConfirmDialog
        open={dialog?.type === "delete-plan"}
        onOpenChange={(o) => !o && setDialog(null)}
        destructive
        title="Ta bort hela planen?"
        description="Alla planerade måltider tas bort. Dagboksposter som redan förts in behålls."
        confirmLabel="Ta bort plan"
        onConfirm={async () => {
          const res = await deletePlan(plan.id);
          if (!res.ok) return void toast.error(res.error);
          router.push("/mat/planer");
        }}
      />
      <ConfirmDialog
        open={dialog?.type === "scale-day"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Justera portionerna?"
        description={`Alla ingredienser den här dagen skalas med samma faktor så att dagen landar nära ${targets?.calories ?? "–"} kcal. Det ändrar ${dayMeals.reduce((s, m) => s + m.ingredients.length, 0)} ingredienser.`}
        confirmLabel="Justera"
        onConfirm={async () => {
          const res = await scaleDayToTarget({ planId: plan.id, dayIndex: day });
          if (!res.ok) return void toast.error(res.error);
          toast.success(`Justerat till ${Math.round(res.data.kcal)} kcal`);
          refresh();
        }}
      />
      <FoodPicker
        open={dialog?.type === "add-ingredient"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.type === "add-ingredient" ? `Ingrediens till ${dialog.meal.name}` : ""}
        allergies={allergies}
        dietPreferences={dietPreferences}
        onConfirm={async (food, grams) => {
          if (dialog?.type !== "add-ingredient") return false;
          const res = await addIngredient({ mealId: dialog.meal.id, foodId: food.id, quantityG: grams });
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          refresh();
          return true;
        }}
      />
      <SubstitutionDialog ingredientId={substituteId} onClose={() => setSubstituteId(null)} onReplaced={refresh} aiEnabled={aiEnabled} />
    </>
  );
}

interface MealCardProps {
  meal: PlanMeal;
  consumptionId: string | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onTemplate: () => void;
  onDelete: () => void;
  onAddIngredient: () => void;
  onSubstitute: (ingredientId: string) => void;
  onQuantity: (ingredientId: string, grams: number) => void;
  onRemoveIngredient: (ingredientId: string) => void;
  onEaten: () => void;
  onUndoEaten: (consumptionId: string) => void;
}

function SortableMealCard(props: MealCardProps) {
  const { meal, consumptionId } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: meal.id });
  const [open, setOpen] = useState(true);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "z-10 opacity-80")}>
      <Card>
        <div className="flex items-center gap-2 p-4 pb-2">
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none rounded-lg p-1 text-muted-foreground hover:bg-surface-muted active:cursor-grabbing"
            aria-label={`Flytta ${meal.name}`}
          >
            <GripVertical className="size-4" />
          </button>
          <MediaThumb src={meal.imageUrl} alt="" kind="meal" size="sm" />
          <button className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <span className="flex items-center gap-2">
              <span className="truncate font-semibold">{meal.name}</span>
              {consumptionId ? (
                <Badge variant="primary">
                  <Check /> Äten
                </Badge>
              ) : null}
            </span>
            <span className="block text-xs text-muted-foreground">
              {MEAL_SLOT_LABELS[meal.slot]}
              {meal.time ? ` · ${meal.time}` : ""}
              {meal.prepMinutes ? ` · ${meal.prepMinutes} min` : ""}
            </span>
          </button>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Val för ${meal.name}`}>
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {consumptionId ? (
                <DropdownMenuItem onSelect={() => props.onUndoEaten(consumptionId)}>
                  <Undo2 /> Ångra äten
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={props.onEaten} disabled={!meal.ingredients.length}>
                  <Check /> Markera som äten
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={props.onEdit}>
                <Pencil /> Redigera detaljer
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={props.onDuplicate}>
                <Copy /> Duplicera
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={props.onCopy}>
                <CopyPlus /> Kopiera till annan dag
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={props.onTemplate} disabled={!meal.ingredients.length}>
                <Save /> Spara som mall
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={props.onDelete}>
                <Trash2 /> Ta bort
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="px-4 pb-1">
          <MacroLine totals={meal.totals} className="text-xs" />
        </div>
        {open ? (
          <CardContent className="flex flex-col gap-3 pt-3">
            {meal.ingredients.length ? (
              <ul className="divide-y rounded-2xl border">
                {meal.ingredients.map((ing) => (
                  <IngredientRow
                    key={ing.id}
                    name={ing.food.name}
                    verification={ing.food.verification}
                    quantityG={ing.quantityG}
                    kcal={mealTotals([{ per100: toPer100g(ing.food), quantityG: ing.quantityG }]).kcal}
                    onQuantity={(q) => props.onQuantity(ing.id, q)}
                    onSubstitute={() => props.onSubstitute(ing.id)}
                    onRemove={() => props.onRemoveIngredient(ing.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Inga ingredienser ännu.</p>
            )}
            <Button variant="soft" size="sm" className="self-start" onClick={props.onAddIngredient}>
              <Plus /> Ingrediens
            </Button>
            {meal.instructions ? (
              <div className="rounded-2xl bg-surface-muted p-3 text-sm whitespace-pre-line">
                <p className="mb-1 flex items-center gap-1.5 font-medium">
                  <Clock className="size-3.5" aria-hidden /> Tillagning
                </p>
                {meal.instructions}
              </div>
            ) : null}
            {meal.notes ? <p className="text-sm text-muted-foreground">{meal.notes}</p> : null}
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}

function IngredientRow({
  name,
  verification,
  quantityG,
  kcal,
  onQuantity,
  onSubstitute,
  onRemove,
}: {
  name: string;
  verification: string;
  quantityG: number;
  kcal: number;
  onQuantity: (g: number) => void;
  onSubstitute: () => void;
  onRemove: () => void;
}) {
  const [value, setValue] = useSyncedState(String(quantityG));
  const commit = () => {
    const q = Number(value.replace(",", "."));
    if (!isValidQuantity(q)) {
      toast.error("Ange 1–5000 g.");
      setValue(String(quantityG));
      return;
    }
    if (q !== quantityG) onQuantity(q);
  };
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{name}</span>
        <span className="block text-xs text-muted-foreground tabular">
          {formatNutrient(kcal, "kcal")} kcal{verification === "estimated" ? " · uppskattat" : ""}
        </span>
      </span>
      <UnitInput
        unit="g"
        className="w-24 shrink-0"
        aria-label={`Mängd ${name}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <Button variant="ghost" size="icon-sm" aria-label={`Byt ut ${name}`} onClick={onSubstitute}>
        <ArrowLeftRight />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Ta bort ${name}`} onClick={onRemove}>
        <Trash2 />
      </Button>
    </li>
  );
}

function EditPlanDialog({ open, plan, onClose, onSaved }: { open: boolean; plan: PlanDetail["plan"]; onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState({ name: plan.name, startDate: plan.start_date, numDays: String(plan.num_days), notes: plan.notes ?? "" });
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Redigera plan">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await updatePlan({ id: plan.id, ...s });
              if (!res.ok) return void toast.error(res.error);
              onClose();
              onSaved();
            });
          }}
        >
          <Field label="Namn" htmlFor="ep-name">
            <Input id="ep-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Startdatum" htmlFor="ep-start">
              <Input id="ep-start" type="date" value={s.startDate} onChange={(e) => setS({ ...s, startDate: e.target.value })} />
            </Field>
            <Field label="Antal dagar" htmlFor="ep-days">
              <UnitInput unit="dagar" id="ep-days" value={s.numDays} onChange={(e) => setS({ ...s, numDays: e.target.value })} />
            </Field>
          </div>
          <Field label="Anteckningar" htmlFor="ep-notes" optional>
            <Textarea id="ep-notes" value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} />
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

function DuplicatePlanDialog({ open, plan, onClose }: { open: boolean; plan: PlanDetail["plan"]; onClose: () => void }) {
  const router = useRouter();
  const [s, setS] = useState({ name: `${plan.name} (kopia)`, startDate: addDays(plan.start_date, plan.num_days) });
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Kopiera planen" description="Skapar en ny plan med samma måltider och ett nytt startdatum.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await duplicatePlan({ id: plan.id, ...s });
              if (!res.ok) return void toast.error(res.error);
              onClose();
              router.push(`/mat/planer/${res.data.id}`);
            });
          }}
        >
          <Field label="Namn" htmlFor="dp-name">
            <Input id="dp-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
          </Field>
          <Field label="Startdatum" htmlFor="dp-start">
            <Input id="dp-start" type="date" value={s.startDate} onChange={(e) => setS({ ...s, startDate: e.target.value })} />
          </Field>
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

function GroceryDialog({ open, plan, onClose }: { open: boolean; plan: PlanDetail["plan"]; onClose: () => void }) {
  const router = useRouter();
  const [s, setS] = useState({ startDate: plan.start_date, endDate: plan.endDate, name: `Inköp – ${plan.name}` });
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Skapa inköpslista" description="Ingredienserna från planen summeras per vara och butiksavdelning.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await generateGroceryList({ planId: plan.id, ...s });
              if (!res.ok) return void toast.error(res.error);
              onClose();
              router.push(`/mat/inkop/${res.data.id}`);
            });
          }}
        >
          <Field label="Namn" htmlFor="g-name">
            <Input id="g-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Från" htmlFor="g-from">
              <Input id="g-from" type="date" min={plan.start_date} max={plan.endDate} value={s.startDate} onChange={(e) => setS({ ...s, startDate: e.target.value })} />
            </Field>
            <Field label="Till" htmlFor="g-to">
              <Input id="g-to" type="date" min={plan.start_date} max={plan.endDate} value={s.endDate} onChange={(e) => setS({ ...s, endDate: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" loading={pending}>
              Skapa lista
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddMealDialog({ open, planId, dayIndex, onClose, onSaved }: { open: boolean; planId: string; dayIndex: number; onClose: () => void; onSaved: () => void }) {
  const [slot, setSlot] = useState<MealSlot>("breakfast");
  const [name, setName] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [recipes, setRecipes] = useState<{ id: string; name: string; kind: string }[] | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (open && recipes === null) listRecipes().then((r) => setRecipes(r.ok ? r.data : []));
  }, [open, recipes]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Lägg till måltid">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await addMeal({ planId, dayIndex, slot, name: name || undefined, fromRecipeId: recipeId || null });
              if (!res.ok) return void toast.error(res.error);
              setName("");
              setRecipeId("");
              onClose();
              onSaved();
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Måltid" htmlFor="am-slot">
              <Select id="am-slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
                {MEAL_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {MEAL_SLOT_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Namn" htmlFor="am-name" optional>
              <Input id="am-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={MEAL_SLOT_LABELS[slot]} />
            </Field>
          </div>
          <Field label="Utgå från recept eller sparad måltid" htmlFor="am-recipe" optional hint="En portion kopieras in – sedan kan du ändra fritt.">
            <Select id="am-recipe" value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
              <option value="">Tom måltid</option>
              {(recipes ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.kind === "meal" ? "(måltid)" : "(recept)"}
                </option>
              ))}
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" loading={pending}>
              Lägg till
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CopyDayDialog({
  open,
  plan,
  fromDay,
  meals,
  onClose,
  onSaved,
}: {
  open: boolean;
  plan: PlanDetail["plan"];
  fromDay: number;
  meals: PlanMeal[];
  onClose: () => void;
  onSaved: (to: number) => void;
}) {
  const [to, setTo] = useState(String(Math.min(fromDay + 1, plan.num_days - 1) === fromDay ? 0 : fromDay + 1));
  const [replace, setReplace] = useState(false);
  const [pending, start] = useTransition();
  const target = Number(to);
  const targetHasMeals = meals.some((m) => m.dayIndex === target);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Kopiera dagen">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await copyPlanDay({ planId: plan.id, fromDay, toDay: target, replace });
              if (!res.ok) return void toast.error(res.error);
              toast.success(`${res.data.count} måltider kopierade`);
              onClose();
              onSaved(target);
            });
          }}
        >
          <Field label="Till dag" htmlFor="cd-to">
            <Select id="cd-to" value={to} onChange={(e) => setTo(e.target.value)}>
              {Array.from({ length: plan.num_days }, (_, i) => i)
                .filter((i) => i !== fromDay)
                .map((i) => (
                  <option key={i} value={i}>
                    Dag {i + 1} – {formatDate(addDays(plan.start_date, i), { weekday: "short", day: "numeric", month: "short" })}
                  </option>
                ))}
            </Select>
          </Field>
          {targetHasMeals ? (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              <span>Ersätt måltiderna som redan finns den dagen (annars läggs kopiorna till).</span>
            </label>
          ) : null}
          {replace ? <Notice variant="warning">Måltiderna på måldagen tas bort och ersätts.</Notice> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" loading={pending} variant={replace ? "destructive" : "default"}>
              {replace ? "Ersätt och kopiera" : "Kopiera"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditMealDialog({ meal, onClose, onSaved }: { meal: PlanMeal; onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState({
    name: meal.name,
    mealSlot: meal.slot,
    mealTime: meal.time ?? "",
    instructions: meal.instructions ?? "",
    prepMinutes: meal.prepMinutes?.toString() ?? "",
    notes: meal.notes ?? "",
  });
  const [pending, start] = useTransition();
  const [image, setImage] = useState<File | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Redigera måltid">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await updateMeal({ id: meal.id, ...s });
              if (!res.ok) return void toast.error(res.error);
              if (image) {
                const fd = new FormData();
                fd.set("image", image);
                const img = await setMealImage(meal.id, fd);
                if (!img.ok) return void toast.error(img.error);
              }
              onClose();
              onSaved();
            });
          }}
        >
          <Field label="Namn" htmlFor="em-name">
            <Input id="em-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Måltid" htmlFor="em-slot">
              <Select id="em-slot" value={s.mealSlot} onChange={(e) => setS({ ...s, mealSlot: e.target.value as MealSlot })}>
                {MEAL_SLOTS.map((x) => (
                  <option key={x} value={x}>
                    {MEAL_SLOT_LABELS[x]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tid" htmlFor="em-time" optional>
              <Input id="em-time" type="time" value={s.mealTime} onChange={(e) => setS({ ...s, mealTime: e.target.value })} />
            </Field>
            <Field label="Tid att laga" htmlFor="em-prep" optional>
              <UnitInput unit="min" id="em-prep" value={s.prepMinutes} onChange={(e) => setS({ ...s, prepMinutes: e.target.value })} />
            </Field>
          </div>
          <Field label="Tillagning" htmlFor="em-inst" optional>
            <Textarea id="em-inst" rows={5} value={s.instructions} onChange={(e) => setS({ ...s, instructions: e.target.value })} />
          </Field>
          <Field label="Anteckningar" htmlFor="em-notes" optional>
            <Textarea id="em-notes" rows={2} value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} />
          </Field>
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed p-3 text-sm text-muted-foreground hover:border-primary/40">
            <ImagePlus className="size-5" aria-hidden />
            {image ? image.name : meal.imageUrl ? "Byt bild (valfritt)" : "Lägg till en egen bild (valfritt, max 5 MB)"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
          </label>
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

function CopyMealDialog({ meal, plan, onClose, onSaved }: { meal: PlanMeal; plan: PlanDetail["plan"]; onClose: () => void; onSaved: () => void }) {
  const [to, setTo] = useState(String((meal.dayIndex + 1) % plan.num_days));
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Kopiera ${meal.name}`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await duplicateMeal(meal.id, Number(to));
              if (!res.ok) return void toast.error(res.error);
              toast.success("Kopierad");
              onClose();
              onSaved();
            });
          }}
        >
          <Field label="Till dag" htmlFor="cm-to">
            <Select id="cm-to" value={to} onChange={(e) => setTo(e.target.value)}>
              {Array.from({ length: plan.num_days }, (_, i) => (
                <option key={i} value={i}>
                  Dag {i + 1} – {formatDate(addDays(plan.start_date, i), { weekday: "short", day: "numeric", month: "short" })}
                </option>
              ))}
            </Select>
          </Field>
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

function TemplateDialog({ meal, onClose }: { meal: PlanMeal; onClose: () => void }) {
  const [name, setName] = useState(meal.name);
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Spara som mall" description="Mallen hamnar under Recept & måltider och kan återanvändas i nya planer och i dagboken.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveMealAsTemplate({ mealId: meal.id, name });
              if (!res.ok) return void toast.error(res.error);
              toast.success("Mallen är sparad");
              onClose();
            });
          }}
        >
          <Field label="Namn" htmlFor="tm-name">
            <Input id="tm-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" loading={pending}>
              Spara mall
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
