import { randomUUID } from 'node:crypto';
import { randomToken, sha256Hex } from '../../crypto/src/index.js';
import type {
  AssignmentRepository,
  AuditRepository,
  ClientRepository,
  ProductRepository,
  RoleRepository,
  RoutePolicyRepository,
  SessionRepository,
  SigningKeyRepository,
  UserRepository,
  WorkspaceRepository,
} from '../../storage/src/index.js';
import type {
  StoredAssignment,
  StoredAuditEvent,
  StoredAuthSession,
  StoredOidcClient,
  StoredProduct,
  StoredRole,
  StoredRoutePolicy,
  StoredSigningKey,
  StoredUserAccount,
  StoredWorkspace,
} from '../../storage/src/pubauth-state.js';
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

export interface AdminRepositoryBundle {
  products: ProductRepository<StoredProduct>;
  workspaces: WorkspaceRepository<StoredWorkspace>;
  users: UserRepository<StoredUserAccount>;
  clients: ClientRepository<StoredOidcClient>;
  routePolicies: RoutePolicyRepository<StoredRoutePolicy>;
  roles: RoleRepository<StoredRole>;
  assignments: AssignmentRepository<StoredAssignment>;
  sessions: SessionRepository<StoredAuthSession>;
  signingKeys: SigningKeyRepository<StoredSigningKey>;
  audit: AuditRepository<StoredAuditEvent>;
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
  constructor(private readonly repositories: AdminRepositoryBundle) {}

  async createProduct(command: { workspaceId: string; name: string; slug: string; environment: 'local' | 'dev' | 'qa' | 'prod' }): Promise<AdminCommandResult> {
    const slug = normalizeSlug(command.slug);
    const id = `product-${slug || makeId('product')}`;

    if (!(await this.repositories.workspaces.list()).some((item) => item.id === command.workspaceId)) {
      return { ok: false, id: command.workspaceId, message: 'workspace_missing' };
    }

    if (await this.repositories.products.findBySlug(slug)) {
      await this.appendAudit({
        actor: 'system',
        action: 'create_product',
        entityType: 'product',
        entityId: id,
        outcome: 'failure',
        description: `Product slug ${slug} already exists`,
      });
      return { ok: false, id, message: 'product_slug_already_exists' };
    }

    await this.repositories.products.save({
      id,
      workspaceId: command.workspaceId,
      name: command.name,
      slug,
      environment: command.environment,
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    await this.appendAudit({
      actor: 'system',
      action: 'create_product',
      entityType: 'product',
      entityId: id,
      outcome: 'success',
      description: `Created product ${command.name}`,
    });

    return { ok: true, id, message: 'product_created' };
  }

  async createWorkspace(command: { name: string; slug: string }): Promise<AdminCommandResult> {
    const slug = normalizeSlug(command.slug);
    const id = `workspace-${slug || makeId('workspace')}`;

    if (await this.repositories.workspaces.findBySlug(slug)) {
      await this.appendAudit({
        actor: 'system',
        action: 'create_workspace',
        entityType: 'workspace',
        entityId: id,
        outcome: 'failure',
        description: `Workspace slug ${slug} already exists`,
      });
      return { ok: false, id, message: 'workspace_slug_already_exists' };
    }

    await this.repositories.workspaces.save({
      id,
      name: command.name,
      slug,
      state: 'active',
      createdAt: new Date().toISOString(),
    });
    await this.appendAudit({
      actor: 'system',
      action: 'create_workspace',
      entityType: 'workspace',
      entityId: id,
      outcome: 'success',
      description: `Created workspace ${command.name}`,
    });

    return { ok: true, id, message: 'workspace_created' };
  }

  async createClient(command: { productId: string; clientType: 'public' | 'confidential'; redirectUris: string[]; scopes: string[] }): Promise<AdminCommandResult> {
    const product = await this.repositories.products.findById(command.productId);
    if (!product) {
      await this.appendAudit({
        actor: 'system',
        action: 'create_client',
        entityType: 'client',
        entityId: command.productId,
        outcome: 'failure',
        description: `Client creation failed for product ${command.productId}`,
      });
      return { ok: false, id: command.productId, message: 'client_product_missing_or_duplicate' };
    }

    const id = makeId('client');
    const clientId = `${normalizeSlug(command.productId) || 'client'}-${id.slice(-8)}`;
    const clientSecret = command.clientType === 'confidential' ? randomToken(32) : undefined;

    await this.repositories.clients.save({
      id,
      productId: command.productId,
      workspaceId: product.workspaceId,
      clientId,
      clientType: command.clientType,
      tokenEndpointAuthMethod: command.clientType === 'confidential' ? 'client_secret_basic' : 'none',
      clientSecretHash: clientSecret ? sha256Hex(clientSecret) : undefined,
      allowedRedirectUris: [...command.redirectUris],
      logoutRedirectUris: [],
      allowedScopes: [...new Set(['openid', ...command.scopes])],
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    await this.appendAudit({
      actor: 'system',
      action: 'create_client',
      entityType: 'client',
      entityId: id,
      outcome: 'success',
      description: `Created client ${clientId}`,
    });

    return { ok: true, id: clientId, message: 'client_created', clientSecret };
  }

  async createRoutePolicy(command: { productId: string; upstreamUrl: string; pathPattern: string; methods: string[]; requiredRoles: string[] }): Promise<AdminCommandResult> {
    const product = await this.repositories.products.findById(command.productId);
    if (!product) {
      await this.appendAudit({
        actor: 'system',
        action: 'create_route_policy',
        entityType: 'routePolicy',
        entityId: command.productId,
        outcome: 'failure',
        description: `Route policy target product ${command.productId} missing`,
      });
      return { ok: false, id: command.productId, message: 'route_policy_product_missing' };
    }

    const id = makeId('policy');
    await this.repositories.routePolicies.save({
      id,
      productId: command.productId,
      upstreamUrl: command.upstreamUrl,
      pathPattern: command.pathPattern,
      methods: [...new Set(command.methods.map((method) => method.toUpperCase()))],
      requiredRoles: [...new Set(command.requiredRoles.map((role) => role.trim()).filter(Boolean))],
      priority: 100,
      state: 'active',
      createdAt: new Date().toISOString(),
    });
    await this.appendAudit({
      actor: 'system',
      action: 'create_route_policy',
      entityType: 'routePolicy',
      entityId: id,
      outcome: 'success',
      description: `Created route policy for ${command.pathPattern}`,
    });

    return { ok: true, id, message: 'route_policy_created' };
  }

  async createRole(name: string, workspaceId?: string): Promise<AdminCommandResult> {
    const normalized = normalizeSlug(name);
    const workspacePrefix = workspaceId ? `${normalizeSlug(workspaceId)}-` : '';
    const id = `role-${workspacePrefix}${normalized || makeId('role')}`;

    const roles = await this.repositories.roles.list();
    if (roles.some((role) => role.name === name && role.workspaceId === workspaceId)) {
      await this.appendAudit({
        actor: 'system',
        action: 'create_role',
        entityType: 'role',
        entityId: id,
        outcome: 'failure',
        description: `Role ${name} already exists`,
      });
      return { ok: false, id, message: 'role_already_exists' };
    }

    await this.repositories.roles.save({
      id,
      name,
      workspaceId,
      createdAt: new Date().toISOString(),
    });
    await this.appendAudit({
      actor: 'system',
      action: 'create_role',
      entityType: 'role',
      entityId: id,
      outcome: 'success',
      description: `Created role ${name}`,
    });

    return { ok: true, id, message: 'role_created' };
  }

  async assignRole(command: AssignmentAdminCommand): Promise<AdminCommandResult> {
    const roles = await this.repositories.roles.list();
    const role = roles.find((item) => item.name === command.role && item.workspaceId === command.workspaceId) ??
      roles.find((item) => item.name === command.role && !item.workspaceId) ??
      null;
    if (!role) {
      const id = makeId('assignment');
      await this.appendAudit({
        actor: 'system',
        action: 'assign_role',
        entityType: 'assignment',
        entityId: id,
        outcome: 'failure',
        description: `Role ${command.role} missing`,
      });
      return { ok: false, id, message: 'role_missing' };
    }

    const id = makeId('assignment');
    await this.repositories.assignments.save({
      id,
      userId: command.userId,
      role: command.role,
      workspaceId: command.workspaceId,
      productId: command.productId,
      createdAt: new Date().toISOString(),
    });
    await this.appendAudit({
      actor: 'system',
      action: 'assign_role',
      entityType: 'assignment',
      entityId: id,
      outcome: 'success',
      description: `Assigned ${command.role} to ${command.userId}`,
      workspaceId: command.workspaceId,
    });

    return { ok: true, id, message: 'assignment_created' };
  }

  async getOverview() {
    const [products, workspaces, users, clients, routePolicies, roles, assignments, sessions, signingKeys, auditEvents] = await Promise.all([
      this.repositories.products.list(),
      this.repositories.workspaces.list(),
      this.repositories.users.list(),
      this.repositories.clients.list(),
      this.repositories.routePolicies.list(),
      this.repositories.roles.list(),
      this.repositories.assignments.list(),
      this.repositories.sessions.list(),
      this.repositories.signingKeys.listPublicKeys(),
      this.repositories.audit.listRecent(50),
    ]);

    return {
      products,
      workspaces,
      users: users.map(({ passwordHash: _passwordHash, ...user }) => user),
      clients,
      routePolicies,
      roles,
      assignments,
      sessions,
      signingKeys: signingKeys.map(({ privateKeyPem: _privateKeyPem, ...publicKey }) => publicKey),
      auditEvents,
      counts: {
        products: products.length,
        workspaces: workspaces.length,
        users: users.length,
        clients: clients.length,
        routePolicies: routePolicies.length,
        roles: roles.length,
        assignments: assignments.length,
        sessions: sessions.length,
        signingKeys: signingKeys.length,
        auditEvents: auditEvents.length,
      },
    };
  }

  private async appendAudit(event: Omit<StoredAuditEvent, 'id' | 'createdAt'>): Promise<void> {
    await this.repositories.audit.append({
      id: makeId('audit'),
      createdAt: new Date().toISOString(),
      ...event,
    });
  }
}
