// Competition definitions: domestic cups, continental club competitions, youth competitions,
// league play-offs. Dates are [month, day]; for Aug–May competitions months 7–12 fall in the
// first year of the season and 1–6 in the second. Where an official calendar was available it is
// used (UEFA 2026/27 dates from the club calendars published in August 2026); other dates follow
// each competition's usual pattern and are marked approximate in-game.

// domestic cups: single-leg knockout of the listed leagues; byes for the strongest clubs
export const CUPS = [
  { id: "FAC", name: "FA Cup", short: "FAC", nation: "ENG", leagues: ["ENG1", "ENG2"], color: "#d71920", dates: [[1, 9], [2, 13], [3, 6], [4, 3], [4, 24], [5, 22]] },
  { id: "CDR", name: "Copa del Rey", short: "CDR", nation: "ESP", leagues: ["ESP1", "ESP2"], color: "#c60b1e", dates: [[10, 28], [12, 2], [1, 13], [2, 3], [3, 3], [4, 24]] },
  { id: "CIT", name: "Coppa Italia", short: "CI", nation: "ITA", leagues: ["ITA1", "ITA2"], color: "#008c45", dates: [[8, 15], [10, 28], [12, 16], [1, 27], [3, 3], [5, 13]] },
  { id: "DFB", name: "DFB-Pokal", short: "DFB", nation: "GER", leagues: ["GER1", "GER2"], color: "#1a1a1a", dates: [[8, 15], [10, 28], [12, 2], [2, 3], [4, 21], [5, 29]] },
  { id: "CDF", name: "Coupe de France", short: "CDF", nation: "FRA", leagues: ["FRA1", "FRA2"], color: "#002395", dates: [[11, 18], [12, 19], [1, 20], [2, 10], [4, 7], [5, 15]] },
  { id: "IDC", name: "Piala Liga", short: "PL", nation: "IDN", leagues: ["IDN1"], color: "#b0141f", dates: [[11, 3], [12, 9], [2, 10], [3, 10], [4, 14]] },
  { id: "TDP", name: "Taça de Portugal", short: "TP", nation: "POR", leagues: ["POR1"], color: "#006633", dates: [[10, 21], [12, 2], [1, 13], [3, 3], [5, 23]] },
  { id: "KNV", name: "KNVB Beker", short: "KNVB", nation: "NED", leagues: ["NED1"], color: "#f36c21", dates: [[10, 28], [12, 16], [2, 10], [3, 3], [4, 18]] },
  { id: "BEK", name: "Beker van België", short: "BvB", nation: "BEL", leagues: ["BEL1"], color: "#c9a227", dates: [[10, 28], [12, 2], [1, 13], [3, 3], [5, 1]] },
  { id: "KGC", name: "King's Cup", short: "KC", nation: "KSA", leagues: ["KSA1"], color: "#0f7a3d", dates: [[9, 16], [10, 28], [1, 13], [3, 3], [5, 1]] },
  { id: "MFA", name: "Piala FA Malaysia", short: "FAM", nation: "MAS", leagues: ["MAS1"], color: "#00337f", dates: [[10, 28], [1, 13], [3, 3], [5, 1]] },
  { id: "TFA", name: "Thai FA Cup", short: "TFA", nation: "THA", leagues: ["THA1"], color: "#1b3f8f", dates: [[10, 28], [1, 13], [3, 3], [5, 1]] },
  { id: "EMP", name: "Emperor's Cup", short: "EC", nation: "JPN", leagues: ["JPN1"], color: "#8b0000", dates: [[9, 16], [10, 28], [12, 16], [3, 3], [5, 1]] },
  { id: "CDB", name: "Copa do Brasil", short: "CdB", nation: "BRA", leagues: ["BRA1"], color: "#0b7a3e", cal: "year", dates: [[4, 22], [5, 20], [7, 29], [9, 16], [12, 9]] },
  { id: "USO", name: "U.S. Open Cup", short: "USOC", nation: "USA", leagues: ["USA1"], color: "#002868", cal: "year", dates: [[4, 15], [5, 6], [7, 22], [8, 26], [9, 30]] },
  { id: "CAR", name: "Copa Argentina", short: "CA", nation: "ARG", leagues: ["ARG1"], color: "#74acdf", cal: "year", dates: [[3, 4], [5, 6], [7, 29], [9, 9], [10, 28]] },
  { id: "NBC", name: "Nedbank Cup", short: "NC", nation: "ZAF", leagues: ["RSA1"], color: "#007a4d", dates: [[2, 6], [3, 6], [4, 10], [5, 9]] },
  { id: "EGC", name: "Piala Mesir", short: "PM", nation: "EGY", leagues: ["EGY1"], color: "#b8860b", dates: [[10, 28], [12, 16], [2, 10], [4, 7], [5, 26]] },
  { id: "CDT", name: "Coupe du Trône", short: "CdT", nation: "MAR", leagues: ["MAR1"], color: "#006233", dates: [[10, 28], [1, 13], [3, 3], [5, 1]] },
];

// Continental competitions.
// format: "swiss" league phase → knockout; "regions" (two swiss regions, AFC); "groups" → knockout.
// slots: internal places per league (used from the second season on; ranked by final table,
// clubs already in a higher competition are skipped). The first season uses the real line-up.
export const CONTINENTAL = [
  {
    id: "UCL", name: "UEFA Champions League", short: "UCL", conf: "UEFA", color: "#0b1f6b", format: "swiss", pots: 4, md: 8,
    mdDates: [[9, 8], [10, 13], [10, 20], [11, 3], [11, 24], [12, 8], [1, 19], [1, 27]], split: true,
    ko: [["Play-off Fase Gugur", 2, [2, 16], [2, 23]], ["Babak 16 Besar", 2, [3, 9], [3, 16]], ["Perempat Final", 2, [4, 6], [4, 13]], ["Semifinal", 2, [4, 27], [5, 4]], ["Final", 1, [6, 5]]],
    first: ["psg", "fcb", "rma", "liv", "int", "mci", "ars", "bar", "atm", "bvb", "rom", "spo", "avl", "fcp", "mun", "cbr", "bet", "psv", "fey", "los", "bod", "nap", "rbl", "vil", "fen", "shk", "gal", "sla", "slo", "vfb", "aek", "lask", "com", "rcl", "vik", "sabz"],
    slots: { ENG1: 5, ESP1: 5, ITA1: 4, GER1: 4, FRA1: 3, POR1: 2, NED1: 2, BEL1: 1 },
    winnerTitle: "Juara Liga Champions",
  },
  {
    id: "UEL", name: "UEFA Europa League", short: "UEL", conf: "UEFA", color: "#f26522", format: "swiss", pots: 4, md: 8,
    mdDates: [[9, 10], [10, 15], [10, 22], [11, 5], [11, 26], [12, 10], [1, 21], [1, 28]],
    ko: [["Play-off Fase Gugur", 2, [2, 18], [2, 25]], ["Babak 16 Besar", 2, [3, 11], [3, 18]], ["Perempat Final", 2, [4, 8], [4, 15]], ["Semifinal", 2, [4, 29], [5, 6]], ["Final", 1, [5, 26]]],
    first: ["b04", "slb", "juv", "mil", "oly", "az", "olp", "rso", "om", "fer", "plz", "usg", "din", "rbs", "celt", "spr", "srf", "rsca", "stu", "lech", "cry", "bou", "sun", "clj", "jag", "omo", "cel", "tsg", "bjk", "tre", "hbs", "nec", "ofi", "lil", "lsof", "ara"],
    slots: { ENG1: 3, ESP1: 2, ITA1: 2, GER1: 2, FRA1: 3, POR1: 1, NED1: 2, BEL1: 2 },
  },
  {
    id: "UECL", name: "UEFA Conference League", short: "UECL", conf: "UEFA", color: "#00be14", format: "swiss", pots: 6, md: 6,
    mdDates: [[10, 15], [10, 22], [11, 5], [11, 26], [12, 10], [12, 17]],
    ko: [["Play-off Fase Gugur", 2, [2, 18], [2, 25]], ["Babak 16 Besar", 2, [3, 11], [3, 18]], ["Perempat Final", 2, [4, 8], [4, 15]], ["Semifinal", 2, [4, 29], [5, 6]], ["Final", 1, [5, 19]]],
    first: ["ata", "brg", "ajx", "scf", "asm", "fcco", "fcmj", "crv", "kaa", "pao", "paf", "bha", "lug", "get", "kups", "twe", "lri", "bor", "stv", "bra", "hea", "kai", "trb", "ucv", "riga", "haj", "jab", "nord", "agf", "esc", "thu", "cska", "kau", "mjb", "ibt", "egn"],
    slots: { ENG1: 1, ESP1: 1, ITA1: 1, GER1: 1, FRA1: 1, POR1: 1, NED1: 2, BEL1: 2 },
  },
  {
    id: "ACLE", name: "AFC Champions League Elite", short: "ACLE", conf: "AFC", color: "#1d3c6e", format: "regions", pots: 4, md: 8,
    mdDates: [[9, 15], [10, 13], [10, 20], [11, 3], [11, 24], [12, 8], [2, 9], [2, 16]],
    ko: [["Babak 16 Besar", 2, [3, 2], [3, 9]], ["Perempat Final", 1, [4, 23]], ["Semifinal", 1, [4, 27]], ["Final", 1, [5, 1]]],
    regions: [["hil", "nas", "ahl", "qad", "itt", "ain", "saa", "was", "sad", "gha", "shm", "estg", "trc", "nef", "pak", "qwj"],
      ["ksm", "vis", "kas", "kyo", "gam", "jbk", "dhc", "poh", "brm", "port", "rat", "bgn", "shp", "njt", "jdt", "cahn"]],
    regionNames: ["Wilayah Barat", "Wilayah Timur"],
    slots: { KSA1: 5, JPN1: 5, THA1: 3, MAS1: 1 },
  },
  {
    id: "ACL2", name: "AFC Champions League Two", short: "ACL2", conf: "AFC", color: "#2f6db5", format: "groups", legs: 2, adv: 2,
    mdDates: [[9, 16], [10, 21], [11, 4], [11, 25], [12, 9], [12, 16]],
    ko: [["Babak 16 Besar", 2, [2, 10], [2, 17]], ["Perempat Final", 2, [3, 3], [3, 10]], ["Semifinal", 2, [4, 7], [4, 14]], ["Final", 1, [5, 15]]],
    groups: [["wah", "nsf", "kuw", "khd"], ["jaz", "ggs", "muh", "ark"], ["taa", "rayn", "faij", "nah"], ["huss", "sho", "seeb", "ebfc"],
      ["seo", "mv", "vtl", "prb"], ["adl", "bgp", "lcs", "tpo"], ["mac", "shs", "svr", "tam"], ["gwn", "kch", "kit", "ppc"]],
    slots: { KSA1: 1, JPN1: 1, THA1: 1, MAS1: 1, IDN1: 1 },
  },
  {
    id: "LIB", name: "CONMEBOL Libertadores", short: "LIB", conf: "CONMEBOL", color: "#c9a227", format: "groups", legs: 2, adv: 2, cal: "year",
    mdDates: [[4, 7], [4, 21], [4, 28], [5, 5], [5, 19], [5, 26]],
    ko: [["Babak 16 Besar", 2, [8, 11], [8, 18]], ["Perempat Final", 2, [9, 8], [9, 15]], ["Semifinal", 2, [10, 20], [10, 27]], ["Final", 1, [11, 28]]],
    groups: [["fla", "edlp", "dim", "cus"], ["coq", "tol", "nacu", "univ"], ["irm", "flu", "bolv", "dlg"], ["uc", "cru", "cabj", "bsce"],
      ["crt", "pla", "isf", "pen"], ["ccp", "pmr", "sc", "jun"], ["ldu", "mrs", "lan", "ar"], ["idv", "rc", "ucen", "lib"]],
    slots: { BRA1: 6, ARG1: 6 },
  },
  {
    id: "CAFCL", name: "CAF Champions League", short: "CAF CL", conf: "CAF", color: "#1f8a3b", format: "groups", legs: 2, adv: 2,
    mdDates: [[11, 27], [12, 4], [12, 18], [1, 8], [1, 15], [1, 24]],
    ko: [["Perempat Final", 2, [3, 13], [3, 20]], ["Semifinal", 2, [4, 17], [4, 24]], ["Final", 2, [5, 15], [5, 22]]],
    // the real draw (28 Oct 2026) is made in-game from the official pots
    pots: [["ests", "rsb", "pyr", "zam"], ["hilo", "sim", "yan", "petro"], ["mca", "orp", "nou", "hor"], ["cafr", "wsc", "csd", "masf"]],
    slots: { EGY1: 2, MAR1: 2, RSA1: 2 },
  },
  {
    id: "UYL", name: "UEFA Youth League", short: "UYL", conf: "UEFA", color: "#3a5bd9", format: "swiss", pots: 6, md: 6, youth: true, mirror: "UCL",
    mdDates: [[9, 8], [10, 13], [10, 20], [11, 3], [11, 24], [12, 8]], split: true,
    ko: [["Babak 16 Besar", 1, [2, 9]], ["Perempat Final", 1, [3, 2]], ["Semifinal", 1, [4, 23]], ["Final", 1, [4, 26]]],
    qualify: 16,
  },
  {
    id: "U20LIB", name: "Libertadores Sub-20", short: "LIB U20", conf: "CONMEBOL", color: "#9a7d1f", format: "groups", legs: 1, adv: 1, youth: true, cal: "year", fromYear: 2027,
    mdDates: [[2, 14], [2, 17], [2, 20]],
    ko: [["Semifinal", 1, [2, 24]], ["Final", 1, [2, 28]]],
    // one club per nation (best academy), two from Brazil and Argentina
    perNation: { BRA: 2, ARG: 2, URU: 1, ECU: 1, PAR: 1, COL: 1, CHI: 1, PER: 1, BOL: 1, VEN: 1 },
  },
];

// league play-offs (champion decided after the regular season)
export const PLAYOFFS = {
  USA1: { name: "MLS Cup Playoffs", stages: [["Babak Pertama", [10, 24]], ["Semifinal Wilayah", [10, 31]], ["Final Wilayah", [11, 21]], ["MLS Cup", [12, 5]]], byZone: true },
  ARG1: { name: "Fase Gugur", stages: [["Babak 16 Besar", [11, 28]], ["Perempat Final", [12, 2]], ["Semifinal", [12, 6]], ["Final", [12, 13]]], cross: true,
    apertura: [[5, 23], [5, 27], [5, 30], [6, 13]] },
};

export const ROUND_NAME = n => ({ 2: "Final", 4: "Semifinal", 8: "Perempat Final", 16: "Babak 16 Besar", 32: "Babak 32 Besar", 64: "Babak 64 Besar", 128: "Babak 128 Besar" }[n] || `Babak ${n} Besar`);
