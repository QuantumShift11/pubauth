import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGatewayRoute, sortRouteRules } from '../dist/packages/gateway/src/index.js';

test('gateway resolves matching route rule', () => {
  const decision = resolveGatewayRoute('/api/reports/1', 'GET', [
    {
      appId: 'app-1',
      upstreamUrl: 'http://upstream.local',
      pathPattern: '/api/reports/**',
      methods: ['GET'],
      requiredRoles: ['viewer'],
    },
  ]);

  assert.equal(decision.matched, true);
  assert.equal(decision.upstreamUrl, 'http://upstream.local');
});

test('gateway sorts route rules by priority descending', () => {
  const sorted = sortRouteRules([
    { id: 'low', appId: 'app', pathPattern: '/**', methods: ['GET'], requiredRoles: ['viewer'], priority: 1, state: 'active' },
    { id: 'high', appId: 'app', pathPattern: '/admin/**', methods: ['GET'], requiredRoles: ['admin'], priority: 100, state: 'active' },
  ]);

  assert.equal(sorted[0].id, 'high');
});

test('gateway route matching is segment-safe and rejects invalid paths', () => {
  const rules = [
    {
      appId: 'app-1',
      upstreamUrl: 'http://upstream.local',
      pathPattern: '/api/reports/**',
      methods: ['GET'],
      requiredRoles: ['viewer'],
    },
  ];

  const similarPrefix = resolveGatewayRoute('/api/reports-admin', 'GET', rules);
  const encodedTraversal = resolveGatewayRoute('/api/reports/%2e%2e/admin', 'GET', rules);

  assert.equal(similarPrefix.matched, false);
  assert.equal(similarPrefix.reason, 'no_route_rule');
  assert.equal(encodedTraversal.matched, false);
  assert.equal(encodedTraversal.reason, 'invalid_path');
});
