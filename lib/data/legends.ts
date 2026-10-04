import type { Attributes, CardType, Foot, Player, Position, SlotRole } from '@/lib/domain/types';
import { CLUB_BY_ID } from './clubs';
import { nationMeta } from './nations';
import { LEGEND_SHIRT_NUMBERS } from './shirt-numbers';
import { ratePlayer, ratingTier } from '@/lib/engine/player-rating';

/**
 * Historical versions: Icons, Heroes and notable past seasons.
 *
 * ## Identity and version
 *
 * A footballer is authored once, as an identity: name, nationality, preferred
 * foot, date of birth and, for Icons, the honours that earn the status. Each
 * playable card is a version of that identity in one season at one club, with
 * attributes describing that season. Versions of the same person share an
 * `identityId`, which is what stops a squad fielding the same footballer twice.
 *
 * An identity whose id matches a current-season record (`manuel-neuer`) is that
 * same person: the historical version joins the current record rather than
 * creating a second Manuel Neuer.
 *
 * ## What is real and what is not
 *
 * Real: name, nationality, date of birth, preferred foot, the club and season,
 * and the honours or achievements given as a card's reason. League comes from
 * the club and age is computed from the date of birth on 1 September of the
 * season, so neither can be typed wrong.
 *
 * Editorial: the six attributes, FutDuel's judgement of the player in that
 * season on the same scale as the current snapshot. The rating is derived from
 * them by the same model. Nothing here is an official rating from any game or
 * data provider.
 *
 * Not recorded: market value. A 2003 fee is not comparable with a 2025
 * valuation and adjusting one would be invention, so historical versions carry
 * `value: null` and value-based categories leave them out.
 *
 * ## Icons
 *
 * An all-time great whose standing outlives any single club or league. The bar
 * is recorded on the identity and checked when it is parsed: every Icon has won
 * the Ballon d'Or, finished on its podium, or won the World Cup as a
 * first-choice player. The bar is necessary rather than sufficient — plenty of
 * World Cup winners are not Icons, and are simply not given the tag — and the
 * recorded honours become the card's stated reason. The status belongs to the
 * person, so every historical version of an Icon is an Icon.
 *
 * ## Heroes
 *
 * A player who defines a league or a club era without an Icon's honours: record
 * goalscorers, title-winning captains, one-club servants, a season that changed
 * a league. The status is earned somewhere specific, so it belongs to the
 * version, and each Hero version states what it achieved in its club's league.
 *
 * ## Everyone else
 *
 * A historical version with neither status is a standard card: a regular in a
 * notable side, there so historical elevens can be completed by the players who
 * actually lined up beside the stars.
 *
 * ## Row format
 *
 * Identities: `id | Name[~Short] | nation | foot | born YYYY-MM-DD | honours`
 *   Honours are space-separated and only for Icons: BDO2005 (won the Ballon
 *   d'Or), POD2009 (Ballon d'Or podium), WC2010 (World Cup, first-choice).
 *
 * Versions: `identityId | season YYYY/YY (YYYY for other leagues) | clubId | POS | roles |
 *            pac,sho,pas,dri,def,phy | P (prime) or - | Hero reason`
 *   Goalkeepers use the six slots as reflexes, handling, kicking, speed,
 *   positioning and aerial, exactly as the current snapshot does.
 */

export type IconHonour = 'ballon-dor' | 'ballon-dor-podium' | 'world-cup';

export interface LegendIdentity {
  id: string;
  name: string;
  short: string;
  nation: string;
  foot: Foot;
  /** ISO date of birth. */
  born: string;
  /** The honours that clear the Icon bar. Empty for everyone else. */
  honours: { honour: IconHonour; year: number }[];
}

const HONOUR_CODE: Record<string, IconHonour> = {
  BDO: 'ballon-dor',
  POD: 'ballon-dor-podium',
  WC: 'world-cup',
};

/**
 * Seasons in which a club used below was outside its top flight.
 *
 * A club never changes country, so a version's league comes from its club. The
 * one way that can still go wrong is a relegated season, which would place a
 * player in a league he did not play in that year. This is not a complete
 * history: it lists the relegated seasons of these clubs across the decades the
 * records cover, so an authoring slip into one of them fails loudly at import.
 */
const OUTSIDE_TOP_FLIGHT: Record<string, string[]> = {
  juventus: ['2006/07'],
  milan: ['1980/81', '1982/83'],
  napoli: ['1998/99', '1999/00', '2001/02', '2002/03', '2003/04', '2004/05', '2005/06', '2006/07'],
  fiorentina: ['1993/94', '2002/03', '2003/04'],
  lazio: ['1985/86', '1986/87', '1987/88'],
  atletico: ['2000/01', '2001/02'],
  sevilla: ['2000/01'],
  villarreal: ['2012/13'],
  lille: ['1997/98', '1998/99', '1999/00'],
  'man-city': ['1996/97', '1997/98', '1998/99', '1999/00', '2001/02'],
  chelsea: ['1988/89'],
  marseille: ['1994/95', '1995/96'],
  monaco: ['2011/12', '2012/13'],
  newcastle: ['1989/90', '1990/91', '1991/92', '1992/93', '2009/10', '2016/17'],
  'west-ham': ['2003/04', '2004/05', '2011/12'],
  'aston-villa': ['2016/17', '2017/18', '2018/19'],
  blackburn: ['1999/00', '2000/01'],
  leicester: ['2002/03', '2004/05', '2005/06', '2006/07', '2007/08', '2008/09', '2009/10', '2010/11', '2011/12', '2012/13', '2013/14'],
};

/** The id convention shared with the current snapshot: the name, slugified. */
export function identitySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * A season written `YYYY`: one calendar year, as football is played outside
 * Europe's autumn-to-spring calendar. Only clubs outside the five leagues
 * use it; the five leagues always use `YYYY/YY`, and `parseVersion` refuses a mix.
 */
export function isCalendarSeason(season: string): boolean {
  return /^\d{4}$/.test(season);
}

/**
 * First calendar year of a season: `YYYY/YY`, or a single calendar year
 * `YYYY`. Throws on anything malformed.
 */
export function seasonStart(season: string): number {
  if (isCalendarSeason(season)) return Number(season);
  const match = /^(\d{4})\/(\d{2})$/.exec(season);
  if (!match) throw new Error(`Malformed season "${season}"`);
  const start = Number(match[1]);
  if ((start + 1) % 100 !== Number(match[2])) {
    throw new Error(`Season "${season}" does not span two consecutive years`);
  }
  return start;
}

/**
 * Age when the season began: on 1 September for a European `YYYY/YY` season,
 * and on 1 January for a calendar-year one.
 */
export function ageAtSeasonStart(born: string, season: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(born);
  if (!match) throw new Error(`Malformed date of birth "${born}"`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const age = seasonStart(season) - year;
  // Born after the reference date means that birthday had not come round yet.
  const [refMonth, refDay] = isCalendarSeason(season) ? [1, 1] : [9, 1];
  return month > refMonth || (month === refMonth && day > refDay) ? age - 1 : age;
}

/**
 * An Icon's reason, written from the recorded honours rather than typed, so the
 * card can only ever claim what the data holds. A Ballon d'Or win supersedes a
 * podium; long runs are summarised.
 */
export function iconReason(honours: LegendIdentity['honours']): string {
  const years = (honour: IconHonour) =>
    honours.filter((h) => h.honour === honour).map((h) => h.year).sort((a, b) => a - b);
  const list = (ys: number[]) =>
    ys.length > 3 ? `×${ys.length} (${ys[0]}–${ys[ys.length - 1]})` : ys.join(', ');

  const parts: string[] = [];
  const won = years('ballon-dor');
  const podium = years('ballon-dor-podium');
  const worldCup = years('world-cup');
  if (won.length > 0) parts.push(`Ballon d'Or ${list(won)}`);
  else if (podium.length > 0) parts.push(`Ballon d'Or podium ${list(podium)}`);
  if (worldCup.length > 0) parts.push(`World Cup winner ${list(worldCup)}`);
  return parts.join(' · ');
}

function parseIdentity(row: string): LegendIdentity {
  const parts = row.split('|');
  if (parts.length !== 6) throw new Error(`Malformed identity row "${row}": expected 6 fields`);
  const [id, rawName, nation, foot, born, honoursRaw] = parts as [
    string, string, string, string, string, string,
  ];
  const [name, short] = rawName.split('~') as [string, string | undefined];

  if (identitySlug(name) !== id) throw new Error(`Identity id "${id}" does not match "${name}"`);
  if (foot !== 'L' && foot !== 'R') throw new Error(`Unknown foot "${foot}" for "${name}"`);
  nationMeta(nation, name);
  ageAtSeasonStart(born, '2000/01');

  const honours = honoursRaw
    .split(' ')
    .filter(Boolean)
    .map((token) => {
      const match = /^(BDO|POD|WC)(\d{4})$/.exec(token);
      const honour = match ? HONOUR_CODE[match[1]!] : undefined;
      if (!match || !honour) throw new Error(`Unknown honour "${token}" for "${name}"`);
      return { honour, year: Number(match[2]) };
    });

  const ballonYears = honours.filter((h) => h.honour !== 'world-cup').map((h) => h.year);
  if (new Set(ballonYears).size !== ballonYears.length) {
    throw new Error(`"${name}" records two Ballon d'Or results for the same year`);
  }

  return { id, name, short: short ?? name.split(' ').slice(-1)[0]!, nation, foot, born, honours };
}

function parseVersion(row: string, identities: Map<string, LegendIdentity>): Player {
  const parts = row.split('|');
  if (parts.length !== 8) throw new Error(`Malformed version row "${row}": expected 8 fields`);
  const [identityId, season, clubId, pos, roles, attrs, flag, heroReason] = parts as [
    string, string, string, string, string, string, string, string,
  ];

  const identity = identities.get(identityId);
  if (!identity) throw new Error(`Version "${row}" names unknown identity "${identityId}"`);
  const label = `${identity.name} ${season}`;

  const club = CLUB_BY_ID.get(clubId);
  if (!club) throw new Error(`Unknown club "${clubId}" for ${label}`);
  if (OUTSIDE_TOP_FLIGHT[clubId]?.includes(season)) {
    throw new Error(`${club.name} were not in the top flight in ${season} (${label})`);
  }
  // A calendar-year season belongs to a club outside the five leagues and nowhere else:
  // a "1962" Milan card, or a "1961/62" Botafogo one, is an authoring slip.
  if (isCalendarSeason(season) !== (club.league === 'other-leagues')) {
    throw new Error(`${label}: ${club.name} seasons are written ${club.league === 'other-leagues' ? 'YYYY' : 'YYYY/YY'}`);
  }
  if (flag !== 'P' && flag !== '-') throw new Error(`Unknown prime flag "${flag}" for ${label}`);

  const a = attrs.split(',').map(Number);
  if (a.length !== 6 || a.some((n) => !Number.isInteger(n))) {
    throw new Error(`Malformed attributes for ${label}`);
  }
  const attributes: Attributes = {
    pace: a[0]!, shooting: a[1]!, passing: a[2]!, dribbling: a[3]!, defending: a[4]!, physical: a[5]!,
  };

  const isIcon = identity.honours.length > 0;
  if (isIcon && heroReason) {
    throw new Error(`${identity.name} is an Icon, so ${label} cannot also be a Hero`);
  }
  const cardType: CardType = isIcon ? 'icon' : heroReason ? 'hero' : 'standard';

  const position = pos as Position;
  const rating = ratePlayer(position, attributes);
  const [nationCode, continent] = nationMeta(identity.nation, identity.name);

  const id = `${identityId}-${season.replace('/', '-')}`;

  return {
    id,
    identityId,
    name: identity.name,
    short: identity.short,
    position,
    roles: roles.split(',') as SlotRole[],
    club: club.name,
    clubId,
    league: club.league,
    nation: identity.nation,
    nationCode,
    continent,
    age: ageAtSeasonStart(identity.born, season),
    rating,
    attributes,
    value: null,
    foot: identity.foot,
    tier: ratingTier(rating),
    era: 'legend',
    season,
    prime: flag === 'P',
    cardType,
    cardReason: isIcon ? iconReason(identity.honours) : heroReason || null,
    shirtNumber: LEGEND_SHIRT_NUMBERS[id] ?? null,
  };
}

/* ---------------------------------------------------------------- identities */

const IDENTITY_ROWS: string[] = [
  /* ---------------------------------------------------------- goalkeepers */
  'gianluigi-buffon|Gianluigi Buffon~Buffon|Italy|R|1978-01-28|POD2006 WC2006',
  'iker-casillas|Iker Casillas~Casillas|Spain|L|1981-05-20|WC2010',
  'oliver-kahn|Oliver Kahn~Kahn|Germany|R|1969-06-15|POD2001 POD2002',
  'manuel-neuer|Manuel Neuer|Germany|R|1986-03-27|POD2014 WC2014',
  'hugo-lloris|Hugo Lloris~Lloris|France|L|1986-12-26|',
  'petr-cech|Petr Cech~Cech|Czechia|L|1982-05-20|',
  'edwin-van-der-sar|Edwin van der Sar~Van der Sar|Netherlands|R|1970-10-29|',
  'peter-schmeichel|Peter Schmeichel~Schmeichel|Denmark|R|1963-11-18|',
  'david-de-gea|David de Gea~De Gea|Spain|R|1990-11-07|',
  'victor-valdes|Victor Valdes~Valdes|Spain|R|1982-01-14|',
  'dida|Dida|Brazil|L|1973-10-07|',
  'julio-cesar|Julio Cesar~Julio Cesar|Brazil|L|1979-09-03|',

  /* ------------------------------------------------------------ defenders */
  'paolo-maldini|Paolo Maldini~Maldini|Italy|R|1968-06-26|POD1994 POD2003',
  'franco-baresi|Franco Baresi~Baresi|Italy|R|1960-05-08|POD1989',
  'alessandro-nesta|Alessandro Nesta~Nesta|Italy|R|1976-03-19|WC2006',
  'fabio-cannavaro|Fabio Cannavaro~Cannavaro|Italy|R|1973-09-13|BDO2006 WC2006',
  'gianluca-zambrotta|Gianluca Zambrotta~Zambrotta|Italy|R|1977-02-19|WC2006',
  'marcel-desailly|Marcel Desailly~Desailly|France|R|1968-09-07|WC1998',
  'lilian-thuram|Lilian Thuram~L. Thuram|France|R|1972-01-01|WC1998',
  'bixente-lizarazu|Bixente Lizarazu~Lizarazu|France|L|1969-12-09|',
  'cafu|Cafu|Brazil|R|1970-06-07|WC2002',
  'roberto-carlos|Roberto Carlos~R. Carlos|Brazil|L|1973-04-10|POD2002 WC2002',
  'lucio|Lucio|Brazil|R|1978-05-08|',
  'carles-puyol|Carles Puyol~Puyol|Spain|R|1978-04-13|WC2010',
  'sergio-ramos|Sergio Ramos~Ramos|Spain|R|1986-03-30|WC2010',
  'gerard-pique|Gerard Pique~Pique|Spain|R|1987-02-02|',
  'philipp-lahm|Philipp Lahm~Lahm|Germany|R|1983-11-11|WC2014',
  'mats-hummels|Mats Hummels~Hummels|Germany|R|1988-12-16|',
  'matthias-sammer|Matthias Sammer~Sammer|Germany|R|1967-09-05|BDO1996',
  'john-terry|John Terry~Terry|England|R|1980-12-07|',
  'rio-ferdinand|Rio Ferdinand~Ferdinand|England|R|1978-11-07|',
  'nemanja-vidic|Nemanja Vidic~Vidic|Serbia|R|1981-10-21|',
  'ashley-cole|Ashley Cole~A. Cole|England|L|1980-12-20|',
  'gary-neville|Gary Neville~G. Neville|England|R|1975-02-18|',
  'tony-adams|Tony Adams~Adams|England|R|1966-10-10|',
  'jaap-stam|Jaap Stam~Stam|Netherlands|R|1972-07-17|',
  'vincent-kompany|Vincent Kompany~Kompany|Belgium|R|1986-04-10|',
  'jamie-carragher|Jamie Carragher~Carragher|England|R|1978-01-28|',
  'sol-campbell|Sol Campbell~Campbell|England|R|1974-09-18|',
  'ricardo-carvalho|Ricardo Carvalho~Carvalho|Portugal|R|1978-05-18|',
  'denis-irwin|Denis Irwin~Irwin|Ireland|R|1965-10-31|',
  'lauren|Lauren|Cameroon|R|1977-01-19|',
  'kolo-toure|Kolo Toure~K. Toure|Ivory|R|1981-03-19|',
  'sami-hyypia|Sami Hyypia~Hyypia|Finland|R|1973-10-07|',
  'fernando-hierro|Fernando Hierro~Hierro|Spain|R|1968-03-23|',
  'dani-alves|Dani Alves~Dani Alves|Brazil|R|1983-05-06|',
  'marcelo|Marcelo|Brazil|L|1988-05-12|',
  'diego-godin|Diego Godin~Godin|Uruguay|R|1986-02-16|',
  'eric-abidal|Eric Abidal~Abidal|France|L|1979-09-11|',
  'javier-zanetti|Javier Zanetti~Zanetti|Argentina|R|1973-08-10|',
  'walter-samuel|Walter Samuel~Samuel|Argentina|R|1978-03-23|',
  'maicon|Maicon|Brazil|R|1981-07-26|',
  'giorgio-chiellini|Giorgio Chiellini~Chiellini|Italy|L|1984-08-14|',
  'thiago-silva|Thiago Silva~T. Silva|Brazil|R|1984-09-22|',
  'maxwell|Maxwell|Brazil|L|1981-08-27|',
  'anthony-reveillere|Anthony Reveillere~Reveillere|France|R|1979-11-10|',
  'lukasz-piszczek|Lukasz Piszczek~Piszczek|Poland|R|1985-06-03|',
  'neven-subotic|Neven Subotic~Subotic|Serbia|R|1988-12-10|',
  'kyle-walker|Kyle Walker~Walker|England|R|1990-05-28|',

  /* ---------------------------------------------------------- midfielders */
  'zinedine-zidane|Zinedine Zidane~Zidane|France|R|1972-06-23|BDO1998 WC1998',
  'lothar-matthaus|Lothar Matthaus~Matthaus|Germany|R|1961-03-21|BDO1990 WC1990',
  'didier-deschamps|Didier Deschamps~Deschamps|France|R|1968-10-15|',
  'xavi|Xavi|Spain|R|1980-01-25|POD2009 POD2010 POD2011 WC2010',
  'andres-iniesta|Andres Iniesta~Iniesta|Spain|R|1984-05-11|POD2010 POD2012 WC2010',
  'sergio-busquets|Sergio Busquets~Busquets|Spain|R|1988-07-16|WC2010',
  'rodri|Rodri|Spain|R|1996-06-22|BDO2024',
  'xabi-alonso|Xabi Alonso~Xabi Alonso|Spain|R|1981-11-25|WC2010',
  'andrea-pirlo|Andrea Pirlo~Pirlo|Italy|R|1979-05-19|WC2006',
  'kaka|Kaka|Brazil|R|1982-04-22|BDO2007',
  'luka-modric|Luka Modric|Croatia|R|1985-09-09|BDO2018',
  'luis-figo|Luis Figo~Figo|Portugal|R|1972-11-04|BDO2000',
  'deco|Deco|Portugal|R|1977-08-27|',
  'pavel-nedved|Pavel Nedved~Nedved|Czechia|R|1972-08-30|BDO2003',
  'steven-gerrard|Steven Gerrard~Gerrard|England|R|1980-05-30|POD2005',
  'frank-lampard|Frank Lampard~Lampard|England|R|1978-06-20|POD2005',
  'david-beckham|David Beckham~Beckham|England|R|1975-05-02|POD1999',
  'michael-ballack|Michael Ballack~Ballack|Germany|R|1976-09-26|',
  'bastian-schweinsteiger|Bastian Schweinsteiger~Schweinsteiger|Germany|R|1984-08-01|',
  'toni-kroos|Toni Kroos~Kroos|Germany|R|1990-01-04|WC2014',
  'kevin-de-bruyne|Kevin De Bruyne~De Bruyne|Belgium|R|1991-06-28|POD2022',
  "n-golo-kante|N'Golo Kante~Kante|France|R|1991-03-29|",
  'patrick-vieira|Patrick Vieira~Vieira|France|R|1976-06-23|',
  'roy-keane|Roy Keane~Keane|Ireland|R|1971-08-10|',
  'paul-scholes|Paul Scholes~Scholes|England|R|1974-11-16|',
  'ryan-giggs|Ryan Giggs~Giggs|Wales|L|1973-11-29|',
  'yaya-toure|Yaya Toure~Yaya Toure|Ivory|R|1983-05-13|',
  'david-silva|David Silva~D. Silva|Spain|L|1986-01-08|',
  'claude-makelele|Claude Makelele~Makelele|France|R|1973-02-18|',
  'robert-pires|Robert Pires~Pires|France|R|1973-10-29|',
  'park-ji-sung|Park Ji-sung~Park|South Korea|R|1981-02-25|',
  'pep-guardiola|Pep Guardiola~Guardiola|Spain|R|1971-01-18|',
  'fernando-redondo|Fernando Redondo~Redondo|Argentina|L|1969-06-06|',
  'gabi|Gabi|Spain|R|1983-07-10|',
  'juan-roman-riquelme|Juan Roman Riquelme~Riquelme|Argentina|R|1978-06-24|',
  'clarence-seedorf|Clarence Seedorf~Seedorf|Netherlands|R|1976-04-01|',
  'wesley-sneijder|Wesley Sneijder~Sneijder|Netherlands|R|1984-06-09|',
  'juan-sebastian-veron|Juan Sebastian Veron~Veron|Argentina|R|1975-03-09|',
  'daniele-de-rossi|Daniele De Rossi~De Rossi|Italy|R|1983-07-24|',
  'stefan-effenberg|Stefan Effenberg~Effenberg|Germany|R|1968-08-02|',
  'shinji-kagawa|Shinji Kagawa~Kagawa|Japan|R|1989-03-17|',
  'juninho-pernambucano|Juninho Pernambucano~Juninho|Brazil|R|1975-01-30|',
  'michael-essien|Michael Essien~Essien|Ghana|R|1982-12-03|',
  'marco-verratti|Marco Verratti~Verratti|Italy|R|1992-11-05|',
  'rai|Rai|Brazil|R|1965-05-15|',
  'ruud-gullit|Ruud Gullit~Gullit|Netherlands|R|1962-09-01|BDO1987',

  /* ------------------------------------------------------------- forwards */
  'lionel-messi|Lionel Messi~Messi|Argentina|L|1987-06-24|BDO2009 BDO2010 BDO2011 BDO2012 BDO2015 BDO2019 BDO2021 BDO2023 WC2022',
  'kylian-mbappe|Kylian Mbappe~Mbappe|France|R|1998-12-20|WC2018 POD2023',
  'cristiano-ronaldo|Cristiano Ronaldo~Cristiano|Portugal|R|1985-02-05|BDO2008 BDO2013 BDO2014 BDO2016 BDO2017',
  'ronaldo-nazario|Ronaldo Nazario~Ronaldo|Brazil|R|1976-09-18|BDO1997 BDO2002 WC2002',
  'ronaldinho|Ronaldinho|Brazil|R|1980-03-21|BDO2005 WC2002',
  'garrincha|Garrincha|Brazil|R|1933-10-28|WC1958 WC1962',
  'rivaldo|Rivaldo|Brazil|L|1972-04-19|BDO1999 WC2002',
  'marco-van-basten|Marco van Basten~Van Basten|Netherlands|R|1964-10-31|BDO1988 BDO1989 BDO1992',
  'george-weah|George Weah~Weah|Liberia|R|1966-10-01|BDO1995',
  'roberto-baggio|Roberto Baggio~Baggio|Italy|R|1967-02-18|BDO1993',
  'jean-pierre-papin|Jean-Pierre Papin~Papin|France|R|1963-11-05|BDO1991',
  'andriy-shevchenko|Andriy Shevchenko~Shevchenko|Ukraine|R|1976-09-29|BDO2004',
  'karim-benzema|Karim Benzema~Benzema|France|R|1987-12-19|BDO2022',
  'thierry-henry|Thierry Henry~Henry|France|R|1977-08-17|POD2003 POD2006',
  'dennis-bergkamp|Dennis Bergkamp~Bergkamp|Netherlands|R|1969-05-10|POD1992 POD1993',
  'eric-cantona|Eric Cantona~Cantona|France|R|1966-05-24|POD1993',
  'alan-shearer|Alan Shearer~Shearer|England|R|1970-08-13|POD1996',
  'raul|Raul|Spain|L|1977-06-27|POD2001',
  'fernando-torres|Fernando Torres~Torres|Spain|R|1984-03-20|POD2008',
  'neymar|Neymar|Brazil|R|1992-02-05|POD2015 POD2017',
  'franck-ribery|Franck Ribery~Ribery|France|R|1983-04-07|POD2013',
  'robert-lewandowski|Robert Lewandowski~Lewandowski|Poland|R|1988-08-21|POD2021',
  'antoine-griezmann|Antoine Griezmann|France|L|1991-03-21|POD2016 POD2018 WC2018',
  'francesco-totti|Francesco Totti~Totti|Italy|R|1976-09-27|WC2006',
  'david-villa|David Villa~Villa|Spain|R|1981-12-03|WC2010',
  'wayne-rooney|Wayne Rooney~Rooney|England|R|1985-10-24|',
  'didier-drogba|Didier Drogba~Drogba|Ivory|R|1978-03-11|',
  'sergio-aguero|Sergio Aguero~Aguero|Argentina|R|1988-06-02|',
  'luis-suarez|Luis Suarez~Suarez|Uruguay|R|1987-01-24|',
  'mohamed-salah|Mohamed Salah|Egypt|L|1992-06-15|',
  'harry-kane|Harry Kane|England|R|1993-07-28|',
  'gareth-bale|Gareth Bale~Bale|Wales|L|1989-07-16|',
  'jamie-vardy|Jamie Vardy~Vardy|England|R|1987-01-11|',
  'riyad-mahrez|Riyad Mahrez~Mahrez|Algeria|L|1991-02-21|',
  'eden-hazard|Eden Hazard~Hazard|Belgium|R|1991-01-07|',
  "samuel-eto-o|Samuel Eto'o~Eto'o|Cameroon|R|1981-03-10|",
  'alessandro-del-piero|Alessandro Del Piero~Del Piero|Italy|R|1974-11-09|',
  'zlatan-ibrahimovic|Zlatan Ibrahimovic~Ibrahimovic|Sweden|R|1981-10-03|',
  'gabriel-batistuta|Gabriel Batistuta~Batistuta|Argentina|R|1969-02-01|',
  'diego-milito|Diego Milito~Milito|Argentina|R|1979-06-12|',
  'gonzalo-higuain|Gonzalo Higuain~Higuain|Argentina|R|1987-12-10|',
  'edinson-cavani|Edinson Cavani~Cavani|Uruguay|R|1987-02-14|',
  'arjen-robben|Arjen Robben~Robben|Netherlands|L|1984-01-23|',
  'marco-reus|Marco Reus~Reus|Germany|R|1989-05-31|',
  'grafite|Grafite|Brazil|R|1979-04-02|',
  'edin-dzeko|Edin Dzeko~Dzeko|Bosnia|R|1986-03-17|',
  'pierre-emerick-aubameyang|Pierre-Emerick Aubameyang~Aubameyang|Gabon|R|1989-06-18|',
];

/* ------------------------------------------------------------------ versions */

const VERSION_ROWS: string[] = [
  /* ------------------------------------------------------- Premier League */
  'peter-schmeichel|1998/99|man-united|GK|GK|88,86,78,50,87,90|-|Won five Premier League titles with Manchester United, the last in the 1999 treble season.',
  "petr-cech|2004/05|chelsea|GK|GK|89,86,74,50,89,88|P|Kept a Premier League record 24 clean sheets in 2004/05 and holds the competition's all-time clean-sheet record.",
  'edwin-van-der-sar|2008/09|man-united|GK|GK|85,87,82,44,89,82|-|Went a record 1,311 minutes without conceding in the 2008/09 Premier League season.',
  "david-de-gea|2017/18|man-united|GK|GK|92,84,74,58,86,78|P|Premier League Golden Glove winner in 2017/18 and four times Manchester United's Player of the Year.",
  'hugo-lloris|2016/17|tottenham|GK|GK|90,84,76,60,86,80|P|Captained Tottenham for eight seasons, including the run to the 2019 Champions League final.',
  'tony-adams|1997/98|arsenal|DEF|CB|66,52,72,62,88,88|-|One-club captain who lifted league titles with Arsenal in three different decades.',
  "jaap-stam|1998/99|man-united|DEF|CB|78,46,68,62,89,90|P|Won three consecutive Premier League titles at the heart of Manchester United's defence.",
  'denis-irwin|1998/99|man-united|DEF|LB,RB|78,70,80,74,82,72|-|',
  'gary-neville|1998/99|man-united|DEF|RB,RWB|80,50,80,72,82,76|P|One-club right-back who won eight Premier League titles with Manchester United.',
  "rio-ferdinand|2007/08|man-united|DEF|CB|80,46,76,72,88,82|P|Won six Premier League titles at the heart of Manchester United's defence.",
  'nemanja-vidic|2008/09|man-united|DEF|CB|72,50,64,58,90,91|P|Twice named Premier League Player of the Season, in 2008/09 and 2010/11.',
  'john-terry|2004/05|chelsea|DEF|CB|72,56,72,64,90,88|P|Captained Chelsea to five Premier League titles.',
  'kyle-walker|2017/18|man-city|DEF|RB,RWB,CB|93,56,78,78,79,80|P|Won six Premier League titles with Manchester City, the first with the 100-point side of 2017/18 and the last as club captain.',
  'ricardo-carvalho|2004/05|chelsea|DEF|CB|80,44,74,72,87,80|P|',
  'ashley-cole|2003/04|arsenal|DEF|LB,LWB|88,56,80,82,84,74|P|Won the league unbeaten with Arsenal in 2003/04 and the double with Chelsea in 2009/10.',
  'lauren|2003/04|arsenal|DEF|RB|80,56,74,74,80,80|P|',
  'kolo-toure|2003/04|arsenal|DEF|CB|86,48,66,66,82,82|-|',
  'sol-campbell|2003/04|arsenal|DEF|CB|80,46,64,60,88,90|P|',
  'vincent-kompany|2011/12|man-city|DEF|CB|76,50,72,64,88,86|P|Captained Manchester City to four Premier League titles.',
  'jamie-carragher|2004/05|liverpool|DEF|CB,RB|74,40,70,62,88,86|P|Made 737 appearances for Liverpool across a one-club career.',
  'sami-hyypia|2004/05|liverpool|DEF|CB|60,52,70,58,87,88|-|',
  'patrick-vieira|2003/04|arsenal|MID|CDM,CM|80,72,82,82,86,90|P|Captained Arsenal through their unbeaten 2003/04 Premier League season.',
  'roy-keane|1999/00|man-united|MID|CDM,CM|74,72,84,80,86,86|P|Won seven Premier League titles with Manchester United, most of them as captain.',
  'paul-scholes|2002/03|man-united|MID|CM,CAM|70,86,90,84,66,72|P|Won eleven Premier League titles in a one-club career with Manchester United.',
  'david-beckham|1998/99|man-united|MID|RM,CM|76,86,95,80,60,76|P|',
  'claude-makelele|2004/05|chelsea|MID|CDM|74,58,84,82,90,84|P|',
  "robert-pires|2001/02|arsenal|MID|LM,CAM|84,86,90,90,50,70|P|Football Writers' Player of the Year as Arsenal won the 2001/02 double.",
  'park-ji-sung|2008/09|man-united|MID|RM,CM,LM|84,70,76,78,72,82|P|',
  'steven-gerrard|2008/09|liverpool|MID|CAM,CM|80,91,88,83,66,82|P|',
  'frank-lampard|2004/05|chelsea|MID|CM,CAM|74,89,88,80,70,80|P|',
  'yaya-toure|2013/14|man-city|MID|CM,CDM|76,84,84,82,68,88|P|Scored 20 Premier League goals from midfield as Manchester City won the 2013/14 title.',
  'david-silva|2011/12|man-city|MID|CAM,CM,LW|74,80,93,93,56,64|P|Won four Premier League titles as the creative heart of Manchester City.',
  'rodri|2023/24|man-city|MID|CDM,CM|64,80,90,84,86,86|P|',
  'kevin-de-bruyne|2019/20|man-city|MID|CAM,CM|76,86,95,88,60,76|P|',
  'n-golo-kante|2015/16|leicester|MID|CDM,CM|82,64,80,82,88,84|P|Won back-to-back Premier League titles, with Leicester in 2015/16 and Chelsea in 2016/17.',
  'ryan-giggs|1998/99|man-united|FWD|LW,LM|92,80,82,92,40,68|P|Won a record thirteen Premier League titles, all with Manchester United.',
  'eric-cantona|1995/96|man-united|FWD|CF,ST|76,90,86,90,40,84|P|',
  'alan-shearer|1994/95|blackburn|FWD|ST|86,95,70,80,42,90|P|',
  'thierry-henry|2003/04|arsenal|FWD|ST,LW|95,91,84,91,40,78|P|',
  'dennis-bergkamp|1997/98|arsenal|FWD|CF,CAM|78,90,92,95,40,74|P|',
  'cristiano-ronaldo|2007/08|man-united|FWD|RW,LW,ST|94,90,82,93,34,82|P|',
  "wayne-rooney|2009/10|man-united|FWD|ST,CF|84,90,84,86,52,86|P|Manchester United's record goalscorer and a five-time Premier League champion.",
  "didier-drogba|2009/10|chelsea|FWD|ST|84,92,72,82,40,94|P|Twice the Premier League's top scorer, in 2006/07 and 2009/10, for Chelsea.",
  "sergio-aguero|2011/12|man-city|FWD|ST|88,90,76,90,34,76|P|Manchester City's record goalscorer, whose stoppage-time winner decided the 2011/12 title.",
  'luis-suarez|2013/14|liverpool|FWD|ST,CF|86,92,80,90,44,82|P|Scored 31 Premier League goals in 2013/14 and won both player of the year awards.',
  'mohamed-salah|2017/18|liverpool|FWD|RW,ST|94,90,80,90,42,74|P|Scored 32 goals in 2017/18, then a record for a 38-game Premier League season.',
  "harry-kane|2017/18|tottenham|FWD|ST|80,94,80,84,46,84|P|Tottenham's record goalscorer and a three-time Premier League Golden Boot winner.",
  'fernando-torres|2007/08|liverpool|FWD|ST|92,89,72,86,34,80|P|',
  "gareth-bale|2012/13|tottenham|FWD|RW,LW|94,85,80,86,48,80|P|Swept the PFA and Football Writers' player of the year awards at Tottenham in 2012/13.",
  "jamie-vardy|2015/16|leicester|FWD|ST|93,87,70,82,40,76|P|Scored in a record eleven consecutive Premier League matches during Leicester's 2015/16 title win.",
  "riyad-mahrez|2015/16|leicester|FWD|RW|86,84,84,92,40,62|P|PFA Players' Player of the Year as Leicester won the 2015/16 title.",
  'eden-hazard|2014/15|chelsea|FWD|LW,CAM|91,85,86,95,34,68|P|Premier League Player of the Season as Chelsea won the 2014/15 title.',

  /* --------------------------------------------------------------- LaLiga */
  'iker-casillas|2007/08|real-madrid|GK|GK|93,86,70,58,89,76|P|',
  "victor-valdes|2010/11|barcelona|GK|GK|87,82,86,56,86,76|P|Won five Zamora Trophies as Barcelona's goalkeeper.",
  "fernando-hierro|1997/98|real-madrid|DEF|CB,CDM|68,78,82,70,86,82|P|Won three Champions Leagues at the heart of Real Madrid's defence.",
  'roberto-carlos|2002/03|real-madrid|DEF|LB,LWB|91,82,82,84,78,80|P|',
  'carles-puyol|2008/09|barcelona|DEF|CB,RB|80,50,68,66,90,86|P|',
  "gerard-pique|2010/11|barcelona|DEF|CB|68,58,82,74,88,84|P|Won the treble twice at the heart of Barcelona's defence, in 2008/09 and 2014/15.",
  "dani-alves|2010/11|barcelona|DEF|RB,RWB,RM|91,70,88,86,80,76|P|Won six LaLiga titles on Barcelona's right flank.",
  'eric-abidal|2010/11|barcelona|DEF|LB,CB|82,44,72,72,84,80|P|',
  'diego-godin|2013/14|atletico|DEF|CB|70,58,66,62,90,88|P|Scored the header at Camp Nou that won Atletico the 2013/14 league title.',
  'sergio-ramos|2016/17|real-madrid|DEF|CB|76,68,76,74,88,83|P|',
  'fabio-cannavaro|2006/07|real-madrid|DEF|CB|80,40,70,72,91,84|P|',
  "marcelo|2016/17|real-madrid|DEF|LB,LWB|86,74,88,92,78,78|P|Won six LaLiga titles as Real Madrid's attacking left-back.",
  "pep-guardiola|1993/94|barcelona|MID|CDM,CM|62,62,92,84,80,70|-|Holding midfielder of Johan Cruyff's Barcelona, which won four straight LaLiga titles from 1990/91 to 1993/94.",
  "fernando-redondo|1999/00|real-madrid|MID|CDM,CM|66,66,88,86,84,78|P|Won two Champions Leagues as Real Madrid's holding midfielder.",
  'xavi|2008/09|barcelona|MID|CM|74,76,97,92,68,70|P|',
  'andres-iniesta|2010/11|barcelona|MID|CM,LW,CAM|80,78,94,97,62,70|P|',
  'zinedine-zidane|2001/02|real-madrid|MID|CAM,CM|76,86,92,95,56,84|P|',
  'luka-modric|2017/18|real-madrid|MID|CM,CAM|76,78,92,92,72,72|P|',
  'sergio-busquets|2010/11|barcelona|MID|CDM|62,58,93,89,88,80|P|',
  'xabi-alonso|2011/12|real-madrid|MID|CDM,CM|60,80,93,78,82,80|P|',
  "deco|2005/06|barcelona|MID|CAM,CM|76,80,90,90,64,72|P|Won two LaLiga titles and the 2006 Champions League as Barcelona's playmaker.",
  'juan-roman-riquelme|2005/06|villarreal|MID|CAM|62,85,94,92,40,70|P|Led Villarreal to the Champions League semi-finals in 2005/06.',
  'gabi|2013/14|atletico|MID|CDM,CM|68,68,82,76,82,80|P|Captained Atletico Madrid to the 2013/14 LaLiga title.',
  'luis-figo|1999/00|barcelona|FWD|RW,RM|88,85,88,94,42,76|P|',
  'lionel-messi|2011/12|barcelona|FWD|RW,CF,CAM|93,96,90,98,30,64|P|',
  'lionel-messi|2014/15|barcelona|FWD|RW,CF|88,94,92,97,32,68|P|',
  'ronaldo-nazario|1996/97|barcelona|FWD|ST|97,91,72,94,36,84|P|',
  'ronaldo-nazario|2002/03|real-madrid|FWD|ST|88,94,74,92,34,80|P|',
  'cristiano-ronaldo|2013/14|real-madrid|FWD|LW,ST|92,95,82,91,34,84|P|',
  'ronaldinho|2004/05|barcelona|FWD|LW,CAM|88,88,90,98,36,80|P|',
  'rivaldo|1998/99|barcelona|FWD|LW,CAM,CF|82,92,86,90,40,82|P|',
  'raul|2000/01|real-madrid|FWD|ST,CF|84,92,82,90,42,74|P|',
  "samuel-eto-o|2005/06|barcelona|FWD|ST|93,89,70,86,36,78|P|LaLiga's top scorer with 26 goals as Barcelona won the league and the Champions League in 2005/06.",
  'david-villa|2010/11|barcelona|FWD|LW,ST|87,91,78,86,36,70|P|',
  'neymar|2014/15|barcelona|FWD|LW|93,90,82,97,32,64|P|',
  'antoine-griezmann|2015/16|atletico|FWD|ST,CF|86,88,82,88,52,74|P|',
  "luis-suarez|2015/16|barcelona|FWD|ST|84,94,82,88,46,84|P|LaLiga's top scorer with 40 goals in 2015/16.",
  'karim-benzema|2021/22|real-madrid|FWD|ST,CF|78,94,86,90,40,80|P|',
  /* -------------------------------------------------------------- Serie A */
  'lothar-matthaus|1988/89|inter|MID|CM,CDM|80,86,86,82,78,84|P|',
  'marco-van-basten|1988/89|milan|FWD|ST|84,95,80,90,40,86|P|',
  'ruud-gullit|1988/89|milan|MID|CAM,CM,ST|82,84,86,88,68,88|P|',
  'roberto-baggio|1992/93|juventus|FWD|CF,CAM|86,92,88,95,34,64|P|',
  'franco-baresi|1993/94|milan|DEF|CB|70,48,78,72,93,80|-|',
  'paolo-maldini|1993/94|milan|DEF|LB,CB|84,56,78,76,90,82|P|',
  'marcel-desailly|1993/94|milan|DEF|CB,CDM|80,56,72,68,86,88|P|',
  'gabriel-batistuta|1994/95|fiorentina|FWD|ST|86,95,70,80,40,90|P|Serie A top scorer in 1994/95, scoring in eleven consecutive league matches.',
  'george-weah|1995/96|milan|FWD|ST|93,88,74,88,40,86|P|',
  "didier-deschamps|1996/97|juventus|MID|CDM,CM|72,62,86,80,86,80|P|Won three Serie A titles and the 1996 Champions League in Juventus' midfield.",
  'zinedine-zidane|1997/98|juventus|MID|CAM,CM|78,84,92,94,54,82|P|',
  "alessandro-del-piero|1997/98|juventus|FWD|CF,LW|84,90,86,92,34,64|P|Juventus' record appearance-maker and goalscorer.",
  'gianluca-zambrotta|2005/06|juventus|DEF|RB,LB,RWB|84,56,78,80,83,78|P|',
  'ronaldo-nazario|1997/98|inter|FWD|ST|97,91,74,95,34,82|P|',
  'alessandro-nesta|1999/00|lazio|DEF|CB|84,40,74,74,90,82|P|',
  "juan-sebastian-veron|1999/00|lazio|MID|CM,CAM|70,82,90,84,66,78|P|Conducted Lazio's midfield to the 1999/2000 Serie A title.",
  'cafu|2000/01|roma|DEF|RB,RWB|88,66,82,84,80,82|P|',
  'francesco-totti|2000/01|roma|FWD|CAM,CF|78,89,90,91,38,76|P|',
  'gianluigi-buffon|2002/03|juventus|GK|GK|91,88,72,56,91,84|P|',
  'lilian-thuram|2002/03|juventus|DEF|CB,RB|82,48,70,72,87,86|P|',
  'pavel-nedved|2002/03|juventus|MID|LM,CAM,CM|84,88,86,88,62,82|P|',
  "dida|2002/03|milan|GK|GK|89,82,68,48,85,90|P|Won two Champions Leagues as Milan's goalkeeper, saving three penalties in the 2003 final shoot-out.",
  'paolo-maldini|2002/03|milan|DEF|CB,LB|72,50,76,70,91,82|-|',
  'alessandro-nesta|2003/04|milan|DEF|CB|82,42,76,74,92,82|P|',
  'andriy-shevchenko|2003/04|milan|FWD|ST|90,94,74,88,36,80|P|',
  'andrea-pirlo|2006/07|milan|MID|CDM,CM|66,80,96,88,66,70|P|',
  'kaka|2006/07|milan|MID|CAM|92,88,88,93,50,80|P|',
  'clarence-seedorf|2006/07|milan|MID|CM,CAM,LM|72,80,86,86,62,82|-|The only player to win the Champions League with three different clubs: Ajax, Real Madrid and Milan.',
  'daniele-de-rossi|2006/07|roma|MID|CDM,CM|72,78,82,76,82,84|P|Played eighteen seasons for Roma, the club he went on to captain.',
  'zlatan-ibrahimovic|2008/09|inter|FWD|ST|78,90,82,90,40,90|P|Serie A top scorer with Inter in 2008/09 and with Milan in 2011/12.',
  "julio-cesar|2009/10|inter|GK|GK|89,84,76,56,86,80|P|Kept goal for Inter's 2009/10 treble-winning side.",
  "lucio|2009/10|inter|DEF|CB|76,60,70,72,87,86|P|Centre-back of Inter's 2009/10 treble-winning side.",
  'javier-zanetti|2009/10|inter|DEF|RB,CDM,LB|76,60,80,80,82,80|-|Captained Inter to the 2009/10 treble and made a club-record 858 appearances.',
  'walter-samuel|2009/10|inter|DEF|CB|66,44,60,56,89,92|-|',
  'maicon|2009/10|inter|DEF|RB,RWB|90,70,80,82,76,82|P|',
  "wesley-sneijder|2009/10|inter|MID|CAM|72,86,93,88,54,72|P|Playmaker of Inter's 2009/10 treble-winning side.",
  'diego-milito|2009/10|inter|FWD|ST|80,92,74,86,36,78|P|Scored in the Coppa Italia final, the Serie A title decider and the Champions League final as Inter won the 2010 treble.',
  // Milan, after the Barcelona peak: the trickery intact, the burst gone.
  'ronaldinho|2009/10|milan|FWD|LW,CAM|80,84,88,95,34,76|-|',
  'andrea-pirlo|2011/12|juventus|MID|CDM,CM|58,78,96,86,62,70|-|',
  'giorgio-chiellini|2014/15|juventus|DEF|CB,LB|74,48,64,60,90,90|P|Won nine consecutive Serie A titles with Juventus.',
  'gonzalo-higuain|2015/16|napoli|FWD|ST|80,95,74,86,36,80|P|Set the Serie A single-season record with 36 goals in 2015/16.',
  'gianluigi-buffon|2016/17|juventus|GK|GK|86,88,70,40,90,82|-|',
  'cristiano-ronaldo|2018/19|juventus|FWD|LW,ST|85,93,81,86,34,80|-|',

  /* ----------------------------------------------------------- Bundesliga */
  'matthias-sammer|1995/96|dortmund|DEF|CB,CDM|74,72,86,80,88,80|P|',
  'oliver-kahn|2000/01|bayern|GK|GK|92,88,70,50,91,88|P|',
  "bixente-lizarazu|2000/01|bayern|DEF|LB,LWB|86,56,78,80,84,74|-|Won six Bundesliga titles as Bayern Munich's left-back.",
  'stefan-effenberg|2000/01|bayern|MID|CM,CDM|68,84,88,80,74,82|-|Captained Bayern Munich to the 2001 Champions League title.',
  'michael-ballack|2001/02|leverkusen|MID|CM,CAM|76,88,84,80,72,86|P|German Footballer of the Year in 2002, the season Leverkusen finished runners-up in the Bundesliga, the DFB-Pokal and the Champions League.',
  'grafite|2008/09|wolfsburg|FWD|ST|82,88,68,82,34,84|P|Bundesliga top scorer with 28 goals as Wolfsburg won the 2008/09 title.',
  "edin-dzeko|2008/09|wolfsburg|FWD|ST|80,86,76,80,36,88|P|Scored 26 Bundesliga goals as Wolfsburg won the 2008/09 title, then led the league's scoring in 2009/10.",
  "mats-hummels|2011/12|dortmund|DEF|CB|70,56,82,74,87,82|P|Won back-to-back Bundesliga titles at the heart of Dortmund's defence, in 2010/11 and 2011/12.",
  'lukasz-piszczek|2011/12|dortmund|DEF|RB,RWB|84,58,76,76,80,78|P|',
  'neven-subotic|2011/12|dortmund|DEF|CB|74,40,62,58,84,86|P|',
  'shinji-kagawa|2011/12|dortmund|MID|CAM,CM|82,80,86,90,50,64|P|',
  'philipp-lahm|2012/13|bayern|DEF|RB,LB,CDM|84,60,86,84,89,70|P|',
  "bastian-schweinsteiger|2012/13|bayern|MID|CM,CDM|72,80,88,82,76,82|P|Won eight Bundesliga titles in Bayern Munich's midfield.",
  'franck-ribery|2012/13|bayern|FWD|LW,LM|91,84,88,95,40,70|P|',
  'arjen-robben|2012/13|bayern|FWD|RW|92,88,82,92,34,66|P|Scored the winner in the 2013 Champions League final and won eight Bundesliga titles with Bayern.',
  'manuel-neuer|2013/14|bayern|GK|GK|90,87,90,74,90,86|P|',
  'toni-kroos|2013/14|bayern|MID|CM|62,82,93,84,66,74|P|',
  'marco-reus|2013/14|dortmund|FWD|LW,CAM|90,86,84,88,40,64|P|Twice German Footballer of the Year, in 2012 and 2019.',
  'pierre-emerick-aubameyang|2016/17|dortmund|FWD|ST,LW|96,89,70,82,34,76|P|Bundesliga top scorer with 31 goals for Dortmund in 2016/17.',
  'robert-lewandowski|2019/20|bayern|FWD|ST|80,97,80,87,42,86|P|',

  /* -------------------------------------------------------------- Ligue 1 */
  'jean-pierre-papin|1990/91|marseille|FWD|ST|86,95,70,86,36,82|P|',
  'rai|1993/94|psg|MID|CAM,CM|74,86,88,84,50,80|P|Playmaker of the Paris Saint-Germain side that won the 1993/94 league title.',
  'juninho-pernambucano|2004/05|lyon|MID|CM,CAM|70,90,90,84,56,70|P|Free-kick specialist who won seven consecutive Ligue 1 titles with Lyon.',
  'michael-essien|2004/05|lyon|MID|CM,CDM|80,72,78,78,80,86|P|',
  'karim-benzema|2007/08|lyon|FWD|ST|84,86,76,86,32,74|-|',
  'anthony-reveillere|2007/08|lyon|DEF|RB|80,56,76,74,78,76|P|',
  'hugo-lloris|2009/10|lyon|GK|GK|88,80,72,62,82,74|-|',
  "eden-hazard|2011/12|lille|FWD|LW,CAM|90,80,84,93,34,62|-|Twice Ligue 1 Player of the Year and the driving force of Lille's 2010/11 double.",
  "thiago-silva|2015/16|psg|DEF|CB|80,52,78,76,88,80|P|Won four consecutive Ligue 1 titles at the heart of Paris Saint-Germain's defence, from 2012/13 to 2015/16.",
  'maxwell|2015/16|psg|DEF|LB,LWB|72,56,80,80,78,72|-|',
  'zlatan-ibrahimovic|2015/16|psg|FWD|ST|72,92,84,88,40,88|-|Ligue 1 top scorer with 38 goals for Paris Saint-Germain in 2015/16.',
  'edinson-cavani|2016/17|psg|FWD|ST|84,90,72,80,52,84|P|Ligue 1 top scorer with 35 goals for Paris Saint-Germain in 2016/17.',
  'neymar|2017/18|psg|FWD|LW|94,92,88,98,32,66|P|',
  'marco-verratti|2017/18|psg|MID|CM,CDM|70,62,91,91,78,70|P|Won nine Ligue 1 titles in eleven seasons with Paris Saint-Germain.',
  'kylian-mbappe|2021/22|psg|FWD|ST,LW|96,90,84,92,36,76|P|',
  'lionel-messi|2022/23|psg|FWD|RW,CAM,CF|78,88,92,93,34,64|-|',

  /* -------------------------------------------------------- Other leagues */
  // Seasons here are calendar years. Garrincha's 1962: the year of his second
  // World Cup, at Botafogo, where he spent his whole peak.
  'garrincha|1962|botafogo|FWD|RW,RM|94,86,82,98,30,70|P|',
];

export const LEGEND_IDENTITIES: LegendIdentity[] = IDENTITY_ROWS.map(parseIdentity);

export const LEGEND_IDENTITY_BY_ID = new Map(LEGEND_IDENTITIES.map((i) => [i.id, i]));

/** Every historical version, in authoring order. */
export const LEGEND_PLAYERS: Player[] = VERSION_ROWS.map((row) => parseVersion(row, LEGEND_IDENTITY_BY_ID));
