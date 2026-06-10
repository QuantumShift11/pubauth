export interface AdminCommandResult {
  ok: boolean;
  id?: string;
  message: string;
  clientSecret?: string;
}

export interface ProductAdminCommand {
  workspaceId: string;
  name: string;
  slug: string;
  environment: 'local' | 'dev' | 'qa' | 'prod';
}

export interface WorkspaceAdminCommand {
  name: string;
  slug: string;
}

export interface ClientAdminCommand {
  productId: string;
  clientType: 'public' | 'confidential';
  redirectUris: string[];
  scopes: string[];
}

export interface RoutePolicyAdminCommand {
  productId: string;
  upstreamUrl: string;
  pathPattern: string;
  methods: string[];
  requiredRoles: string[];
}

export interface AssignmentAdminCommand {
  userId: string;
  role: string;
  workspaceId?: string;
  productId?: string;
}
