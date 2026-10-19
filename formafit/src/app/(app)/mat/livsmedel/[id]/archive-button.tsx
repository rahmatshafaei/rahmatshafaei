"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { archiveFood } from "../../actions";

export function ArchiveFoodButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" className="text-danger" onClick={() => setOpen(true)}>
        <Trash2 /> Ta bort livsmedel
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        title="Ta bort livsmedlet?"
        description="Livsmedlet döljs från sökningar. Tidigare dagboksposter behåller sina värden, och planer som använder det påverkas inte."
        confirmLabel="Ta bort"
        onConfirm={async () => {
          const res = await archiveFood(id);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Borttaget");
          router.push("/mat/livsmedel");
        }}
      />
    </>
  );
}
