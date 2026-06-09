import type { HttpRequest, Route } from '../../../packages/http/src/index.js';
import {
  buildDiscoveryDocument,
  DefaultAuthorizationService,
  DevTokenIssuer,
  MemoryAuthorizationCodeStore,
  MemoryOidcClientRepository,
} from '../../../packages/oidc/src/index.js';

const codeStore = new MemoryAuthorizationCodeStore();
const clientStore = new MemoryOidcClientRepository([
  {
    clientId: 'dev-client',
    clientType: 'public',
    allowedRedirectUris: ['http://localhost:3000/callback'],
    allowedScopes: ['openid', 'profile', 'email', 'groups'],
    isActive: true,
  },
]);
const authorizationService = new DefaultAuthorizationService(clientStore, codeStore);
const tokenIssuer = new DevTokenIssuer(codeStore);

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
      handler: async (request) => handleAuthorize(request),
    },
    {
      method: 'POST',
      path: '/oauth2/token',
      handler: async (request) => handleToken(request),
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

async function handleAuthorize(request: HttpRequest) {
  try {
    const response = await authorizationService.start({
      clientId: requireQuery(request, 'client_id'),
      redirectUri: requireQuery(request, 'redirect_uri'),
      responseType: 'code',
      scope: requireQuery(request, 'scope'),
      state: request.query.state,
      codeChallenge: requireQuery(request, 'code_challenge'),
      codeChallengeMethod: 'S256',
      subjectId: request.query.subject_id ?? 'dev-user',
      workspaceId: request.query.workspace_id ?? 'dev-workspace',
    });

    const redirect = new URL(response.redirectUri);
    redirect.searchParams.set('code', response.code);
    if (response.state) {
      redirect.searchParams.set('state', response.state);
    }

    return { statusCode: 302, headers: { location: redirect.toString() }, body: { redirect: redirect.toString() } };
  } catch (error) {
    return { statusCode: 400, body: { error: error instanceof Error ? error.message : 'invalid_request' } };
  }
}

async function handleToken(request: HttpRequest) {
  const body = typeof request.body === 'object' && request.body !== null ? request.body as Record<string, string> : {};

  try {
    const response = await tokenIssuer.issueToken({
      grantType: requireBody(body, 'grant_type') === 'refresh_token' ? 'refresh_token' : 'authorization_code',
      clientId: requireBody(body, 'client_id'),
      redirectUri: readBodyValue(body, 'redirect_uri'),
      code: readBodyValue(body, 'code'),
      refreshToken: readBodyValue(body, 'refresh_token'),
      codeVerifier: readBodyValue(body, 'code_verifier'),
    });

    return { statusCode: 200, body: response };
  } catch (error) {
    return { statusCode: 400, body: { error: error instanceof Error ? error.message : 'invalid_request' } };
  }
}

function requireQuery(request: HttpRequest, name: string): string {
  const value = request.query[name];
  if (!value) {
    throw new Error(`missing_${name}`);
  }
  return value;
}

function requireBody(body: Record<string, string>, name: string): string {
  const value = readBodyValue(body, name);
  if (!value) {
    throw new Error(`missing_${name}`);
  }
  return value;
}

function readBodyValue(body: Record<string, string>, name: string): string | undefined {
  return typeof body[name] === 'string' ? body[name] : undefined;
}
