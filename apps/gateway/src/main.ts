import { loadConfig } from '../../../packages/config/src/index.js';
import { createLogger } from '../../../packages/logger/src/index.js';
import { startNodeServer } from '../../../packages/http/src/index.js';
import { buildGatewayRoutes } from './routes.js';

export async function startGatewayService(): Promise<void> {
  const config = loadConfig('gateway');
  const logger = createLogger('gateway');
  const routes = await buildGatewayRoutes(config.publicIssuer, config.dataDir);

  startNodeServer({
    port: config.port,
    routes,
  });

  logger.info('gateway_service_started', {
    port: config.port,
  });
}

startGatewayService().catch((error) => {
  console.error('Gateway service failed to start', error);
  process.exitCode = 1;
});
