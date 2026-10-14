import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { pickMessages } from "@/components/shell/root-document";

/** Customer pages ship only the storefront catalog, not the console's. */
export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const messages = await pickMessages(["common", "storefront"]);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
