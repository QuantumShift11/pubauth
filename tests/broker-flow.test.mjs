import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RsaJwtSigner } from '../dist/packages/crypto/src/index.js';
import { findRoute } from '../dist/packages/http/src/index.js';
import { buildApiContext, buildApiRoutes } from '../dist/apps/api/src/routes.js';

function request(method, path, query = {}, headers = {}, body) {
  return { method, path, query, headers, body };
}

test('google and entra broker callbacks validate state and link identities to one account', async () => {
  const previousEnv = {
    PUBAUTH_ENV: process.env.PUBAUTH_ENV,
    PUBAUTH_GOOGLE_OIDC_ISSUER: process.env.PUBAUTH_GOOGLE_OIDC_ISSUER,
    PUBAUTH_GOOGLE_CLIENT_ID: process.env.PUBAUTH_GOOGLE_CLIENT_ID,
    PUBAUTH_GOOGLE_CLIENT_SECRET: process.env.PUBAUTH_GOOGLE_CLIENT_SECRET,
    PUBAUTH_GOOGLE_REDIRECT_URI: process.env.PUBAUTH_GOOGLE_REDIRECT_URI,
    PUBAUTH_ENTRA_OIDC_ISSUER: process.env.PUBAUTH_ENTRA_OIDC_ISSUER,
    PUBAUTH_ENTRA_CLIENT_ID: process.env.PUBAUTH_ENTRA_CLIENT_ID,
    PUBAUTH_ENTRA_CLIENT_SECRET: process.env.PUBAUTH_ENTRA_CLIENT_SECRET,
    PUBAUTH_ENTRA_REDIRECT_URI: process.env.PUBAUTH_ENTRA_REDIRECT_URI,
  };

  const googleProvider = await startFakeProvider('google-subject', 'broker.user@example.com');
  const entraProvider = await startFakeProvider('entra-subject', 'broker.user@example.com');

  try {
    process.env.PUBAUTH_ENV = 'local';
    process.env.PUBAUTH_GOOGLE_OIDC_ISSUER = googleProvider.issuer;
    process.env.PUBAUTH_GOOGLE_CLIENT_ID = 'google-client';
    process.env.PUBAUTH_GOOGLE_CLIENT_SECRET = 'google-secret';
    process.env.PUBAUTH_GOOGLE_REDIRECT_URI = 'https://pubauth.example/auth/broker/google/callback';
    process.env.PUBAUTH_ENTRA_OIDC_ISSUER = entraProvider.issuer;
    process.env.PUBAUTH_ENTRA_CLIENT_ID = 'entra-client';
    process.env.PUBAUTH_ENTRA_CLIENT_SECRET = 'entra-secret';
    process.env.PUBAUTH_ENTRA_REDIRECT_URI = 'https://pubauth.example/auth/broker/entra/callback';

    const dataDir = mkdtempSync(join(tmpdir(), 'pubauth-broker-'));
    const context = await buildApiContext('https://pubauth.example', dataDir);
    const routes = await buildApiRoutes('https://pubauth.example', context);
    const brokerRoute = findRoute(routes, 'GET', '/auth/broker/google/start');
    const callbackRoute = findRoute(routes, 'GET', '/auth/broker/google/callback');
    const entraStartRoute = findRoute(routes, 'GET', '/auth/broker/entra/start');
    const entraCallbackRoute = findRoute(routes, 'GET', '/auth/broker/entra/callback');
    assert.ok(brokerRoute);
    assert.ok(callbackRoute);
    assert.ok(entraStartRoute);
    assert.ok(entraCallbackRoute);

    const googleStart = await brokerRoute.handler(
      request('GET', '/auth/broker/google/start', {
        redirect_uri: '/after-google',
        workspace_id: 'workspace-core-platform',
      }),
    );
    assert.equal(googleStart.statusCode, 302);
    const googleRedirect = new URL(googleStart.headers.location);
    googleProvider.currentNonce = googleRedirect.searchParams.get('nonce');
    const googleState = googleRedirect.searchParams.get('state');
    assert.ok(googleProvider.currentNonce);
    assert.ok(googleState);

    const googleCallback = await callbackRoute.handler(
      request('GET', '/auth/broker/google/callback', {
        state: googleState,
        code: 'google-code',
      }),
    );
    assert.equal(googleCallback.statusCode, 302);
    assert.equal(googleCallback.headers.location, '/after-google');
    assert.equal(typeof googleCallback.headers['set-cookie'], 'string');

    const entraStart = await entraStartRoute.handler(
      request('GET', '/auth/broker/entra/start', {
        redirect_uri: '/after-entra',
        workspace_id: 'workspace-core-platform',
      }),
    );
    assert.equal(entraStart.statusCode, 302);
    const entraRedirect = new URL(entraStart.headers.location);
    entraProvider.currentNonce = entraRedirect.searchParams.get('nonce');
    const entraState = entraRedirect.searchParams.get('state');
    assert.ok(entraProvider.currentNonce);
    assert.ok(entraState);

    const entraCallback = await entraCallbackRoute.handler(
      request('GET', '/auth/broker/entra/callback', {
        state: entraState,
        code: 'entra-code',
      }),
    );
    assert.equal(entraCallback.statusCode, 302);
    assert.equal(entraCallback.headers.location, '/after-entra');

    const state = await context.stateStore.read();
    const brokerUsers = state.users.filter((user) => user.email === 'broker.user@example.com');
    assert.equal(brokerUsers.length, 1);
    assert.equal(state.providerLinks.filter((link) => link.email === 'broker.user@example.com').length, 2);
  } finally {
    await closeServer(googleProvider.server);
    await closeServer(entraProvider.server);
    restoreEnv(previousEnv);
  }
});

test('broker callback rejects nonce mismatch', async () => {
  const previousEnv = {
    PUBAUTH_ENV: process.env.PUBAUTH_ENV,
    PUBAUTH_GOOGLE_OIDC_ISSUER: process.env.PUBAUTH_GOOGLE_OIDC_ISSUER,
    PUBAUTH_GOOGLE_CLIENT_ID: process.env.PUBAUTH_GOOGLE_CLIENT_ID,
    PUBAUTH_GOOGLE_CLIENT_SECRET: process.env.PUBAUTH_GOOGLE_CLIENT_SECRET,
    PUBAUTH_GOOGLE_REDIRECT_URI: process.env.PUBAUTH_GOOGLE_REDIRECT_URI,
  };

  const provider = await startFakeProvider('google-subject', 'broker.user@example.com');

  try {
    process.env.PUBAUTH_ENV = 'local';
    process.env.PUBAUTH_GOOGLE_OIDC_ISSUER = provider.issuer;
    process.env.PUBAUTH_GOOGLE_CLIENT_ID = 'google-client';
    process.env.PUBAUTH_GOOGLE_CLIENT_SECRET = 'google-secret';
    process.env.PUBAUTH_GOOGLE_REDIRECT_URI = 'https://pubauth.example/auth/broker/google/callback';

    const routes = await buildApiRoutes('https://pubauth.example', mkdtempSync(join(tmpdir(), 'pubauth-broker-')));
    const startRoute = findRoute(routes, 'GET', '/auth/broker/google/start');
    const callbackRoute = findRoute(routes, 'GET', '/auth/broker/google/callback');
    const startResponse = await startRoute.handler(
      request('GET', '/auth/broker/google/start', {
        redirect_uri: '/after-google',
      }),
    );

    const redirect = new URL(startResponse.headers.location);
    const state = redirect.searchParams.get('state');
    provider.currentNonce = 'tampered-nonce';

    const callbackResponse = await callbackRoute.handler(
      request('GET', '/auth/broker/google/callback', {
        state,
        code: 'google-code',
      }),
    );
    assert.equal(callbackResponse.statusCode, 400);
    assert.equal(callbackResponse.body.error, 'provider_nonce_mismatch');
  } finally {
    await closeServer(provider.server);
    restoreEnv(previousEnv);
  }
});

test('broker start validates post-login redirect targets', async () => {
  const previousEnv = {
    PUBAUTH_ENV: process.env.PUBAUTH_ENV,
    PUBAUTH_GOOGLE_OIDC_ISSUER: process.env.PUBAUTH_GOOGLE_OIDC_ISSUER,
    PUBAUTH_GOOGLE_CLIENT_ID: process.env.PUBAUTH_GOOGLE_CLIENT_ID,
    PUBAUTH_GOOGLE_CLIENT_SECRET: process.env.PUBAUTH_GOOGLE_CLIENT_SECRET,
    PUBAUTH_GOOGLE_REDIRECT_URI: process.env.PUBAUTH_GOOGLE_REDIRECT_URI,
  };

  const provider = await startFakeProvider('google-subject', 'broker.user@example.com');

  try {
    process.env.PUBAUTH_ENV = 'local';
    process.env.PUBAUTH_GOOGLE_OIDC_ISSUER = provider.issuer;
    process.env.PUBAUTH_GOOGLE_CLIENT_ID = 'google-client';
    process.env.PUBAUTH_GOOGLE_CLIENT_SECRET = 'google-secret';
    process.env.PUBAUTH_GOOGLE_REDIRECT_URI = 'https://pubauth.example/auth/broker/google/callback';

    const routes = await buildApiRoutes('https://pubauth.example', mkdtempSync(join(tmpdir(), 'pubauth-broker-')));
    const startRoute = findRoute(routes, 'GET', '/auth/broker/google/start');
    assert.ok(startRoute);

    const allowed = await startRoute.handler(
      request('GET', '/auth/broker/google/start', { redirect_uri: '/dashboard' }),
    );
    assert.equal(allowed.statusCode, 302);

    const external = await startRoute.handler(
      request('GET', '/auth/broker/google/start', { redirect_uri: 'https://evil.com' }),
    );
    assert.equal(external.statusCode, 400);
    assert.equal(external.body.error, 'invalid_redirect_uri');

    const protocolRelative = await startRoute.handler(
      request('GET', '/auth/broker/google/start', { redirect_uri: '//evil.com' }),
    );
    assert.equal(protocolRelative.statusCode, 400);
    assert.equal(protocolRelative.body.error, 'invalid_redirect_uri');

    const encodedExternal = await startRoute.handler(
      request('GET', '/auth/broker/google/start', { redirect_uri: '%2F%2Fevil.com' }),
    );
    assert.equal(encodedExternal.statusCode, 400);
    assert.equal(encodedExternal.body.error, 'invalid_redirect_uri');
  } finally {
    await closeServer(provider.server);
    restoreEnv(previousEnv);
  }
});

async function startFakeProvider(subject, email) {
  const state = {
    currentNonce: null,
  };
  let issuer = 'http://127.0.0.1:0';
  let signerMaterial = RsaJwtSigner.generateWithMaterial(issuer, `provider-${subject}`);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (url.pathname === '/.well-known/openid-configuration') {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          issuer: issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          userinfo_endpoint: `${issuer}/userinfo`,
          jwks_uri: `${issuer}/jwks`,
        }),
      );
      return;
    }

    if (url.pathname === '/token') {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          access_token: `access-${subject}`,
          token_type: 'Bearer',
          id_token: signerMaterial.signer.sign({
            audience: subject.includes('entra') ? 'entra-client' : 'google-client',
            subject,
            expiresInSeconds: 300,
            claims: {
              nonce: state.currentNonce,
              email,
              email_verified: true,
              name: 'Broker User',
              given_name: 'Broker',
              family_name: 'User',
            },
          }),
        }),
      );
      return;
    }

    if (url.pathname === '/userinfo') {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          sub: subject,
          email,
          email_verified: true,
          name: 'Broker User',
        }),
      );
      return;
    }

    if (url.pathname === '/jwks') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(signerMaterial.signer.jwks()));
      return;
    }

    res.statusCode = 404;
    res.end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('provider_server_failed');
  }
  issuer = `http://127.0.0.1:${address.port}`;
  signerMaterial = RsaJwtSigner.generateWithMaterial(issuer, `provider-${subject}`);

  return {
    server,
    issuer,
    get currentNonce() {
      return state.currentNonce;
    },
    set currentNonce(value) {
      state.currentNonce = value;
    },
  };
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

function restoreEnv(previousEnv) {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
