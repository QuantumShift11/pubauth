import { randomUUID } from 'node:crypto';
import type { ProviderLinkRepository, UserRepository } from '../../storage/src/index.js';
import type { StoredProviderLink, StoredUserAccount } from '../../storage/src/pubauth-state.js';
import type { ProviderProfile } from './provider.js';

export class BrokerAccountLinkingService {
  constructor(
    private readonly users: UserRepository<StoredUserAccount>,
    private readonly providerLinks: ProviderLinkRepository<StoredProviderLink>,
  ) {}

  async resolveUser(profile: ProviderProfile, workspaceId?: string): Promise<StoredUserAccount> {
    const existingLink = await this.providerLinks.findByProviderSubject(profile.providerName, profile.subject);
    if (existingLink) {
      const linkedUser = await this.users.findById(existingLink.userId);
      if (!linkedUser) {
        throw new Error('linked_user_missing');
      }

      await this.providerLinks.save({
        ...existingLink,
        email: profile.email ?? existingLink.email,
        lastLoginAt: new Date().toISOString(),
      });
      return linkedUser;
    }

    if (profile.email) {
      const existingUser = await this.users.findByEmail(profile.email);
      if (existingUser) {
        await this.link(existingUser, profile);
        return existingUser;
      }
    }

    const user: StoredUserAccount = {
      id: `user-account-${randomUUID().slice(0, 12)}`,
      subjectId: `${profile.providerName}-${profile.subject}`,
      username: profile.email ?? `${profile.providerName}-${profile.subject}@pubauth.external`,
      passwordHash: 'external',
      email: profile.email ?? `${profile.providerName}-${profile.subject}@pubauth.external`,
      displayName: profile.displayName ?? profile.email ?? profile.subject,
      workspaceId: workspaceId ?? 'workspace-core-platform',
      authProvider: profile.providerName,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    await this.users.save(user);
    await this.link(user, profile);
    return user;
  }

  private async link(user: StoredUserAccount, profile: ProviderProfile): Promise<void> {
    await this.providerLinks.save({
      id: `provider-link-${randomUUID().slice(0, 12)}`,
      userId: user.id,
      provider: profile.providerName,
      providerSubject: profile.subject,
      email: profile.email,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    });
  }
}
