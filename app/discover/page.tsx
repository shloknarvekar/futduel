import type { Metadata } from 'next';
import { DiscoverExplorer } from '@/components/discover/DiscoverExplorer';

export const metadata: Metadata = {
  title: 'Discover',
  description:
    'Browse every FutDuel card: this season’s players, historical versions of the greats, Icons and Heroes, with the attributes the duel engine reads.',
};

export default function DiscoverPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <DiscoverExplorer />
    </div>
  );
}
