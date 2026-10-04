'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { entrance, exit } from '@/lib/utils/motion';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog.
 *
 * Handles the four things a hand-rolled dialog usually gets wrong: focus moves
 * in on open and back to the trigger on close, Tab is trapped inside, Escape
 * always works, and the page behind cannot scroll. On small screens it becomes
 * a bottom sheet, which is where a thumb actually reaches.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  labelledBy,
  tall,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Id of a heading inside `children` that names the dialog. When given, the
   * content owns its own title and the header bar is replaced by a floating
   * close button, so a profile can open with its subject instead of a toolbar.
   */
  labelledBy?: string;
  /**
   * Hold the full sheet height on small screens, for content that filters
   * itself (search results), so the sheet does not jump as results shrink.
   */
  tall?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reduceMotion = useReducedMotion();

  // Callers usually pass an inline arrow. Reading it through a ref keeps the
  // key handler stable, so a re-render inside the dialog never re-runs the
  // open effect, which would pull focus back to the first control.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    const raf = requestAnimationFrame(() => {
      // Content can name the control it opens on with `data-autofocus`, when
      // that is where the task starts; otherwise focus goes to the first control.
      const target =
        panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ??
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? panelRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[rgba(2,5,4,0.72)] backdrop-blur-sm"
            initial={entrance(reduceMotion, { opacity: 0 })}
            animate={{ opacity: 1 }}
            exit={exit(reduceMotion, { opacity: 0 })}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy ?? titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={entrance(reduceMotion, { opacity: 0, y: 24, scale: 0.985 })}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={exit(reduceMotion, { opacity: 0, y: 16, scale: 0.99 })}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative flex max-h-[92dvh] w-full flex-col overflow-hidden',
              'rounded-t-[8px] border border-[var(--color-line-strong)] bg-[var(--color-surface)]',
              'shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.9)] sm:rounded-[6px]',
              tall && 'h-[92dvh] sm:h-auto',
              widths[size],
            )}
          >
            {labelledBy ? (
              <button
                type="button"
                onClick={onClose}
                aria-label={`Close ${title}`}
                className="absolute right-3 top-3 z-20 grid size-11 cursor-pointer place-items-center rounded-[4px] border border-[var(--color-line-strong)] bg-[rgb(3_6_5/0.72)] text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-surface-3)] hover:text-[var(--color-ink)]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            ) : (
              <header className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <h2 id={titleId} className="text-xl leading-tight">
                    {title}
                  </h2>
                  {description ? (
                    <p id={descriptionId} className="mt-1 text-sm text-[var(--color-ink-muted)]">
                      {description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-2 -mt-1 grid size-11 shrink-0 cursor-pointer place-items-center rounded-[4px] text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface-3)] hover:text-[var(--color-ink)]"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </header>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              {children}
            </div>

            {footer ? (
              <footer className="border-t border-[var(--color-line)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
