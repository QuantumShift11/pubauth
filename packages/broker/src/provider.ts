export interface ProviderProfile {
  providerName: 'google' | 'entra';
  subject: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  workspaceId?: string;
  claims: Record<string, unknown>;
}

export interface ProviderAdapter {
  name: string;
  buildLoginUrl(state: string): Promise<string>;
  handleCallback(params: Record<string, string>, context?: BrokerCallbackContext): Promise<ProviderProfile>;
}

export interface OidcProviderAdapter extends ProviderAdapter {
  issuer: string;
  buildLoginUrl(state: string, nonce?: string): Promise<string>;
  handleCallback(params: Record<string, string>, context?: BrokerCallbackContext): Promise<ProviderProfile>;
}

export interface GoogleOidcAdapter extends OidcProviderAdapter {
  provider: 'google';
}

export interface EntraOidcAdapter extends OidcProviderAdapter {
  provider: 'entra';
}

export interface StateNonceValidator {
  verify(state: string, nonce?: string): Promise<BrokerStateValidation>;
}

export interface CallbackNormalizer {
  normalize(params: Record<string, string>): ProviderProfile;
}

export interface OidcAdapterRegistry {
  google?: GoogleOidcAdapter;
  entra?: EntraOidcAdapter;
}

export interface BrokerCallbackContext {
  expectedNonce?: string;
}

export interface BrokerStateValidation {
  valid: boolean;
  reason?: 'expired' | 'missing' | 'provider_mismatch' | 'nonce_mismatch';
  provider?: 'google' | 'entra';
  nonce?: string;
  workspaceId?: string;
  redirectUri?: string;
}

export interface BrokerSessionStart {
  redirectUrl: string;
  state: string;
  nonce: string;
}
