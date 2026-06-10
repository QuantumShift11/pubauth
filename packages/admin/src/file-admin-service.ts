import { randomUUID } from 'node:crypto';
import type { JsonFileStore, PubAuthState } from '../../storage/src/index.js';
import type {
  AdminCatalogService,
  AdminCommandResult,
  AssignmentAdminCommand,
  AssignmentAdminService,
  ClientAdminService,
  ProductAdminService,
  RoutePolicyAdminService,
  RoleAdminService,
  WorkspaceAdminService,
} from './services.js';

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function addAuditEvent(state: PubAuthState, event: {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  outcome: 'success' | 'failure';
  description: string;
  workspaceId?: string;
}) {
  state.auditEvents.push({
    id: makeId('audit'),
    createdAt: new Date().toISOString(),
    ...event,
  });
}

export class FileAdminService
  implements
    ProductAdminService,
    WorkspaceAdminService,
    ClientAdminService,
    RoutePolicyAdminService,
    RoleAdminService,
    AssignmentAdminService,
    AdminCatalogService
{
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async createProduct(command: { name: string; slug: string; environment: 'local' | 'dev' | 'qa' | 'prod' }): Promise<AdminCommandResult> {
    const slug = normalizeSlug(command.slug);
    const now = new Date().toISOString();
    const id = `product-${slug || makeId('product')}`;

    const result = await this.store.update((state) => {
      if (state.products.some((item) => item.slug === slug)) {
        addAuditEvent(state, {
          actor: 'system',
          action: 'create_product',
          entityType: 'product',
          entityId: id,
          outcome: 'failure',
          description: `Product slug ${slug} already exists`,
        });
        return state;
      }

      state.products.push({
        id,
        name: command.name,
        slug,
        environment: command.environment,
        status: 'active',
        createdAt: now,
      });
      addAuditEvent(state, {
        actor: 'system',
        action: 'create_product',
        entityType: 'product',
        entityId: id,
        outcome: 'success',
        description: `Created product ${command.name}`,
      });
      return state;
    });

    const created = result.products.find((item) => item.id === id);
    if (!created) {
      return { ok: false, id, message: 'product_slug_already_exists' };
    }

    return { ok: true, id, message: 'product_created' };
  }

  async createWorkspace(command: { name: string; slug: string }): Promise<AdminCommandResult> {
    const slug = normalizeSlug(command.slug);
    const now = new Date().toISOString();
    const id = `workspace-${slug || makeId('workspace')}`;

    const result = await this.store.update((state) => {
      if (state.workspaces.some((item) => item.slug === slug)) {
        addAuditEvent(state, {
          actor: 'system',
          action: 'create_workspace',
          entityType: 'workspace',
          entityId: id,
          outcome: 'failure',
          description: `Workspace slug ${slug} already exists`,
        });
        return state;
      }

      state.workspaces.push({
        id,
        name: command.name,
        slug,
        state: 'active',
        createdAt: now,
      });
      addAuditEvent(state, {
        actor: 'system',
        action: 'create_workspace',
        entityType: 'workspace',
        entityId: id,
        outcome: 'success',
        description: `Created workspace ${command.name}`,
      });
      return state;
    });

    const created = result.workspaces.find((item) => item.id === id);
    if (!created) {
      return { ok: false, id, message: 'workspace_slug_already_exists' };
    }

    return { ok: true, id, message: 'workspace_created' };
  }

  async createClient(command: { productId: string; clientType: 'public' | 'confidential'; redirectUris: string[]; scopes: string[] }): Promise<AdminCommandResult> {
    const now = new Date().toISOString();
    const id = makeId('client');
    const clientId = `${normalizeSlug(command.productId) || 'client'}-${id.slice(-8)}`;

    const result = await this.store.update((state) => {
      const productExists = state.products.some((item) => item.id === command.productId);
      if (!productExists || state.clients.some((item) => item.clientId === clientId)) {
        addAuditEvent(state, {
          actor: 'system',
          action: 'create_client',
          entityType: 'client',
          entityId: id,
          outcome: 'failure',
          description: `Client creation failed for product ${command.productId}`,
          workspaceId: command.productId,
        });
        return state;
      }

      state.clients.push({
        id,
        productId: command.productId,
        clientId,
        clientType: command.clientType,
        allowedRedirectUris: [...command.redirectUris],
        logoutRedirectUris: [],
        allowedScopes: [...new Set(['openid', ...command.scopes])],
        isActive: true,
        createdAt: now,
      });
      addAuditEvent(state, {
        actor: 'system',
        action: 'create_client',
        entityType: 'client',
        entityId: id,
        outcome: 'success',
        description: `Created client ${clientId}`,
      });
      return state;
    });

    const created = result.clients.find((item) => item.id === id);
    if (!created) {
      return { ok: false, id: command.productId, message: 'client_product_missing_or_duplicate' };
    }

    return { ok: true, id: created.clientId, message: 'client_created' };
  }

  async createRoutePolicy(command: { productId: string; upstreamUrl: string; pathPattern: string; methods: string[]; requiredRoles: string[] }): Promise<AdminCommandResult> {
    const now = new Date().toISOString();
    const id = makeId('policy');

    const result = await this.store.update((state) => {
      if (!state.products.some((item) => item.id === command.productId)) {
        addAuditEvent(state, {
          actor: 'system',
          action: 'create_route_policy',
          entityType: 'routePolicy',
          entityId: id,
          outcome: 'failure',
          description: `Route policy target product ${command.productId} missing`,
        });
        return state;
      }

      state.routePolicies.push({
        id,
        productId: command.productId,
        upstreamUrl: command.upstreamUrl,
        pathPattern: command.pathPattern,
        methods: [...new Set(command.methods.map((method) => method.toUpperCase()))],
        requiredRoles: [...new Set(command.requiredRoles.map((role) => role.trim()).filter(Boolean))],
        priority: 100,
        state: 'active',
        createdAt: now,
      });
      addAuditEvent(state, {
        actor: 'system',
        action: 'create_route_policy',
        entityType: 'routePolicy',
        entityId: id,
        outcome: 'success',
        description: `Created route policy for ${command.pathPattern}`,
      });
      return state;
    });

    const created = result.routePolicies.find((item) => item.id === id);
    if (!created) {
      return { ok: false, id: command.productId, message: 'route_policy_product_missing' };
    }

    return { ok: true, id, message: 'route_policy_created' };
  }

  async createRole(name: string): Promise<AdminCommandResult> {
    const normalized = normalizeSlug(name);
    const now = new Date().toISOString();
    const id = `role-${normalized || makeId('role')}`;

    const result = await this.store.update((state) => {
      if (state.roles.some((item) => item.name === name)) {
        addAuditEvent(state, {
          actor: 'system',
          action: 'create_role',
          entityType: 'role',
          entityId: id,
          outcome: 'failure',
          description: `Role ${name} already exists`,
        });
        return state;
      }

      state.roles.push({
        id,
        name,
        createdAt: now,
      });
      addAuditEvent(state, {
        actor: 'system',
        action: 'create_role',
        entityType: 'role',
        entityId: id,
        outcome: 'success',
        description: `Created role ${name}`,
      });
      return state;
    });

    const created = result.roles.find((item) => item.id === id);
    if (!created) {
      return { ok: false, id, message: 'role_already_exists' };
    }

    return { ok: true, id, message: 'role_created' };
  }

  async assignRole(command: AssignmentAdminCommand): Promise<AdminCommandResult> {
    const now = new Date().toISOString();
    const id = makeId('assignment');

    const result = await this.store.update((state) => {
      if (!state.roles.some((item) => item.name === command.role)) {
        addAuditEvent(state, {
          actor: 'system',
          action: 'assign_role',
          entityType: 'assignment',
          entityId: id,
          outcome: 'failure',
          description: `Role ${command.role} missing`,
        });
        return state;
      }

      state.assignments.push({
        id,
        userId: command.userId,
        role: command.role,
        workspaceId: command.workspaceId,
        createdAt: now,
      });
      addAuditEvent(state, {
        actor: 'system',
        action: 'assign_role',
        entityType: 'assignment',
        entityId: id,
        outcome: 'success',
        description: `Assigned ${command.role} to ${command.userId}`,
        workspaceId: command.workspaceId,
      });
      return state;
    });

    const created = result.assignments.find((item) => item.id === id);
    if (!created) {
      return { ok: false, id, message: 'role_missing' };
    }

    return { ok: true, id, message: 'assignment_created' };
  }

  async getOverview() {
    const state = await this.store.read();
    return {
      products: state.products,
      workspaces: state.workspaces,
      clients: state.clients,
      routePolicies: state.routePolicies,
      roles: state.roles,
      assignments: state.assignments,
      sessions: state.sessions,
      signingKeys: state.signingKeys.map(({ privateKeyPem: _privateKeyPem, ...publicKey }) => publicKey),
      auditEvents: state.auditEvents.slice(-50).reverse(),
      counts: {
        products: state.products.length,
        workspaces: state.workspaces.length,
        clients: state.clients.length,
        routePolicies: state.routePolicies.length,
        roles: state.roles.length,
        assignments: state.assignments.length,
        sessions: state.sessions.length,
        signingKeys: state.signingKeys.length,
        auditEvents: state.auditEvents.length,
      },
    };
  }
}
