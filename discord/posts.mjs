#!/usr/bin/env node
/**
 * AI for Access — Channel-Posts aus Markdown
 * ------------------------------------------
 * Jede Datei in posts/ ist genau EINE Discord-Nachricht. Texte werden dort gepflegt,
 * nicht im Code. Beim erneuten Lauf wird die vorhandene Nachricht **editiert** statt
 * neu gepostet — Änderungen an der Datei landen also im bestehenden Post, ohne dass
 * jemand die alte Version löschen muss.
 *
 *   node posts.mjs --dry-run                 # zeigt nur, was passieren würde
 *   node posts.mjs --channel orga-intern     # alles in den Orga-Channel (Preview/Abnahme)
 *   node posts.mjs                           # in die in der Datei angegebenen Channels
 *   node posts.mjs --only team-anleitung-de  # nur eine Datei
 *
 * Wiedererkennung: Am Ende jeder Nachricht steht ein unauffälliger Marker im
 * Discord-Subtext (`-# ⟨post:<name>⟩`). Der Bot sucht damit seine eigene frühere
 * Nachricht im Channel. Kein State-File nötig — die Wahrheit steht in Discord.
 *
 * Aufbau einer Datei (Frontmatter + Text):
 *
 *   ---
 *   channel: team-suche
 *   ---
 *   # Überschrift
 *   Text …
 */

import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, GatewayIntentBits, Events, ChannelType } from 'discord.js';

const { DISCORD_TOKEN, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !GUILD_ID) {
  console.error('❌ DISCORD_TOKEN und GUILD_ID müssen in .env gesetzt sein.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const argOf = (flag) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
};
const CHANNEL_OVERRIDE = argOf('--channel');
const ONLY = argOf('--only');

const POSTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'posts');
const DISCORD_LIMIT = 2000;

const markerOf = (name) => `-# ⟨post:${name}⟩`;

/** Minimaler Frontmatter-Parser — `key: value`, reicht für unsere zwei Felder. */
function parseDoc(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw.trim() };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { meta, body: m[2].trim() };
}

async function loadPosts() {
  const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith('.md')).sort();
  const posts = [];
  for (const file of files) {
    const name = basename(file, '.md');
    if (ONLY && name !== ONLY) continue;
    const { meta, body } = parseDoc(await readFile(join(POSTS_DIR, file), 'utf8'));
    const content = `${body}\n\n${markerOf(name)}`;
    posts.push({ name, file, channel: CHANNEL_OVERRIDE || meta.channel, content });
  }
  return posts;
}

function findChannel(guild, name) {
  const wanted = name.replace(/^#/, '').toLowerCase();
  return guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name.toLowerCase() === wanted,
  );
}

/**
 * `{#kanal-name}` → `<#id>`, damit im Post ein echter, klickbarer Kanal-Link steht.
 * Ein einfaches `#kanal` im API-Text bleibt sonst toter Text (anders als beim Tippen im Client).
 * Unbekannte Namen bleiben als `#name` stehen, statt den Post scheitern zu lassen.
 */
function resolveChannelRefs(content, guild) {
  return content.replace(/\{#([\w-]+)\}/g, (_, name) => {
    const ch = guild.channels.cache.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!ch) console.warn(`  ⚠️  Kanal #${name} nicht gefunden — bleibt als Text stehen.`);
    return ch ? `<#${ch.id}>` : `#${name}`;
  });
}

/** Sucht die eigene frühere Nachricht am Marker. */
async function findExisting(channel, botId, name) {
  const marker = markerOf(name);
  const recent = await channel.messages.fetch({ limit: 100 });
  return recent.find((m) => m.author.id === botId && m.content.includes(marker)) ?? null;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  let failed = 0;
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    const posts = await loadPosts();
    if (!posts.length) {
      console.log('Keine Posts gefunden (posts/*.md).');
      return;
    }

    for (const post of posts) {
      const label = `${post.name} → #${post.channel ?? '???'}`;

      if (!post.channel) {
        console.error(`❌ ${post.name}: kein Channel (Frontmatter "channel:" fehlt, kein --channel).`);
        failed++; continue;
      }
      post.content = resolveChannelRefs(post.content, guild);
      if (post.content.length > DISCORD_LIMIT) {
        console.error(`❌ ${label}: ${post.content.length} Zeichen — Discord erlaubt ${DISCORD_LIMIT}. `
          + 'Datei aufteilen (z.B. …-1.md / …-2.md).');
        failed++; continue;
      }

      const channel = findChannel(guild, post.channel);
      if (!channel) {
        console.error(`❌ ${label}: Channel nicht gefunden.`);
        failed++; continue;
      }

      const existing = await findExisting(channel, client.user.id, post.name);

      if (existing && existing.content === post.content) {
        console.log(`✓ ${label}: unverändert (${post.content.length} Z.)`);
        continue;
      }
      if (DRY_RUN) {
        console.log(`[dry-run] ${label}: würde ${existing ? 'AKTUALISIEREN' : 'NEU POSTEN'} `
          + `(${post.content.length} Z.)`);
        continue;
      }
      if (existing) {
        await existing.edit(post.content);
        console.log(`↻ ${label}: aktualisiert`);
      } else {
        await channel.send(post.content);
        console.log(`✚ ${label}: gepostet`);
      }
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
