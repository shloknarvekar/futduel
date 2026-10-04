import type { Club, LeagueId } from '@/lib/domain/types';

export interface League {
  id: LeagueId;
  name: string;
  short: string;
  country: string;
}

export const LEAGUES: League[] = [
  { id: 'premier-league', name: 'Premier League', short: 'PL', country: 'England' },
  { id: 'la-liga', name: 'LaLiga', short: 'LL', country: 'Spain' },
  { id: 'serie-a', name: 'Serie A', short: 'SA', country: 'Italy' },
  { id: 'bundesliga', name: 'Bundesliga', short: 'BL', country: 'Germany' },
  { id: 'ligue-1', name: 'Ligue 1', short: 'L1', country: 'France' },
];

/**
 * Where a card goes when it was played outside the five leagues — Garrincha's
 * historical Botafogo, in a Brazil with no national league, and Messi's current
 * Inter Miami. Both run on calendar-year seasons, so every card here does too.
 * It is a bucket, not a competition: it is not one of
 * the browsable `LEAGUES` (so Discover's league filter stays five), no league
 * category can draw from it, and two players in it share no league chemistry,
 * because they never played in the same one.
 */
export const OTHER_LEAGUES: League = {
  id: 'other-leagues',
  name: 'Other leagues',
  short: 'OTH',
  country: 'Outside the five leagues',
};

export const LEAGUE_BY_ID = new Map([...LEAGUES, OTHER_LEAGUES].map((l) => [l.id, l]));

/** [id, name, short, league, city, colour, founded] */
type ClubRow = [string, string, string, LeagueId, string, string, number];

const CLUB_ROWS: ClubRow[] = [
  // Premier League
  ['man-city', 'Manchester City', 'MCI', 'premier-league', 'Manchester', '#6CABDD', 1880],
  ['arsenal', 'Arsenal', 'ARS', 'premier-league', 'London', '#EF0107', 1886],
  ['liverpool', 'Liverpool', 'LIV', 'premier-league', 'Liverpool', '#C8102E', 1892],
  ['chelsea', 'Chelsea', 'CHE', 'premier-league', 'London', '#034694', 1905],
  ['man-united', 'Manchester United', 'MUN', 'premier-league', 'Manchester', '#DA020E', 1878],
  ['tottenham', 'Tottenham Hotspur', 'TOT', 'premier-league', 'London', '#132257', 1882],
  ['newcastle', 'Newcastle United', 'NEW', 'premier-league', 'Newcastle', '#241F20', 1892],
  ['aston-villa', 'Aston Villa', 'AVL', 'premier-league', 'Birmingham', '#95BFE5', 1874],
  ['brighton', 'Brighton & Hove Albion', 'BHA', 'premier-league', 'Brighton', '#0057B8', 1901],
  ['west-ham', 'West Ham United', 'WHU', 'premier-league', 'London', '#7A263A', 1895],
  ['crystal-palace', 'Crystal Palace', 'CRY', 'premier-league', 'London', '#1B458F', 1905],
  ['everton', 'Everton', 'EVE', 'premier-league', 'Liverpool', '#003399', 1878],
  ['leeds', 'Leeds United', 'LEE', 'premier-league', 'Leeds', '#1D428A', 1919],

  // LaLiga
  ['real-madrid', 'Real Madrid', 'RMA', 'la-liga', 'Madrid', '#FEBE10', 1902],
  ['barcelona', 'FC Barcelona', 'BAR', 'la-liga', 'Barcelona', '#A50044', 1899],
  ['atletico', 'Atletico Madrid', 'ATM', 'la-liga', 'Madrid', '#CB3524', 1903],
  ['athletic', 'Athletic Club', 'ATH', 'la-liga', 'Bilbao', '#EE2523', 1898],
  ['real-sociedad', 'Real Sociedad', 'RSO', 'la-liga', 'San Sebastian', '#0067B1', 1909],
  ['villarreal', 'Villarreal', 'VIL', 'la-liga', 'Villarreal', '#FFE667', 1923],
  ['betis', 'Real Betis', 'BET', 'la-liga', 'Seville', '#00954C', 1907],
  ['sevilla', 'Sevilla', 'SEV', 'la-liga', 'Seville', '#D0021B', 1890],

  // Serie A
  ['inter', 'Inter', 'INT', 'serie-a', 'Milan', '#0068A8', 1908],
  ['milan', 'AC Milan', 'MIL', 'serie-a', 'Milan', '#FB090B', 1899],
  ['juventus', 'Juventus', 'JUV', 'serie-a', 'Turin', '#000000', 1897],
  ['napoli', 'Napoli', 'NAP', 'serie-a', 'Naples', '#12A0D7', 1926],
  ['atalanta', 'Atalanta', 'ATA', 'serie-a', 'Bergamo', '#1E71B8', 1907],
  ['roma', 'AS Roma', 'ROM', 'serie-a', 'Rome', '#8E1F2F', 1927],
  ['lazio', 'Lazio', 'LAZ', 'serie-a', 'Rome', '#87D8F7', 1900],
  ['fiorentina', 'Fiorentina', 'FIO', 'serie-a', 'Florence', '#592C82', 1926],

  // Bundesliga
  ['bayern', 'Bayern Munich', 'FCB', 'bundesliga', 'Munich', '#DC052D', 1900],
  ['leverkusen', 'Bayer Leverkusen', 'B04', 'bundesliga', 'Leverkusen', '#E32221', 1904],
  ['dortmund', 'Borussia Dortmund', 'BVB', 'bundesliga', 'Dortmund', '#FDE100', 1909],
  ['leipzig', 'RB Leipzig', 'RBL', 'bundesliga', 'Leipzig', '#DD0741', 2009],
  ['stuttgart', 'VfB Stuttgart', 'VFB', 'bundesliga', 'Stuttgart', '#E32219', 1893],
  ['frankfurt', 'Eintracht Frankfurt', 'SGE', 'bundesliga', 'Frankfurt', '#E1000F', 1899],

  // Ligue 1
  ['psg', 'Paris Saint-Germain', 'PSG', 'ligue-1', 'Paris', '#004170', 1970],
  ['monaco', 'AS Monaco', 'ASM', 'ligue-1', 'Monaco', '#E63329', 1924],
  ['marseille', 'Olympique Marseille', 'OM', 'ligue-1', 'Marseille', '#2FAEE0', 1899],
  ['lille', 'Lille OSC', 'LIL', 'ligue-1', 'Lille', '#E01E13', 1944],
  ['lyon', 'Olympique Lyonnais', 'OL', 'ligue-1', 'Lyon', '#DA001A', 1950],
  ['nice', 'OGC Nice', 'NIC', 'ligue-1', 'Nice', '#C8102E', 1904],

  // Outside the five leagues: here only so a current card can be where the
  // player actually is. MLS runs on calendar years, so its cards do too.
  ['inter-miami', 'Inter Miami', 'MIA', 'other-leagues', 'Miami', '#F7B5CD', 2018],
];

/**
 * Clubs that appear only in historical versions.
 *
 * Kept out of `CLUBS`, which is the 2025/26 programme: fixtures, club strength
 * and the discover grid are all about the current season, and a club with no
 * current squad has no place in them. Each row's league is the top flight the
 * club played in during the seasons the historical versions depict.
 */
const HISTORIC_CLUB_ROWS: ClubRow[] = [
  ['blackburn', 'Blackburn Rovers', 'BLB', 'premier-league', 'Blackburn', '#009EE0', 1875],
  ['leicester', 'Leicester City', 'LEI', 'premier-league', 'Leicester', '#003090', 1884],
  ['wolfsburg', 'VfL Wolfsburg', 'WOB', 'bundesliga', 'Wolfsburg', '#65B32E', 1945],
  ['botafogo', 'Botafogo', 'BOT', 'other-leagues', 'Rio de Janeiro', '#1A1A1A', 1904],
];

const toClub = ([id, name, short, league, city, color, founded]: ClubRow): Club => ({
  id,
  name,
  short,
  league,
  city,
  color,
  founded,
});

/** The current-season clubs: the ones with fixtures and a squad today. */
export const CLUBS: Club[] = CLUB_ROWS.map(toClub);

export const HISTORIC_CLUBS: Club[] = HISTORIC_CLUB_ROWS.map(toClub);

/** Resolves any club a card can carry, current or historical. */
export const CLUB_BY_ID = new Map([...CLUBS, ...HISTORIC_CLUBS].map((c) => [c.id, c]));

export function clubName(id: string): string {
  return CLUB_BY_ID.get(id)?.name ?? 'Unknown club';
}
