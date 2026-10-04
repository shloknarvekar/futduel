/**
 * Shirt numbers, for card art.
 *
 * A number is recorded only when it is known for the specific version a card
 * describes. Anything uncertain is left out, and the card art then shows no
 * number at all rather than a guess. `npm run verify` fails on any key that
 * does not name a real card.
 *
 * ## Current squads (2025/26)
 *
 * Taken from the 2025/26 first-team squad lists: Arsenal's official
 * announcement and the 2025–26 season squad tables on Wikipedia for Manchester
 * City, Liverpool, Chelsea, Manchester United, Tottenham, Newcastle, Real
 * Madrid, Barcelona, Atletico Madrid, Inter, Milan, Juventus, Napoli, Bayern,
 * Dortmund and Paris Saint-Germain. A player in FutDuel's snapshot who does not
 * appear in his club's 2025/26 list (a mid-season departure, or a transfer the
 * snapshot predates) has no number here. Clubs outside that list are not yet
 * sourced and carry no numbers.
 *
 * ## Historical versions
 *
 * The number worn in that season, which is not always the number a player is
 * best known for: Ronaldo Nazario wore 10 at Inter in 1997/98, because Ivan
 * Zamorano held 9, and 11 in his first season at Real Madrid. Before fixed
 * squad numbers (Serie A and LaLiga from 1995/96, Ligue 1 later still), shirts
 * were numbered by position each match; for those seasons the entry is the
 * shirt the player routinely wore in his role, and it is omitted where that
 * varied.
 */

export const CURRENT_SHIRT_NUMBERS: Record<string, number> = {
  // Manchester City
  'ruben-dias': 3, 'tijjani-reijnders': 4, 'omar-marmoush': 7, 'erling-haaland': 9,
  'rayan-cherki': 10, 'rayan-ait-nouri': 21, 'josko-gvardiol': 24, 'gianluigi-donnarumma': 25,
  savinho: 26, 'phil-foden': 47,
  // Arsenal (Eberechi Eze joined after the club's announcement and is not listed)
  'david-raya': 1, 'william-saliba': 2, 'cristhian-mosquera': 3, 'gabriel-magalhaes': 6, 'bukayo-saka': 7,
  'martin-odegaard': 8, 'gabriel-martinelli': 11, 'jurrien-timber': 12, 'viktor-gyokeres': 14,
  'noni-madueke': 20, 'kai-havertz': 29, 'martin-zubimendi': 36, 'declan-rice': 41,
  // Liverpool
  alisson: 1, 'virgil-van-dijk': 4, 'ibrahima-konate': 5, 'milos-kerkez': 6, 'florian-wirtz': 7,
  'alexander-isak': 9, 'alexis-mac-allister': 10, 'mohamed-salah': 11, 'giovanni-leoni': 15, 'cody-gakpo': 18,
  'hugo-ekitike': 22, 'andrew-robertson': 26, 'jeremie-frimpong': 30, 'ryan-gravenberch': 38,
  // Chelsea
  'robert-sanchez': 1, 'marc-cucurella': 3, 'levi-colwill': 6, 'pedro-neto': 7, 'enzo-fernandez': 8,
  'liam-delap': 9, 'cole-palmer': 10, 'joao-pedro': 20, 'jorrel-hato': 21, 'moises-caicedo': 25,
  'malo-gusto': 27, 'wesley-fofana': 29, estevao: 41, 'alejandro-garnacho': 49,
  // Manchester United
  'diogo-dalot': 2, 'matthijs-de-ligt': 4, 'lisandro-martinez': 6, 'bruno-fernandes': 8, 'matheus-cunha': 10,
  'amad-diallo': 16, 'bryan-mbeumo': 19, 'andre-onana': 24, 'manuel-ugarte': 25, 'benjamin-sesko': 30,
  'senne-lammens': 31, 'kobbie-mainoo': 37,
  // Tottenham Hotspur
  'guglielmo-vicario': 1, 'joao-palhinha': 6, 'xavi-simons': 7, 'yves-bissouma': 8, 'james-maddison': 10,
  'destiny-udogie': 13, 'cristian-romero': 17, 'dominic-solanke': 19, 'mohammed-kudus': 20,
  'dejan-kulusevski': 21, 'pedro-porro': 23, 'micky-van-de-ven': 37,
  // Newcastle United
  'nick-pope': 1, 'kieran-trippier': 2, 'sven-botman': 4, 'fabian-schar': 5, 'sandro-tonali': 8,
  'anthony-gordon': 10, 'malick-thiaw': 12, 'anthony-elanga': 20, 'nick-woltemade': 27, 'aaron-ramsdale': 32,
  'dan-burn': 33, 'bruno-guimaraes': 39,
  // Real Madrid
  'thibaut-courtois': 1, 'dani-carvajal': 2, 'eder-militao': 3, 'jude-bellingham': 5, 'vinicius-junior': 7,
  'federico-valverde': 8, 'kylian-mbappe': 10, rodrygo: 11, 'trent-alexander-arnold': 12,
  'aurelien-tchouameni': 14, 'arda-guler': 15, 'alvaro-carreras': 18, 'antonio-rudiger': 22,
  'ferland-mendy': 23, 'dean-huijsen': 24, 'franco-mastantuono': 30,
  // Barcelona
  'alejandro-balde': 3, 'ronald-araujo': 4, 'pau-cubarsi': 5, gavi: 6, pedri: 8, 'robert-lewandowski': 9,
  'lamine-yamal': 10, raphinha: 11, 'joan-garcia': 13, 'fermin-lopez': 16, 'roony-bardghji': 19,
  'frenkie-de-jong': 21, 'jules-kounde': 23,
  // Atletico Madrid
  'jose-gimenez': 2, 'matteo-ruggeri': 3, 'johnny-cardoso': 5, koke: 6, 'antoine-griezmann': 7,
  'alex-baena': 10, 'thiago-almada': 11, 'jan-oblak': 13, 'nahuel-molina': 16, 'david-hancko': 17,
  'julian-alvarez': 19, 'robin-le-normand': 24,
  // Inter
  'yann-sommer': 1, 'denzel-dumfries': 2, 'petar-sucic': 8, 'marcus-thuram': 9, 'lautaro-martinez': 10,
  'ange-yoan-bonny': 14, 'francesco-acerbi': 15, 'hakan-calhanoglu': 20, 'nicolo-barella': 23,
  'federico-dimarco': 32, 'alessandro-bastoni': 95,
  // Milan
  'pervis-estupinan': 2, 'rafael-leao': 10, 'christian-pulisic': 11, 'adrien-rabiot': 12, 'luka-modric': 14,
  'mike-maignan': 16, 'christopher-nkunku': 18, 'youssouf-fofana': 19, 'fikayo-tomori': 23, 'ardon-jashari': 30,
  // Juventus
  'gleison-bremer': 3, 'federico-gatti': 4, 'manuel-locatelli': 5, 'teun-koopmeiners': 8, 'dusan-vlahovic': 9,
  'kenan-yildiz': 10, 'edon-zhegrova': 11, 'khephren-thuram': 19, 'lois-openda': 20, 'andrea-cambiaso': 27,
  'jonathan-david': 30,
  // Napoli
  'alex-meret': 1, 'alessandro-buongiorno': 4, 'scott-mctominay': 8, 'romelu-lukaku': 9, 'kevin-de-bruyne': 11,
  'amir-rrahmani': 13, 'rasmus-hojlund': 19, 'giovanni-di-lorenzo': 22, 'sam-beukema': 31,
  'vanja-milinkovic-savic': 32, 'stanislav-lobotka': 68,
  // Bayern Munich
  'manuel-neuer': 1, 'dayot-upamecano': 2, 'kim-min-jae': 3, 'jonathan-tah': 4, 'joshua-kimmich': 6,
  'harry-kane': 9, 'jamal-musiala': 10, 'nicolas-jackson': 11, 'luis-diaz': 14, 'michael-olise': 17,
  'alphonso-davies': 19, 'aleksandar-pavlovic': 45,
  // Borussia Dortmund
  'gregor-kobel': 1, 'yan-couto': 2, 'waldemar-anton': 3, 'nico-schlotterbeck': 4, 'jobe-bellingham': 7,
  'felix-nmecha': 8, 'serhou-guirassy': 9, 'maximilian-beier': 14, 'julian-ryerson': 26, 'karim-adeyemi': 27,
  // Paris Saint-Germain
  'achraf-hakimi': 2, marquinhos: 5, 'illia-zabarnyi': 6, 'fabian-ruiz': 8, 'ousmane-dembele': 10,
  'desire-doue': 14, vitinha: 17, 'nuno-mendes': 25, 'bradley-barcola': 29, 'lucas-chevalier': 30,
  'warren-zaire-emery': 33, 'willian-pacho': 51,
  // Inter Miami
  'lionel-messi': 10,
};

export const LEGEND_SHIRT_NUMBERS: Record<string, number> = {
  /* ---------------------------------------------------------- Premier League */
  'peter-schmeichel-1998-99': 1, 'petr-cech-2004-05': 1, 'edwin-van-der-sar-2008-09': 1,
  'david-de-gea-2017-18': 1, 'hugo-lloris-2016-17': 1,
  'tony-adams-1997-98': 6, 'jaap-stam-1998-99': 6, 'denis-irwin-1998-99': 3, 'gary-neville-1998-99': 2,
  'rio-ferdinand-2007-08': 5, 'nemanja-vidic-2008-09': 15, 'john-terry-2004-05': 26,
  'ricardo-carvalho-2004-05': 6, 'ashley-cole-2003-04': 3, 'lauren-2003-04': 12, 'kolo-toure-2003-04': 28,
  'sol-campbell-2003-04': 23, 'vincent-kompany-2011-12': 4, 'jamie-carragher-2004-05': 23,
  'sami-hyypia-2004-05': 4,
  'patrick-vieira-2003-04': 4, 'roy-keane-1999-00': 16, 'paul-scholes-2002-03': 18, 'david-beckham-1998-99': 7,
  'claude-makelele-2004-05': 4, 'robert-pires-2001-02': 7, 'park-ji-sung-2008-09': 13,
  'steven-gerrard-2008-09': 8, 'frank-lampard-2004-05': 8, 'yaya-toure-2013-14': 42, 'david-silva-2011-12': 21,
  'kevin-de-bruyne-2019-20': 17, 'n-golo-kante-2015-16': 14,
  'ryan-giggs-1998-99': 11, 'eric-cantona-1995-96': 7, 'alan-shearer-1994-95': 9, 'thierry-henry-2003-04': 14,
  'dennis-bergkamp-1997-98': 10, 'cristiano-ronaldo-2007-08': 7, 'wayne-rooney-2009-10': 10,
  'kyle-walker-2017-18': 2,
  'didier-drogba-2009-10': 11, 'sergio-aguero-2011-12': 16, 'luis-suarez-2013-14': 7, 'mohamed-salah-2017-18': 11,
  'harry-kane-2017-18': 10, 'fernando-torres-2007-08': 9, 'gareth-bale-2012-13': 11, 'jamie-vardy-2015-16': 9,
  'riyad-mahrez-2015-16': 26, 'eden-hazard-2014-15': 10,

  /* ------------------------------------------------------------------ LaLiga */
  'iker-casillas-2007-08': 1, 'victor-valdes-2010-11': 1,
  'fernando-hierro-1997-98': 4, 'roberto-carlos-2002-03': 3, 'carles-puyol-2008-09': 5, 'gerard-pique-2010-11': 3,
  'dani-alves-2010-11': 2, 'eric-abidal-2010-11': 22, 'diego-godin-2013-14': 2, 'sergio-ramos-2016-17': 4,
  'fabio-cannavaro-2006-07': 5, 'marcelo-2016-17': 12,
  'pep-guardiola-1993-94': 4, 'fernando-redondo-1999-00': 6, 'xavi-2008-09': 6, 'andres-iniesta-2010-11': 8,
  'zinedine-zidane-2001-02': 5, 'luka-modric-2017-18': 10, 'sergio-busquets-2010-11': 16,
  'xabi-alonso-2011-12': 14, 'deco-2005-06': 20, 'juan-roman-riquelme-2005-06': 8, 'gabi-2013-14': 14,
  'luis-figo-1999-00': 7, 'lionel-messi-2011-12': 10, 'lionel-messi-2022-23': 30, 'kylian-mbappe-2021-22': 7, 'rodri-2023-24': 16, 'gianluca-zambrotta-2005-06': 19, 'lionel-messi-2014-15': 10,
  'ronaldo-nazario-1996-97': 9, 'ronaldo-nazario-2002-03': 11, 'cristiano-ronaldo-2013-14': 7,
  'ronaldinho-2004-05': 10, 'raul-2000-01': 7, 'samuel-eto-o-2005-06': 9, 'david-villa-2010-11': 7,
  'neymar-2014-15': 11, 'antoine-griezmann-2015-16': 7, 'luis-suarez-2015-16': 9, 'karim-benzema-2021-22': 9,

  /* ----------------------------------------------------------------- Serie A */
  'lothar-matthaus-1988-89': 10, 'marco-van-basten-1988-89': 9, 'ruud-gullit-1988-89': 10,
  'roberto-baggio-1992-93': 10,
  'franco-baresi-1993-94': 6, 'paolo-maldini-1993-94': 3, 'gabriel-batistuta-1994-95': 9, 'george-weah-1995-96': 9,
  'zinedine-zidane-1997-98': 21, 'alessandro-del-piero-1997-98': 10, 'ronaldo-nazario-1997-98': 10,
  'alessandro-nesta-1999-00': 13, 'francesco-totti-2000-01': 10,
  'gianluigi-buffon-2002-03': 1, 'lilian-thuram-2002-03': 21, 'pavel-nedved-2002-03': 11, 'dida-2002-03': 12,
  'paolo-maldini-2002-03': 3, 'alessandro-nesta-2003-04': 13, 'andriy-shevchenko-2003-04': 7,
  'andrea-pirlo-2006-07': 21, 'kaka-2006-07': 22, 'clarence-seedorf-2006-07': 10, 'daniele-de-rossi-2006-07': 16,
  'zlatan-ibrahimovic-2008-09': 8, 'julio-cesar-2009-10': 12, 'lucio-2009-10': 6, 'javier-zanetti-2009-10': 4,
  'walter-samuel-2009-10': 25, 'maicon-2009-10': 13, 'wesley-sneijder-2009-10': 10, 'diego-milito-2009-10': 22,
  // 80 at Milan, where 10 was Seedorf's.
  'ronaldinho-2009-10': 80,
  'andrea-pirlo-2011-12': 21, 'giorgio-chiellini-2014-15': 3, 'gonzalo-higuain-2015-16': 9,
  'gianluigi-buffon-2016-17': 1, 'cristiano-ronaldo-2018-19': 7,

  /* ----------------------------------------------------------- Other leagues */
  // Botafogo, before fixed squad numbers: the right winger's 7, which Garrincha
  // wore throughout his peak.
  'garrincha-1962': 7,

  /* -------------------------------------------------------------- Bundesliga */
  'oliver-kahn-2000-01': 1, 'bixente-lizarazu-2000-01': 3, 'stefan-effenberg-2000-01': 11,
  'michael-ballack-2001-02': 13, 'mats-hummels-2011-12': 15, 'lukasz-piszczek-2011-12': 26,
  'neven-subotic-2011-12': 4, 'shinji-kagawa-2011-12': 23, 'philipp-lahm-2012-13': 21,
  'bastian-schweinsteiger-2012-13': 31, 'franck-ribery-2012-13': 7, 'arjen-robben-2012-13': 10,
  'manuel-neuer-2013-14': 1, 'toni-kroos-2013-14': 39, 'marco-reus-2013-14': 11,
  'pierre-emerick-aubameyang-2016-17': 17, 'robert-lewandowski-2019-20': 9,

  /* ----------------------------------------------------------------- Ligue 1 */
  'jean-pierre-papin-1990-91': 9, 'rai-1993-94': 10, 'juninho-pernambucano-2004-05': 8, 'hugo-lloris-2009-10': 1,
  'eden-hazard-2011-12': 26, 'thiago-silva-2015-16': 2, 'zlatan-ibrahimovic-2015-16': 10,
  'edinson-cavani-2016-17': 9, 'neymar-2017-18': 10, 'marco-verratti-2017-18': 6,
};
