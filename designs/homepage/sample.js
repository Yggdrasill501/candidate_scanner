/* Example data for the page designs. Every person, company and party here is fictional;
   municipalities, districts, sources and race types are real. Pages label this as "Ukážka". */
window.KVSAMPLE = (function () {
  const SRC = {
    mv: { code: "MV SR", name: "Zoznamy kandidátov, Ministerstvo vnútra SR", url: "https://www.minv.sk/?samosprava26-info10", date: "23. 10. 2026" },
    su: { code: "ŠÚ SR", name: "Výsledky volieb, Štatistický úrad SR", url: "https://volby.statistics.sk/", date: "21. 10. 2026" },
    orsr: { code: "ORSR", name: "Obchodný register SR", url: "https://www.orsr.sk/", date: "22. 10. 2026" },
    rpvs: { code: "RPVS", name: "Register partnerov verejného sektora", url: "https://rpvs.gov.sk/", date: "22. 10. 2026" },
  };

  const people = [
    {
      slug: "jan-vzorovy",
      name: "Ján Vzorový",
      titlesBefore: "Ing.",
      titlesAfter: "",
      age: 54,
      residence: "Šahy",
      okres: "Levice",
      occupation: "primátor mesta",
      searchMeta: "Primátor · Šahy",
      summary: {
        sk: [
          ["Kandiduje na primátora mesta Šahy a do Zastupiteľstva Nitrianskeho samosprávneho kraja.", ["c1", "c2"]],
          ["Primátorom Šiah bol zvolený v roku 2022, predtým bol od roku 2018 poslancom mestského zastupiteľstva.", ["h1", "h2"]],
          ["Obchodný register ho uvádza ako konateľa stavebnej spoločnosti; trvanie tejto funkcie kandidát namieta.", ["b1"]],
          ["Ďalší záznam o spoločníkovi inej firmy v rokoch 2009 – 2016 sa s ním zhoduje len menom.", ["b2"]],
        ],
      },
      candidacies: [
        { id: "c1", race: "Primátor mesta Šahy", raceId: "primator-sahy", where: "mesto Šahy · 1 mandát", ballot: 3, party: "nezávislý kandidát", occupation: "primátor mesta", src: "mv" },
        { id: "c2", race: "Poslanci Zastupiteľstva NSK", raceId: "poslanci-nsk-levice", where: "volebný obvod Levice", ballot: 41, party: "Koalícia B + C", occupation: "primátor mesta", src: "mv" },
      ],
      history: [
        { id: "h1", year: 2022, election: "Komunálne voľby", race: "Primátor mesta Šahy", party: "nezávislý kandidát", occupation: "podnikateľ", elected: true, votes: 1912, reason: "meno + obec + vek", src: "su" },
        { id: "h2", year: 2018, election: "Komunálne voľby", race: "Poslanec MsZ Šahy, obvod 1", party: "nezávislý kandidát", occupation: "podnikateľ", elected: true, votes: 804, reason: "meno + obec + vek", src: "su" },
        { id: "h3", year: 2017, election: "Voľby do VÚC", race: "Poslanec Zastupiteľstva NSK, obvod Levice", party: "Strana D", occupation: "podnikateľ", elected: false, votes: 2140, reason: "meno + obec + vek", src: "su" },
        { id: "h4", year: 2014, election: "Komunálne voľby", race: "Poslanec MsZ Šahy, obvod 1", party: "nezávislý kandidát", occupation: "stavebný technik", elected: false, votes: 411, reason: "meno + obec + vek", src: "su" },
      ],
      business: [
        {
          id: "b1", role: "Konateľ", org: "Vzorová stavebná s.r.o.", ico: "12345678", from: "2011", to: null, src: "orsr",
          match: [["meno", true], ["obec bydliska", true, "Šahy"], ["rok narodenia", null, "neuvedený v zdroji"]],
          dispute: {
            status: "Namietané",
            thread: [
              { who: "Ing. Ján Vzorový, kandidát", date: "14. 10. 2026", text: "Funkciu konateľa som ukončil v marci 2021. Zmena čaká na zápis v obchodnom registri." },
              { who: "Koho volím", date: "16. 10. 2026", text: "ORSR k 22. 10. 2026 uvádza funkciu ako platnú. Údaj zobrazujeme podľa registra a vaše vyjadrenie hneď pri ňom. Po zápise zmeny údaj upravíme a zmenu uvedieme v protokole opráv." },
            ],
          },
        },
        { id: "b2", role: "Spoločník", org: "Príklad Agro s.r.o.", ico: "87654321", from: "2009", to: "2016", src: "orsr",
          match: [["meno", true], ["obec bydliska", false, "Levice"], ["rok narodenia", null, "neuvedený v zdroji"]], note: "V kraji kandidujú 2 osoby s týmto menom." },
        { id: "b3", role: "Konečný užívateľ výhod", org: "Vzorová stavebná s.r.o.", ico: "12345678", from: "2018", to: null, src: "rpvs",
          match: [["meno", true], ["rok narodenia", true, "1972"], ["obec bydliska", true, "Šahy"]] },
      ],
      notFound: {},
    },
    {
      slug: "eva-prikladna",
      name: "Eva Príkladná",
      titlesBefore: "Mgr.",
      titlesAfter: "",
      age: 38,
      residence: "Nitra",
      okres: "Nitra",
      occupation: "učiteľka",
      searchMeta: "Poslankyňa MsZ · Nitra",
      summary: {
        sk: [
          ["Kandiduje do Mestského zastupiteľstva v Nitre vo volebnom obvode č. 3 za Stranu A.", ["c1"]],
          ["V komunálnych voľbách ani vo voľbách do VÚC v rokoch 2010 – 2022 sme ju ako kandidátku nenašli.", []],
          ["Obchodný register ju neuvádza; register RPVS nebol pri zbere dostupný.", []],
        ],
      },
      candidacies: [
        { id: "c1", race: "Poslanci Mestského zastupiteľstva Nitra", raceId: "msz-nitra-3", where: "volebný obvod č. 3 · 5 mandátov", ballot: 7, party: "Strana A", occupation: "učiteľka", src: "mv" },
      ],
      history: [],
      business: [],
      notFound: {
        history: "Nenájdené v: Štatistický úrad SR, komunálne voľby 2010, 2014, 2018, 2022 a voľby do VÚC 2013, 2017, 2022.",
        business: "Nenájdené v: Obchodný register SR (22. 10. 2026).",
        unavailable: "Zdroj RPVS nebol dostupný pri zbere (22. 10. 2026). Zber zopakujeme pri ďalšom behu.",
      },
    },
    {
      slug: "gabor-minta",
      name: "Gábor Minta",
      titlesBefore: "PhDr.",
      titlesAfter: "PhD.",
      age: 61,
      residence: "Želiezovce",
      okres: "Levice",
      occupation: "historik",
      searchMeta: "Predseda NSK · Želiezovce",
      summary: {
        sk: [
          ["Kandiduje na predsedu Nitrianskeho samosprávneho kraja za Koalíciu B + C.", ["c1"]],
          ["Do Zastupiteľstva NSK bol zvolený v rokoch 2017 a 2022 vo volebnom obvode Levice; v roku 2013 zvolený nebol.", ["h1", "h2", "h4"]],
          ["V roku 2018 bol zvolený do mestského zastupiteľstva v Želiezovciach.", ["h3"]],
          ["Kandidatúra na primátora Želiezoviec z roku 2010 sa zhoduje s dvoma osobami rovnakého mena, preto ju uvádzame s označením nejednoznačnej zhody.", ["h5"]],
        ],
        hu: [
          ["A B + C koalíció jelöltjeként indul a Nyitra Megyei Önkormányzat elnöki tisztségéért.", ["c1"]],
          ["2017-ben és 2022-ben a lévai választókerületben megyei képviselővé választották; 2013-ban nem jutott be.", ["h1", "h2", "h4"]],
          ["2018-ban Zselíz városi képviselő-testületébe választották.", ["h3"]],
          ["A 2010-es zselízi polgármesteri jelöltség két azonos nevű személyhez is illeszkedik, ezért bizonytalan egyezésként jelöljük.", ["h5"]],
        ],
      },
      candidacies: [
        { id: "c1", race: "Predseda Nitrianskeho samosprávneho kraja", raceId: "predseda-nsk", where: "celý Nitriansky kraj · 1 mandát", ballot: 5, party: "Koalícia B + C", occupation: "historik", src: "mv" },
      ],
      history: [
        { id: "h1", year: 2022, election: "Voľby do VÚC", race: "Poslanec Zastupiteľstva NSK, obvod Levice", party: "Koalícia B + C", occupation: "historik", elected: true, votes: 6318, reason: "meno + obec + vek", src: "su" },
        { id: "h3", year: 2018, election: "Komunálne voľby", race: "Poslanec MsZ Želiezovce", party: "Koalícia B + C", occupation: "historik", elected: true, votes: 642, reason: "meno + obec + vek", src: "su" },
        { id: "h2", year: 2017, election: "Voľby do VÚC", race: "Poslanec Zastupiteľstva NSK, obvod Levice", party: "Koalícia B + C", occupation: "historik", elected: true, votes: 5902, reason: "meno + obec + vek", src: "su" },
        { id: "h4", year: 2013, election: "Voľby do VÚC", race: "Poslanec Zastupiteľstva NSK, obvod Levice", party: "Strana F", occupation: "učiteľ", elected: false, votes: 3107, reason: "meno + obec + vek", src: "su" },
        { id: "h5", year: 2010, election: "Komunálne voľby", race: "Primátor mesta Želiezovce", party: "nezávislý kandidát", occupation: "učiteľ", elected: false, votes: 1088, reason: "nejednoznačná zhoda: 2 osoby", ambiguous: true, src: "su" },
      ],
      business: [
        { id: "b1", role: "Konateľ", org: "Minta Vydavateľstvo s.r.o.", ico: "11223344", from: "2004", to: "2012", src: "orsr",
          match: [["meno", true], ["obec bydliska", true, "Želiezovce"], ["rok narodenia", null, "neuvedený v zdroji"]] },
      ],
      notFound: {},
    },
  ];

  // candidate lists per race, in ballot order; rows: [ballot, titles, name, age, occupation, party, ran, won, firms, slug]
  const races = [
    { id: "primator-sahy", title: "Primátor mesta Šahy", kind: "mayor", obec: "Šahy", okres: "Levice", where: "mesto Šahy", seats: 1, total: 4, rows: [
      [1, "", "Mária Modelová", 47, "ekonómka", "Strana A", 1, 0, 0],
      [2, "Ing.", "Ladislav Návrh", 59, "stavebný inžinier", "Strana D", 2, 1, 1],
      [3, "Ing.", "Ján Vzorový", 54, "primátor mesta", "nezávislý kandidát", 4, 2, 3, "jan-vzorovy"],
      [4, "", "Zoltán Skúška", 33, "IT špecialista", "nezávislý kandidát", 0, 0, 0],
    ] },
    { id: "msz-nitra-3", title: "Poslanci Mestského zastupiteľstva Nitra", kind: "council", obec: "Nitra", okres: "Nitra", where: "volebný obvod č. 3", seats: 5, total: 9, rows: [
      [1, "MUDr.", "Katarína Predlohová", 52, "lekárka", "Strana A", 2, 2, 1],
      [2, "", "Róbert Nákres", 44, "živnostník", "Hnutie E", 1, 0, 2],
      [3, "Bc.", "Anna Skicová", 29, "sociálna pracovníčka", "nezávislá kandidátka", 0, 0, 0],
      [4, "Ing.", "Peter Pokusný", 61, "dôchodca", "Strana D", 3, 2, 0],
      [5, "", "Erika Maketová", 40, "predavačka", "Hnutie E", 0, 0, 0],
      [6, "PaedDr.", "Tibor Šablóna", 57, "riaditeľ školy", "Koalícia B + C", 3, 3, 1],
      [7, "Mgr.", "Eva Príkladná", 38, "učiteľka", "Strana A", 0, 0, 0, "eva-prikladna"],
      [8, "", "Martin Vzorka", 35, "hasič", "nezávislý kandidát", 1, 0, 0],
      [9, "Ing.", "Helena Ukážková", 49, "projektová manažérka", "Koalícia B + C", 1, 1, 4],
    ] },
    { id: "predseda-nsk", title: "Predseda Nitrianskeho samosprávneho kraja", kind: "governor", obec: null, okres: null, where: "celý kraj", seats: 1, total: 6, rows: [
      [1, "Ing.", "Igor Koncept", 58, "manažér", "Strana D", 2, 1, 5],
      [2, "", "Judit Próba", 46, "právnička", "Hnutie E", 1, 0, 1],
      [3, "doc. Ing.", "Viktor Predloha", 63, "vysokoškolský pedagóg", "Strana A", 4, 2, 2],
      [4, "", "Lenka Šablónová", 41, "podnikateľka", "nezávislá kandidátka", 0, 0, 3],
      [5, "PhDr.", "Gábor Minta", 61, "historik", "Koalícia B + C", 5, 3, 1, "gabor-minta"],
      [6, "", "Ernő Példa", 55, "agronóm", "Strana F", 2, 0, 1],
    ] },
    { id: "poslanci-nsk-levice", title: "Poslanci Zastupiteľstva NSK", kind: "regional", obec: null, okres: "Levice", where: "volebný obvod Levice", seats: 8, total: 47, partial: true, rows: [
      [38, "", "Tomáš Tvar", 39, "elektrikár", "Hnutie E", 0, 0, 0],
      [39, "Mgr.", "Silvia Vzorová", 50, "farmaceutka", "Strana A", 1, 0, 1],
      [40, "", "Attila Minta", 34, "kuchár", "Strana F", 0, 0, 0],
      [41, "Ing.", "Ján Vzorový", 54, "primátor mesta", "Koalícia B + C", 4, 2, 3, "jan-vzorovy"],
      [42, "", "Dana Výkresová", 58, "účtovníčka", "Strana D", 2, 1, 0],
      [43, "Ing.", "Pavol Zadanie", 45, "agronóm", "nezávislý kandidát", 0, 0, 2],
    ] },
  ];

  return { SRC, people, races };
})();
