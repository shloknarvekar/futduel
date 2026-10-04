'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';

/**
 * Route-level error boundary. It shows what the user can do next rather than
 * the stack trace, and logs the digest so the real cause stays findable.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[futduel] route error', error.digest ?? error.message);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[62dvh] max-w-[1240px] flex-col items-center justify-center px-4 py-20 text-center sm:px-6"
    >
      <p className="kicker mb-4">Something broke</p>
      <h1 className="text-[clamp(2.2rem,8vw,4rem)] leading-[0.92]">Whistle blown</h1>
      <p className="mt-5 max-w-[46ch] text-sm leading-relaxed text-[var(--color-ink-muted)]">
        This page hit an error and stopped. Trying again usually clears it — nothing you have
        already saved has been lost.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-2xs text-[var(--color-ink-faint)]">
          Reference {error.digest}
        </p>
      ) : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={reset} icon={<RotateCcw className="size-4" aria-hidden="true" />}>
          Try again
        </Button>
        <ButtonLink href="/" size="lg" variant="secondary">
          Back to home
        </ButtonLink>
      </div>
    </div>
  );
}
