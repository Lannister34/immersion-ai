const FORBIDDEN_PATTERNS = /(co-authored-by:|generated with|claude code|chatgpt|copilot|codex)/i;
const CYRILLIC_PATTERN = /[\u0400-\u04FF]/;

module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'subject-no-cyrillic': (parsed) => {
          const subject = parsed.subject ?? '';
          return [!CYRILLIC_PATTERN.test(subject), 'commit subject must be English only'];
        },
        'message-no-ai-attribution': (parsed) => {
          const raw = parsed.raw ?? '';
          return [!FORBIDDEN_PATTERNS.test(raw), 'AI attribution lines are not allowed in commit messages'];
        },
      },
    },
  ],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'style', 'docs', 'chore']],
    'subject-case': [0],
    'subject-no-cyrillic': [2, 'always'],
    'message-no-ai-attribution': [2, 'always'],
  },
};
