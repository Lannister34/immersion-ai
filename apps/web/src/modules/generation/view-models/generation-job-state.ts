import type { GenerationJobDto } from '@immersion/contracts/generation';

export function isActiveGenerationJob(job: GenerationJobDto) {
  return job.status === 'queued' || job.status === 'running';
}

export function sortGenerationJobs(jobs: GenerationJobDto[]) {
  return [...jobs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function upsertGenerationJob(jobs: GenerationJobDto[], job: GenerationJobDto) {
  return sortGenerationJobs([job, ...jobs.filter((item) => item.id !== job.id)]);
}

export function getLatestGenerationJob(jobs: GenerationJobDto[] | undefined) {
  return sortGenerationJobs(jobs ?? [])[0];
}
