import { describe, expect, it } from "vitest";
import { windowFor } from "@/lib/rate-limit";
import { buildCsp } from "@/lib/security/csp";

describe("rate limit window", () => {
  it("aligns to fixed windows and reports the wait", () => {
    const now = Date.parse("2026-10-13T10:07:30Z");
    const w = windowFor(now, 15 * 60);
    expect(w.start.toISOString()).toBe("2026-10-13T10:00:00.000Z");
    expect(w.retryAfterSec).toBe(450);
  });
});

describe("CSP", () => {
  it("is nonce-based and locks down framing and plugins", () => {
    const csp = buildCsp({ nonce: "abc", dev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
  it("allows eval only in development", () => {
    expect(buildCsp({ nonce: "abc", dev: true })).toContain("'unsafe-eval'");
  });
});
