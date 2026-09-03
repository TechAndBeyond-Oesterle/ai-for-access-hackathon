import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, Collection, MessageFlags, PermissionsBitField } from 'discord.js';
import { SKILL_ROLES, ROLE_POST_MARKER, roleButtons, isRolePost, assertSkillRole,
  createRoleButtons, loadRolePost } from './reaction-roles.mjs';

function fixture({ legacy = false, empty = false } = {}) {
  const calls = [];
  const roles = new Collection(SKILL_ROLES.map((s, i) => [String(i), {
    id: String(i), name: s.names[0], managed: false, editable: true,
    permissions: new PermissionsBitField(),
  }]));
  const assigned = new Set(['team']);
  const snapshot = () => ({ roles: { cache: new Collection([...assigned].map(id => [id,
    roles.get(id) ?? { id, name: 'Team: Existing' }])) } });
  const message = {
    id: 'post', channelId: 'channel', guildId: 'guild', author: { id: 'bot' },
    content: legacy ? '🎭 **Wähle deine Skill-Tags** — alter Seed' : ROLE_POST_MARKER,
    reactions: { cache: new Collection([['old', {}]]), removeAll: async () => calls.push(['clear']) },
    async edit(payload) { calls.push(['edit']); Object.assign(this, payload); return this; },
  };
  const channel = {
    id: 'channel', name: 'choose-your-role', type: ChannelType.GuildText,
    permissionsFor: () => new PermissionsBitField(PermissionsBitField.All),
    messages: { fetch: async () => new Collection(empty ? [] : [['post', message]]) },
    async send(payload) { calls.push(['send']); Object.assign(message, payload); return message; },
  };
  const guild = {
    id: 'guild', roles: { fetch: async () => roles },
    channels: { cache: new Collection([['channel', channel]]), fetch: async () => {} },
    members: {
      fetchMe: async () => ({ permissions: new PermissionsBitField(PermissionsBitField.All) }),
      fetch: async (options) => {
        assert.equal(options.force, true);
        calls.push(['fetch']);
        const member = snapshot();
        member.roles.add = async (id) => { assigned.add(id); calls.push(['add', id]); return snapshot(); };
        member.roles.remove = async (id) => { assigned.delete(id); calls.push(['remove', id]); return snapshot(); };
        return member;
      },
    },
  };
  const service = createRoleButtons(guild, 'bot', { report: (s) => calls.push(['error', s]) });
  const click = (key = 'dev', override = {}) => ({
    isButton: () => true, customId: `skill-role:${key}`,
    user: { id: 'person' }, guildId: 'guild', channelId: 'channel', message: { id: 'post' },
    deferReply: async (options) => calls.push(['defer', options.flags]),
    editReply: async (payload) => calls.push(['reply', payload.content]), ...override,
  });
  return { calls, roles, assigned, message, channel, guild, service, click };
}

test('fünf stabile, neutrale Buttons mit Emojis und eindeutigen IDs', () => {
  const [row] = roleButtons();
  assert.equal(row.components.length, 5);
  assert.equal(new Set(row.components.map(b => b.custom_id)).size, 5);
  assert.ok(row.components.every(b => b.style === 2 && b.emoji.name && b.label));
});
test('nur eigene Posts und verwaltbare, unprivilegierte Skill-Rollen', () => {
  assert.equal(isRolePost({ author: { id: 'bot' }, content: ROLE_POST_MARKER }, 'bot'), true);
  assert.equal(isRolePost({ author: { id: 'person' }, content: ROLE_POST_MARKER }, 'bot'), false);
  const role = fixture().roles.first();
  for (const bad of [undefined, { ...role, managed: true }, { ...role, editable: false },
    { ...role, permissions: new PermissionsBitField(PermissionsBitField.Flags.Administrator) }]) assert.throws(() => assertSkillRole(bad));
});
test('Markdown erklärt private Bestätigung und Migration, passt ins Limit', async () => {
  const content = await loadRolePost();
  assert.ok(content.includes('Only you see the confirmation'));
  assert.ok(content.includes('Emoji reactions no longer change roles'));
  assert.ok(content.endsWith(ROLE_POST_MARKER) && content.length <= 2000);
});
test('Migration und Neustart: gleicher Post und keine Rollenänderung', async () => {
  const f = fixture({ legacy: true }); f.channel.name = 'rollen-waehlen'; f.assigned.add('0');
  const content = await loadRolePost();
  assert.equal(await f.service.initialize(content), f.message);
  assert.deepEqual(f.message.components, roleButtons());
  assert.ok(f.calls.some(([op]) => op === 'clear'));
  await f.service.initialize(content);
  assert.deepEqual([...f.assigned], ['team', '0']);
  assert.ok(!f.calls.some(([op]) => ['add', 'remove', 'fetch', 'send'].includes(op)));
});
test('leerer Kanal bekommt einen Post mit Buttons', async () => {
  const f = fixture({ empty: true }); await f.service.initialize(await loadRolePost());
  assert.equal(f.calls.filter(([op]) => op === 'send').length, 1);
  assert.deepEqual(f.message.components, roleButtons());
});
test('Add/Remove mit privater Skill-Übersicht, Team bleibt; Defer kommt vor REST', async () => {
  const f = fixture(); await f.service.initialize(await loadRolePost());
  await f.service.handle(f.click('dev')); await f.service.handle(f.click('design')); await f.service.handle(f.click('dev'));
  assert.deepEqual([...f.assigned], ['team', '1']);
  const replies = f.calls.filter(([op]) => op === 'reply').map(([, text]) => text);
  assert.match(replies[0], /Dev\*\* added/); assert.match(replies[1], /Dev · Design/);
  assert.match(replies[2], /Dev\*\* removed.*\nYour skill tags: \*\*Design/);
  assert.ok(f.calls.filter(([op]) => op === 'defer').every(([, flag]) => flag === MessageFlags.Ephemeral));
  assert.ok(f.calls.findIndex(([op]) => op === 'defer') < f.calls.findIndex(([op]) => op === 'fetch'));
});
test('Doppelklick liest frisch und toggelt seriell, beide sofort bestätigt', async () => {
  const f = fixture(); await f.service.initialize(await loadRolePost());
  const fetch = f.guild.members.fetch;
  f.guild.members.fetch = async (options) => { await new Promise(r => setTimeout(r, 5)); return fetch(options); };
  await Promise.all([f.service.handle(f.click()), f.service.handle(f.click())]);
  assert.deepEqual([...f.assigned], ['team']);
  assert.deepEqual(f.calls.filter(([op]) => ['add', 'remove'].includes(op)), [['add', '0'], ['remove', '0']]);
  assert.match(f.calls.filter(([op]) => op === 'reply').at(-1)[1], /none yet/);
  assert.equal(f.calls.filter(([op]) => op === 'defer').length, 2);
});
test('fremde Posts/Server/Kanäle, unbekannte IDs und Bots vergeben keine Rollen', async () => {
  const f = fixture(); await f.service.initialize(await loadRolePost());
  for (const override of [{ message: { id: 'other' } }, { channelId: 'other' }, { guildId: 'other' },
    { user: { id: 'bot', bot: true } }, { customId: 'skill-role:admin' }]) await f.service.handle(f.click('dev', override));
  assert.ok(!f.calls.some(([op]) => op === 'add' || op === 'remove'));
  assert.ok(f.calls.filter(([op]) => op === 'reply').every(([, text]) => text.startsWith('⚠️')));
  assert.equal(await f.service.handle(f.click('dev', { isButton: () => false })), false);
  assert.equal(await f.service.handle(f.click('dev', { customId: 'unrelated' })), false);
});
test('API-Fehler bleiben privat und neutral; nächster Klick funktioniert', async () => {
  const f = fixture(); await f.service.initialize(await loadRolePost()); const fetch = f.guild.members.fetch;
  f.guild.members.fetch = async () => { throw new Error('backend detail'); };
  await f.service.handle(f.click()); const reply = f.calls.find(([op]) => op === 'reply')[1];
  assert.ok(reply.startsWith('⚠️') && !reply.includes('backend'));
  f.guild.members.fetch = fetch; await f.service.handle(f.click()); assert.ok(f.assigned.has('0'));
});
test('nachträglich privilegierte Rolle wird auch bei Klick verweigert', async () => {
  const f = fixture(); await f.service.initialize(await loadRolePost());
  f.roles.first().permissions = new PermissionsBitField(PermissionsBitField.Flags.Administrator);
  await f.service.handle(f.click()); assert.ok(!f.assigned.has('0'));
  assert.ok(f.calls.some(([op, text]) => op === 'reply' && text.startsWith('⚠️')));
});
test('Setup stoppt bei fehlenden Rollen/Rechten oder doppelten Kanälen', async () => {
  const f = fixture(); f.roles.delete('4'); await assert.rejects(f.service.initialize('test'), /nicht eindeutig/); assert.equal(f.calls.length, 0);
  const g = fixture(); g.channel.permissionsFor = () => new PermissionsBitField();
  await assert.rejects(g.service.initialize('test'), /rechte/); assert.equal(g.calls.length, 0);
  const h = fixture(); h.guild.channels.cache.set('duplicate', { ...h.channel, id: 'duplicate' });
  await assert.rejects(h.service.initialize('test'), /Genau ein/);
});
test('ohne Löschrechte bleiben alte Reaktionen inert, Rollen unverändert', async () => {
  const f = fixture(); f.channel.permissionsFor = () => new PermissionsBitField(PermissionsBitField.All)
    .remove(PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.Administrator);
  await f.service.initialize(await loadRolePost()); assert.ok(!f.calls.some(([op]) => op === 'clear'));
  assert.deepEqual([...f.assigned], ['team']);
});
test('markierter Post hinter 100 fremden Nachrichten wird gefunden', async () => {
  const f = fixture(); const page = new Collection(Array.from({ length: 100 }, (_, i) => [String(i), {
    id: String(i), author: { id: 'person' }, content: ROLE_POST_MARKER,
  }]));
  f.channel.messages.fetch = async ({ before }) => before ? new Collection([['post', f.message]]) : page;
  await f.service.initialize(await loadRolePost()); assert.ok(!f.calls.some(([op]) => op === 'send'));
});
