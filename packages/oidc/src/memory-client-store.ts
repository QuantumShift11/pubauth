import type { OidcClient, OidcClientRepository } from './client.js';

export class MemoryOidcClientRepository implements OidcClientRepository {
  private readonly clients = new Map<string, OidcClient>();

  constructor(initialClients: OidcClient[] = []) {
    for (const client of initialClients) {
      this.clients.set(client.clientId, client);
    }
  }

  async findByClientId(clientId: string): Promise<OidcClient | null> {
    return this.clients.get(clientId) ?? null;
  }

  async save(client: OidcClient): Promise<void> {
    this.clients.set(client.clientId, client);
  }
}
