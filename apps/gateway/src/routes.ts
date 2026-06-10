import type { Route } from '../../../packages/http/src/index.js';
import { buildGatewayProxyRoutes } from '../../../packages/gateway/src/index.js';

export async function buildGatewayRoutes(
  issuer: string,
  dataDir = '.pubauth-data',
  fetchImpl: typeof fetch = fetch,
): Promise<Route[]> {
  return buildGatewayProxyRoutes({
    issuer,
    dataDir,
    fetchImpl,
  });
}
