"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { SPLIT_LABELS } from "@/lib/labels";
import { createProgram, createProgramFromTemplate } from "../actions";

export function NewProgramButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState({ name: "Mitt program", splitType: "custom" });
  const [pending, start] = useTransition();
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Nytt program
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Nytt program">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await createProgram(s);
                if (!res.ok) return void toast.error(res.error);
                router.push(`/traning/program/${res.data.id}`);
              });
            }}
          >
            <Field label="Namn" htmlFor="pr-name">
              <Input id="pr-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
            </Field>
            <Field label="Upplägg" htmlFor="pr-split">
              <Select id="pr-split" value={s.splitType} onChange={(e) => setS({ ...s, splitType: e.target.value })}>
                {Object.entries(SPLIT_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
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

export function TemplateButton({ templateKey }: { templateKey: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="soft"
      className="mt-4 self-start"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await createProgramFromTemplate(templateKey);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Programmet är skapat – anpassa det fritt");
          router.push(`/traning/program/${res.data.id}`);
        })
      }
    >
      <Copy /> Använd mall
    </Button>
  );
}
