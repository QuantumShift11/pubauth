import type { JsonFileStore } from './json-file-store.js';
import { sha256Hex } from '../../crypto/src/index.js';
import type {
  PubAuthState,
  StoredAccessToken,
  StoredAuthorizationCode,
  StoredAuthSession,
  StoredAuditEvent,
  StoredOidcClient,
  StoredProduct,
  StoredProviderLink,
  StoredRefreshToken,
  StoredRole,
  StoredRoutePolicy,
  StoredSigningKey,
  StoredUserAccount,
  StoredWorkspace,
  StoredAssignment,
  StoredBrokerState,
} from './pubauth-state.js';

export interface ClientRepository<TClient = unknown> {
  findByClientId(clientId: string): Promise<TClient | null>;
  list(): Promise<TClient[]>;
  save(client: TClient): Promise<void>;
}

export interface ProductRepository<TProduct = unknown> {
  list(): Promise<TProduct[]>;
  findById(id: string): Promise<TProduct | null>;
  findBySlug(slug: string): Promise<TProduct | null>;
  save(product: TProduct): Promise<void>;
}

export interface WorkspaceRepository<TWorkspace = unknown> {
  list(): Promise<TWorkspace[]>;
  findBySlug(slug: string): Promise<TWorkspace | null>;
  save(workspace: TWorkspace): Promise<void>;
}

export interface RoutePolicyRepository<TRoutePolicy = unknown> {
  list(): Promise<TRoutePolicy[]>;
  findById(id: string): Promise<TRoutePolicy | null>;
  save(policy: TRoutePolicy): Promise<void>;
}

export interface RoleRepository<TRole = unknown> {
  list(): Promise<TRole[]>;
  findByName(name: string): Promise<TRole | null>;
  save(role: TRole): Promise<void>;
}

export interface AssignmentRepository<TAssignment = unknown> {
  list(): Promise<TAssignment[]>;
  save(assignment: TAssignment): Promise<void>;
}

export interface UserRepository<TUser = unknown> {
  list(): Promise<TUser[]>;
  findById(id: string): Promise<TUser | null>;
  findByUsername(username: string): Promise<TUser | null>;
  findByEmail(email: string): Promise<TUser | null>;
  findBySubjectId(subjectId: string): Promise<TUser | null>;
  save(user: TUser): Promise<void>;
}

export interface ProviderLinkRepository<TProviderLink = unknown> {
  list(): Promise<TProviderLink[]>;
  findByProviderSubject(provider: string, providerSubject: string): Promise<TProviderLink | null>;
  save(link: TProviderLink): Promise<void>;
}

export interface BrokerStateRepository<TBrokerState = unknown> {
  save(state: TBrokerState): Promise<void>;
  consume(state: string, now: Date): Promise<TBrokerState | null>;
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
  revokeFamily(familyId: string, now: Date): Promise<void>;
}

export interface SessionRepository<TSession = unknown> {
  getById(id: string): Promise<TSession | null>;
  list(): Promise<TSession[]>;
  save(session: TSession): Promise<void>;
  revoke(id: string, reason: string): Promise<void>;
}

export interface SigningKeyRepository<TSigningKey = unknown> {
  getActiveKey(): Promise<TSigningKey>;
  listPublicKeys(): Promise<TSigningKey[]>;
  save(key: TSigningKey): Promise<void>;
}

export interface AuditRepository<TAuditEvent = unknown> {
  append(event: TAuditEvent): Promise<void>;
  listRecent(limit: number): Promise<TAuditEvent[]>;
}

export class FileClientRepository implements ClientRepository<StoredOidcClient> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async findByClientId(clientId: string): Promise<StoredOidcClient | null> {
    const state = await this.store.read();
    return state.clients.find((item) => item.clientId === clientId && item.isActive) ?? null;
  }

  async list(): Promise<StoredOidcClient[]> {
    const state = await this.store.read();
    return [...state.clients];
  }

  async save(client: StoredOidcClient): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      clients: upsertById(state.clients, client),
    }));
  }
}

export class FileProductRepository implements ProductRepository<StoredProduct> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async list(): Promise<StoredProduct[]> {
    const state = await this.store.read();
    return [...state.products];
  }

  async findById(id: string): Promise<StoredProduct | null> {
    const state = await this.store.read();
    return state.products.find((item) => item.id === id) ?? null;
  }

  async findBySlug(slug: string): Promise<StoredProduct | null> {
    const state = await this.store.read();
    return state.products.find((item) => item.slug === slug) ?? null;
  }

  async save(product: StoredProduct): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      products: upsertById(state.products, product),
    }));
  }
}

export class FileWorkspaceRepository implements WorkspaceRepository<StoredWorkspace> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async list(): Promise<StoredWorkspace[]> {
    const state = await this.store.read();
    return [...state.workspaces];
  }

  async findBySlug(slug: string): Promise<StoredWorkspace | null> {
    const state = await this.store.read();
    return state.workspaces.find((item) => item.slug === slug) ?? null;
  }

  async save(workspace: StoredWorkspace): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      workspaces: upsertById(state.workspaces, workspace),
    }));
  }
}

export class FileRoutePolicyRepository implements RoutePolicyRepository<StoredRoutePolicy> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async list(): Promise<StoredRoutePolicy[]> {
    const state = await this.store.read();
    return [...state.routePolicies];
  }

  async findById(id: string): Promise<StoredRoutePolicy | null> {
    const state = await this.store.read();
    return state.routePolicies.find((item) => item.id === id) ?? null;
  }

  async save(policy: StoredRoutePolicy): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      routePolicies: upsertById(state.routePolicies, policy),
    }));
  }
}

export class FileRoleRepository implements RoleRepository<StoredRole> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async list(): Promise<StoredRole[]> {
    const state = await this.store.read();
    return [...state.roles];
  }

  async findByName(name: string): Promise<StoredRole | null> {
    const state = await this.store.read();
    return state.roles.find((item) => item.name === name) ?? null;
  }

  async save(role: StoredRole): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      roles: upsertById(state.roles, role),
    }));
  }
}

export class FileAssignmentRepository implements AssignmentRepository<StoredAssignment> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async list(): Promise<StoredAssignment[]> {
    const state = await this.store.read();
    return [...state.assignments];
  }

  async save(assignment: StoredAssignment): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      assignments: upsertById(state.assignments, assignment),
    }));
  }
}

export class FileUserRepository implements UserRepository<StoredUserAccount> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async list(): Promise<StoredUserAccount[]> {
    const state = await this.store.read();
    return [...state.users];
  }

  async findById(id: string): Promise<StoredUserAccount | null> {
    const state = await this.store.read();
    return state.users.find((item) => item.id === id) ?? null;
  }

  async findByUsername(username: string): Promise<StoredUserAccount | null> {
    const state = await this.store.read();
    return state.users.find((item) => item.username === username && item.status === 'active') ?? null;
  }

  async findByEmail(email: string): Promise<StoredUserAccount | null> {
    const state = await this.store.read();
    return state.users.find((item) => item.email.toLowerCase() === email.toLowerCase() && item.status === 'active') ?? null;
  }

  async findBySubjectId(subjectId: string): Promise<StoredUserAccount | null> {
    const state = await this.store.read();
    return state.users.find((item) => item.subjectId === subjectId && item.status === 'active') ?? null;
  }

  async save(user: StoredUserAccount): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      users: upsertById(state.users, user),
    }));
  }
}

export class FileProviderLinkRepository implements ProviderLinkRepository<StoredProviderLink> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async list(): Promise<StoredProviderLink[]> {
    const state = await this.store.read();
    return [...state.providerLinks];
  }

  async findByProviderSubject(provider: string, providerSubject: string): Promise<StoredProviderLink | null> {
    const state = await this.store.read();
    return state.providerLinks.find((item) => item.provider === provider && item.providerSubject === providerSubject) ?? null;
  }

  async save(link: StoredProviderLink): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      providerLinks: upsertById(state.providerLinks, link),
    }));
  }
}

export class FileBrokerStateRepository implements BrokerStateRepository<StoredBrokerState> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async save(brokerState: StoredBrokerState): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      brokerStates: upsertByKey(state.brokerStates, brokerState, (item) => item.state),
    }));
  }

  async consume(brokerState: string, now = new Date()): Promise<StoredBrokerState | null> {
    const state = await this.store.read();
    const record = state.brokerStates.find((item) => item.state === brokerState) ?? null;
    if (!record || !isTimeInFuture(record.expiresAt, now)) {
      return null;
    }

    await this.store.update((current) => ({
      ...current,
      brokerStates: current.brokerStates.filter((item) => item.state !== brokerState),
    }));
    return record;
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
    if (!token || token.revokedAt || !isTimeInFuture(token.expiresAt, now)) {
      return null;
    }
    return token;
  }

  async revoke(accessToken: string, now = new Date()): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      accessTokens: state.accessTokens.map((item) =>
        item.accessToken === accessToken ? { ...item, revokedAt: now.toISOString() } : item,
      ),
    }));
  }
}

export class FileRefreshTokenRepository implements RefreshTokenRepository<StoredRefreshToken> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async save(token: StoredRefreshToken): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      refreshTokens: upsertByKey(state.refreshTokens, token, (item) => item.refreshTokenHash),
    }));
  }

  async find(refreshToken: string, now = new Date()): Promise<StoredRefreshToken | null> {
    const refreshTokenHash = sha256Hex(refreshToken);
    const state = await this.store.read();
    const token = state.refreshTokens.find((item) => item.refreshTokenHash === refreshTokenHash) ?? null;
    if (!token || !isTimeInFuture(token.expiresAt, now)) {
      return null;
    }
    return token;
  }

  async revoke(refreshToken: string, now = new Date()): Promise<void> {
    const refreshTokenHash = sha256Hex(refreshToken);
    await this.store.update((state) => ({
      ...state,
      refreshTokens: state.refreshTokens.map((item) =>
        item.refreshTokenHash === refreshTokenHash ? { ...item, revokedAt: now.toISOString() } : item,
      ),
    }));
  }

  async revokeFamily(familyId: string, now = new Date()): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      refreshTokens: state.refreshTokens.map((item) =>
        item.familyId === familyId ? { ...item, revokedAt: now.toISOString() } : item,
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

  async list(): Promise<StoredAuthSession[]> {
    const state = await this.store.read();
    return [...state.sessions];
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

export class FileSigningKeyRepository implements SigningKeyRepository<StoredSigningKey> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async getActiveKey(): Promise<StoredSigningKey> {
    const state = await this.store.read();
    const activeKey = state.signingKeys.find((item) => item.status === 'active') ?? state.signingKeys[0];
    if (!activeKey) {
      throw new Error('signing_key_not_found');
    }
    return activeKey;
  }

  async listPublicKeys(): Promise<StoredSigningKey[]> {
    const state = await this.store.read();
    return state.signingKeys;
  }

  async save(key: StoredSigningKey): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      signingKeys: upsertByKey(state.signingKeys, key, (item) => item.keyId),
    }));
  }
}

export class FileAuditRepository implements AuditRepository<StoredAuditEvent> {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async append(event: StoredAuditEvent): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      auditEvents: [...state.auditEvents, event],
    }));
  }

  async listRecent(limit: number): Promise<StoredAuditEvent[]> {
    const state = await this.store.read();
    return state.auditEvents.slice(-Math.max(limit, 0)).reverse();
  }
}

export interface MongoRepositoryOptions {
  uri: string;
  dbName: string;
  collectionName?: string;
}

export class MongoClientRepository implements ClientRepository<StoredOidcClient> {
  constructor(private readonly options: MongoRepositoryOptions) {}

  async findByClientId(clientId: string): Promise<StoredOidcClient | null> {
    const collection = await getMongoCollection<StoredOidcClient>(this.options, 'clients');
    return collection.findOne({ clientId, isActive: true });
  }

  async list(): Promise<StoredOidcClient[]> {
    const collection = await getMongoCollection<StoredOidcClient>(this.options, 'clients');
    return collection.find({}).toArray();
  }

  async save(client: StoredOidcClient): Promise<void> {
    const collection = await getMongoCollection<StoredOidcClient>(this.options, 'clients');
    await collection.updateOne({ id: client.id }, { $set: client }, { upsert: true });
  }
}

export class MongoAuthorizationCodeRepository implements AuthorizationCodeRepository<StoredAuthorizationCode> {
  constructor(private readonly options: MongoRepositoryOptions) {}

  async save(code: StoredAuthorizationCode): Promise<void> {
    const collection = await getMongoCollection<StoredAuthorizationCode>(this.options, 'authorizationCodes');
    await collection.updateOne({ codeHash: code.codeHash }, { $set: code }, { upsert: true });
  }

  async findUsable(codeHash: string, now = new Date()): Promise<StoredAuthorizationCode | null> {
    const collection = await getMongoCollection<StoredAuthorizationCode>(this.options, 'authorizationCodes');
    return collection.findOne({
      codeHash,
      usedAt: { $exists: false },
      expiresAt: { $gt: now.toISOString() },
    });
  }

  async markUsed(codeHash: string, now = new Date()): Promise<void> {
    const collection = await getMongoCollection<StoredAuthorizationCode>(this.options, 'authorizationCodes');
    await collection.updateOne({ codeHash }, { $set: { usedAt: now.toISOString() } });
  }

  async consume(codeHash: string, now = new Date()): Promise<StoredAuthorizationCode | null> {
    const collection = await getMongoCollection<StoredAuthorizationCode>(this.options, 'authorizationCodes');
    const result = await collection.findOneAndUpdate(
      {
        codeHash,
        usedAt: { $exists: false },
        expiresAt: { $gt: now.toISOString() },
      },
      { $set: { usedAt: now.toISOString() } },
      { returnDocument: 'before' },
    );
    return result;
  }
}

export class MongoAccessTokenRepository implements AccessTokenRepository<StoredAccessToken> {
  constructor(private readonly options: MongoRepositoryOptions) {}

  async save(token: StoredAccessToken): Promise<void> {
    const collection = await getMongoCollection<StoredAccessToken>(this.options, 'accessTokens');
    await collection.updateOne({ accessToken: token.accessToken }, { $set: token }, { upsert: true });
  }

  async find(accessToken: string, now = new Date()): Promise<StoredAccessToken | null> {
    const collection = await getMongoCollection<StoredAccessToken>(this.options, 'accessTokens');
    return collection.findOne({
      accessToken,
      revokedAt: { $exists: false },
      expiresAt: { $gt: now.toISOString() },
    });
  }

  async revoke(accessToken: string, now = new Date()): Promise<void> {
    const collection = await getMongoCollection<StoredAccessToken>(this.options, 'accessTokens');
    await collection.updateOne({ accessToken }, { $set: { revokedAt: now.toISOString() } });
  }
}

export interface RedisRepositoryOptions {
  url: string;
  keyPrefix?: string;
}

export class RedisRefreshTokenRepository implements RefreshTokenRepository<StoredRefreshToken> {
  constructor(private readonly options: RedisRepositoryOptions) {}

  async save(token: StoredRefreshToken): Promise<void> {
    const client = await getRedisClient(this.options);
    await client.set(this.keyForHash(token.refreshTokenHash), JSON.stringify(token));
  }

  async find(refreshToken: string, now = new Date()): Promise<StoredRefreshToken | null> {
    const client = await getRedisClient(this.options);
    const payload = await client.get(this.keyForHash(sha256Hex(refreshToken)));
    if (!payload) {
      return null;
    }
    const token = JSON.parse(payload) as StoredRefreshToken;
    if (!isTimeInFuture(token.expiresAt, now)) {
      return null;
    }
    return token;
  }

  async revoke(refreshToken: string, now = new Date()): Promise<void> {
    const token = await this.find(refreshToken, now);
    if (!token) {
      return;
    }
    await this.save({ ...token, revokedAt: now.toISOString() });
  }

  async revokeFamily(familyId: string, now = new Date()): Promise<void> {
    const client = await getRedisClient(this.options);
    const keys = await client.keys(`${this.prefix()}refresh:*`);
    for (const key of keys) {
      const payload = await client.get(key);
      if (!payload) {
        continue;
      }
      const token = JSON.parse(payload) as StoredRefreshToken;
      if (token.familyId === familyId) {
        await client.set(key, JSON.stringify({ ...token, revokedAt: now.toISOString() }));
      }
    }
  }

  private keyForHash(refreshTokenHash: string): string {
    return `${this.prefix()}refresh:${refreshTokenHash}`;
  }

  private prefix(): string {
    return this.options.keyPrefix ?? 'pubauth:';
  }
}

export class RedisSessionRepository implements SessionRepository<StoredAuthSession> {
  constructor(private readonly options: RedisRepositoryOptions) {}

  async getById(id: string): Promise<StoredAuthSession | null> {
    const client = await getRedisClient(this.options);
    const payload = await client.get(this.key(id));
    return payload ? (JSON.parse(payload) as StoredAuthSession) : null;
  }

  async list(): Promise<StoredAuthSession[]> {
    const client = await getRedisClient(this.options);
    const keys = await client.keys(`${this.prefix()}session:*`);
    const sessions: StoredAuthSession[] = [];
    for (const key of keys) {
      const payload = await client.get(key);
      if (payload) {
        sessions.push(JSON.parse(payload) as StoredAuthSession);
      }
    }
    return sessions;
  }

  async save(session: StoredAuthSession): Promise<void> {
    const client = await getRedisClient(this.options);
    await client.set(this.key(session.id), JSON.stringify(session));
  }

  async revoke(id: string): Promise<void> {
    const session = await this.getById(id);
    if (!session) {
      return;
    }
    await this.save({ ...session, revokedAt: new Date().toISOString() });
  }

  private key(id: string): string {
    return `${this.prefix()}session:${id}`;
  }

  private prefix(): string {
    return this.options.keyPrefix ?? 'pubauth:';
  }
}

export class MongoSigningKeyRepository implements SigningKeyRepository<StoredSigningKey> {
  constructor(private readonly options: MongoRepositoryOptions) {}

  async getActiveKey(): Promise<StoredSigningKey> {
    const collection = await getMongoCollection<StoredSigningKey>(this.options, 'signingKeys');
    const activeKey = await collection.findOne({ status: 'active' });
    if (!activeKey) {
      throw new Error('signing_key_not_found');
    }
    return activeKey;
  }

  async listPublicKeys(): Promise<StoredSigningKey[]> {
    const collection = await getMongoCollection<StoredSigningKey>(this.options, 'signingKeys');
    return collection.find({ status: { $ne: 'disabled' } }).toArray();
  }

  async save(key: StoredSigningKey): Promise<void> {
    const collection = await getMongoCollection<StoredSigningKey>(this.options, 'signingKeys');
    await collection.updateOne({ keyId: key.keyId }, { $set: key }, { upsert: true });
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

const mongoClientCache = new Map<string, Promise<any>>();
const redisClientCache = new Map<string, Promise<any>>();

async function getMongoCollection<T>(
  options: MongoRepositoryOptions,
  defaultCollectionName: string,
): Promise<any> {
  const { MongoClient } = await import('mongodb');
  const cacheKey = `${options.uri}:${options.dbName}`;
  if (!mongoClientCache.has(cacheKey)) {
    mongoClientCache.set(
      cacheKey,
      (async () => {
        const client = new MongoClient(options.uri);
        await client.connect();
        return client;
      })(),
    );
  }

  const client = await mongoClientCache.get(cacheKey);
  if (!client) {
    throw new Error('mongo_connection_failed');
  }

  return (await client).db(options.dbName).collection(options.collectionName ?? defaultCollectionName);
}

async function getRedisClient(options: RedisRepositoryOptions): Promise<any> {
  const { createClient } = await import('redis');
  const cacheKey = options.url;
  if (!redisClientCache.has(cacheKey)) {
    redisClientCache.set(
      cacheKey,
      (async () => {
        const client = createClient({ url: options.url });
        await client.connect();
        return client;
      })(),
    );
  }

  const client = await redisClientCache.get(cacheKey);
  if (!client) {
    throw new Error('redis_connection_failed');
  }

  return client;
}

export async function closeStorageAdapterConnections(): Promise<void> {
  for (const clientPromise of mongoClientCache.values()) {
    const client = await clientPromise;
    await client.close();
  }
  mongoClientCache.clear();

  for (const clientPromise of redisClientCache.values()) {
    const client = await clientPromise;
    await client.quit();
  }
  redisClientCache.clear();
}
