/**
 * Poll question catalogue (HCK-30).
 *
 * Questions live in code, one route per event. A new poll is a new key in POLLS.
 * Question texts stay English on both language routes: the audience is mixed and
 * the answers need to be comparable.
 */

/** Free-text follow-up under a question, stored as its own row `<id>_comment`. */
export type CommentField = { id: string; label: string; maxLength: number };

export type SingleQuestion = {
  id: string;
  type: 'single';
  text: string;
  options: string[];
  comment?: CommentField;
};

export type SliderQuestion = {
  id: string;
  type: 'slider';
  text: string;
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
};

export type MultiQuestion = {
  id: string;
  type: 'multi';
  text: string;
  groups: { label: string; options: string[] }[];
  comment?: CommentField;
};

export type Question = SingleQuestion | SliderQuestion | MultiQuestion;

export type Poll = {
  title: string;
  subtitle: string;
  questions: Question[];
};

export const COMMENT_MAX_LENGTH = 280;

export const POLLS = {
  infosession: {
    title: 'Info session poll',
    subtitle: 'Seven questions, under a minute. No name, no login.',
    questions: [
      {
        id: 'q1',
        type: 'single',
        text: 'What is your background?',
        options: [
          'Domain expert (health, law, education, social work, other)',
          'Designer or product',
          'Developer or data',
          'Student or career changer',
          'Other',
        ],
      },
      {
        id: 'q2',
        type: 'slider',
        text: 'How much coding experience do you have?',
        min: 0,
        max: 10,
        minLabel: 'none',
        maxLabel: 'professional developer',
      },
      {
        id: 'q3',
        type: 'single',
        text: 'Have you built something with AI tools before?',
        options: [
          'Never',
          'Tried once',
          'Built a small thing',
          'I build with AI every week',
        ],
      },
      {
        id: 'q4',
        type: 'multi',
        text: 'Which tools have you used?',
        groups: [
          { label: 'Chat assistants', options: ['ChatGPT', 'Claude', 'Gemini'] },
          { label: 'Prompt-to-app builders', options: ['Lovable', 'Bloom', 'Bolt', 'v0'] },
          { label: 'AI code editors', options: ['Cursor', 'GitHub Copilot', 'Windsurf'] },
          { label: 'Terminal agents', options: ['Claude Code', 'Codex', 'OpenCode or other'] },
          { label: '', options: ['None of these'] },
        ],
      },
      {
        id: 'q5',
        type: 'multi',
        text: 'What would help you before the event?',
        groups: [
          {
            label: '',
            options: [
              'Choosing and setting up tools',
              'Turning an idea into a small demo',
              'Finding a team',
              'Pitching',
              'Nothing, I am ready',
            ],
          },
        ],
        comment: { id: 'q5_comment', label: 'Anything else?', maxLength: COMMENT_MAX_LENGTH },
      },
      {
        id: 'q6',
        type: 'single',
        text: 'Do you want to submit your own challenge?',
        options: ['Yes, I have an idea', 'Maybe, I need help shaping it', 'No'],
      },
      {
        id: 'q7',
        type: 'single',
        text: 'Do you have a team?',
        options: ['Yes, complete', 'Partly, we need people', 'No, I am looking for one'],
      },
    ],
  },
} satisfies Record<string, Poll>;

export type PollEvent = keyof typeof POLLS;

export const isPollEvent = (value: unknown): value is PollEvent =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(POLLS, value);

export const getPoll = (event: string): Poll | undefined =>
  isPollEvent(event) ? (POLLS[event] as Poll) : undefined;

/** All options of a multi question, groups flattened. */
export const multiOptions = (q: MultiQuestion): string[] =>
  q.groups.flatMap((g) => g.options);

/** Questions that can carry a free-text comment: everything but the sliders. */
export type CommentableQuestion = SingleQuestion | MultiQuestion;

export const hasComment = (q: Question): q is CommentableQuestion & { comment: CommentField } =>
  q.type !== 'slider' && q.comment !== undefined;

/** Question ids that carry a free-text comment, mapped to their parent question. */
export const commentQuestions = (poll: Poll): Map<string, CommentableQuestion> => {
  const map = new Map<string, CommentableQuestion>();
  for (const q of poll.questions) {
    if (hasComment(q)) map.set(q.comment.id, q);
  }
  return map;
};
