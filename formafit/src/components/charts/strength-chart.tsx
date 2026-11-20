"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/dates";

export function StrengthChart({ data }: { data: { date: string; e1rm: number; top: number }[] }) {
  return (
    <div>
      <ul className="mb-2 flex gap-4 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded bg-primary" /> Uppskattat 1RM
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ backgroundImage: "linear-gradient(90deg, var(--macro-protein) 50%, transparent 50%)", backgroundSize: "6px 2px" }} />
          Tyngsta set
        </li>
      </ul>
      <div className="h-56 w-full" role="img" aria-label="Diagram över uppskattat 1RM och tyngsta vikt per pass">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d) => formatDate(d)} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} domain={["dataMin - 5", "dataMax + 5"]} />
            <Tooltip
              formatter={(v, name) => [`${Number(v).toLocaleString("sv-SE")} kg`, name === "e1rm" ? "Uppskattat 1RM" : "Tyngsta set"]}
              labelFormatter={(d) => formatDate(String(d), { day: "numeric", month: "long", year: "numeric" })}
              contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--foreground)" }}
            />
            <Line type="monotone" dataKey="e1rm" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4, fill: "var(--primary)", stroke: "var(--surface)", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="top" stroke="var(--macro-protein)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
