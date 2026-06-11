import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStore, createDefaultPubAuthState } from '../dist/packages/storage/src/index.js';
import { RsaJwtSigner } from '../dist/packages/crypto/src/index.js';
import { findRoute } from '../dist/packages/http/src/index.js';
import { buildGatewayRoutes } from '../dist/apps/gateway/src/routes.js';

test('gateway runtime proxies trusted requests and denies unknown routes', async () => {
  const previousSessionMode = process.env.PUBAUTH_GATEWAY_SESSION_MODE;
  process.env.PUBAUTH_GATEWAY_SESSION_MODE = 'enabled';
  const upstream = await startUpstreamServer();
  const issuer = 'https://issuer.example';
  const dataDir = mkdtempSync(join(tmpdir(), 'pubauth-gateway-'));
  const now = new Date().toISOString();
  const stateStore = new JsonFileStore(join(dataDir, 'state.json'), createDefaultPubAuthState());
  const generated = RsaJwtSigner.generateWithMaterial(issuer, 'gateway-key-1');
  try {
    await stateStore.replace({
      ...createDefaultPubAuthState(),
      products: [
        {
          id: 'product-1',
          name: 'Atlas',
          slug: 'atlas',
          environment: 'local',
          status: 'active',
          createdAt: now,
        },
      ],
      workspaces: [
        {
          id: 'workspace-1',
          name: 'Core',
          slug: 'core',
          state: 'active',
          createdAt: now,
        },
      ],
      clients: [],
      routePolicies: [
        {
          id: 'policy-1',
          productId: 'product-1',
          upstreamUrl: upstream.url,
          pathPattern: '/reports/**',
          methods: ['GET'],
          requiredRoles: ['viewer'],
          priority: 100,
          state: 'active',
          createdAt: now,
        },
      ],
      roles: [
        {
          id: 'role-viewer',
          name: 'viewer',
          createdAt: now,
        },
      ],
      assignments: [
        {
          id: 'assignment-1',
          userId: 'user-1',
          role: 'viewer',
          workspaceId: 'workspace-1',
          createdAt: now,
        },
        {
          id: 'assignment-2',
          userId: 'user-2',
          role: 'viewer',
          workspaceId: 'workspace-1',
          createdAt: now,
        },
      ],
      authorizationCodes: [],
      accessTokens: [],
      sessions: [
        {
          id: 'session-1',
          subjectId: 'user-2',
          workspaceId: 'workspace-1',
          createdAt: now,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      ],
      signingKeys: [
        {
          keyId: generated.signer.keyId,
          algorithm: 'RS256',
          publicKeyPem: generated.publicKeyPem,
          privateKeyPem: generated.privateKeyPem,
          status: 'active',
          createdAt: now,
        },
      ],
    });

    const routes = await buildGatewayRoutes(issuer, dataDir);
    const proxyRoute = findRoute(routes, 'GET', '/reports/summary');
    assert.ok(proxyRoute);

    const bearerToken = generated.signer.sign({
      audience: 'client-1',
      subject: 'user-1',
      expiresInSeconds: 3600,
      claims: {
        token_use: 'access_token',
        client_id: 'client-1',
        workspace_id: 'workspace-1',
        jti: 'access-token-1',
        roles: ['viewer'],
        groups: ['platform'],
      },
    });
    await stateStore.update((state) => ({
      ...state,
      accessTokens: [
        {
          accessToken: bearerToken,
          jti: 'access-token-1',
          subjectId: 'user-1',
          clientId: 'client-1',
          workspaceId: 'workspace-1',
          scopes: ['openid'],
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      ],
    }));

    const bearerResponse = await proxyRoute.handler({
      method: 'GET',
      path: '/reports/summary',
      query: { page: '1' },
      headers: {
        authorization: `Bearer ${bearerToken}`,
        'x-pubauth-user-id': 'spoofed',
        'x-pubauth-workspace-id': 'spoofed',
      },
    });

    assert.equal(bearerResponse.statusCode, 200);
    assert.equal(bearerResponse.headers?.['content-type'], 'application/json');
    const bearerPayload = JSON.parse(String(bearerResponse.body));
    assert.equal(bearerPayload.method, 'GET');
    assert.equal(bearerPayload.path, '/reports/summary?page=1');
    assert.equal(bearerPayload.headers['x-pubauth-user-id'], 'user-1');
    assert.equal(bearerPayload.headers['x-pubauth-workspace-id'], 'workspace-1');
    assert.equal(bearerPayload.headers['x-pubauth-roles'], 'viewer');
    assert.equal(bearerPayload.headers['x-pubauth-user-id'] === 'spoofed', false);

    const sessionResponse = await proxyRoute.handler({
      method: 'GET',
      path: '/reports/summary',
      query: {},
      headers: {
        cookie: 'pubauth_session=session-1',
        'x-pubauth-user-id': 'spoofed',
      },
    });

    assert.equal(sessionResponse.statusCode, 200);
    const sessionPayload = JSON.parse(String(sessionResponse.body));
    assert.equal(sessionPayload.headers['x-pubauth-user-id'], 'user-2');
    assert.equal(sessionPayload.headers['x-pubauth-user-id'] === 'spoofed', false);

    const spoofedSessionHeader = await proxyRoute.handler({
      method: 'GET',
      path: '/reports/summary',
      query: {},
      headers: {
        'x-pubauth-session-id': 'session-1',
        'x-pubauth-user-id': 'spoofed',
        'x-pubauth-roles': 'admin',
      },
    });
    assert.equal(spoofedSessionHeader.statusCode, 403);
    assert.equal(spoofedSessionHeader.body.error, 'missing_credential');

    const deniedRoute = findRoute(routes, 'GET', '/unknown');
    assert.ok(deniedRoute);
    const deniedResponse = await deniedRoute.handler({
      method: 'GET',
      path: '/unknown',
      query: {},
      headers: {
        authorization: `Bearer ${bearerToken}`,
      },
    });

    assert.equal(deniedResponse.statusCode, 403);
    assert.equal(deniedResponse.body.error, 'deny_by_default');
  } finally {
    if (previousSessionMode === undefined) {
      delete process.env.PUBAUTH_GATEWAY_SESSION_MODE;
    } else {
      process.env.PUBAUTH_GATEWAY_SESSION_MODE = previousSessionMode;
    }
    await closeServer(upstream.server);
  }
});

async function startUpstreamServer() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const chunks = [];

    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const body = Buffer.concat(chunks).toString('utf8');
    response.statusCode = 200;
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        method: request.method,
        path: `${url.pathname}${url.search}`,
        headers: request.headers,
        body,
      }),
    );
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed_to_start_upstream_server');
  }

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}
