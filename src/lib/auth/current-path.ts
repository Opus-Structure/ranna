import "server-only";
import { headers } from "next/headers";
import { isAppLocale } from "@/i18n/routing";

/** The request path without its locale prefix ("/fr/dashboard/menu" -> "/dashboard/menu"). */
export async function currentAppPath(): Promise<string> {
  const raw = (await headers()).get("x-pathname") ?? "/";
  const parts = raw.split("/");
  if (isAppLocale(parts[1])) parts.splice(1, 1);
  const path = parts.join("/") || "/";
  return path.startsWith("/") ? path : `/${path}`;
}
