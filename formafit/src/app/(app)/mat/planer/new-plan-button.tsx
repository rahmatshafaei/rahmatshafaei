"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { mondayOf, addDays } from "@/lib/dates";
import { createPlan } from "./actions";

export function NewPlanButton({ today }: { today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [s, setS] = useState({ name: "Veckoplan", startDate: addDays(mondayOf(today), 7), numDays: "7" });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Ny plan
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Ny måltidsplan">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await createPlan(s);
                if (!res.ok) return void toast.error(res.error);
                setOpen(false);
                router.push(`/mat/planer/${res.data.id}`);
              });
            }}
          >
            <Field label="Namn" htmlFor="np-name">
              <Input id="np-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Startdatum" htmlFor="np-start">
                <Input id="np-start" type="date" value={s.startDate} onChange={(e) => setS({ ...s, startDate: e.target.value })} required />
              </Field>
              <Field label="Längd" htmlFor="np-days">
                <Select id="np-days" value={s.numDays} onChange={(e) => setS({ ...s, numDays: e.target.value })}>
                  <option value="1">1 dag</option>
                  <option value="3">3 dagar</option>
                  <option value="7">1 vecka</option>
                  <option value="14">2 veckor</option>
                </Select>
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Avbryt
              </Button>
              <Button type="submit" loading={pending}>
                Skapa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
