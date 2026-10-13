import { describe, expect, it } from "vitest";
import { clientIp, hashIdentifier, isSameOrigin, safeNextPath } from "@/lib/http/request";

describe("safeNextPath", () => {
  it.each([
    ["/dashboard/menu", "/dashboard/menu"],
    ["/dashboard?tab=2", "/dashboard?tab=2"],
    ["/fr/dashboard", "/fr/dashboard"],
  ])("keeps same-site path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/x",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "dashboard",
    "/dash\nboard",
    "",
    null,
    undefined,
  ])("rejects %s", (input) => {
    expect(safeNextPath(input as string | null | undefined, "/fallback")).toBe("/fallback");
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "41.100.1.2, 10.0.0.1" }))).toBe("41.100.1.2");
  });
  it("falls back to x-real-ip, then unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "41.1.1.1" }))).toBe("41.1.1.1");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("hashIdentifier", () => {
  it("is stable, case-insensitive, and does not contain the input", () => {
    const a = hashIdentifier("Amine@Example.com", "s".repeat(32));
    expect(a).toBe(hashIdentifier("amine@example.com", "s".repeat(32)));
    expect(a).not.toContain("amine");
    expect(a).toHaveLength(22);
  });
  it("depends on the secret", () => {
    expect(hashIdentifier("x", "a".repeat(32))).not.toBe(hashIdentifier("x", "b".repeat(32)));
  });
});

describe("isSameOrigin", () => {
  const req = (origin?: string) =>
    new Request("http://localhost:3000/api/x", {
      method: "POST",
      headers: origin ? { origin } : {},
    });
  it("accepts the app origin only", () => {
    expect(isSameOrigin(req("http://localhost:3000"), "http://localhost:3000")).toBe(true);
    expect(isSameOrigin(req("https://evil.example"), "http://localhost:3000")).toBe(false);
    expect(isSameOrigin(req(), "http://localhost:3000")).toBe(false);
  });
});
