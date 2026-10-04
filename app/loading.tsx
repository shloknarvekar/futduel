import { LoadingRegion, Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <LoadingRegion label="Loading page">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-4 h-12 w-72" />
        <Skeleton className="mt-4 h-4 w-full max-w-xl" />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-36" />
          ))}
        </div>
      </LoadingRegion>
    </div>
  );
}
