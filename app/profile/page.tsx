import type { Metadata } from 'next';
import { ProfilePanel } from '@/components/profile/ProfilePanel';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your manager rating, record, achievements and duel history — stored in your own browser.',
};

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="mb-8">
        <p className="kicker mb-2">Your manager</p>
        <h1 className="text-[clamp(2.2rem,7vw,3.4rem)]">Profile</h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-[var(--color-ink-muted)]">
          Everything here lives in this browser only. Nothing is uploaded, and there is no account
          to create.
        </p>
      </header>

      <ProfilePanel />
    </div>
  );
}
