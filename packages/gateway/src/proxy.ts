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
  query?: Record<string, string>;
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
  query?: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface ForwardedProxyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  contentType?: string;
  body: string;
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
  if (!route.matched || !route.upstreamUrl || !route.appId) {
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
    { productId: route.appId, path: request.path, method: request.method },
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

export async function forwardGatewayRequest(
  request: TrustedProxyRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ForwardedProxyResponse> {
  const target = new URL(request.path, request.upstreamUrl);
  for (const [name, value] of Object.entries(request.query ?? {})) {
    target.searchParams.set(name, value);
  }

  const response = await fetchImpl(target, {
    method: request.method,
    headers: toFetchHeaders(request.headers),
    body: serializeBody(request.body, request.headers),
  });

  const body = await response.text();
  const headers: Record<string, string> = {};
  const contentType = response.headers.get('content-type') ?? undefined;
  if (contentType) {
    headers['content-type'] = contentType;
  }

  return {
    statusCode: response.status,
    headers,
    contentType,
    body,
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
    query: request.query,
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

function serializeBody(body: unknown, headers: Record<string, string | string[] | undefined>): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (typeof body === 'string' || body instanceof Uint8Array || body instanceof ArrayBuffer) {
    return body as BodyInit;
  }

  const contentType = readHeader(headers, 'content-type');
  if (contentType?.includes('application/x-www-form-urlencoded') && isRecord(body)) {
    return new URLSearchParams(Object.entries(body).map(([key, value]) => [key, String(value)]));
  }

  return JSON.stringify(body);
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return typeof value === 'string' ? value : undefined;
}

function toFetchHeaders(headers: Record<string, string | string[] | undefined>): HeadersInit {
  const normalized: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      normalized[name] = value;
    } else if (Array.isArray(value)) {
      normalized[name] = value.join(', ');
    }
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
