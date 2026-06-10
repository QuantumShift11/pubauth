import { verifyJwtWithJwk, type PublicRsaJsonWebKey } from '../../crypto/src/index.js';
import type {
  BrokerCallbackContext,
  CallbackNormalizer,
  EntraOidcAdapter,
  GoogleOidcAdapter,
  OidcProviderAdapter,
  ProviderProfile,
} from './provider.js';

interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
}

interface OidcProviderConfiguration {
  provider: 'google' | 'entra';
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

export class GenericOidcBrokerAdapter implements OidcProviderAdapter {
  readonly name: 'google' | 'entra';
  readonly provider: 'google' | 'entra';
  readonly issuer: string;

  constructor(
    private readonly configuration: OidcProviderConfiguration,
    private readonly normalizer: CallbackNormalizer,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.name = configuration.provider;
    this.provider = configuration.provider;
    this.issuer = configuration.issuer;
  }

  async buildLoginUrl(state: string, nonce?: string): Promise<string> {
    const discovery = await this.getDiscovery();
    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set('client_id', this.configuration.clientId);
    url.searchParams.set('redirect_uri', this.configuration.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', (this.configuration.scopes ?? ['openid', 'profile', 'email']).join(' '));
    url.searchParams.set('state', state);
    if (nonce) {
      url.searchParams.set('nonce', nonce);
    }
    return url.toString();
  }

  async handleCallback(params: Record<string, string>, context?: BrokerCallbackContext): Promise<ProviderProfile> {
    const code = params.code;
    if (!code) {
      throw new Error('provider_code_missing');
    }

    const discovery = await this.getDiscovery();
    const tokenResponse = await this.fetchImpl(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.configuration.clientId,
        client_secret: this.configuration.clientSecret,
        redirect_uri: this.configuration.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('provider_token_exchange_failed');
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      id_token?: string;
    };
    if (!tokenPayload.id_token) {
      throw new Error('provider_id_token_missing');
    }

    const idTokenClaims = await this.verifyIdToken(tokenPayload.id_token, discovery, context?.expectedNonce);
    let mergedClaims = { ...idTokenClaims };
    if (tokenPayload.access_token) {
      const userInfoResponse = await this.fetchImpl(discovery.userinfo_endpoint, {
        headers: {
          authorization: `Bearer ${tokenPayload.access_token}`,
        },
      });
      if (!userInfoResponse.ok) {
        throw new Error('provider_userinfo_failed');
      }
      const userInfoClaims = (await userInfoResponse.json()) as Record<string, unknown>;
      mergedClaims = {
        ...idTokenClaims,
        ...Object.fromEntries(Object.entries(userInfoClaims).map(([key, value]) => [key, String(value)])),
      };
    }

    return this.normalizer.normalize(mergedClaims);
  }

  private async verifyIdToken(token: string, discovery: OidcDiscoveryDocument, expectedNonce?: string): Promise<Record<string, string>> {
    const response = await this.fetchImpl(discovery.jwks_uri);
    if (!response.ok) {
      throw new Error('provider_jwks_failed');
    }

    const jwks = (await response.json()) as { keys: PublicRsaJsonWebKey[] };
    const header = JSON.parse(Buffer.from(toBase64(token.split('.')[0] ?? ''), 'base64').toString('utf8')) as { kid?: string };
    const jwk = jwks.keys.find((key) => key.kid === header.kid);
    if (!jwk) {
      throw new Error('provider_signing_key_missing');
    }

    const verified = verifyJwtWithJwk(token, jwk, {
      issuer: discovery.issuer,
      audience: this.configuration.clientId,
      requireTyp: 'JWT',
    });

    if (expectedNonce && verified.payload.nonce !== expectedNonce) {
      throw new Error('provider_nonce_mismatch');
    }

    return Object.fromEntries(Object.entries(verified.payload).map(([key, value]) => [key, String(value)]));
  }

  private async getDiscovery(): Promise<OidcDiscoveryDocument> {
    const response = await this.fetchImpl(`${this.configuration.issuer}/.well-known/openid-configuration`);
    if (!response.ok) {
      throw new Error('provider_discovery_failed');
    }

    return (await response.json()) as OidcDiscoveryDocument;
  }
}

export function createGoogleOidcAdapter(
  configuration: Omit<OidcProviderConfiguration, 'provider'>,
  normalizer: CallbackNormalizer,
  fetchImpl?: typeof fetch,
): GoogleOidcAdapter {
  return new GenericOidcBrokerAdapter({ ...configuration, provider: 'google' }, normalizer, fetchImpl) as GoogleOidcAdapter;
}

export function createEntraOidcAdapter(
  configuration: Omit<OidcProviderConfiguration, 'provider'>,
  normalizer: CallbackNormalizer,
  fetchImpl?: typeof fetch,
): EntraOidcAdapter {
  return new GenericOidcBrokerAdapter({ ...configuration, provider: 'entra' }, normalizer, fetchImpl) as EntraOidcAdapter;
}

function toBase64(value: string): string {
  return value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
}
