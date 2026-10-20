/** Shown while an order page loads: the ticket's shape, so the number has a place to land. */
export default function OrderLoading() {
  return (
    <div aria-busy="true" className="min-h-dvh bg-shop-ground">
      <div className="h-16 bg-shop-line" />
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 pt-6">
        <div className="flex h-60 flex-col items-center justify-center gap-4 rounded-3xl bg-white shadow-[0_10px_30px_-18px_rgb(31_26_23/0.35)]">
          <span className="h-4 w-24 rounded bg-shop-line/60" />
          <span className="h-24 w-48 animate-pulse rounded-2xl bg-shop-line motion-reduce:animate-none" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="mx-auto size-4 rotate-45 rounded-[2px] bg-shop-line" />
          ))}
        </div>
        <span className="mx-auto h-7 w-3/4 rounded bg-shop-line" />
        <div className="h-48 rounded-3xl bg-white" />
      </div>
    </div>
  );
}
