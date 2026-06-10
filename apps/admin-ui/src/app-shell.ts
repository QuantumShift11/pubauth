import { adminUiNavigation } from './navigation.js';
import { adminUiPages } from './pages.js';

export interface AdminUiShellDefinition {
  applicationName: string;
  navigation: typeof adminUiNavigation;
  pages: typeof adminUiPages;
}

export const adminUiShell: AdminUiShellDefinition = {
  applicationName: 'PubAuth Admin UI',
  navigation: adminUiNavigation,
  pages: adminUiPages,
};
