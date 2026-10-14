import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { pickMessages } from "@/components/shell/root-document";

export default async function OrderStatusLayout({ children }: { children: ReactNode }) {
  const messages = await pickMessages(["common", "storefront", "order"]);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
