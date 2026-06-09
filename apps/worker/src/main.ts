import { loadConfig } from '../../../packages/config/src/index.js';
import { createLogger } from '../../../packages/logger/src/index.js';
import { JobRegistry } from '../../../packages/jobs/src/index.js';

export async function startWorkerService(): Promise<void> {
  const config = loadConfig('worker');
  const logger = createLogger('worker');
  const jobs = new JobRegistry();

  logger.info('worker_service_started', {
    environment: config.environment,
    registeredJobs: jobs.list(),
  });
}

startWorkerService().catch((error) => {
  console.error('Worker service failed to start', error);
  process.exitCode = 1;
});
