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
