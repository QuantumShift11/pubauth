import type { Route } from '../../../packages/http/src/index.js';
import { allow, deny } from '../../../packages/gateway/src/index.js';

export function buildGatewayRoutes(): Route[] {
  return [
    {
      method: 'GET',
      path: '/health',
      handler: () => ({ statusCode: 200, body: { status: 'ok', service: 'gateway' } }),
    },
    {
      method: 'GET',
      path: '/_pubauth/decision',
      handler: () => ({ statusCode: 200, body: allow('http://upstream.local') }),
    },
    {
      method: 'POST',
      path: '/_pubauth/deny',
      handler: () => ({ statusCode: 403, body: deny(403, 'policy_denied') }),
    },
  ];
}
