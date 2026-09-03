#!/usr/bin/env node
/**
 * AI for Access — Community-Upgrade
 * ---------------------------------
 * Wandelt (nachdem der Server auf COMMUNITY umgestellt wurde) zwei Channels in ihre
 * "echten" Typen um:
 *   #ankuendigungen : Text  -> Announcement   (via edit, in-place, behält Rechte)
 *   #Bühne          : Voice -> Stage          (Voice→Stage geht nur per neu anlegen:
 *                                              alte Voice-Bühne wird gelöscht + Stage neu erstellt)
 *
 *   node community-upgrade.mjs --dry-run
 *   node community-upgrade.mjs
 *
 * Idempotent: bereits umgewandelte Channels werden übersprungen.
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, ChannelType, Events } from 'discord.js';

const DRY = process.argv.includes('--dry-run');
const { DISCORD_TOKEN, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !GUILD_ID) {
  console.error('❌ DISCORD_TOKEN und GUILD_ID müssen in .env gesetzt sein.');
  process.exit(1);
}

const STAGE_CATEGORY = '🎤 BÜHNE & PITCHES';
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const guild = await (await client.guilds.fetch(GUILD_ID)).fetch();
    if (!guild.features.includes('COMMUNITY')) {
      console.error('⚠️  Server ist (noch) NICHT im Community-Modus. Erst umstellen: Servereinstellungen → Community aktivieren.');
      return;
    }
    const channels = await guild.channels.fetch();
    console.log(`\n🏛️  ${guild.name}  (${DRY ? 'DRY-RUN' : 'LIVE'})`);

    // 1) #ankuendigungen: Text -> Announcement
    const ank = channels.find((c) => c && c.name === 'ankuendigungen');
    if (!ank) {
      console.log('│ ⚠️  #ankuendigungen nicht gefunden.');
    } else if (ank.type === ChannelType.GuildAnnouncement) {
      console.log('│ ✓ #ankuendigungen ist bereits Announcement.');
    } else {
      console.log('│ ~ #ankuendigungen: Text → Announcement');
      if (!DRY) await ank.edit({ type: ChannelType.GuildAnnouncement });
    }

    // 2) #Bühne: Voice -> Stage (löschen + neu anlegen)
    const buehne = channels.find((c) => c && c.name === 'Bühne');
    if (buehne && buehne.type === ChannelType.GuildStageVoice) {
      console.log('│ ✓ #Bühne ist bereits Stage.');
    } else if (buehne && buehne.type === ChannelType.GuildVoice) {
      const parentId = buehne.parentId;
      const position = buehne.rawPosition;
      console.log('│ ~ #Bühne: Voice → Stage (Voice löschen, Stage neu anlegen)');
      if (!DRY) {
        await buehne.delete('Community-Upgrade: Voice → Stage');
        await guild.channels.create({
          name: 'Bühne', type: ChannelType.GuildStageVoice,
          parent: parentId, position, reason: 'Community-Upgrade',
        });
      }
    } else if (!buehne) {
      // Bühne fehlt ganz -> Stage neu anlegen unter der Kategorie
      const cat = channels.find((c) => c && c.type === ChannelType.GuildCategory && c.name === STAGE_CATEGORY);
      console.log('│ + #Bühne (Stage) neu anlegen');
      if (!DRY) await guild.channels.create({
        name: 'Bühne', type: ChannelType.GuildStageVoice,
        parent: cat ? cat.id : undefined, reason: 'Community-Upgrade',
      });
    }

    console.log(`\n✅ ${DRY ? 'Dry-Run fertig.' : 'Community-Upgrade abgeschlossen.'}`);
  } catch (err) {
    console.error('\n❌ Fehler:', err?.message || err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
