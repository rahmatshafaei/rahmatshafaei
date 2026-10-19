import { CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import type { WeeklySummary } from "@/lib/progress/summary";

export function WeeklySummaryCard({ summary, title }: { summary: WeeklySummary; title: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="size-4 text-primary-strong" aria-hidden /> {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatDate(summary.weekStart)} – {formatDate(summary.weekEnd)} · baserat endast på det du loggat
        </p>
      </CardHeader>
      <CardContent>
        {summary.hasEnoughData ? (
          <ul className="space-y-1.5 text-sm">
            {summary.highlights.map((h) => (
              <li key={h} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                {h}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Inget loggat den här veckan ännu.</p>
        )}
      </CardContent>
    </Card>
  );
}
