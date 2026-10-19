"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { Select } from "@/components/ui/input";
import { addDays, formatDate } from "@/lib/dates";
import { ChartCard } from "./chart-card";

const axis = { fontSize: 12, fill: "var(--muted-foreground)" };
const tooltipStyle = { borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", fontSize: 13 };
const fmt = (v: number, d = 1) => v.toLocaleString("sv-SE", { maximumFractionDigits: d });

export function WeightChart({ weights, weekly }: { weights: { date: string; weightKg: number }[]; weekly: { weekStart: string; average: number; count: number }[] }) {
  // Weekly average is plotted at the middle of its week.
  const avgByDate = new Map(weekly.map((w) => [addDays(w.weekStart, 3), w.average]));
  const dates = [...new Set([...weights.map((w) => w.date), ...avgByDate.keys()])].sort();
  const byDate = new Map(weights.map((w) => [w.date, w.weightKg]));
  const data = dates.map((d) => ({ date: d, weight: byDate.get(d) ?? null, avg: avgByDate.get(d) ?? null }));
  return (
    <ChartCard
      title="Kroppsvikt"
      description="Enskilda vägningar och veckosnitt."
      legend={[
        { label: "Vägning", color: "var(--muted-foreground)" },
        { label: "Veckosnitt", color: "var(--primary)" },
      ]}
      table={{ headers: ["Vecka från", "Snitt", "Vägningar"], rows: weekly.map((w) => [formatDate(w.weekStart), `${fmt(w.average)} kg`, w.count]) }}
    >
      <div className="h-60" role="img" aria-label="Diagram över kroppsvikt">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d) => formatDate(d)} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={axis} axisLine={false} tickLine={false} domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} allowDecimals={false} tickFormatter={(v) => fmt(v, 0)} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(d) => formatDate(String(d), { weekday: "short", day: "numeric", month: "short" })}
              formatter={(v, name) => [`${fmt(Number(v))} kg`, name === "avg" ? "Veckosnitt" : "Vägning"]}
            />
            <Scatter dataKey="weight" fill="var(--muted-foreground)" r={4} />
            <Line dataKey="avg" type="monotone" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4, fill: "var(--primary)", stroke: "var(--surface)", strokeWidth: 2 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function IntakeChart({ intake, target }: { intake: { date: string; kcal: number }[]; target: number | null }) {
  return (
    <ChartCard
      title="Kaloriintag"
      description={target ? `Loggade dagar jämfört med målet ${target} kcal. Tomma dagar är inte loggade.` : "Loggat intag per dag."}
      table={{ headers: ["Datum", "kcal"], rows: intake.map((d) => [formatDate(d.date), d.kcal ? Math.round(d.kcal) : "–"]) }}
    >
      <div className="h-56" role="img" aria-label="Stapeldiagram över kaloriintag per dag">
        <ResponsiveContainer>
          <BarChart data={intake.map((d) => ({ ...d, kcal: d.kcal || null }))} margin={{ left: -8, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d) => formatDate(d)} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={axis} axisLine={false} tickLine={false} domain={[0, (max: number) => Math.ceil(Math.max(max, (target ?? 0) * 1.1) / 100) * 100]} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-muted)" }} labelFormatter={(d) => formatDate(String(d))} formatter={(v) => [`${Math.round(Number(v))} kcal`, "Intag"]} />
            {target ? <ReferenceLine y={target} stroke="var(--foreground)" strokeDasharray="4 4" strokeOpacity={0.5} /> : null}
            <Bar dataKey="kcal" fill="var(--macro-kcal)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function MacroChart({ intake }: { intake: { date: string; protein: number; carbs: number; fat: number; kcal: number }[] }) {
  const data = intake.map((d) => (d.kcal ? d : { ...d, protein: null, carbs: null, fat: null }));
  return (
    <ChartCard
      title="Makronutrienter"
      description="Gram per loggad dag."
      legend={[
        { label: "Protein", color: "var(--macro-protein)" },
        { label: "Kolhydrater", color: "var(--macro-carbs)" },
        { label: "Fett", color: "var(--macro-fat)" },
      ]}
      table={{
        headers: ["Datum", "Protein", "Kolh.", "Fett"],
        rows: intake.filter((d) => d.kcal).map((d) => [formatDate(d.date), `${Math.round(d.protein)} g`, `${Math.round(d.carbs)} g`, `${Math.round(d.fat)} g`]),
      }}
    >
      <div className="h-56" role="img" aria-label="Staplade staplar med protein, kolhydrater och fett per dag">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d) => formatDate(d)} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={axis} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--surface-muted)" }}
              labelFormatter={(d) => formatDate(String(d))}
              formatter={(v, name) => [`${Math.round(Number(v))} g`, { protein: "Protein", carbs: "Kolhydrater", fat: "Fett" }[String(name)] ?? String(name)]}
            />
            <Bar dataKey="protein" stackId="m" fill="var(--macro-protein)" stroke="var(--surface)" strokeWidth={2} maxBarSize={18} />
            <Bar dataKey="carbs" stackId="m" fill="var(--macro-carbs)" stroke="var(--surface)" strokeWidth={2} maxBarSize={18} />
            <Bar dataKey="fat" stackId="m" fill="var(--macro-fat)" stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function ConsistencyChart({ weeks, scheduledPerWeek }: { weeks: { weekStart: string; count: number }[]; scheduledPerWeek: number | null }) {
  return (
    <ChartCard
      title="Genomförda pass"
      description={scheduledPerWeek ? `Per vecka, jämfört med ${scheduledPerWeek} schemalagda pass i ditt aktiva program.` : "Per vecka."}
      table={{ headers: ["Vecka från", "Pass"], rows: weeks.map((w) => [formatDate(w.weekStart), w.count]) }}
    >
      <div className="h-48" role="img" aria-label="Stapeldiagram över genomförda pass per vecka">
        <ResponsiveContainer>
          <BarChart data={weeks} margin={{ left: -24, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="weekStart" tickFormatter={(d) => formatDate(d)} tick={axis} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-muted)" }} labelFormatter={(d) => `Vecka från ${formatDate(String(d))}`} formatter={(v) => [String(v), "Pass"]} />
            {scheduledPerWeek ? <ReferenceLine y={scheduledPerWeek} stroke="var(--foreground)" strokeDasharray="4 4" strokeOpacity={0.5} /> : null}
            <Bar dataKey="count" fill="var(--macro-protein)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function StrengthProgress({ series }: { series: { id: string; name: string; points: { date: string; e1rm: number }[] }[] }) {
  const [selected, setSelected] = useState(series[0]?.id ?? "");
  const current = series.find((s) => s.id === selected) ?? series[0];
  if (!current) return null;
  return (
    <ChartCard
      title="Styrkeutveckling"
      description="Uppskattat 1RM (Epley) från ditt bästa set per pass."
      table={{ headers: ["Datum", "Uppskattat 1RM"], rows: current.points.map((p) => [formatDate(p.date), `${fmt(p.e1rm)} kg`]) }}
    >
      <Select aria-label="Välj övning" value={current.id} onChange={(e) => setSelected(e.target.value)} className="mb-3 sm:w-64">
        {series.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.points.length} pass)
          </option>
        ))}
      </Select>
      <div className="h-52" role="img" aria-label={`Linjediagram över uppskattat 1RM i ${current.name}`}>
        <ResponsiveContainer>
          <LineChart data={current.points} margin={{ left: -12, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d) => formatDate(d)} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={axis} axisLine={false} tickLine={false} domain={[(min: number) => Math.floor(min - 5), (max: number) => Math.ceil(max + 5)]} allowDecimals={false} tickFormatter={(v) => fmt(v, 0)} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => formatDate(String(d))} formatter={(v) => [`${fmt(Number(v))} kg`, "Uppskattat 1RM"]} />
            <Line dataKey="e1rm" type="monotone" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4, fill: "var(--primary)", stroke: "var(--surface)", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function MeasurementChart({ rows }: { rows: { measured_on: string; waist_cm: number | null; chest_cm: number | null; hips_cm: number | null; arm_cm: number | null; thigh_cm: number | null; body_fat_pct: number | null }[] }) {
  const options = [
    ["waist_cm", "Midja", "cm"],
    ["chest_cm", "Bröst", "cm"],
    ["hips_cm", "Höft", "cm"],
    ["arm_cm", "Överarm", "cm"],
    ["thigh_cm", "Lår", "cm"],
    ["body_fat_pct", "Fettprocent", "%"],
  ] as const;
  const available = options.filter(([k]) => rows.filter((r) => r[k] !== null).length >= 1);
  const [key, setKey] = useState<(typeof options)[number][0]>(available[0]?.[0] ?? "waist_cm");
  const meta = options.find(([k]) => k === key)!;
  const points = rows.filter((r) => r[key] !== null).map((r) => ({ date: r.measured_on, value: Number(r[key]) }));
  if (!available.length) return null;
  return (
    <ChartCard title="Kroppsmått" table={{ headers: ["Datum", meta[1]], rows: points.map((p) => [formatDate(p.date), `${fmt(p.value)} ${meta[2]}`]) }}>
      <Select aria-label="Välj mått" value={key} onChange={(e) => setKey(e.target.value as typeof key)} className="mb-3 sm:w-48">
        {available.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </Select>
      {points.length > 1 ? (
        <div className="h-48" role="img" aria-label={`Linjediagram över ${meta[1].toLowerCase()}`}>
          <ResponsiveContainer>
            <LineChart data={points} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => formatDate(d)} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={axis} axisLine={false} tickLine={false} domain={[(min: number) => Math.floor(min - 2), (max: number) => Math.ceil(max + 2)]} allowDecimals={false} tickFormatter={(v) => fmt(v, 0)} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => formatDate(String(d))} formatter={(v) => [`${fmt(Number(v))} ${meta[2]}`, meta[1]]} />
              <Line dataKey="value" type="monotone" stroke="var(--macro-fat)" strokeWidth={2} dot={{ r: 4, fill: "var(--macro-fat)", stroke: "var(--surface)", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Mät igen för att se en kurva.</p>
      )}
    </ChartCard>
  );
}
