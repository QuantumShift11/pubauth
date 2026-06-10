import { createSign, createVerify } from 'node:crypto';
import { base64UrlEncode } from '../../crypto/src/index.js';
import type { JwtClaims, JwtSigner, JwtVerifier } from './jwt-signer.js';

export interface PemJwtSignerOptions {
  issuer: string;
  keyId: string;
  privateKeyPem: string;
  algorithm?: 'RS256';
}

export interface PemJwtVerifierOptions {
  issuer: string;
  audience?: string;
  publicKeyPem: string;
  algorithm?: 'RS256';
}

export class PemJwtSigner implements JwtSigner {
  constructor(private readonly options: PemJwtSignerOptions) {}

  async sign(claims: JwtClaims): Promise<string> {
    const header = {
      alg: this.options.algorithm ?? 'RS256',
      typ: 'JWT',
      kid: this.options.keyId,
    };

    const encodedHeader = encodeJson(header);
    const encodedPayload = encodeJson(claims);
    const input = `${encodedHeader}.${encodedPayload}`;
    const signature = createSign('RSA-SHA256').update(input).sign(this.options.privateKeyPem);

    return `${input}.${base64UrlEncode(signature)}`;
  }
}

export class PemJwtVerifier implements JwtVerifier {
  constructor(private readonly options: PemJwtVerifierOptions) {}

  async verify(token: string): Promise<JwtClaims> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('invalid_token');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = decodeJson(encodedHeader) as { alg?: string };
    if (header.alg !== (this.options.algorithm ?? 'RS256')) {
      throw new Error('invalid_algorithm');
    }

    const signature = Buffer.from(toBase64(encodedSignature), 'base64');
    const valid = createVerify('RSA-SHA256')
      .update(`${encodedHeader}.${encodedPayload}`)
      .verify(this.options.publicKeyPem, signature);

    if (!valid) {
      throw new Error('invalid_signature');
    }

    const claims = decodeJson(encodedPayload) as JwtClaims;
    const now = Math.floor(Date.now() / 1000);

    if (claims.iss !== this.options.issuer) {
      throw new Error('invalid_issuer');
    }

    if (claims.exp <= now) {
      throw new Error('token_expired');
    }

    if (this.options.audience) {
      const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (!audiences.includes(this.options.audience)) {
        throw new Error('invalid_audience');
      }
    }

    return claims;
  }
}

function encodeJson(value: unknown): string {
  return base64UrlEncode(JSON.stringify(value));
}

function decodeJson(value: string): unknown {
  return JSON.parse(Buffer.from(toBase64(value), 'base64').toString('utf8'));
}

function toBase64(value: string): string {
  return value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
}
