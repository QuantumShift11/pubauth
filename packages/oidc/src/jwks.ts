export interface JsonWebKey {
  kty: string;
  kid: string;
  use: 'sig';
  alg: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
}

export interface JwksResponse {
  keys: JsonWebKey[];
}

export interface JwksProvider {
  getPublicKeys(): Promise<JwksResponse>;
}
