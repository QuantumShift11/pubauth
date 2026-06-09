export interface LogoutRequest {
  sessionId?: string;
  idTokenHint?: string;
  postLogoutRedirectUri?: string;
  state?: string;
}

export interface LogoutResponse {
  redirectUri?: string;
  cleared: boolean;
}

export interface LogoutService {
  logout(request: LogoutRequest): Promise<LogoutResponse>;
}
