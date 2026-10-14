import { z } from "zod";
import { locales } from "@/i18n/routing";
import { TABLE_CODE } from "@/lib/qr/matrix";
import { cleanText } from "./text";

/** Error messages are keys under `order.errors`. */
export const customerNameSchema = z
  .string()
  .transform((v) => cleanText(v))
  .pipe(z.string().min(1, { error: "nameRequired" }).max(40, { error: "nameTooLong" }));

export const customerPhoneSchema = z
  .string()
  .optional()
  .transform((v) => (v ?? "").replace(/[\s().-]/g, ""))
  .refine((v) => v === "" || /^\+?[0-9]{6,15}$/.test(v), { error: "phone" })
  .transform((v) => v || null);

const uuid = z.string().uuid();

export const placeOrderSchema = z.object({
  slug: z.string().min(3).max(40),
  clientRequestId: uuid,
  customerName: customerNameSchema,
  phone: customerPhoneSchema,
  note: z
    .string()
    .optional()
    .transform((v) => cleanText(v ?? "", { multiline: true }) || null)
    .refine((v) => v === null || v.length <= 300, { error: "noteTooLong" }),
  table: z
    .string()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || TABLE_CODE.test(v), { error: "invalid" }),
  locale: z.enum(locales),
  /** Honeypot: hidden from people, filled by naive bots. */
  website: z.string().max(200).optional(),
  lines: z
    .array(
      z.object({
        itemId: uuid,
        quantity: z.number().int(),
        optionIds: z.array(uuid).max(40),
        note: z
          .string()
          .optional()
          .transform((v) => cleanText(v ?? "") || null)
          .refine((v) => v === null || v.length <= 120, { error: "noteTooLong" }),
      }),
    )
    .min(1, { error: "empty" })
    .max(30, { error: "too_many_lines" }),
});

export type PlaceOrderInput = z.input<typeof placeOrderSchema>;
