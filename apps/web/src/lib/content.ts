// Text of the methodology and corrections pages in the three site languages. Each section is a
// heading and paragraphs; list items start with "• ".
import type { Lang } from "./i18n";

export interface Doc {
  title: string;
  lede: string;
  principles?: { k: string; h: string; p: string }[];
  sections: { id: string; h: string; body: string[] }[];
}

const metodika: Record<Lang, Doc> = {
  sk: {
    title: "Metodika",
    lede: "Ako vzniká každý profil: rovnaký postup pre všetkých kandidátov, len verejné zdroje a pri každom údaji odkaz, z ktorého pochádza.",
    principles: [
      {
        k: "01",
        h: "Rovnako pre všetkých",
        p: "Každého kandidáta hľadáme v rovnakých zdrojoch rovnakým postupom a ukazujeme rovnaké sekcie.",
      },
      {
        k: "02",
        h: "Iba fakty so zdrojom",
        p: "Pri každom údaji je odkaz na verejný zdroj, dátum zberu a uložená kópia dokumentu.",
      },
      {
        k: "03",
        h: "Nikoho nehodnotíme",
        p: "Kandidátov neradíme, neodporúčame ani nehodnotíme. Poradie je vždy podľa hlasovacieho lístka.",
      },
    ],
    sections: [
      {
        id: "zber",
        h: "Ako zbierame údaje",
        body: [
          "Údaje zbierajú dávkové procesy, ktoré spúšťame my. Stránka sama nič nesťahuje, keď si ju otvoríš: číta len našu databázu.",
          "Každý stiahnutý súbor uložíme a zaznamenáme jeho odtlačok SHA-256. Každý fakt odkazuje na kópiu, z ktorej vznikol, takže sa dá overiť, čo zdroj v danom čase uvádzal. Kópie nikdy nemeníme ani nemažeme.",
          "Keď zdroj pri zbere neodpovedá, skúsime to trikrát. Potom pri kandidátovi uvedieme, že zdroj nebol dostupný, a neukážeme „Nenájdené“.",
        ],
      },
      {
        id: "zhoda",
        h: "Ako priraďujeme záznamy ku kandidátom",
        body: [
          "Väčšina registrov uvádza len meno. Preto pri každom zázname ukazujeme, prečo sme ho kandidátovi priradili („Zhoda“): či sedí meno, obec, vek alebo dátum narodenia, a koľko kandidátov v kraji má rovnaké meno.",
          "• Kandidatúry 2026 berieme priamo zo zoznamov MV SR. Rovnaké meno, vek a obec znamenajú jedného človeka.",
          "• Minulé voľby: meno, obec a vek vtedy (vek dnes mínus uplynulé roky, ±1). Ak sedí viac ľudí, záznam ukážeme pri každom z nich s označením „nejednoznačná zhoda“.",
          "• Firmy a organizácie: meno a podľa možnosti obec alebo dátum narodenia z registra. Dátumy narodenia a adresy používame len na priradenie, nezverejňujeme ich.",
          "• Tituly na priradenie nepoužívame, pretože sa v čase menia.",
          "Žiadne priradenie neskrývame. Ak si myslíš, že záznam patrí niekomu inému, napíš nám.",
        ],
      },
      {
        id: "zhrnutie",
        h: "Zhrnutie vygenerované AI",
        body: [
          "Zhrnutie píše jazykový model len z faktov uložených pri danom kandidátovi. Nemá prístup na internet ani k inému kandidátovi.",
          "Každá veta musí odkazovať aspoň na jeden fakt; čísla pri vetách vedú priamo k nim. Veta bez odkazu sa zahodí. Rovnaký prompt, model a dĺžka platia pre všetkých.",
          "Zakázané sú hodnotiace slová, špekulácie a porovnávanie s inými kandidátmi. Ak zhrnutie zatiaľ nie je vygenerované, zobrazíme pevnú šablónu bez AI, zostavenú z rovnakých faktov, a označíme ju.",
        ],
      },
      {
        id: "hlasovania",
        h: "Hlasovania v zastupiteľstvách",
        body: [
          "Menovité hlasovania berieme zo zápisov, ktoré zastupiteľstvo zverejňuje. Zatiaľ spracúvame Mestské zastupiteľstvo Nitra; ďalšie pribudnú.",
          "Kľúčové hlasovania vyberá jedno pravidlo pre celé zastupiteľstvo: rozpočet a jeho zmeny, záverečný účet, územný plán, úvery, predaj alebo nájom majetku a hlasovania rozhodnuté o tri hlasy alebo menej.",
          "Body programu priraďuje k témam model s pevným promptom; pri téme je vždy uvedené, že bola priradená automaticky. Ak sa počty v zdroji nezhodujú s menami, ukážeme to ako „Nesúlad v zdroji“.",
        ],
      },
      {
        id: "nepokryvame",
        h: "Čo zatiaľ nepokrývame",
        body: [
          "• Fotografie kandidátov: nie sú dostupné pre všetkých rovnako.",
          "• Platené databázy (Finstat, mediálne archívy): každý údaj má byť overiteľný zadarmo. Na Finstat a ďalšie registre odkazujeme v sekcii „Ďalší výskum“.",
          "• Súkromné profily na sociálnych sieťach a obdobie pred rokom 1989.",
          "• Výsledky volieb 2026 a pôsobenie po nich.",
          "• Iné kraje ako Nitriansky.",
        ],
      },
      {
        id: "neutralita",
        h: "Neutralita",
        body: [
          "Stránka nikoho neodporúča, nezoraďuje ani nehodnotí. Kandidáti sú vždy v poradí podľa hlasovacieho lístka a zoznam sa nedá zoradiť inak.",
          "Strany nemajú farby ani logá. Hodnotenia tretích strán (napr. Transparency International alebo Demagog.sk) uvádzame ako údaj so zdrojom, nie ako náš názor.",
        ],
      },
    ],
  },
  en: {
    title: "Methodology",
    lede: "How each profile is made: the same process for every candidate, public sources only, and a link to the source of every fact.",
    principles: [
      {
        k: "01",
        h: "The same for everyone",
        p: "Every candidate is searched in the same sources by the same process and shown with the same sections.",
      },
      {
        k: "02",
        h: "Only sourced facts",
        p: "Every fact links to its public source, the retrieval date and a stored copy of the document.",
      },
      {
        k: "03",
        h: "No ratings",
        p: "We do not rank, recommend or rate candidates. Order is always the official ballot order.",
      },
    ],
    sections: [
      {
        id: "zber",
        h: "How we collect data",
        body: [
          "Data is collected by batch processes we run. The site itself fetches nothing when you open it: it only reads our database.",
          "Every downloaded file is stored with its SHA-256 fingerprint. Every fact points to the copy it came from, so anyone can check what the source said at that time. Copies are never changed or deleted.",
          "When a source does not respond, we retry three times. Then the profile says the source was unavailable instead of “Not found”.",
        ],
      },
      {
        id: "zhoda",
        h: "How records are linked to candidates",
        body: [
          "Most registers list only a name. So every record shows why it was linked (“Match”): whether name, municipality, age or birth date agree, and how many candidates in the region share the name.",
          "• 2026 candidacies come straight from the Ministry of Interior lists. Same name, age and municipality mean one person.",
          "• Past elections: name, municipality and age at the time (today’s age minus elapsed years, ±1). If several people qualify, the record appears on each profile marked “ambiguous match”.",
          "• Companies and organisations: name and, where available, municipality or birth date from the register. Birth dates and addresses are used only for matching and never published.",
          "• Titles are not used for matching because they change over time.",
          "No link is hidden. If you think a record belongs to someone else, tell us.",
        ],
      },
      {
        id: "zhrnutie",
        h: "AI-generated summary",
        body: [
          "The summary is written by a language model from the facts stored for that candidate only. It has no web access and sees no other candidate.",
          "Every sentence must cite at least one fact; the numbers lead straight to them. A sentence without a citation is discarded. The same prompt, model and length apply to everyone.",
          "Evaluative words, speculation and comparisons with other candidates are not allowed. Where no summary has been generated yet, a fixed template without AI, built from the same facts, is shown and labelled.",
        ],
      },
      {
        id: "hlasovania",
        h: "Council votes",
        body: [
          "Named votes come from the records councils publish. So far we process the Nitra city council; more will follow.",
          "Key votes are chosen by one rule for the whole council: budget and amendments, final accounts, zoning plan, loans, sale or lease of property, and votes decided by three votes or fewer.",
          "Agenda items are assigned to topics by a model with a fixed prompt; every topic says it was assigned automatically. Where counts and names in the source disagree, we show “Source inconsistency”.",
        ],
      },
      {
        id: "nepokryvame",
        h: "What we do not cover yet",
        body: [
          "• Candidate photos: not equally available for everyone.",
          "• Paid databases (Finstat, media archives): every fact should be verifiable for free. Finstat and other registers are linked under “Further research”.",
          "• Private social media profiles and the period before 1989.",
          "• 2026 election results and what happens after them.",
          "• Regions other than Nitra.",
        ],
      },
      {
        id: "neutralita",
        h: "Neutrality",
        body: [
          "The site recommends, ranks and rates no one. Candidates are always in ballot order and the list cannot be sorted otherwise.",
          "Parties have no colours or logos. Third-party evaluations (such as Transparency International or Demagog.sk) are shown as sourced facts, not as our opinion.",
        ],
      },
    ],
  },
  hu: {
    title: "Módszertan",
    lede: "Így készül minden profil: minden jelöltre ugyanaz az eljárás, csak nyilvános források, és minden adatnál hivatkozás a forrására.",
    principles: [
      {
        k: "01",
        h: "Mindenkire ugyanúgy",
        p: "Minden jelöltet ugyanazokban a forrásokban, ugyanúgy keresünk, és ugyanazokkal a részekkel mutatunk be.",
      },
      {
        k: "02",
        h: "Csak forrással ellátott tények",
        p: "Minden adatnál ott a nyilvános forrás, a lekérés dátuma és a dokumentum tárolt másolata.",
      },
      {
        k: "03",
        h: "Nem értékelünk",
        p: "A jelölteket nem rangsoroljuk, nem ajánljuk és nem értékeljük. A sorrend mindig a szavazólapé.",
      },
    ],
    sections: [
      {
        id: "zber",
        h: "Hogyan gyűjtjük az adatokat",
        body: [
          "Az adatokat általunk futtatott kötegelt folyamatok gyűjtik. Az oldal megnyitáskor semmit sem tölt le: csak a saját adatbázisunkat olvassa.",
          "Minden letöltött fájlt SHA-256 lenyomattal tárolunk. Minden tény arra a másolatra hivatkozik, amelyből készült. A másolatokat soha nem módosítjuk és nem töröljük.",
          "Ha egy forrás nem válaszol, háromszor próbálkozunk. Ezután a profil azt jelzi, hogy a forrás nem volt elérhető.",
        ],
      },
      {
        id: "zhoda",
        h: "Hogyan kapcsoljuk a rekordokat a jelöltekhez",
        body: [
          "A legtöbb nyilvántartás csak nevet közöl. Ezért minden rekordnál megmutatjuk, miért kapcsoltuk a jelölthöz („Egyezés”): egyezik-e a név, a település, a kor vagy a születési dátum, és hány jelöltnek ugyanez a neve a kerületben.",
          "• A 2026-os jelöltségek közvetlenül a belügyminisztérium listáiról származnak.",
          "• Korábbi választások: név, település és akkori kor (±1). Ha több személy is megfelel, a rekord mindegyik profilján megjelenik „nem egyértelmű egyezés” jelöléssel.",
          "• Cégek és szervezetek: név, és ha elérhető, település vagy születési dátum. A születési dátumokat és címeket csak az egyeztetéshez használjuk, nem tesszük közzé.",
          "• A titulusokat nem használjuk egyeztetésre.",
          "Egyetlen kapcsolást sem rejtünk el. Ha szerinted egy rekord másé, írj nekünk.",
        ],
      },
      {
        id: "zhrnutie",
        h: "MI által készített összefoglaló",
        body: [
          "Az összefoglalót nyelvi modell írja, kizárólag az adott jelöltnél tárolt tényekből, internet-hozzáférés nélkül.",
          "Minden mondatnak legalább egy tényre kell hivatkoznia; a számok közvetlenül oda vezetnek. Mindenkire ugyanaz a prompt, modell és hossz vonatkozik.",
          "Értékelő szavak, találgatás és más jelöltekkel való összevetés nem megengedett. Ahol még nincs összefoglaló, MI nélküli, jelölt sablon látható.",
        ],
      },
      {
        id: "hlasovania",
        h: "Szavazások a testületekben",
        body: [
          "A név szerinti szavazásokat a testületek által közzétett jegyzőkönyvekből vesszük. Egyelőre a nyitrai városi képviselő-testületet dolgozzuk fel.",
          "A kulcsszavazásokat egyetlen szabály választja ki az egész testületre: költségvetés, zárszámadás, területrendezési terv, hitelek, vagyon és legfeljebb három szavazattal eldőlt szavazások.",
          "A napirendi pontokat rögzített promptú modell sorolja témákba; ezt minden témánál jelezzük.",
        ],
      },
      {
        id: "nepokryvame",
        h: "Amit még nem fedünk le",
        body: [
          "• Jelöltfotók, fizetős adatbázisok, privát közösségimédia-profilok, az 1989 előtti időszak.",
          "• A 2026-os választás eredményei.",
          "• A Nyitrai kerületen kívüli régiók.",
        ],
      },
      {
        id: "neutralita",
        h: "Semlegesség",
        body: [
          "Az oldal senkit sem ajánl, rangsorol vagy értékel. A jelöltek mindig a szavazólap sorrendjében szerepelnek.",
          "A pártoknak nincs színe vagy logója. Harmadik felek értékeléseit forrással ellátott adatként közöljük, nem saját véleményként.",
        ],
      },
    ],
  },
};

const opravy: Record<Lang, Doc> = {
  sk: {
    title: "Opravy",
    lede: "Ak je v profile chyba alebo záznam patrí inej osobe, napíš nám. Údaj overíme v pôvodnom zdroji aj v uloženej kópii.",
    sections: [
      {
        id: "postup",
        h: "Ako postupujeme",
        body: [
          "• Prijatie: potvrdíme, že sme správu dostali, a priradíme ju ku konkrétnemu údaju.",
          "• Overenie v zdroji: údaj skontrolujeme v pôvodnom zdroji aj v uloženej kópii z času zberu.",
          "• Oprava: ak zdroj chybu potvrdí, alebo ak sme záznam priradili nesprávnej osobe, opravíme priradenie pri najbližšom zbere.",
          "• Údaj, ktorý zdroj uvádza správne, neodstránime len preto, že ho niekto namieta.",
        ],
      },
      {
        id: "co-poslat",
        h: "Čo do správy uviesť",
        body: [
          "Odkaz na profil, ktorého údaja sa správa týka, čo je podľa teba nesprávne a ak môžeš, odkaz na verejný dokument, ktorý to dokladá.",
        ],
      },
    ],
  },
  en: {
    title: "Corrections",
    lede: "If a profile contains an error or a record belongs to someone else, write to us. We check the fact in the original source and in the stored copy.",
    sections: [
      {
        id: "postup",
        h: "How we handle it",
        body: [
          "• Receipt: we confirm receipt and tie the report to a specific fact.",
          "• Check against the source: we check the original source and the copy stored at collection time.",
          "• Correction: if the source confirms the error, or a record was linked to the wrong person, we fix the link in the next collection run.",
          "• A fact the source states correctly is not removed just because someone disputes it.",
        ],
      },
      {
        id: "co-poslat",
        h: "What to include",
        body: [
          "A link to the profile, which fact you mean, what you believe is wrong and, if possible, a link to a public document that shows it.",
        ],
      },
    ],
  },
  hu: {
    title: "Javítások",
    lede: "Ha egy profilban hiba van, vagy egy rekord más személyé, írj nekünk. Az adatot az eredeti forrásban és a tárolt másolatban is ellenőrizzük.",
    sections: [
      {
        id: "postup",
        h: "Hogyan járunk el",
        body: [
          "• Átvétel: visszaigazoljuk, és a bejelentést egy konkrét adathoz rendeljük.",
          "• Ellenőrzés: megnézzük az eredeti forrást és a gyűjtéskori másolatot.",
          "• Javítás: ha a forrás megerősíti a hibát, vagy rossz személyhez kapcsoltuk a rekordot, a következő gyűjtéskor javítjuk.",
          "• A forrás által helyesen közölt adatot nem töröljük csak azért, mert valaki vitatja.",
        ],
      },
      {
        id: "co-poslat",
        h: "Mit írj a bejelentésbe",
        body: [
          "A profil hivatkozását, melyik adatról van szó, mi szerinted a hiba, és ha lehet, egy nyilvános dokumentum hivatkozását.",
        ],
      },
    ],
  },
};

export const CONTENT = { metodika, opravy };

export const SOURCES_PAGE: Record<
  Lang,
  {
    title: string;
    lede: string;
    primary: string;
    secondary: string;
    snapshots: string;
    facts: string;
    last: string;
    kind: { primary: string; secondary: string };
  }
> = {
  sk: {
    title: "Zdroje",
    lede: "Používame len verejné zdroje. Pri každom zbere uložíme kópiu dokumentu s odtlačkom SHA-256. Počty a dátumy sú priamo z našej databázy.",
    primary: "Úradné registre a zoznamy",
    secondary: "Ďalšie verejné zdroje",
    snapshots: "uložených kópií",
    facts: "faktov",
    last: "posledný zber",
    kind: { primary: "primárny", secondary: "sekundárny" },
  },
  en: {
    title: "Sources",
    lede: "We use public sources only. Every collection stores a copy of the document with its SHA-256 fingerprint. Counts and dates come straight from our database.",
    primary: "Official registers and lists",
    secondary: "Other public sources",
    snapshots: "stored copies",
    facts: "facts",
    last: "last collected",
    kind: { primary: "primary", secondary: "secondary" },
  },
  hu: {
    title: "Források",
    lede: "Csak nyilvános forrásokat használunk. Minden gyűjtéskor SHA-256 lenyomattal tároljuk a dokumentum másolatát. A számok és dátumok közvetlenül az adatbázisunkból származnak.",
    primary: "Hivatalos nyilvántartások és listák",
    secondary: "Egyéb nyilvános források",
    snapshots: "tárolt másolat",
    facts: "tény",
    last: "utolsó gyűjtés",
    kind: { primary: "elsődleges", secondary: "másodlagos" },
  },
};

/** Placeholder until the project has a real inbox; shown labelled on the corrections page. */
export const CORRECTIONS_EMAIL = "opravy@kohovolim.sk";
