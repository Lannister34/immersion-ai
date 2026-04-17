import type { ProviderDefinition } from '@immersion/contracts/providers';

export const providerDefinitions: ProviderDefinition[] = [
  {
    type: 'koboldcpp',
    label: 'KoboldCpp API',
    fields: [
      {
        key: 'url',
        type: 'text',
        required: true,
        placeholder: 'http://127.0.0.1:5001',
        defaultValue: 'http://127.0.0.1:5001',
      },
      {
        key: 'model',
        type: 'text',
        required: false,
        placeholder: 'local-model',
        defaultValue: 'local-model',
      },
    ],
  },
  {
    type: 'custom',
    label: 'OpenAI-совместимый API',
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
      {
        key: 'model',
        type: 'text',
        required: false,
        placeholder: 'local-model',
        defaultValue: 'local-model',
      },
    ],
  },
];
