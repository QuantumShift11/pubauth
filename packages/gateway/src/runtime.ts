import { resolve } from 'node:path';
import type { Route, HttpRequest, HttpResponse } from '../../http/src/index.js';
import {
  assertBootstrapAccountPolicy,
  JsonFileStore,
  createDefaultPubAuthState,
  type PubAuthState,
  type StoredRoutePolicy,
  FileSigningKeyRepository,
  readPubAuthEnvironment,
} from '../../storage/src/index.js';
import { createSigningKeyService, type SigningKeyService } from '../../oidc/src/index.js';
import type { GatewayRouteRule } from './policy.js';
import { authorizeGatewayRequest, forwardGatewayRequest, type GatewayCredentialVerifier } from './proxy.js';
import type { GatewayPrincipal } from './headers.js';

export interface GatewayRuntimeOptions {
  issuer: string;
  dataDir: string;
  fetchImpl?: typeof fetch;
}

export async function buildGatewayProxyRoutes(options: GatewayRuntimeOptions): Promise<Route[]> {
  const store = new JsonFileStore<PubAuthState>(resolve(options.dataDir, 'state.json'), createDefaultPubAuthState());
  assertBootstrapAccountPolicy(await store.read(), readPubAuthEnvironment());
  const signer = await createSigningKeyService(new FileSigningKeyRepository(store), options.issuer);
  const fetchImpl = options.fetchImpl ?? fetch;

  return [
    {
      method: 'GET',
      path: '/health',
      handler: () => ({ statusCode: 200, body: { status: 'ok', service: 'gateway' } }),
    },
    {
      method: 'GET',
      path: '/**',
      handler: async (request) => handleGatewayRequest(request, store, signer, fetchImpl),
    },
    {
      method: 'POST',
      path: '/**',
      handler: async (request) => handleGatewayRequest(request, store, signer, fetchImpl),
    },
    {
      method: 'PUT',
      path: '/**',
      handler: async (request) => handleGatewayRequest(request, store, signer, fetchImpl),
    },
    {
      method: 'PATCH',
      path: '/**',
      handler: async (request) => handleGatewayRequest(request, store, signer, fetchImpl),
    },
    {
      method: 'DELETE',
      path: '/**',
      handler: async (request) => handleGatewayRequest(request, store, signer, fetchImpl),
    },
  ];
}

async function handleGatewayRequest(
  request: HttpRequest,
  store: JsonFileStore<PubAuthState>,
  signer: SigningKeyService,
  fetchImpl: typeof fetch,
): Promise<HttpResponse> {
  if (request.path.startsWith('/_pubauth/')) {
    return { statusCode: 404, body: { error: 'not_found' } };
  }

  const state = await store.read();
  const routeRules = buildRouteRules(state.routePolicies);
  const verifier = createCredentialVerifier(store, signer);

  const decision = await authorizeGatewayRequest(
    {
      method: request.method,
      path: request.path,
      query: request.query,
      headers: request.headers,
      body: request.body,
    },
    routeRules,
    routeRules.map((rule) => ({
      pathPattern: rule.pathPattern,
      methods: rule.methods,
      requiredRoles: rule.requiredRoles,
    })),
    verifier,
  );

  if (!decision.allowed || !decision.upstream) {
    return {
      statusCode: 403,
      body: { error: decision.reason },
    };
  }

  const response = await forwardGatewayRequest(decision.upstream, fetchImpl);
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    contentType: response.contentType,
    body: response.body,
  };
}

function buildRouteRules(routePolicies: StoredRoutePolicy[]): GatewayRouteRule[] {
  return routePolicies
    .filter((policy) => policy.state === 'active')
    .sort((left, right) => right.priority - left.priority)
    .map((policy) => ({
      id: policy.id,
      appId: policy.productId,
      upstreamUrl: policy.upstreamUrl,
      pathPattern: policy.pathPattern,
      methods: policy.methods,
      requiredRoles: policy.requiredRoles,
    }));
}

function createCredentialVerifier(
  store: JsonFileStore<PubAuthState>,
  signer: SigningKeyService,
): GatewayCredentialVerifier {
  return {
    async verifyBearer(token: string): Promise<GatewayPrincipal | null> {
      try {
        const verified = signer.verify(token, { issuer: signer.issuer, tokenUse: 'access_token' });
        const clientId = readStringClaim(verified.payload.client_id);
        const audience = Array.isArray(verified.payload.aud) ? verified.payload.aud : [verified.payload.aud];
        if (!clientId || !audience.includes(clientId)) {
          return null;
        }

        const subjectId = readStringClaim(verified.payload.sub);
        const workspaceId = readStringClaim(verified.payload.workspace_id);
        if (!subjectId || !workspaceId) {
          return null;
        }

        const state = await store.read();
        return {
          userId: subjectId,
          workspaceId,
          roles: readClaimList(verified.payload.roles) ?? resolveRoles(state, subjectId, workspaceId),
          groups: readClaimList(verified.payload.groups) ?? [],
        };
      } catch {
        return null;
      }
    },
    async verifySession(sessionId: string): Promise<GatewayPrincipal | null> {
      const state = await store.read();
      const session = state.sessions.find((item) => item.id === sessionId) ?? null;
      if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
        return null;
      }

      return {
        userId: session.subjectId,
        workspaceId: session.workspaceId,
        roles: resolveRoles(state, session.subjectId, session.workspaceId),
        groups: [],
      };
    },
  };
}

function resolveRoles(state: PubAuthState, subjectId: string, workspaceId: string): string[] {
  return [...new Set(
    state.assignments
      .filter((assignment) => assignment.userId === subjectId && (!assignment.workspaceId || assignment.workspaceId === workspaceId))
      .map((assignment) => assignment.role)
      .filter(Boolean),
  )];
}

function readStringClaim(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readClaimList(value: unknown): string[] | null {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return [...new Set(value)];
  }

  if (typeof value === 'string' && value.length > 0) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return null;
}
