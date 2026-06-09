export interface SigningKey {
  keyId: string;
  algorithm: 'RS256' | 'ES256';
  publicKeyPem: string;
  privateKeyRef: string;
  status: 'active' | 'previous' | 'disabled';
  createdAt: string;
}

export interface SigningKeyStore {
  getActiveKey(): Promise<SigningKey>;
  listPublicKeys(): Promise<SigningKey[]>;
}
