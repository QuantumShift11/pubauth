export interface IssuedAccessToken {
  accessToken: string;
  subjectId: string;
  clientId: string;
  scopes: string[];
  expiresAt: string;
}

export interface AccessTokenStore {
  save(token: IssuedAccessToken): Promise<void>;
  find(accessToken: string, now: Date): Promise<IssuedAccessToken | null>;
}
