import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, Collection, PermissionsBitField } from 'discord.js';
import {
  SKILL_ROLES, ROLE_POST_MARKER, skillForEmoji, isRolePost,
  assertSkillRole, createReactionRoles, loadRolePost,
} from './reaction-roles.mjs';

function fixture({ channelName = 'choose-your-role', legacy = false, empty = false } = {}) {
  const calls = [];
  const roles = new Collection(SKILL_ROLES.map((s, i) => [String(i), {
    id: String(i), name: s.names[0], managed: false, editable: true,
    permissions: new PermissionsBitField(),
  }]));
  const votes = new Map();
  const message = {
    id: 'post', channelId: 'channel', guildId: 'guild', author: { id: 'bot' },
    content: legacy ? '🎭 **Wähle deine Skill-Tags** — alter Seed' : ROLE_POST_MARKER,
    reactions: { cache: new Collection() },
    async edit(content) { calls.push(['edit']); this.content = content; return this; },
    async react(emoji) {
      calls.push(['react', emoji]);
      this.reactions.cache.set(emoji, {
        emoji: { name: emoji, id: null },
        users: { fetch: async (options) => {
          calls.push(['users', emoji, options.after]);
          const list = votes.get(emoji) ?? [{ id: 'bot', bot: true }];
          const start = options.after ? list.findIndex((u) => u.id === options.after) + 1 : 0;
          return new Collection(list.slice(start, start + 100).map((u) => [u.id, u]));
        } },
      });
    },
  };
  const channel = {
    id: 'channel', name: channelName, type: ChannelType.GuildText,
    permissionsFor: () => new PermissionsBitField(PermissionsBitField.All),
    messages: { fetch: async () => new Collection(empty ? [] : [['post', message]]) },
    async send({ content }) { calls.push(['send']); message.content = content; return message; },
  };
  const guild = {
    id: 'guild',
    roles: { fetch: async () => roles },
    channels: { cache: new Collection([['channel', channel]]), fetch: async () => {} },
    members: {
      fetchMe: async () => ({ permissions: new PermissionsBitField(PermissionsBitField.All) }),
      fetch: async (id) => ({
        user: { bot: id === 'other-bot' },
        roles: {
          add: async (role) => calls.push(['add', id, role]),
          remove: async (role) => calls.push(['remove', id, role]),
        },
      }),
    },
  };
  const service = createReactionRoles(guild, 'bot', { report: (s) => calls.push(['error', s]) });
  const event = (emoji = '💻', override = {}) => ({
    partial: true, emoji: { id: null, name: emoji },
    message: { id: 'post', channelId: 'channel', guildId: 'guild', partial: true, ...override },
    fetch: () => { throw new Error('Letzte entfernte Reaktion darf nicht gefetcht werden'); },
  });
  return { calls, roles, votes, message, channel, guild, service, event };
}

test('exakt fünf Unicode-Emojis, keine Custom- oder fremden Emojis', () => {
  for (const skill of SKILL_ROLES) assert.equal(skillForEmoji({ name: skill.emoji }), skill);
  assert.equal(skillForEmoji({ name: '💻', id: 'custom' }), false);
  assert.equal(skillForEmoji({ name: '🔥' }), undefined);
});

test('nur eigener markierter Post oder eigener deutscher Seed wird übernommen', () => {
  assert.equal(isRolePost({ author: { id: 'bot' }, content: ROLE_POST_MARKER }, 'bot'), true);
  assert.equal(isRolePost({ author: { id: 'person' }, content: ROLE_POST_MARKER }, 'bot'), false);
  assert.equal(isRolePost({ author: { id: 'bot' }, content: 'Hallo!' }, 'bot'), false);
});

test('fehlende, privilegierte, verwaltete oder zu hohe Rollen werden abgewiesen', () => {
  const role = fixture().roles.first();
  assert.doesNotThrow(() => assertSkillRole(role));
  for (const bad of [undefined, { ...role, managed: true }, { ...role, editable: false },
    { ...role, permissions: new PermissionsBitField(PermissionsBitField.Flags.Administrator) }]) {
    assert.throws(() => assertSkillRole(bad));
  }
});

test('Post aus Markdown enthält Anleitung und stabilen Marker, passt in Discord-Limit', async () => {
  const content = await loadRolePost();
  assert.ok(content.includes('Remove your reaction'));
  assert.ok(content.endsWith(ROLE_POST_MARKER));
  assert.ok(!content.includes('channel:'));
  assert.ok(content.length <= 2000);
});

test('alter deutscher Post wird in-place migriert, alle Emojis werden vorbereitet', async () => {
  const f = fixture({ legacy: true, channelName: 'rollen-waehlen' });
  const content = await loadRolePost();
  assert.equal(await f.service.initialize(content), f.message);
  assert.equal(f.message.content, content);
  assert.equal(f.calls.filter(([op]) => op === 'send').length, 0);
  assert.equal(f.calls.filter(([op]) => op === 'react').length, 5);
  await f.service.initialize(content);
  assert.equal(f.calls.filter(([op]) => op === 'edit').length, 1, 'unveränderten Post nicht erneut editieren');
});

test('leerer Rollenkanal bekommt genau einen markierten Post', async () => {
  const f = fixture({ empty: true });
  await f.service.initialize(await loadRolePost());
  assert.equal(f.calls.filter(([op]) => op === 'send').length, 1);
});

test('Mehrfachauswahl und Entfernen letzter ungecachter Reaktion verändern nur die Zielrolle', async () => {
  const f = fixture();
  await f.service.initialize(await loadRolePost());
  for (const skill of SKILL_ROLES) {
    assert.equal(await f.service.handle(f.event(skill.emoji), { id: 'person' }, true), true);
  }
  assert.equal(await f.service.handle(f.event(), { id: 'person' }, false), true);
  assert.deepEqual(f.calls.filter(([op]) => op === 'add' || op === 'remove'), [
    ...SKILL_ROLES.map((_, i) => ['add', 'person', String(i)]), ['remove', 'person', '0'],
  ]);
});

test('fremde Nachrichten, Kanäle, Server, Emojis und Bots werden ignoriert', async () => {
  const f = fixture();
  await f.service.initialize(await loadRolePost());
  for (const override of [{ id: 'other' }, { channelId: 'other' }, { guildId: 'other' }]) {
    assert.equal(await f.service.handle(f.event('💻', override), { id: 'person' }, true), false);
  }
  assert.equal(await f.service.handle(f.event('🔥'), { id: 'person' }, true), false);
  assert.equal(await f.service.handle(f.event(), { id: 'bot' }, true), false);
  assert.equal(await f.service.handle(f.event(), { id: 'other-bot' }, true), false);
  assert.equal(await f.service.handle(f.event(), { id: 'person', bot: true }, true), false);
  assert.equal(f.calls.filter(([op]) => op === 'add' || op === 'remove').length, 0);
});

test('schnelles Add/Remove wird in Reihenfolge abgearbeitet, Fehler blockieren Folge-Events nicht', async () => {
  const f = fixture();
  await f.service.initialize(await loadRolePost());
  const fetch = f.guild.members.fetch;
  f.guild.members.fetch = async (id) => {
    if (id === 'left') throw new Error('Unknown Member');
    await new Promise((resolve) => setTimeout(resolve, 5));
    return fetch(id);
  };
  const results = await Promise.allSettled([
    f.service.handle(f.event(), { id: 'left' }, true),
    f.service.handle(f.event(), { id: 'person' }, true),
    f.service.handle(f.event(), { id: 'person' }, false),
  ]);
  assert.equal(results[0].status, 'rejected');
  assert.equal(results[2].status, 'fulfilled');
  assert.deepEqual(f.calls.filter(([op]) => op === 'add' || op === 'remove'), [
    ['add', 'person', '0'], ['remove', 'person', '0'],
  ]);
});

test('Start liest mehr als 100 bestehende Stimmen, ignoriert Bots und entfernt keine manuellen Rollen', async () => {
  const f = fixture();
  f.votes.set('💻', [...Array.from({ length: 101 }, (_, i) => ({ id: `u${i}` })), { id: 'bot', bot: true }]);
  await f.service.initialize(await loadRolePost());
  assert.equal(f.calls.filter(([op]) => op === 'add').length, 101);
  assert.equal(f.calls.filter(([op]) => op === 'remove').length, 0);
  assert.ok(f.calls.some(([op, emoji, after]) => op === 'users' && emoji === '💻' && after === 'u99'));
});

test('fehlende Rollen oder Rechte brechen vor Post-Änderungen ab; Rollen werden bei Events erneut geprüft', async () => {
  const f = fixture();
  f.roles.delete('4');
  await assert.rejects(f.service.initialize('test'), /nicht eindeutig/);
  assert.equal(f.calls.length, 0);
  const g = fixture();
  g.channel.permissionsFor = () => new PermissionsBitField();
  await assert.rejects(g.service.initialize('test'), /Rechte|rechte/);
  assert.equal(g.calls.length, 0);
  const h = fixture();
  await h.service.initialize(await loadRolePost());
  h.roles.first().permissions = new PermissionsBitField(PermissionsBitField.Flags.Administrator);
  await assert.rejects(h.service.handle(h.event(), { id: 'person' }, true), /hat Rechte/);
  assert.equal(h.calls.filter(([op]) => op === 'add').length, 0);
});

test('markierter Post wird auch hinter 100 anderen Nachrichten gefunden', async () => {
  const f = fixture();
  const page = new Collection(Array.from({ length: 100 }, (_, i) => [String(i), {
    id: String(i), author: { id: 'person' }, content: ROLE_POST_MARKER,
  }]));
  f.channel.messages.fetch = async ({ before }) => before ? new Collection([['post', f.message]]) : page;
  await f.service.initialize(await loadRolePost());
  assert.equal(f.calls.filter(([op]) => op === 'send').length, 0);
});

test('doppelte Zielkanäle oder Skill-Rollen werden nicht willkürlich ausgewählt', async () => {
  const f = fixture();
  f.guild.channels.cache.set('duplicate', { ...f.channel, id: 'duplicate', name: 'rollen-waehlen' });
  await assert.rejects(f.service.initialize('test'), /Genau ein/);
  const g = fixture();
  g.roles.set('duplicate', { ...g.roles.first(), id: 'duplicate' });
  await assert.rejects(g.service.initialize('test'), /nicht eindeutig/);
});
