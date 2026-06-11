export interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  responseType: 'code';
  scope: string;
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface AuthenticatedAuthorizationRequest extends AuthorizationRequest {
  subjectId: string;
  workspaceId: string;
  sessionId?: string;
}

export interface AuthorizationResponse {
  redirectUri: string;
  code: string;
  state?: string;
}

export interface AuthorizationService {
  start(request: AuthenticatedAuthorizationRequest): Promise<AuthorizationResponse>;
}

export function parseScopes(scope: string): string[] {
  return scope.split(' ').map((item) => item.trim()).filter(Boolean);
}
