/**
 * Entrance animations must never be load-bearing.
 *
 * If a reveal starts at `opacity: 0` and the animation does not run — reduced
 * motion, a throttled tab, a browser that freezes the Web Animations API — the
 * content simply never appears. So whenever motion is reduced we skip the
 * starting state entirely and render at rest rather than animating a shorter
 * version of the same fade.
 */
export function entrance<T>(reduce: boolean | null, from: T): T | false {
  return reduce ? false : from;
}

/** Exit states are safe to keep — an element that fails to fade out is still readable. */
export function exit<T>(reduce: boolean | null, to: T): T | undefined {
  return reduce ? undefined : to;
}
