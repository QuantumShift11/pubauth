export interface ClientRegistration {
  id: string;
  productId: string;
  clientId: string;
  clientType: 'public' | 'confidential';
  redirectUris: string[];
  logoutRedirectUris: string[];
  scopes: string[];
  state: 'active' | 'disabled';
}

export interface ClientRegistrationStore {
  getByClientId(clientId: string): Promise<ClientRegistration | null>;
  listByProductId(productId: string): Promise<ClientRegistration[]>;
  save(client: ClientRegistration): Promise<void>;
}
