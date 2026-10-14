import { z } from "zod";
import { i18nText } from "./shop";
import { cleanText } from "./text";

/** Error messages are keys under `menu.errors`. */
const name = (max: number) =>
  z
    .string()
    .transform((v) => cleanText(v))
    .pipe(z.string().min(1, { error: "nameRequired" }).max(max, { error: "tooLong" }));

/** Prices are typed in major units (350 DZD) and converted to minor units on the server. */
const price = z
  .number({ error: "price" })
  .finite()
  .min(0, { error: "price" })
  .max(1_000_000, { error: "price" });

export const categorySchema = z.object({
  name: name(60),
  nameI18n: i18nText(60),
  isVisible: z.boolean().default(true),
});

export const optionSchema = z.object({
  id: z.string().uuid().optional(),
  name: name(60),
  nameI18n: i18nText(60),
  priceDelta: z.number().finite().min(-1_000_000).max(1_000_000),
  isAvailable: z.boolean().default(true),
});

export const optionGroupSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: name(60),
    nameI18n: i18nText(60),
    minSelect: z.number().int().min(0).max(20),
    maxSelect: z.number().int().min(1).max(20),
    options: z.array(optionSchema).min(1, { error: "optionsRequired" }).max(30),
  })
  .refine((g) => g.minSelect <= g.maxSelect, { error: "selectRange", path: ["minSelect"] })
  .refine((g) => g.minSelect <= g.options.length, { error: "selectRange", path: ["minSelect"] });

export const itemSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  name: name(80),
  nameI18n: i18nText(80),
  description: z
    .string()
    .optional()
    .transform((v) => cleanText(v ?? "", { multiline: true }) || null)
    .refine((v) => v === null || v.length <= 300, { error: "tooLong" }),
  descriptionI18n: i18nText(300, { multiline: true }),
  price,
  isAvailable: z.boolean().default(true),
  optionGroups: z.array(optionGroupSchema).max(10).default([]),
});

export type CategoryInput = z.input<typeof categorySchema>;
export type ItemInput = z.input<typeof itemSchema>;
export type OptionGroupInput = z.input<typeof optionGroupSchema>;
