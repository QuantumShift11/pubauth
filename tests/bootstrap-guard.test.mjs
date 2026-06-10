import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findRoute } from '../dist/packages/http/src/index.js';
import { buildApiRoutes } from '../dist/apps/api/src/routes.js';

function request(method, path, query = {}, headers = {}, body) {
  return { method, path, query, headers, body };
}

test('bootstrap local accounts are only usable when PUBAUTH_ENV=local', async () => {
  const previousEnv = process.env.PUBAUTH_ENV;
  const dataDir = mkdtempSync(join(tmpdir(), 'pubauth-bootstrap-'));
  const issuer = 'https://issuer.example';

  process.env.PUBAUTH_ENV = 'local';
  const localRoutes = await buildApiRoutes(issuer, dataDir);
  const localLogin = await findRoute(localRoutes, 'POST', '/auth/login').handler(
    request('POST', '/auth/login', {}, {}, {
      username: 'admin@pubauth.local',
      password: 'ChangeMe-Admin!1',
    }),
  );
  assert.equal(localLogin.statusCode, 200);

  process.env.PUBAUTH_ENV = 'prod';
  await assert.rejects(
    () => buildApiRoutes(issuer, dataDir),
    /bootstrap_accounts_present_outside_local/,
  );

  process.env.PUBAUTH_ENV = 'prod';
  const prodDataDir = mkdtempSync(join(tmpdir(), 'pubauth-bootstrap-prod-'));
  const emptyProdRoutes = await buildApiRoutes(issuer, prodDataDir);
  const emptyProdLogin = await findRoute(emptyProdRoutes, 'POST', '/auth/login').handler(
    request('POST', '/auth/login', {}, {}, {
      username: 'admin@pubauth.local',
      password: 'ChangeMe-Admin!1',
    }),
  );
  assert.equal(emptyProdLogin.statusCode, 401);
  assert.equal(emptyProdLogin.body.error, 'invalid_credentials');

  if (previousEnv === undefined) {
    delete process.env.PUBAUTH_ENV;
  } else {
    process.env.PUBAUTH_ENV = previousEnv;
  }
});

test('startup fails outside local when bootstrap accounts are enabled or present', async () => {
  const previousEnv = process.env.PUBAUTH_ENV;
  const previousBootstrapFlag = process.env.PUBAUTH_ENABLE_BOOTSTRAP_ACCOUNTS;
  const issuer = 'https://issuer.example';

  process.env.PUBAUTH_ENV = 'prod';
  process.env.PUBAUTH_ENABLE_BOOTSTRAP_ACCOUNTS = 'true';
  await assert.rejects(
    () => buildApiRoutes(issuer, mkdtempSync(join(tmpdir(), 'pubauth-bootstrap-flag-'))),
    /bootstrap_accounts_forbidden_outside_local/,
  );

  delete process.env.PUBAUTH_ENABLE_BOOTSTRAP_ACCOUNTS;
  process.env.PUBAUTH_ENV = 'local';
  const dataDir = mkdtempSync(join(tmpdir(), 'pubauth-bootstrap-state-'));
  await buildApiRoutes(issuer, dataDir);

  process.env.PUBAUTH_ENV = 'prod';
  await assert.rejects(
    () => buildApiRoutes(issuer, dataDir),
    /bootstrap_accounts_present_outside_local/,
  );

  if (previousEnv === undefined) {
    delete process.env.PUBAUTH_ENV;
  } else {
    process.env.PUBAUTH_ENV = previousEnv;
  }

  if (previousBootstrapFlag === undefined) {
    delete process.env.PUBAUTH_ENABLE_BOOTSTRAP_ACCOUNTS;
  } else {
    process.env.PUBAUTH_ENABLE_BOOTSTRAP_ACCOUNTS = previousBootstrapFlag;
  }
});
