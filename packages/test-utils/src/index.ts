export function createStableIsoTimestamp(value: string = '2026-04-05T00:00:00.000Z'): string {
  return new Date(value).toISOString();
}
