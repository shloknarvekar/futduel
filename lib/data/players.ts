import type { Attributes, Foot, Player, PlayerIdentity, Position, SlotRole } from '@/lib/domain/types';
import { CLUB_BY_ID } from './clubs';
import { nationMeta } from './nations';
import { LEGEND_PLAYERS, identitySlug } from './legends';
import { CURRENT_SHIRT_NUMBERS } from './shirt-numbers';
import { ratePlayer, ratingTier } from '@/lib/engine/player-rating';

/**
 * FutDuel squad snapshot — 2025/26 season, Europe's top five leagues.
 *
 * This file holds the current season. Historical versions — Icons, Heroes and
 * notable past seasons — are authored in `legends.ts` and joined to these rows
 * below, so `PLAYERS` is every playable card and `CURRENT_PLAYERS` is today.
 *
 * ## What is real here and what is not
 *
 * **Identity is real.** Name, club, league, nationality, position, age and an
 * indicative market value describe actual footballers and reflect the 2025
 * transfer windows.
 *
 * **Attributes are editorial.** The six values on each row are FutDuel gameplay
 * numbers, authored for balance. They are not measured from matches and are not
 * sourced from any provider or licensed game. The UI labels them as such.
 *
 * **Ratings are computed, never typed.** There is no rating column. Each
 * player's rating is derived from their attributes by the position-weighted
 * model in `lib/engine/player-rating.ts`, so it can be recalculated from source
 * and cannot drift from the attributes it claims to summarise.
 *
 * ## Row format
 *
 *   name[~shortName] | POS | roles | clubId | nation | age |
 *   pac,sho,pas,dri,def,phy | valueInMillions | foot
 *
 * Stored as compact pipe-delimited rows and expanded at import time: this keeps
 * the source diffable and roughly a fifth of the size of the object literal it
 * produces.
 *
 * Goalkeeper attributes reuse the six slots as
 *   reflexes, handling, kicking, speed, positioning, aerial.
 */

/** The season this snapshot describes. Surfaced in the UI. */
export const DATASET_SEASON = '2025/26';

/**
 * How current the roster is. Moves completed after this point are not
 * reflected unless listed in `SINCE_SNAPSHOT`, and the UI says so rather than
 * implying the squads are live.
 */
export const DATASET_AS_OF = 'Squads as of the 2025/26 season';

/**
 * Verified moves after the snapshot. These few current cards show the season
 * they describe instead of claiming a 2025/26 squad they were not in; the row
 * itself carries the new club and age. Each entry names its source, and nothing
 * joins this list on rumour. MLS plays calendar years, so Inter Miami's is one.
 */
export const SINCE_SNAPSHOT: Record<string, { season: string; source: string }> = {
  rodri: { season: '2026/27', source: 'Joined Barcelona from Manchester City in August 2026 (ESPN, Sky Sports).' },
  'james-trafford': { season: '2026/27', source: 'Joined Leeds United from Manchester City in August 2026 (Leeds United).' },
  'lionel-messi': { season: '2026', source: 'Inter Miami, under contract through the 2028 MLS season (Inter Miami CF).' },
};

const ROWS: string[] = [
  /* ---------------------------------------------------------------- Man City */
  'Ruben Dias|DEF|CB|man-city|Portugal|28|72,42,74,68,89,87|75|R',
  'Josko Gvardiol|DEF|CB,LB|man-city|Croatia|23|80,60,75,74,84,83|75|L',
  'Kevin De Bruyne|MID|CAM,CM|napoli|Belgium|34|68,88,94,86,62,76|40|R',
  'Phil Foden|MID|CAM,LW,CM|man-city|England|25|80,84,85,90,58,66|130|L',
  'Erling Haaland|FWD|ST|man-city|Norway|25|89,95,68,80,45,90|180|L',
  'Savinho|FWD|RW,LW|man-city|Brazil|21|89,72,78,87,38,62|55|L',

  /* ----------------------------------------------------------------- Arsenal */
  'David Raya|GK|GK|arsenal|Spain|30|83,84,86,50,85,79|40|R',
  'William Saliba|DEF|CB|arsenal|France|24|84,38,72,70,89,85|80|R',
  'Gabriel Magalhaes~Gabriel|DEF|CB|arsenal|Brazil|27|76,52,68,64,87,88|65|L',
  'Jurrien Timber|DEF|LB,RB,CB|arsenal|Netherlands|24|80,50,76,79,83,76|45|R',
  'Declan Rice|MID|CDM,CM|arsenal|England|26|76,74,84,80,86,88|110|R',
  'Martin Odegaard|MID|CAM,CM|arsenal|Norway|26|72,82,90,89,60,64|100|L',
  'Bukayo Saka|FWD|RW,RM|arsenal|England|24|85,84,85,89,55,70|140|L',
  'Gabriel Martinelli|FWD|LW,LM|arsenal|Brazil|24|92,78,74,85,42,68|60|R',
  'Kai Havertz|FWD|ST,CAM|arsenal|Germany|26|78,82,78,80,52,84|70|L',

  /* --------------------------------------------------------------- Liverpool */
  'Alisson|GK|GK|liverpool|Brazil|33|88,89,84,54,89,85|38|R',
  'Virgil van Dijk|DEF|CB|liverpool|Netherlands|34|76,60,74,72,90,90|30|R',
  'Ibrahima Konate|DEF|CB|liverpool|France|26|85,40,68,66,85,88|60|R',
  'Trent Alexander-Arnold~Alexander-Arnold|DEF|RB,RWB,CM|real-madrid|England|27|76,74,93,82,76,70|75|R',
  'Andrew Robertson|DEF|LB,LWB|liverpool|Scotland|31|80,60,84,80,80,74|30|L',
  'Alexis Mac Allister~Mac Allister|MID|CM,CAM|liverpool|Argentina|26|72,80,87,85,74,76|80|R',
  'Ryan Gravenberch|MID|CDM,CM|liverpool|Netherlands|23|78,68,80,84,76,80|55|L',
  'Mohamed Salah|FWD|RW,RM,ST|liverpool|Egypt|33|89,90,84,89,46,76|65|L',
  'Luis Diaz|FWD|LW,ST|bayern|Colombia|28|90,82,76,89,44,70|70|L',
  'Cody Gakpo|FWD|LW,ST|liverpool|Netherlands|26|82,82,78,84,44,80|55|R',

  /* ----------------------------------------------------------------- Chelsea */
  'Robert Sanchez|GK|GK|chelsea|Spain|28|78,76,80,48,78,82|18|R',
  'Levi Colwill|DEF|CB,LB|chelsea|England|22|74,40,74,70,82,80|45|L',
  'Wesley Fofana|DEF|CB|chelsea|France|24|86,36,66,68,82,80|30|R',
  'Marc Cucurella|DEF|LB,LWB|chelsea|Spain|27|80,52,78,80,80,74|35|L',
  'Malo Gusto|DEF|RB,RWB|chelsea|France|22|88,48,73,78,76,70|32|R',
  'Moises Caicedo|MID|CDM,CM|chelsea|Ecuador|24|80,64,80,80,86,86|85|R',
  'Enzo Fernandez|MID|CM,CAM|chelsea|Argentina|24|70,76,88,82,74,76|70|R',
  'Cole Palmer|MID|CAM,RW|chelsea|England|23|78,88,88,90,50,64|130|L',
  'Nicolas Jackson|FWD|ST|bayern|Senegal|24|92,79,66,80,38,76|55|R',
  'Pedro Neto|FWD|RW,LW|chelsea|Portugal|25|92,76,78,88,42,62|50|R',

  /* ------------------------------------------------------------- Man United */
  'Andre Onana|GK|GK|man-united|Cameroon|29|82,78,86,56,80,80|28|R',
  'Lisandro Martinez|DEF|CB,LB|man-united|Argentina|27|76,44,76,74,85,80|45|L',
  'Matthijs de Ligt~De Ligt|DEF|CB|man-united|Netherlands|26|74,48,72,68,86,88|45|R',
  'Diogo Dalot|DEF|RB,LB,RWB|man-united|Portugal|26|84,58,78,80,78,76|40|R',
  'Bruno Fernandes|MID|CAM,CM|man-united|Portugal|31|72,86,91,86,64,74|60|R',
  'Kobbie Mainoo|MID|CM,CDM|man-united|England|20|72,64,80,82,74,72|55|R',
  'Manuel Ugarte|MID|CDM|man-united|Uruguay|24|74,52,74,74,84,82|40|R',
  'Alejandro Garnacho~Garnacho|FWD|LW,RW|chelsea|Argentina|21|92,76,70,86,36,64|55|L',
  'Rasmus Hojlund|FWD|ST|napoli|Denmark|22|88,78,60,76,34,80|45|R',
  'Amad Diallo~Amad|FWD|RW,CAM|man-united|Ivory|23|84,74,78,86,42,60|35|L',

  /* --------------------------------------------------------------- Tottenham */
  'Guglielmo Vicario~Vicario|GK|GK|tottenham|Italy|29|84,80,76,52,82,78|30|R',
  'Cristian Romero|DEF|CB|tottenham|Argentina|27|80,52,74,70,87,86|60|R',
  'Micky van de Ven~Van de Ven|DEF|CB,LB|tottenham|Netherlands|24|95,38,68,70,84,82|60|L',
  'Pedro Porro|DEF|RB,RWB|tottenham|Spain|26|84,68,82,82,74,70|40|R',
  'Destiny Udogie|DEF|LB,LWB|tottenham|Italy|22|88,54,74,80,78,78|45|L',
  'James Maddison|MID|CAM,CM|tottenham|England|28|68,80,87,86,50,62|45|R',
  'Yves Bissouma|MID|CDM,CM|tottenham|Mali|29|76,58,76,78,80,80|22|R',
  'Dejan Kulusevski|MID|RM,CAM,RW|tottenham|Sweden|25|82,78,82,84,54,80|55|L',
  'Dominic Solanke|FWD|ST|tottenham|England|28|76,80,70,76,40,84|45|R',

  /* --------------------------------------------------------------- Newcastle */
  'Nick Pope|GK|GK|newcastle|England|33|82,80,66,44,82,84|14|R',
  'Sven Botman|DEF|CB|newcastle|Netherlands|25|76,42,70,66,84,84|38|L',
  'Fabian Schar|DEF|CB|newcastle|Switzerland|33|72,60,80,70,82,82|8|R',
  'Kieran Trippier|DEF|RB,RWB|newcastle|England|35|70,62,88,76,76,66|8|R',
  'Dan Burn|DEF|CB,LB|newcastle|England|33|60,38,60,54,80,86|6|L',
  'Bruno Guimaraes~Bruno G.|MID|CM,CDM|newcastle|Brazil|28|70,74,86,84,80,80|75|R',
  'Sandro Tonali|MID|CM,CDM|newcastle|Italy|25|72,72,84,80,80,80|45|R',
  'Anthony Gordon|FWD|LW,LM|newcastle|England|24|93,78,76,85,44,66|60|L',
  'Alexander Isak|FWD|ST|liverpool|Sweden|26|88,88,74,88,38,78|90|R',

  /* ------------------------------------------------------------- Aston Villa */
  'Emiliano Martinez~E. Martinez|GK|GK|aston-villa|Argentina|33|87,86,78,50,86,86|28|R',
  'Ezri Konsa|DEF|CB,RB|aston-villa|England|28|82,40,70,70,81,80|35|R',
  'Pau Torres|DEF|CB,LB|aston-villa|Spain|28|72,46,80,72,82,78|35|L',
  'Lucas Digne|DEF|LB,LWB|aston-villa|France|32|76,58,82,76,74,68|10|L',
  'Youri Tielemans|MID|CM,CDM|aston-villa|Belgium|28|66,78,86,80,74,74|30|R',
  'John McGinn|MID|CM,CAM|aston-villa|Scotland|31|76,74,78,78,72,80|22|R',
  'Morgan Rogers|MID|CAM,LW|aston-villa|England|23|82,72,76,82,44,76|35|R',
  'Ollie Watkins|FWD|ST|aston-villa|England|29|90,85,74,82,42,76|65|R',
  'Leon Bailey|FWD|RW,LW|roma|Jamaica|28|92,78,72,84,36,64|32|L',

  /* ---------------------------------------------------------------- Brighton */
  'Bart Verbruggen|GK|GK|brighton|Netherlands|23|78,76,80,50,77,76|22|R',
  'Lewis Dunk|DEF|CB|brighton|England|34|60,50,76,64,83,84|8|R',
  'Jan Paul van Hecke~Van Hecke|DEF|CB|brighton|Netherlands|25|74,38,72,68,79,78|30|R',
  'Pervis Estupinan|DEF|LB,LWB|milan|Ecuador|27|88,58,76,80,76,74|32|L',
  'Carlos Baleba|MID|CDM,CM|brighton|Cameroon|22|82,58,74,78,78,82|40|R',
  'Kaoru Mitoma|FWD|LW,LM|brighton|Japan|28|89,74,76,89,42,66|45|R',
  'Joao Pedro|FWD|ST,CAM|chelsea|Brazil|24|80,80,78,84,44,72|45|R',
  'Yankuba Minteh|FWD|RW|brighton|Gambia|21|94,70,66,82,34,60|28|L',

  /* ---------------------------------------------------------------- West Ham */
  'Alphonse Areola|GK|GK|west-ham|France|32|80,78,74,46,79,80|9|L',
  'Max Kilman|DEF|CB|west-ham|England|28|74,36,70,68,80,82|30|L',
  'Konstantinos Mavropanos~Mavropanos|DEF|CB|west-ham|Greece|27|76,34,64,62,78,82|18|R',
  'Aaron Wan-Bissaka~Wan-Bissaka|DEF|RB,RWB|west-ham|England|27|90,42,66,74,80,74|20|R',
  'Emerson Palmieri~Emerson|DEF|LB,LWB|west-ham|Italy|31|80,52,74,74,74,70|10|L',
  'Edson Alvarez|MID|CDM|west-ham|Mexico|28|72,52,72,70,82,84|22|R',
  'Lucas Paqueta|MID|CAM,CM|west-ham|Brazil|28|76,78,84,88,58,70|40|R',
  'Mohammed Kudus|FWD|RW,CAM|tottenham|Ghana|25|88,80,78,90,44,78|65|R',
  'Jarrod Bowen|FWD|RW,ST|west-ham|England|28|86,84,78,82,46,72|55|R',

  /* --------------------------------------------------------- Crystal Palace */
  'Dean Henderson|GK|GK|crystal-palace|England|28|80,76,78,48,77,76|14|R',
  'Marc Guehi|DEF|CB|crystal-palace|England|25|80,38,72,70,83,80|55|R',
  'Daniel Munoz|DEF|RB,RWB|crystal-palace|Colombia|29|86,52,72,74,76,80|20|R',
  'Tyrick Mitchell|DEF|LB|crystal-palace|England|26|88,40,66,72,74,68|14|L',
  'Adam Wharton|MID|CM,CDM|crystal-palace|England|21|64,62,84,80,76,70|45|R',
  'Eberechi Eze|MID|CAM,LW|arsenal|England|27|82,80,82,90,44,68|60|R',
  'Ismaila Sarr|FWD|RW,LW|crystal-palace|Senegal|27|92,74,68,82,38,72|20|R',
  'Jean-Philippe Mateta~Mateta|FWD|ST|crystal-palace|France|28|78,80,64,74,36,86|25|R',

  /* ----------------------------------------------------------------- Everton */
  'Jordan Pickford|GK|GK|everton|England|31|85,80,84,52,82,74|20|L',
  'James Tarkowski|DEF|CB|everton|England|33|64,42,66,60,82,84|8|R',
  'Jarrad Branthwaite|DEF|CB,LB|everton|England|23|80,38,70,68,82,84|50|L',
  'Vitalii Mykolenko~Mykolenko|DEF|LB,LWB|everton|Ukraine|26|82,44,70,74,76,72|18|L',
  'Idrissa Gueye|MID|CDM,CM|everton|Senegal|36|76,52,70,74,80,76|4|R',
  'Abdoulaye Doucoure|MID|CM,CAM|everton|Mali|33|72,72,74,76,68,80|8|R',
  'Dwight McNeil|MID|LM,LW|everton|England|26|78,72,80,80,44,64|22|L',
  'Iliman Ndiaye|FWD|LW,CAM|everton|Senegal|25|84,72,74,86,40,64|22|R',

  /* ------------------------------------------------------------ Real Madrid */
  'Thibaut Courtois|GK|GK|real-madrid|Belgium|33|90,90,80,46,90,90|30|L',
  'Antonio Rudiger~Rudiger|DEF|CB|real-madrid|Germany|32|82,46,72,68,87,88|25|R',
  'Eder Militao|DEF|CB|real-madrid|Brazil|27|88,44,70,70,85,86|55|R',
  'Ferland Mendy|DEF|LB,LWB|real-madrid|France|30|86,48,72,78,80,78|20|L',
  'Dani Carvajal|DEF|RB,RWB|real-madrid|Spain|33|80,64,82,80,84,80|18|R',
  'Aurelien Tchouameni~Tchouameni|MID|CDM,CM|real-madrid|France|25|72,66,80,76,85,88|80|R',
  'Federico Valverde|MID|CM,RM,CDM|real-madrid|Uruguay|27|88,84,86,84,80,88|130|R',
  'Luka Modric|MID|CM,CAM|milan|Croatia|40|64,76,89,88,66,62|8|R',
  'Jude Bellingham|MID|CAM,CM|real-madrid|England|22|80,86,86,88,72,86|180|R',
  'Vinicius Junior~Vinicius Jr|FWD|LW,ST|real-madrid|Brazil|25|95,88,80,94,32,72|200|R',
  'Kylian Mbappe|FWD|ST,LW|real-madrid|France|26|97,92,80,92,36,80|180|R',
  'Rodrygo|FWD|RW,LW,ST|real-madrid|Brazil|24|90,82,80,89,40,66|110|R',
  'Arda Guler|MID|CAM,RW|real-madrid|Turkey|20|74,78,84,86,40,58|40|L',
  'Endrick|FWD|ST|real-madrid|Brazil|19|88,76,60,80,30,72|40|L',

  /* -------------------------------------------------------------- Barcelona */
  'Marc-Andre ter Stegen~Ter Stegen|GK|GK|barcelona|Germany|33|88,86,88,52,86,80|22|R',
  'Ronald Araujo|DEF|CB,RB|barcelona|Uruguay|26|88,44,68,70,86,88|60|R',
  'Pau Cubarsi|DEF|CB|barcelona|Spain|18|80,32,84,78,84,75|60|R',
  // Moved after the snapshot (see SINCE_SNAPSHOT): age as of the 2026/27 season.
  'Rodri|MID|CDM,CM|barcelona|Spain|30|66,80,88,82,86,86|65|R',
  'Alejandro Balde~Balde|DEF|LB,LWB|barcelona|Spain|22|94,48,72,80,74,66|45|L',
  'Jules Kounde|DEF|RB,CB|barcelona|France|26|88,46,76,76,86,80|60|R',
  'Frenkie de Jong~De Jong|MID|CM,CDM|barcelona|Netherlands|28|76,72,88,90,74,78|60|R',
  'Pedri|MID|CM,CAM|barcelona|Spain|22|74,76,90,90,62,62|110|R',
  'Gavi|MID|CM,CAM|barcelona|Spain|21|76,68,82,84,70,72|60|R',
  'Fermin Lopez~Fermin|MID|CAM,CM|barcelona|Spain|22|78,76,80,84,54,66|40|R',
  'Raphinha|FWD|RW,LW|barcelona|Brazil|28|86,84,86,88,48,68|70|L',
  'Robert Lewandowski~Lewandowski|FWD|ST|barcelona|Poland|37|72,92,76,82,42,84|20|R',
  'Lamine Yamal|FWD|RW|barcelona|Spain|18|92,90,91,97,38,62|180|L',

  /* ------------------------------------------------------- Atletico Madrid */
  'Jan Oblak|GK|GK|atletico|Slovenia|32|88,86,72,46,87,84|22|R',
  'Jose Gimenez~Gimenez|DEF|CB|atletico|Uruguay|30|76,44,68,64,86,86|30|R',
  'Robin Le Normand~Le Normand|DEF|CB|atletico|Spain|28|76,40,74,68,84,80|32|R',
  'Nahuel Molina|DEF|RB,RWB|atletico|Argentina|27|86,54,74,76,76,74|22|R',
  'Koke|MID|CM,CDM|atletico|Spain|33|62,68,84,78,76,72|8|R',
  'Antoine Griezmann|FWD|CF,CAM,ST|atletico|France|34|76,86,88,86,56,68|30|L',
  'Julian Alvarez|FWD|ST,CF|atletico|Argentina|25|86,86,80,88,50,74|90|R',

  /* --------------------------------------------------------- Athletic Club */
  'Unai Simon|GK|GK|athletic|Spain|28|83,80,80,50,82,80|25|R',
  'Dani Vivian|DEF|CB|athletic|Spain|26|80,36,70,66,80,78|30|R',
  'Yuri Berchiche~Yuri|DEF|LB,LWB|athletic|Spain|35|74,50,76,74,74,70|4|L',
  'Mikel Vesga|MID|CDM,CM|athletic|Spain|32|58,58,76,68,76,80|4|R',
  'Oihan Sancet~Sancet|MID|CAM,CM|athletic|Spain|25|76,80,80,84,52,74|45|R',
  'Nico Williams|FWD|LW,RW|athletic|Spain|23|95,80,76,90,40,68|70|R',
  'Inaki Williams|FWD|RW,ST|athletic|Ghana|31|92,76,70,80,38,80|15|R',

  /* --------------------------------------------------------- Real Sociedad */
  'Alex Remiro~Remiro|GK|GK|real-sociedad|Spain|30|82,80,74,48,81,78|18|R',
  'Igor Zubeldia~Zubeldia|DEF|CB,CDM|real-sociedad|Spain|28|74,40,76,70,80,76|20|R',
  'Aritz Elustondo~Elustondo|DEF|CB,RB|real-sociedad|Spain|31|76,36,68,66,77,76|5|R',
  'Martin Zubimendi~Zubimendi|MID|CDM,CM|arsenal|Spain|26|68,62,86,80,82,78|60|R',
  'Brais Mendez~Brais|MID|CAM,CM|real-sociedad|Spain|28|72,76,84,82,58,70|30|R',
  'Takefusa Kubo~Kubo|FWD|RW,CAM|real-sociedad|Japan|24|84,76,80,89,42,60|55|L',
  'Mikel Oyarzabal~Oyarzabal|FWD|ST,LW|real-sociedad|Spain|28|80,82,80,84,46,72|35|R',

  /* ------------------------------------------------------------- Villarreal */
  'Diego Conde~Conde|GK|GK|villarreal|Spain|27|76,74,72,46,75,74|6|R',
  'Juan Foyth|DEF|RB,CB|villarreal|Argentina|27|84,40,72,74,80,78|30|R',
  'Logan Costa|DEF|CB|villarreal|Cameroon|24|80,36,66,64,78,80|18|R',
  'Dani Parejo|MID|CM,CDM|villarreal|Spain|36|54,76,88,78,72,68|4|R',
  'Alex Baena|MID|LM,CAM|atletico|Spain|24|78,76,86,86,50,64|45|L',
  'Ayoze Perez~Ayoze|FWD|ST,RW|villarreal|Spain|32|76,78,74,78,40,66|8|R',
  'Nicolas Pepe|FWD|RW,LW|villarreal|Ivory|30|86,76,70,84,32,66|8|L',

  /* ------------------------------------------------------------ Real Betis */
  'Rui Silva|GK|GK|betis|Portugal|31|80,76,76,46,78,76|8|R',
  'Diego Llorente|DEF|CB|betis|Spain|32|72,40,72,66,79,78|6|R',
  'Marc Bartra|DEF|CB|betis|Spain|34|70,42,76,70,77,72|3|R',
  'Johnny Cardoso~Cardoso|MID|CDM,CM|atletico|USA|24|72,58,78,76,79,80|25|R',
  'Isco|MID|CAM,CM|betis|Spain|33|64,78,88,88,50,62|10|R',
  'Giovani Lo Celso~Lo Celso|MID|CAM,CM|betis|Argentina|29|72,74,82,82,54,66|14|L',

  /* --------------------------------------------------------------- Sevilla */
  'Orjan Nyland~Nyland|GK|GK|sevilla|Norway|35|76,74,70,42,76,76|2|R',
  'Loic Bade~Bade|DEF|CB|leverkusen|France|25|82,34,66,64,80,82|22|R',
  'Kike Salas~Salas|DEF|CB,LB|sevilla|Spain|23|76,36,68,68,75,76|8|L',
  'Nemanja Gudelj~Gudelj|MID|CDM,CB|sevilla|Serbia|34|58,54,74,66,76,78|2|R',
  'Saul Niguez~Saul|MID|CM,CDM|sevilla|Spain|31|70,70,78,76,74,78|8|R',
  'Isaac Romero~Isaac|FWD|ST|sevilla|Spain|25|80,76,60,74,32,76|14|R',

  /* ------------------------------------------------------------------ Inter */
  'Yann Sommer|GK|GK|inter|Switzerland|37|86,84,78,44,84,72|6|L',
  'Alessandro Bastoni~Bastoni|DEF|CB,LB|inter|Italy|26|78,42,80,74,86,82|75|L',
  'Francesco Acerbi~Acerbi|DEF|CB|inter|Italy|37|64,44,70,62,84,82|2|L',
  'Federico Dimarco~Dimarco|DEF|LWB,LB|inter|Italy|28|82,74,86,82,76,70|45|L',
  'Denzel Dumfries|DEF|RWB,RB|inter|Netherlands|29|88,66,72,76,74,86|25|R',
  'Nicolo Barella~Barella|MID|CM,CAM|inter|Italy|28|80,80,86,86,76,80|85|R',
  'Hakan Calhanoglu~Calhanoglu|MID|CDM,CM|inter|Turkey|31|64,84,90,82,74,76|35|L',
  'Lautaro Martinez~Lautaro|FWD|ST|inter|Argentina|28|84,90,78,86,44,84|110|R',
  'Marcus Thuram|FWD|ST,LW|inter|France|28|88,84,74,84,42,88|75|R',

  /* -------------------------------------------------------------- AC Milan */
  'Mike Maignan|GK|GK|milan|France|30|88,86,84,54,87,84|35|R',
  'Fikayo Tomori~Tomori|DEF|CB|milan|England|27|88,38,68,68,83,82|30|R',
  'Malick Thiaw~Thiaw|DEF|CB|newcastle|Germany|24|80,34,68,66,79,82|22|R',
  'Youssouf Fofana~Fofana|MID|CDM,CM|milan|France|26|74,64,78,76,80,84|25|R',
  'Tijjani Reijnders~Reijnders|MID|CM,CAM|man-city|Netherlands|27|78,76,84,84,66,72|45|R',
  'Rafael Leao~Leao|FWD|LW,ST|milan|Portugal|26|94,82,76,90,32,80|85|R',
  'Christian Pulisic|FWD|RW,CAM,LW|milan|USA|27|86,82,84,88,44,64|60|R',
  'Alvaro Morata~Morata|FWD|ST|milan|Spain|33|76,80,70,76,40,80|12|R',

  /* -------------------------------------------------------------- Juventus */
  'Michele Di Gregorio~Di Gregorio|GK|GK|juventus|Italy|28|82,78,74,48,80,76|18|R',
  'Gleison Bremer~Bremer|DEF|CB|juventus|Brazil|28|82,44,68,66,87,88|55|R',
  'Federico Gatti~Gatti|DEF|CB|juventus|Italy|27|76,42,64,62,81,84|25|R',
  'Andrea Cambiaso~Cambiaso|DEF|LWB,LB,RWB|juventus|Italy|25|82,58,80,82,74,72|40|L',
  'Manuel Locatelli~Locatelli|MID|CDM,CM|juventus|Italy|27|66,70,84,76,76,78|25|R',
  'Khephren Thuram~K. Thuram|MID|CM,CDM|juventus|France|24|80,66,78,80,74,86|45|R',
  'Teun Koopmeiners~Koopmeiners|MID|CAM,CM|juventus|Netherlands|27|70,82,86,80,70,78|50|L',
  'Kenan Yildiz|FWD|LW,CAM|juventus|Turkey|20|84,76,78,86,36,64|40|R',
  'Dusan Vlahovic~Vlahovic|FWD|ST|juventus|Serbia|25|82,86,66,78,38,84|55|L',

  /* ---------------------------------------------------------------- Napoli */
  'Alex Meret~Meret|GK|GK|napoli|Italy|28|82,78,72,48,80,76|14|L',
  'Amir Rrahmani~Rrahmani|DEF|CB|napoli|Kosovo|31|76,42,70,66,82,82|14|R',
  'Alessandro Buongiorno~Buongiorno|DEF|CB,LB|napoli|Italy|26|80,38,70,68,84,84|40|L',
  'Giovanni Di Lorenzo~Di Lorenzo|DEF|RB,RWB|napoli|Italy|32|80,62,80,78,80,78|18|R',
  'Stanislav Lobotka~Lobotka|MID|CDM,CM|napoli|Slovakia|31|70,62,88,86,76,70|35|R',
  'Scott McTominay~McTominay|MID|CM,CAM|napoli|Scotland|29|72,78,72,74,70,86|28|R',
  'Khvicha Kvaratskhelia~Kvaratskhelia|FWD|LW|napoli|Georgia|24|88,82,82,93,38,74|85|R',
  'Romelu Lukaku~Lukaku|FWD|ST|napoli|Belgium|32|80,86,70,76,38,90|25|L',

  /* -------------------------------------------------------------- Atalanta */
  'Marco Carnesecchi~Carnesecchi|GK|GK|atalanta|Italy|25|84,78,72,50,79,76|25|R',
  'Isak Hien~Hien|DEF|CB|atalanta|Sweden|26|84,34,66,66,80,84|25|R',
  'Sead Kolasinac~Kolasinac|DEF|CB,LB|atalanta|Austria|32|70,44,70,68,78,84|5|L',
  'Matteo Ruggeri~Ruggeri|DEF|LWB,LB|atletico|Italy|23|86,54,74,78,74,72|25|L',
  'Marten de Roon~De Roon|MID|CDM,CM|atalanta|Netherlands|34|64,60,80,72,80,80|8|R',
  'Ederson Jose~Ederson S.|MID|CM,CDM|atalanta|Brazil|26|80,72,78,80,76,86|45|R',
  'Charles De Ketelaere~De Ketelaere|FWD|CAM,CF|atalanta|Belgium|24|80,78,82,84,44,74|35|R',
  'Ademola Lookman|FWD|LW,ST|atalanta|Nigeria|28|89,84,76,88,38,66|50|R',

  /* ------------------------------------------------------------------ Roma */
  'Mile Svilar~Svilar|GK|GK|roma|Serbia|26|83,78,74,50,79,76|22|R',
  'Evan Ndicka~Ndicka|DEF|CB,LB|roma|Ivory|26|82,36,68,66,82,82|28|L',
  'Gianluca Mancini~Mancini|DEF|CB|roma|Italy|29|72,48,70,64,81,82|18|R',
  'Angelino|DEF|LWB,LB|roma|Spain|28|84,64,80,80,72,68|20|L',
  'Bryan Cristante~Cristante|MID|CDM,CM|roma|Italy|30|64,64,78,72,76,80|12|R',
  'Lorenzo Pellegrini~Pellegrini|MID|CAM,CM|roma|Italy|29|72,78,84,82,58,70|20|R',
  'Paulo Dybala|FWD|CF,RW,CAM|roma|Argentina|32|76,86,86,90,40,60|22|L',
  'Artem Dovbyk~Dovbyk|FWD|ST|roma|Ukraine|28|80,82,64,74,34,84|30|R',

  /* ----------------------------------------------------------------- Lazio */
  'Ivan Provedel~Provedel|GK|GK|lazio|Italy|31|82,78,72,46,80,80|12|L',
  'Alessio Romagnoli~Romagnoli|DEF|CB|lazio|Italy|30|72,40,72,66,81,78|14|L',
  'Mario Gila~Gila|DEF|CB|lazio|Spain|25|80,34,70,68,79,76|22|R',
  'Nuno Tavares|DEF|LWB,LB|lazio|Portugal|25|92,54,70,78,70,76|18|L',
  'Matteo Guendouzi~Guendouzi|MID|CM,CDM|lazio|France|26|76,68,80,78,76,80|25|R',
  'Nicolo Rovella~Rovella|MID|CDM,CM|lazio|Italy|23|68,58,82,78,76,68|22|R',
  'Mattia Zaccagni~Zaccagni|FWD|LW,CAM|lazio|Italy|30|84,78,82,86,44,66|30|R',
  'Boulaye Dia~Dia|FWD|ST|lazio|Senegal|29|84,78,68,78,34,70|14|R',

  /* ----------------------------------------------------------- Fiorentina */
  'David de Gea~De Gea|GK|GK|fiorentina|Spain|35|85,82,64,44,83,78|4|R',
  'Pietro Comuzzo~Comuzzo|DEF|CB|fiorentina|Italy|20|78,32,66,64,78,76|20|R',
  'Robin Gosens~Gosens|DEF|LWB,LB|fiorentina|Germany|31|80,72,76,76,72,80|12|L',
  'Danilo Cataldi~Cataldi|MID|CDM,CM|fiorentina|Italy|31|62,62,80,72,74,72|6|R',
  'Rolando Mandragora~Mandragora|MID|CM,CDM|fiorentina|Italy|28|66,70,78,74,72,76|8|L',
  'Albert Gudmundsson~Gudmundsson|FWD|CAM,RW|fiorentina|Norway|28|80,80,80,86,40,68|25|L',
  'Moise Kean|FWD|ST|fiorentina|Italy|25|90,82,62,78,32,80|25|R',

  /* ------------------------------------------------------------ Bayern Munich */
  'Manuel Neuer|GK|GK|bayern|Germany|39|86,86,84,48,87,86|4|R',
  'Dayot Upamecano~Upamecano|DEF|CB|bayern|France|27|88,40,72,70,84,88|55|R',
  'Kim Min-jae~Kim|DEF|CB|bayern|South Korea|29|86,38,70,68,85,88|45|R',
  'Alphonso Davies|DEF|LB,LWB,LM|bayern|Canada|25|96,62,78,86,76,76|60|L',
  'Joshua Kimmich|MID|CM,CDM,RB|bayern|Germany|30|70,76,90,82,80,76|55|R',
  'Aleksandar Pavlovic~Pavlovic|MID|CDM,CM|bayern|Germany|21|70,58,82,78,76,72|40|R',
  'Jamal Musiala|MID|CAM,LW,CM|bayern|Germany|22|84,84,86,94,46,66|140|R',
  'Michael Olise|FWD|RW,CAM|bayern|France|23|86,86,90,92,42,66|75|L',
  'Harry Kane|FWD|ST,CF|bayern|England|32|70,94,86,84,50,84|90|R',

  /* --------------------------------------------------------- Bayer Leverkusen */
  'Lukas Hradecky~Hradecky|GK|GK|monaco|Finland|35|84,80,72,46,82,78|4|R',
  'Jonathan Tah~Tah|DEF|CB|bayern|Germany|29|82,38,72,68,85,88|35|R',
  'Piero Hincapie~Hincapie|DEF|CB,LB|leverkusen|Ecuador|23|84,36,72,72,82,80|40|L',
  'Alejandro Grimaldo~Grimaldo|DEF|LWB,LB|leverkusen|Spain|30|82,80,88,84,74,70|45|L',
  'Jeremie Frimpong~Frimpong|DEF|RWB,RB,RM|liverpool|Netherlands|25|95,70,74,86,70,70|45|R',
  'Florian Wirtz|MID|CAM,LW|liverpool|Germany|22|82,84,90,92,48,66|150|R',
  'Victor Boniface~Boniface|FWD|ST|leverkusen|Nigeria|25|84,84,70,82,34,88|50|R',
  'Patrik Schick~Schick|FWD|ST|leverkusen|Czechia|29|78,86,68,78,34,82|30|L',

  /* ----------------------------------------------------- Borussia Dortmund */
  'Gregor Kobel~Kobel|GK|GK|dortmund|Switzerland|28|87,84,76,50,84,82|40|R',
  'Nico Schlotterbeck~Schlotterbeck|DEF|CB,LB|dortmund|Germany|26|82,42,78,72,82,80|40|L',
  'Waldemar Anton~Anton|DEF|CB|dortmund|Germany|29|76,40,70,66,81,82|18|R',
  'Julian Ryerson~Ryerson|DEF|RB,LB,RWB|dortmund|Norway|28|84,50,72,74,78,80|18|R',
  'Pascal Gross~Gross|MID|CM,CAM|dortmund|Germany|34|60,74,86,78,70,70|10|R',
  'Felix Nmecha~Nmecha|MID|CM,CAM|dortmund|Germany|25|76,68,78,80,66,80|20|R',
  'Karim Adeyemi~Adeyemi|FWD|LW,ST|dortmund|Germany|23|96,76,70,86,32,64|35|R',
  'Serhou Guirassy~Guirassy|FWD|ST|dortmund|Guinea|29|82,88,68,78,36,86|45|R',
  'Maximilian Beier~Beier|FWD|ST,LW|dortmund|Germany|22|88,78,68,80,34,72|30|R',

  /* --------------------------------------------------------------- RB Leipzig */
  'Peter Gulacsi~Gulacsi|GK|GK|leipzig|Hungary|35|83,80,74,44,81,78|5|R',
  'Willi Orban~Orban|DEF|CB|leipzig|Hungary|32|74,44,72,66,82,84|10|R',
  'Castello Lukeba~Lukeba|DEF|CB,LB|leipzig|France|22|84,34,72,72,81,78|35|L',
  'David Raum~Raum|DEF|LWB,LB|leipzig|Germany|27|84,62,86,80,74,70|30|L',
  'Xaver Schlager~Schlager|MID|CM,CDM|leipzig|Austria|28|76,66,80,78,78,80|25|R',
  'Xavi Simons|MID|CAM,LW|tottenham|Netherlands|22|84,80,84,90,44,62|75|R',
  'Lois Openda~Openda|FWD|ST,LW|juventus|Belgium|25|95,84,68,84,34,72|60|R',
  'Benjamin Sesko~Sesko|FWD|ST|man-united|Slovenia|22|88,84,66,80,34,88|70|L',

  /* -------------------------------------------------------------- Stuttgart */
  'Alexander Nubel~Nubel|GK|GK|stuttgart|Germany|29|83,80,78,48,81,78|18|R',
  'Anthony Rouault~Rouault|DEF|CB|stuttgart|France|24|80,32,66,64,78,78|12|R',
  'Maximilian Mittelstadt~Mittelstadt|DEF|LB,LWB|stuttgart|Germany|28|80,58,80,78,74,72|18|L',
  'Angelo Stiller~Stiller|MID|CM,CDM|stuttgart|Germany|24|68,68,86,80,74,70|35|R',
  'Enzo Millot~Millot|MID|CAM,CM|stuttgart|France|23|78,74,80,84,50,68|25|R',
  'Nick Woltemade~Woltemade|FWD|ST,CF|newcastle|Germany|23|72,76,74,78,36,86|22|L',
  'Deniz Undav~Undav|FWD|ST,CF|stuttgart|Germany|29|78,84,78,82,38,74|30|R',

  /* --------------------------------------------------- Eintracht Frankfurt */
  'Robin Koch~Koch|DEF|CB|frankfurt|Germany|29|76,40,72,66,80,82|16|R',
  'Arthur Theate~Theate|DEF|CB,LB|frankfurt|Belgium|25|80,36,70,70,79,78|20|L',
  'Ellyes Skhiri~Skhiri|MID|CDM,CM|frankfurt|Tunisia|30|70,66,78,74,76,78|12|R',
  'Hugo Larsson~Larsson|MID|CM,CDM|frankfurt|Sweden|21|76,64,80,80,72,74|28|R',
  'Omar Marmoush~Marmoush|FWD|ST,LW|man-city|Egypt|26|92,84,76,86,36,76|60|R',
  'Hugo Ekitike~Ekitike|FWD|ST|liverpool|France|23|88,80,70,84,32,74|38|R',

  /* ---------------------------------------------------- Paris Saint-Germain */
  'Gianluigi Donnarumma~Donnarumma|GK|GK|man-city|Italy|26|88,84,74,50,86,88|40|R',
  'Marquinhos|DEF|CB|psg|Brazil|31|80,44,78,74,86,80|35|R',
  'Willian Pacho~Pacho|DEF|CB,LB|psg|Ecuador|24|84,34,72,70,84,82|45|L',
  'Nuno Mendes|DEF|LB,LWB|psg|Portugal|23|94,58,78,84,78,76|60|L',
  'Achraf Hakimi|DEF|RB,RWB|psg|Morocco|27|94,72,80,84,76,76|65|R',
  'Vitinha|MID|CM,CDM,CAM|psg|Portugal|25|78,76,88,88,72,68|75|R',
  'Warren Zaire-Emery~Zaire-Emery|MID|CM,CDM|psg|France|19|80,70,82,82,76,78|80|R',
  'Fabian Ruiz|MID|CM,CAM|psg|Spain|29|68,76,88,84,70,74|40|L',
  'Ousmane Dembele~Dembele|FWD|RW,LW,ST|psg|France|28|93,88,86,93,40,68|55|L',
  'Bradley Barcola~Barcola|FWD|LW,ST|psg|France|23|94,78,74,86,34,64|60|R',
  'Desire Doue~Doue|FWD|RW,CAM|psg|France|20|88,82,84,91,40,66|50|R',

  /* ------------------------------------------------------------ AS Monaco */
  'Philipp Kohn~Kohn|GK|GK|monaco|Switzerland|27|78,74,72,48,76,76|8|R',
  'Thilo Kehrer~Kehrer|DEF|CB,RB|monaco|Germany|29|80,38,72,70,79,80|14|R',
  'Wilfried Singo~Singo|DEF|RB,CB,RWB|monaco|Ivory|24|90,50,70,76,79,88|32|R',
  'Caio Henrique|DEF|LB,LWB|monaco|Brazil|28|82,58,78,78,72,70|18|L',
  'Denis Zakaria~Zakaria|MID|CDM,CM|monaco|Switzerland|29|76,66,78,76,80,88|30|R',
  'Maghnes Akliouche~Akliouche|MID|CAM,RW|monaco|France|23|84,74,80,88,42,64|38|R',
  'Eliesse Ben Seghir~Ben Seghir|MID|CAM,LW|leverkusen|Morocco|20|84,74,78,86,40,60|28|R',
  'Folarin Balogun~Balogun|FWD|ST|monaco|USA|24|88,78,66,80,32,72|30|R',

  /* --------------------------------------------------- Olympique Marseille */
  'Geronimo Rulli~Rulli|GK|GK|marseille|Argentina|33|82,78,76,46,80,78|8|R',
  'Leonardo Balerdi~Balerdi|DEF|CB|marseille|Argentina|26|80,36,68,66,79,80|18|R',
  'Derek Cornelius~Cornelius|DEF|CB,LB|marseille|Canada|28|78,32,64,62,77,80|8|L',
  'Quentin Merlin~Merlin|DEF|LB,LWB|marseille|France|23|82,52,74,76,72,68|12|L',
  'Pierre-Emile Hojbjerg~Hojbjerg|MID|CDM,CM|marseille|Denmark|30|66,68,82,74,80,82|20|R',
  'Adrien Rabiot~Rabiot|MID|CM,CDM|milan|France|30|76,74,82,80,74,84|22|R',
  'Mason Greenwood~Greenwood|FWD|RW,ST|marseille|England|24|86,84,74,84,34,72|35|L',
  'Amine Gouiri~Gouiri|FWD|ST,CF|marseille|Algeria|25|82,78,76,82,36,72|25|R',

  /* --------------------------------------------------------------- Lille */
  'Lucas Chevalier~Chevalier|GK|GK|psg|France|24|84,80,76,50,81,76|30|R',
  'Alexsandro Ribeiro~Alexsandro|DEF|CB|lille|Brazil|26|80,36,68,66,79,80|22|R',
  'Bafode Diakite~Diakite|DEF|CB,RB|lille|France|24|84,34,68,70,80,80|28|R',
  'Benjamin Andre~Andre|MID|CDM,CM|lille|France|35|62,60,78,72,78,76|3|R',
  'Ayyoub Bouaddi~Bouaddi|MID|CDM,CM|lille|France|18|72,54,76,76,74,68|18|R',
  'Edon Zhegrova~Zhegrova|FWD|RW,LW|juventus|Kosovo|26|88,76,74,88,32,62|25|L',
  'Jonathan David|FWD|ST|juventus|Canada|25|86,84,74,82,38,74|45|R',

  /* ------------------------------------------------------ Olympique Lyonnais */
  'Lucas Perri~Perri|GK|GK|lyon|Brazil|27|80,76,72,48,78,80|12|R',
  'Moussa Niakhate~Niakhate|DEF|CB|lyon|Senegal|29|76,38,68,64,79,82|14|L',
  'Nicolas Tagliafico~Tagliafico|DEF|LB,LWB|lyon|Argentina|33|80,52,76,76,78,74|8|L',
  'Corentin Tolisso~Tolisso|MID|CM,CDM|lyon|France|31|70,74,80,76,72,80|10|R',
  'Rayan Cherki~Cherki|MID|CAM,RW|man-city|France|22|80,76,84,90,36,62|35|L',

  /* ------------------------------------------------------------- OGC Nice */
  'Dante|DEF|CB|nice|Brazil|42|56,42,74,64,79,74|1|L',
  'Jean-Clair Todibo~Todibo|DEF|CB|west-ham|France|26|86,34,72,74,82,80|38|R',
  'Melvin Bard~Bard|DEF|LB,LWB|nice|France|25|80,48,74,76,74,68|12|L',
  'Morgan Sanson~Sanson|MID|CM,CAM|nice|France|31|68,68,78,76,68,72|5|R',
  'Hicham Boudaoui~Boudaoui|MID|CM,CDM|nice|Algeria|26|82,62,76,80,74,72|14|R',
  'Evann Guessand~Guessand|FWD|ST,LW|aston-villa|Ivory|24|86,76,68,80,34,80|22|R',
  'Gaetan Laborde~Laborde|FWD|ST|nice|France|31|76,78,70,76,36,78|8|R',
  /* ------------------------------------------------- 2025/26 arrivals ------ */
  /* Players who joined a top-five-league club in the 2025 windows, plus cover
     for the squads whose first-choice keeper left. */

  'Viktor Gyokeres~Gyokeres|FWD|ST|arsenal|Sweden|27|86,87,68,80,38,88|65|R',
  'Cristhian Mosquera~Mosquera|DEF|CB|arsenal|Spain|21|82,36,70,68,80,80|22|R',
  'Noni Madueke~Madueke|FWD|RW,LW|arsenal|England|23|88,78,74,86,38,66|48|L',
  'Rayan Ait-Nouri~Ait-Nouri|DEF|LB,LWB|man-city|Algeria|24|88,58,76,84,74,74|36|L',
  'James Trafford~Trafford|GK|GK|leeds|England|23|80,78,76,48,79,80|30|L',
  'Milos Kerkez~Kerkez|DEF|LB,LWB|liverpool|Hungary|22|90,52,76,80,76,74|40|L',
  'Giovanni Leoni~Leoni|DEF|CB|liverpool|Italy|19|80,32,68,66,79,80|26|R',
  'Matheus Cunha~Cunha|FWD|CF,CAM,LW|man-united|Brazil|26|84,80,80,88,40,78|62|R',
  'Bryan Mbeumo~Mbeumo|FWD|RW,ST|man-united|Cameroon|26|88,82,76,84,40,72|65|R',
  'Senne Lammens~Lammens|GK|GK|man-united|Belgium|23|82,78,74,48,79,82|22|R',
  'Liam Delap~Delap|FWD|ST|chelsea|England|22|86,78,64,78,36,84|38|R',
  'Estevao|FWD|RW,CAM|chelsea|Brazil|18|88,76,76,90,34,62|55|L',
  'Jorrel Hato~Hato|DEF|CB,LB|chelsea|Netherlands|19|80,34,76,74,80,74|40|L',
  'Joao Palhinha~Palhinha|MID|CDM|tottenham|Portugal|30|66,58,72,68,86,86|28|R',
  'Anthony Elanga~Elanga|FWD|RW,LW|newcastle|Sweden|23|93,72,70,82,36,66|60|R',
  'Aaron Ramsdale~Ramsdale|GK|GK|newcastle|England|27|80,78,74,46,78,78|18|L',
  'Jack Grealish~Grealish|FWD|LW,LM|everton|England|30|76,72,80,86,40,66|24|R',
  'Thierno Barry~Barry|FWD|ST|everton|France|23|84,76,60,76,32,86|28|R',
  'Charalampos Kostoulas~Kostoulas|FWD|ST|brighton|Greece|19|82,74,62,78,32,76|30|R',
  'Maxim De Cuyper~De Cuyper|DEF|LB,LWB|brighton|Belgium|25|80,56,78,78,74,72|22|L',
  'Mads Hermansen~Hermansen|GK|GK|west-ham|Denmark|25|80,76,74,48,78,76|20|R',
  'Victor Lindelof~Lindelof|DEF|CB|aston-villa|Sweden|31|74,38,72,66,79,78|6|R',
  'Dean Huijsen~Huijsen|DEF|CB|real-madrid|Spain|21|80,38,78,72,83,82|60|R',
  'Alvaro Carreras~Carreras|DEF|LB,LWB|real-madrid|Spain|23|86,52,76,78,78,76|45|L',
  'Franco Mastantuono~Mastantuono|MID|CAM,RW|real-madrid|Argentina|19|82,76,80,86,40,62|45|L',
  'Joan Garcia|GK|GK|barcelona|Spain|25|84,80,76,50,82,80|35|R',
  'Roony Bardghji~Bardghji|FWD|RW|barcelona|Sweden|20|84,72,74,84,34,62|12|L',
  'Thiago Almada~Almada|MID|CAM,LW|atletico|Argentina|25|82,78,82,86,44,66|45|L',
  'David Hancko~Hancko|DEF|CB,LB|atletico|Slovakia|28|80,44,76,72,83,82|30|L',
  'Georges Mikautadze~Mikautadze|FWD|ST,CF|villarreal|Georgia|25|82,80,72,82,36,72|32|R',
  'Renato Veiga~Veiga|DEF|CB,LB|villarreal|Portugal|22|80,42,74,72,80,80|28|L',
  'Thomas Partey~Partey|MID|CDM,CM|villarreal|Ghana|33|70,66,80,76,80,84|8|R',
  'Antony|FWD|RW,LW|betis|Brazil|26|84,78,78,88,38,64|30|R',
  'Cucho Hernandez~Cucho|FWD|ST,CF|betis|Colombia|27|80,78,72,80,36,76|18|L',
  'Ruben Vargas~Vargas|FWD|LW,RW|sevilla|Switzerland|27|84,74,74,82,38,66|14|R',
  'Carlos Soler~Soler|MID|CM,CAM|real-sociedad|Spain|29|72,76,82,80,66,72|14|L',
  'Petar Sucic~Sucic|MID|CM,CAM|inter|Croatia|22|76,70,82,84,66,72|30|R',
  'Ange-Yoan Bonny~Bonny|FWD|ST,CF|inter|France|22|82,76,72,80,36,82|28|R',
  'Christopher Nkunku~Nkunku|FWD|CF,CAM,ST|milan|France|28|84,82,80,86,42,70|38|R',
  'Ardon Jashari~Jashari|MID|CM,CDM|milan|Switzerland|23|76,66,80,78,76,76|34|R',
  'Sam Beukema~Beukema|DEF|CB|napoli|Netherlands|27|78,40,72,68,81,82|30|R',
  'Noa Lang~Lang|FWD|LW,CAM|napoli|Netherlands|26|86,74,76,86,38,64|28|R',
  'Vanja Milinkovic-Savic~Milinkovic-Savic|GK|GK|napoli|Serbia|28|82,78,76,46,80,88|20|R',
  'Nikola Krstovic~Krstovic|FWD|ST|atalanta|Montenegro|25|82,80,66,78,34,80|25|R',
  'Kamaldeen Sulemana~Sulemana|FWD|LW,RW|atalanta|Ghana|24|92,72,70,84,34,64|20|R',
  'Wesley Franca~Wesley|DEF|RWB,RB|roma|Brazil|22|88,58,74,80,74,78|25|R',
  'Evan Ferguson~Ferguson|FWD|ST|roma|Ireland|21|80,78,64,78,34,80|22|R',
  'Edin Dzeko~Dzeko|FWD|ST,CF|fiorentina|Bosnia|40|58,80,76,74,36,80|2|R',
  'Roberto Piccoli~Piccoli|FWD|ST|fiorentina|Italy|24|80,76,64,76,34,80|18|R',
  'Mark Flekken~Flekken|GK|GK|leverkusen|Netherlands|32|80,78,78,46,79,78|12|R',
  'Malik Tillman~Tillman|MID|CAM,CM|leverkusen|USA|23|80,78,80,84,48,70|35|R',
  'Jarell Quansah~Quansah|DEF|CB|leverkusen|England|22|82,36,72,70,81,82|35|R',
  'Ibrahim Maza~Maza|MID|CAM,CM|leverkusen|Algeria|20|80,72,78,82,52,68|18|L',
  'Jobe Bellingham~J. Bellingham|MID|CM,CDM|dortmund|England|20|78,70,78,78,72,80|32|R',
  'Yan Couto~Couto|DEF|RB,RWB|dortmund|Brazil|23|86,56,78,80,72,68|25|R',
  'Johan Bakayoko~Bakayoko|FWD|RW,LW|leipzig|Belgium|22|90,74,74,86,36,66|38|R',
  'Yan Diomande~Diomande|FWD|LW,RW|leipzig|Ivory|19|92,72,66,84,30,62|22|R',
  'Arthur Vermeeren~Vermeeren|MID|CDM,CM|leipzig|Belgium|20|74,60,80,78,76,70|22|R',
  'Bilal El Khannouss~El Khannouss|MID|CAM,CM|stuttgart|Morocco|21|78,74,82,86,48,66|25|L',
  'Tiago Tomas~Tomas|FWD|ST,LW|stuttgart|Portugal|23|84,74,70,80,34,72|18|R',
  'Michael Zetterer~Zetterer|GK|GK|frankfurt|Germany|30|80,76,72,46,78,78|8|R',
  'Jonathan Burkardt~Burkardt|FWD|ST|frankfurt|Germany|25|82,80,68,78,36,78|25|R',
  'Ritsu Doan~Doan|FWD|RW,LW|frankfurt|Japan|27|84,78,78,84,44,70|24|L',
  'Can Uzun~Uzun|MID|CAM|frankfurt|Turkey|20|78,76,78,84,42,66|25|R',
  'Illia Zabarnyi~Zabarnyi|DEF|CB|psg|Ukraine|23|82,34,72,68,83,82|60|R',
  'Paul Pogba~Pogba|MID|CM,CDM|monaco|France|32|66,72,80,78,68,80|5|R',
  'Eric Dier~Dier|DEF|CB|monaco|England|31|64,42,72,62,80,80|4|R',
  'Ansu Fati~Fati|FWD|LW,ST|monaco|Spain|23|82,76,72,84,32,64|12|R',
  'Pierre-Emerick Aubameyang~Aubameyang|FWD|ST,LW|marseille|Gabon|36|84,82,70,78,34,72|6|R',
  'Igor Paixao~Paixao|FWD|LW,RW|marseille|Brazil|25|88,76,76,86,36,66|30|R',
  'Facundo Medina~Medina|DEF|CB,LB|marseille|Argentina|26|80,38,72,70,80,80|22|L',
  'Angel Gomes~Gomes|MID|CM,CAM|marseille|England|25|74,70,82,84,56,60|14|R',
  'Nayef Aguerd~Aguerd|DEF|CB|marseille|Morocco|29|78,40,70,66,81,80|18|L',
  'Berke Ozer~Ozer|GK|GK|lille|Turkey|25|80,76,72,48,78,78|10|R',
  'Olivier Giroud~Giroud|FWD|ST,CF|lille|France|39|56,80,74,72,38,84|2|L',
  'Nathan Ngoy~Ngoy|DEF|CB|lille|Belgium|22|80,34,68,66,79,80|12|R',
  'Tyler Morton~Morton|MID|CM,CDM|lyon|England|22|74,64,80,78,74,70|18|R',
  'Afonso Moreira~Moreira|FWD|LW,RW|lyon|Portugal|20|86,70,70,82,32,64|12|R',
  'Yehvann Diouf~Diouf|GK|GK|nice|France|26|80,76,72,48,78,78|8|R',
  'Terem Moffi~Moffi|FWD|ST|nice|Nigeria|26|86,78,64,78,32,80|22|R',
  'Sofiane Diop~Diop|MID|CAM,LW|nice|France|25|82,74,78,84,44,66|18|R',
  'Jonathan Clauss~Clauss|DEF|RWB,RB|nice|France|33|82,62,78,76,72,72|10|R',
  'Mohamed-Ali Cho~Cho|FWD|RW,LW|nice|France|22|88,70,70,82,36,66|12|R',

  /* --------------------------------------- Outside the five leagues, current */
  // Inter Miami plays MLS calendar seasons (see SINCE_SNAPSHOT). Age on 1 January 2026.
  'Lionel Messi~Messi|FWD|RW,CAM,CF|inter-miami|Argentina|38|72,86,92,91,30,62|15|L',
];

function parseRow(row: string, index: number): Player {
  const parts = row.split('|');
  if (parts.length !== 9) {
    throw new Error(`Malformed player row at index ${index}: expected 9 fields, got ${parts.length}`);
  }
  const [rawName, pos, roles, clubId, nation, age, attrs, value, foot] = parts as [
    string, string, string, string, string, string, string, string, string,
  ];

  const [fullName, shortOverride] = rawName.split('~');
  const club = CLUB_BY_ID.get(clubId);
  if (!club) throw new Error(`Unknown club "${clubId}" for player "${fullName}"`);

  const [nationCode, continent] = nationMeta(nation, fullName!);

  const a = attrs.split(',').map(Number);
  if (a.length !== 6 || a.some((n) => Number.isNaN(n))) {
    throw new Error(`Malformed attributes for player "${fullName}"`);
  }

  const attributes: Attributes = {
    pace: a[0]!, shooting: a[1]!, passing: a[2]!, dribbling: a[3]!, defending: a[4]!, physical: a[5]!,
  };

  const name = fullName!;
  const position = pos as Position;
  // Derived, never authored. See lib/engine/player-rating.ts.
  const rating = ratePlayer(position, attributes);

  // A current record's id is its identity: the person as they are now. Any
  // historical version of the same person carries this id as `identityId`.
  const id = identitySlug(name);

  return {
    id,
    identityId: id,
    name,
    short: shortOverride ?? name.split(' ').slice(-1)[0]!,
    position,
    roles: roles.split(',') as SlotRole[],
    club: club.name,
    clubId,
    league: club.league,
    nation,
    nationCode,
    continent,
    age: Number(age),
    rating,
    attributes,
    value: Number(value),
    foot: foot as Foot,
    tier: ratingTier(rating),
    // Every row in this file describes a player as they are now. Historical
    // versions are separate records in legends.ts, never inferred from these.
    era: 'current',
    season: SINCE_SNAPSHOT[id]?.season ?? DATASET_SEASON,
    prime: false,
    cardType: 'standard',
    cardReason: null,
    shirtNumber: CURRENT_SHIRT_NUMBERS[id] ?? null,
  };
}

/** The 2025/26 snapshot only. Fantasy, fixtures and club strength read this. */
export const CURRENT_PLAYERS: Player[] = ROWS.map(parseRow);

export { LEGEND_PLAYERS };

/**
 * Every playable card, current season first. The order is part of the challenge
 * code format (squads travel as indices), so new records are appended.
 */
export const PLAYERS: Player[] = [...CURRENT_PLAYERS, ...LEGEND_PLAYERS];

export const PLAYER_BY_ID = new Map(PLAYERS.map((p) => [p.id, p]));

/** Real-world footballers, each with every version FutDuel holds of them. */
export const IDENTITIES: PlayerIdentity[] = (() => {
  const byId = new Map<string, PlayerIdentity>();
  for (const player of PLAYERS) {
    const existing = byId.get(player.identityId);
    if (existing) existing.versions.push(player);
    else {
      byId.set(player.identityId, {
        id: player.identityId,
        name: player.name,
        nation: player.nation,
        foot: player.foot,
        versions: [player],
      });
    }
  }
  for (const identity of byId.values()) {
    identity.versions.sort((a, b) => a.season.localeCompare(b.season));
  }
  return [...byId.values()];
})();

export const IDENTITY_BY_ID = new Map(IDENTITIES.map((i) => [i.id, i]));

/** Every version of one footballer, oldest season first. */
export function versionsOf(identityId: string): Player[] {
  return IDENTITY_BY_ID.get(identityId)?.versions ?? [];
}

export function getPlayer(id: string): Player | undefined {
  return PLAYER_BY_ID.get(id);
}

export function requirePlayer(id: string): Player {
  const p = PLAYER_BY_ID.get(id);
  if (!p) throw new Error(`Unknown player id: ${id}`);
  return p;
}
