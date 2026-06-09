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
    {
      method: 'GET',
      path: '/oauth2/authorize',
      handler: () => ({ statusCode: 501, body: { error: 'authorize_not_implemented' } }),
    },
    {
      method: 'POST',
      path: '/oauth2/token',
      handler: () => ({ statusCode: 501, body: { error: 'token_not_implemented' } }),
    },
    {
      method: 'GET',
      path: '/oauth2/jwks',
      handler: () => ({ statusCode: 200, body: { keys: [] } }),
    },
    {
      method: 'GET',
      path: '/oauth2/userinfo',
      handler: () => ({ statusCode: 501, body: { error: 'userinfo_not_implemented' } }),
    },
    {
      method: 'GET',
      path: '/oauth2/logout',
      handler: () => ({ statusCode: 501, body: { error: 'logout_not_implemented' } }),
    },
    {
      method: 'POST',
      path: '/oauth2/logout',
      handler: () => ({ statusCode: 501, body: { error: 'logout_not_implemented' } }),
    },
  ];
}
