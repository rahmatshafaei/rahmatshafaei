"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { startSession } from "@/app/(app)/traning/actions";
import { Button, type ButtonProps } from "@/components/ui/button";

export function StartSessionButton({
  programDayId,
  date,
  label = "Starta pass",
  ...props
}: { programDayId: string | null; date?: string; label?: string } & Omit<ButtonProps, "onClick">) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await startSession({ programDayId, date });
          if (!res.ok) return void toast.error(res.error);
          router.push(`/traning/pass/${res.data.id}`);
        })
      }
      {...props}
    >
      <Play /> {label}
    </Button>
  );
}
