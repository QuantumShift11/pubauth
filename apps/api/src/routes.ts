import { RsaJwtSigner } from '../../../packages/crypto/src/index.js';
import type { HttpRequest, Route } from '../../../packages/http/src/index.js';
import {
  buildDiscoveryDocument,
  DefaultAuthorizationService,
  DevTokenIssuer,
  DevUserInfoService,
  MemoryAccessTokenStore,
  MemoryAuthorizationCodeStore,
  MemoryOidcClientRepository,
} from '../../../packages/oidc/src/index.js';
import { NotImplementedAdminService } from '../../../packages/admin/src/index.js';

const codeStore = new MemoryAuthorizationCodeStore();
const accessTokenStore = new MemoryAccessTokenStore();
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
const adminService = new NotImplementedAdminService();

export interface ApiRouteContext {
  jwtSigner: RsaJwtSigner;
  tokenIssuer: DevTokenIssuer;
  userInfoService: DevUserInfoService;
  authorizationService: DefaultAuthorizationService;
}

export function buildApiContext(issuer: string): ApiRouteContext {
  const jwtSigner = RsaJwtSigner.generate(issuer);
  return {
    jwtSigner,
    tokenIssuer: new DevTokenIssuer(codeStore, accessTokenStore, jwtSigner),
    userInfoService: new DevUserInfoService(accessTokenStore, jwtSigner),
    authorizationService,
  };
}

export function buildApiRoutes(issuer: string, context = buildApiContext(issuer)): Route[] {
  const { jwtSigner, tokenIssuer, userInfoService, authorizationService } = context;

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
      handler: async (request) => handleAuthorize(request, authorizationService),
    },
    {
      method: 'POST',
      path: '/oauth2/token',
      handler: async (request) => handleToken(request, tokenIssuer),
    },
    {
      method: 'GET',
      path: '/oauth2/jwks',
      handler: () => ({ statusCode: 200, body: jwtSigner.jwks() }),
    },
    {
      method: 'GET',
      path: '/oauth2/userinfo',
      handler: async (request) => handleUserInfo(request, userInfoService),
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
    {
      method: 'POST',
      path: '/admin/products',
      handler: async () => handleAdminNotImplemented('admin_products_not_implemented', adminService.createProduct({
        name: 'pending',
        slug: 'pending',
        environment: 'local',
      })),
    },
    {
      method: 'POST',
      path: '/admin/workspaces',
      handler: async () => handleAdminNotImplemented('admin_workspaces_not_implemented', adminService.createWorkspace({
        name: 'pending',
        slug: 'pending',
      })),
    },
    {
      method: 'POST',
      path: '/admin/clients',
      handler: async () => handleAdminNotImplemented('admin_clients_not_implemented', adminService.createClient({
        productId: 'pending',
        clientType: 'public',
        redirectUris: [],
        scopes: [],
      })),
    },
    {
      method: 'POST',
      path: '/admin/route-policies',
      handler: async () => handleAdminNotImplemented('admin_route_policies_not_implemented', adminService.createRoutePolicy({
        productId: 'pending',
        pathPattern: '/**',
        methods: ['GET'],
        requiredRoles: ['viewer'],
      })),
    },
  ];
}

async function handleAuthorize(request: HttpRequest, authorizationService: DefaultAuthorizationService) {
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

async function handleToken(request: HttpRequest, tokenIssuer: DevTokenIssuer) {
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

async function handleUserInfo(request: HttpRequest, userInfoService: DevUserInfoService) {
  try {
    const accessToken = readBearerToken(request);
    const response = await userInfoService.getUserInfo({ accessToken });
    return { statusCode: 200, body: response };
  } catch (error) {
    return { statusCode: 401, body: { error: error instanceof Error ? error.message : 'invalid_token' } };
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

function readBearerToken(request: HttpRequest): string {
  const header = request.headers.authorization ?? request.headers.Authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new Error('missing_bearer_token');
  }
  return header.slice('Bearer '.length);
}

async function handleAdminNotImplemented(
  error: string,
  resultPromise: Promise<{ ok: boolean; message: string }>,
) {
  await resultPromise;
  return { statusCode: 501, body: { error } };
}
