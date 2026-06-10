import type { CallbackNormalizer, ProviderProfile } from './provider.js';

export class OidcCallbackNormalizer implements CallbackNormalizer {
  constructor(private readonly providerName: 'google' | 'entra') {}

  normalize(claims: Record<string, string>): ProviderProfile {
    const subject = claims.sub;
    if (!subject) {
      throw new Error('provider_subject_missing');
    }

    return {
      providerName: this.providerName,
      subject,
      email: claims.email,
      emailVerified: claims.email_verified === 'true',
      displayName: claims.name,
      givenName: claims.given_name,
      familyName: claims.family_name,
      picture: claims.picture,
      claims,
    };
  }
}
