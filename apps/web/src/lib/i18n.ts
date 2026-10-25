// UI labels in the three site languages. Candidate data (names, parties, occupations,
// organisations, source titles) is never translated: it is shown verbatim in Slovak.

export const LANGS = ["sk", "en", "hu"] as const;
export type Lang = (typeof LANGS)[number];

export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

const sk = {
  htmlTitle: "Koho volím",
  tagline: "Každý kandidát v Nitrianskom kraji. Iba fakty so zdrojom.",
  nav: {
    label: "Hlavná navigácia",
    results: "Výsledky volieb",
    candidates: "Kandidáti",
    method: "Metodika",
    sources: "Zdroje",
    corrections: "Opravy",
  },
  langName: "Jazyk",
  search: {
    label: "Hľadať kandidáta, stranu alebo obec",
    placeholder: "Kandidát, strana alebo obec",
    submit: "Hľadať",
    groups: {
      person: "Kandidáti",
      party: "Strany",
      municipality: "Obce",
      okres: "Okresy",
    },
    okres: (name: string) => `Okres ${name}`,
    okresMeta: (n: number) => `${n} obcí`,
    empty: (q: string) =>
      `Nič sme nenašli pre „${q}“. Skontroluj pravopis alebo vyber obec na mape.`,
    showAll: "zobraziť všetky",
    title: "Vyhľadávanie",
    min: "Napíš aspoň 2 znaky.",
    results: (n: number) => `${n} výsledkov`,
  },
  home: {
    countdownBefore: "Miestnosti sa otvárajú o",
    countdownOpen: "Miestnosti sú otvorené ešte",
    closed: "Voľby 24. 10. 2026 sa skončili",
    h1a: "Každý kandidát.",
    h1b: "Iba fakty.",
    lede: (people: string, municipalities: number) =>
      `<b>${people} kandidátov</b> zo ${municipalities} obcí Nitrianskeho kraja. Pri každom údaji je odkaz na verejný zdroj a dátum získania.`,
    mapLabel: (n: number) =>
      `Mapa Nitrianskeho kraja s hranicami ${n} obcí a 7 okresov`,
    mapNote: "Hranice obcí a okresov · geoBoundaries",
    tipDistrict: "Okres",
    tipMunicipality: "Obec",
    tipCount: "Obcí",
    tipArea: "Rozloha",
    tipClick: "Kliknutím",
    tipOpenList: "zoznam",
    tipOpenBallot: "môj lístok",
    tipCandidates: "Kandidátov",
    ballotTitle: "Môj hlasovací lístok",
    ballotHint:
      "Vyber obec na mape alebo ju napíš do vyhľadávania. Ukážeme štyri voľby, v ktorých hlasuješ.",
    cards: [
      {
        k: "Kandidatúry 2026",
        h: "Kde všade kandiduje",
        p: "Každá voľba s poradovým číslom na lístku, stranou a povolaním.",
        rows: [
          ["Zdroj", "MV SR"],
          ["Stav", "23. 10. 2026"],
        ],
      },
      {
        k: "Volebná história",
        h: "Ako dopadli minulé voľby",
        p: "Minulé kandidatúry, výsledok a počet hlasov, s dôvodom zhody.",
        rows: [
          ["Zdroj", "Štatistický úrad SR"],
          ["Obdobie", "2018 – 2022"],
        ],
      },
      {
        k: "Firmy a funkcie",
        h: "Kde pôsobí",
        p: "Funkcie v spoločnostiach a organizáciách s dátumom od a do a dôvodom zhody.",
        rows: [
          ["Zdroj", "RPO, RPVS, RMNO"],
          ["Hodnotenia", "žiadne"],
        ],
      },
    ],
  },
  footer: {
    data: (date: string) =>
      `Kandidáti: MV SR, stav k ${date} · Hranice: geoBoundaries (CC BY 4.0) · Názvy obcí: Wikidata`,
    report: "Nahlásiť chybu",
    neutral: "Nikoho neodporúčame ani nehodnotíme.",
  },
  race: {
    kind: {
      mayor: "Starosta / primátor",
      municipal_council: "Poslanci obecného / mestského zastupiteľstva",
      regional_governor: "Predseda Nitrianskeho samosprávneho kraja",
      regional_council: "Poslanci zastupiteľstva NSK",
    },
    kindShort: {
      mayor: "Starosta a primátor",
      municipal_council: "Poslanci obce",
      regional_governor: "Predseda NSK",
      regional_council: "Poslanci NSK",
    },
    district: (n: number) => `volebný obvod ${n}`,
    wholeRegion: "celý kraj",
    candidates: (n: number) => `${n} kandidátov`,
    seats: (n: number) => `${n} mandátov`,
    ballotOrder:
      "Kandidáti sú vždy v poradí podľa hlasovacieho lístka. Zoznam sa nedá zoradiť inak.",
    none: "V tejto voľbe nie je zaregistrovaný žiadny kandidát.",
    cols: {
      no: "Č.",
      name: "Meno",
      age: "Vek",
      occupation: "Zamestnanie",
      party: "Strana",
      result: "Výsledok 2026",
      history: "Kandidatúry / zvolenia 2018–2022",
      firms: "Firmy",
      attendance: "Účasť na hlasovaniach",
      summary: "Zhrnutie",
    },
    notMember: "—",
    elected: "zvolený/á",
    counting: "Sčítavanie prebieha — výsledky ešte nie sú kompletné.",
    resultsUnavailable:
      "Výsledky ŠÚ SR momentálne nie sú dostupné. Skús neskôr.",
    resultsUpdated: (when: string) => `Výsledky ŠÚ SR · aktualizované ${when}`,
    resultsCached: "zobrazené z posledného uloženého snímku",
    resultsSource: "volbysr.sk",
    data: (date: string) => `Údaje MV SR k ${date}`,
  },
  resultsPage: {
    title: "Výsledky volieb 2026",
    lede: "Oficiálne výsledky Štatistického úradu SR pre Nitriansky samosprávny kraj. Bez hodnotenia, v poradí podľa hlasovacieho lístka.",
    vuc: "Nitriansky samosprávny kraj",
    governor: "Predseda NSK",
    council: "Poslanci zastupiteľstva NSK",
    councilHint:
      "Výsledky po volebných obvodoch. Otvor obvod pre kandidátov a hlasy, keď ich ŠÚ SR zverejní.",
    municipal: "Obce a mestá",
    municipalHint:
      "Výsledky starostov a poslancov sú na stránke každej voľby. Vyber obec na mape alebo v zozname kandidátov.",
    openRace: "Otvoriť voľbu",
    openMunicipal: "Zoznam obcí",
  },
  ballot: {
    title: (name: string) => `Hlasovací lístok · ${name}`,
    pickDistrict: "Volebný obvod do obecného zastupiteľstva",
    dontKnow: "Neviem → zobraziť všetky obvody",
    allDistricts: "Všetky obvody",
    districtLabel: (n: number) => `Obvod ${n}`,
    noAddressMap:
      "Obvod podľa adresy neurčujeme: verejný zoznam ulíc a obvodov neexistuje. Obvod nájdeš na oznámení o voľbách.",
    regionalSplit:
      "Okres Nové Zámky má dva volebné obvody do zastupiteľstva NSK (4 a 6). Ktorý je tvoj, uvádza hlasovací lístok.",
    open: "Otvoriť voľbu",
    district: "Okres",
  },
  profile: {
    age: (n: number) => `${n} rokov`,
    votesScope:
      "Menovité hlasovania zatiaľ zbierame z Mestského zastupiteľstva Nitra. Ďalšie zastupiteľstvá pribudnú.",
    sourceDown: (name: string, date: string) =>
      `Zdroj ${name} nebol dostupný pri zbere (${date}).`,
    residenceMap: (place: string) =>
      `Mapa Nitrianskeho kraja, vyznačená obec ${place}`,
    residenceNote: "Bydlisko podľa kandidátnej listiny",
    raceOf: "Voľba",
    votesPage: "Hlasovania",
    keyOnly: "Len kľúčové",
    allTopics: "Všetky témy",
    sessionPdf: "Hlasovania PDF",
    residence: "bydlisko",
    tabs: { overview: "Prehľad", timeline: "Časová os" },
    sections: {
      summary: "Zhrnutie",
      candidacies: "Kandidatúry 2026",
      history: "Volebná história 2018–2022",
      business: "Firmy a funkcie",
      votes: "Hlasovania",
      assets: "Majetkové priznania",
      campaign: "Kampaň",
      media: "Médiá a výroky",
      research: "Ďalší výskum",
      sources: "Zdroje",
    },
    aiLabel: "Zhrnutie vygenerované AI z faktov nižšie",
    templateLabel: "Zhrnutie zostavené zo šablóny bez AI, len z faktov nižšie",
    aiNote: (model: string, date: string) =>
      `Model ${model} · vygenerované ${date} · každá veta odkazuje na fakty`,
    notFoundIn: "Nenájdené v:",
    ballotNo: "č. na lístku",
    party: "Strana",
    occupation: "Povolanie",
    histCols: {
      year: "Rok",
      race: "Voľba",
      party: "Strana",
      occupation: "Povolanie",
      result: "Výsledok",
      votes: "Hlasy",
      match: "Zhoda",
    },
    elected: "zvolený/á",
    notElected: "nezvolený/á",
    votes: (n: string) => `${n} hlasov`,
    current: "dodnes",
    terminated: "organizácia zanikla",
    match: "Zhoda:",
    ambiguous: (n: number) => `nejednoznačná zhoda: ${n} osôb`,
    namesakes: (n: number) => `v kraji ${n} kandidáti s týmto menom`,
    researchNote:
      "Odkazy sa vytvárajú z mena a obce. Neotvárame ich za teba a nič z nich neukladáme.",
    timelineNote: "Rovnaké fakty ako v prehľade, od najstarších.",
    undated: "Bez dátumu",
    attendance: (pct: string, present: number, total: number) =>
      `účasť ${pct} % (${present} z ${total} hlasovaní)`,
    keyVotes: "Kľúčové hlasovania",
    keyVotesRule:
      "Kľúčové hlasovania vyberá jedno pravidlo pre celé zastupiteľstvo: rozpočet, záverečný účet, územný plán, úvery, majetok a tesné hlasovania.",
    topicAuto: "Téma priradená automaticky",
    noItems: "Žiadne body",
    choice: {
      for: "ZA",
      against: "PROTI",
      abstain: "ZDRŽAL/A SA",
      not_voting: "NEHLASOVAL/A",
      absent: "NEPRÍTOMNÝ/Á",
    },
    counts: "za : proti : zdržali sa",
    inconsistency: "Nesúlad v zdroji: počty a mená sa nezhodujú",
    session: (n: number | null, date: string) =>
      n ? `${n}. zasadnutie · ${date}` : `zasadnutie ${date}`,
    allVotes: (n: number) => `Všetky hlasovania (${n})`,
    notPublishing: "Orgán nezverejňuje menovité hlasovanie",
    soon: "V príprave",
    retrieved: "získané",
    snapshot: "kópia",
    perAccording: "podľa",
    rating: "Hodnotenie Demagog.sk",
    score: "Hodnotenie TI Slovensko",
    transparent: "Transparentný účet",
    web: "Web kampane",
    year: "rok",
    income: "príjem z verejnej funkcie",
    otherIncome: "iné príjmy",
    realEstate: "nehnuteľnosti",
    publicFunction: "verejná funkcia",
  },
  partyPage: {
    eyebrow: "Strana alebo koalícia",
    lede: (n: number) =>
      `${n} kandidatúr v Nitrianskom kraji, po voľbách. Zahŕňa aj koalície, v ktorých strana kandiduje.`,
  },
  list: {
    title: "Kandidáti",
    lede: "Všetky voľby v Nitrianskom kraji. Vyber okres a obec; v každej voľbe sú kandidáti v poradí podľa hlasovacieho lístka.",
    regional: "Voľby do Nitrianskeho samosprávneho kraja",
    municipal: "Obce podľa okresov",
    stats: {
      candidates: "kandidátov",
      municipalities: "obcí",
      races: "volieb",
    },
    allDistricts: "Všetky okresy",
  },
  notFound: {
    title: "Stránku sme nenašli",
    lede: "Odkaz je neplatný alebo sa zmenil. Skús vyhľadávanie.",
  },
  error: {
    title: "Stránka je dočasne nedostupná",
    lede: "Databáza teraz neodpovedá. Údaje pochádzajú z týchto verejných zdrojov:",
    retry: "Skúsiť znova",
  },
  units: { km2: "km²" },
};

type Dict = typeof sk;

const en: Dict = {
  ...sk,
  htmlTitle: "Koho volím",
  tagline: "Every candidate in the Nitra region. Only facts, with sources.",
  nav: {
    label: "Main navigation",
    results: "Election results",
    candidates: "Candidates",
    method: "Methodology",
    sources: "Sources",
    corrections: "Corrections",
  },
  langName: "Language",
  search: {
    label: "Search for a candidate, party or municipality",
    placeholder: "Candidate, party or municipality",
    submit: "Search",
    groups: {
      person: "Candidates",
      party: "Parties",
      municipality: "Municipalities",
      okres: "Districts",
    },
    okres: (name: string) => `${name} district`,
    okresMeta: (n: number) => `${n} municipalities`,
    empty: (q: string) =>
      `Nothing found for “${q}”. Check the spelling or pick a municipality on the map.`,
    showAll: "show all",
    title: "Search",
    min: "Type at least 2 characters.",
    results: (n: number) => `${n} results`,
  },
  home: {
    ...sk.home,
    countdownBefore: "Polling stations open in",
    countdownOpen: "Polling stations close in",
    closed: "The 24 Oct 2026 elections are over",
    h1a: "Every candidate.",
    h1b: "Only facts.",
    lede: (people: string, municipalities: number) =>
      `<b>${people} candidates</b> from ${municipalities} municipalities of the Nitra region. Every fact links to its public source and retrieval date.`,
    mapLabel: (n: number) =>
      `Map of the Nitra region with the borders of ${n} municipalities and 7 districts`,
    mapNote: "Municipality and district borders · geoBoundaries",
    tipDistrict: "District",
    tipMunicipality: "Municipality",
    tipCount: "Municipalities",
    tipArea: "Area",
    tipClick: "Click",
    tipOpenList: "list",
    tipOpenBallot: "my ballot",
    tipCandidates: "Candidates",
    ballotTitle: "My ballot",
    ballotHint:
      "Pick a municipality on the map or type it into the search. We show the four races you vote in.",
    cards: [
      {
        k: "2026 candidacies",
        h: "Where they are running",
        p: "Every race with ballot number, party and occupation.",
        rows: [
          ["Source", "MV SR"],
          ["As of", "23 Oct 2026"],
        ],
      },
      {
        k: "Election history",
        h: "Past elections",
        p: "Past candidacies, result and votes, with the reason for each match.",
        rows: [
          ["Source", "Statistical Office"],
          ["Period", "2018 – 2022"],
        ],
      },
      {
        k: "Companies and roles",
        h: "Where they hold roles",
        p: "Roles in companies and organisations with dates and match reasons.",
        rows: [
          ["Source", "RPO, RPVS, RMNO"],
          ["Ratings", "none"],
        ],
      },
    ],
  },
  footer: {
    data: (date: string) =>
      `Candidates: MV SR, as of ${date} · Borders: geoBoundaries (CC BY 4.0) · Municipality names: Wikidata`,
    report: "Report an error",
    neutral: "We do not recommend or rate anyone.",
  },
  race: {
    ...sk.race,
    kind: {
      mayor: "Mayor",
      municipal_council: "Municipal council",
      regional_governor: "Chair of the Nitra self-governing region",
      regional_council: "Regional council (NSK)",
    },
    kindShort: {
      mayor: "Mayor",
      municipal_council: "Municipal council",
      regional_governor: "NSK chair",
      regional_council: "NSK council",
    },
    district: (n: number) => `electoral district ${n}`,
    wholeRegion: "whole region",
    candidates: (n: number) => `${n} candidates`,
    seats: (n: number) => `${n} seats`,
    ballotOrder:
      "Candidates are always in official ballot order. The list cannot be sorted otherwise.",
    none: "No candidate is registered in this race.",
    cols: {
      no: "No.",
      name: "Name",
      age: "Age",
      occupation: "Occupation",
      party: "Party",
      result: "2026 result",
      history: "Candidacies / elected 2018–2022",
      firms: "Companies",
      attendance: "Vote attendance",
      summary: "Summary",
    },
    notMember: "—",
    elected: "elected",
    counting: "Counting in progress — results are not complete yet.",
    resultsUnavailable:
      "Statistical Office results are temporarily unavailable. Try again later.",
    resultsUpdated: (when: string) =>
      `Statistical Office results · updated ${when}`,
    resultsCached: "shown from the last stored snapshot",
    resultsSource: "volbysr.sk",
    data: (date: string) => `MV SR data as of ${date}`,
  },
  resultsPage: {
    title: "2026 election results",
    lede: "Official results from the Statistical Office of the SR for the Nitra self-governing region. No rankings — ballot order only.",
    vuc: "Nitra self-governing region",
    governor: "NSK chair",
    council: "NSK regional council",
    councilHint:
      "Results by electoral district. Open a district for candidates and votes once the Statistical Office publishes them.",
    municipal: "Municipalities",
    municipalHint:
      "Mayor and council results are on each race page. Pick a municipality on the map or in the candidate list.",
    openRace: "Open race",
    openMunicipal: "Municipality list",
  },
  ballot: {
    title: (name: string) => `Ballot · ${name}`,
    pickDistrict: "Municipal council electoral district",
    dontKnow: "I don’t know → show all districts",
    allDistricts: "All districts",
    districtLabel: (n: number) => `District ${n}`,
    noAddressMap:
      "We do not map addresses to districts: no public street-to-district list exists. Your district is on the election notice.",
    regionalSplit:
      "The Nové Zámky district has two NSK electoral districts (4 and 6). Your ballot shows which one is yours.",
    open: "Open race",
    district: "District",
  },
  profile: {
    ...sk.profile,
    age: (n: number) => `${n} years`,
    votesScope:
      "Named votes are collected from the Nitra city council so far. More councils will follow.",
    sourceDown: (name: string, date: string) =>
      `Source ${name} was unavailable during collection (${date}).`,
    residenceMap: (place: string) =>
      `Map of the Nitra region, municipality ${place} marked`,
    residenceNote: "Residence as on the candidate list",
    raceOf: "Race",
    votesPage: "Votes",
    keyOnly: "Key only",
    allTopics: "All topics",
    sessionPdf: "Votes PDF",
    residence: "residence",
    tabs: { overview: "Overview", timeline: "Timeline" },
    sections: {
      summary: "Summary",
      candidacies: "2026 candidacies",
      history: "Election history 2018–2022",
      business: "Companies and roles",
      votes: "Council votes",
      assets: "Asset declarations",
      campaign: "Campaign",
      media: "Media and statements",
      research: "Further research",
      sources: "Sources",
    },
    aiLabel: "AI-generated summary of the facts below",
    templateLabel:
      "Template summary without AI, built only from the facts below",
    aiNote: (model: string, date: string) =>
      `Model ${model} · generated ${date} · every sentence cites facts`,
    notFoundIn: "Not found in:",
    ballotNo: "ballot no.",
    party: "Party",
    occupation: "Occupation",
    histCols: {
      year: "Year",
      race: "Race",
      party: "Party",
      occupation: "Occupation",
      result: "Result",
      votes: "Votes",
      match: "Match",
    },
    elected: "elected",
    notElected: "not elected",
    votes: (n: string) => `${n} votes`,
    current: "present",
    terminated: "organisation dissolved",
    match: "Match:",
    ambiguous: (n: number) => `ambiguous match: ${n} people`,
    namesakes: (n: number) => `${n} candidates in the region share this name`,
    researchNote:
      "Links are built from the name and municipality. We do not open them for you and store nothing from them.",
    timelineNote: "The same facts as the overview, oldest first.",
    undated: "Undated",
    attendance: (pct: string, present: number, total: number) =>
      `attendance ${pct} % (${present} of ${total} votes)`,
    keyVotes: "Key votes",
    keyVotesRule:
      "Key votes are chosen by one rule for the whole council: budget, final accounts, zoning plan, loans, property and narrow votes.",
    topicAuto: "Topic assigned automatically",
    noItems: "No items",
    choice: {
      for: "FOR",
      against: "AGAINST",
      abstain: "ABSTAINED",
      not_voting: "DID NOT VOTE",
      absent: "ABSENT",
    },
    counts: "for : against : abstained",
    inconsistency: "Source inconsistency: counts and names do not match",
    session: (n: number | null, date: string) =>
      n ? `session ${n} · ${date}` : `session ${date}`,
    allVotes: (n: number) => `All votes (${n})`,
    notPublishing: "This body does not publish named votes",
    soon: "In preparation",
    retrieved: "retrieved",
    snapshot: "copy",
    perAccording: "according to",
    rating: "Demagog.sk rating",
    score: "TI Slovakia evaluation",
    transparent: "Transparent account",
    web: "Campaign website",
    year: "year",
    income: "income from public office",
    otherIncome: "other income",
    realEstate: "real estate",
    publicFunction: "public office",
  },
  partyPage: {
    eyebrow: "Party or coalition",
    lede: (n: number) =>
      `${n} candidacies in the Nitra region, by race. Includes coalitions the party runs in.`,
  },
  list: {
    title: "Candidates",
    lede: "Every race in the Nitra region. Pick a district and municipality; candidates in each race are in ballot order.",
    regional: "Nitra self-governing region elections",
    municipal: "Municipalities by district",
    stats: {
      candidates: "candidates",
      municipalities: "municipalities",
      races: "races",
    },
    allDistricts: "All districts",
  },
  notFound: {
    title: "Page not found",
    lede: "The link is invalid or has changed. Try the search.",
  },
  error: {
    title: "The site is temporarily unavailable",
    lede: "The database is not responding. The data comes from these public sources:",
    retry: "Try again",
  },
};

const hu: Dict = {
  ...en,
  tagline: "A Nyitrai kerület minden jelöltje. Csak tények, forrással.",
  nav: {
    label: "Fő navigáció",
    results: "Választási eredmények",
    candidates: "Jelöltek",
    method: "Módszertan",
    sources: "Források",
    corrections: "Javítások",
  },
  langName: "Nyelv",
  search: {
    label: "Jelölt, párt vagy település keresése",
    placeholder: "Jelölt, párt vagy település",
    submit: "Keresés",
    groups: {
      person: "Jelöltek",
      party: "Pártok",
      municipality: "Települések",
      okres: "Járások",
    },
    okres: (name: string) => `${name} járás`,
    okresMeta: (n: number) => `${n} település`,
    empty: (q: string) =>
      `Nincs találat erre: „${q}”. Ellenőrizd a helyesírást, vagy válassz települést a térképen.`,
    showAll: "összes",
    title: "Keresés",
    min: "Írj legalább 2 karaktert.",
    results: (n: number) => `${n} találat`,
  },
  home: {
    ...en.home,
    countdownBefore: "A szavazóhelyiségek nyitásáig",
    countdownOpen: "A szavazóhelyiségek zárásáig",
    closed: "A 2026. október 24-i választás véget ért",
    h1a: "Minden jelölt.",
    h1b: "Csak tények.",
    lede: (people: string, municipalities: number) =>
      `<b>${people} jelölt</b> a Nyitrai kerület ${municipalities} településéről. Minden adatnál ott a nyilvános forrás és a lekérés dátuma.`,
    mapLabel: (n: number) =>
      `A Nyitrai kerület térképe ${n} település és 7 járás határával`,
    mapNote: "Település- és járáshatárok · geoBoundaries",
    tipDistrict: "Járás",
    tipMunicipality: "Település",
    tipCount: "Települések",
    tipArea: "Terület",
    tipClick: "Kattintásra",
    tipOpenList: "lista",
    tipOpenBallot: "szavazólapom",
    tipCandidates: "Jelöltek",
    ballotTitle: "Az én szavazólapom",
    ballotHint:
      "Válassz települést a térképen vagy a keresőben. Megmutatjuk a négy választást, amelyben szavazol.",
  },
  footer: {
    data: (date: string) =>
      `Jelöltek: SK Belügyminisztérium, ${date} szerint · Határok: geoBoundaries (CC BY 4.0) · Településnevek: Wikidata`,
    report: "Hiba bejelentése",
    neutral: "Senkit sem ajánlunk és nem értékelünk.",
  },
  race: {
    ...en.race,
    kind: {
      mayor: "Polgármester",
      municipal_council: "Önkormányzati képviselők",
      regional_governor: "A Nyitrai kerület elnöke",
      regional_council: "Megyei képviselők (NSK)",
    },
    kindShort: {
      mayor: "Polgármester",
      municipal_council: "Képviselők",
      regional_governor: "NSK elnök",
      regional_council: "NSK képviselők",
    },
    district: (n: number) => `${n}. választókerület`,
    wholeRegion: "az egész kerület",
    candidates: (n: number) => `${n} jelölt`,
    seats: (n: number) => `${n} mandátum`,
    ballotOrder:
      "A jelöltek mindig a szavazólap sorrendjében szerepelnek. A lista másként nem rendezhető.",
    none: "Ebben a választásban nincs bejegyzett jelölt.",
    cols: {
      no: "Sz.",
      name: "Név",
      age: "Kor",
      occupation: "Foglalkozás",
      party: "Párt",
      result: "2026-os eredmény",
      history: "Jelöltségek / megválasztás 2018–2022",
      firms: "Cégek",
      attendance: "Részvétel a szavazásokon",
      summary: "Összefoglaló",
    },
    notMember: "—",
    elected: "megválasztva",
    counting: "A számlálás folyamatban — az eredmények még nem teljesek.",
    resultsUnavailable:
      "A Statisztikai Hivatal eredményei ideiglenesen nem elérhetők. Próbáld később.",
    resultsUpdated: (when: string) =>
      `Statisztikai Hivatal eredményei · frissítve ${when}`,
    resultsCached: "az utolsó mentett pillanatképből",
    resultsSource: "volbysr.sk",
    data: (date: string) => `SK Belügyminisztérium adatai, ${date}`,
  },
  resultsPage: {
    title: "2026-os választási eredmények",
    lede: "A Statisztikai Hivatal hivatalos eredményei a Nyitrai önkormányzati kerületre. Rangsor nélkül, csak a szavazólap sorrendje.",
    vuc: "Nyitrai önkormányzati kerület",
    governor: "NSK elnök",
    council: "NSK képviselő-testület",
    councilHint:
      "Eredmények választókerületenként. Nyiss meg egy kerületet a jelöltekhez és szavazatokhoz, amint a Statisztikai Hivatal közzéteszi őket.",
    municipal: "Települések",
    municipalHint:
      "A polgármesteri és képviselői eredmények az egyes választások oldalán vannak. Válassz települést a térképen vagy a jelöltlistán.",
    openRace: "Választás megnyitása",
    openMunicipal: "Településlista",
  },
  ballot: {
    title: (name: string) => `Szavazólap · ${name}`,
    pickDistrict: "Önkormányzati választókerület",
    dontKnow: "Nem tudom → minden választókerület",
    allDistricts: "Minden választókerület",
    districtLabel: (n: number) => `${n}. kerület`,
    noAddressMap:
      "A választókerületet nem cím alapján határozzuk meg: nincs nyilvános utcajegyzék. A választási értesítőn megtalálod.",
    regionalSplit:
      "Az Érsekújvári járásban két NSK-választókerület van (4 és 6). Hogy melyik a tiéd, a szavazólapon látod.",
    open: "Választás megnyitása",
    district: "Járás",
  },
  profile: {
    ...en.profile,
    age: (n: number) => `${n} éves`,
    votesScope:
      "A név szerinti szavazásokat egyelőre a nyitrai városi képviselő-testületből gyűjtjük. Továbbiak következnek.",
    sourceDown: (name: string, date: string) =>
      `A(z) ${name} forrás a gyűjtéskor nem volt elérhető (${date}).`,
    residenceMap: (place: string) =>
      `A Nyitrai kerület térképe, kiemelve: ${place}`,
    residenceNote: "Lakóhely a jelöltlista szerint",
    raceOf: "Választás",
    votesPage: "Szavazások",
    keyOnly: "Csak kulcsszavazások",
    allTopics: "Minden téma",
    sessionPdf: "Szavazások PDF",
    residence: "lakóhely",
    tabs: { overview: "Áttekintés", timeline: "Idővonal" },
    sections: {
      summary: "Összefoglaló",
      candidacies: "Jelöltségek 2026",
      history: "Választási előzmények 2018–2022",
      business: "Cégek és tisztségek",
      votes: "Szavazások",
      assets: "Vagyonnyilatkozatok",
      campaign: "Kampány",
      media: "Média és nyilatkozatok",
      research: "További kutatás",
      sources: "Források",
    },
    aiLabel: "Az alábbi tényekből MI által készített összefoglaló",
    templateLabel:
      "Sablonból, MI nélkül készült összefoglaló az alábbi tényekből",
    aiNote: (model: string, date: string) =>
      `Modell: ${model} · készült ${date} · minden mondat tényekre hivatkozik`,
    notFoundIn: "Nem található:",
    ballotNo: "sorszám",
    party: "Párt",
    occupation: "Foglalkozás",
    histCols: {
      year: "Év",
      race: "Választás",
      party: "Párt",
      occupation: "Foglalkozás",
      result: "Eredmény",
      votes: "Szavazat",
      match: "Egyezés",
    },
    elected: "megválasztva",
    notElected: "nem választották meg",
    votes: (n: string) => `${n} szavazat`,
    current: "máig",
    terminated: "megszűnt szervezet",
    match: "Egyezés:",
    ambiguous: (n: number) => `nem egyértelmű egyezés: ${n} személy`,
    namesakes: (n: number) => `a kerületben ${n} jelöltnek ugyanez a neve`,
    researchNote:
      "A hivatkozások a névből és a településből készülnek. Nem nyitjuk meg őket helyetted, és semmit sem tárolunk belőlük.",
    timelineNote: "Ugyanazok a tények, mint az áttekintésben, a legrégebbitől.",
    undated: "Dátum nélkül",
    attendance: (pct: string, present: number, total: number) =>
      `részvétel ${pct} % (${total} szavazásból ${present})`,
    keyVotes: "Kulcsszavazások",
    keyVotesRule:
      "A kulcsszavazásokat egyetlen szabály választja ki az egész testületre: költségvetés, zárszámadás, területrendezési terv, hitelek, vagyon és szoros szavazások.",
    topicAuto: "A témát automatikusan rendeltük hozzá",
    noItems: "Nincs napirendi pont",
    choice: {
      for: "IGEN",
      against: "NEM",
      abstain: "TARTÓZKODOTT",
      not_voting: "NEM SZAVAZOTT",
      absent: "TÁVOL",
    },
    counts: "igen : nem : tartózkodott",
    inconsistency: "Ellentmondás a forrásban: a számok és a nevek nem egyeznek",
    session: (n: number | null, date: string) =>
      n ? `${n}. ülés · ${date}` : `ülés ${date}`,
    allVotes: (n: number) => `Összes szavazás (${n})`,
    notPublishing: "A testület nem teszi közzé a név szerinti szavazást",
    soon: "Előkészületben",
    retrieved: "lekérve",
    snapshot: "másolat",
    perAccording: "forrás:",
    rating: "Demagog.sk értékelése",
    score: "TI Szlovákia értékelése",
    transparent: "Átlátható számla",
    web: "Kampányoldal",
    year: "év",
    income: "jövedelem a közfunkcióból",
    otherIncome: "egyéb jövedelem",
    realEstate: "ingatlanok",
    publicFunction: "közfunkció",
  },
  partyPage: {
    eyebrow: "Párt vagy koalíció",
    lede: (n: number) =>
      `${n} jelöltség a Nyitrai kerületben, választásonként. A koalíciókat is tartalmazza.`,
  },
  list: {
    title: "Jelöltek",
    lede: "A Nyitrai kerület minden választása. Válassz járást és települést; a jelöltek a szavazólap sorrendjében szerepelnek.",
    regional: "Választások a Nyitrai önkormányzati kerületben",
    municipal: "Települések járásonként",
    stats: {
      candidates: "jelölt",
      municipalities: "település",
      races: "választás",
    },
    allDistricts: "Minden járás",
  },
  notFound: {
    title: "Az oldal nem található",
    lede: "A hivatkozás érvénytelen vagy megváltozott. Próbáld a keresőt.",
  },
  error: {
    title: "Az oldal átmenetileg nem érhető el",
    lede: "Az adatbázis most nem válaszol. Az adatok ezekből a nyilvános forrásokból származnak:",
    retry: "Újra",
  },
};

const DICTS: Record<Lang, Dict> = { sk, en, hu };

export function t(lang: Lang): Dict {
  return DICTS[lang];
}

export type { Dict };

const LOCALE: Record<Lang, string> = { sk: "sk-SK", en: "en-GB", hu: "hu-HU" };

export function formatNumber(lang: Lang, n: number): string {
  return new Intl.NumberFormat(LOCALE[lang]).format(n);
}

/**
 * Dates arrive from the database as "YYYY-MM-DD" text (queries cast them, so no time zone can
 * shift a day) and are shown in Slovak numeric style in every language: 24. 10. 2026.
 */
export function formatDate(value: string | null): string {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}

export function yearOf(value: string | null): number | null {
  return value ? Number(value.slice(0, 4)) : null;
}

/** Shortens a vote description at a word; rows show two lines and the full wording is in the session PDF. */
export function clip(text: string, max = 300) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")) || cut}…`;
}
