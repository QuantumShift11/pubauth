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
