export interface OidcClient {
  clientId: string;
  clientType: 'confidential' | 'public';
  allowedRedirectUris: string[];
  allowedScopes: string[];
  isActive: boolean;
}

export interface OidcClientRepository {
  findByClientId(clientId: string): Promise<OidcClient | null>;
  save(client: OidcClient): Promise<void>;
}

export function isRedirectUriAllowed(client: OidcClient, redirectUri: string): boolean {
  return client.allowedRedirectUris.includes(redirectUri);
}

export function areScopesAllowed(client: OidcClient, requestedScopes: string[]): boolean {
  return requestedScopes.every((scope) => client.allowedScopes.includes(scope));
}
