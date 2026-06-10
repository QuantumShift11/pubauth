import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AdminAccessControlService,
} from '../dist/packages/admin/src/index.js';
import {
  JsonFileStore,
  FileAssignmentRepository,
  FileClientRepository,
  FileProductRepository,
  FileRoleRepository,
  FileRoutePolicyRepository,
  FileUserRepository,
  FileWorkspaceRepository,
} from '../dist/packages/storage/src/index.js';

test('admin access control enforces super_admin, tenant_admin, product_admin, and viewer scopes', async () => {
  const now = new Date().toISOString();
  const store = new JsonFileStore(join(mkdtempSync(join(tmpdir(), 'pubauth-admin-access-')), 'state.json'), {
    products: [
      { id: 'product-a', workspaceId: 'workspace-a', name: 'A', slug: 'a', environment: 'dev', status: 'active', createdAt: now },
      { id: 'product-b', workspaceId: 'workspace-b', name: 'B', slug: 'b', environment: 'dev', status: 'active', createdAt: now },
    ],
    workspaces: [
      { id: 'workspace-a', name: 'Workspace A', slug: 'workspace-a', state: 'active', createdAt: now },
      { id: 'workspace-b', name: 'Workspace B', slug: 'workspace-b', state: 'active', createdAt: now },
    ],
    users: [
      { id: 'u1', subjectId: 'super', username: 'super@example.com', passwordHash: 'x', email: 'super@example.com', displayName: 'Super', workspaceId: 'workspace-a', authProvider: 'local', status: 'active', createdAt: now },
      { id: 'u2', subjectId: 'tenant', username: 'tenant@example.com', passwordHash: 'x', email: 'tenant@example.com', displayName: 'Tenant', workspaceId: 'workspace-a', authProvider: 'local', status: 'active', createdAt: now },
      { id: 'u3', subjectId: 'product', username: 'product@example.com', passwordHash: 'x', email: 'product@example.com', displayName: 'Product', workspaceId: 'workspace-a', authProvider: 'local', status: 'active', createdAt: now },
      { id: 'u4', subjectId: 'viewer', username: 'viewer@example.com', passwordHash: 'x', email: 'viewer@example.com', displayName: 'Viewer', workspaceId: 'workspace-a', authProvider: 'local', status: 'active', createdAt: now },
    ],
    clients: [],
    routePolicies: [],
    roles: [],
    assignments: [
      { id: 'a1', userId: 'super', role: 'super_admin', createdAt: now },
      { id: 'a2', userId: 'tenant', role: 'tenant_admin', workspaceId: 'workspace-a', createdAt: now },
      { id: 'a3', userId: 'product', role: 'product_admin', workspaceId: 'workspace-a', productId: 'product-a', createdAt: now },
      { id: 'a4', userId: 'viewer', role: 'viewer', workspaceId: 'workspace-a', createdAt: now },
    ],
    providerLinks: [],
    brokerStates: [],
    authorizationCodes: [],
    accessTokens: [],
    refreshTokens: [],
    sessions: [],
    signingKeys: [],
    auditEvents: [],
  });

  const access = new AdminAccessControlService({
    products: new FileProductRepository(store),
    workspaces: new FileWorkspaceRepository(store),
    users: new FileUserRepository(store),
    clients: new FileClientRepository(store),
    routePolicies: new FileRoutePolicyRepository(store),
    roles: new FileRoleRepository(store),
    assignments: new FileAssignmentRepository(store),
  });

  assert.equal((await access.canCreateWorkspace({ subjectId: 'super', workspaceId: 'workspace-a' })).allowed, true);
  assert.equal((await access.canCreateWorkspace({ subjectId: 'tenant', workspaceId: 'workspace-a' })).allowed, false);

  assert.equal((await access.canCreateProduct({ subjectId: 'tenant', workspaceId: 'workspace-a' }, 'workspace-a')).allowed, true);
  assert.equal((await access.canCreateProduct({ subjectId: 'tenant', workspaceId: 'workspace-a' }, 'workspace-b')).allowed, false);

  assert.equal((await access.canCreateClient({ subjectId: 'product', workspaceId: 'workspace-a' }, 'product-a')).allowed, true);
  assert.equal((await access.canCreateClient({ subjectId: 'product', workspaceId: 'workspace-a' }, 'product-b')).allowed, false);

  assert.equal((await access.canReadOverview({ subjectId: 'viewer', workspaceId: 'workspace-a' })).allowed, true);
  assert.equal((await access.canCreateRoutePolicy({ subjectId: 'viewer', workspaceId: 'workspace-a' }, 'product-a')).allowed, false);
});
