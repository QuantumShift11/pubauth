export interface AuthorizationCode {
  codeHash: string;
  clientId: string;
  subjectId: string;
  workspaceId: string;
  sessionId?: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  expiresAt: string;
  usedAt?: string;
}

export interface AuthorizationCodeStore {
  save(code: AuthorizationCode): Promise<void>;
  findUsable(codeHash: string, now: Date): Promise<AuthorizationCode | null>;
  markUsed(codeHash: string, now: Date): Promise<void>;
  consume(codeHash: string, now: Date): Promise<AuthorizationCode | null>;
}

export function isAuthorizationCodeUsable(code: AuthorizationCode, now = new Date()): boolean {
  if (code.usedAt) {
    return false;
  }
  return new Date(code.expiresAt).getTime() > now.getTime();
}
