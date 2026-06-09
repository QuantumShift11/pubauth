export interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  responseType: 'code';
  scope: string;
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface AuthorizationResponse {
  redirectUri: string;
  code: string;
  state?: string;
}

export interface AuthorizationService {
  start(request: AuthorizationRequest): Promise<AuthorizationResponse>;
}

export function parseScopes(scope: string): string[] {
  return scope.split(' ').map((item) => item.trim()).filter(Boolean);
}
