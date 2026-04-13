export class ProviderGenerationError extends Error {
  constructor(message = 'Provider failed to generate a reply.') {
    super(message);
    this.name = 'ProviderGenerationError';
  }
}
