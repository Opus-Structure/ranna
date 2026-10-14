/**
 * Shown while a shop page loads on a slow connection: the shape of the page (header band,
 * section chips, dish rows) in neutral ink, since the shop's colours aren't known yet.
 */
export default function ShopLoading() {
  return (
    <div aria-busy="true" className="min-h-dvh bg-[#faf8f5]">
      <div className="h-40 animate-pulse bg-[#e8e3de] motion-reduce:animate-none" />
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-6">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-9 w-24 rounded-full bg-[#ece7e2]" />
          ))}
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-4 border-b border-[#ece7e2] pb-5"
          >
            <div className="flex flex-1 flex-col gap-2">
              <span className="h-5 w-2/5 rounded bg-[#e8e3de]" />
              <span className="h-4 w-3/5 rounded bg-[#efebe7]" />
              <span className="h-5 w-16 rounded bg-[#e8e3de]" />
            </div>
            <span className="size-20 shrink-0 rounded-xl bg-[#efebe7]" />
          </div>
        ))}
      </div>
    </div>
  );
}
