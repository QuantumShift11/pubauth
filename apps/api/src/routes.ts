import { resolve } from 'node:path';
import { RsaJwtSigner } from '../../../packages/crypto/src/index.js';
import type { HttpRequest, Route } from '../../../packages/http/src/index.js';
import {
  buildDiscoveryDocument,
  DefaultAuthorizationService,
  FileAccessTokenStore,
  FileAuthorizationCodeStore,
  FileOidcClientRepository,
  JwtTokenIssuer,
  JwtUserInfoService,
  resolveTokenClaims,
} from '../../../packages/oidc/src/index.js';
import { FileAdminService } from '../../../packages/admin/src/index.js';
import { JsonFileStore, createDefaultPubAuthState, type PubAuthState } from '../../../packages/storage/src/index.js';

export interface ApiRouteContext {
  stateStore: JsonFileStore<PubAuthState>;
  jwtSigner: RsaJwtSigner;
  tokenIssuer: JwtTokenIssuer;
  userInfoService: JwtUserInfoService;
  authorizationService: DefaultAuthorizationService;
  adminService: FileAdminService;
}

export async function buildApiContext(issuer: string, dataDir = '.pubauth-data'): Promise<ApiRouteContext> {
  const stateStore = new JsonFileStore<PubAuthState>(resolve(dataDir, 'state.json'), createDefaultPubAuthState());
  const jwtSigner = await loadOrCreateSigner(stateStore, issuer);
  const clientStore = new FileOidcClientRepository(stateStore);
  const authorizationCodeStore = new FileAuthorizationCodeStore(stateStore);
  const accessTokenStore = new FileAccessTokenStore(stateStore);
  const adminService = new FileAdminService(stateStore);

  return {
    stateStore,
    jwtSigner,
    tokenIssuer: new JwtTokenIssuer(
      authorizationCodeStore,
      accessTokenStore,
      jwtSigner,
      (request) => resolveTokenClaims(stateStore, request),
    ),
    userInfoService: new JwtUserInfoService(accessTokenStore, jwtSigner),
    authorizationService: new DefaultAuthorizationService(clientStore, authorizationCodeStore),
    adminService,
  };
}

export async function buildApiRoutes(issuer: string, dataDirOrContext?: string | ApiRouteContext): Promise<Route[]> {
  const context =
    typeof dataDirOrContext === 'string'
      ? await buildApiContext(issuer, dataDirOrContext)
      : dataDirOrContext ?? (await buildApiContext(issuer));

  const { jwtSigner, tokenIssuer, userInfoService, authorizationService, adminService } = context;

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
      handler: () => ({ statusCode: 200, body: { status: 'ok', action: 'logout' } }),
    },
    {
      method: 'POST',
      path: '/oauth2/logout',
      handler: () => ({ statusCode: 200, body: { status: 'ok', action: 'logout' } }),
    },
    {
      method: 'GET',
      path: '/admin/overview',
      handler: async () => ({ statusCode: 200, body: await adminService.getOverview() }),
    },
    {
      method: 'POST',
      path: '/admin/products',
      handler: async (request) => handleAdminResponse(await adminService.createProduct(parseProductCommand(readBody(request)))),
    },
    {
      method: 'POST',
      path: '/admin/workspaces',
      handler: async (request) => handleAdminResponse(await adminService.createWorkspace(parseWorkspaceCommand(readBody(request)))),
    },
    {
      method: 'POST',
      path: '/admin/clients',
      handler: async (request) =>
        handleAdminResponse(
          await adminService.createClient({
            productId: requireBodyString(readBody(request), 'productId'),
            clientType: requireBodyString(readBody(request), 'clientType') as 'public' | 'confidential',
            redirectUris: requireBodyArray(readBody(request), 'redirectUris'),
            scopes: requireBodyArray(readBody(request), 'scopes'),
          }),
        ),
    },
    {
      method: 'POST',
      path: '/admin/route-policies',
      handler: async (request) =>
        handleAdminResponse(
          await adminService.createRoutePolicy({
            productId: requireBodyString(readBody(request), 'productId'),
            upstreamUrl: requireBodyString(readBody(request), 'upstreamUrl'),
            pathPattern: requireBodyString(readBody(request), 'pathPattern'),
            methods: requireBodyArray(readBody(request), 'methods'),
            requiredRoles: requireBodyArray(readBody(request), 'requiredRoles'),
          }),
        ),
    },
    {
      method: 'POST',
      path: '/admin/roles',
      handler: async (request) => handleAdminResponse(await adminService.createRole(requireBodyString(readBody(request), 'name'))),
    },
    {
      method: 'POST',
      path: '/admin/assignments',
      handler: async (request) =>
        handleAdminResponse(
          await adminService.assignRole({
            userId: requireBodyString(readBody(request), 'userId'),
            role: requireBodyString(readBody(request), 'role'),
            workspaceId: readOptionalBodyString(readBody(request), 'workspaceId'),
          }),
        ),
    },
  ];
}

async function loadOrCreateSigner(stateStore: JsonFileStore<PubAuthState>, issuer: string): Promise<RsaJwtSigner> {
  const now = new Date().toISOString();
  const state = await stateStore.update((current) => {
    if (current.signingKeys.length > 0) {
      return current;
    }

    const generated = RsaJwtSigner.generateWithMaterial(issuer);
    current.signingKeys.push({
      keyId: generated.signer.keyId,
      algorithm: 'RS256',
      publicKeyPem: generated.publicKeyPem,
      privateKeyPem: generated.privateKeyPem,
      status: 'active',
      createdAt: now,
    });
    return current;
  });

  const activeKey = state.signingKeys.find((item) => item.status === 'active') ?? state.signingKeys[0];
  if (!activeKey) {
    const generated = RsaJwtSigner.generateWithMaterial(issuer);
    return generated.signer;
  }

  return RsaJwtSigner.fromPem(issuer, activeKey.keyId, activeKey.privateKeyPem, activeKey.publicKeyPem);
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
      subjectId: request.query.subject_id ?? 'default-user',
      workspaceId: request.query.workspace_id ?? 'default-workspace',
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

async function handleToken(request: HttpRequest, tokenIssuer: JwtTokenIssuer) {
  const body = readBody(request);

  try {
    const grantType = requireBodyString(body, 'grant_type');
    if (grantType !== 'authorization_code') {
      throw new Error('unsupported_grant_type');
    }

    const response = await tokenIssuer.issueToken({
      grantType: 'authorization_code',
      clientId: requireBodyString(body, 'client_id'),
      redirectUri: readOptionalBodyString(body, 'redirect_uri'),
      code: readOptionalBodyString(body, 'code'),
      codeVerifier: readOptionalBodyString(body, 'code_verifier'),
    });

    return { statusCode: 200, body: response };
  } catch (error) {
    return { statusCode: 400, body: { error: error instanceof Error ? error.message : 'invalid_request' } };
  }
}

async function handleUserInfo(request: HttpRequest, userInfoService: JwtUserInfoService) {
  try {
    const accessToken = readBearerToken(request);
    const response = await userInfoService.getUserInfo({ accessToken });
    return { statusCode: 200, body: response };
  } catch (error) {
    return { statusCode: 401, body: { error: error instanceof Error ? error.message : 'invalid_token' } };
  }
}

function handleAdminResponse(result: { ok: boolean; id?: string; message: string }) {
  return { statusCode: result.ok ? 201 : 400, body: result };
}

function requireQuery(request: HttpRequest, name: string): string {
  const value = request.query[name];
  if (!value) {
    throw new Error(`missing_${name}`);
  }
  return value;
}

function readBody(request: HttpRequest): Record<string, unknown> {
  return typeof request.body === 'object' && request.body !== null ? (request.body as Record<string, unknown>) : {};
}

function parseProductCommand(body: Record<string, unknown>): { name: string; slug: string; environment: 'local' | 'dev' | 'qa' | 'prod' } {
  const environment = requireBodyString(body, 'environment');
  if (environment !== 'local' && environment !== 'dev' && environment !== 'qa' && environment !== 'prod') {
    throw new Error('invalid_environment');
  }

  return {
    name: requireBodyString(body, 'name'),
    slug: requireBodyString(body, 'slug'),
    environment,
  };
}

function parseWorkspaceCommand(body: Record<string, unknown>): { name: string; slug: string } {
  return {
    name: requireBodyString(body, 'name'),
    slug: requireBodyString(body, 'slug'),
  };
}

function requireBodyString(body: Record<string, unknown>, name: string): string {
  const value = readOptionalBodyString(body, name);
  if (!value) {
    throw new Error(`missing_${name}`);
  }
  return value;
}

function readOptionalBodyString(body: Record<string, unknown>, name: string): string | undefined {
  return typeof body[name] === 'string' ? (body[name] as string) : undefined;
}

function requireBodyArray(body: Record<string, unknown>, name: string): string[] {
  const value = body[name];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`invalid_${name}`);
  }
  return value as string[];
}

function readBearerToken(request: HttpRequest): string {
  const header = request.headers.authorization ?? request.headers.Authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new Error('missing_bearer_token');
  }
  return header.slice('Bearer '.length);
}
