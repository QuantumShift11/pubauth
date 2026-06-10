export interface OidcDiscoveryConfig {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  userinfoEndpoint: string;
  logoutEndpoint: string;
}

export function buildDiscoveryDocument(config: OidcDiscoveryConfig) {
  return {
    issuer: config.issuer,
    authorization_endpoint: config.authorizationEndpoint,
    token_endpoint: config.tokenEndpoint,
    jwks_uri: config.jwksUri,
    userinfo_endpoint: config.userinfoEndpoint,
    end_session_endpoint: config.logoutEndpoint,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    scopes_supported: ['openid', 'profile', 'email', 'groups'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'email', 'roles', 'groups', 'workspace_id', 'token_use', 'scope', 'client_id'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
  };
}
