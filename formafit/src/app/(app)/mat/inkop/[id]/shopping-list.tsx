"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useSyncedState } from "@/lib/hooks";
import { Check, EllipsisVertical, Pencil, Plus, Printer, RotateCcw, Search, Share2, ShoppingCart, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { Field, Input, Select, UnitInput } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { GROCERY_CATEGORIES, PREPARATION_LABELS, formatQuantity, groceryListToText, groupByCategory, type GroceryCategory } from "@/lib/grocery/aggregate";
import type { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { addListItem, clearPurchased, deleteList, deleteListItem, setPurchased, updateListItem } from "../actions";

type Item = Tables<"shopping_list_items">;

export function ShoppingList({ list, items: initial, planName }: { list: Tables<"shopping_lists">; items: Item[]; planName: string | null }) {
  const router = useRouter();
  const [items, setItems] = useSyncedState(initial);
  const [query, setQuery] = useState("");
  const [shopping, setShopping] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", category: "other" as GroceryCategory, quantity: "", unit: "st" });
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("sv-SE");
    return items.filter((i) => (!q || i.name.toLocaleLowerCase("sv-SE").includes(q)) && (!shopping || !i.is_purchased));
  }, [items, query, shopping]);
  const groups = groupByCategory(filtered);
  const done = items.filter((i) => i.is_purchased).length;
  const totalPrice = items.reduce((s, i) => s + (i.price_sek ? Number(i.price_sek) : 0), 0);
  const hasPrices = items.some((i) => i.price_sek !== null);

  function toggle(item: Item) {
    const value = !item.is_purchased;
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, is_purchased: value } : x)));
    start(async () => {
      const res = await setPurchased(item.id, value);
      if (!res.ok) {
        toast.error(res.error);
        setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, is_purchased: !value } : x)));
      }
    });
  }

  async function share() {
    const text = groceryListToText(list.name, items.map((i) => ({ ...i, quantity: i.quantity === null ? null : Number(i.quantity) })));
    try {
      if (navigator.share) {
        await navigator.share({ title: list.name, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Listan är kopierad till urklipp");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Det gick inte att dela listan.");
    }
  }

  return (
    <div className={cn(shopping && "pb-8")}>
      <PageHeader
        title={list.name}
        eyebrow={
          <Link href="/mat/inkop" className="no-print hover:underline">
            Inköpslistor
          </Link>
        }
        description={[
          planName ? `Från ${planName}` : null,
          list.start_date && list.end_date ? `${formatDate(list.start_date)} – ${formatDate(list.end_date)}` : null,
          `${done}/${items.length} köpta`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="no-print flex gap-2">
            <Button variant={shopping ? "default" : "outline"} onClick={() => setShopping((s) => !s)} aria-pressed={shopping}>
              <ShoppingCart /> {shopping ? "Avsluta handling" : "Handla"}
            </Button>
            <Button variant="outline" size="icon" onClick={share} aria-label="Dela listan">
              <Share2 />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Fler val">
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => window.print()}>
                  <Printer /> Skriv ut
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    start(async () => {
                      const res = await clearPurchased(list.id);
                      if (!res.ok) return void toast.error(res.error);
                      setItems((xs) => xs.map((x) => ({ ...x, is_purchased: false })));
                    })
                  }
                >
                  <RotateCcw /> Avmarkera alla
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
                  <Trash2 /> Ta bort listan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="no-print mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" placeholder="Sök i listan…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" aria-label="Sök i listan" />
        </div>
        {!shopping ? (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await addListItem({ listId: list.id, ...newItem });
                if (!res.ok) return void toast.error(res.error);
                setNewItem({ name: "", category: newItem.category, quantity: "", unit: newItem.unit });
                router.refresh();
              });
            }}
          >
            <Input className="min-w-40 flex-1" placeholder="Lägg till vara…" aria-label="Ny vara" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
            <Input className="w-20" placeholder="Antal" aria-label="Antal" inputMode="decimal" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} />
            <Select className="w-24" aria-label="Enhet" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}>
              {["st", "g", "ml", "förp"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
            <Select className="w-44" aria-label="Kategori" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value as GroceryCategory })}>
              {GROCERY_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Button type="submit" disabled={!newItem.name.trim()} loading={pending}>
              <Plus /> Lägg till
            </Button>
          </form>
        ) : null}
      </div>

      {groups.length ? (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <Card key={g.key}>
              <CardContent className="pt-4">
                <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">{g.label}</h2>
                <ul className="divide-y">
                  {g.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-1.5">
                      <button
                        onClick={() => toggle(item)}
                        role="checkbox"
                        aria-checked={item.is_purchased}
                        className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2 text-left", shopping && "py-3")}
                      >
                        <span
                          className={cn(
                            "flex shrink-0 items-center justify-center rounded-lg border-2 transition-colors",
                            shopping ? "size-7" : "size-5",
                            item.is_purchased ? "border-primary-strong bg-primary-strong text-primary-foreground" : "border-border bg-surface",
                          )}
                          aria-hidden
                        >
                          {item.is_purchased ? <Check className="size-3.5" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate", shopping && "text-base", item.is_purchased && "text-muted-foreground line-through")}>{item.name}</span>
                          {item.preparation && PREPARATION_LABELS[item.preparation] ? (
                            <span className="block text-xs text-muted-foreground">{PREPARATION_LABELS[item.preparation]}</span>
                          ) : null}
                          {item.note ? <span className="block text-xs text-muted-foreground">{item.note}</span> : null}
                        </span>
                        <span className="shrink-0 text-sm font-medium tabular text-muted-foreground">
                          {item.quantity !== null ? formatQuantity(Number(item.quantity), item.unit) : ""}
                          {item.price_sek !== null ? ` · ${Number(item.price_sek).toLocaleString("sv-SE")} kr` : ""}
                        </span>
                      </button>
                      {!shopping ? (
                        <div className="no-print flex">
                          <Button variant="ghost" size="icon-sm" aria-label={`Ändra ${item.name}`} onClick={() => setEditing(item)}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Ta bort ${item.name}`}
                            onClick={() =>
                              start(async () => {
                                const res = await deleteListItem(item.id);
                                if (!res.ok) return void toast.error(res.error);
                                setItems((xs) => xs.filter((x) => x.id !== item.id));
                              })
                            }
                          >
                            <X />
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
          {hasPrices ? (
            <p className="text-right text-sm text-muted-foreground">
              Summa av dina inmatade priser: <span className="font-semibold text-foreground tabular">{totalPrice.toLocaleString("sv-SE")} kr</span>
            </p>
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon={shopping ? Check : ShoppingCart}
          title={shopping && items.length ? "Allt är handlat!" : query ? "Inga träffar" : "Listan är tom"}
          description={shopping && items.length ? "Bra jobbat. Avsluta handlingsläget för att se hela listan." : "Lägg till varor ovan."}
        />
      )}

      <EditItemDialog item={editing} onClose={() => setEditing(null)} onSaved={() => router.refresh()} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title="Ta bort inköpslistan?"
        description="Listan och alla varor tas bort. Måltidsplanen påverkas inte."
        confirmLabel="Ta bort"
        onConfirm={async () => {
          const res = await deleteList(list.id);
          if (!res.ok) return void toast.error(res.error);
          router.push("/mat/inkop");
        }}
      />
    </div>
  );
}

function EditItemDialog({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState({ quantity: "", unit: "g", priceSek: "", note: "" });
  const [lastId, setLastId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (item && item.id !== lastId) {
    setLastId(item.id);
    setS({ quantity: item.quantity?.toString() ?? "", unit: item.unit ?? "g", priceSek: item.price_sek?.toString() ?? "", note: item.note ?? "" });
  }
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      {item ? (
        <DialogContent title={item.name}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await updateListItem({ id: item.id, ...s });
                if (!res.ok) return void toast.error(res.error);
                onClose();
                onSaved();
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mängd" htmlFor="ei-q">
                <Input id="ei-q" inputMode="decimal" value={s.quantity} onChange={(e) => setS({ ...s, quantity: e.target.value })} />
              </Field>
              <Field label="Enhet" htmlFor="ei-u">
                <Select id="ei-u" value={s.unit} onChange={(e) => setS({ ...s, unit: e.target.value })}>
                  {["g", "ml", "st", "förp"].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Pris" htmlFor="ei-p" optional hint="Ange själv – FormaFit hämtar inga butikspriser.">
              <UnitInput unit="kr" id="ei-p" value={s.priceSek} onChange={(e) => setS({ ...s, priceSek: e.target.value })} />
            </Field>
            <Field label="Anteckning" htmlFor="ei-n" optional>
              <Input id="ei-n" value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} />
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
      ) : null}
    </Dialog>
  );
}
