import type { Route } from '../../../packages/http/src/index.js';
import { buildDiscoveryDocument } from '../../../packages/oidc/src/index.js';

export function buildApiRoutes(issuer: string): Route[] {
  return [
    {
      method: 'GET',
      path: '/health',
      handler: () => ({ statusCode: 200, body: { status: 'ok', service: 'api' } }),
    },
    {
      method: 'GET',
      path: '/.well-known/openid-configuration',
      handler: () => ({
        statusCode: 200,
        body: buildDiscoveryDocument({
          issuer,
          authorizationEndpoint: `${issuer}/oauth2/authorize`,
          tokenEndpoint: `${issuer}/oauth2/token`,
          jwksUri: `${issuer}/oauth2/jwks`,
          userinfoEndpoint: `${issuer}/oauth2/userinfo`,
          logoutEndpoint: `${issuer}/oauth2/logout`,
        }),
      }),
    },
  ];
}
