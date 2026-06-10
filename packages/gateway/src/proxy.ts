import { evaluatePolicy, type PolicyRule } from '../../rbac/src/index.js';
import {
  buildForwardHeaders,
  removePubAuthHeaders,
  type GatewayPrincipal,
} from './headers.js';
import { resolveGatewayRoute, type GatewayRouteRule } from './policy.js';

export interface GatewayRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface GatewayCredentialVerifier {
  verifyBearer(token: string): Promise<GatewayPrincipal | null>;
  verifySession(sessionId: string): Promise<GatewayPrincipal | null>;
}

export interface TrustedProxyRequest {
  upstreamUrl: string;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface GatewayProxyDecision {
  allowed: boolean;
  reason: string;
  upstream?: TrustedProxyRequest;
}

export async function authorizeGatewayRequest(
  request: GatewayRequest,
  rules: GatewayRouteRule[],
  policyRules: PolicyRule[],
  verifier: GatewayCredentialVerifier,
): Promise<GatewayProxyDecision> {
  const route = resolveGatewayRoute(request.path, request.method, rules);
  if (!route.matched || !route.upstreamUrl) {
    return { allowed: false, reason: 'deny_by_default' };
  }

  const credential = readGatewayCredential(request.headers);
  if (!credential) {
    return { allowed: false, reason: 'missing_credential' };
  }

  const principal =
    credential.kind === 'bearer'
      ? await verifier.verifyBearer(credential.token)
      : await verifier.verifySession(credential.token);

  if (!principal) {
    return { allowed: false, reason: 'invalid_credential' };
  }

  const policy = evaluatePolicy(
    principal,
    { productId: route.upstreamUrl, path: request.path, method: request.method },
    policyRules,
  );

  if (!policy.allowed) {
    return { allowed: false, reason: policy.reason };
  }

  return {
    allowed: true,
    reason: 'allowed',
    upstream: buildTrustedProxyRequest(route.upstreamUrl, request, principal),
  };
}

export function buildTrustedProxyRequest(
  upstreamUrl: string,
  request: GatewayRequest,
  principal: GatewayPrincipal,
): TrustedProxyRequest {
  const headers = {
    ...removePubAuthHeaders(request.headers),
    ...buildForwardHeaders(principal),
  };

  return {
    upstreamUrl,
    method: request.method,
    path: request.path,
    headers,
    body: request.body,
  };
}

function readGatewayCredential(
  headers: Record<string, string | string[] | undefined>,
): { kind: 'bearer' | 'session'; token: string } | null {
  const authorization = headers.authorization ?? headers.Authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return { kind: 'bearer', token: authorization.slice('Bearer '.length) };
  }

  const sessionId = headers['x-pubauth-session-id'];
  if (typeof sessionId === 'string' && sessionId.length > 0) {
    return { kind: 'session', token: sessionId };
  }

  return null;
}
