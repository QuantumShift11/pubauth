export interface TokenRequest {
  grantType: 'authorization_code' | 'refresh_token';
  clientId: string;
  redirectUri?: string;
  code?: string;
  codeVerifier?: string;
  refreshToken?: string;
  clientSecret?: string;
  clientAuthMethod?: 'client_secret_basic' | 'client_secret_post';
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
