export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint: string;
  logout_endpoint?: string;
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
  admin: {
    products: Array<{ id: string; name: string; slug: string; environment: string; status: string }>;
    workspaces: Array<{ id: string; name: string; slug: string; state: string }>;
    clients: Array<{ id: string; clientId: string; productId: string; clientType: string; isActive: boolean }>;
    routePolicies: Array<{ id: string; productId: string; pathPattern: string; methods: string[]; requiredRoles: string[] }>;
    roles: Array<{ id: string; name: string }>;
    assignments: Array<{ id: string; userId: string; role: string }>;
    counts: Record<string, number>;
  };
  runtime: {
    issuer: string;
    apiBase: string;
  };
}

export interface ActionResult {
  status: number;
  body: unknown;
}
