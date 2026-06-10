import {
  createPublicKey,
  createPrivateKey,
  createSign,
  createVerify,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto';
import { base64UrlEncode } from './base64url.js';

export interface PublicJsonWebKey {
  kty: string;
  kid: string;
  use: 'sig';
  alg: 'RS256';
  n?: string;
  e?: string;
}

export interface PublicRsaJsonWebKey extends PublicJsonWebKey {
  kty: 'RSA';
  n: string;
  e: string;
}

export interface JwtSignOptions {
  audience: string;
  subject: string;
  expiresInSeconds: number;
  claims?: Record<string, unknown>;
}

export interface JwtVerifyOptions {
  audience?: string;
  issuer?: string;
  now?: Date;
  requireTyp?: string;
  tokenUse?: string | string[];
}

export interface VerifiedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
}

export interface JwtSigner {
  readonly keyId: string;
  readonly issuer: string;
  sign(options: JwtSignOptions): string;
  verify(token: string, options?: JwtVerifyOptions): VerifiedJwt;
  jwks(): { keys: PublicJsonWebKey[] };
}

export class RsaJwtSigner implements JwtSigner {
  constructor(
    public readonly keyId: string,
    public readonly issuer: string,
    private readonly privateKey: KeyObject | string,
    private readonly publicKey: KeyObject | string,
  ) {}

  static generate(issuer: string, keyId = 'pubauth-rsa-key-1'): RsaJwtSigner {
    const { signer } = RsaJwtSigner.generateWithMaterial(issuer, keyId);
    return signer;
  }

  static generateWithMaterial(issuer: string, keyId = 'pubauth-rsa-key-1'): {
    signer: RsaJwtSigner;
    privateKeyPem: string;
    publicKeyPem: string;
  } {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { format: 'pem', type: 'spki' },
      privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    });

    return {
      signer: new RsaJwtSigner(keyId, issuer, privateKey, publicKey),
      privateKeyPem: privateKey,
      publicKeyPem: publicKey,
    };
  }

  static fromPem(issuer: string, keyId: string, privateKeyPem: string, publicKeyPem: string): RsaJwtSigner {
    return new RsaJwtSigner(keyId, issuer, privateKeyPem, publicKeyPem);
  }

  static fromPublicPem(issuer: string, keyId: string, publicKeyPem: string): RsaJwtSigner {
    return new RsaJwtSigner(keyId, issuer, publicKeyPem, publicKeyPem);
  }

  sign(options: JwtSignOptions): string {
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: this.keyId,
    };
    const payload = {
      iss: this.issuer,
      aud: options.audience,
      sub: options.subject,
      iat: now,
      exp: now + options.expiresInSeconds,
      ...(options.claims ?? {}),
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = createSign('RSA-SHA256').update(signingInput).sign(this.privateKeyObject);

    return `${signingInput}.${base64UrlEncode(signature)}`;
  }

  verify(token: string, options: JwtVerifyOptions = {}): VerifiedJwt {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new Error('invalid_token_format');
    }

    const header = parseBase64UrlJson(encodedHeader);
    if (header.alg !== 'RS256') {
      throw new Error('invalid_token_algorithm');
    }

    const expectedTyp = options.requireTyp ?? 'JWT';
    if (expectedTyp && header.typ !== expectedTyp) {
      throw new Error('invalid_token_type');
    }

    if (typeof header.kid !== 'string' || header.kid !== this.keyId) {
      throw new Error('invalid_token_key');
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = Buffer.from(toBase64(encodedSignature), 'base64');
    const valid = createVerify('RSA-SHA256').update(signingInput).verify(this.publicKeyObject, signature);

    if (!valid) {
      throw new Error('invalid_token_signature');
    }

    const payload = parseBase64UrlJson(encodedPayload);
    validateJwtPayload(payload, options);

    return { header, payload };
  }

  jwks(): { keys: PublicJsonWebKey[] } {
    const jwk = this.publicKeyObject.export({ format: 'jwk' }) as Record<string, string>;
    return {
      keys: [
        {
          kty: 'RSA',
          kid: this.keyId,
          use: 'sig',
          alg: 'RS256',
          n: jwk.n,
          e: jwk.e,
        },
      ],
    };
  }

  private get privateKeyObject(): KeyObject {
    return typeof this.privateKey === 'string' ? createPrivateKey(this.privateKey) : this.privateKey;
  }

  private get publicKeyObject(): KeyObject {
    return typeof this.publicKey === 'string' ? createPublicKey(this.publicKey) : this.publicKey;
  }
}

function parseBase64UrlJson(value: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(toBase64(value), 'base64').toString('utf8')) as Record<string, unknown>;
}

function toBase64(value: string): string {
  return value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
}

export function verifyJwtWithJwk(token: string, jwk: PublicRsaJsonWebKey, options: JwtVerifyOptions = {}): VerifiedJwt {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('invalid_token_format');
  }

  const header = parseBase64UrlJson(encodedHeader);
  if (header.alg !== 'RS256') {
    throw new Error('invalid_token_algorithm');
  }

  const expectedTyp = options.requireTyp ?? 'JWT';
  if (expectedTyp && header.typ !== expectedTyp) {
    throw new Error('invalid_token_type');
  }

  if (typeof header.kid !== 'string' || header.kid !== jwk.kid) {
    throw new Error('invalid_token_key');
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = Buffer.from(toBase64(encodedSignature), 'base64');
  const valid = createVerify('RSA-SHA256')
    .update(signingInput)
    .verify(createPublicKey({ key: jwk as any, format: 'jwk' } as any), signature);
  if (!valid) {
    throw new Error('invalid_token_signature');
  }

  const payload = parseBase64UrlJson(encodedPayload);
  validateJwtPayload(payload, options);
  return { header, payload };
}

function validateJwtPayload(payload: Record<string, unknown>, options: JwtVerifyOptions = {}): void {
  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);

  if (payload.exp && typeof payload.exp === 'number' && payload.exp <= now) {
    throw new Error('token_expired');
  }

  if (options.issuer && payload.iss !== options.issuer) {
    throw new Error('invalid_issuer');
  }

  if (options.audience && payload.aud !== options.audience) {
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audience.includes(options.audience)) {
      throw new Error('invalid_audience');
    }
  }

  if (options.tokenUse) {
    const tokenUseValues = Array.isArray(options.tokenUse) ? options.tokenUse : [options.tokenUse];
    if (!tokenUseValues.includes(String(payload.token_use ?? ''))) {
      throw new Error('invalid_token_use');
    }
  }
}
