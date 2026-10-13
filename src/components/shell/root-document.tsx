import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { platformFontVariables } from "@/app/fonts";
import { dirFor, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

type Namespace = keyof IntlMessages;
type IntlMessages = Awaited<ReturnType<typeof getMessages>>;

/** Picks the message namespaces a subtree needs, so customer pages ship a small catalog. */
export async function pickMessages(namespaces: readonly Namespace[]) {
  const all = await getMessages();
  return Object.fromEntries(namespaces.map((ns) => [ns, all[ns]])) as Partial<IntlMessages>;
}

export async function RootDocument({
  locale,
  namespaces,
  htmlClassName,
  children,
  wrap,
}: {
  locale: AppLocale;
  namespaces: readonly Namespace[];
  htmlClassName?: string;
  children: ReactNode;
  /** Optional provider around the body content (the console's theme provider). */
  wrap?: (node: ReactNode, nonce: string | undefined) => ReactNode;
}) {
  // Reading the request makes every page dynamic, which the nonce-based CSP requires:
  // Next stamps the per-request nonce on its scripts only during dynamic rendering.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const dir = dirFor(locale);
  const messages = await pickMessages(namespaces);
  const body = (
    <NextIntlClientProvider messages={messages}>
      <Providers dir={dir}>{children}</Providers>
    </NextIntlClientProvider>
  );
  return (
    <html
      lang={locale}
      dir={dir}
      className={cn(platformFontVariables, htmlClassName)}
      suppressHydrationWarning
    >
      <body>{wrap ? wrap(body, nonce) : body}</body>
    </html>
  );
}
