// World data: nations, leagues, clubs. Clubs and leagues are real names; every person in the game is generated.
// level = rough current ability (CA, 1–200) of a typical first-team starter. youth = academy quality 1–20.
// League line-ups (clubs.js) follow the 2026/27 season.

export { NATIONS } from "./nations.js";

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
  sw: {
    first: ["Baraka", "Juma", "Hassani", "Omari", "Musa", "Rashidi", "Ally", "Bakari", "Kelvin", "Brian", "Dennis", "Collins", "Emmanuel", "Joseph", "Moses", "Patrick", "Isaac", "Tafadzwa", "Tendai", "Kudakwashe", "Sipho", "Thabo", "Lebo", "Bongani", "Mandla", "Abel", "Dawit", "Yonas"],
    last: ["Mwangi", "Otieno", "Kamau", "Ochieng", "Wanyama", "Omondi", "Mnyama", "Mussa", "Juma", "Hamisi", "Banda", "Phiri", "Mwale", "Moyo", "Ncube", "Dube", "Sibanda", "Khumalo", "Dlamini", "Nkosi", "Mokoena", "Zulu", "Ndlovu", "Tadesse", "Bekele", "Girma", "Kiprono", "Chikwanha"],
  },
  ru: {
    first: ["Aleksandr", "Dmitri", "Sergei", "Andrei", "Ivan", "Maksim", "Artem", "Nikita", "Pavel", "Roman", "Denis", "Kirill", "Mikhail", "Oleg", "Yuri", "Vladislav", "Ilya", "Egor", "Bohdan", "Taras", "Mykola", "Vitaliy", "Artur", "Daniil"],
    last: ["Ivanov", "Smirnov", "Kuznetsov", "Popov", "Volkov", "Sokolov", "Morozov", "Petrov", "Fedorov", "Orlov", "Belov", "Lebedev", "Novikov", "Kozlov", "Zaitsev", "Kovalenko", "Shevchenko", "Boyko", "Melnyk", "Tkachenko", "Kravchenko", "Antonov", "Sidorov", "Gusev"],
  },
  hu: {
    first: ["Bence", "Máté", "Levente", "Dominik", "Ádám", "Dániel", "Balázs", "Gergő", "Krisztián", "Zsolt", "Tamás", "Attila", "Péter", "Dávid", "Milán", "Roland", "Csaba", "Botond"],
    last: ["Nagy", "Kovács", "Tóth", "Szabó", "Horváth", "Varga", "Kiss", "Molnár", "Németh", "Farkas", "Balogh", "Papp", "Takács", "Juhász", "Lakatos", "Mészáros", "Oláh", "Simon"],
  },
  ro: {
    first: ["Andrei", "Alexandru", "Ionuț", "Mihai", "Răzvan", "Florin", "Cristian", "Bogdan", "Vlad", "Darius", "Ștefan", "Adrian", "Marius", "Gabriel", "Cosmin", "Dragoș", "Radu", "Tudor"],
    last: ["Popescu", "Ionescu", "Popa", "Stan", "Dumitru", "Stoica", "Gheorghe", "Rusu", "Munteanu", "Matei", "Constantin", "Vasile", "Lazăr", "Ilie", "Toma", "Moldovan", "Dinu", "Neagu"],
  },
  al: {
    first: ["Arbër", "Ardit", "Besart", "Drilon", "Endri", "Erion", "Granit", "Kristjan", "Leart", "Milot", "Nedim", "Rei", "Valon", "Ylber", "Arlind", "Blerim", "Endrit", "Florent"],
    last: ["Hoxha", "Krasniqi", "Gashi", "Berisha", "Shala", "Morina", "Kelmendi", "Bytyqi", "Rexhepi", "Hysaj", "Ismajli", "Dibra", "Kryeziu", "Limaj", "Muçaj", "Sadiku", "Zeqiri", "Lika"],
  },
  ge: {
    first: ["Giorgi", "Levan", "Nika", "Luka", "Saba", "Davit", "Otar", "Zurab", "Irakli", "Lasha", "Guram", "Tornike", "Aleksandre", "Mate"],
    last: ["Beridze", "Kapanadze", "Gelashvili", "Kobakhidze", "Lomidze", "Chikovani", "Gogoladze", "Kurtanidze", "Maisuradze", "Bolkvadze", "Nadiradze", "Gvelesiani", "Abuladze", "Japaridze"],
  },
  hy: {
    first: ["Aram", "Armen", "Hovhannes", "Davit", "Tigran", "Gor", "Narek", "Artur", "Vahan", "Edgar", "Karen", "Levon", "Hayk", "Sargis"],
    last: ["Hovhannisyan", "Sargsyan", "Grigoryan", "Petrosyan", "Harutyunyan", "Mkrtchyan", "Avetisyan", "Ghazaryan", "Karapetyan", "Babayan", "Hakobyan", "Vardanyan", "Martirosyan", "Simonyan"],
  },
  he: {
    first: ["Yonatan", "Itay", "Omer", "Noam", "Eitan", "Daniel", "Amit", "Liel", "Shon", "Ofek", "Tomer", "Idan", "Ariel", "Yarden"],
    last: ["Cohen", "Levi", "Mizrahi", "Peretz", "Biton", "Dahan", "Avraham", "Friedman", "Azulai", "Katz", "Yosef", "Hadad", "Ohana", "Gabay"],
  },
  fi: {
    first: ["Mikko", "Juho", "Teemu", "Joni", "Lauri", "Eero", "Aleksi", "Ville", "Kalle", "Toni", "Martin", "Karl", "Rasmus", "Kristaps", "Dāvis", "Lukas", "Mantas", "Justas", "Paulius"],
    last: ["Virtanen", "Korhonen", "Mäkinen", "Nieminen", "Hämäläinen", "Laine", "Heikkinen", "Tamm", "Saar", "Sepp", "Kalniņš", "Bērziņš", "Ozols", "Kazlauskas", "Petrauskas", "Jankauskas", "Lehtonen", "Salonen", "Koskinen"],
  },
  in: {
    first: ["Arjun", "Rahul", "Rohit", "Pranav", "Vikram", "Sahal", "Lallianzuala", "Deepak", "Akash", "Imran", "Faisal", "Hamza", "Sajid", "Rafiq", "Tanvir", "Kamal", "Suman", "Bikash", "Nuwan", "Kasun"],
    last: ["Singh", "Kumar", "Sharma", "Thapa", "Chhetri", "Gurung", "Das", "Khan", "Ali", "Ahmed", "Hossain", "Rahman", "Chowdhury", "Perera", "Fernando", "Silva", "Bheke", "Naorem", "Ralte", "Jhingan"],
  },
  pa: {
    first: ["Peni", "Tevita", "Sione", "Josaia", "Ratu", "Iosefa", "Micah", "Alvin", "Raphael", "Kavika", "Teiva", "Jules", "Emmanuel", "Junior", "Benjamin", "Tuilagi", "Leo", "Isaac"],
    last: ["Krishna", "Tuilagi", "Naidu", "Waqa", "Tamata", "Vakatawa", "Faleolo", "Taufa", "Fifita", "Kauhalu", "Tehau", "Tavita", "Kami", "Pouono", "Hagi", "Wilson", "Kalo", "Sanft"],
  },
};

// Name combinations that belong to well-known real players; the generator re-rolls them.
export const BLOCKED_NAMES = new Set(["Bernardo Silva","Bruno Fernandes","Diogo Costa","Nuno Mendes","Ricardo Pereira","André Silva","Rúben Dias","Pedro Gonçalves","Thiago Silva","Douglas Costa","Everton Ribeiro","Arthur Melo","Lucas Moura","Lucas Silva","Danilo Pereira","Julián Álvarez","Emiliano Martínez","Nicolás González","Sergio Ramos","Carlos Soler","Raúl García","Ben White","Callum Wilson","Harry Wilson","Timo Werner","Max Meyer","Robin Koch","Julian Brandt","Luuk de Jong","Mateo Kovačić","Andreas Christensen","Mathias Jensen","Lucas Hernandez","Kevin Schade","Jordan Henderson","Mason Greenwood","Tyler Adams","Marco Asensio","Diego Costa","Gonzalo Martínez","Ángel Correa","Rodrigo Bentancur","Kim Min-jae","Lee Kang-in","Junya Ito","Takumi Minamino"]);

export { LEAGUES, CLUBS, EXTERNAL, POOLS, POOL_NAME, PROMO, POOL_DROP, RESERVES } from "./clubs.js";

export const POSITIONS = ["GK","DR","DC","DL","WBR","WBL","DM","MR","MC","ML","AMR","AMC","AML","ST"];
export const POS_LABEL = {
  GK: "Kiper", DR: "Bek Kanan", DC: "Bek Tengah", DL: "Bek Kiri", WBR: "Wing-back Kanan", WBL: "Wing-back Kiri",
  DM: "Gelandang Bertahan", MR: "Gelandang Kanan", MC: "Gelandang Tengah", ML: "Gelandang Kiri",
  AMR: "Sayap Kanan", AMC: "Gelandang Serang", AML: "Sayap Kiri", ST: "Penyerang",
};
