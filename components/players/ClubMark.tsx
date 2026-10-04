import { CLUB_BY_ID } from '@/lib/data/clubs';
import { cn } from '@/lib/utils/cn';

/**
 * Club identity, drawn rather than fetched.
 *
 * FutDuel has no licence to real club crests or player photography, and a page
 * full of hotlinked images that may or may not resolve is worse than none:
 * broken frames, layout shift, and a licensing problem. So identity is built
 * from what the dataset genuinely owns — the club colour and its three-letter
 * code — into a mark that always renders, never shifts, and scales to any size.
 *
 * The colour tints the tile rather than flooding it, so a grid of these reads
 * as one system instead of a bag of logos.
 */
export function ClubMark({
  clubId,
  size = 'md',
  className,
}: {
  clubId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const club = CLUB_BY_ID.get(clubId);

  const sizes = {
    sm: 'size-7 text-[10px] rounded-[4px]',
    md: 'size-9 text-[11px] rounded-[4px]',
    lg: 'size-12 text-[13px] rounded-[9px]',
  };

  // An unknown club still gets a mark, just a neutral one.
  const color = club?.color ?? '#7f9089';
  const label = club?.short ?? '--';

  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden font-display leading-none tracking-[0.04em]',
        sizes[size],
        className,
      )}
      style={{
        background: `linear-gradient(150deg, color-mix(in oklab, ${color} 42%, var(--color-surface-3)), var(--color-surface-2))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 34%, transparent)`,
        color: 'var(--color-ink)',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: color }}
      />
      {label}
      <span className="sr-only">{club?.name ?? 'Unknown club'}</span>
    </span>
  );
}
