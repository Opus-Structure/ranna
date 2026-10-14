/** RN-2026-000042: prefix, year of issue, zero-padded sequence value. */
export function formatInvoiceNumber(prefix: string, issuedAt: Date, sequence: number): string {
  return `${prefix}-${issuedAt.getUTCFullYear()}-${String(sequence).padStart(6, "0")}`;
}
