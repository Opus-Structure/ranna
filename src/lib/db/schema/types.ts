/** JSON column shapes. Validation of user input lives in `src/lib/validation`. */

export type Locale = "ar" | "fr" | "en";

/** Partial translations. The untranslated base value lives in the sibling text column. */
export type I18nText = Partial<Record<Locale, string>>;

export type PlanLimits = {
  maxItems: number;
  maxStaff: number;
  /** `null` = unlimited */
  maxMonthlyOrders: number | null;
  /** Table QR codes. `null` or missing = unlimited. */
  maxTables?: number | null;
};

export type ShopLayout = "list" | "grid";

export type MerchantBranding = {
  primaryColor?: string;
  secondaryColor?: string;
  font?: string;
  layout?: ShopLayout;
  /** Storage object paths inside the `merchant-assets` bucket. */
  logoPath?: string | null;
  coverPath?: string | null;
  welcome?: I18nText;
};

export type OpeningHoursDay = {
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  closed: boolean;
  open: string; // "08:00"
  close: string; // "23:30"
};

export type MerchantSettings = {
  openingHours?: OpeningHoursDay[];
  /** Target minutes from placed to ready. Drives the wait band on the board. */
  prepTargetMinutes?: number;
  /** Send an SMS/WhatsApp fallback when push is unavailable and a phone number exists. */
  fallbackMessaging?: boolean;
  /** Customer phone numbers are purged from orders after this many days. */
  phoneRetentionDays?: number;
  askPhone?: boolean;
  /** Where a new order is sent for the kitchen: nowhere, a printed ticket, a kitchen screen, or both. */
  kitchenRouting?: "none" | "print" | "screen" | "both";
  /** Paper width of the kitchen ticket printer, in millimetres. */
  ticketWidthMm?: 58 | 80;
};

export type OrderItemOptionSnapshot = {
  groupName: string;
  optionName: string;
  /** Translations at the time of ordering, so the customer reads their order in their language. */
  optionNameI18n?: I18nText;
  priceDeltaMinor: number;
};
