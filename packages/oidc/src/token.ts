export interface TokenRequest {
  grantType: 'authorization_code';
  clientId: string;
  redirectUri?: string;
  code?: string;
  codeVerifier?: string;
}

export interface TokenResponse {
  accessToken: string;
  idToken?: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string;
}

export interface TokenIssuer {
  issueToken(request: TokenRequest): Promise<TokenResponse>;
}
