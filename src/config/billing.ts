/** Billing policy knobs. Changing these changes behaviour for every merchant. */
export const billingConfig = {
  /** Days a past_due shop stays open after its period ends before it is suspended. */
  graceDays: 5,
  /** Days a new invoice stays payable. */
  invoiceDueDays: 7,
  /** Renewal reminder is sent this many days before period end. */
  reminderDaysBefore: 3,
  /** Invoice numbers look like RN-2026-000042. */
  invoicePrefix: "RN",
} as const;

/**
 * Manual payment instructions shown to merchants (bank transfer, BaridiMob, cash).
 * PLACEHOLDERS: replace with the operator's real account details before launch.
 */
export const manualPaymentInstructions = {
  beneficiary: "Ranna (placeholder beneficiary)",
  bank: { name: "Bank name (placeholder)", rib: "000 00000 0000000000 00" },
  baridimob: { rip: "00799999 0000000000 00" },
  cash: true,
} as const;
