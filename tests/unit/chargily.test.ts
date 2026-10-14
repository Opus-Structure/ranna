import { describe, expect, it } from "vitest";
import {
  chargilyBaseUrl,
  createChargilyProvider,
  toChargilyAmount,
  CHARGILY_SIGNATURE_HEADER,
} from "@/lib/billing/providers/chargily";
import { hmacSha256Hex } from "@/lib/billing/providers/signature";
import { WebhookSignatureError } from "@/lib/billing/providers/types";

const KEY = "test_sk_unit_0123456789";

function signed(body: unknown, key = KEY) {
  const raw = JSON.stringify(body);
  return { raw, headers: new Headers({ [CHARGILY_SIGNATURE_HEADER]: hmacSha256Hex(key, raw) }) };
}

const paidEvent = (over: Record<string, unknown> = {}) => ({
  id: "01hj5n7cqpaf0mt2d0xx85tgz8",
  entity: "event",
  livemode: "false",
  type: "checkout.paid",
  data: {
    id: "01hj5n7cqpaf0mt2d0xx85tgz9",
    status: "paid",
    amount: 2900,
    currency: "dzd",
    metadata: { payment_id: "2f1b7a9e-6a7d-4f0e-9d3c-6f6c0f6f1a11", invoice: "R-2026-000001" },
  },
  ...over,
});

describe("Chargily amounts and URLs", () => {
  it("sends whole dinars and refuses anything else", () => {
    expect(toChargilyAmount(290000, "DZD")).toBe(2900);
    expect(() => toChargilyAmount(290050, "DZD")).toThrow();
    expect(() => toChargilyAmount(1000, "EUR")).toThrow();
  });

  it("uses the documented test and live base URLs", () => {
    expect(chargilyBaseUrl("test")).toBe("https://pay.chargily.net/test/api/v2");
    expect(chargilyBaseUrl("live")).toBe("https://pay.chargily.net/api/v2");
  });
});

describe("startCheckout", () => {
  it("posts the documented checkout body with the secret key and returns the hosted page", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          id: "ch_123",
          checkout_url: "https://pay.chargily.dz/test/checkouts/ch_123/pay",
          status: "pending",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const provider = createChargilyProvider({ secretKey: KEY, mode: "test", fetchImpl });
    const result = await provider.startCheckout!({
      paymentId: "2f1b7a9e-6a7d-4f0e-9d3c-6f6c0f6f1a11",
      invoiceNumber: "R-2026-000001",
      amountMinor: 290000,
      currency: "DZD",
      locale: "fr",
      successUrl: "https://app.test/fr/dashboard/billing?checkout=success",
      failureUrl: "https://app.test/fr/dashboard/billing?checkout=failed",
      webhookUrl: "https://app.test/api/webhooks/chargily",
    });
    expect(result).toEqual({
      redirectUrl: "https://pay.chargily.dz/test/checkouts/ch_123/pay",
      providerRef: "ch_123",
    });
    expect(calls[0]!.url).toBe("https://pay.chargily.net/test/api/v2/checkouts");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      amount: 2900,
      currency: "dzd",
      success_url: "https://app.test/fr/dashboard/billing?checkout=success",
      failure_url: "https://app.test/fr/dashboard/billing?checkout=failed",
      webhook_endpoint: "https://app.test/api/webhooks/chargily",
      locale: "fr",
      description: "R-2026-000001",
      metadata: { payment_id: "2f1b7a9e-6a7d-4f0e-9d3c-6f6c0f6f1a11", invoice: "R-2026-000001" },
    });
  });

  it("fails loudly on an API error", async () => {
    const fetchImpl = (async () =>
      new Response("nope", { status: 422 })) as unknown as typeof fetch;
    const provider = createChargilyProvider({ secretKey: KEY, mode: "test", fetchImpl });
    await expect(
      provider.startCheckout!({
        paymentId: "x",
        invoiceNumber: "R",
        amountMinor: 100000,
        currency: "DZD",
        locale: "ar",
        successUrl: "https://a.test",
        failureUrl: "https://a.test",
        webhookUrl: "https://a.test",
      }),
    ).rejects.toThrow(/http_422/);
  });
});

describe("parseWebhook", () => {
  const provider = createChargilyProvider({ secretKey: KEY, mode: "test" });

  it("verifies the signature over the raw body and normalises the event", async () => {
    const { raw, headers } = signed(paidEvent());
    expect(await provider.parseWebhook!(raw, headers)).toEqual({
      eventId: "01hj5n7cqpaf0mt2d0xx85tgz8",
      type: "payment.succeeded",
      providerRef: "01hj5n7cqpaf0mt2d0xx85tgz9",
      paymentId: "2f1b7a9e-6a7d-4f0e-9d3c-6f6c0f6f1a11",
      amountMinor: 290000,
      currency: "DZD",
    });
  });

  it("maps failed and canceled checkouts, and ignores other event types", async () => {
    for (const [type, expected] of [
      ["checkout.failed", "payment.failed"],
      ["checkout.canceled", "payment.canceled"],
      ["checkout.expired", "ignored"],
    ] as const) {
      const { raw, headers } = signed(paidEvent({ type }));
      expect((await provider.parseWebhook!(raw, headers)).type).toBe(expected);
    }
  });

  it("accepts metadata sent as an array of pairs", async () => {
    const event = paidEvent();
    (event.data as Record<string, unknown>).metadata = [
      { payment_id: "2f1b7a9e-6a7d-4f0e-9d3c-6f6c0f6f1a11" },
    ];
    const { raw, headers } = signed(event);
    expect((await provider.parseWebhook!(raw, headers)).paymentId).toBe(
      "2f1b7a9e-6a7d-4f0e-9d3c-6f6c0f6f1a11",
    );
  });

  it("rejects a wrong key, a tampered body and a missing signature", async () => {
    const { raw } = signed(paidEvent());
    const wrongKey = signed(paidEvent(), "test_sk_attacker").headers;
    await expect(provider.parseWebhook!(raw, wrongKey)).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    const { headers } = signed(paidEvent());
    await expect(provider.parseWebhook!(raw.replace("2900", "1"), headers)).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    await expect(provider.parseWebhook!(raw, new Headers())).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
  });

  it("never lets a test-mode event settle a live payment", async () => {
    const live = createChargilyProvider({ secretKey: KEY, mode: "live" });
    const { raw, headers } = signed(paidEvent({ livemode: false }));
    expect((await live.parseWebhook!(raw, headers)).type).toBe("ignored");
  });
});
