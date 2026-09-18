/**
 * Pure validation and counting for the poll tool (HCK-30).
 * No Airtable, no Astro: everything here is unit-testable.
 */

import {
  getPoll,
  hasComment,
  multiOptions,
  type CommentableQuestion,
  type MultiQuestion,
  type Poll,
  type Question,
  type SingleQuestion,
  type SliderQuestion,
} from './polls';

/** One Airtable row: one question (or one checked option) of one session. */
export type PollRow = {
  event: string;
  sessionKey: string;
  questionId: string;
  answer: string;
  /** All rows of one submission carry the same timestamp. Early rows may lack it. */
  createdAt?: string;
};

export type NewRow = { questionId: string; answer: string };

export type ValidationResult =
  | { ok: true; rows: NewRow[] }
  | { ok: false; error: string };

/** Sessions with this prefix are stored but never counted (smoke tests). */
export const TEST_SESSION_PREFIX = 'test-';

export const isTestSession = (sessionKey: string) =>
  sessionKey.startsWith(TEST_SESSION_PREFIX);

/** Deliberately loose: this is a duplicate guard, not an address verification. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX_LENGTH = 254;

/** One person, one spelling: trimmed and lower-cased before hashing. */
export const normalizeEmail = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();

export const isValidEmail = (email: string): boolean =>
  email.length > 0 && email.length <= EMAIL_MAX_LENGTH && EMAIL_RE.test(email);

/**
 * SHA-256 hex of the normalized address. Only this hash is stored, never the
 * address: it counts each person once and stays unreadable afterwards.
 */
export async function hashEmail(email: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeEmail(email));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Turns a submitted answer map into Airtable rows, or rejects it.
 * Every question is optional, but an empty submission is rejected.
 */
export function validateSubmission(poll: Poll, answers: unknown): ValidationResult {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return { ok: false, error: 'answers must be an object' };
  }

  const byId = new Map<string, Question>();
  const commentOwners = new Map<string, CommentableQuestion>();
  for (const q of poll.questions) {
    byId.set(q.id, q);
    if (hasComment(q)) commentOwners.set(q.comment.id, q);
  }

  const rows: NewRow[] = [];

  for (const [key, value] of Object.entries(answers as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') continue;

    const commentOwner = commentOwners.get(key);
    if (commentOwner) {
      if (typeof value !== 'string') {
        return { ok: false, error: `Comment ${key} must be text` };
      }
      const text = value.trim();
      if (!text) continue;
      const max = commentOwner.comment!.maxLength;
      if (text.length > max) {
        return { ok: false, error: `Comment ${key} is longer than ${max} characters` };
      }
      rows.push({ questionId: key, answer: text });
      continue;
    }

    const question = byId.get(key);
    if (!question) {
      return { ok: false, error: `Unknown question ${key}` };
    }

    if (question.type === 'single') {
      if (typeof value !== 'string' || !question.options.includes(value)) {
        return { ok: false, error: `Unknown option for ${key}` };
      }
      rows.push({ questionId: key, answer: value });
      continue;
    }

    if (question.type === 'slider') {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isInteger(n) || n < question.min || n > question.max) {
        return {
          ok: false,
          error: `${key} must be a whole number between ${question.min} and ${question.max}`,
        };
      }
      rows.push({ questionId: key, answer: String(n) });
      continue;
    }

    // multi
    if (!Array.isArray(value)) {
      return { ok: false, error: `${key} must be a list` };
    }
    const allowed = multiOptions(question as MultiQuestion);
    const seen = new Set<string>();
    for (const option of value) {
      if (typeof option !== 'string' || !allowed.includes(option)) {
        return { ok: false, error: `Unknown option for ${key}` };
      }
      if (seen.has(option)) continue;
      seen.add(option);
      rows.push({ questionId: key, answer: option });
    }
  }

  if (!rows.length) {
    return { ok: false, error: 'No answers submitted' };
  }

  return { ok: true, rows };
}

export type OptionResult = { label: string; count: number };

export type QuestionResult =
  | { id: string; text: string; type: 'single'; options: OptionResult[]; responses: number; comments?: string[] }
  | { id: string; text: string; type: 'multi'; options: OptionResult[]; responses: number; groups: { label: string; options: OptionResult[] }[]; comments?: string[] }
  | {
      id: string;
      text: string;
      type: 'slider';
      minLabel: string;
      maxLabel: string;
      distribution: OptionResult[];
      average: number | null;
      responses: number;
    };

export type PollResults = {
  event: string;
  title: string;
  total: number;
  questions: QuestionResult[];
  updatedAt: string;
};

/**
 * Keeps one submission per session and question.
 *
 * A session can carry two submissions: the duplicate guard used to run on the
 * session key and now runs on the email hash, so older rows can repeat. Without
 * this the option counts outgrow the number of submissions and the result page
 * shows more than 100 percent. Multi-choice keeps every option of the newest
 * submission, every other question keeps exactly one row.
 */
export function latestPerSession(poll: Poll, rows: PollRow[]): PollRow[] {
  const multiIds = new Set(
    poll.questions.filter((q) => q.type === 'multi').map((q) => q.id),
  );

  const groups = new Map<string, PollRow[]>();
  for (const row of rows) {
    const key = `${row.sessionKey}|${row.questionId}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const keep = new Set<PollRow>();
  for (const list of groups.values()) {
    const newest = list.reduce((max, row) => {
      const at = String(row.createdAt ?? '');
      return at > max ? at : max;
    }, '');
    const batch = list.filter((row) => String(row.createdAt ?? '') === newest);
    const questionId = list[0].questionId;

    if (multiIds.has(questionId)) {
      const seen = new Set<string>();
      for (const row of batch) {
        if (seen.has(row.answer)) continue;
        seen.add(row.answer);
        keep.add(row);
      }
      continue;
    }
    // Untimestamped leftovers can still tie: the last row wins.
    keep.add(batch[batch.length - 1]);
  }

  return rows.filter((row) => keep.has(row));
}

/** Counts rows per question and option. Test sessions are left out. */
export function countAnswers(event: string, poll: Poll, rows: PollRow[]): PollResults {
  const live = latestPerSession(
    poll,
    rows.filter((r) => !isTestSession(r.sessionKey)),
  );

  const sessions = new Set<string>();
  const byQuestion = new Map<string, PollRow[]>();
  for (const row of live) {
    sessions.add(row.sessionKey);
    const list = byQuestion.get(row.questionId);
    if (list) list.push(row);
    else byQuestion.set(row.questionId, [row]);
  }

  const questions: QuestionResult[] = poll.questions.map((q) => {
    const rowsForQuestion = byQuestion.get(q.id) ?? [];
    const counts = new Map<string, number>();
    for (const row of rowsForQuestion) {
      counts.set(row.answer, (counts.get(row.answer) ?? 0) + 1);
    }
    const sessionsForQuestion = new Set(rowsForQuestion.map((r) => r.sessionKey)).size;

    if (q.type === 'single') {
      const single = q as SingleQuestion;
      const result: QuestionResult = {
        id: q.id,
        text: q.text,
        type: 'single',
        responses: sessionsForQuestion,
        options: single.options.map((label) => ({ label, count: counts.get(label) ?? 0 })),
      };
      if (single.comment) {
        result.comments = (byQuestion.get(single.comment.id) ?? []).map((r) => r.answer);
      }
      return result;
    }

    if (q.type === 'slider') {
      const slider = q as SliderQuestion;
      const distribution: OptionResult[] = [];
      let sum = 0;
      let n = 0;
      for (let value = slider.min; value <= slider.max; value += 1) {
        const count = counts.get(String(value)) ?? 0;
        distribution.push({ label: String(value), count });
        sum += value * count;
        n += count;
      }
      return {
        id: q.id,
        text: q.text,
        type: 'slider',
        minLabel: slider.minLabel,
        maxLabel: slider.maxLabel,
        distribution,
        average: n ? Math.round((sum / n) * 10) / 10 : null,
        responses: n,
      };
    }

    const multi = q as MultiQuestion;
    const result: QuestionResult = {
      id: q.id,
      text: q.text,
      type: 'multi',
      responses: sessionsForQuestion,
      options: multiOptions(multi).map((label) => ({ label, count: counts.get(label) ?? 0 })),
      groups: multi.groups.map((g) => ({
        label: g.label,
        options: g.options.map((label) => ({ label, count: counts.get(label) ?? 0 })),
      })),
    };
    if (multi.comment) {
      result.comments = (byQuestion.get(multi.comment.id) ?? []).map((r) => r.answer);
    }
    return result;
  });

  return {
    event,
    title: poll.title,
    total: sessions.size,
    questions,
    updatedAt: new Date().toISOString(),
  };
}

export const emptyResults = (event: string): PollResults | undefined => {
  const poll = getPoll(event);
  return poll ? countAnswers(event, poll, []) : undefined;
};
