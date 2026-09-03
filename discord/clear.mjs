#!/usr/bin/env node
/**
 * AI for Access — Channel leeren
 * ------------------------------
 * Entfernt Beispiel-/Testinhalte aus einzelnen Channels, bevor der Server für
 * Teilnehmende geöffnet wird. Foren werden Thread für Thread geleert, Text-Channels
 * Nachricht für Nachricht.
 *
 *   node clear.mjs --dry-run challenges ideen-marktplatz    # zeigt nur, was fiele
 *   node clear.mjs challenges ideen-marktplatz              # löscht wirklich
 *
 * Kanalnamen müssen **immer explizit** übergeben werden — es gibt bewusst kein
 * „alles leeren", damit hier nichts aus Versehen passiert.
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, Events, ChannelType } from 'discord.js';

const { DISCORD_TOKEN, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !GUILD_ID) {
  console.error('❌ DISCORD_TOKEN und GUILD_ID müssen in .env gesetzt sein.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const names = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((n) => n.replace(/^#/, ''));

if (!names.length) {
  console.error('❌ Keine Kanäle angegeben. Beispiel:\n   node clear.mjs --dry-run challenges ideen-marktplatz');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function clearForum(channel) {
  const active = await channel.threads.fetchActive();
  const archived = await channel.threads.fetchArchived({ limit: 100 });
  const threads = [...active.threads.values(), ...archived.threads.values()];
  for (const t of threads) {
    if (DRY_RUN) { console.log(`  [dry-run] Thread „${t.name}"`); continue; }
    await t.delete('Beispiel-Inhalte vor dem Event entfernt');
    console.log(`  🗑  Thread „${t.name}"`);
  }
  return threads.length;
}

async function clearText(channel) {
  let total = 0;
  for (;;) {
    const batch = await channel.messages.fetch({ limit: 100 });
    if (!batch.size) break;
    if (DRY_RUN) {
      batch.forEach((m) => console.log(`  [dry-run] ${m.author.username}: ${m.content.slice(0, 60)}`));
      return batch.size;
    }
    // bulkDelete kann nur Nachrichten < 14 Tage; ältere einzeln.
    const fresh = batch.filter((m) => Date.now() - m.createdTimestamp < 13 * 864e5);
    if (fresh.size > 1) await channel.bulkDelete(fresh, true);
    for (const m of batch.filter((x) => !fresh.has(x.id)).values()) await m.delete().catch(() => {});
    total += batch.size;
    if (batch.size < 100) break;
  }
  return total;
}

client.once(Events.ClientReady, async () => {
  let failed = 0;
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();

    for (const name of names) {
      const channel = guild.channels.cache.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (!channel) { console.error(`❌ #${name}: nicht gefunden.`); failed++; continue; }

      console.log(`\n#${name} [${ChannelType[channel.type]}]`);
      const n = channel.type === ChannelType.GuildForum
        ? await clearForum(channel)
        : await clearText(channel);
      console.log(n
        ? `  → ${DRY_RUN ? 'würde ' : ''}${n} Eintrag/Einträge ${DRY_RUN ? 'löschen' : 'gelöscht'}`
        : '  → war schon leer');
    }
  } catch (err) {
    console.error('❌ Fehler:', err?.message || err);
    failed++;
  } finally {
    await client.destroy();
    process.exit(failed ? 1 : 0);
  }
});

client.login(DISCORD_TOKEN).catch((err) => {
  console.error('❌ Login fehlgeschlagen:', err?.message || err);
  process.exit(1);
});
