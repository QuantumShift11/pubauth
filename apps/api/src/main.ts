import { loadConfig } from '../../../packages/config/src/index.js';
import { createLogger } from '../../../packages/logger/src/index.js';
import { startNodeServer } from '../../../packages/http/src/index.js';
import { buildApiRoutes } from './routes.js';

export async function startApiService(): Promise<void> {
  const config = loadConfig('api');
  const logger = createLogger('api');

  startNodeServer({
    port: config.port,
    routes: buildApiRoutes(config.publicIssuer),
  });

  logger.info('api_service_started', {
    port: config.port,
    issuer: config.publicIssuer,
  });
}

startApiService().catch((error) => {
  console.error('API service failed to start', error);
  process.exitCode = 1;
});
