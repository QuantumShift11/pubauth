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

test('local account login establishes a session and self-service overview is user-scoped', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'pubauth-self-service-'));
  const issuer = 'https://issuer.example';
  const routes = await buildApiRoutes(issuer, dataDir);

  const loginRoute = findRoute(routes, 'POST', '/auth/login');
  const sessionRoute = findRoute(routes, 'GET', '/auth/session');
  const overviewRoute = findRoute(routes, 'GET', '/me/overview');
  assert.ok(loginRoute);
  assert.ok(sessionRoute);
  assert.ok(overviewRoute);

  const loginResponse = await loginRoute.handler(
    request('POST', '/auth/login', {}, {}, {
      username: 'user@atlas.local',
      password: 'ChangeMe-User!1',
    }),
  );

  assert.equal(loginResponse.statusCode, 200);
  const cookie = loginResponse.headers?.['set-cookie'];
  assert.equal(typeof cookie, 'string');

  const sessionResponse = await sessionRoute.handler(
    request('GET', '/auth/session', {}, { cookie }),
  );
  assert.equal(sessionResponse.statusCode, 200);
  assert.equal(sessionResponse.body.user.subjectId, 'user-1');
  assert.equal(sessionResponse.body.user.username, 'user@atlas.local');

  const overviewResponse = await overviewRoute.handler(
    request('GET', '/me/overview', {}, { cookie }),
  );
  assert.equal(overviewResponse.statusCode, 200);
  assert.equal(overviewResponse.body.user.roles.includes('viewer'), true);
  assert.equal(overviewResponse.body.sessions.length >= 1, true);
});
