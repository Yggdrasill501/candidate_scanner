import { db, sql } from "@repo/db";
import { claude } from "../lib/claude";
import { mapPool } from "../lib/pool";
import type { Stats } from "../lib/run";

export const TOPICS_PROMPT_VERSION = "topics-v1";
const BATCH = 40;

const TOPICS = {
  budget: "Rozpočet a financie – rozpočet, jeho zmeny, záverečný účet, úvery, dane a poplatky, audit",
  transport: "Doprava – cesty, parkovanie, MHD, chodníky, cyklotrasy",
  planning: "Územný plán a výstavba – územný plán, zmeny a doplnky, stavebné zámery, investičné projekty",
  property: "Majetok mesta / kraja – predaj, nájom, prevod, zámena, vecné bremená, nadobudnutie majetku",
  education: "Školstvo – školy, škôlky, sieť škôl, centrá voľného času",
  social: "Sociálne veci a zdravotníctvo – sociálne služby, seniori, bývanie, nemocnice",
  environment: "Životné prostredie – odpady, zeleň, voda, ovzdušie",
  culture: "Kultúra a šport – kultúrne podujatia, športoviská, dotácie na kultúru a šport",
  administration:
    "Správa mesta / kraja – rokovací poriadok, komisie, voľby orgánov, personálne veci, kontrola, VZN o organizácii, procedurálne hlasovania (program, návrhová komisia)",
  other: "Ostatné – čokoľvek, čo nepatrí jasne do žiadnej témy vyššie",
} as const;
type Topic = keyof typeof TOPICS;

const SYSTEM =
  "You classify agenda items of Slovak municipal and regional councils into a fixed list of " +
  "topics. Choose exactly one topic per item, based only on the item's text. When unsure, use " +
  '"other". Answer only with the requested JSON.';

/**
 * Assigns each agenda item one of the fixed topics (specs/council-votes, Topics) with a headless
 * Claude Code call. Items keep their topic until the prompt version changes.
 */
export async function topics(): Promise<Stats> {
  const items = await db
    .selectFrom("agenda_item")
    .leftJoin("vote", "vote.agenda_item_id", "agenda_item.id")
    .select([
      "agenda_item.id",
      "agenda_item.material_number",
      "agenda_item.title",
      sql<string>`left(string_agg(distinct vote.description, ' | '), 600)`.as("votes"),
    ])
    .where((eb) =>
      eb.or([
        eb("agenda_item.topic_code", "is", null),
        eb("agenda_item.topic_prompt_version", "!=", TOPICS_PROMPT_VERSION),
      ]),
    )
    .groupBy("agenda_item.id")
    .execute();

  const batches: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));

  const schema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            topic: { type: "string", enum: Object.keys(TOPICS) },
          },
          required: ["id", "topic"],
        },
      },
    },
    required: ["items"],
  };

  let cost = 0;
  let assigned = 0;
  let failedBatches = 0;
  await mapPool(batches, 2, 1000, async (batch) => {
    const prompt =
      `Topics:\n${Object.entries(TOPICS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\n` +
      `Agenda items (id, material number, title, votes taken on it):\n` +
      batch
        .map((b) => JSON.stringify({ id: b.id, material: b.material_number, title: b.title, votes: b.votes }))
        .join("\n") +
      `\n\nReturn one entry per item id.`;
    try {
      const { output, costUsd } = await claude<{ items: { id: string; topic: Topic }[] }>(SYSTEM, prompt, schema);
      cost += costUsd;
      const ids = new Set(batch.map((b) => b.id));
      for (const r of output.items) {
        if (!ids.has(r.id) || !(r.topic in TOPICS)) continue;
        await db
          .updateTable("agenda_item")
          .set({ topic_code: r.topic, topic_method: "ai", topic_prompt_version: TOPICS_PROMPT_VERSION })
          .where("id", "=", r.id)
          .execute();
        assigned++;
      }
    } catch {
      failedBatches++;
    }
  });

  return {
    items: items.length,
    assigned,
    failed_batches: failedBatches,
    usage_usd: Number(cost.toFixed(3)),
  };
}
