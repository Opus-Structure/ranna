import { describe, expect, it } from "vitest";
import { formatInvoiceNumber } from "@/lib/billing/invoice-number";
import {
  createMockProvider,
  MOCK_SIGNATURE_HEADER,
  signMockWebhook,
} from "@/lib/billing/providers/mock";
import { safeEqualHex } from "@/lib/billing/providers/signature";
import { WebhookSignatureError } from "@/lib/billing/providers/types";
import { sniffFileType } from "@/lib/files/sniff";

const secret = "x".repeat(40);
const provider = createMockProvider({ appSecret: secret, checkoutUrl: (id) => `/checkout/${id}` });
const paymentId = "6f1c3c1e-8a7b-4c2d-9e10-111111111111";
const body = JSON.stringify({
  id: "evt_12345678",
  type: "payment.succeeded",
  data: { providerRef: `mock_${paymentId}`, paymentId },
});

describe("mock provider webhook verification", () => {
  it("accepts a correctly signed body", async () => {
    const headers = new Headers({ [MOCK_SIGNATURE_HEADER]: signMockWebhook(body, secret) });
    await expect(provider.parseWebhook!(body, headers)).resolves.toEqual({
      eventId: "evt_12345678",
      type: "payment.succeeded",
      providerRef: `mock_${paymentId}`,
      paymentId,
    });
  });

  it("rejects a missing, wrong or replayed-with-edits signature", async () => {
    await expect(provider.parseWebhook!(body, new Headers())).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    const wrong = new Headers({ [MOCK_SIGNATURE_HEADER]: signMockWebhook(body, "y".repeat(40)) });
    await expect(provider.parseWebhook!(body, wrong)).rejects.toBeInstanceOf(WebhookSignatureError);
    const tampered = body.replace("payment.succeeded", "payment.failed");
    const original = new Headers({ [MOCK_SIGNATURE_HEADER]: signMockWebhook(body, secret) });
    await expect(provider.parseWebhook!(tampered, original)).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
  });

  it("rejects well-signed but malformed payloads", async () => {
    const bad = JSON.stringify({ id: "evt_12345678", type: "refund", data: {} });
    const headers = new Headers({ [MOCK_SIGNATURE_HEADER]: signMockWebhook(bad, secret) });
    await expect(provider.parseWebhook!(bad, headers)).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
  });
});

describe("safeEqualHex", () => {
  it("compares in constant time and refuses non-hex or uneven input", () => {
    expect(safeEqualHex("abcd", "abcd")).toBe(true);
    expect(safeEqualHex("abcd", "abce")).toBe(false);
    expect(safeEqualHex("abcd", "abc")).toBe(false);
    expect(safeEqualHex("zz", "zz")).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });
});

describe("invoice numbers", () => {
  it("are prefixed, dated and zero-padded", () => {
    expect(formatInvoiceNumber("RN", new Date("2026-10-13T00:00:00Z"), 42)).toBe("RN-2026-000042");
  });
});

describe("sniffFileType", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0]);
  it("detects receipts by content, not by name", () => {
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff))?.mime).toBe("image/jpeg");
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe(
      "image/png",
    );
    expect(
      sniffFileType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))?.mime,
    ).toBe("image/webp");
    expect(sniffFileType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))?.mime).toBe("application/pdf");
  });
  it("rejects HTML, SVG and executables disguised as images", () => {
    expect(sniffFileType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffFileType(new TextEncoder().encode("<!doctype html>"))).toBeNull();
    expect(sniffFileType(bytes(0x4d, 0x5a))).toBeNull();
  });
});
