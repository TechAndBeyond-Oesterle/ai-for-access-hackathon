/**
 * Access check for the poll results (HCK-30).
 *
 * The results screen is not public: it needs `?key=` matching POLL_RESULTS_KEY.
 * An unset or empty key on the server locks the page instead of opening it.
 */

/** Length-independent comparison, so the check leaks no timing signal. */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * True only when a non-empty expected key is configured and the provided
 * value matches it exactly.
 */
export function resultsKeyOk(provided: unknown, expected: unknown): boolean {
  const want = typeof expected === 'string' ? expected.trim() : '';
  if (!want) return false;
  const got = typeof provided === 'string' ? provided : '';
  if (!got) return false;
  return constantTimeEquals(got, want);
}
