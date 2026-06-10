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

test('RBAC uses segment-safe wildcard matching', () => {
  const allowed = evaluatePolicy(principal, { productId: 'app-1', path: '/reports/summary', method: 'GET' }, [
    { pathPattern: '/reports/**', methods: ['GET'], requiredRoles: ['viewer'] },
  ]);
  const denied = evaluatePolicy(principal, { productId: 'app-1', path: '/reports-admin', method: 'GET' }, [
    { pathPattern: '/reports/**', methods: ['GET'], requiredRoles: ['viewer'] },
  ]);

  assert.equal(allowed.allowed, true);
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, 'no_matching_rule');
});

test('RBAC rejects encoded traversal and separator ambiguity', () => {
  const traversal = evaluatePolicy(principal, { productId: 'app-1', path: '/reports/%2e%2e/admin', method: 'GET' }, [
    { pathPattern: '/reports/**', methods: ['GET'], requiredRoles: ['viewer'] },
  ]);
  const encodedSlash = evaluatePolicy(principal, { productId: 'app-1', path: '/reports%2fadmin', method: 'GET' }, [
    { pathPattern: '/reports/**', methods: ['GET'], requiredRoles: ['viewer'] },
  ]);

  assert.equal(traversal.allowed, false);
  assert.equal(traversal.reason, 'invalid_path');
  assert.equal(encodedSlash.allowed, false);
  assert.equal(encodedSlash.reason, 'invalid_path');
});
