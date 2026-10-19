"use client";
import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

/** Chart container with title, legend (≥ 2 series) and an accessible table view. */
export function ChartCard({
  title,
  description,
  legend,
  table,
  children,
}: {
  title: string;
  description?: string;
  legend?: LegendItem[];
  table: { headers: string[]; rows: (string | number)[][] };
  children: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <button
          onClick={() => setShowTable((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-surface-muted"
          aria-pressed={showTable}
        >
          {showTable ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}
          {showTable ? "Visa diagram" : "Visa tabell"}
        </button>
      </CardHeader>
      <CardContent>
        {legend && legend.length >= 2 && !showTable ? (
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {legend.map((l) => (
              <li key={l.label} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-4 rounded"
                  style={l.dashed ? { backgroundImage: `linear-gradient(90deg, ${l.color} 50%, transparent 50%)`, backgroundSize: "6px 2px" } : { background: l.color }}
                />
                {l.label}
              </li>
            ))}
          </ul>
        ) : null}
        {showTable ? (
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm tabular">
              <thead className="sticky top-0 bg-surface text-left text-muted-foreground">
                <tr>
                  {table.headers.map((h) => (
                    <th key={h} className="py-1.5 pr-3 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    {r.map((c, j) => (
                      <td key={j} className="py-1.5 pr-3">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
