import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { HttpRequest, Route } from '../../../packages/http/src/index.js';
import {
  buildDiscoveryDocument,
  CompositeSessionAuthenticator,
  DevSessionAuthenticator,
  DefaultAuthorizationService,
  CookieSessionAuthenticator,
  FileAccessTokenStore,
  FileAuthorizationCodeStore,
  FileOidcClientRepository,
  JwtTokenIssuer,
  JwtUserInfoService,
  createSigningKeyService,
  type SigningKeyService,
  type SessionAuthenticator,
  resolveTokenClaims,
} from '../../../packages/oidc/src/index.js';
import { AdminAccessControlService, FileAdminService } from '../../../packages/admin/src/index.js';
import {
  BrokerAccountLinkingService,
  BrokerAuthenticationService,
  BrokerStateService,
  OidcCallbackNormalizer,
  createEntraOidcAdapter,
  createGoogleOidcAdapter,
  type OidcAdapterRegistry,
} from '../../../packages/broker/src/index.js';
import {
  LocalAccountSessionService,
  SelfServiceProfileService,
  SessionAccessService,
} from '../../../packages/session/src/index.js';
import {
  FileAssignmentRepository,
  FileAuditRepository,
  FileBrokerStateRepository,
  FileClientRepository,
  FileProductRepository,
  FileProviderLinkRepository,
  FileRoleRepository,
  FileRoutePolicyRepository,
  JsonFileStore,
  createDefaultPubAuthState,
  type PubAuthState,
  FileRefreshTokenRepository,
  FileSessionRepository,
  FileSigningKeyRepository,
  FileUserRepository,
  FileWorkspaceRepository,
  assertBootstrapAccountPolicy,
  readPubAuthEnvironment,
} from '../../../packages/storage/src/index.js';

export interface ApiRouteContext {
  stateStore: JsonFileStore<PubAuthState>;
  jwtSigner: SigningKeyService;
  tokenIssuer: JwtTokenIssuer;
  userInfoService: JwtUserInfoService;
  authorizationService: DefaultAuthorizationService;
  sessionAuthenticator: SessionAuthenticator;
  sessionRepository: FileSessionRepository;
  loginService: LocalAccountSessionService;
  selfServiceProfileService: SelfServiceProfileService;
  sessionAccessService: SessionAccessService;
  adminAccessService: AdminAccessControlService;
  brokerAuthenticationService: BrokerAuthenticationService;
  adminService: FileAdminService;
  sessionCookieName: string;
}

export async function buildApiContext(issuer: string, dataDir = '.pubauth-data'): Promise<ApiRouteContext> {
  const stateStore = new JsonFileStore<PubAuthState>(resolve(dataDir, 'state.json'), createDefaultPubAuthState());
  const environment = readPubAuthEnvironment();
  assertBootstrapAccountPolicy(await stateStore.read(), environment);
  await ensureSeededClientRedirectUris(stateStore);
  const clientStore = new FileOidcClientRepository(stateStore);
  const authorizationCodeStore = new FileAuthorizationCodeStore(stateStore);
  const accessTokenStore = new FileAccessTokenStore(stateStore);
  const refreshTokenStore = new FileRefreshTokenRepository(stateStore);
  const sessionRepository = new FileSessionRepository(stateStore);
  const signingKeyRepository = new FileSigningKeyRepository(stateStore);
  const auditRepository = new FileAuditRepository(stateStore);
  const userRepository = new FileUserRepository(stateStore);
  const assignmentRepository = new FileAssignmentRepository(stateStore);
  const productRepository = new FileProductRepository(stateStore);
  const workspaceRepository = new FileWorkspaceRepository(stateStore);
  const routePolicyRepository = new FileRoutePolicyRepository(stateStore);
  const roleRepository = new FileRoleRepository(stateStore);
  const adminClientRepository = new FileClientRepository(stateStore);
  const providerLinkRepository = new FileProviderLinkRepository(stateStore);
  const brokerStateRepository = new FileBrokerStateRepository(stateStore);
  const jwtSigner = await createSigningKeyService(signingKeyRepository, issuer);
  const adminService = new FileAdminService({
    products: productRepository,
    workspaces: workspaceRepository,
    users: userRepository,
    clients: adminClientRepository,
    routePolicies: routePolicyRepository,
    roles: roleRepository,
    assignments: assignmentRepository,
    sessions: sessionRepository,
    signingKeys: signingKeyRepository,
    audit: auditRepository,
  });
  const brokerRegistry = buildBrokerRegistry();
  const sessionCookieName = 'pubauth_session';

  return {
    stateStore,
    jwtSigner,
    tokenIssuer: new JwtTokenIssuer(
      authorizationCodeStore,
      accessTokenStore,
      jwtSigner,
      (request) => resolveTokenClaims(stateStore, request),
      clientStore,
      refreshTokenStore,
    ),
    userInfoService: new JwtUserInfoService(accessTokenStore, jwtSigner, sessionRepository),
    authorizationService: new DefaultAuthorizationService(clientStore, authorizationCodeStore),
    sessionAuthenticator:
      environment === 'local'
        ? new CompositeSessionAuthenticator([
            new CookieSessionAuthenticator(sessionRepository, sessionCookieName),
            new DevSessionAuthenticator(),
          ])
        : new CookieSessionAuthenticator(sessionRepository, sessionCookieName),
    sessionRepository,
    loginService: new LocalAccountSessionService(
      userRepository,
      sessionRepository,
      auditRepository,
      environment,
    ),
    selfServiceProfileService: new SelfServiceProfileService(
      userRepository,
      sessionRepository,
      assignmentRepository,
      auditRepository,
    ),
    sessionAccessService: new SessionAccessService(userRepository, assignmentRepository),
    adminAccessService: new AdminAccessControlService({
      products: productRepository,
      workspaces: workspaceRepository,
      users: userRepository,
      clients: adminClientRepository,
      routePolicies: routePolicyRepository,
      roles: roleRepository,
      assignments: assignmentRepository,
    }),
    brokerAuthenticationService: new BrokerAuthenticationService(
      brokerRegistry,
      new BrokerStateService(brokerStateRepository),
      new BrokerAccountLinkingService(userRepository, providerLinkRepository),
      sessionRepository,
      auditRepository,
    ),
    adminService,
    sessionCookieName,
  };
}

export async function buildApiRoutes(issuer: string, dataDirOrContext?: string | ApiRouteContext): Promise<Route[]> {
  const context =
    typeof dataDirOrContext === 'string'
      ? await buildApiContext(issuer, dataDirOrContext)
      : dataDirOrContext ?? (await buildApiContext(issuer));

  const {
    jwtSigner,
    tokenIssuer,
    userInfoService,
    authorizationService,
    adminService,
    sessionAuthenticator,
    loginService,
    selfServiceProfileService,
    sessionAccessService,
    adminAccessService,
    brokerAuthenticationService,
    sessionCookieName,
  } = context;

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
      handler: async (request) => handleAuthorize(request, authorizationService, sessionAuthenticator),
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
      handler: async (request) => handleLogout(request, sessionAuthenticator, loginService, sessionCookieName),
    },
    {
      method: 'POST',
      path: '/auth/login',
      handler: async (request) => handleLogin(request, loginService, sessionCookieName),
    },
    {
      method: 'GET',
      path: '/auth/broker/**',
      handler: async (request) => handleBroker(request, brokerAuthenticationService, sessionCookieName),
    },
    {
      method: 'POST',
      path: '/oauth2/logout',
      handler: async (request) => handleLogout(request, sessionAuthenticator, loginService, sessionCookieName),
    },
    {
      method: 'POST',
      path: '/auth/logout',
      handler: async (request) => handleLogout(request, sessionAuthenticator, loginService, sessionCookieName),
    },
    {
      method: 'GET',
      path: '/auth/session',
      handler: async (request) => handleSession(request, sessionAuthenticator, selfServiceProfileService),
    },
    {
      method: 'GET',
      path: '/me/overview',
      handler: async (request) => handleSession(request, sessionAuthenticator, selfServiceProfileService),
    },
    {
      method: 'GET',
      path: '/admin/overview',
      handler: async (request) =>
        handleAdminOverview(request, sessionAuthenticator, adminAccessService, adminService),
    },
    {
      method: 'POST',
      path: '/admin/products',
      handler: async (request) => {
        const body = readBody(request);
        return handleAdminMutation(
          request,
          sessionAuthenticator,
          adminAccessService,
          async () => adminService.createProduct(parseProductCommand(body)),
          { type: 'create_product', workspaceId: requireBodyString(body, 'workspaceId') },
        );
      },
    },
    {
      method: 'POST',
      path: '/admin/workspaces',
      handler: async (request) =>
        handleAdminMutation(
          request,
          sessionAuthenticator,
          adminAccessService,
          async () => adminService.createWorkspace(parseWorkspaceCommand(readBody(request))),
          { type: 'create_workspace' },
        ),
    },
    {
      method: 'POST',
      path: '/admin/clients',
      handler: async (request) => {
        const body = readBody(request);
        return handleAdminMutation(
          request,
          sessionAuthenticator,
          adminAccessService,
          async () =>
            adminService.createClient({
              productId: requireBodyString(body, 'productId'),
              clientType: requireBodyString(body, 'clientType') as 'public' | 'confidential',
              redirectUris: requireBodyArray(body, 'redirectUris'),
              scopes: requireBodyArray(body, 'scopes'),
            }),
          { type: 'create_client', productId: requireBodyString(body, 'productId') },
        );
      },
    },
    {
      method: 'POST',
      path: '/admin/route-policies',
      handler: async (request) => {
        const body = readBody(request);
        return handleAdminMutation(
          request,
          sessionAuthenticator,
          adminAccessService,
          async () =>
            adminService.createRoutePolicy({
              productId: requireBodyString(body, 'productId'),
              upstreamUrl: requireBodyString(body, 'upstreamUrl'),
              pathPattern: requireBodyString(body, 'pathPattern'),
              methods: requireBodyArray(body, 'methods'),
              requiredRoles: requireBodyArray(body, 'requiredRoles'),
            }),
          { type: 'create_route_policy', productId: requireBodyString(body, 'productId') },
        );
      },
    },
    {
      method: 'POST',
      path: '/admin/roles',
      handler: async (request) => {
        const body = readBody(request);
        return handleAdminMutation(
          request,
          sessionAuthenticator,
          adminAccessService,
          async () => adminService.createRole(requireBodyString(body, 'name'), readOptionalBodyString(body, 'workspaceId')),
          { type: 'create_role', workspaceId: readOptionalBodyString(body, 'workspaceId') },
        );
      },
    },
    {
      method: 'POST',
      path: '/admin/assignments',
      handler: async (request) => {
        const body = readBody(request);
        return handleAdminMutation(
          request,
          sessionAuthenticator,
          adminAccessService,
          async () =>
            adminService.assignRole({
              userId: requireBodyString(body, 'userId'),
              role: requireBodyString(body, 'role'),
              workspaceId: readOptionalBodyString(body, 'workspaceId'),
              productId: readOptionalBodyString(body, 'productId'),
            }),
          {
            type: 'assign_role',
            workspaceId: readOptionalBodyString(body, 'workspaceId'),
            productId: readOptionalBodyString(body, 'productId'),
          },
        );
      },
    },
  ];
}

async function ensureSeededClientRedirectUris(stateStore: JsonFileStore<PubAuthState>): Promise<void> {
  await stateStore.update((current) => {
    const redirectUris = ['http://localhost:3000/callback', 'http://localhost:3001/auth/callback'];
    let changed = false;
    const clients = current.clients.map((client) => {
      if (client.clientId !== 'pubauth-client') {
        return client;
      }

      const allowedRedirectUris = [...new Set([...client.allowedRedirectUris, ...redirectUris])];
      changed = changed || allowedRedirectUris.length !== client.allowedRedirectUris.length;
      return {
        ...client,
        allowedRedirectUris,
      };
    });

    if (!changed) {
      return current;
    }

    return {
      ...current,
      clients,
    };
  });
}

async function handleAuthorize(
  request: HttpRequest,
  authorizationService: DefaultAuthorizationService,
  sessionAuthenticator: SessionAuthenticator,
) {
  try {
    const principal = await sessionAuthenticator.authenticate(request);
    if (!principal) {
      return { statusCode: 401, body: { error: 'login_required' } };
    }

    const response = await authorizationService.start({
      clientId: requireQuery(request, 'client_id'),
      redirectUri: requireQuery(request, 'redirect_uri'),
      responseType: requireResponseType(request),
      scope: requireQuery(request, 'scope'),
      state: request.query.state,
      codeChallenge: requireQuery(request, 'code_challenge'),
      codeChallengeMethod: requireCodeChallengeMethod(request),
      subjectId: principal.subjectId,
      workspaceId: principal.workspaceId,
      sessionId: principal.sessionId,
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

async function handleLogin(
  request: HttpRequest,
  loginService: LocalAccountSessionService,
  cookieName: string,
) {
  try {
    const body = readBody(request);
    const result = await loginService.login({
      username: requireBodyString(body, 'username'),
      password: requireBodyString(body, 'password'),
    });

    return {
      statusCode: 200,
      headers: {
        'set-cookie': `${cookieName}=${result.session.id}; Path=/; HttpOnly; SameSite=Lax`,
      },
      body: {
        ok: true,
        subjectId: result.user.subjectId,
        workspaceId: result.user.workspaceId,
        username: result.user.username,
      },
    };
  } catch (error) {
    return {
      statusCode: 401,
      body: { error: error instanceof Error ? error.message : 'invalid_credentials' },
    };
  }
}

async function handleBroker(
  request: HttpRequest,
  brokerAuthenticationService: BrokerAuthenticationService,
  cookieName: string,
) {
  try {
    const brokerPath = request.path.slice('/auth/broker/'.length);
    const [providerName, action] = brokerPath.split('/');
    const provider = providerName === 'google' || providerName === 'entra' ? providerName : null;
    if (!provider || (action !== 'start' && action !== 'callback')) {
      return { statusCode: 404, body: { error: 'not_found' } };
    }

    if (action === 'start') {
      const start = await brokerAuthenticationService.start(
        provider,
        request.query.redirect_uri ?? '/',
        request.query.workspace_id,
      );
      return {
        statusCode: 302,
        headers: {
          location: start.redirectUrl,
        },
        body: { redirect: start.redirectUrl },
      };
    }

    const result = await brokerAuthenticationService.complete(provider, request.query);
    const redirectTarget = result.redirectUri ?? '/';
    return {
      statusCode: 302,
      headers: {
        location: redirectTarget,
        'set-cookie': `${cookieName}=${result.session.id}; Path=/; HttpOnly; SameSite=Lax`,
      },
      body: {
        ok: true,
        redirect: redirectTarget,
        subjectId: result.user.subjectId,
      },
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: { error: error instanceof Error ? error.message : 'broker_login_failed' },
    };
  }
}

async function handleToken(request: HttpRequest, tokenIssuer: JwtTokenIssuer) {
  const body = readBody(request);

  try {
    const grantType = requireBodyString(body, 'grant_type');
    if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
      throw new Error('unsupported_grant_type');
    }

    const response = await tokenIssuer.issueToken({
      grantType,
      clientId: requireBodyString(body, 'client_id'),
      redirectUri: readOptionalBodyString(body, 'redirect_uri'),
      code: readOptionalBodyString(body, 'code'),
      codeVerifier: readOptionalBodyString(body, 'code_verifier'),
      refreshToken: readOptionalBodyString(body, 'refresh_token'),
      clientSecret: readClientSecret(request, body),
      clientAuthMethod: readClientAuthMethod(request, body),
    });

    return { statusCode: 200, body: response };
  } catch (error) {
    return { statusCode: 400, body: { error: error instanceof Error ? error.message : 'invalid_request' } };
  }
}

async function handleLogout(
  request: HttpRequest,
  sessionAuthenticator: SessionAuthenticator,
  loginService: LocalAccountSessionService,
  cookieName: string,
) {
  try {
    const principal = await sessionAuthenticator.authenticate(request);
    if (principal?.sessionId) {
      await loginService.logout(principal.sessionId);
    }

    return {
      statusCode: 200,
      headers: {
        'set-cookie': `${cookieName}=deleted; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      },
      body: {
        ok: true,
      },
    };
  } catch (error) {
    return { statusCode: 400, body: { error: error instanceof Error ? error.message : 'invalid_request' } };
  }
}

async function handleSession(
  request: HttpRequest,
  sessionAuthenticator: SessionAuthenticator,
  selfServiceProfileService: SelfServiceProfileService,
) {
  try {
    const principal = await sessionAuthenticator.authenticate(request);
    if (!principal) {
      return { statusCode: 401, body: { error: 'login_required' } };
    }

    const overview = await selfServiceProfileService.getOverview(principal.subjectId, principal.workspaceId);
    return { statusCode: 200, body: overview };
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

async function handleAdminOverview(
  request: HttpRequest,
  sessionAuthenticator: SessionAuthenticator,
  adminAccessService: AdminAccessControlService,
  adminService: FileAdminService,
) {
  const access = await requireAdminAccess(request, sessionAuthenticator);
  if ('statusCode' in access) {
    return access;
  }

  const decision = await adminAccessService.canReadOverview(access);
  if (!decision.allowed) {
    return mapAdminAccessDecision(decision);
  }

  const overview = await adminService.getOverview();
  return { statusCode: 200, body: await adminAccessService.filterOverview(access, overview) };
}

async function handleAdminMutation(
  request: HttpRequest,
  sessionAuthenticator: SessionAuthenticator,
  adminAccessService: AdminAccessControlService,
  operation: (principal: { subjectId: string; workspaceId: string }) => Promise<{ ok: boolean; id?: string; message: string; clientSecret?: string }>,
  target:
    | { type: 'create_workspace' }
    | { type: 'create_product'; workspaceId: string }
    | { type: 'create_client'; productId: string }
    | { type: 'create_route_policy'; productId: string }
    | { type: 'create_role'; workspaceId?: string }
    | { type: 'assign_role'; workspaceId?: string; productId?: string },
) {
  const access = await requireAdminAccess(request, sessionAuthenticator);
  if ('statusCode' in access) {
    return access;
  }

  const decision = await authorizeAdminMutation(adminAccessService, access, target);
  if (!decision.allowed) {
    return mapAdminAccessDecision(decision);
  }

  return handleAdminResponse(await operation(access));
}

async function requireAdminAccess(
  request: HttpRequest,
  sessionAuthenticator: SessionAuthenticator,
): Promise<{ subjectId: string; workspaceId: string } | { statusCode: 401 | 403; body: { error: string } }> {
  const principal = await sessionAuthenticator.authenticate(request);
  if (!principal) {
    return { statusCode: 401, body: { error: 'login_required' } };
  }

  return principal;
}

async function authorizeAdminMutation(
  adminAccessService: AdminAccessControlService,
  principal: { subjectId: string; workspaceId: string },
  target:
    | { type: 'create_workspace' }
    | { type: 'create_product'; workspaceId: string }
    | { type: 'create_client'; productId: string }
    | { type: 'create_route_policy'; productId: string }
    | { type: 'create_role'; workspaceId?: string }
    | { type: 'assign_role'; workspaceId?: string; productId?: string },
) {
  switch (target.type) {
    case 'create_workspace':
      return adminAccessService.canCreateWorkspace(principal);
    case 'create_product':
      return adminAccessService.canCreateProduct(principal, target.workspaceId);
    case 'create_client':
      return adminAccessService.canCreateClient(principal, target.productId);
    case 'create_route_policy':
      return adminAccessService.canCreateRoutePolicy(principal, target.productId);
    case 'create_role':
      return adminAccessService.canCreateRole(principal, target.workspaceId ?? principal.workspaceId);
    case 'assign_role':
      return adminAccessService.canAssignRole(principal, target.workspaceId ?? principal.workspaceId, target.productId);
  }
}

function mapAdminAccessDecision(decision: { allowed: boolean; reason?: string }) {
  return {
    statusCode: decision.reason === 'not_found' ? 404 : decision.reason === 'invalid_scope' ? 400 : 403,
    body: { error: decision.reason ?? 'forbidden' },
  };
}

function requireQuery(request: HttpRequest, name: string): string {
  const value = request.query[name];
  if (!value) {
    throw new Error(`missing_${name}`);
  }
  return value;
}

function requireCodeChallengeMethod(request: HttpRequest): 'S256' {
  const value = requireQuery(request, 'code_challenge_method');
  if (value !== 'S256') {
    throw new Error('invalid_code_challenge_method');
  }
  return 'S256';
}

function requireResponseType(request: HttpRequest): 'code' {
  const value = requireQuery(request, 'response_type');
  if (value !== 'code') {
    throw new Error('unsupported_response_type');
  }
  return 'code';
}

function readBody(request: HttpRequest): Record<string, unknown> {
  return typeof request.body === 'object' && request.body !== null ? (request.body as Record<string, unknown>) : {};
}

function parseProductCommand(body: Record<string, unknown>): { workspaceId: string; name: string; slug: string; environment: 'local' | 'dev' | 'qa' | 'prod' } {
  const environment = requireBodyString(body, 'environment');
  if (environment !== 'local' && environment !== 'dev' && environment !== 'qa' && environment !== 'prod') {
    throw new Error('invalid_environment');
  }

  return {
    workspaceId: requireBodyString(body, 'workspaceId'),
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

function readClientAuthMethod(request: HttpRequest, body: Record<string, unknown>): 'client_secret_basic' | 'client_secret_post' | undefined {
  const authorization = request.headers.authorization ?? request.headers.Authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Basic ')) {
    const credentials = readBasicAuthCredentials(authorization);
    if (!credentials || credentials.username !== readOptionalBodyString(body, 'client_id')) {
      throw new Error('invalid_client');
    }
    return 'client_secret_basic';
  }

  return typeof body.client_secret === 'string' ? 'client_secret_post' : undefined;
}

function readClientSecret(request: HttpRequest, body: Record<string, unknown>): string | undefined {
  const postSecret = readOptionalBodyString(body, 'client_secret');
  if (postSecret) {
    return postSecret;
  }

  const authorization = request.headers.authorization ?? request.headers.Authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Basic ')) {
    return undefined;
  }

  return readBasicAuthCredentials(authorization)?.password;
}

function readBasicAuthCredentials(authorizationHeader: string): { username: string; password: string } | null {
  const decoded = Buffer.from(authorizationHeader.slice('Basic '.length), 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function buildBrokerRegistry(fetchImpl: typeof fetch = fetch): OidcAdapterRegistry {
  const registry: OidcAdapterRegistry = {};

  if (
    process.env.PUBAUTH_GOOGLE_OIDC_ISSUER &&
    process.env.PUBAUTH_GOOGLE_CLIENT_ID &&
    process.env.PUBAUTH_GOOGLE_CLIENT_SECRET &&
    process.env.PUBAUTH_GOOGLE_REDIRECT_URI
  ) {
    registry.google = createGoogleOidcAdapter(
      {
        issuer: process.env.PUBAUTH_GOOGLE_OIDC_ISSUER,
        clientId: process.env.PUBAUTH_GOOGLE_CLIENT_ID,
        clientSecret: process.env.PUBAUTH_GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.PUBAUTH_GOOGLE_REDIRECT_URI,
      },
      new OidcCallbackNormalizer('google'),
      fetchImpl,
    );
  }

  if (
    process.env.PUBAUTH_ENTRA_OIDC_ISSUER &&
    process.env.PUBAUTH_ENTRA_CLIENT_ID &&
    process.env.PUBAUTH_ENTRA_CLIENT_SECRET &&
    process.env.PUBAUTH_ENTRA_REDIRECT_URI
  ) {
    registry.entra = createEntraOidcAdapter(
      {
        issuer: process.env.PUBAUTH_ENTRA_OIDC_ISSUER,
        clientId: process.env.PUBAUTH_ENTRA_CLIENT_ID,
        clientSecret: process.env.PUBAUTH_ENTRA_CLIENT_SECRET,
        redirectUri: process.env.PUBAUTH_ENTRA_REDIRECT_URI,
      },
      new OidcCallbackNormalizer('entra'),
      fetchImpl,
    );
  }

  return registry;
}
