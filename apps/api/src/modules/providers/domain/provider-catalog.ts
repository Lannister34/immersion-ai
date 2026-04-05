import type { ProviderDefinition } from '@immersion/contracts/providers';

export const providerDefinitions: ProviderDefinition[] = [
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
