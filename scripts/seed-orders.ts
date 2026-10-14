/**
 * Sample orders for the demo shop, so the order board has something on it straight after
 * `npm run seed`. They go through the real placement and status code (pricing, numbering,
 * transitions), not raw inserts. Demo orders are synthetic, so each run starts the day afresh.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { serviceDb } from "@/lib/db/client";
import { orderCounters, orders } from "@/lib/db/schema";
import type { MerchantContext } from "@/lib/merchants/context";
import { placeOrder, setOrderStatus } from "@/lib/orders/service";
import { hashToken } from "@/lib/orders/token";
import type { OrderStatus } from "@/lib/orders/transitions";
import type { PlaceOrderInput } from "@/lib/validation/order";
import { loadPublicShopUncached } from "@/lib/shop/public";

type Sample = {
  name: string;
  lines: [dish: number, quantity: number][];
  path: OrderStatus[];
  note?: string;
  cancelReason?: string;
};

const samples: Sample[] = [
  {
    name: "Lina",
    lines: [
      [0, 1],
      [5, 1],
    ],
    path: ["preparing", "ready", "completed"],
  },
  { name: "Nadir", lines: [[2, 3]], path: ["preparing", "ready"] },
  { name: "Mehdi", lines: [[7, 1]], path: ["canceled"], cancelReason: "Sold out of this today" },
  {
    name: "Karim",
    lines: [
      [1, 1],
      [4, 2],
    ],
    path: ["preparing"],
  },
  { name: "Sara", lines: [[3, 1]], path: ["preparing"], note: "Less sugar please" },
  {
    name: "Yacine",
    lines: [
      [0, 2],
      [6, 1],
    ],
    path: [],
  },
  { name: "Amel", lines: [[8, 1]], path: [] },
];

/** Quiet publisher: nobody is watching seeded orders. */
const silent = { publish: async () => {} };

export async function seedDemoOrders(merchantId: string, ownerId: string) {
  await serviceDb.delete(orders).where(eq(orders.merchantId, merchantId));
  await serviceDb.delete(orderCounters).where(eq(orderCounters.merchantId, merchantId));

  const shop = await loadPublicShopUncached(merchantId);
  if (!shop) throw new Error("demo shop missing");
  const dishes = shop.menu.flatMap((c) => c.items).filter((i) => i.isAvailable);
  const line = ([dish, quantity]: [number, number]) => {
    const item = dishes[dish % dishes.length]!;
    // Satisfy required groups with their first available choices.
    const optionIds = item.optionGroups.flatMap((g) =>
      g.options
        .filter((o) => o.isAvailable)
        .slice(0, g.minSelect)
        .map((o) => o.id),
    );
    return { itemId: item.id, quantity, optionIds };
  };
  const ctx = { user: { id: ownerId } } as MerchantContext;

  for (const s of samples) {
    const input: PlaceOrderInput = {
      slug: shop.slug,
      clientRequestId: randomUUID(),
      customerName: s.name,
      note: s.note,
      locale: "ar",
      lines: s.lines.map(line),
    };
    const placed = await placeOrder(input);
    if (!placed.ok) throw new Error(`demo order for ${s.name}: ${placed.error}`);
    const [row] = await serviceDb
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.tokenHash, hashToken(placed.token)));
    for (const to of s.path) {
      const moved = await setOrderStatus(
        ctx,
        row!.id,
        to,
        { cancelReason: s.cancelReason },
        silent,
      );
      if (!moved.ok) throw new Error(`demo order ${placed.number} → ${to}: ${moved.error}`);
    }
  }
  return samples.length;
}
