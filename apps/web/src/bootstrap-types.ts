export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint: string;
  logout_endpoint?: string;
}

export interface BootstrapProduct {
  id: string;
  name: string;
  slug: string;
  environment: 'local' | 'dev' | 'qa' | 'prod';
  status: 'active' | 'disabled';
  createdAt: string;
}

export interface BootstrapWorkspace {
  id: string;
  name: string;
  slug: string;
  state: 'active' | 'disabled';
  createdAt: string;
}

export interface BootstrapClient {
  id: string;
  productId: string;
  clientId: string;
  clientType: 'confidential' | 'public';
  allowedRedirectUris: string[];
  logoutRedirectUris: string[];
  allowedScopes: string[];
  isActive: boolean;
  createdAt: string;
}

export interface BootstrapRoutePolicy {
  id: string;
  productId: string;
  upstreamUrl: string;
  pathPattern: string;
  methods: string[];
  requiredRoles: string[];
  priority: number;
  state: 'active' | 'disabled';
  createdAt: string;
}

export interface BootstrapRole {
  id: string;
  name: string;
  createdAt: string;
}

export interface BootstrapAssignment {
  id: string;
  userId: string;
  role: string;
  workspaceId?: string;
  createdAt: string;
}

export interface BootstrapSession {
  id: string;
  subjectId: string;
  workspaceId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface BootstrapSigningKey {
  keyId: string;
  algorithm: 'RS256' | 'ES256';
  status: 'active' | 'previous' | 'disabled';
  createdAt: string;
  publicKeyPem: string;
}

export interface BootstrapAuditEvent {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  workspaceId?: string;
  outcome: 'success' | 'failure';
  description: string;
  createdAt: string;
}

export interface BootstrapAdminPayload {
  products: BootstrapProduct[];
  workspaces: BootstrapWorkspace[];
  clients: BootstrapClient[];
  routePolicies: BootstrapRoutePolicy[];
  roles: BootstrapRole[];
  assignments: BootstrapAssignment[];
  sessions: BootstrapSession[];
  signingKeys: BootstrapSigningKey[];
  auditEvents: BootstrapAuditEvent[];
  counts: Record<string, number>;
}

export interface BootstrapPayload {
  api: {
    status: string;
    service: string;
  };
  discovery: OidcDiscoveryDocument;
  jwks: {
    keys: Array<{
      kid: string;
      alg: string;
      use: string;
      kty: string;
    }>;
  };
  admin: BootstrapAdminPayload;
  runtime: {
    issuer: string;
    apiBase: string;
  };
}

export interface ActionResult {
  status: number;
  body: unknown;
}
