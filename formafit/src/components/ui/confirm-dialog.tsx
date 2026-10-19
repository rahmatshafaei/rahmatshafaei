"use client";
import * as React from "react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogFooter } from "./dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** Explicit confirmation step used before destructive or bulk changes. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Bekräfta", destructive, onConfirm }: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title}>
        <p className="text-sm text-muted-foreground">{description}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Avbryt
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            loading={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setPending(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
