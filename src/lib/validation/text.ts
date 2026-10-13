import { z } from "zod";

// C0 controls, DEL, and bidi embedding/override/isolate marks, which can reorder how a
// name or note renders on the order board ("Trojan Source"-style spoofing).
const CONTROL_SINGLE = /[\u0000-\u001F\u007F‪-‮⁦-⁩]/g;
const CONTROL_MULTI = /[\u0000-\u0009\u000B-\u001F\u007F‪-‮⁦-⁩]/g;

/**
 * Normalises user text before validation: NFC, no control or bidi-override characters,
 * trimmed, inner whitespace collapsed. React escapes on output; this keeps stored data clean
 * and lengths honest.
 */
export function cleanText(value: string, { multiline = false } = {}): string {
  const v = value.normalize("NFC");
  if (multiline) {
    return v
      .replace(/\r\n?/g, "\n")
      .replace(CONTROL_MULTI, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return v.replace(CONTROL_SINGLE, " ").replace(/\s+/g, " ").trim();
}

export const textField = (min: number, max: number, opts: { multiline?: boolean } = {}) =>
  z
    .string()
    .transform((v) => cleanText(v, opts))
    .pipe(z.string().min(min).max(max));
