#!/usr/bin/env node
/**
 * AI for Access — Bot-Avatar
 * --------------------------
 * Generiert ein passendes Icon (Schlüsselloch = Access + AI-Funken, Spike-Farbverlauf)
 * als PNG, speichert es unter assets/ und setzt es als Avatar des Bots.
 *
 *   node bot-avatar.mjs --dry-run   # nur PNG erzeugen/speichern, Avatar NICHT setzen
 *   node bot-avatar.mjs             # PNG erzeugen + als Bot-Avatar setzen
 *
 * Optional: --server  setzt dasselbe Bild zusätzlich als Server-Icon.
 */

import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { Client, GatewayIntentBits, Events } from 'discord.js';

const DRY = process.argv.includes('--dry-run');
const SET_SERVER = process.argv.includes('--server');
const { DISCORD_TOKEN, GUILD_ID } = process.env;
if (!DISCORD_TOKEN) { console.error('❌ DISCORD_TOKEN fehlt in .env'); process.exit(1); }

const __dir = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dir, 'assets');

const SVG = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7C5CFF"/>
      <stop offset="1" stop-color="#22D3EE"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#0b0f14" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <!-- Schlüsselloch = Access -->
  <g fill="#ffffff" filter="url(#soft)">
    <circle cx="248" cy="220" r="66"/>
    <path d="M248 250 L300 396 Q302 404 293 404 L203 404 Q194 404 196 396 Z"/>
  </g>
  <!-- AI-Funken oben rechts -->
  <g fill="#ffffff">
    <path d="M372 128 C376 156 384 164 412 168 C384 172 376 180 372 208 C368 180 360 172 332 168 C360 164 368 156 372 128 Z"/>
    <circle cx="418" cy="120" r="9" opacity="0.9"/>
    <circle cx="330" cy="214" r="6" opacity="0.8"/>
  </g>
</svg>`;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const png = await sharp(Buffer.from(SVG)).png().toBuffer();
    await mkdir(ASSETS, { recursive: true });
    const svgPath = join(ASSETS, 'bot-avatar.svg');
    const pngPath = join(ASSETS, 'bot-avatar.png');
    await writeFile(svgPath, SVG);
    await writeFile(pngPath, png);
    console.log(`🎨 Icon erzeugt: ${pngPath} (${png.length} bytes)`);

    if (DRY) { console.log('ℹ️  Dry-Run: Avatar NICHT gesetzt.'); }
    else {
      await client.user.setAvatar(png);
      console.log('✅ Bot-Avatar gesetzt.');
      if (SET_SERVER && GUILD_ID) {
        const guild = await client.guilds.fetch(GUILD_ID);
        await guild.setIcon(png, 'AI for Access Icon');
        console.log('✅ Server-Icon gesetzt.');
      }
    }
  } catch (err) {
    console.error('❌ Fehler:', err?.message || err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
