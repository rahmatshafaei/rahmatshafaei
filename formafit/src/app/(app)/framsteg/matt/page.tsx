import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { MeasurementChart } from "@/components/charts/progress-charts";
import { requireAuth } from "@/lib/auth";
import { getMeasurements } from "@/lib/data/progress";
import { todayIso } from "@/lib/dates";
import { MeasurementForm, MeasurementTable } from "./measurement-client";

export const metadata: Metadata = { title: "Vikt & mått" };

export default async function MeasurementsPage() {
  const auth = await requireAuth();
  const rows = await getMeasurements(auth);
  const numeric = rows.map((r) => ({
    ...r,
    weight_kg: r.weight_kg === null ? null : Number(r.weight_kg),
    waist_cm: r.waist_cm === null ? null : Number(r.waist_cm),
    chest_cm: r.chest_cm === null ? null : Number(r.chest_cm),
    hips_cm: r.hips_cm === null ? null : Number(r.hips_cm),
    arm_cm: r.arm_cm === null ? null : Number(r.arm_cm),
    thigh_cm: r.thigh_cm === null ? null : Number(r.thigh_cm),
    body_fat_pct: r.body_fat_pct === null ? null : Number(r.body_fat_pct),
  }));
  return (
    <>
      <PageHeader title="Vikt & mått" description="Väg dig gärna vid samma tid på dagen. Veckosnittet jämnar ut dagliga svängningar." />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Ny mätning</CardTitle>
          </CardHeader>
          <CardContent>
            <MeasurementForm today={todayIso()} />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          <MeasurementChart rows={numeric} />
          <MeasurementTable rows={[...numeric].reverse()} />
        </div>
      </div>
    </>
  );
}
