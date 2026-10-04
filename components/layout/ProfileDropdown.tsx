'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProfileStore } from '@/lib/store/profile';
import { tierFor } from '@/lib/engine/progression';
import { cn } from '@/lib/utils/cn';
import { isActive } from './nav-items';
import { profileMenu } from './profile-menu';

/**
 * The manager's menu in the header. Adapted from KokonutUI's profile
 * dropdown, but everything it shows is this browser's own profile: the name
 * the manager chose, their rating and tier. There is no photo to show, so the
 * avatar is a monogram in the tier's colour, and there is no account, so there
 * is no email, plan or sign-out either.
 */
export function ProfileDropdown() {
  const pathname = usePathname();
  const profile = useProfileStore((s) => s.profile);
  const hydrated = useProfileStore((s) => s.hydrated);
  const tier = tierFor(profile.rating);
  const name = hydrated ? profile.managerName : 'Manager';

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          // Named outright: on a phone only the aria-hidden monogram shows. The
          // name repeats the visible text so voice control can match it.
          aria-label={hydrated ? `${name}, ${profile.rating} · ${tier.name}` : name}
          className={cn(
            'group flex h-11 items-center gap-2.5 rounded-xl border border-border bg-card pl-1.5 pr-1 text-left text-card-foreground',
            'transition-colors hover:bg-accent hover:text-accent-foreground data-[state=open]:border-primary',
          )}
        >
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg text-[12px] font-bold"
            style={{ background: tier.token, color: 'var(--color-on-tier)' }}
            aria-hidden="true"
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block max-w-[9rem] truncate text-[13px] font-semibold">{name}</span>
            <span className="meta tnum block text-[10px] text-muted-foreground">
              {hydrated ? `${profile.rating} · ${tier.name}` : 'Loading'}
            </span>
          </span>
          {/* Kokonut's bending line: quiet when closed, the brand colour when open. */}
          <svg
            width="12"
            height="24"
            viewBox="0 0 12 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0 text-border transition-colors group-hover:text-muted-foreground group-data-[state=open]:text-primary"
          >
            <path d="M2 4C6 8 6 16 2 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="meta tnum mt-0.5 block text-[10px] text-muted-foreground">
            {hydrated ? `Rating ${profile.rating} · ${tier.name}` : 'Loading profile'}
          </span>
          <span className="mt-1.5 block text-xs text-muted-foreground">Saved in this browser. No account needed.</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {profileMenu(profile.rating).map((item) => {
            const Icon = item.icon;
            const current = isActive(pathname, item.href);
            return (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href} aria-current={current ? 'page' : undefined}>
                  <Icon className={cn('size-4 shrink-0', current ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                  <span className={cn('flex-1', current && 'font-semibold')}>{item.label}</span>
                  {hydrated && item.value ? (
                    <span className="tnum rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {item.value}
                    </span>
                  ) : null}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
