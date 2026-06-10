import type {
  AdminCommandResult,
  ClientAdminCommand,
  ProductAdminCommand,
  RoutePolicyAdminCommand,
  WorkspaceAdminCommand,
} from './contracts.js';
export type { AdminCommandResult } from './contracts.js';
import type {
  StoredAssignment,
  StoredOidcClient,
  StoredProduct,
  StoredRoutePolicy,
  StoredRole,
  StoredWorkspace,
} from '../../storage/src/index.js';

export interface ProductAdminService {
  createProduct(command: ProductAdminCommand): Promise<AdminCommandResult>;
}

export interface WorkspaceAdminService {
  createWorkspace(command: WorkspaceAdminCommand): Promise<AdminCommandResult>;
}

export interface ClientAdminService {
  createClient(command: ClientAdminCommand): Promise<AdminCommandResult>;
}

export interface RoutePolicyAdminService {
  createRoutePolicy(command: RoutePolicyAdminCommand): Promise<AdminCommandResult>;
}

export interface RoleAdminService {
  createRole(name: string): Promise<AdminCommandResult>;
}

export interface AssignmentAdminService {
  assignRole(userId: string, role: string): Promise<AdminCommandResult>;
}

export interface AdminOverview {
  products: StoredProduct[];
  workspaces: StoredWorkspace[];
  clients: StoredOidcClient[];
  routePolicies: StoredRoutePolicy[];
  roles: StoredRole[];
  assignments: StoredAssignment[];
  counts: {
    products: number;
    workspaces: number;
    clients: number;
    routePolicies: number;
    roles: number;
    assignments: number;
  };
}

export interface AdminCatalogService {
  getOverview(): Promise<AdminOverview>;
}

export class NotImplementedAdminService
  implements
    ProductAdminService,
    WorkspaceAdminService,
    ClientAdminService,
    RoutePolicyAdminService,
    RoleAdminService,
    AssignmentAdminService
{
  async createProduct(_command: ProductAdminCommand): Promise<AdminCommandResult> {
    return { ok: false, message: 'product_persistence_not_ready' };
  }

  async createWorkspace(_command: WorkspaceAdminCommand): Promise<AdminCommandResult> {
    return { ok: false, message: 'workspace_persistence_not_ready' };
  }

  async createClient(_command: ClientAdminCommand): Promise<AdminCommandResult> {
    return { ok: false, message: 'client_persistence_not_ready' };
  }

  async createRoutePolicy(_command: RoutePolicyAdminCommand): Promise<AdminCommandResult> {
    return { ok: false, message: 'route_policy_persistence_not_ready' };
  }

  async createRole(_name: string): Promise<AdminCommandResult> {
    return { ok: false, message: 'role_persistence_not_ready' };
  }

  async assignRole(_userId: string, _role: string): Promise<AdminCommandResult> {
    return { ok: false, message: 'assignment_persistence_not_ready' };
  }
}
