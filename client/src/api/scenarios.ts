import type { Scenario, ScenarioSummary } from '@/types';
import { apiPost } from './client';

export async function getScenarios(): Promise<ScenarioSummary[]> {
  return apiPost<ScenarioSummary[]>('/api/scenarios/list', {});
}

export async function getScenario(name: string): Promise<Scenario> {
  return apiPost<Scenario>('/api/scenarios/get', { name });
}

export async function createScenario(scenario: {
  name: string;
  content?: string;
  tags?: string[];
  concept?: string;
}): Promise<void> {
  await apiPost('/api/scenarios/create', scenario);
}

export async function saveScenario(name: string, data: Scenario): Promise<void> {
  await apiPost('/api/scenarios/edit', { name, data });
}

export async function deleteScenario(name: string): Promise<void> {
  await apiPost('/api/scenarios/delete', { name });
}
