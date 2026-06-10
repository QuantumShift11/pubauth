import { readFile } from 'node:fs/promises';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig } from '../../../packages/config/src/index.js';
import { startNodeServer, type HttpRequest, type Route } from '../../../packages/http/src/index.js';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../client');

interface HealthPayload {
  status: string;
  service: string;
}

interface DiscoveryPayload {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint: string;
}

interface JwksPayload {
  keys: Array<{
    kid: string;
    alg: string;
    use: string;
    kty: string;
  }>;
}

interface AdminOverviewPayload {
  products: Array<{ id: string; name: string; slug: string; environment: string; status: string }>;
  workspaces: Array<{ id: string; name: string; slug: string; state: string }>;
  clients: Array<{ id: string; clientId: string; productId: string; clientType: string; isActive: boolean }>;
  routePolicies: Array<{ id: string; productId: string; pathPattern: string; methods: string[]; requiredRoles: string[] }>;
  roles: Array<{ id: string; name: string }>;
  assignments: Array<{ id: string; userId: string; role: string }>;
  counts: Record<string, number>;
}

export async function startWebService(): Promise<void> {
  const config = loadConfig('web');

  startNodeServer({
    port: config.port,
    routes: buildWebRoutes(config.apiBase, clientRoot),
  });
}

export function buildWebRoutes(
  apiBase: string,
  clientRootDir: string,
  fetchImpl: typeof fetch = fetch,
): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/bootstrap',
      handler: async () => ({
        statusCode: 200,
        body: await buildBootstrap(apiBase, fetchImpl),
      }),
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

async function buildBootstrap(apiBase: string, fetchImpl: typeof fetch) {
  const [healthResponse, discoveryResponse, jwksResponse, adminResponse] = await Promise.all([
    fetchJson<HealthPayload>(`${apiBase}/health`, fetchImpl),
    fetchJson<DiscoveryPayload>(`${apiBase}/.well-known/openid-configuration`, fetchImpl),
    fetchJson<JwksPayload>(`${apiBase}/oauth2/jwks`, fetchImpl),
    fetchJson<AdminOverviewPayload>(`${apiBase}/admin/overview`, fetchImpl),
  ]);

  return {
    api: {
      status: healthResponse.body.status,
      service: healthResponse.body.service,
    },
    discovery: discoveryResponse.body,
    jwks: jwksResponse.body,
    admin: adminResponse.body,
    runtime: {
      issuer: discoveryResponse.body.issuer,
      apiBase,
    },
  };
}

async function proxyJson(apiBase: string, path: string, request: HttpRequest, fetchImpl: typeof fetch) {
  const response = await fetchImpl(`${apiBase}${path}`, {
    method: request.method,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(request.body ?? {}),
  });

  return {
    statusCode: response.status,
    body: await readResponseBody(response),
  };
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

async function fetchJson<T>(url: string, fetchImpl: typeof fetch): Promise<{ status: number; body: T }> {
  const response = await fetchImpl(url);
  return {
    status: response.status,
    body: (await response.json()) as T,
  };
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
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
