import { randomUUID } from 'node:crypto';
import { RsaJwtSigner, type JwtSigner, type JwtVerifyOptions, type PublicJsonWebKey, type VerifiedJwt } from '../../crypto/src/index.js';
import type { SigningKeyRepository } from '../../storage/src/index.js';
import type { StoredSigningKey } from '../../storage/src/pubauth-state.js';

export interface SigningKeyService extends JwtSigner {
  reload(): Promise<void>;
}

export async function createSigningKeyService(
  repository: SigningKeyRepository<StoredSigningKey>,
  issuer: string,
): Promise<SigningKeyService> {
  let keys = await repository.listPublicKeys();
  if (keys.length === 0) {
    const generated = RsaJwtSigner.generateWithMaterial(issuer, `pubauth-rsa-${randomUUID().slice(0, 8)}`);
    const now = new Date().toISOString();
    const activeKey: StoredSigningKey = {
      keyId: generated.signer.keyId,
      algorithm: 'RS256',
      publicKeyPem: generated.publicKeyPem,
      privateKeyPem: generated.privateKeyPem,
      status: 'active',
      createdAt: now,
    };
    await repository.save(activeKey);
    keys = [activeKey];
  }

  let signerState = buildKeyState(keys, issuer);

  return {
    get keyId() {
      return signerState.activeKey.keyId;
    },
    issuer,
    sign: (options) => signerState.sign(options),
    verify: (token, options) => signerState.verify(token, options),
    jwks: () => signerState.jwks(),
    reload: async () => {
      const refreshed = await repository.listPublicKeys();
      signerState = buildKeyState(refreshed.length > 0 ? refreshed : keys, issuer);
      keys = refreshed.length > 0 ? refreshed : keys;
    },
  };
}

function buildKeyState(keys: StoredSigningKey[], issuer: string) {
  const usableKeys = keys.filter((key) => key.status !== 'disabled');
  const activeKey = usableKeys.find((key) => key.status === 'active') ?? usableKeys[0];
  if (!activeKey) {
    throw new Error('signing_key_not_found');
  }

  const jwksKeys = usableKeys.map(toPublicJwk);
  const signers = new Map(
    usableKeys.map((key) => [
      key.keyId,
      RsaJwtSigner.fromPublicPem(issuer, key.keyId, key.publicKeyPem),
    ]),
  );
  const activeSigner = RsaJwtSigner.fromPem(issuer, activeKey.keyId, activeKey.privateKeyPem, activeKey.publicKeyPem);

  return {
    activeKey,
    sign: activeSigner.sign.bind(activeSigner),
    verify(token: string, options: JwtVerifyOptions = {}): VerifiedJwt {
      const header = decodeJwtHeader(token);
      if (header.alg !== 'RS256') {
        throw new Error('invalid_token_algorithm');
      }

      if (header.typ !== 'JWT') {
        throw new Error('invalid_token_type');
      }

      if (typeof header.kid !== 'string' || !signers.has(header.kid)) {
        throw new Error('invalid_token_key');
      }

      const verifier = signers.get(header.kid);
      if (!verifier) {
        throw new Error('invalid_token_key');
      }

      return verifier.verify(token, {
        ...options,
        requireTyp: 'JWT',
      });
    },
    jwks(): { keys: PublicJsonWebKey[] } {
      return { keys: jwksKeys };
    },
  };
}

function toPublicJwk(key: StoredSigningKey): PublicJsonWebKey {
  const jwk = RsaJwtSigner.fromPublicPem('unused', key.keyId, key.publicKeyPem).jwks().keys[0];
  return {
    kty: jwk.kty,
    kid: key.keyId,
    use: 'sig',
    alg: 'RS256',
    n: jwk.n,
    e: jwk.e,
  };
}

function decodeJwtHeader(token: string): Record<string, unknown> {
  const [encodedHeader] = token.split('.');
  if (!encodedHeader) {
    throw new Error('invalid_token_format');
  }
  return JSON.parse(Buffer.from(toBase64(encodedHeader), 'base64').toString('utf8')) as Record<string, unknown>;
}

function toBase64(value: string): string {
  return value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
}
