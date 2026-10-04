'use client';

import { useId, useMemo, useState } from 'react';
import { Check, Lightbulb, Trash2 } from 'lucide-react';
import { useProfileStore } from '@/lib/store/profile';
import { CATEGORIES } from '@/lib/data/categories';
import { SUGGESTION_LIMITS, checkSuggestion, type SuggestionField } from '@/lib/engine/suggestions';
import { Button } from '@/components/ui/Button';
import { Panel, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';

const CATEGORY_NAMES = CATEGORIES.map((category) => category.name);

const FIELD_CLASS =
  'w-full rounded-[4px] border bg-[var(--color-surface-2)] px-3.5 text-base text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-home)]';

/**
 * Suggesting a category. There is no server behind FutDuel, so a suggestion
 * is kept in this browser only, and the form says exactly that rather than
 * pretending to send it anywhere.
 */
export function SuggestCategory() {
  const hydrated = useProfileStore((s) => s.hydrated);
  const saved = useProfileStore((s) => s.profile.suggestions);
  const addSuggestion = useProfileStore((s) => s.addSuggestion);
  const removeSuggestion = useProfileStore((s) => s.removeSuggestion);

  const [draft, setDraft] = useState({ name: '', description: '', rule: '' });
  // Errors appear once the form has been submitted, then follow the typing.
  const [attempted, setAttempted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const ids = { name: useId(), description: useId(), rule: useId() };

  const check = useMemo(
    () => checkSuggestion(draft, { categoryNames: CATEGORY_NAMES, saved }),
    [draft, saved],
  );
  const errorFor = (field: SuggestionField) => (attempted ? check.errors[field] : undefined);
  const formatter = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }), []);

  if (!hydrated) return <Skeleton className="h-64 w-full" />;

  const update = (field: SuggestionField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setNotice(null);
  };

  const describedBy = (field: SuggestionField, extra?: string) =>
    [errorFor(field) ? `${ids[field]}-error` : null, extra].filter(Boolean).join(' ') || undefined;

  const counter = (field: SuggestionField, max: number) => (
    <span id={`${ids[field]}-count`} className="tnum text-[11px] text-[var(--color-ink-muted)]">
      {draft[field].length}/{max}
    </span>
  );

  const errorLine = (field: SuggestionField) =>
    errorFor(field) ? (
      <p id={`${ids[field]}-error`} className="mt-1.5 text-[12px] font-semibold text-[var(--color-danger)]">
        {errorFor(field)}
      </p>
    ) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
      <Panel className="p-5 sm:p-6">
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setAttempted(true);
            if (!check.ok) {
              setNotice(null);
              return;
            }
            addSuggestion(check.value);
            setDraft({ name: '', description: '', rule: '' });
            setAttempted(false);
            setNotice(`Saved on this device: “${check.value.name}”. It has not been sent anywhere.`);
          }}
        >
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label htmlFor={ids.name} className="kicker">
                Category name
              </label>
              {counter('name', SUGGESTION_LIMITS.name.max)}
            </div>
            <input
              id={ids.name}
              value={draft.name}
              onChange={(event) => update('name', event.target.value)}
              maxLength={SUGGESTION_LIMITS.name.max}
              placeholder="e.g. Left-footed Keepers"
              aria-invalid={Boolean(errorFor('name'))}
              aria-describedby={describedBy('name', `${ids.name}-count`)}
              className={cn(FIELD_CLASS, 'h-12', errorFor('name') ? 'border-[var(--color-danger)]' : 'border-[var(--color-line-strong)]')}
            />
            {errorLine('name')}
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label htmlFor={ids.description} className="kicker">
                What it asks of a manager
              </label>
              {counter('description', SUGGESTION_LIMITS.description.max)}
            </div>
            <textarea
              id={ids.description}
              value={draft.description}
              onChange={(event) => update('description', event.target.value)}
              maxLength={SUGGESTION_LIMITS.description.max}
              rows={3}
              placeholder="e.g. Build an eleven where every player prefers their left foot."
              aria-invalid={Boolean(errorFor('description'))}
              aria-describedby={describedBy('description', `${ids.description}-count`)}
              className={cn(
                FIELD_CLASS,
                'min-h-24 resize-y py-3',
                errorFor('description') ? 'border-[var(--color-danger)]' : 'border-[var(--color-line-strong)]',
              )}
            />
            {errorLine('description')}
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label htmlFor={ids.rule} className="kicker">
                Rule idea <span className="normal-case tracking-normal text-[var(--color-ink-muted)]">(optional)</span>
              </label>
              {counter('rule', SUGGESTION_LIMITS.rule.max)}
            </div>
            <textarea
              id={ids.rule}
              value={draft.rule}
              onChange={(event) => update('rule', event.target.value)}
              maxLength={SUGGESTION_LIMITS.rule.max}
              rows={2}
              placeholder="e.g. Preferred foot: left. Keepers included."
              aria-invalid={Boolean(errorFor('rule'))}
              aria-describedby={describedBy('rule', `${ids.rule}-count`)}
              className={cn(
                FIELD_CLASS,
                'min-h-20 resize-y py-3',
                errorFor('rule') ? 'border-[var(--color-danger)]' : 'border-[var(--color-line-strong)]',
              )}
            />
            {errorLine('rule')}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" icon={<Lightbulb className="size-4" aria-hidden="true" />}>
              Save suggestion
            </Button>
            <p className="text-[12px] text-[var(--color-ink-muted)]">Kept in this browser only.</p>
          </div>

          <div role="status" aria-live="polite">
            {notice ? (
              <p className="flex items-start gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-home)]" aria-hidden="true" />
                {notice}
              </p>
            ) : null}
          </div>
        </form>
      </Panel>

      <section aria-labelledby="saved-suggestions-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 id="saved-suggestions-heading" className="text-lg">
            Saved on this device
          </h3>
          <p className="tnum text-[12px] text-[var(--color-ink-muted)]">
            {saved.length} of {SUGGESTION_LIMITS.kept}
          </p>
        </div>
        {saved.length === 0 ? (
          <p className="rounded-[4px] border border-dashed border-[var(--color-line-strong)] p-4 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
            Nothing yet. Suggestions you save appear here, on this device only.
          </p>
        ) : (
          <ul className="grid gap-2">
            {saved.map((suggestion) => (
              <li key={suggestion.id}>
                <Panel className="flex items-start gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[var(--color-ink)]">{suggestion.name}</p>
                    <p className="mt-1 text-[12px] leading-snug text-[var(--color-ink-soft)]">{suggestion.description}</p>
                    {suggestion.rule ? (
                      <p className="mt-1 text-[12px] leading-snug text-[var(--color-ink-muted)]">
                        Rule: {suggestion.rule}
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-[11px] text-[var(--color-ink-muted)]">
                      <time dateTime={new Date(suggestion.createdAt).toISOString()}>
                        {formatter.format(suggestion.createdAt)}
                      </time>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSuggestion(suggestion.id)}
                    aria-label={`Delete the suggestion ${suggestion.name}`}
                    icon={<Trash2 className="size-4" aria-hidden="true" />}
                  >
                    Delete
                  </Button>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
