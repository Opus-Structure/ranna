import "server-only";
import { serverEnv } from "@/lib/env";

/**
 * SMS / WhatsApp fallback for customers whose phone can't receive web push (e.g. iPhone without
 * the Home Screen app). Real adapters (an Algerian SMS gateway, WhatsApp Business Cloud API)
 * implement this interface; v1 ships the mock, which records the attempt and sends nothing.
 */
export interface MessagingProvider {
  readonly name: string;
  readonly channel: "sms" | "whatsapp";
  /** Whether messages really leave the platform (false for the mock). */
  readonly live: boolean;
  send(to: string, text: string): Promise<{ ok: boolean; error?: string }>;
}

const mockProvider: MessagingProvider = {
  name: "mock",
  channel: "sms",
  live: false,
  async send(to, text) {
    // Masked number, no message body in production logs.
    const masked = `${to.slice(0, 4)}…${to.slice(-2)}`;
    if (process.env.NODE_ENV !== "production") console.info(`[sms:mock] to=${masked} ${text}`);
    else console.info(`[sms:mock] to=${masked}`);
    return { ok: true };
  },
};

export function messagingProvider(): MessagingProvider {
  switch (serverEnv().SMS_PROVIDER) {
    case "mock":
    default:
      return mockProvider;
  }
}
