import { describe, expect, it } from "vitest";
import { detectImageType, validateImage } from "./storage";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

describe("upload validation", () => {
  it("detects images by magic bytes", () => {
    expect(detectImageType(png)?.mime).toBe("image/png");
    expect(detectImageType(jpeg)?.ext).toBe("jpg");
    expect(detectImageType(webp)?.mime).toBe("image/webp");
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("ignores the client-declared type and enforces size limits", async () => {
    const fakeSvg = new File([new TextEncoder().encode("<svg/>")], "x.png", { type: "image/png" });
    await expect(validateImage(fakeSvg, "user-media")).rejects.toThrow("Endast JPEG, PNG eller WebP stöds.");
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" });
    await expect(validateImage(big, "user-media")).rejects.toThrow(/för stor/);
    await expect(validateImage(new File([png], "ok.png"), "user-media")).resolves.toMatchObject({ mime: "image/png" });
    await expect(validateImage(null, "user-media")).rejects.toThrow("Välj en bild.");
  });
});
