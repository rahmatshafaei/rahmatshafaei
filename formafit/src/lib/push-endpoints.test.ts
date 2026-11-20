import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "./push-endpoints";

describe("push endpoint allowlist", () => {
  it("accepts the browsers' push services", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QH9s")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isAllowedPushEndpoint("https://FCM.googleapis.com:443/fcm/send/abc")).toBe(true);
  });

  it("rejects anything the server should not call", () => {
    for (const url of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://10.0.0.5:8443/x",
      "https://localhost/x",
      "https://fcm.googleapis.com.evil.example/x",
      "https://evilnotify.windows.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://user:pw@fcm.googleapis.com/x",
      "not a url",
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(false);
    }
  });

  it("allows extra hosts only when configured (tests)", () => {
    expect(isAllowedPushEndpoint("https://push.example.test/e2e/1")).toBe(false);
    expect(isAllowedPushEndpoint("https://push.example.test/e2e/1", ["push.example.test"])).toBe(true);
  });
});
