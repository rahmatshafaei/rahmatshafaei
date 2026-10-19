// @vitest-environment node
/**
 * Runs public/sw.js in an isolated context with fake browser APIs to check the caching rules:
 * private pages and API responses must never be stored, only hashed build assets.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://formafit.test";
const source = readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");

type Listener = (event: Record<string, unknown>) => void;

function load() {
  const listeners = new Map<string, Listener>();
  const store = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (req: Request | string) => store.get(typeof req === "string" ? `${ORIGIN}${req}` : req.url)?.clone()),
    put: vi.fn(async (req: Request, res: Response) => void store.set(req.url, res)),
    addAll: vi.fn(async (urls: string[]) => urls.forEach((u) => store.set(`${ORIGIN}${u}`, new Response(`cached ${u}`)))),
  };
  const caches = {
    open: vi.fn(async () => cache),
    match: (req: string) => cache.match(req),
    keys: vi.fn(async () => ["formafit-static-v0", "other-app"]),
    delete: vi.fn(async () => true),
  };
  const fetch = vi.fn(async (req: Request) => {
    const res = new Response(`network ${new URL(req.url).pathname}`);
    Object.defineProperty(res, "type", { value: "basic" });
    return res;
  });
  const showNotification = vi.fn(async () => {});
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Listener) => void listeners.set(type, fn),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(), matchAll: vi.fn(async () => []), openWindow: vi.fn() },
    registration: { showNotification },
  };
  vm.runInNewContext(source, { self, caches, fetch, URL, Response, Promise, console });

  async function dispatchFetch(url: string, init: { method?: string; mode?: string } = {}) {
    const request = { url: `${ORIGIN}${url}`, method: init.method ?? "GET", mode: init.mode ?? "cors" } as unknown as Request;
    let responded: Promise<Response> | undefined;
    listeners.get("fetch")!({ request, respondWith: (p: Promise<Response>) => (responded = p) });
    return responded ? await responded : undefined;
  }
  async function dispatch(type: string, extra: Record<string, unknown>) {
    let done: Promise<unknown> | undefined;
    listeners.get(type)!({ ...extra, waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  }
  return { dispatchFetch, dispatch, fetch, cache, caches, showNotification, store };
}

describe("service worker", () => {
  let sw: ReturnType<typeof load>;
  beforeEach(() => {
    sw = load();
  });

  it("precaches only public files and removes old FormaFit caches", async () => {
    await sw.dispatch("install", {});
    expect(sw.cache.addAll).toHaveBeenCalledWith(["/offline.html", "/icon.svg", "/icon-192.png"]);
    await sw.dispatch("activate", {});
    expect(sw.caches.delete).toHaveBeenCalledWith("formafit-static-v0");
    expect(sw.caches.delete).not.toHaveBeenCalledWith("other-app");
  });

  it("loads pages from the network without caching them", async () => {
    const res = await sw.dispatchFetch("/hem", { mode: "navigate" });
    expect(await res!.text()).toBe("network /hem");
    expect(sw.cache.put).not.toHaveBeenCalled();
  });

  it("shows the offline page when a navigation fails", async () => {
    await sw.dispatch("install", {});
    sw.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const res = await sw.dispatchFetch("/traning", { mode: "navigate" });
    expect(await res!.text()).toBe("cached /offline.html");
  });

  it("does not touch API calls, Server Actions or other origins", async () => {
    expect(await sw.dispatchFetch("/api/export")).toBeUndefined();
    expect(await sw.dispatchFetch("/traning/pass/1", { method: "POST" })).toBeUndefined();
    expect(sw.fetch).not.toHaveBeenCalled();
  });

  it("serves hashed build assets from the cache after the first load", async () => {
    const first = await sw.dispatchFetch("/_next/static/chunks/app-abc123.js");
    expect(await first!.text()).toBe("network /_next/static/chunks/app-abc123.js");
    const second = await sw.dispatchFetch("/_next/static/chunks/app-abc123.js");
    expect(await second!.text()).toBe("network /_next/static/chunks/app-abc123.js");
    expect(sw.fetch).toHaveBeenCalledTimes(1);
  });

  it("shows push notifications and only opens same-origin paths", async () => {
    const data = (payload: unknown) => ({ json: () => payload });
    await sw.dispatch("push", { data: data({ title: "Dags att träna", body: "Push A", url: "/traning", tag: "workout-1" }) });
    expect(sw.showNotification).toHaveBeenCalledWith("Dags att träna", expect.objectContaining({ body: "Push A", tag: "workout-1", data: { url: "/traning" } }));

    await sw.dispatch("push", { data: data({ title: "X", url: "https://evil.example" }) });
    expect(sw.showNotification).toHaveBeenLastCalledWith("X", expect.objectContaining({ data: { url: "/hem" } }));

    sw.showNotification.mockClear();
    await sw.dispatch("push", { data: data({ nope: true }) });
    await sw.dispatch("push", { data: { json: () => JSON.parse("not json") } });
    expect(sw.showNotification).not.toHaveBeenCalled();
  });
});
