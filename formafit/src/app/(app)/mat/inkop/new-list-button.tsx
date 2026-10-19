"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { createEmptyList } from "./actions";

export function NewListButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Veckohandling");
  const [pending, start] = useTransition();
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Tom lista
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Ny inköpslista">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await createEmptyList(name);
                if (!res.ok) return void toast.error(res.error);
                router.push(`/mat/inkop/${res.data.id}`);
              });
            }}
          >
            <Field label="Namn" htmlFor="nl-name">
              <Input id="nl-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <DialogFooter>
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
