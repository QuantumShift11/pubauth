import type {
  AssignmentRepository,
  ClientRepository,
  ProductRepository,
  RoleRepository,
  RoutePolicyRepository,
  UserRepository,
  WorkspaceRepository,
} from '../../storage/src/index.js';
import type {
  StoredAssignment,
  StoredOidcClient,
  StoredProduct,
  StoredRole,
  StoredRoutePolicy,
  StoredUserAccount,
  StoredWorkspace,
} from '../../storage/src/pubauth-state.js';
import type { AdminOverview } from './services.js';

export type AdminRole = 'super_admin' | 'tenant_admin' | 'product_admin' | 'viewer';

export interface AdminActor {
  subjectId: string;
  workspaceId: string;
}

export interface AdminAccessDecision {
  allowed: boolean;
  reason?: 'login_required' | 'forbidden' | 'not_found' | 'invalid_scope';
}

interface AdminGrant {
  role: AdminRole;
  workspaceId?: string;
  productId?: string;
}

export interface AdminAccessRepositories {
  products: ProductRepository<StoredProduct>;
  workspaces: WorkspaceRepository<StoredWorkspace>;
  users: UserRepository<StoredUserAccount>;
  clients: ClientRepository<StoredOidcClient>;
  routePolicies: RoutePolicyRepository<StoredRoutePolicy>;
  roles: RoleRepository<StoredRole>;
  assignments: AssignmentRepository<StoredAssignment>;
}

export class AdminAccessControlService {
  constructor(private readonly repositories: AdminAccessRepositories) {}

  async canReadOverview(actor: AdminActor): Promise<AdminAccessDecision> {
    const grants = await this.loadGrants(actor.subjectId);
    return grants.some((grant) => grant.role === 'super_admin' || grant.role === 'tenant_admin' || grant.role === 'product_admin' || grant.role === 'viewer')
      ? { allowed: true }
      : { allowed: false, reason: 'forbidden' };
  }

  async canCreateWorkspace(actor: AdminActor): Promise<AdminAccessDecision> {
    return (await this.hasRole(actor.subjectId, 'super_admin')) ? { allowed: true } : { allowed: false, reason: 'forbidden' };
  }

  async canCreateProduct(actor: AdminActor, workspaceId: string): Promise<AdminAccessDecision> {
    if (await this.hasRole(actor.subjectId, 'super_admin')) {
      return { allowed: true };
    }

    return (await this.hasWorkspaceRole(actor.subjectId, workspaceId, ['tenant_admin']))
      ? { allowed: true }
      : { allowed: false, reason: 'forbidden' };
  }

  async canCreateClient(actor: AdminActor, productId: string): Promise<AdminAccessDecision> {
    return this.canManageProductBoundResource(actor, productId);
  }

  async canCreateRoutePolicy(actor: AdminActor, productId: string): Promise<AdminAccessDecision> {
    return this.canManageProductBoundResource(actor, productId);
  }

  async canCreateRole(actor: AdminActor, workspaceId: string): Promise<AdminAccessDecision> {
    if (await this.hasRole(actor.subjectId, 'super_admin')) {
      return { allowed: true };
    }

    return (await this.hasWorkspaceRole(actor.subjectId, workspaceId, ['tenant_admin']))
      ? { allowed: true }
      : { allowed: false, reason: 'forbidden' };
  }

  async canAssignRole(actor: AdminActor, workspaceId: string, productId?: string): Promise<AdminAccessDecision> {
    if (await this.hasRole(actor.subjectId, 'super_admin')) {
      return { allowed: true };
    }

    if (!(await this.hasWorkspaceRole(actor.subjectId, workspaceId, ['tenant_admin']))) {
      return { allowed: false, reason: 'forbidden' };
    }

    if (!productId) {
      return { allowed: true };
    }

    const product = await this.repositories.products.findById(productId);
    if (!product) {
      return { allowed: false, reason: 'not_found' };
    }

    return product.workspaceId === workspaceId
      ? { allowed: true }
      : { allowed: false, reason: 'invalid_scope' };
  }

  async filterOverview(actor: AdminActor, overview: AdminOverview): Promise<AdminOverview> {
    if (await this.hasRole(actor.subjectId, 'super_admin')) {
      return overview;
    }

    const grants = await this.loadGrants(actor.subjectId);
    const workspaceIds = new Set(grants.map((grant) => grant.workspaceId).filter(Boolean));
    const productIds = new Set(grants.map((grant) => grant.productId).filter(Boolean));
    const allowedWorkspaceIds = workspaceIds.size > 0 ? workspaceIds : new Set([actor.workspaceId]);

    const products = overview.products.filter((product) => allowedWorkspaceIds.has(product.workspaceId));
    const allowedProductIds = new Set([...products.map((product) => product.id), ...productIds]);
    const workspaces = overview.workspaces.filter((workspace) => allowedWorkspaceIds.has(workspace.id));
    const users = overview.users.filter((user) => allowedWorkspaceIds.has(user.workspaceId));
    const clients = overview.clients.filter((client) => allowedProductIds.has(client.productId) || allowedWorkspaceIds.has(client.workspaceId));
    const routePolicies = overview.routePolicies.filter((policy) => allowedProductIds.has(policy.productId));
    const roles = overview.roles.filter((role) => !role.workspaceId || allowedWorkspaceIds.has(role.workspaceId));
    const assignments = overview.assignments.filter((assignment) => {
      if (assignment.workspaceId && !allowedWorkspaceIds.has(assignment.workspaceId)) {
        return false;
      }
      if (assignment.productId && !allowedProductIds.has(assignment.productId)) {
        return false;
      }
      return true;
    });
    const sessions = overview.sessions.filter((session) => allowedWorkspaceIds.has(session.workspaceId));
    const auditEvents = overview.auditEvents.filter((event) => !event.workspaceId || allowedWorkspaceIds.has(event.workspaceId));

    return {
      ...overview,
      products,
      workspaces,
      users,
      clients,
      routePolicies,
      roles,
      assignments,
      sessions,
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
        signingKeys: overview.signingKeys.length,
        auditEvents: auditEvents.length,
      },
    };
  }

  private async canManageProductBoundResource(actor: AdminActor, productId: string): Promise<AdminAccessDecision> {
    const product = await this.repositories.products.findById(productId);
    if (!product) {
      return { allowed: false, reason: 'not_found' };
    }

    if (await this.hasRole(actor.subjectId, 'super_admin')) {
      return { allowed: true };
    }

    const grants = await this.loadGrants(actor.subjectId);
    const allowed = grants.some((grant) => {
      if (grant.role === 'tenant_admin' && grant.workspaceId === product.workspaceId) {
        return true;
      }
      if (grant.role === 'product_admin' && grant.workspaceId === product.workspaceId) {
        return !grant.productId || grant.productId === productId;
      }
      return false;
    });

    return allowed ? { allowed: true } : { allowed: false, reason: 'forbidden' };
  }

  private async hasRole(subjectId: string, role: AdminRole): Promise<boolean> {
    const grants = await this.loadGrants(subjectId);
    return grants.some((grant) => grant.role === role);
  }

  private async hasWorkspaceRole(subjectId: string, workspaceId: string, roles: AdminRole[]): Promise<boolean> {
    const grants = await this.loadGrants(subjectId);
    return grants.some((grant) => roles.includes(grant.role) && grant.workspaceId === workspaceId);
  }

  private async loadGrants(subjectId: string): Promise<AdminGrant[]> {
    const assignments = await this.repositories.assignments.list();
    return assignments
      .filter((assignment) => assignment.userId === subjectId)
      .filter((assignment): assignment is StoredAssignment & { role: AdminRole } =>
        assignment.role === 'super_admin' ||
        assignment.role === 'tenant_admin' ||
        assignment.role === 'product_admin' ||
        assignment.role === 'viewer',
      )
      .map((assignment) => ({
        role: assignment.role,
        workspaceId: assignment.workspaceId,
        productId: assignment.productId,
      }));
  }
}
