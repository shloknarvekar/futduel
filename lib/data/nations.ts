import type { Player } from '@/lib/domain/types';

/**
 * Nationality metadata shared by the current snapshot and the historical
 * versions, so a nation resolves to the same flag code and continent whichever
 * era a card comes from.
 */
export const NATIONS: Record<string, [code: string, continent: Player['continent']]> = {
  Argentina: ['AR', 'South America'],
  Brazil: ['BR', 'South America'],
  Uruguay: ['UY', 'South America'],
  Colombia: ['CO', 'South America'],
  Ecuador: ['EC', 'South America'],
  Paraguay: ['PY', 'South America'],
  Venezuela: ['VE', 'South America'],
  England: ['GB', 'Europe'],
  Scotland: ['GB', 'Europe'],
  Wales: ['GB', 'Europe'],
  Ireland: ['IE', 'Europe'],
  France: ['FR', 'Europe'],
  Spain: ['ES', 'Europe'],
  Portugal: ['PT', 'Europe'],
  Germany: ['DE', 'Europe'],
  Italy: ['IT', 'Europe'],
  Netherlands: ['NL', 'Europe'],
  Belgium: ['BE', 'Europe'],
  Croatia: ['HR', 'Europe'],
  Serbia: ['RS', 'Europe'],
  Slovenia: ['SI', 'Europe'],
  Switzerland: ['CH', 'Europe'],
  Austria: ['AT', 'Europe'],
  Denmark: ['DK', 'Europe'],
  Sweden: ['SE', 'Europe'],
  Norway: ['NO', 'Europe'],
  Poland: ['PL', 'Europe'],
  Finland: ['FI', 'Europe'],
  Hungary: ['HU', 'Europe'],
  Turkey: ['TR', 'Europe'],
  Georgia: ['GE', 'Europe'],
  Ukraine: ['UA', 'Europe'],
  Czechia: ['CZ', 'Europe'],
  Slovakia: ['SK', 'Europe'],
  Greece: ['GR', 'Europe'],
  Albania: ['AL', 'Europe'],
  Kosovo: ['XK', 'Europe'],
  Romania: ['RO', 'Europe'],
  Montenegro: ['ME', 'Europe'],
  Bosnia: ['BA', 'Europe'],
  Morocco: ['MA', 'Africa'],
  Senegal: ['SN', 'Africa'],
  Egypt: ['EG', 'Africa'],
  Nigeria: ['NG', 'Africa'],
  Ghana: ['GH', 'Africa'],
  Cameroon: ['CM', 'Africa'],
  Ivory: ['CI', 'Africa'],
  Mali: ['ML', 'Africa'],
  Algeria: ['DZ', 'Africa'],
  Guinea: ['GN', 'Africa'],
  Gambia: ['GM', 'Africa'],
  Zimbabwe: ['ZW', 'Africa'],
  Tunisia: ['TN', 'Africa'],
  Gabon: ['GA', 'Africa'],
  Liberia: ['LR', 'Africa'],
  Japan: ['JP', 'Asia'],
  'South Korea': ['KR', 'Asia'],
  Iran: ['IR', 'Asia'],
  Uzbekistan: ['UZ', 'Asia'],
  USA: ['US', 'North America'],
  Canada: ['CA', 'North America'],
  Mexico: ['MX', 'North America'],
  Jamaica: ['JM', 'North America'],
  Australia: ['AU', 'Oceania'],
};

/** Flag code and continent for a nation, or a thrown error naming the player. */
export function nationMeta(nation: string, playerName: string): [string, Player['continent']] {
  const meta = NATIONS[nation];
  if (!meta) throw new Error(`Unknown nation "${nation}" for player "${playerName}"`);
  return meta;
}
