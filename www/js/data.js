// World data: nations, leagues, clubs. Clubs and leagues are real names; every person in the game is generated.
// level = rough current ability (CA, 1–200) of a typical first-team starter. youth = academy quality 1–20.
// League line-ups follow the 2025/26 season; edit freely.

export const NATIONS = {
  IDN: { name: "Indonesia", conf: "AFC", eu: false, level: 98, lang: "id" },
  ESP: { name: "Spanyol", conf: "UEFA", eu: true, level: 150, lang: "es" },
  ENG: { name: "Inggris", conf: "UEFA", eu: false, level: 148, lang: "en" },
  FRA: { name: "Prancis", conf: "UEFA", eu: true, level: 150, lang: "fr" },
  GER: { name: "Jerman", conf: "UEFA", eu: true, level: 145, lang: "de" },
  ITA: { name: "Italia", conf: "UEFA", eu: true, level: 142, lang: "it" },
  POR: { name: "Portugal", conf: "UEFA", eu: true, level: 145, lang: "pt" },
  NED: { name: "Belanda", conf: "UEFA", eu: true, level: 142, lang: "nl" },
  BEL: { name: "Belgia", conf: "UEFA", eu: true, level: 135, lang: "nl" },
  CRO: { name: "Kroasia", conf: "UEFA", eu: true, level: 133, lang: "hr" },
  DEN: { name: "Denmark", conf: "UEFA", eu: true, level: 132, lang: "da" },
  BRA: { name: "Brasil", conf: "CONMEBOL", eu: false, level: 148, lang: "br" },
  ARG: { name: "Argentina", conf: "CONMEBOL", eu: false, level: 148, lang: "la" },
  URU: { name: "Uruguay", conf: "CONMEBOL", eu: false, level: 132, lang: "la" },
  COL: { name: "Kolombia", conf: "CONMEBOL", eu: false, level: 130, lang: "la" },
  MAR: { name: "Maroko", conf: "CAF", eu: false, level: 132, lang: "ma" },
  SEN: { name: "Senegal", conf: "CAF", eu: false, level: 128, lang: "af" },
  CIV: { name: "Pantai Gading", conf: "CAF", eu: false, level: 125, lang: "af" },
  NGA: { name: "Nigeria", conf: "CAF", eu: false, level: 125, lang: "ng" },
  JPN: { name: "Jepang", conf: "AFC", eu: false, level: 128, lang: "jp" },
  KOR: { name: "Korea Selatan", conf: "AFC", eu: false, level: 124, lang: "kr" },
  USA: { name: "Amerika Serikat", conf: "CONCACAF", eu: false, level: 125, lang: "en" },
  // opponent-only nations (squads fully generated)
  VIE: { name: "Vietnam", conf: "AFC", eu: false, level: 92, lang: "vn", opp: true },
  THA: { name: "Thailand", conf: "AFC", eu: false, level: 94, lang: "th", opp: true },
  MAS: { name: "Malaysia", conf: "AFC", eu: false, level: 88, lang: "my", opp: true },
  SGP: { name: "Singapura", conf: "AFC", eu: false, level: 76, lang: "my", opp: true },
  PHI: { name: "Filipina", conf: "AFC", eu: false, level: 82, lang: "la", opp: true },
  KSA: { name: "Arab Saudi", conf: "AFC", eu: false, level: 116, lang: "ar", opp: true },
  IRN: { name: "Iran", conf: "AFC", eu: false, level: 120, lang: "fa", opp: true },
  AUS: { name: "Australia", conf: "AFC", eu: false, level: 122, lang: "en", opp: true },
  QAT: { name: "Qatar", conf: "AFC", eu: false, level: 110, lang: "ar", opp: true },
  IRQ: { name: "Irak", conf: "AFC", eu: false, level: 108, lang: "ar", opp: true },
  UZB: { name: "Uzbekistan", conf: "AFC", eu: false, level: 112, lang: "uz", opp: true },
  JOR: { name: "Yordania", conf: "AFC", eu: false, level: 106, lang: "ar", opp: true },
  CHN: { name: "Tiongkok", conf: "AFC", eu: false, level: 102, lang: "cn", opp: true },
  SUI: { name: "Swiss", conf: "UEFA", eu: true, level: 132, lang: "de", opp: true },
  AUT: { name: "Austria", conf: "UEFA", eu: true, level: 132, lang: "de", opp: true },
  POL: { name: "Polandia", conf: "UEFA", eu: true, level: 128, lang: "sl", opp: true },
  NOR: { name: "Norwegia", conf: "UEFA", eu: true, level: 130, lang: "da", opp: true },
  SWE: { name: "Swedia", conf: "UEFA", eu: true, level: 126, lang: "da", opp: true },
  SRB: { name: "Serbia", conf: "UEFA", eu: false, level: 126, lang: "sl", opp: true },
  TUR: { name: "Turki", conf: "UEFA", eu: false, level: 130, lang: "tr", opp: true },
  UKR: { name: "Ukraina", conf: "UEFA", eu: false, level: 126, lang: "sl", opp: true },
  SCO: { name: "Skotlandia", conf: "UEFA", eu: false, level: 120, lang: "en", opp: true },
  CZE: { name: "Ceko", conf: "UEFA", eu: true, level: 124, lang: "sl", opp: true },
  GRE: { name: "Yunani", conf: "UEFA", eu: true, level: 120, lang: "gr", opp: true },
  MEX: { name: "Meksiko", conf: "CONCACAF", eu: false, level: 124, lang: "la", opp: true },
  CAN: { name: "Kanada", conf: "CONCACAF", eu: false, level: 118, lang: "en", opp: true },
  ECU: { name: "Ekuador", conf: "CONMEBOL", eu: false, level: 128, lang: "la", opp: true },
  PAR: { name: "Paraguay", conf: "CONMEBOL", eu: false, level: 122, lang: "la", opp: true },
  CHI: { name: "Chile", conf: "CONMEBOL", eu: false, level: 116, lang: "la", opp: true },
  EGY: { name: "Mesir", conf: "CAF", eu: false, level: 122, lang: "ar", opp: true },
  ALG: { name: "Aljazair", conf: "CAF", eu: false, level: 124, lang: "ar", opp: true },
  TUN: { name: "Tunisia", conf: "CAF", eu: false, level: 116, lang: "ar", opp: true },
  CMR: { name: "Kamerun", conf: "CAF", eu: false, level: 120, lang: "af", opp: true },
  GHA: { name: "Ghana", conf: "CAF", eu: false, level: 120, lang: "ng", opp: true },
  MLI: { name: "Mali", conf: "CAF", eu: false, level: 120, lang: "af", opp: true },
};

export const NAMES = {
  id: {
    first: ["Bima","Rizky","Fajar","Dimas","Arya","Yoga","Andika","Raka","Gilang","Ilham","Reza","Dafa","Fikri","Hendra","Wahyu","Bayu","Teguh","Agung","Ricky","Aldi","Rafli","Daffa","Naufal","Ikhsan","Yusuf","Fadil","Kevin","Dicky","Ramadhan","Satria","Galih","Hafiz","Rendi","Taufik","Yanto"],
    last: ["Saputra","Pratama","Nugroho","Setiawan","Hidayat","Santoso","Wibowo","Kurniawan","Ramadhan","Firmansyah","Siregar","Simanjuntak","Pangaribuan","Lubis","Nasution","Tanjung","Rumbiak","Wanggai","Mandagi","Sitorus","Hutapea","Syahputra","Prasetyo","Maulana","Gunawan","Halim","Matondang","Lestaluhu","Kogoya","Wenda","Tuasalamony","Sembiring","Purba","Ginting"],
  },
  es: {
    first: ["Pablo","Álvaro","Sergio","Javier","Hugo","Mario","Adrián","Diego","Iván","Raúl","Marcos","Rubén","Íker","Unai","Aitor","Jorge","Gonzalo","Nico","Alejandro","Dani","Carlos","Víctor","Óscar","Mikel","Asier","Bruno","Eneko","Aleix","Pol","Jordi"],
    last: ["García","Martínez","López","Sánchez","Pérez","Gómez","Fernández","Ruiz","Díaz","Moreno","Muñoz","Álvarez","Romero","Navarro","Torres","Domínguez","Gil","Vázquez","Serrano","Ramos","Blanco","Molina","Ortega","Delgado","Castro","Iglesias","Aranburu","Etxeberria","Puig","Ferrer","Vidal","Soler","Lozano","Cabrera"],
  },
  en: {
    first: ["Harry","Jack","Oliver","George","Charlie","Alfie","Freddie","Archie","Leo","Oscar","Theo","Jacob","Joshua","Callum","Kieran","Reece","Tyler","Mason","Ryan","Liam","Connor","Ethan","Jayden","Marcus","Danny","Tom","Sam","Ben","Lewis","Jordan"],
    last: ["Smith","Jones","Taylor","Brown","Williams","Wilson","Johnson","Davies","Robinson","Wright","Thompson","Evans","Walker","White","Roberts","Green","Hall","Wood","Jackson","Clarke","Hughes","Edwards","Turner","Hill","Moore","Cooper","Ward","Morris","Bennett","Fletcher","Barnes","Holloway"],
  },
  fr: {
    first: ["Lucas","Hugo","Théo","Nathan","Enzo","Louis","Mathis","Maxime","Antoine","Clément","Romain","Bastien","Yanis","Rayan","Adam","Mehdi","Corentin","Florian","Jules","Quentin","Baptiste","Malo","Noah","Sacha","Ilyes","Wilfried","Jérémy"],
    last: ["Martin","Bernard","Dubois","Thomas","Robert","Richard","Petit","Durand","Leroy","Moreau","Simon","Laurent","Lefebvre","Michel","Garnier","Faure","Rousseau","Blanc","Guerin","Muller","Henry","Roussel","Mathieu","Gauthier","Perrin","Morel","Fournier","Girard","Bonnet","Lambert","Diallo","Camara"],
  },
  de: {
    first: ["Lukas","Leon","Finn","Jonas","Niklas","Tim","Paul","Felix","Max","Elias","Jan","Moritz","Julian","Tobias","Florian","Kai","Lennart","Malte","Jannik","Marvin","Fabian","Dominik","Kevin","Nico","Sebastian","Timo","Robin","Benedikt"],
    last: ["Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann","Koch","Richter","Klein","Wolf","Schröder","Neumann","Schwarz","Zimmermann","Braun","Krüger","Hartmann","Lange","Werner","Krause","Lehmann","Köhler","Maier","Brandt","Vogt","Seidel"],
  },
  it: {
    first: ["Lorenzo","Matteo","Alessandro","Andrea","Francesco","Leonardo","Riccardo","Davide","Federico","Gabriele","Tommaso","Simone","Nicolò","Giacomo","Marco","Luca","Stefano","Daniele","Pietro","Filippo","Samuele","Christian","Mattia","Emanuele","Antonio","Giorgio"],
    last: ["Rossi","Russo","Ferrari","Esposito","Bianchi","Romano","Colombo","Ricci","Marino","Greco","Bruno","Gallo","Conti","De Luca","Mancini","Costa","Giordano","Rizzo","Lombardi","Moretti","Barbieri","Fontana","Santoro","Mariani","Rinaldi","Caruso","Ferrara","Galli","Martini","Leone"],
  },
  pt: {
    first: ["João","Diogo","Tiago","Rafael","Gonçalo","Rodrigo","Miguel","Pedro","Rúben","André","Bernardo","Francisco","Nuno","Fábio","Vítor","Hugo","Ricardo","Duarte","Tomás","Martim","Afonso","Renato","Bruno","Simão"],
    last: ["Silva","Santos","Ferreira","Pereira","Oliveira","Costa","Rodrigues","Martins","Jesus","Sousa","Fernandes","Gonçalves","Gomes","Lopes","Marques","Alves","Almeida","Ribeiro","Pinto","Carvalho","Teixeira","Moreira","Correia","Mendes","Nunes","Soares","Vieira","Monteiro"],
  },
  br: {
    first: ["Gabriel","Lucas","Matheus","Pedro","Guilherme","Gustavo","Rafael","Felipe","Bruno","Thiago","Vinícius","Douglas","Everton","Wesley","Igor","Caio","Danilo","Murilo","Arthur","Kauã","Luan","Renan","Yuri","Wanderson"],
    last: ["Silva","Santos","Oliveira","Souza","Lima","Pereira","Ferreira","Costa","Rodrigues","Almeida","Nascimento","Carvalho","Araújo","Ribeiro","Barbosa","Rocha","Dias","Moura","Cardoso","Teixeira","Correia","Melo","Batista","Freitas","Pires","Campos"],
  },
  la: {
    first: ["Santiago","Matías","Nicolás","Facundo","Agustín","Joaquín","Tomás","Franco","Valentín","Emiliano","Julián","Thiago","Benjamín","Ignacio","Juan","Luciano","Gastón","Maximiliano","Rodrigo","Federico","Camilo","Andrés","Sebastián","Kevin","Brian"],
    last: ["González","Rodríguez","Gómez","Fernández","López","Díaz","Martínez","Pérez","Romero","Sosa","Álvarez","Torres","Ruiz","Ramírez","Flores","Acosta","Benítez","Medina","Herrera","Suárez","Aguirre","Giménez","Molina","Castro","Rojas","Vargas","Ortiz","Cabrera","Silva","Ríos"],
  },
  nl: {
    first: ["Daan","Sem","Lucas","Milan","Levi","Thijs","Jesse","Bram","Luuk","Stijn","Ruben","Tim","Jasper","Wout","Joris","Kees","Teun","Rens","Niels","Sven","Mats","Jorrit","Bart","Arne","Senne","Wout"],
    last: ["de Jong","Jansen","de Vries","van den Berg","van Dijk","Bakker","Visser","Smit","Meijer","de Boer","Mulder","de Groot","Bos","Vos","Peters","Hendriks","van Leeuwen","Dekker","Brouwer","de Wit","Dijkstra","Smits","Peeters","Janssens","Maes","Claes","Wouters","Mertens"],
  },
  hr: {
    first: ["Luka","Ivan","Marko","Josip","Ante","Mateo","Petar","Filip","Domagoj","Nikola","Mario","Toni","Dario","Karlo","Lovro","Bruno","Tin","Duje","Martin","Roko"],
    last: ["Horvat","Kovačević","Babić","Marić","Jurić","Novak","Kovačić","Knežević","Vuković","Marković","Petrović","Matić","Tomić","Pavlović","Božić","Perić","Šarić","Lovrić","Grgić","Barišić"],
  },
  da: {
    first: ["Mikkel","Rasmus","Jonas","Mads","Frederik","Emil","Magnus","Oliver","Christian","Andreas","Kasper","Simon","Anders","Mathias","Victor","Lasse","Nikolaj","Tobias","Jesper","Kristoffer"],
    last: ["Nielsen","Jensen","Hansen","Pedersen","Andersen","Christensen","Larsen","Sørensen","Rasmussen","Jørgensen","Petersen","Madsen","Kristensen","Olsen","Thomsen","Poulsen","Johansen","Møller","Mortensen","Dahl"],
  },
  ma: {
    first: ["Youssef", "Hamza", "Amine", "Bilal", "Ayoub", "Anass", "Ilias", "Zakaria", "Ismael", "Oussama", "Reda", "Adil", "Mehdi", "Yassine", "Soufiane", "Othmane"],
    last: ["El Amrani", "Bennani", "El Idrissi", "Alaoui", "Tazi", "Berrada", "El Fassi", "Chakir", "Ouahbi", "Benali", "Haddadi", "Lahlou", "Benjelloun", "El Mansouri", "Kettani", "Sefrioui"],
  },
  af: {
    first: ["Moussa", "Ibrahima", "Cheikh", "Pape", "Mamadou", "Abdoulaye", "Idrissa", "Habib", "Seydou", "Boubacar", "Oumar", "Aliou", "Souleymane", "Bakary", "Yves", "Serge"],
    last: ["Diallo", "Ndiaye", "Sow", "Faye", "Ba", "Cissé", "Koné", "Traoré", "Touré", "Kouassi", "Bamba", "Coulibaly", "Konaté", "Fofana", "Sangaré", "Doumbia", "Seck", "Mbaye"],
  },
  ng: {
    first: ["Chukwuemeka", "Victor", "Samuel", "Emmanuel", "Ademola", "Kelechi", "Chidera", "Tunde", "Kehinde", "Ifeanyi", "Femi", "Uche", "Chinedu", "Ola", "Nnamdi", "Ebuka"],
    last: ["Okafor", "Adeyemi", "Okonkwo", "Eze", "Nwankwo", "Balogun", "Adebayo", "Okoro", "Obi", "Ogunleye", "Ajayi", "Uchenna", "Nwosu", "Oyelaran", "Ibekwe", "Akinwale"],
  },
  jp: {
    first: ["Takumi", "Hiroki", "Yuto", "Yuki", "Kaito", "Sota", "Haruto", "Ren", "Kenta", "Ryota", "Shota", "Daiki", "Kazuki", "Naoki", "Takuya", "Hayato"],
    last: ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato", "Yoshida", "Yamada", "Sasaki", "Matsumoto", "Inoue", "Kimura", "Hayashi", "Shimizu", "Mori", "Ikeda", "Hashimoto", "Ishikawa"],
  },
  kr: {
    first: ["Min-ho", "Ji-hoon", "Seung-woo", "Hyun-jun", "Dong-hyun", "Jae-won", "Sung-min", "Tae-yang", "Joon-young", "Woo-jin", "Sang-woo", "Do-yun", "Jin-woo", "Ho-jin"],
    last: ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim", "Han", "Oh", "Seo", "Shin", "Kwon", "Ahn", "Song", "Hong", "Jeon", "Baek"],
  },
  vn: {
    first: ["Văn Hùng", "Minh Tuấn", "Đức Anh", "Quốc Bảo", "Thành Long", "Hữu Phước", "Văn Khoa", "Gia Huy", "Trọng Nghĩa", "Đình Phong"],
    last: ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Đỗ", "Bùi", "Vũ", "Đặng", "Phan"],
  },
  th: {
    first: ["Somchai", "Anan", "Kittisak", "Nattapong", "Wichai", "Prasert", "Thanawat", "Sarawut", "Chaiwat", "Pongsak", "Jakkapan", "Ekachai"],
    last: ["Saetang", "Srisuk", "Thongchai", "Boonmee", "Wongsa", "Kaewmanee", "Chaiyaphum", "Suksawat", "Rattanakul", "Phromma", "Inthasorn", "Kongkaew"],
  },
  my: {
    first: ["Faiz", "Arif", "Hafiz", "Aidil", "Syazwan", "Azlan", "Azam", "Hakimi", "Aiman", "Haziq", "Irfan", "Shahrul"],
    last: ["Abdullah", "Ismail", "Hamzah", "Rahman", "Yusof", "Osman", "Zainal", "Kamarudin", "Ahmad", "Hashim", "Salleh", "Ibrahim"],
  },
  ar: {
    first: ["Salem", "Mohammed", "Ahmed", "Yasser", "Abdullah", "Hassan", "Ali", "Omar", "Faisal", "Saud", "Khalid", "Mahmoud", "Tarek", "Youssef", "Karim", "Nasser", "Hamad", "Majed", "Ibrahim", "Sami"],
    last: ["Al-Harbi", "Al-Otaibi", "Al-Qahtani", "Al-Ghamdi", "Al-Zahrani", "Al-Mutairi", "Haddad", "Mansour", "Khalil", "Saleh", "Hamdan", "Darwish", "Sabri", "Belkacem", "Bouzid", "Ben Amor", "Jaziri", "Farouk", "Al-Kaabi", "Saadi"],
  },
  fa: {
    first: ["Mehdi", "Reza", "Ali", "Saeed", "Morteza", "Ramin", "Majid", "Omid", "Hossein", "Amir", "Behnam", "Kaveh"],
    last: ["Ahmadi", "Hosseini", "Karimi", "Rezaei", "Mohammadi", "Ebrahimi", "Moradi", "Jafari", "Rahimi", "Sadeghi", "Farahani", "Nouri"],
  },
  cn: { first: ["Wei","Lei","Jun","Hao","Yang","Tao","Peng","Bin","Long","Xin"], last: ["Wang","Li","Zhang","Liu","Chen","Yang","Zhao","Wu","Zhou","Xu"] },
  sl: {
    first: ["Jakub", "Piotr", "Tomáš", "Lukáš", "Dušan", "Aleksandar", "Andriy", "Oleksandr", "Mateusz", "Milan", "Nikola", "Viktor", "Marek", "Pavel"],
    last: ["Kowalczyk", "Nowak", "Wójcik", "Novák", "Svoboda", "Jovanović", "Nikolić", "Kovalenko", "Bondarenko", "Petrović", "Wiśniewski", "Dvořák", "Horák", "Kamiński"],
  },
  tr: { first: ["Arda","Hakan","Kerem","Barış","Orkun","Ferdi","Kenan","Merih","Cengiz","Emre"], last: ["Yılmaz","Kaya","Demir","Şahin","Çelik","Aydın","Öztürk","Arslan","Doğan","Kılıç"] },
  gr: {
    first: ["Giorgos", "Dimitris", "Kostas", "Nikos", "Vangelis", "Christos", "Anastasios", "Petros", "Stavros", "Thanasis"],
    last: ["Papadopoulos", "Georgiou", "Nikolaidis", "Konstantinou", "Dimitriou", "Ioannou", "Papadakis", "Antoniou", "Vlachos", "Christodoulou"],
  },
  uz: {
    first: ["Eldor", "Otabek", "Jasur", "Sardor", "Bekzod", "Aziz", "Dilshod", "Rustam", "Sherzod", "Akmal"],
    last: ["Karimov", "Rakhimov", "Tursunov", "Yusupov", "Saidov", "Nazarov", "Ergashev", "Abdullayev", "Mirzaev", "Kholmatov"],
  },
};

// Name combinations that belong to well-known real players; the generator re-rolls them.
export const BLOCKED_NAMES = new Set(["Bernardo Silva","Bruno Fernandes","Diogo Costa","Nuno Mendes","Ricardo Pereira","André Silva","Rúben Dias","Pedro Gonçalves","Thiago Silva","Douglas Costa","Everton Ribeiro","Arthur Melo","Lucas Moura","Lucas Silva","Danilo Pereira","Julián Álvarez","Emiliano Martínez","Nicolás González","Sergio Ramos","Carlos Soler","Raúl García","Ben White","Callum Wilson","Harry Wilson","Timo Werner","Max Meyer","Robin Koch","Julian Brandt","Luuk de Jong","Mateo Kovačić","Andreas Christensen","Mathias Jensen","Lucas Hernandez","Kevin Schade","Jordan Henderson","Mason Greenwood","Tyler Adams","Marco Asensio","Diego Costa","Gonzalo Martínez","Ángel Correa","Rodrigo Bentancur","Kim Min-jae","Lee Kang-in","Junya Ito","Takumi Minamino"]);

export const LEAGUES = [
  { id: "ENG1", name: "Premier League", short: "PL", nation: "ENG", tier: 1, relegate: 3, color: "#3d195b" },
  { id: "ESP1", name: "LaLiga", short: "LL", nation: "ESP", tier: 1, relegate: 3, color: "#e2231a" },
  { id: "ITA1", name: "Serie A", short: "SA", nation: "ITA", tier: 1, relegate: 3, color: "#0a5ea8" },
  { id: "GER1", name: "Bundesliga", short: "BL", nation: "GER", tier: 1, relegate: 2, color: "#d20515" },
  { id: "FRA1", name: "Ligue 1", short: "L1", nation: "FRA", tier: 1, relegate: 2, color: "#0b1f3a" },
  { id: "IDN1", name: "Super League", short: "SL", nation: "IDN", tier: 1, relegate: 3, color: "#c8102e" },
];

// [id, name, short, level, youth, primary, secondary]
const C = (league, rows) => rows.map(([id, name, short, level, youth, c1, c2]) => ({ id, name, short, league, level, youth, colors: [c1, c2] }));

export const CLUBS = [
  ...C("ENG1", [
    ["ars","Arsenal","ARS",163,17,"#db0007","#ffffff"],["avl","Aston Villa","AVL",148,14,"#670e36","#95bfe5"],
    ["bou","Bournemouth","BOU",138,11,"#da291c","#000000"],["bre","Brentford","BRE",136,11,"#e30613","#ffffff"],
    ["bha","Brighton & Hove Albion","BHA",142,14,"#0057b8","#ffffff"],["bur","Burnley","BUR",124,11,"#6c1d45","#99d6ea"],
    ["che","Chelsea","CHE",155,18,"#034694","#ffffff"],["cry","Crystal Palace","CRY",140,14,"#1b458f","#c4122e"],
    ["eve","Everton","EVE",134,15,"#003399","#ffffff"],["ful","Fulham","FUL",136,15,"#ffffff","#000000"],
    ["lee","Leeds United","LEE",128,13,"#ffffff","#1d428a"],["liv","Liverpool","LIV",164,16,"#c8102e","#00b2a9"],
    ["mci","Manchester City","MCI",162,18,"#6cabdd","#1c2c5b"],["mun","Manchester United","MUN",148,17,"#da291c","#fbe122"],
    ["new","Newcastle United","NEW",150,13,"#241f20","#ffffff"],["nfo","Nottingham Forest","NFO",140,12,"#dd0000","#ffffff"],
    ["sun","Sunderland","SUN",126,15,"#eb172b","#ffffff"],["tot","Tottenham Hotspur","TOT",148,15,"#132257","#ffffff"],
    ["whu","West Ham United","WHU",136,15,"#7a263a","#1bb1e7"],["wol","Wolverhampton Wanderers","WOL",132,13,"#fdb913","#231f20"],
  ]),
  ...C("ESP1", [
    ["ala","Deportivo Alavés","ALA",122,12,"#0761af","#ffffff"],["ath","Athletic Club","ATH",140,18,"#ee2523","#ffffff"],
    ["atm","Atlético de Madrid","ATM",152,16,"#cb3524","#262f61"],["bar","FC Barcelona","BAR",164,20,"#a50044","#004d98"],
    ["cel","RC Celta","CEL",128,16,"#8ac3ee","#e5254e"],["elc","Elche CF","ELC",118,11,"#05642c","#ffffff"],
    ["esp","RCD Espanyol","ESP",123,15,"#007fc8","#ffffff"],["get","Getafe CF","GET",124,11,"#005999","#ffffff"],
    ["gir","Girona FC","GIR",127,12,"#cd2534","#ffffff"],["lev","Levante UD","LEV",118,13,"#004d98","#b4053f"],
    ["mll","RCD Mallorca","MLL",124,13,"#e20613","#000000"],["osa","CA Osasuna","OSA",126,14,"#d91a21","#0a346f"],
    ["ray","Rayo Vallecano","RAY",126,12,"#ffffff","#e53027"],["bet","Real Betis","BET",137,15,"#0bb363","#ffffff"],
    ["rma","Real Madrid","RMA",166,19,"#ffffff","#00529f"],["ovi","Real Oviedo","OVI",116,12,"#0047ab","#ffffff"],
    ["rso","Real Sociedad","RSO",136,18,"#0067b1","#ffffff"],["sev","Sevilla FC","SEV",130,16,"#ffffff","#d4021d"],
    ["val","Valencia CF","VAL",128,17,"#ffffff","#ee3524"],["vil","Villarreal CF","VIL",140,16,"#ffe667","#005187"],
  ]),
  ...C("ITA1", [
    ["ata","Atalanta","ATA",145,17,"#1e71b8","#000000"],["bol","Bologna","BOL",137,13,"#1a2f48","#a21c26"],
    ["cag","Cagliari","CAG",120,12,"#002350","#a50f2c"],["com","Como","COM",134,11,"#003c71","#ffffff"],
    ["cre","Cremonese","CRE",116,11,"#ab1f30","#9a9a9a"],["fio","Fiorentina","FIO",134,14,"#482e92","#ffffff"],
    ["gen","Genoa","GEN",122,13,"#a5112e","#001e4f"],["hve","Hellas Verona","HVE",118,12,"#ffe000","#002d62"],
    ["int","Inter","INT",155,16,"#0068a8","#000000"],["juv","Juventus","JUV",148,16,"#000000","#ffffff"],
    ["laz","Lazio","LAZ",136,13,"#87d8f7","#ffffff"],["lec","Lecce","LEC",116,11,"#f6d22b","#da291c"],
    ["mil","AC Milan","MIL",148,15,"#fb090b","#000000"],["nap","Napoli","NAP",152,13,"#12a0d7","#ffffff"],
    ["par","Parma","PAR",120,13,"#ffd200","#1b3d8f"],["pis","Pisa","PIS",115,10,"#000000","#1c4999"],
    ["rom","Roma","ROM",143,16,"#8e1f2f","#f0bc42"],["sas","Sassuolo","SAS",122,13,"#00a752","#000000"],
    ["tor","Torino","TOR",126,13,"#881f19","#ffffff"],["udi","Udinese","UDI",124,12,"#000000","#ffffff"],
  ]),
  ...C("GER1", [
    ["fca","FC Augsburg","FCA",124,12,"#ba3733","#46714d"],["fcu","1. FC Union Berlin","FCU",126,11,"#eb1923","#ffffff"],
    ["svw","SV Werder Bremen","SVW",128,13,"#1d9053","#ffffff"],["bvb","Borussia Dortmund","BVB",150,18,"#fde100","#000000"],
    ["sge","Eintracht Frankfurt","SGE",140,13,"#e1000f","#000000"],["scf","SC Freiburg","SCF",134,15,"#e2001a","#000000"],
    ["hsv","Hamburger SV","HSV",122,14,"#0a3f86","#ffffff"],["fch","1. FC Heidenheim","FCH",118,9,"#e2001a","#003b79"],
    ["tsg","TSG Hoffenheim","TSG",130,16,"#1961b5","#ffffff"],["koe","1. FC Köln","KOE",122,15,"#ed1c24","#ffffff"],
    ["rbl","RB Leipzig","RBL",146,15,"#dd0741","#ffffff"],["b04","Bayer 04 Leverkusen","B04",148,15,"#e32221","#000000"],
    ["m05","1. FSV Mainz 05","M05",128,13,"#c3141e","#ffffff"],["bmg","Borussia Mönchengladbach","BMG",130,15,"#000000","#ffffff"],
    ["fcb","FC Bayern München","FCB",162,18,"#dc052d","#0066b2"],["stp","FC St. Pauli","STP",118,11,"#6c3b2a","#ffffff"],
    ["vfb","VfB Stuttgart","VFB",140,16,"#ffffff","#e32219"],["wob","VfL Wolfsburg","WOB",130,14,"#65b32e","#ffffff"],
  ]),
  ...C("FRA1", [
    ["sco","Angers SCO","SCO",116,12,"#000000","#ffffff"],["aja","AJ Auxerre","AJA",118,14,"#ffffff","#00579c"],
    ["sb2","Stade Brestois","SB2",124,11,"#e30613","#ffffff"],["hac","Le Havre AC","HAC",116,13,"#7ec0ee","#002a5c"],
    ["rcl","RC Lens","RCL",132,15,"#ec1c24","#fff200"],["los","LOSC Lille","LOS",138,17,"#e01e13","#20325f"],
    ["fcl","FC Lorient","FCL",116,13,"#f58113","#000000"],["oly","Olympique Lyonnais","OLY",138,19,"#ffffff","#14387f"],
    ["om","Olympique de Marseille","OM",142,13,"#2faee0","#ffffff"],["fcm","FC Metz","FCM",114,14,"#8d1b3d","#ffffff"],
    ["asm","AS Monaco","ASM",142,17,"#e51b22","#ffffff"],["fcn","FC Nantes","FCN",120,15,"#fce300","#008a4d"],
    ["ogc","OGC Nice","OGC",132,14,"#c8102e","#000000"],["pfc","Paris FC","PFC",118,12,"#1b2a4e","#ffffff"],
    ["psg","Paris Saint-Germain","PSG",165,17,"#004170","#da291c"],["srf","Stade Rennais","SRF",132,18,"#e13327","#000000"],
    ["rcs","RC Strasbourg","RCS",130,13,"#009fe3","#ffffff"],["tfc","Toulouse FC","TFC",124,13,"#6a2c91","#ffffff"],
  ]),
  ...C("IDN1", [
    ["prb","Persib Bandung","PSB",92,10,"#0055a5","#ffffff"],["prj","Persija Jakarta","PSJ",88,10,"#ee2e24","#ffcc00"],
    ["bfc","Borneo FC Samarinda","BOR",88,10,"#ff8c00","#000000"],["prs","Persebaya Surabaya","PSY",86,11,"#00a651","#ffffff"],
    ["bal","Bali United","BAL",86,10,"#d2232a","#000000"],["mal","Malut United","MLT",85,7,"#c8102e","#ffd700"],
    ["dew","Dewa United","DEW",84,8,"#1a1a1a","#d4af37"],["psm","PSM Makassar","PSM",82,9,"#8b0000","#ffffff"],
    ["are","Arema FC","ARE",80,9,"#0033a0","#ffffff"],["mad","Madura United","MAD",78,8,"#c8102e","#ffffff"],
    ["prk","Persik Kediri","PSK",78,8,"#7b2d8b","#ffffff"],["prsl","Persis Solo","PSS",77,9,"#d52b1e","#000000"],
    ["prt","Persita Tangerang","PST",77,8,"#6a1b9a","#ffffff"],["bhy","Bhayangkara FC","BHY",80,8,"#1f2a44","#e4b100"],
    ["psb","PSBS Biak","PSBS",74,7,"#0072ce","#ffffff"],["smp","Semen Padang","SMP",72,8,"#d71920","#000000"],
    ["psim","PSIM Yogyakarta","PSIM",74,8,"#004b93","#ffffff"],["prjp","Persijap Jepara","PSJP",73,7,"#d22630","#ffffff"],
  ]),
];

// Second-tier pools: not simulated, they rotate with relegated clubs.
export const SECOND_TIER = {
  ENG1: C("ENG2", [["lei","Leicester City","LEI",124,15,"#003090","#fdbe11"],["sou","Southampton","SOU",122,17,"#d71920","#ffffff"],["ips","Ipswich Town","IPS",121,12,"#0044a9","#ffffff"],["shu","Sheffield United","SHU",120,13,"#ee2737","#ffffff"],["mid","Middlesbrough","MID",119,13,"#e21b23","#ffffff"],["wba","West Bromwich Albion","WBA",118,14,"#122f67","#ffffff"],["nor","Norwich City","NOR",118,15,"#fff200","#00a650"],["cov","Coventry City","COV",119,12,"#3fa9f5","#ffffff"]]),
  ESP1: C("ESP2", [["lpa","UD Las Palmas","LPA",114,13,"#ffe400","#004b9d"],["vll","Real Valladolid","VLL",112,13,"#5b2b82","#ffffff"],["leg","CD Leganés","LEG",112,11,"#ffffff","#004b9d"],["alm","UD Almería","ALM",113,12,"#ee1c25","#ffffff"],["gra","Granada CF","GRA",111,12,"#c8102e","#ffffff"],["rac","Racing de Santander","RAC",110,13,"#ffffff","#00843d"],["spg","Sporting de Gijón","SPG",109,15,"#d71920","#ffffff"],["dep","RC Deportivo","DEP",111,14,"#1b5daa","#ffffff"]]),
  ITA1: C("ITA2", [["emp","Empoli","EMP",113,15,"#005baa","#ffffff"],["mon","Monza","MON",114,12,"#e4002b","#ffffff"],["ven","Venezia","VEN",112,11,"#000000","#f37021"],["pal","Palermo","PAL",113,12,"#f4a7c3","#000000"],["sam","Sampdoria","SAM",109,14,"#1b5faa","#ffffff"],["spe","Spezia","SPE",108,11,"#ffffff","#000000"]]),
  GER1: C("GER2", [["ksv","Holstein Kiel","KSV",116,11,"#0050a0","#ffffff"],["boc","VfL Bochum","BOC",115,12,"#005ca9","#ffffff"],["s04","FC Schalke 04","S04",116,16,"#004d9d","#ffffff"],["bsc","Hertha BSC","BSC",114,15,"#005ca9","#ffffff"],["h96","Hannover 96","H96",112,13,"#0c9046","#000000"],["f95","Fortuna Düsseldorf","F95",112,12,"#e3001b","#ffffff"]]),
  FRA1: C("FRA2", [["mhsc","Montpellier HSC","MHSC",110,15,"#003a7d","#f27b22"],["asse","AS Saint-Étienne","ASSE",112,15,"#00924d","#ffffff"],["sdr","Stade de Reims","SDR",112,14,"#ee2324","#ffffff"],["est","ES Troyes AC","EST",106,11,"#003c7d","#ffffff"],["eag","En Avant Guingamp","EAG",104,12,"#e31b23","#000000"],["pau","Pau FC","PAU",102,10,"#ffd700","#002855"]]),
  IDN1: C("IDN2", [["pss","PSS Sleman","SLE",68,7,"#00843d","#ffffff"],["bar2","Barito Putera","BRT",68,7,"#ffd700","#003b7a"],["psps","PSPS Pekanbaru","PSPS",62,6,"#0055a5","#ffffff"],["prsla","Persela Lamongan","PSLA",64,8,"#0072bb","#ffffff"],["sri","Sriwijaya FC","SRI",63,7,"#ffd200","#d71920"],["prsr","Persiraja Banda Aceh","PRSJ",60,7,"#ff7f00","#000000"]]),
};

export const POSITIONS = ["GK","DR","DC","DL","WBR","WBL","DM","MR","MC","ML","AMR","AMC","AML","ST"];
export const POS_LABEL = {
  GK: "Kiper", DR: "Bek Kanan", DC: "Bek Tengah", DL: "Bek Kiri", WBR: "Wing-back Kanan", WBL: "Wing-back Kiri",
  DM: "Gelandang Bertahan", MR: "Gelandang Kanan", MC: "Gelandang Tengah", ML: "Gelandang Kiri",
  AMR: "Sayap Kanan", AMC: "Gelandang Serang", AML: "Sayap Kiri", ST: "Penyerang",
};
