"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ruler, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, UnitInput } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { deleteMeasurement, saveMeasurement } from "../actions";

const FIELDS = [
  ["weightKg", "Vikt", "kg"],
  ["waistCm", "Midja", "cm"],
  ["chestCm", "Bröst", "cm"],
  ["hipsCm", "Höft", "cm"],
  ["armCm", "Överarm", "cm"],
  ["thighCm", "Lår", "cm"],
  ["bodyFatPct", "Fettprocent", "%"],
] as const;

export function MeasurementForm({ today }: { today: string }) {
  const router = useRouter();
  const empty = { measuredOn: today, weightKg: "", waistCm: "", chestCm: "", hipsCm: "", armCm: "", thighCm: "", bodyFatPct: "", notes: "" };
  const [s, setS] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveMeasurement(s);
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            return void toast.error(res.error);
          }
          setErrors({});
          toast.success("Mätningen är sparad");
          setS({ ...empty, measuredOn: s.measuredOn });
          router.refresh();
        });
      }}
    >
      <Field label="Datum" htmlFor="m-date">
        <Input id="m-date" type="date" max={today} value={s.measuredOn} onChange={(e) => setS({ ...s, measuredOn: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(([key, label, unit]) => (
          <Field key={key} label={label} htmlFor={`m-${key}`} error={errors[key]}>
            <UnitInput unit={unit} id={`m-${key}`} value={s[key]} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
          </Field>
        ))}
      </div>
      <Field label="Anteckning" htmlFor="m-notes" optional>
        <Input id="m-notes" value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} />
      </Field>
      <p className="text-xs text-muted-foreground">Fyll i det du har mätt. Tomma fält behåller tidigare värden för samma dag.</p>
      <Button type="submit" loading={pending}>
        Spara
      </Button>
    </form>
  );
}

type Row = { id: string; measured_on: string; weight_kg: number | null; waist_cm: number | null; chest_cm: number | null; hips_cm: number | null; arm_cm: number | null; thigh_cm: number | null; body_fat_pct: number | null };

export function MeasurementTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  if (!rows.length) return <EmptyState icon={Ruler} title="Inga mätningar ännu" description="Din första mätning skapas när du väger dig eller fyller i ett mått." />;
  const f = (v: number | null, unit: string) => (v === null ? "–" : `${v.toLocaleString("sv-SE")} ${unit}`);
  return (
    <Card>
      <CardContent className="overflow-x-auto pt-4">
        <table className="w-full min-w-[36rem] text-sm tabular">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2 font-normal">Datum</th>
              {FIELDS.map(([k, l]) => (
                <th key={k} className="py-2 font-normal">
                  {l}
                </th>
              ))}
              <th className="sr-only">Åtgärder</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-2">{formatDate(r.measured_on, { day: "numeric", month: "short", year: "numeric" })}</td>
                <td>{f(r.weight_kg, "kg")}</td>
                <td>{f(r.waist_cm, "cm")}</td>
                <td>{f(r.chest_cm, "cm")}</td>
                <td>{f(r.hips_cm, "cm")}</td>
                <td>{f(r.arm_cm, "cm")}</td>
                <td>{f(r.thigh_cm, "cm")}</td>
                <td>{f(r.body_fat_pct, "%")}</td>
                <td className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Ta bort mätningen ${r.measured_on}`}
                    onClick={() =>
                      start(async () => {
                        const res = await deleteMeasurement(r.id);
                        if (!res.ok) return void toast.error(res.error);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
