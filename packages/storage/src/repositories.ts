import type { JsonFileStore } from './json-file-store.js';
import type {
  PubAuthState,
  StoredAccessToken,
  StoredAuthorizationCode,
  StoredAuthSession,
  StoredOidcClient,
  StoredRefreshToken,
  StoredSigningKey,
} from './pubauth-state.js';

export interface ClientRepository<TClient = unknown> {
  findByClientId(clientId: string): Promise<TClient | null>;
  save(client: TClient): Promise<void>;
}

export interface AuthorizationCodeRepository<TAuthorizationCode = unknown> {
  save(code: TAuthorizationCode): Promise<void>;
  findUsable(codeHash: string, now: Date): Promise<TAuthorizationCode | null>;
  markUsed(codeHash: string, now: Date): Promise<void>;
  consume(codeHash: string, now: Date): Promise<TAuthorizationCode | null>;
}

export interface AccessTokenRepository<TAccessToken = unknown> {
  save(token: TAccessToken): Promise<void>;
  find(accessToken: string, now: Date): Promise<TAccessToken | null>;
  revoke(accessToken: string, now: Date): Promise<void>;
}

export interface RefreshTokenRepository<TRefreshToken = unknown> {
  save(token: TRefreshToken): Promise<void>;
  find(refreshToken: string, now: Date): Promise<TRefreshToken | null>;
  revoke(refreshToken: string, now: Date): Promise<void>;
}

export interface SessionRepository<TSession = unknown> {
  getById(id: string): Promise<TSession | null>;
  save(session: TSession): Promise<void>;
  revoke(id: string, reason: string): Promise<void>;
}

export interface SigningKeyRepository<TSigningKey = unknown> {
  getActiveKey(): Promise<TSigningKey>;
  listPublicKeys(): Promise<TSigningKey[]>;
}

export class FileClientRepository implements ClientRepository<StoredOidcClient> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async findByClientId(clientId: string): Promise<StoredOidcClient | null> {
    const state = await this.store.read();
    return state.clients.find((item) => item.clientId === clientId && item.isActive) ?? null;
  }

  async save(client: StoredOidcClient): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      clients: upsertById(state.clients, client),
    }));
  }
}

export class FileAuthorizationCodeRepository implements AuthorizationCodeRepository<StoredAuthorizationCode> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async save(code: StoredAuthorizationCode): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      authorizationCodes: upsertByKey(state.authorizationCodes, code, (item) => item.codeHash),
    }));
  }

  async findUsable(codeHash: string, now = new Date()): Promise<StoredAuthorizationCode | null> {
    const state = await this.store.read();
    const code = state.authorizationCodes.find((item) => item.codeHash === codeHash) ?? null;
    if (!code || !isTimeInFuture(code.expiresAt, now) || Boolean(code.usedAt)) {
      return null;
    }
    return code;
  }

  async markUsed(codeHash: string, now = new Date()): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      authorizationCodes: state.authorizationCodes.map((item) =>
        item.codeHash === codeHash ? { ...item, usedAt: now.toISOString() } : item,
      ),
    }));
  }

  async consume(codeHash: string, now = new Date()): Promise<StoredAuthorizationCode | null> {
    const code = await this.findUsable(codeHash, now);
    if (!code) {
      return null;
    }
    await this.markUsed(codeHash, now);
    return code;
  }
}

export class FileAccessTokenRepository implements AccessTokenRepository<StoredAccessToken> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async save(token: StoredAccessToken): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      accessTokens: upsertByKey(state.accessTokens, token, (item) => item.accessToken),
    }));
  }

  async find(accessToken: string, now = new Date()): Promise<StoredAccessToken | null> {
    const state = await this.store.read();
    const token = state.accessTokens.find((item) => item.accessToken === accessToken) ?? null;
    if (!token || !isTimeInFuture(token.expiresAt, now)) {
      return null;
    }
    return token;
  }

  async revoke(accessToken: string): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      accessTokens: state.accessTokens.filter((item) => item.accessToken !== accessToken),
    }));
  }
}

export class FileRefreshTokenRepository implements RefreshTokenRepository<StoredRefreshToken> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async save(token: StoredRefreshToken): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      refreshTokens: upsertByKey(state.refreshTokens, token, (item) => item.refreshToken),
    }));
  }

  async find(refreshToken: string, now = new Date()): Promise<StoredRefreshToken | null> {
    const state = await this.store.read();
    const token = state.refreshTokens.find((item) => item.refreshToken === refreshToken) ?? null;
    if (!token || token.revokedAt || !isTimeInFuture(token.expiresAt, now)) {
      return null;
    }
    return token;
  }

  async revoke(refreshToken: string, now = new Date()): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      refreshTokens: state.refreshTokens.map((item) =>
        item.refreshToken === refreshToken ? { ...item, revokedAt: now.toISOString() } : item,
      ),
    }));
  }
}

export class FileSessionRepository implements SessionRepository<StoredAuthSession> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async getById(id: string): Promise<StoredAuthSession | null> {
    const state = await this.store.read();
    return state.sessions.find((item) => item.id === id) ?? null;
  }

  async save(session: StoredAuthSession): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      sessions: upsertByKey(state.sessions, session, (item) => item.id),
    }));
  }

  async revoke(id: string, reason: string): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      sessions: state.sessions.map((item) => (item.id === id ? { ...item, revokedAt: new Date().toISOString() } : item)),
    }));
  }
}

export interface PublicStoredSigningKey extends Omit<StoredSigningKey, 'privateKeyPem'> {}

export class FileSigningKeyRepository implements SigningKeyRepository<PublicStoredSigningKey> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async getActiveKey(): Promise<PublicStoredSigningKey> {
    const state = await this.store.read();
    const activeKey = state.signingKeys.find((item) => item.status === 'active') ?? state.signingKeys[0];
    if (!activeKey) {
      throw new Error('signing_key_not_found');
    }
    const { privateKeyPem: _privateKeyPem, ...publicKey } = activeKey;
    return publicKey;
  }

  async listPublicKeys(): Promise<PublicStoredSigningKey[]> {
    const state = await this.store.read();
    return state.signingKeys.map(({ privateKeyPem: _privateKeyPem, ...publicKey }) => publicKey);
  }
}

export class MongoClientRepository implements ClientRepository {
  async findByClientId(): Promise<null> {
    throw new Error('mongo_client_repository_not_implemented');
  }

  async save(): Promise<void> {
    throw new Error('mongo_client_repository_not_implemented');
  }
}

export class MongoAuthorizationCodeRepository implements AuthorizationCodeRepository {
  async save(): Promise<void> {
    throw new Error('mongo_authorization_code_repository_not_implemented');
  }

  async findUsable(): Promise<null> {
    throw new Error('mongo_authorization_code_repository_not_implemented');
  }

  async markUsed(): Promise<void> {
    throw new Error('mongo_authorization_code_repository_not_implemented');
  }

  async consume(): Promise<null> {
    throw new Error('mongo_authorization_code_repository_not_implemented');
  }
}

export class MongoAccessTokenRepository implements AccessTokenRepository {
  async save(): Promise<void> {
    throw new Error('mongo_access_token_repository_not_implemented');
  }

  async find(): Promise<null> {
    throw new Error('mongo_access_token_repository_not_implemented');
  }

  async revoke(): Promise<void> {
    throw new Error('mongo_access_token_repository_not_implemented');
  }
}

export class RedisRefreshTokenRepository implements RefreshTokenRepository {
  async save(): Promise<void> {
    throw new Error('redis_refresh_token_repository_not_implemented');
  }

  async find(): Promise<null> {
    throw new Error('redis_refresh_token_repository_not_implemented');
  }

  async revoke(): Promise<void> {
    throw new Error('redis_refresh_token_repository_not_implemented');
  }
}

export class RedisSessionRepository implements SessionRepository {
  async getById(): Promise<null> {
    throw new Error('redis_session_repository_not_implemented');
  }

  async save(): Promise<void> {
    throw new Error('redis_session_repository_not_implemented');
  }

  async revoke(): Promise<void> {
    throw new Error('redis_session_repository_not_implemented');
  }
}

export class MongoSigningKeyRepository implements SigningKeyRepository {
  async getActiveKey(): Promise<never> {
    throw new Error('mongo_signing_key_repository_not_implemented');
  }

  async listPublicKeys(): Promise<never[]> {
    throw new Error('mongo_signing_key_repository_not_implemented');
  }
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const next = items.filter((existing) => existing.id !== item.id);
  next.push(item);
  return next;
}

function upsertByKey<T>(items: T[], item: T, keySelector: (value: T) => string): T[] {
  const key = keySelector(item);
  const next = items.filter((existing) => keySelector(existing) !== key);
  next.push(item);
  return next;
}

function isTimeInFuture(value: string, now: Date): boolean {
  return new Date(value).getTime() > now.getTime();
}
