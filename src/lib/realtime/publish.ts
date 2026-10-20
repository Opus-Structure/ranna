import "server-only";

/**
 * Hook for pushing a live event to subscribers of a topic. With Neon Realtime nothing needs to
 * be published by hand: pages subscribe to live SQL queries (src/lib/realtime/live.ts), so the
 * row update that changes an order is itself the event. The interface stays so services (and
 * their tests) can still observe what would have been announced.
 */
export interface RealtimePublisher {
  publish(topic: string, event: string, payload: Record<string, unknown>): Promise<void>;
}

/** The default: the database write already notifies live queries. */
export const liveQueryPublisher: RealtimePublisher = {
  async publish() {
    // Intentionally empty.
  },
};
