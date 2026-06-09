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
