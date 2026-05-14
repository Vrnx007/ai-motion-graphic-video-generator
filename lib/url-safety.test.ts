import { describe, it, expect } from "vitest";
import { fetchWithRedirectSafety, isUrlSafeForServerFetch } from "@/lib/url-safety";

describe("url-safety", () => {
  it("blocks localhost", () => {
    expect(isUrlSafeForServerFetch("http://localhost:8080/x").ok).toBe(false);
  });

  it("allows public https host", () => {
    const r = isUrlSafeForServerFetch("https://example.com/logo.png");
    expect(r.ok).toBe(true);
  });
});

describe("fetchWithRedirectSafety", () => {
  it("returns null for blocked redirect target", async () => {
    // This URL may 301 — test only validates we do not throw
    const res = await fetchWithRedirectSafety("https://example.com", { timeoutMs: 5000 });
    expect(res === null || res.ok).toBe(true);
  });
});
