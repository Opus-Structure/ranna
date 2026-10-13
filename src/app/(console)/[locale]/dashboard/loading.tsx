import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a console page loads: the page header and a work area of the usual shape. */
export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <Skeleton className="h-48 max-w-2xl rounded-xl" />
    </div>
  );
}
