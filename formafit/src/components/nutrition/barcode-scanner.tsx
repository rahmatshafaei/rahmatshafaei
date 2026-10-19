"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CameraOff } from "lucide-react";
import { toast } from "sonner";
import { lookupBarcode } from "@/app/(app)/mat/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { useFeature } from "@/lib/hooks";
import type { FoodSummary } from "@/lib/types";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

/**
 * Barcode lookup. Camera scanning uses the browser's native BarcodeDetector API where it
 * exists (e.g. Chrome on Android). Elsewhere the user types the number; nothing is simulated.
 */
export function BarcodeScanner({ onFound }: { onFound: (food: FoodSummary) => void }) {
  const supported = useFeature(() => "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia));
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  function lookup(value: string) {
    start(async () => {
      const res = await lookupBarcode(value);
      if (!res.ok) return void toast.error(res.error);
      onFound(res.data);
    });
  }

  async function startScan() {
    try {
      const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
      const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const found = await detector.detect(video);
          if (found[0]?.rawValue) {
            stopScan();
            setCode(found[0].rawValue);
            lookup(found[0].rawValue);
            return;
          }
        } catch {
          // Frame not ready yet.
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      toast.error("Kameran kunde inte startas. Kontrollera behörigheten eller ange koden manuellt.");
      stopScan();
    }
  }

  function stopScan() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {supported ? (
        <div className="flex flex-col gap-3">
          <div className={scanning ? "overflow-hidden rounded-2xl bg-black" : "hidden"}>
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          </div>
          {scanning ? (
            <Button variant="outline" onClick={stopScan}>
              <CameraOff /> Stoppa kameran
            </Button>
          ) : (
            <Button variant="soft" onClick={startScan}>
              <Camera /> Skanna med kameran
            </Button>
          )}
        </div>
      ) : (
        <Notice>Kameraskanning stöds inte i den här webbläsaren ännu. Ange streckkoden manuellt nedan.</Notice>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
        e.stopPropagation();
          lookup(code.trim());
        }}
      >
        <Field label="Streckkod (EAN)" htmlFor="barcode" className="flex-1">
          <Input id="barcode" inputMode="numeric" pattern="[0-9]*" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="7310865004703" />
        </Field>
        <Button type="submit" loading={pending} disabled={code.length < 6}>
          Sök
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">Vi söker först i din databas och sedan i Open Food Facts.</p>
    </div>
  );
}
