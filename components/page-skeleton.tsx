import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      {/* Nav placeholder */}
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-20" />
      </div>
      {/* Title */}
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      {/* Content rows */}
      <div className="space-y-3 rounded-xl border border-border p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
