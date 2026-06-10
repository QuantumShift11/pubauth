import { readFile } from 'node:fs/promises';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig } from '../../../packages/config/src/index.js';
import { startNodeServer, type HttpRequest, type Route } from '../../../packages/http/src/index.js';
import type { BootstrapPayload } from './bootstrap-types.js';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../client');

interface HealthPayload {
  status: string;
  service: string;
}

type DiscoveryPayload = BootstrapPayload['discovery'];

type JwksPayload = BootstrapPayload['jwks'];

type AdminOverviewPayload = BootstrapPayload['admin'];

export async function startWebService(): Promise<void> {
  const config = loadConfig('web');

  startNodeServer({
    port: config.port,
    routes: buildWebRoutes(config.apiBase, clientRoot, fetch, config.publicIssuer),
  });
}

export function buildWebRoutes(
  apiBase: string,
  clientRootDir: string,
  fetchImpl: typeof fetch = fetch,
  publicIssuer = apiBase,
): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/bootstrap',
      handler: async (request) => ({
        statusCode: 200,
        body: await buildBootstrap(apiBase, fetchImpl, request),
      }),
    },
    {
      method: 'GET',
      path: '/api/admin/overview',
      handler: async (request) => proxyJson(apiBase, '/admin/overview', request, fetchImpl),
    },
    {
      method: 'POST',
      path: '/api/admin/products',
      handler: async (request) => proxyJson(apiBase, '/admin/products', request, fetchImpl),
    },
    {
      method: 'POST',
      path: '/api/admin/workspaces',
      handler: async (request) => proxyJson(apiBase, '/admin/workspaces', request, fetchImpl),
    },
    {
      method: 'POST',
      path: '/api/admin/clients',
      handler: async (request) => proxyJson(apiBase, '/admin/clients', request, fetchImpl),
    },
    {
      method: 'POST',
      path: '/api/admin/route-policies',
      handler: async (request) => proxyJson(apiBase, '/admin/route-policies', request, fetchImpl),
    },
    {
      method: 'POST',
      path: '/api/admin/roles',
      handler: async (request) => proxyJson(apiBase, '/admin/roles', request, fetchImpl),
    },
    {
      method: 'POST',
      path: '/api/admin/assignments',
      handler: async (request) => proxyJson(apiBase, '/admin/assignments', request, fetchImpl),
    },
    {
      method: 'POST',
      path: '/api/auth/token',
      handler: async (request) => proxyJson(apiBase, '/oauth2/token', request, fetchImpl),
    },
    {
      method: 'POST',
      path: '/api/auth/login',
      handler: async (request) => proxyJson(apiBase, '/auth/login', request, fetchImpl),
    },
    {
      method: 'POST',
      path: '/api/auth/logout',
      handler: async (request) => proxyJson(apiBase, '/auth/logout', request, fetchImpl),
    },
    {
      method: 'GET',
      path: '/api/auth/session',
      handler: async (request) => proxyJson(apiBase, '/auth/session', request, fetchImpl),
    },
    {
      method: 'GET',
      path: '/api/auth/authorize',
      handler: async (request) => proxyRedirect(publicIssuer, '/oauth2/authorize', request),
    },
    {
      method: 'GET',
      path: '/api/auth/broker/**',
      handler: async (request) => proxyDynamicRedirect(publicIssuer, request.path.replace('/api', ''), request),
    },
    {
      method: 'GET',
      path: '/api/auth/userinfo',
      handler: async (request) => proxyJson(apiBase, '/oauth2/userinfo', request, fetchImpl),
    },
    {
      method: 'GET',
      path: '/api/me/overview',
      handler: async (request) => proxyJson(apiBase, '/me/overview', request, fetchImpl),
    },
    {
      method: 'GET',
      path: '/assets/**',
      handler: async (request) => serveAsset(clientRootDir, request.path),
    },
    {
      method: 'GET',
      path: '/**',
      handler: async (request) => {
        if (request.path.startsWith('/api/')) {
          return { statusCode: 404, body: { error: 'not_found' } };
        }
        return serveIndex(clientRootDir);
      },
    },
  ];
}

async function buildBootstrap(apiBase: string, fetchImpl: typeof fetch, request: HttpRequest) {
  const [healthResponse, discoveryResponse, jwksResponse, adminResponse] = await Promise.all([
    fetchJson<HealthPayload>(`${apiBase}/health`, fetchImpl),
    fetchJson<DiscoveryPayload>(`${apiBase}/.well-known/openid-configuration`, fetchImpl),
    fetchJson<JwksPayload>(`${apiBase}/oauth2/jwks`, fetchImpl),
    fetchJson<AdminOverviewPayload>(`${apiBase}/admin/overview`, fetchImpl, toForwardHeaders(request.headers)),
  ]);

  const admin =
    adminResponse.status === 401 || adminResponse.status === 403
      ? emptyAdminOverview()
      : adminResponse.body;

  return {
    api: {
      status: healthResponse.body.status,
      service: healthResponse.body.service,
    },
    discovery: discoveryResponse.body,
    jwks: jwksResponse.body,
    admin,
    runtime: {
      issuer: discoveryResponse.body.issuer,
      apiBase,
    },
  };
}

async function proxyJson(apiBase: string, path: string, request: HttpRequest, fetchImpl: typeof fetch) {
  const method = String(request.method);
  const canSendBody = method !== 'GET' && method !== 'HEAD';
  const response = await fetchImpl(`${apiBase}${path}`, {
    method,
    headers: {
      ...toForwardHeaders(request.headers),
      'content-type': 'application/json',
    },
    body: canSendBody ? JSON.stringify(request.body ?? {}) : undefined,
  });

  return {
    statusCode: response.status,
    headers: readForwardResponseHeaders(response),
    body: await readResponseBody(response),
  };
}

async function proxyRedirect(publicIssuer: string, path: string, request: HttpRequest) {
  const url = new URL(`${publicIssuer}${path}`);
  for (const [key, value] of Object.entries(request.query)) {
    if (typeof value === 'string') {
      url.searchParams.set(key, value);
    }
  }

  return {
    statusCode: 302,
    headers: {
      location: url.toString(),
    },
    body: {
      redirect: url.toString(),
    },
  };
}

async function proxyDynamicRedirect(publicIssuer: string, path: string, request: HttpRequest) {
  const url = new URL(`${publicIssuer}${path}`);
  for (const [key, value] of Object.entries(request.query)) {
    if (typeof value === 'string') {
      url.searchParams.set(key, value);
    }
  }

  return {
    statusCode: 302,
    headers: {
      location: url.toString(),
    },
    body: {
      redirect: url.toString(),
    },
  };
}

function toForwardHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  const forwarded: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string' && value.length > 0) {
      forwarded[key] = value;
    }
  }
  return forwarded;
}

async function serveIndex(clientRootDir: string) {
  const html = await readText(resolve(clientRootDir, 'index.html'));
  return {
    statusCode: 200,
    contentType: 'text/html; charset=utf-8',
    body: html,
  };
}

async function serveAsset(clientRootDir: string, path: string) {
  const assetPath = resolve(clientRootDir, `.${path}`);
  if (!assetPath.startsWith(clientRootDir)) {
    return { statusCode: 403, body: { error: 'forbidden' } };
  }

  try {
    const content = await readText(assetPath);
    return {
      statusCode: 200,
      contentType: contentTypeFor(assetPath),
      body: content,
    };
  } catch {
    return { statusCode: 404, body: { error: 'not_found' } };
  }
}

async function fetchJson<T>(
  url: string,
  fetchImpl: typeof fetch,
  headers?: Record<string, string>,
): Promise<{ status: number; body: T }> {
  const response = await fetchImpl(url, headers ? { headers } : undefined);
  return {
    status: response.status,
    body: (await response.json()) as T,
  };
}

function emptyAdminOverview(): AdminOverviewPayload {
  return {
    products: [],
    workspaces: [],
    users: [],
    clients: [],
    routePolicies: [],
    roles: [],
    assignments: [],
    sessions: [],
    signingKeys: [],
    auditEvents: [],
    counts: {
      products: 0,
      workspaces: 0,
      users: 0,
      clients: 0,
      routePolicies: 0,
      roles: 0,
      assignments: 0,
      sessions: 0,
      signingKeys: 0,
      auditEvents: 0,
    },
  };
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function readForwardResponseHeaders(response: Response): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  const contentType = response.headers.get('content-type');
  const setCookie = response.headers.get('set-cookie');

  if (contentType) {
    headers['content-type'] = contentType;
  }

  if (setCookie) {
    headers['set-cookie'] = setCookie;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

async function readText(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

function contentTypeFor(path: string): string {
  switch (extname(path)) {
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.html':
      return 'text/html; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startWebService().catch((error) => {
    console.error('Web service failed to start', error);
    process.exitCode = 1;
  });
}
