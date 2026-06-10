export interface ProviderProfile {
  providerName: string;
  subject: string;
  verified: boolean;
  claims: Record<string, unknown>;
}

export interface ProviderAdapter {
  name: string;
  buildLoginUrl(state: string): Promise<string>;
  handleCallback(params: Record<string, string>): Promise<ProviderProfile>;
}

export interface OidcProviderAdapter extends ProviderAdapter {
  issuer: string;
  buildLoginUrl(state: string, nonce?: string): Promise<string>;
}

export interface GoogleOidcAdapter extends OidcProviderAdapter {
  provider: 'google';
}

export interface EntraOidcAdapter extends OidcProviderAdapter {
  provider: 'entra';
}

export interface StateNonceValidator {
  verify(state: string, nonce?: string): Promise<boolean>;
}

export interface CallbackNormalizer {
  normalize(params: Record<string, string>): ProviderProfile;
}

export interface OidcAdapterRegistry {
  google?: GoogleOidcAdapter;
  entra?: EntraOidcAdapter;
}
