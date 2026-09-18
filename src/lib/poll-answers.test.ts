import { expect, test } from 'bun:test';
import {
  countAnswers,
  hashEmail,
  isTestSession,
  isValidEmail,
  normalizeEmail,
  validateSubmission,
  type PollRow,
} from './poll-answers';
import { POLLS, type Poll } from './polls';

const poll = POLLS.infosession as Poll;

const row = (sessionKey: string, questionId: string, answer: string): PollRow => ({
  event: 'infosession',
  sessionKey,
  questionId,
  answer,
});

test('accepts a complete submission and builds one row per answer', () => {
  const result = validateSubmission(poll, {
    q1: 'Designer or product',
    q2: 7,
    q3: 'Tried once',
    q4: ['ChatGPT', 'Cursor'],
    q5: ['Finding a team', 'Pitching'],
    q5_comment: 'Looking forward to it',
    q6: 'No',
    q7: 'Yes, complete',
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  // 5 single/slider answers + 2 tools + 2 kinds of help + 1 comment
  expect(result.rows).toHaveLength(10);
  expect(result.rows).toContainEqual({ questionId: 'q2', answer: '7' });
  expect(result.rows).toContainEqual({ questionId: 'q4', answer: 'Cursor' });
  expect(result.rows).toContainEqual({ questionId: 'q5', answer: 'Pitching' });
  expect(result.rows).toContainEqual({ questionId: 'q5_comment', answer: 'Looking forward to it' });
});

test('skips empty answers but requires at least one', () => {
  const partial = validateSubmission(poll, { q1: '', q6: 'No' });
  expect(partial.ok).toBe(true);
  if (partial.ok) expect(partial.rows).toEqual([{ questionId: 'q6', answer: 'No' }]);

  expect(validateSubmission(poll, {}).ok).toBe(false);
  expect(validateSubmission(poll, null).ok).toBe(false);
});

test('rejects unknown questions and unknown options', () => {
  expect(validateSubmission(poll, { q99: 'whatever' })).toEqual({
    ok: false,
    error: 'Unknown question q99',
  });
  expect(validateSubmission(poll, { q1: 'Astronaut' }).ok).toBe(false);
  expect(validateSubmission(poll, { q4: ['Notepad'] }).ok).toBe(false);
  expect(validateSubmission(poll, { q4: 'ChatGPT' }).ok).toBe(false);
});

test('rejects slider values outside 0 to 10 and non-integers', () => {
  expect(validateSubmission(poll, { q2: 0 }).ok).toBe(true);
  expect(validateSubmission(poll, { q2: 10 }).ok).toBe(true);
  expect(validateSubmission(poll, { q2: 11 }).ok).toBe(false);
  expect(validateSubmission(poll, { q2: -1 }).ok).toBe(false);
  expect(validateSubmission(poll, { q2: 4.5 }).ok).toBe(false);
  expect(validateSubmission(poll, { q2: 'lots' }).ok).toBe(false);
});

test('rejects comments longer than 280 characters', () => {
  expect(validateSubmission(poll, { q5_comment: 'x'.repeat(280) }).ok).toBe(true);
  expect(validateSubmission(poll, { q5_comment: 'x'.repeat(281) }).ok).toBe(false);
});

test('deduplicates repeated multi-choice options', () => {
  const result = validateSubmission(poll, { q4: ['Claude', 'Claude'] });
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.rows).toHaveLength(1);
});

test('keeps the free-text comment of a multi-select question', () => {
  const rows: PollRow[] = [
    row('a', 'q5', 'Finding a team'),
    row('a', 'q5', 'Pitching'),
    row('a', 'q5_comment', 'Would love a design partner'),
    row('b', 'q5', 'Finding a team'),
  ];

  const results = countAnswers('infosession', poll, rows);
  const q5 = results.questions.find((q) => q.id === 'q5')!;
  expect(q5.type).toBe('multi');
  if (q5.type === 'multi') {
    // two sessions answered, one of them picked two options
    expect(q5.responses).toBe(2);
    expect(q5.options.find((o) => o.label === 'Finding a team')!.count).toBe(2);
    expect(q5.comments).toEqual(['Would love a design partner']);
  }
});

test('counts answers per question and option', () => {
  const rows: PollRow[] = [
    row('a', 'q1', 'Designer or product'),
    row('a', 'q4', 'ChatGPT'),
    row('a', 'q4', 'Claude'),
    row('b', 'q1', 'Designer or product'),
    row('b', 'q4', 'ChatGPT'),
    row('c', 'q1', 'Other'),
  ];

  const results = countAnswers('infosession', poll, rows);
  expect(results.total).toBe(3);

  const q1 = results.questions.find((q) => q.id === 'q1')!;
  expect(q1.type).toBe('single');
  if (q1.type === 'single') {
    expect(q1.responses).toBe(3);
    expect(q1.options.find((o) => o.label === 'Designer or product')!.count).toBe(2);
    expect(q1.options.find((o) => o.label === 'Other')!.count).toBe(1);
    expect(q1.options.find((o) => o.label === 'Developer or data')!.count).toBe(0);
  }

  const q4 = results.questions.find((q) => q.id === 'q4')!;
  if (q4.type === 'multi') {
    expect(q4.responses).toBe(2);
    expect(q4.options.find((o) => o.label === 'ChatGPT')!.count).toBe(2);
    expect(q4.options.find((o) => o.label === 'Claude')!.count).toBe(1);
    expect(q4.groups[0].label).toBe('Chat assistants');
  }
});

test('slider distribution covers 0 to 10 and carries the average', () => {
  const rows: PollRow[] = [
    row('a', 'q2', '0'),
    row('b', 'q2', '5'),
    row('c', 'q2', '10'),
    row('d', 'q2', '5'),
  ];

  const q2 = countAnswers('infosession', poll, rows).questions.find((q) => q.id === 'q2')!;
  expect(q2.type).toBe('slider');
  if (q2.type !== 'slider') return;
  expect(q2.distribution).toHaveLength(11);
  expect(q2.distribution[0]).toEqual({ label: '0', count: 1 });
  expect(q2.distribution[5]).toEqual({ label: '5', count: 2 });
  expect(q2.distribution[10]).toEqual({ label: '10', count: 1 });
  expect(q2.average).toBe(5);
  expect(q2.responses).toBe(4);

  const empty = countAnswers('infosession', poll, []).questions.find((q) => q.id === 'q2')!;
  if (empty.type === 'slider') expect(empty.average).toBe(null);
});

test('comments land under their question', () => {
  const rows: PollRow[] = [
    row('a', 'q5', 'Pitching'),
    row('a', 'q5_comment', 'More examples please'),
  ];
  const q5 = countAnswers('infosession', poll, rows).questions.find((q) => q.id === 'q5')!;
  if (q5.type === 'single') expect(q5.comments).toEqual(['More examples please']);
});

test('test sessions are stored but never counted', () => {
  expect(isTestSession('test-prod-1')).toBe(true);
  expect(isTestSession('7e1f-real')).toBe(false);

  const rows: PollRow[] = [
    row('test-prod-1', 'q1', 'Other'),
    row('real-session-1', 'q1', 'Other'),
  ];
  const results = countAnswers('infosession', poll, rows);
  expect(results.total).toBe(1);
  const q1 = results.questions.find((q) => q.id === 'q1')!;
  if (q1.type === 'single') {
    expect(q1.options.find((o) => o.label === 'Other')!.count).toBe(1);
  }
});

test('email addresses are normalized before hashing', () => {
  expect(normalizeEmail('  Anna.Example@Mail.CH  ')).toBe('anna.example@mail.ch');
  expect(normalizeEmail(undefined)).toBe('');
});

test('email validation is loose but rejects nonsense and overlong values', () => {
  expect(isValidEmail('anna@example.ch')).toBe(true);
  expect(isValidEmail('')).toBe(false);
  expect(isValidEmail('anna')).toBe(false);
  expect(isValidEmail('anna@example')).toBe(false);
  expect(isValidEmail('anna example@mail.ch')).toBe(false);
  expect(isValidEmail(`${'a'.repeat(250)}@mail.ch`)).toBe(false);
});

test('the email hash is deterministic, case-insensitive and hides the address', async () => {
  const lower = await hashEmail('anna@example.ch');
  const mixed = await hashEmail('  Anna@Example.CH ');
  const other = await hashEmail('bea@example.ch');

  expect(lower).toMatch(/^[0-9a-f]{64}$/);
  expect(mixed).toBe(lower);
  expect(other).not.toBe(lower);
  expect(lower).not.toContain('anna');
});

const stamped = (
  sessionKey: string,
  questionId: string,
  answer: string,
  createdAt: string,
): PollRow => ({ event: 'infosession', sessionKey, questionId, answer, createdAt });

test('a session that answered twice counts once, with its newest submission', () => {
  const rows: PollRow[] = [
    stamped('a', 'q1', 'Other', '2026-09-18T10:00:00.000Z'),
    stamped('a', 'q1', 'Designer or product', '2026-09-18T11:00:00.000Z'),
    stamped('b', 'q1', 'Other', '2026-09-18T10:30:00.000Z'),
  ];

  const results = countAnswers('infosession', poll, rows);
  expect(results.total).toBe(2);

  const q1 = results.questions.find((q) => q.id === 'q1')!;
  if (q1.type !== 'single') return;
  expect(q1.responses).toBe(2);
  expect(q1.options.find((o) => o.label === 'Designer or product')!.count).toBe(1);
  expect(q1.options.find((o) => o.label === 'Other')!.count).toBe(1);
  // The denominator holds: single choice never adds up to more than the answers.
  const sum = q1.options.reduce((n, o) => n + o.count, 0);
  expect(sum).toBe(q1.responses);
});

test('single choice options never add up to more than the answers', () => {
  const rows: PollRow[] = [
    row('a', 'q1', 'Other'),
    row('a', 'q1', 'Other'),
    row('a', 'q1', 'Designer or product'),
  ];

  const q1 = countAnswers('infosession', poll, rows).questions.find((q) => q.id === 'q1')!;
  if (q1.type !== 'single') return;
  expect(q1.responses).toBe(1);
  expect(q1.options.reduce((n, o) => n + o.count, 0)).toBe(1);
});

test('multi choice keeps every tool of the newest submission, no option above 100 percent', () => {
  const rows: PollRow[] = [
    stamped('a', 'q4', 'ChatGPT', '2026-09-18T10:00:00.000Z'),
    stamped('a', 'q4', 'Claude', '2026-09-18T10:00:00.000Z'),
    // Same person, second submission: the older batch must not be counted again.
    stamped('a', 'q4', 'ChatGPT', '2026-09-18T11:00:00.000Z'),
    stamped('a', 'q4', 'Cursor', '2026-09-18T11:00:00.000Z'),
    stamped('b', 'q4', 'ChatGPT', '2026-09-18T10:30:00.000Z'),
  ];

  const q4 = countAnswers('infosession', poll, rows).questions.find((q) => q.id === 'q4')!;
  if (q4.type !== 'multi') return;
  expect(q4.responses).toBe(2);
  expect(q4.options.find((o) => o.label === 'ChatGPT')!.count).toBe(2);
  expect(q4.options.find((o) => o.label === 'Cursor')!.count).toBe(1);
  expect(q4.options.find((o) => o.label === 'Claude')!.count).toBe(0);
  for (const option of q4.options) {
    expect(option.count).toBeLessThanOrEqual(q4.responses);
  }
});

test('the slider distribution never outgrows the number of answers', () => {
  const rows: PollRow[] = [
    stamped('a', 'q2', '3', '2026-09-18T10:00:00.000Z'),
    stamped('a', 'q2', '8', '2026-09-18T11:00:00.000Z'),
    stamped('b', 'q2', '8', '2026-09-18T10:30:00.000Z'),
  ];

  const q2 = countAnswers('infosession', poll, rows).questions.find((q) => q.id === 'q2')!;
  if (q2.type !== 'slider') return;
  expect(q2.responses).toBe(2);
  expect(q2.distribution.reduce((n, d) => n + d.count, 0)).toBe(2);
  expect(q2.distribution[8]).toEqual({ label: '8', count: 2 });
  expect(q2.average).toBe(8);
});

test('a repeated comment keeps only the newest text', () => {
  const rows: PollRow[] = [
    stamped('a', 'q5', 'Pitching', '2026-09-18T10:00:00.000Z'),
    stamped('a', 'q5_comment', 'first try', '2026-09-18T10:00:00.000Z'),
    stamped('a', 'q5', 'Pitching', '2026-09-18T11:00:00.000Z'),
    stamped('a', 'q5_comment', 'second try', '2026-09-18T11:00:00.000Z'),
  ];

  const q5 = countAnswers('infosession', poll, rows).questions.find((q) => q.id === 'q5')!;
  if (q5.type !== 'single') return;
  expect(q5.responses).toBe(1);
  expect(q5.comments).toEqual(['second try']);
});
