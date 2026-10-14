import "server-only";
import { serverEnv } from "@/lib/env";

export type Email = { to: string; subject: string; text: string };

/** Outgoing email. Swap implementations with MAILER=log|resend. */
export interface Mailer {
  send(email: Email): Promise<void>;
}

function maskEmail(address: string): string {
  const [user = "", domain = ""] = address.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}

/**
 * Prints emails to the server log. In development the full body is shown (that is how you
 * read invite links locally); in production only the subject and a masked recipient, so
 * links carrying tokens never reach log storage.
 */
const logMailer: Mailer = {
  async send(email) {
    if (process.env.NODE_ENV === "production") {
      console.info(`[mail] to=${maskEmail(email.to)} subject="${email.subject}" (body not logged)`);
      return;
    }
    console.info(`[mail] to=${email.to}\nsubject: ${email.subject}\n\n${email.text}\n`);
  },
};

function resendMailer(apiKey: string, from: string): Mailer {
  return {
    async send(email) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text }),
      });
      if (!res.ok) throw new Error(`resend responded ${res.status}`);
    },
  };
}

export function getMailer(): Mailer {
  const env = serverEnv();
  if (env.MAILER === "resend" && env.RESEND_API_KEY)
    return resendMailer(env.RESEND_API_KEY, env.MAIL_FROM);
  return logMailer;
}

/** Fire-and-forget wrapper: email problems are logged, never surfaced as request failures. */
export async function sendSafely(email: Email): Promise<void> {
  try {
    await getMailer().send(email);
  } catch (err) {
    console.error("mail send failed", {
      to: maskEmail(email.to),
      error: err instanceof Error ? err.message : err,
    });
  }
}
