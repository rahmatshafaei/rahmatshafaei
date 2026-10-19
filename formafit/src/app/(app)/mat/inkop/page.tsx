import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBasket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { NewListButton } from "./new-list-button";

export const metadata: Metadata = { title: "Inköpslistor" };

export default async function ShoppingListsPage() {
  const auth = await requireAuth();
  const { data } = await auth.supabase
    .from("shopping_lists")
    .select("id, name, start_date, end_date, created_at, shopping_list_items(is_purchased)")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });
  const lists = data ?? [];
  return (
    <>
      <PageHeader
        title="Inköpslistor"
        description="Skapa en lista från en måltidsplan eller börja med en tom lista."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/mat/planer">Från måltidsplan</Link>
            </Button>
            <NewListButton />
          </>
        }
      />
      {lists.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {lists.map((l) => {
            const total = l.shopping_list_items.length;
            const done = l.shopping_list_items.filter((i) => i.is_purchased).length;
            return (
              <Link key={l.id} href={`/mat/inkop/${l.id}`}>
                <Card className="p-5 transition-colors hover:border-primary/40">
                  <h2 className="font-semibold">{l.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {l.start_date && l.end_date ? `${formatDate(l.start_date)} – ${formatDate(l.end_date)} · ` : ""}
                    {done}/{total} köpta
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full bg-primary" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={ShoppingBasket}
          title="Inga inköpslistor"
          description="Öppna en måltidsplan och välj Inköpslista för att summera alla ingredienser automatiskt."
          action={
            <Button asChild>
              <Link href="/mat/planer">Gå till måltidsplaner</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
