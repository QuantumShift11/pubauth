export interface TokenRequest {
  grantType: 'authorization_code' | 'refresh_token' | 'client_credentials';
  clientId: string;
  redirectUri?: string;
  code?: string;
  refreshToken?: string;
  codeVerifier?: string;
}

export interface TokenResponse {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string;
}

export interface TokenIssuer {
  issueToken(request: TokenRequest): Promise<TokenResponse>;
}
