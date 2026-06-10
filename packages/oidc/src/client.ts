import { hashSecret, verifySecret } from '../../crypto/src/index.js';

export interface OidcClient {
  clientId: string;
  clientType: 'confidential' | 'public';
  tokenEndpointAuthMethod: 'none' | 'client_secret_basic' | 'client_secret_post';
  clientSecretHash?: string;
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

export function requiresClientSecret(client: OidcClient): boolean {
  return client.clientType === 'confidential';
}

export function verifyClientSecret(client: OidcClient, clientSecret: string | undefined, authMethod: string | undefined): boolean {
  if (!requiresClientSecret(client)) {
    return !clientSecret;
  }

  if (!client.clientSecretHash || !clientSecret) {
    return false;
  }

  if (authMethod && authMethod !== client.tokenEndpointAuthMethod) {
    return false;
  }

  return verifySecret(clientSecret, client.clientSecretHash);
}

export function normalizeTokenEndpointAuthMethod(value: string | undefined): OidcClient['tokenEndpointAuthMethod'] {
  if (value === 'client_secret_basic' || value === 'client_secret_post') {
    return value;
  }
  return 'none';
}

export function hashClientSecret(clientSecret: string): string {
  return hashSecret(clientSecret);
}
