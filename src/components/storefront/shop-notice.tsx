import { Store } from "lucide-react";

/**
 * Neutral full-page notice for customers (shop unavailable, unknown link). Deliberately not
 * branded: a suspended merchant's page must not look like it is open for business.
 */
export function ShopNotice({
  title,
  body,
  shopName,
}: {
  title: string;
  body: string;
  shopName?: string;
}) {
  return (
    <main
      id="main"
      className="grid min-h-dvh place-items-center bg-shop-ground px-6 py-16 text-shop-ink"
    >
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-shop-chip">
          <Store className="size-6 text-shop-muted" aria-hidden />
        </span>
        {shopName ? <p className="text-sm font-semibold text-shop-muted">{shopName}</p> : null}
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="leading-relaxed text-shop-muted">{body}</p>
      </div>
    </main>
  );
}
