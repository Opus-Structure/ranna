import { z } from "zod";
import { cleanText } from "./text";

/** Error messages are i18n keys under `auth.errors`. */
export const emailSchema = z
  .string({ error: "emailRequired" })
  .trim()
  .toLowerCase()
  .min(1, { error: "emailRequired" })
  .max(254, { error: "emailInvalid" })
  .pipe(z.email({ error: "emailInvalid" }));

export const passwordSchema = z
  .string()
  .min(8, { error: "weakPassword" })
  .max(72, { error: "weakPassword" });

export const shopNameSchema = z
  .string({ error: "shopNameRequired" })
  .transform((v) => cleanText(v))
  .pipe(z.string().min(1, { error: "shopNameRequired" }).max(80, { error: "shopNameTooLong" }));

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(72) });

export const signupSchema = z.object({
  shopName: shopNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const magicLinkSchema = z.object({
  email: emailSchema,
  /** Present when the magic link is also a sign-up. */
  shopName: shopNameSchema.optional(),
});

export type LoginInput = z.input<typeof loginSchema>;
export type SignupInput = z.input<typeof signupSchema>;
export type MagicLinkInput = z.input<typeof magicLinkSchema>;
