export interface JwtClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  scope?: string;
  [key: string]: unknown;
}

export interface JwtSigner {
  sign(claims: JwtClaims): Promise<string>;
}

export interface JwtVerifier {
  verify(token: string): Promise<JwtClaims>;
}
