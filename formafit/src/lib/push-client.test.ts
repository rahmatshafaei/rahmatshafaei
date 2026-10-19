import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array, withTimeout } from "./push-client";

describe("push client helpers", () => {
  it("decodes URL-safe base64 VAPID keys", () => {
    expect([...urlBase64ToUint8Array("-_8")]).toEqual([251, 255]);
    expect([...urlBase64ToUint8Array("AQID")]).toEqual([1, 2, 3]);
  });

  it("times out slow browser APIs", async () => {
    await expect(withTimeout(new Promise(() => {}), 10, "för långsamt")).rejects.toThrow("för långsamt");
    await expect(withTimeout(Promise.resolve(5), 10)).resolves.toBe(5);
  });
});
