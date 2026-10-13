"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicConfig } from "./config";

let client: SupabaseClient | undefined;

/** Singleton browser client: auth session from cookies, Realtime subscriptions. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;
  const { url, anonKey } = supabasePublicConfig();
  client = createBrowserClient(url, anonKey);
  return client;
}
