import { randomUUID } from 'node:crypto';
import { JsonFileStore, type PubAuthState } from '../../storage/src/index.js';
import type { AuthorizationCode, AuthorizationCodeStore } from './authorization-code.js';
import type { AccessTokenStore, IssuedAccessToken } from './token-store.js';
import type { OidcClient, OidcClientRepository } from './client.js';
import { isAuthorizationCodeUsable } from './authorization-code.js';

export class FileOidcClientRepository implements OidcClientRepository {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async findByClientId(clientId: string): Promise<OidcClient | null> {
    const state = await this.store.read();
    const client = state.clients.find((item) => item.clientId === clientId && item.isActive);
    return client
      ? {
          clientId: client.clientId,
          clientType: client.clientType,
          allowedRedirectUris: client.allowedRedirectUris,
          allowedScopes: client.allowedScopes,
          isActive: client.isActive,
        }
      : null;
  }

  async save(client: OidcClient): Promise<void> {
    await this.store.update((state) => {
      const next = state.clients.filter((item) => item.clientId !== client.clientId);
      next.push({
        id: `client-${client.clientId}`,
        productId: 'product-atlas',
        clientId: client.clientId,
        clientType: client.clientType,
        allowedRedirectUris: [...client.allowedRedirectUris],
        logoutRedirectUris: [],
        allowedScopes: [...client.allowedScopes],
        isActive: client.isActive,
        createdAt: new Date().toISOString(),
      });
      return { ...state, clients: next };
    });
  }
}

export class FileAuthorizationCodeStore implements AuthorizationCodeStore {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async save(code: AuthorizationCode): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      authorizationCodes: [...state.authorizationCodes.filter((item) => item.codeHash !== code.codeHash), code],
    }));
  }

  async findUsable(codeHash: string, now = new Date()): Promise<AuthorizationCode | null> {
    const state = await this.store.read();
    const code = state.authorizationCodes.find((item) => item.codeHash === codeHash) ?? null;
    if (!code || !isAuthorizationCodeUsable(code, now)) {
      return null;
    }
    return {
      ...code,
      workspaceId: code.workspaceId ?? 'dev-workspace',
    };
  }

  async markUsed(codeHash: string, now = new Date()): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      authorizationCodes: state.authorizationCodes.map((item) =>
        item.codeHash === codeHash ? { ...item, usedAt: now.toISOString() } : item,
      ),
    }));
  }

  async consume(codeHash: string, now = new Date()): Promise<AuthorizationCode | null> {
    const code = await this.findUsable(codeHash, now);
    if (!code) {
      return null;
    }
    await this.markUsed(codeHash, now);
    return code;
  }
}

export class FileAccessTokenStore implements AccessTokenStore {
  constructor(private readonly store: JsonFileStore<PubAuthState>) {}

  async save(token: IssuedAccessToken): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      accessTokens: [...state.accessTokens.filter((item) => item.accessToken !== token.accessToken), token],
    }));
  }

  async find(accessToken: string, now = new Date()): Promise<IssuedAccessToken | null> {
    const state = await this.store.read();
    const token = state.accessTokens.find((item) => item.accessToken === accessToken) ?? null;
    if (!token) {
      return null;
    }

    if (new Date(token.expiresAt).getTime() <= now.getTime()) {
      return null;
    }

    return {
      ...token,
      workspaceId: token.workspaceId ?? 'dev-workspace',
    };
  }
}

export async function resolveTokenClaims(
  store: JsonFileStore<PubAuthState>,
  request: { subjectId: string; workspaceId: string },
): Promise<Record<string, unknown>> {
  const state = await store.read();
  const roles = state.assignments
    .filter((assignment) => assignment.userId === request.subjectId)
    .filter((assignment) => !assignment.workspaceId || assignment.workspaceId === request.workspaceId)
    .map((assignment) => assignment.role);
  return {
    roles: [...new Set(roles)],
    groups: [],
  };
}

export function createDefaultClientRegistration(clientId: string) {
  return {
    id: randomUUID(),
    productId: 'product-atlas',
    clientId,
    clientType: 'public' as const,
    allowedRedirectUris: [],
    logoutRedirectUris: [],
    allowedScopes: ['openid'],
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}
