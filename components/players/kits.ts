/**
 * Traditional home-shirt colours, for card art only.
 *
 * A club's brand colour (`Club.color`) is the accent it uses in its identity,
 * which is not always the shirt it plays in: Real Madrid's brand gold would
 * paint a white shirt the colour of an Icon card. Where the two differ, the art
 * uses the shirt recorded here and keeps the brand colour for the collar trim.
 * Stripes are the club's traditional vertical stripes, which have stayed
 * constant across the seasons the historical cards depict. Clubs not listed
 * play in their brand colour.
 */
export interface Kit {
  shirt: string;
  /** Second colour of a traditionally striped shirt. */
  stripe?: string;
}

const WHITE = '#f1f2ee';
const BLACK = '#15181a';

export const CLUB_KIT: Record<string, Kit> = {
  'real-madrid': { shirt: WHITE },
  tottenham: { shirt: WHITE },
  leeds: { shirt: WHITE },
  sevilla: { shirt: WHITE },
  leipzig: { shirt: WHITE },
  stuttgart: { shirt: WHITE },
  marseille: { shirt: WHITE },
  lyon: { shirt: WHITE },
  'aston-villa': { shirt: '#670e36' },
  barcelona: { shirt: '#a50044', stripe: '#004d98' },
  inter: { shirt: '#0068a8', stripe: BLACK },
  milan: { shirt: '#d8121b', stripe: BLACK },
  juventus: { shirt: WHITE, stripe: BLACK },
  newcastle: { shirt: WHITE, stripe: BLACK },
  atletico: { shirt: '#cb3524', stripe: WHITE },
  athletic: { shirt: '#ee2523', stripe: WHITE },
  'real-sociedad': { shirt: '#0067b1', stripe: WHITE },
  betis: { shirt: '#00954c', stripe: WHITE },
  atalanta: { shirt: '#1e71b8', stripe: BLACK },
  nice: { shirt: '#c8102e', stripe: BLACK },
  brighton: { shirt: '#0057b8', stripe: WHITE },
  'crystal-palace': { shirt: '#1b458f', stripe: '#c4122e' },
};
