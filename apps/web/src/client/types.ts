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
  runtime: {
    issuer: string;
    apiBase: string;
  };
}

export interface ActionResult {
  status: number;
  body: unknown;
}
