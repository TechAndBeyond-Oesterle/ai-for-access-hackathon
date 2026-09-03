/**
 * Tests der Team-Regeln — laufen ohne Discord-Server und ohne Token:
 *   npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Collection, PermissionsBitField, ChannelType } from 'discord.js';
import {
  slug, teamName, teamRolesOf, isExempt, channelsOfTeam, emptyTeamVerdict, TEAM_ROLE_PREFIX,
} from './team-rules.mjs';

const GRACE = 15 * 60_000;

const fakeMember = (roleNames, { admin = false } = {}) => ({
  roles: { cache: new Collection(roleNames.map((n, i) => [`r${i}`, { id: `r${i}`, name: n }])) },
  permissions: new PermissionsBitField(admin ? PermissionsBitField.Flags.Administrator : 0n),
});

const fakeGuild = (channels) => ({ channels: { cache: new Collection(channels.map((c) => [c.id, c])) } });

test('slug macht aus freien Namen Channel-Namen', () => {
  assert.equal(slug('Nachtschicht'), 'nachtschicht');
  assert.equal(slug('Team Grün & Blau'), 'team-grun-blau');
  assert.equal(slug('🚀🚀'), 'team', 'reine Emoji-Namen fallen auf "team" zurück');
  assert.ok(slug('x'.repeat(50)).length <= 24);
});

test('teamRolesOf erkennt nur Team-Rollen, nicht die Skill-Tags', () => {
  const m = fakeMember(['Dev', 'Teilnehmer:in', `${TEAM_ROLE_PREFIX}Nachtschicht`]);
  const teams = teamRolesOf(m);
  assert.equal(teams.size, 1);
  assert.equal(teamName(teams.first()), 'Nachtschicht');
});

test('isExempt: Orga und Admins dürfen mehrere Teams, Teilnehmende nicht', () => {
  assert.equal(isExempt(fakeMember(['Orga'])), true);
  assert.equal(isExempt(fakeMember(['Dev'], { admin: true })), true);
  assert.equal(isExempt(fakeMember(['Dev', 'Teilnehmer:in'])), false);
  assert.equal(isExempt(fakeMember(['Mentor:in'])), false, 'Mentor:in ist bewusst NICHT befreit');
});

test('channelsOfTeam findet Text + Voice über die Topic-Marker', () => {
  const text = { id: 't1', name: 'team-nachtschicht', topic: 'Privater Raum. [teamRole:42] [teamVoice:v1]' };
  const voice = { id: 'v1', name: 'team-nachtschicht-voice', type: ChannelType.GuildVoice };
  const found = channelsOfTeam(fakeGuild([text, voice]), '42');
  assert.equal(found.text.id, 't1');
  assert.equal(found.voice.id, 'v1');
});

test('channelsOfTeam fällt für alte Teams ohne teamVoice-Marker auf das Namensschema zurück', () => {
  const text = { id: 't1', name: 'team-alt', topic: 'Privater Raum. [teamRole:42]' };
  const voice = { id: 'v9', name: 'team-alt-voice', type: ChannelType.GuildVoice };
  const found = channelsOfTeam(fakeGuild([text, voice]), '42');
  assert.equal(found.voice.id, 'v9');
});

test('channelsOfTeam liefert nichts, wenn kein Channel zur Rolle gehört', () => {
  const fremd = { id: 't2', name: 'team-anderes', topic: '[teamRole:999]' };
  const found = channelsOfTeam(fakeGuild([fremd]), '42');
  assert.equal(found.text, undefined);
  assert.equal(found.voice, null);
});

test('emptyTeamVerdict: besetztes Team bleibt', () => {
  const v = emptyTeamVerdict({ memberCount: 1, since: null, graceMs: GRACE });
  assert.equal(v.action, 'keep');
});

test('emptyTeamVerdict: frisch leeres Team wartet erst die Karenzzeit ab', () => {
  const now = 1_000_000;
  const v = emptyTeamVerdict({ memberCount: 0, since: null, now, graceMs: GRACE });
  assert.equal(v.action, 'wait');
  assert.equal(v.since, now, 'merkt sich den Zeitpunkt der ersten Leer-Erkennung');
});

test('emptyTeamVerdict: löscht erst nach Ablauf der Karenzzeit', () => {
  const since = 1_000_000;
  assert.equal(
    emptyTeamVerdict({ memberCount: 0, since, now: since + GRACE - 1, graceMs: GRACE }).action,
    'wait',
  );
  assert.equal(
    emptyTeamVerdict({ memberCount: 0, since, now: since + GRACE, graceMs: GRACE }).action,
    'delete',
  );
});

test('emptyTeamVerdict: graceMs 0 löscht sofort (Modus --sweep)', () => {
  assert.equal(emptyTeamVerdict({ memberCount: 0, since: null, graceMs: 0 }).action, 'delete');
});
