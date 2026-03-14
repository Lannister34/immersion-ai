import { Router } from 'express';

// ── Provider field schema types ────────────────────────────────────────────

interface ProviderFieldDef {
  key: string;
  type: 'text' | 'password';
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
}

interface ProviderDefinition {
  type: string;
  label: string;
  fields: ProviderFieldDef[];
}

// ── Provider definitions ───────────────────────────────────────────────────

const PROVIDERS: ProviderDefinition[] = [
  {
    type: 'koboldcpp',
    label: 'KoboldCpp',
    fields: [
      {
        key: 'url',
        type: 'text',
        required: true,
        placeholder: 'http://127.0.0.1:5001',
        defaultValue: 'http://127.0.0.1:5001',
      },
    ],
  },
  {
    type: 'custom',
    label: 'Custom',
    fields: [
      {
        key: 'url',
        type: 'text',
        required: true,
        placeholder: 'http://127.0.0.1:5001',
        defaultValue: 'http://127.0.0.1:5001',
      },
      {
        key: 'apiKey',
        type: 'password',
        required: false,
      },
    ],
  },
];

// ── Routes ─────────────────────────────────────────────────────────────────

export const router = Router();

router.get('/', (_req, res) => {
  res.json(PROVIDERS);
});
