import type { Squad } from '@/lib/domain/types';
import { ACTIVE_CATEGORIES } from './category-pool';
import { FORMATIONS, requireFormation } from '@/lib/data/formations';
import { PLAYERS } from '@/lib/data/players';

/**
 * Friend duels travel as a single opaque code.
 *
 * The code is not a security boundary — anyone can craft one — so decoding
 * treats every field as hostile: indices are range-checked against the local
 * dataset, the squad must match the formation exactly, and the manager name is
 * length-capped and stripped of control characters before it is ever rendered.
 */

const VERSION = '1';

/**
 * Cheap fingerprint of the local dataset. If two people are on different
 * builds we say so plainly instead of silently loading the wrong eleven.
 */
export const DATASET_FINGERPRINT = (() => {
  let h = 2166136261 >>> 0;
  const source = `${PLAYERS.length}:${ACTIVE_CATEGORIES.length}:${FORMATIONS.length}:${PLAYERS[0]?.id ?? ''}:${PLAYERS[PLAYERS.length - 1]?.id ?? ''}`;
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
})();

export interface ChallengePayload {
  seed: string;
  categoryId: string;
  squad: Squad;
  managerName: string;
}

const MAX_NAME = 24;

/**
 * Control characters, zero-width marks and bidi overrides are removed by code
 * point rather than by regex literal, so no invisible character ever has to
 * live in this source file to be filtered out of a stranger's manager name.
 */
function isRenderable(cp: number): boolean {
  if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) return false; // C0 / C1 controls
  if (cp >= 0x200b && cp <= 0x200f) return false; // zero-width and LTR/RTL marks
  if (cp >= 0x202a && cp <= 0x202e) return false; // bidi embedding / override
  if (cp >= 0x2066 && cp <= 0x2069) return false; // bidi isolates
  if (cp === 0xfeff) return false; // byte order mark
  return true;
}

function sanitizeName(raw: string): string {
  const cleaned = Array.from(raw)
    .filter((ch) => isRenderable(ch.codePointAt(0) ?? 0))
    .join('')
    .trim()
    .slice(0, MAX_NAME);
  return cleaned || 'Challenger';
}

/** Short non-cryptographic checksum: catches truncation and casual tampering. */
function checksum(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h * 33) ^ input.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 6);
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeChallenge(payload: ChallengePayload): string {
  const formation = requireFormation(payload.squad.formationId);
  // Indexed into the active list, so a code can only ever carry a playable category.
  const categoryIndex = ACTIVE_CATEGORIES.findIndex((c) => c.id === payload.categoryId);
  const formationIndex = FORMATIONS.findIndex((f) => f.id === formation.id);
  if (categoryIndex < 0 || formationIndex < 0) throw new Error('Cannot encode an unknown category or formation');

  const indices = formation.slots.map((slot) => {
    const id = payload.squad.picks[slot.id];
    const index = id ? PLAYERS.findIndex((p) => p.id === id) : -1;
    return index.toString(36);
  });

  const body = [
    VERSION,
    DATASET_FINGERPRINT,
    categoryIndex.toString(36),
    formationIndex.toString(36),
    payload.seed,
    indices.join(','),
    sanitizeName(payload.managerName),
  ].join('|');

  return toBase64Url(`${body}|${checksum(body)}`);
}

export type DecodeResult =
  | { ok: true; payload: ChallengePayload }
  | { ok: false; reason: 'malformed' | 'version' | 'dataset' | 'squad' };

export function decodeChallenge(code: string): DecodeResult {
  let body: string;
  try {
    body = fromBase64Url(code.trim());
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const parts = body.split('|');
  if (parts.length !== 8) return { ok: false, reason: 'malformed' };

  const [version, fingerprint, catRaw, formRaw, seed, indicesRaw, nameRaw, digest] = parts as [
    string, string, string, string, string, string, string, string,
  ];

  if (checksum(parts.slice(0, 7).join('|')) !== digest) return { ok: false, reason: 'malformed' };

  if (version !== VERSION) return { ok: false, reason: 'version' };
  if (fingerprint !== DATASET_FINGERPRINT) return { ok: false, reason: 'dataset' };
  if (!/^[A-Z0-9]{4,16}$/.test(seed)) return { ok: false, reason: 'malformed' };

  const category = ACTIVE_CATEGORIES[parseInt(catRaw, 36)];
  const formation = FORMATIONS[parseInt(formRaw, 36)];
  if (!category || !formation) return { ok: false, reason: 'malformed' };

  const indices = indicesRaw.split(',').map((v) => parseInt(v, 36));
  if (indices.length !== formation.slots.length) return { ok: false, reason: 'squad' };

  const picks: Record<string, string | null> = {};
  const seen = new Set<string>();
  for (let i = 0; i < formation.slots.length; i++) {
    const slot = formation.slots[i]!;
    const index = indices[i]!;
    if (!Number.isInteger(index) || index < 0 || index >= PLAYERS.length) {
      return { ok: false, reason: 'squad' };
    }
    const player = PLAYERS[index]!;
    // One footballer per eleven, whichever versions a crafted code names.
    if (seen.has(player.identityId)) return { ok: false, reason: 'squad' };
    seen.add(player.identityId);
    picks[slot.id] = player.id;
  }

  return {
    ok: true,
    payload: {
      seed,
      categoryId: category.id,
      squad: { formationId: formation.id, picks },
      managerName: sanitizeName(nameRaw),
    },
  };
}

export function challengeUrl(code: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}/duel?join=${encodeURIComponent(code)}`;
}

/* -------------------------------------------------------------------------- */
/* Completed duels                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A finished friend duel: both elevens plus the seed they were played on. The
 * creator opens this to watch the exact match the challenger already saw.
 */
export interface DuelPayload {
  seed: string;
  home: ChallengePayload;
  away: ChallengePayload;
}

const DUEL_SEPARATOR = '~';

export function encodeDuel(payload: DuelPayload): string {
  return toBase64Url(
    [
      VERSION,
      payload.seed,
      encodeChallenge(payload.home),
      encodeChallenge(payload.away),
    ].join(DUEL_SEPARATOR),
  );
}

export type DecodeDuelResult =
  | { ok: true; payload: DuelPayload }
  | { ok: false; reason: 'malformed' | 'version' | 'dataset' | 'squad' };

export function decodeDuel(code: string): DecodeDuelResult {
  let body: string;
  try {
    body = fromBase64Url(code.trim());
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const parts = body.split(DUEL_SEPARATOR);
  if (parts.length !== 4) return { ok: false, reason: 'malformed' };
  const [version, seed, homeCode, awayCode] = parts as [string, string, string, string];

  if (version !== VERSION) return { ok: false, reason: 'version' };
  if (!/^[A-Z0-9]{4,16}$/.test(seed)) return { ok: false, reason: 'malformed' };

  const home = decodeChallenge(homeCode);
  if (!home.ok) return home;
  const away = decodeChallenge(awayCode);
  if (!away.ok) return away;

  return { ok: true, payload: { seed, home: home.payload, away: away.payload } };
}

export const DECODE_MESSAGES: Record<'malformed' | 'version' | 'dataset' | 'squad', string> = {
  malformed: 'That code is not a FutDuel challenge. Check it was copied in full.',
  version: 'That challenge was made on an older version of FutDuel and can no longer be opened.',
  dataset: 'That challenge was built from a different player database, so the elevens would not match.',
  squad: 'That challenge contains an eleven FutDuel cannot rebuild.',
};
