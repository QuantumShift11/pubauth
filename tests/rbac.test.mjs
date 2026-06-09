import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy } from '../dist/packages/rbac/src/index.js';

const principal = {
  userId: 'user-1',
  workspaceId: 'workspace-1',
  roles: ['viewer'],
  groups: ['security'],
};

test('RBAC allows matching role, method, and path', () => {
  const decision = evaluatePolicy(principal, { productId: 'app-1', path: '/reports/summary', method: 'GET' }, [
    { pathPattern: '/reports/**', methods: ['GET'], requiredRoles: ['viewer'] },
  ]);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, 'allowed');
});

test('RBAC denies missing role', () => {
  const decision = evaluatePolicy(principal, { productId: 'app-1', path: '/admin', method: 'GET' }, [
    { pathPattern: '/admin', methods: ['GET'], requiredRoles: ['admin'] },
  ]);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'missing_role');
});
