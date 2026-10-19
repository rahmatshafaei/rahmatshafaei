"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UnitInput } from "@/components/ui/input";
import { logWeight } from "../framsteg/actions";

export function NoticeToast({ message }: { message: string }) {
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast.success(message);
  }, [message]);
  return null;
}

export function QuickWeight({ today }: { today: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await logWeight(today, value);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Vikten är loggad");
          setValue("");
          router.refresh();
        });
      }}
    >
      <UnitInput unit="kg" aria-label="Dagens vikt" placeholder="Dagens vikt" value={value} onChange={(e) => setValue(e.target.value)} className="flex-1" />
      <Button type="submit" variant="outline" loading={pending} disabled={!value}>
        Logga
      </Button>
    </form>
  );
}
