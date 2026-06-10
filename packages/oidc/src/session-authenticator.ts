import type { HttpRequest } from '../../http/src/index.js';
import type { SessionRepository } from '../../storage/src/index.js';
import type { StoredAuthSession } from '../../storage/src/pubauth-state.js';

export interface AuthenticatedPrincipal {
  subjectId: string;
  workspaceId: string;
  sessionId?: string;
  authenticationMethod: 'cookie_session' | 'dev_header';
}

export interface SessionAuthenticator {
  authenticate(request: HttpRequest): Promise<AuthenticatedPrincipal | null>;
}

export class CookieSessionAuthenticator implements SessionAuthenticator {
  constructor(
    private readonly sessions: SessionRepository<StoredAuthSession>,
    private readonly cookieName = 'pubauth_session',
  ) {}

  async authenticate(request: HttpRequest): Promise<AuthenticatedPrincipal | null> {
    const cookieHeader = request.headers.cookie ?? request.headers.Cookie ?? '';
    const sessionId = readCookieValue(cookieHeader, this.cookieName);
    if (!sessionId) {
      return null;
    }

    const session = await this.sessions.getById(sessionId);
    if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return {
      subjectId: session.subjectId,
      workspaceId: session.workspaceId,
      sessionId: session.id,
      authenticationMethod: 'cookie_session',
    };
  }
}

export class DevSessionAuthenticator implements SessionAuthenticator {
  async authenticate(request: HttpRequest): Promise<AuthenticatedPrincipal | null> {
    const subjectId = readHeader(request, 'x-pubauth-dev-subject-id');
    const workspaceId = readHeader(request, 'x-pubauth-dev-workspace-id');
    if (!subjectId || !workspaceId) {
      return null;
    }

    return {
      subjectId,
      workspaceId,
      authenticationMethod: 'dev_header',
    };
  }
}

export class CompositeSessionAuthenticator implements SessionAuthenticator {
  constructor(private readonly authenticators: SessionAuthenticator[]) {}

  async authenticate(request: HttpRequest): Promise<AuthenticatedPrincipal | null> {
    for (const authenticator of this.authenticators) {
      const principal = await authenticator.authenticate(request);
      if (principal) {
        return principal;
      }
    }

    return null;
  }
}

function readCookieValue(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const [cookieName, ...valueParts] = part.trim().split('=');
    if (cookieName === name) {
      const value = valueParts.join('=').trim();
      return value.length > 0 ? value : null;
    }
  }

  return null;
}

function readHeader(request: HttpRequest, name: string): string | null {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()] ?? request.headers[name.toUpperCase()];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
