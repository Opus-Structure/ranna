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
      className="grid min-h-dvh place-items-center bg-[#fbfaf8] px-6 py-16 text-[#1f1a17]"
    >
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-[#ece8e3]">
          <Store className="size-6 text-[#625a55]" aria-hidden />
        </span>
        {shopName ? <p className="text-sm font-semibold text-[#625a55]">{shopName}</p> : null}
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="leading-relaxed text-[#625a55]">{body}</p>
      </div>
    </main>
  );
}
