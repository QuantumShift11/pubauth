import { hashPassword } from '../../crypto/src/index.js';

export interface StoredAuthorizationCode {
  codeHash: string;
  clientId: string;
  subjectId: string;
  workspaceId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  expiresAt: string;
  usedAt?: string;
}

export interface StoredAccessToken {
  accessToken: string;
  jti: string;
  subjectId: string;
  clientId: string;
  workspaceId: string;
  sessionId?: string;
  scopes: string[];
  expiresAt: string;
  revokedAt?: string;
}

export interface StoredRefreshToken {
  refreshTokenHash: string;
  familyId: string;
  subjectId: string;
  clientId: string;
  workspaceId: string;
  sessionId?: string;
  scopes: string[];
  expiresAt: string;
  parentRefreshTokenHash?: string;
  replacedByHash?: string;
  rotatedAt?: string;
  revokedAt?: string;
}

export interface StoredAuthSession {
  id: string;
  subjectId: string;
  workspaceId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface StoredUserAccount {
  id: string;
  subjectId: string;
  username: string;
  passwordHash: string;
  email: string;
  displayName: string;
  workspaceId: string;
  authProvider: 'local' | 'google' | 'entra';
  bootstrapAccount?: boolean;
  status: 'active' | 'disabled';
  createdAt: string;
  lastLoginAt?: string;
}

export interface StoredOidcClient {
  id: string;
  productId: string;
  workspaceId: string;
  clientId: string;
  clientType: 'confidential' | 'public';
  tokenEndpointAuthMethod: 'none' | 'client_secret_basic' | 'client_secret_post';
  clientSecretHash?: string;
  allowedRedirectUris: string[];
  logoutRedirectUris: string[];
  allowedScopes: string[];
  isActive: boolean;
  createdAt: string;
}

export interface StoredProduct {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  environment: 'local' | 'dev' | 'qa' | 'prod';
  status: 'active' | 'disabled';
  createdAt: string;
}

export interface StoredWorkspace {
  id: string;
  name: string;
  slug: string;
  state: 'active' | 'disabled';
  createdAt: string;
}

export interface StoredRoutePolicy {
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

export interface StoredRole {
  id: string;
  name: string;
  workspaceId?: string;
  createdAt: string;
}

export interface StoredAssignment {
  id: string;
  userId: string;
  role: string;
  workspaceId?: string;
  productId?: string;
  createdAt: string;
}

export interface StoredProviderLink {
  id: string;
  userId: string;
  provider: 'google' | 'entra';
  providerSubject: string;
  email?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface StoredBrokerState {
  state: string;
  provider: 'google' | 'entra';
  nonce: string;
  redirectUri: string;
  workspaceId?: string;
  expiresAt: string;
  createdAt: string;
 }

export interface StoredSigningKey {
  keyId: string;
  algorithm: 'RS256' | 'ES256';
  publicKeyPem: string;
  privateKeyPem: string;
  status: 'active' | 'previous' | 'disabled';
  createdAt: string;
}

export interface StoredAuditEvent {
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

export interface PubAuthState {
  products: StoredProduct[];
  workspaces: StoredWorkspace[];
  users: StoredUserAccount[];
  clients: StoredOidcClient[];
  routePolicies: StoredRoutePolicy[];
  roles: StoredRole[];
  assignments: StoredAssignment[];
  providerLinks: StoredProviderLink[];
  brokerStates: StoredBrokerState[];
  authorizationCodes: StoredAuthorizationCode[];
  accessTokens: StoredAccessToken[];
  refreshTokens: StoredRefreshToken[];
  sessions: StoredAuthSession[];
  signingKeys: StoredSigningKey[];
  auditEvents: StoredAuditEvent[];
}

export function readPubAuthEnvironment(): 'local' | 'dev' | 'qa' | 'prod' {
  const value = process.env.PUBAUTH_ENV;
  return value === 'dev' || value === 'qa' || value === 'prod' ? value : 'local';
}

export function isBootstrapAccountsEnabled(): boolean {
  return process.env.PUBAUTH_ENABLE_BOOTSTRAP_ACCOUNTS === 'true';
}

export function assertBootstrapAccountPolicy(
  state: Pick<PubAuthState, 'users'>,
  environment = readPubAuthEnvironment(),
): void {
  if (environment === 'local') {
    return;
  }

  if (isBootstrapAccountsEnabled()) {
    throw new Error('bootstrap_accounts_forbidden_outside_local');
  }

  if (state.users.some((user) => user.bootstrapAccount)) {
    throw new Error('bootstrap_accounts_present_outside_local');
  }
}

export function createDefaultPubAuthState(): PubAuthState {
  const now = new Date().toISOString();
  const environment = readPubAuthEnvironment();
  if (environment !== 'local' && isBootstrapAccountsEnabled()) {
    throw new Error('bootstrap_accounts_forbidden_outside_local');
  }
  const shouldSeedLocalUsers = environment === 'local';
  const adminPassword = process.env.PUBAUTH_BOOTSTRAP_ADMIN_PASSWORD ?? 'ChangeMe-Admin!1';
  const tenantPassword = process.env.PUBAUTH_BOOTSTRAP_TENANT_PASSWORD ?? 'ChangeMe-Tenant!1';
  const userPassword = process.env.PUBAUTH_BOOTSTRAP_USER_PASSWORD ?? 'ChangeMe-User!1';

  return {
    products: [
      {
        id: 'product-atlas',
        workspaceId: 'workspace-core-platform',
        name: 'Atlas',
        slug: 'atlas',
        environment: 'local',
        status: 'active',
        createdAt: now,
      },
    ],
    workspaces: [
      {
        id: 'workspace-core-platform',
        name: 'Core Platform',
        slug: 'core-platform',
        state: 'active',
        createdAt: now,
      },
    ],
    users: shouldSeedLocalUsers
      ? [
          {
            id: 'user-account-admin',
            subjectId: 'admin-user',
            username: 'admin@pubauth.local',
            passwordHash: hashPassword(adminPassword),
            email: 'admin@pubauth.local',
            displayName: 'Platform Admin',
            workspaceId: 'workspace-core-platform',
            authProvider: 'local',
            bootstrapAccount: true,
            status: 'active',
            createdAt: now,
          },
          {
            id: 'user-account-tenant',
            subjectId: 'tenant-owner',
            username: 'owner@atlas.local',
            passwordHash: hashPassword(tenantPassword),
            email: 'owner@atlas.local',
            displayName: 'Atlas Owner',
            workspaceId: 'workspace-core-platform',
            authProvider: 'local',
            bootstrapAccount: true,
            status: 'active',
            createdAt: now,
          },
          {
            id: 'user-account-enduser',
            subjectId: 'user-1',
            username: 'user@atlas.local',
            passwordHash: hashPassword(userPassword),
            email: 'user@atlas.local',
            displayName: 'Atlas User',
            workspaceId: 'workspace-core-platform',
            authProvider: 'local',
            bootstrapAccount: true,
            status: 'active',
            createdAt: now,
          },
        ]
      : [],
    clients: [
      {
        id: 'client-pubauth-client',
        productId: 'product-atlas',
        workspaceId: 'workspace-core-platform',
        clientId: 'pubauth-client',
        clientType: 'public',
        tokenEndpointAuthMethod: 'none',
        allowedRedirectUris: ['http://localhost:3000/callback', 'http://localhost:3001/auth/callback'],
        logoutRedirectUris: [],
        allowedScopes: ['openid', 'profile', 'email', 'groups'],
        isActive: true,
        createdAt: now,
      },
    ],
    routePolicies: [],
    roles: [
      {
        id: 'role-super-admin',
        name: 'super_admin',
        createdAt: now,
      },
      {
        id: 'role-tenant-admin',
        name: 'tenant_admin',
        workspaceId: 'workspace-core-platform',
        createdAt: now,
      },
      {
        id: 'role-product-admin',
        name: 'product_admin',
        workspaceId: 'workspace-core-platform',
        createdAt: now,
      },
      {
        id: 'role-viewer',
        name: 'viewer',
        workspaceId: 'workspace-core-platform',
        createdAt: now,
      },
    ],
    assignments: [
      {
        id: 'assignment-admin-user',
        userId: 'admin-user',
        role: 'super_admin',
        createdAt: now,
      },
      {
        id: 'assignment-tenant-owner',
        userId: 'tenant-owner',
        role: 'tenant_admin',
        workspaceId: 'workspace-core-platform',
        createdAt: now,
      },
      {
        id: 'assignment-end-user',
        userId: 'user-1',
        role: 'viewer',
        workspaceId: 'workspace-core-platform',
        createdAt: now,
      },
    ],
    providerLinks: [],
    brokerStates: [],
    authorizationCodes: [],
    accessTokens: [],
    refreshTokens: [],
    sessions: [],
    signingKeys: [],
    auditEvents: [],
  };
}
