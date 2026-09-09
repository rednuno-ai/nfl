import { afterEach, expect, it, vi } from "vitest";
import { WorkerRepository } from "../workerRepository";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("aborts a stalled career load rather than leaving it pending", async () => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  const spy = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(5));
  vi.stubGlobal("fetch", (_path: string, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal!.addEventListener("abort", () => reject(new Error("Request timed out")), { once: true });
  }));
  await expect(new WorkerRepository().loadCareer("test", "save")).rejects.toThrow("timed out");
  expect(spy).toHaveBeenCalledWith(15000);
});

it("surfaces an expired session instead of treating it as an empty career", async () => {
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, error: "Sign in to continue." }), { status: 401 }));
  await expect(new WorkerRepository().loadCareer("test", "save")).rejects.toThrow("Sign in");
});
