import "server-only";
import { serverEnv } from "@/lib/env";

/** Pushes a live event to subscribers of a topic. Best effort: polling covers any gap. */
export interface RealtimePublisher {
  publish(topic: string, event: string, payload: Record<string, unknown>): Promise<void>;
}

/**
 * Supabase Realtime Broadcast over its REST endpoint, sent with the service key. Customer
 * topics are public channels whose names are derived from the order token's hash (D5), so
 * only someone holding the token can know which channel to listen to.
 */
export const supabaseBroadcast: RealtimePublisher = {
  async publish(topic, event, payload) {
    const env = serverEnv();
    try {
      const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
        cache: "no-store",
      });
      if (!res.ok) console.error("realtime broadcast failed", { status: res.status, event });
    } catch (err) {
      console.error("realtime broadcast failed", {
        event,
        error: err instanceof Error ? err.message : err,
      });
    }
  },
};
