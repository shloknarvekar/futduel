import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DuelExperience } from '@/components/duel/DuelExperience';
import { LoadingRegion, Skeleton } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Duel',
  description:
    'Spin for a category, build the best eleven you can under it, and settle it over ninety simulated minutes.',
};

function DuelSkeleton() {
  return (
    <LoadingRegion label="Preparing the duel arena">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="grid gap-6">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mx-auto aspect-square w-full max-w-[420px] rounded-full" />
          <Skeleton className="mx-auto h-14 w-40" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </LoadingRegion>
  );
}

export default function DuelPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="mb-8">
        <p className="kicker mb-2">The arena</p>
        <h1 className="text-[clamp(2.2rem,7vw,3.6rem)]">Spin. Build. Duel.</h1>
      </header>

      <Suspense fallback={<DuelSkeleton />}>
        <DuelExperience />
      </Suspense>
    </div>
  );
}
