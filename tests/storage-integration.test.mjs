import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sha256Hex } from '../dist/packages/crypto/src/index.js';
import {
  closeStorageAdapterConnections,
  MongoClientRepository,
  MongoSigningKeyRepository,
  RedisRefreshTokenRepository,
  RedisSessionRepository,
} from '../dist/packages/storage/src/index.js';

const mongoUri = process.env.PUBAUTH_TEST_MONGO_URI;
const redisUrl = process.env.PUBAUTH_TEST_REDIS_URL;

test.after(async () => {
  await closeStorageAdapterConnections();
});

test(
  'mongo adapters persist clients and signing keys when docker-backed services are available',
  { skip: !mongoUri },
  async () => {
    const dbName = `pubauth_test_${randomUUID().replace(/-/g, '')}`;
    const clientRepository = new MongoClientRepository({ uri: mongoUri, dbName });
    const signingKeyRepository = new MongoSigningKeyRepository({ uri: mongoUri, dbName });

    await clientRepository.save({
      id: 'client-1',
      productId: 'product-1',
      workspaceId: 'workspace-1',
      clientId: 'mongo-client',
      clientType: 'confidential',
      tokenEndpointAuthMethod: 'client_secret_basic',
      clientSecretHash: 'hashed-secret',
      allowedRedirectUris: ['http://localhost/callback'],
      logoutRedirectUris: [],
      allowedScopes: ['openid', 'profile'],
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    await signingKeyRepository.save({
      keyId: 'mongo-key',
      algorithm: 'RS256',
      publicKeyPem: 'public-key',
      privateKeyPem: 'private-key',
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    const storedClient = await clientRepository.findByClientId('mongo-client');
    const activeKey = await signingKeyRepository.getActiveKey();
    assert.equal(storedClient?.workspaceId, 'workspace-1');
    assert.equal(activeKey.keyId, 'mongo-key');
  },
);

test(
  'redis adapters persist sessions and hashed refresh tokens when docker-backed services are available',
  { skip: !redisUrl },
  async () => {
    const keyPrefix = `pubauth:test:${randomUUID()}:`;
    const sessionRepository = new RedisSessionRepository({ url: redisUrl, keyPrefix });
    const refreshTokenRepository = new RedisRefreshTokenRepository({ url: redisUrl, keyPrefix });
    const refreshToken = 'refresh-token-value';

    await sessionRepository.save({
      id: 'session-1',
      subjectId: 'user-1',
      workspaceId: 'workspace-1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await refreshTokenRepository.save({
      refreshTokenHash: sha256Hex(refreshToken),
      familyId: 'family-1',
      subjectId: 'user-1',
      clientId: 'client-1',
      workspaceId: 'workspace-1',
      scopes: ['openid'],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const session = await sessionRepository.getById('session-1');
    const token = await refreshTokenRepository.find(refreshToken);
    assert.equal(session?.workspaceId, 'workspace-1');
    assert.equal(token?.familyId, 'family-1');
  },
);
