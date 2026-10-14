import { createHash, createHmac } from "node:crypto";

/**
 * The customer's order token: 128 bits, base64url (22 characters). It is derived from the
 * client's request id with a server secret, so retrying the same "Place order" request yields
 * the same token (idempotency) while nobody without the secret can predict one. Only its
 * SHA-256 is stored (D7).
 */
export function orderTokenFor(secret: string, merchantId: string, clientRequestId: string): string {
  return createHmac("sha256", `${secret}:order-token`)
    .update(`${merchantId}:${clientRequestId}`)
    .digest()
    .subarray(0, 16)
    .toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/**
 * Realtime topic for an order. Derived from the stored hash (the server never sees the raw
 * token again) and computable by the customer's page from its token.
 */
export function orderTopic(tokenHash: string): string {
  return `order:${tokenHash.slice(0, 32)}`;
}
