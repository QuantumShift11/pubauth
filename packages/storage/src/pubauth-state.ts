export interface StoredAuthorizationCode {
  codeHash: string;
  clientId: string;
  subjectId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  expiresAt: string;
  usedAt?: string;
}

export interface StoredAccessToken {
  accessToken: string;
  subjectId: string;
  clientId: string;
  scopes: string[];
  expiresAt: string;
}

export interface StoredAuthSession {
  id: string;
  subjectId: string;
  workspaceId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface StoredOidcClient {
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

export interface StoredProduct {
  id: string;
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
  createdAt: string;
}

export interface StoredAssignment {
  id: string;
  userId: string;
  role: string;
  workspaceId?: string;
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

export interface PubAuthState {
  products: StoredProduct[];
  workspaces: StoredWorkspace[];
  clients: StoredOidcClient[];
  routePolicies: StoredRoutePolicy[];
  roles: StoredRole[];
  assignments: StoredAssignment[];
  authorizationCodes: StoredAuthorizationCode[];
  accessTokens: StoredAccessToken[];
  sessions: StoredAuthSession[];
  signingKeys: StoredSigningKey[];
}

export function createDefaultPubAuthState(): PubAuthState {
  const now = new Date().toISOString();

  return {
    products: [
      {
        id: 'product-atlas',
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
    clients: [
      {
        id: 'client-dev-client',
        productId: 'product-atlas',
        clientId: 'dev-client',
        clientType: 'public',
        allowedRedirectUris: ['http://localhost:3000/callback'],
        logoutRedirectUris: [],
        allowedScopes: ['openid', 'profile', 'email', 'groups'],
        isActive: true,
        createdAt: now,
      },
    ],
    routePolicies: [],
    roles: [
      {
        id: 'role-viewer',
        name: 'viewer',
        createdAt: now,
      },
      {
        id: 'role-editor',
        name: 'editor',
        createdAt: now,
      },
      {
        id: 'role-admin',
        name: 'admin',
        createdAt: now,
      },
    ],
    assignments: [],
    authorizationCodes: [],
    accessTokens: [],
    sessions: [],
    signingKeys: [],
  };
}
