export interface AuthSession {
  id: string;
  subjectId: string;
  workspaceId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface SessionStore {
  getById(id: string): Promise<AuthSession | null>;
  save(session: AuthSession): Promise<void>;
  revoke(id: string, reason: string): Promise<void>;
}

export function isSessionActive(session: AuthSession, now = new Date()): boolean {
  if (session.revokedAt) {
    return false;
  }
  return new Date(session.expiresAt).getTime() > now.getTime();
}
