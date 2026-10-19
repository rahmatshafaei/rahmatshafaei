"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { unsubscribeBrowser } from "@/lib/push-client";
import { clearAllPending } from "@/lib/workout/offline-queue";
import { deleteAccount } from "./actions";

export function DataCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dina data</CardTitle>
        <CardDescription>Ladda ned allt du har sparat eller radera kontot permanent.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button variant="outline" asChild>
          <a href="/api/export" download>
            <Download /> Exportera mina data (JSON)
          </a>
        </Button>
        <Button variant="ghost" className="text-danger" onClick={() => setOpen(true)}>
          <Trash2 /> Radera konto
        </Button>
      </CardContent>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setPassword("");
            setConfirm("");
            setError(null);
          }
        }}
      >
        <DialogContent title="Radera kontot permanent?" description="Det här går inte att ångra.">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await deleteAccount({ password, confirm });
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                // Server rows are gone with the account; also forget this device's subscription and queue.
                clearAllPending();
                await unsubscribeBrowser().catch(() => null);
                toast.success("Kontot är raderat");
                // The session cookies are already cleared; refresh drops the signed-in UI.
                router.replace("/?konto=raderat");
                router.refresh();
              });
            }}
          >
            <Notice variant="danger">
              Profil, mål, dagbok, planer, recept, träningspass, mått, bilder, inköpslistor och coachkonversationer raderas för gott. Exportera
              dina data först om du vill spara dem.
            </Notice>
            <Field label="Lösenord" htmlFor="del-password" error={error ?? undefined}>
              <Input id="del-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Skriv RADERA för att bekräfta" htmlFor="del-confirm">
              <Input id="del-confirm" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Avbryt
              </Button>
              <Button type="submit" variant="destructive" loading={pending} disabled={confirm !== "RADERA" || !password}>
                Radera kontot
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
