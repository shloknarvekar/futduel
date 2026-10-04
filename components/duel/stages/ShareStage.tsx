'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

function useCopy() {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
    } catch {
      // Clipboard access can be denied outright; say so instead of pretending.
      setFailed(true);
    }
  };

  return { copied, failed, copy };
}

export function ShareStage({
  title,
  description,
  url,
  onWatchReply,
  replyLabel,
  children,
}: {
  title: string;
  description: string;
  url: string;
  /** Present on the creator's screen: paste back the finished duel. */
  onWatchReply?: (code: string) => string | null;
  replyLabel?: string;
  children?: React.ReactNode;
}) {
  const { copied, failed, copy } = useCopy();
  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div className="panel px-5 py-7 sm:px-7">
        <p className="kicker mb-2">Challenge ready</p>
        <h2 className="text-[clamp(1.7rem,5vw,2.4rem)]">{title}</h2>
        <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-[var(--color-ink-muted)]">
          {description}
        </p>

        <div className="mt-6">
          <label htmlFor="challenge-link" className="kicker mb-2 block">
            Challenge link
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="challenge-link"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="h-12 min-w-0 flex-1 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3.5 font-mono text-[12px] text-[var(--color-ink-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-home)]"
            />
            <Button
              onClick={() => void copy(url)}
              icon={copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              className="shrink-0"
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
          <p
            className={cn('mt-2 text-[12px]', failed ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-faint)]')}
            role={failed ? 'alert' : undefined}
          >
            {failed
              ? 'Your browser blocked the clipboard. Select the link above and copy it manually.'
              : 'Anyone with this link can answer your challenge. It carries only your eleven — nothing personal.'}
          </p>
        </div>

        {children}
      </div>

      {onWatchReply ? (
        <form
          className="panel px-5 py-6 sm:px-7"
          onSubmit={(event) => {
            event.preventDefault();
            const error = onWatchReply(reply.trim());
            setReplyError(error);
          }}
        >
          <p className="kicker mb-2">{replyLabel ?? 'Got a reply?'}</p>
          <p className="mb-4 max-w-[56ch] text-sm leading-relaxed text-[var(--color-ink-muted)]">
            When your friend has played it, they get a link back. Paste it here to watch the exact
            same ninety minutes.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={reply}
              onChange={(event) => {
                setReply(event.target.value);
                setReplyError(null);
              }}
              placeholder="Paste the reply link or code"
              aria-label="Reply link or code"
              aria-invalid={replyError ? true : undefined}
              aria-describedby={replyError ? 'reply-error' : undefined}
              className="h-12 min-w-0 flex-1 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3.5 text-base text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-home)]"
            />
            <Button type="submit" variant="ice" disabled={!reply.trim()} icon={<Send className="size-4" aria-hidden="true" />} className="shrink-0">
              Watch it
            </Button>
          </div>
          {replyError ? (
            <p id="reply-error" role="alert" className="mt-2 text-[12px] text-[var(--color-danger)]">
              {replyError}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
