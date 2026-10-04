import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[62dvh] max-w-[1240px] flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <p className="kicker mb-4">404</p>
      <h1 className="text-[clamp(2.6rem,10vw,5rem)] leading-[0.9]">
        Off the
        <br />
        <span className="text-[var(--color-home)]">pitch</span>
      </h1>
      <p className="mt-5 max-w-[44ch] text-sm leading-relaxed text-[var(--color-ink-muted)]">
        That page does not exist. It may have been a challenge link that has since expired, or a
        typo in the address.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/duel" size="lg">
          Start a duel
        </ButtonLink>
        <ButtonLink href="/" size="lg" variant="secondary">
          Back to home
        </ButtonLink>
      </div>
      <p className="mt-8 text-2xs text-[var(--color-ink-faint)]">
        Or head straight to{' '}
        <Link href="/discover" className="underline underline-offset-4 hover:text-[var(--color-ink-muted)]">
          the database
        </Link>
        .
      </p>
    </div>
  );
}
