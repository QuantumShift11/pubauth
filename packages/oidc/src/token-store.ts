export interface IssuedAccessToken {
  accessToken: string;
  jti: string;
  subjectId: string;
  clientId: string;
  workspaceId: string;
  sessionId?: string;
  scopes: string[];
  expiresAt: string;
  revokedAt?: string;
}

export interface AccessTokenStore {
  save(token: IssuedAccessToken): Promise<void>;
  find(accessToken: string, now: Date): Promise<IssuedAccessToken | null>;
}
