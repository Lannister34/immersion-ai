import { type HealthResponse, HealthResponseSchema } from '@immersion/contracts';

export async function fetchFoundationStatus(): Promise<HealthResponse> {
  const response = await fetch('/health');
  const payload = await response.json();

  return HealthResponseSchema.parse(payload);
}
