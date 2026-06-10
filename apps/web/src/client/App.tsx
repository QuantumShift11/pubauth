import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { ActionResult, BootstrapPayload, SelfServiceOverview } from './types.js';

type ConsoleMode = 'admin' | 'tenant' | 'user';
type SectionId = 'overview' | 'products' | 'workspaces' | 'clients' | 'users' | 'policies' | 'sessions' | 'audit' | 'settings';
type CreateFormType = 'product' | 'workspace' | 'client' | 'policy' | 'role' | 'assignment';
type DrawerEntityType = 'product' | 'workspace' | 'client' | 'policy' | 'role' | 'assignment' | 'principal' | 'session' | 'signingKey' | 'audit';

interface LogEntry {
  title: string;
  subtitle: string;
  status: number;
  body: unknown;
}

interface FormState {
  productName: string;
  productSlug: string;
  productWorkspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  clientProductId: string;
  clientType: 'public' | 'confidential';
  clientRedirectUri: string;
  clientScopes: string;
  policyProductId: string;
  policyUpstreamUrl: string;
  policyPathPattern: string;
  policyMethods: string;
  policyRoles: string;
  roleName: string;
  assignmentUserId: string;
  assignmentRole: string;
  assignmentWorkspaceId: string;
}

interface DrawerState {
  kind: 'detail' | 'create';
  type: DrawerEntityType | CreateFormType;
  id?: string;
}

interface PaletteAction {
  id: string;
  label: string;
  category: string;
  description: string;
  run: () => void;
}

interface AuthState {
  subjectId: string;
  workspaceId: string;
  roles: string[];
  groups: string[];
  mode: ConsoleMode;
  oidcCompleted: boolean;
}

interface LoginFormState {
  profile: 'admin' | 'tenant' | 'user';
  username: string;
  password: string;
}

interface LoginIntent {
  state: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  mode: ConsoleMode;
}

const defaultFormState: FormState = {
  productName: 'Nebula',
  productSlug: 'nebula',
  productWorkspaceId: 'workspace-core-platform',
  workspaceName: 'Northstar',
  workspaceSlug: 'northstar',
  clientProductId: 'product-atlas',
  clientType: 'public',
  clientRedirectUri: 'https://app.example.com/callback',
  clientScopes: 'openid profile email',
  policyProductId: 'product-atlas',
  policyUpstreamUrl: 'http://localhost:8090',
  policyPathPattern: '/dashboard/**',
  policyMethods: 'GET',
  policyRoles: 'viewer',
  roleName: 'auditor',
  assignmentUserId: 'user-1',
  assignmentRole: 'viewer',
  assignmentWorkspaceId: 'workspace-core-platform',
};

const defaultLoginFormState: LoginFormState = {
  profile: 'admin',
  username: 'admin@pubauth.local',
  password: 'ChangeMe-Admin!1',
};

const loginIntentStorageKey = 'pubauth.login-intent';

const adminSections: Array<{ id: SectionId; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Runtime health and activity' },
  { id: 'products', label: 'Products', description: 'Applications and registry' },
  { id: 'workspaces', label: 'Workspaces', description: 'Tenant scopes and environments' },
  { id: 'clients', label: 'Clients', description: 'OIDC clients and redirects' },
  { id: 'users', label: 'Users & Roles', description: 'Principals and assignments' },
  { id: 'policies', label: 'Route Policies', description: 'Gateway authorization' },
  { id: 'sessions', label: 'Sessions', description: 'Active browser sessions' },
  { id: 'audit', label: 'Audit', description: 'Admin and auth events' },
  { id: 'settings', label: 'Settings', description: 'Issuer and signing keys' },
];

const tenantSections: Array<{ id: SectionId; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Scoped runtime summary' },
  { id: 'clients', label: 'Clients', description: 'Tenant clients and redirects' },
  { id: 'users', label: 'Users & Roles', description: 'Tenant membership' },
  { id: 'policies', label: 'Route Policies', description: 'Tenant gateway access' },
  { id: 'sessions', label: 'Sessions', description: 'Workspace sessions' },
  { id: 'audit', label: 'Audit', description: 'Tenant activity history' },
  { id: 'settings', label: 'Settings', description: 'Issuer and signing keys' },
];

const userSections: Array<{ id: SectionId; label: string; description: string }> = [
  { id: 'overview', label: 'Profile', description: 'Your identity and access summary' },
  { id: 'sessions', label: 'Sessions', description: 'Your active sessions' },
  { id: 'audit', label: 'Activity', description: 'Recent security activity' },
  { id: 'settings', label: 'Security', description: 'Session and issuer details' },
];

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selfServiceOverview, setSelfServiceOverview] = useState<SelfServiceOverview | null>(null);
  const [processedLoginCode, setProcessedLoginCode] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<LogEntry[]>([]);
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [loginForm, setLoginForm] = useState<LoginFormState>(defaultLoginFormState);
  const [mode, setMode] = useState<ConsoleMode>('admin');
  const [section, setSection] = useState<SectionId>('overview');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    void loadBootstrap();
  }, []);

  useEffect(() => {
    void restoreSessionAuth({
      setAuth,
      setMode,
      setSelectedWorkspaceId,
      setAuthError,
    });
  }, []);

  useEffect(() => {
    if (!bootstrap) {
      return;
    }

    const nextProductId = bootstrap.admin.products[0]?.id ?? '';
    const nextWorkspaceId = bootstrap.admin.workspaces[0]?.id ?? '';

    setSelectedProductId((current) => {
      if (current && bootstrap.admin.products.some((item) => item.id === current)) {
        return current;
      }
      return nextProductId;
    });

    setSelectedWorkspaceId((current) => {
      if (current && bootstrap.admin.workspaces.some((item) => item.id === current)) {
        return current;
      }
      return nextWorkspaceId;
    });

    setFormState((current) => ({
      ...current,
      productWorkspaceId:
        bootstrap.admin.workspaces.some((item) => item.id === current.productWorkspaceId) && current.productWorkspaceId
          ? current.productWorkspaceId
          : nextWorkspaceId || current.productWorkspaceId,
      clientProductId:
        bootstrap.admin.products.some((item) => item.id === current.clientProductId) && current.clientProductId
          ? current.clientProductId
          : nextProductId || current.clientProductId,
      policyProductId:
        bootstrap.admin.products.some((item) => item.id === current.policyProductId) && current.policyProductId
          ? current.policyProductId
          : nextProductId || current.policyProductId,
      assignmentWorkspaceId:
        bootstrap.admin.workspaces.some((item) => item.id === current.assignmentWorkspaceId) && current.assignmentWorkspaceId
          ? current.assignmentWorkspaceId
          : nextWorkspaceId || current.assignmentWorkspaceId,
    }));

    setLoginForm((current) => ({
      ...current,
      username:
        current.username ||
        (current.profile === 'admin'
          ? 'admin@pubauth.local'
          : current.profile === 'tenant'
            ? 'owner@atlas.local'
            : 'user@atlas.local'),
    }));
  }, [bootstrap]);

  useEffect(() => {
    if (!bootstrap) {
      return;
    }

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || authBusy || code === processedLoginCode) {
      return;
    }

    setProcessedLoginCode(code);
    void completeLogin({
      bootstrap,
      code,
      state,
      setAuth,
      setAuthBusy,
      setAuthError,
      setMode,
      setSelectedWorkspaceId,
      setSection,
    }).finally(() => {
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
    });
  }, [bootstrap, authBusy, processedLoginCode]);

  useEffect(() => {
    const visibleSections = getVisibleSections(mode);
    if (!visibleSections.some((item) => item.id === section)) {
      setSection('overview');
    }
  }, [mode, section]);

  useEffect(() => {
    if (!auth) {
      setSelfServiceOverview(null);
      return;
    }

    if (auth.mode !== 'user') {
      setSelfServiceOverview(null);
      return;
    }

    void loadSelfServiceOverview(setSelfServiceOverview, setAuthError);
  }, [auth]);

  useEffect(() => {
    if (auth?.mode === 'user') {
      return;
    }

    void loadBootstrap();
  }, [auth?.subjectId, auth?.mode]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const isMetaK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isMetaK) {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }

      if (event.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        if (drawer) {
          setDrawer(null);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [helpOpen, paletteOpen, drawer]);

  async function loadBootstrap() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/bootstrap');
      if (!response.ok) {
        throw new Error(`bootstrap_failed_${response.status}`);
      }
      const payload = (await response.json()) as BootstrapPayload;
      setBootstrap(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'bootstrap_failed');
    } finally {
      setLoading(false);
    }
  }

  function updateField(name: keyof FormState, value: string) {
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function submit(endpoint: string, body: Record<string, unknown>, subtitle: string) {
    setBusyAction(subtitle);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as ActionResult['body'];
      setActionLog((current) => [
        {
          title: endpoint,
          subtitle,
          status: response.status,
          body: payload,
        },
        ...current.slice(0, 7),
      ]);

      if (response.ok) {
        await loadBootstrap();
        setDrawer(null);
      }
    } finally {
      setBusyAction(null);
    }
  }

  const admin = bootstrap?.admin;
  const canAccessAdmin = auth ? auth.roles.some((role) => role === 'super_admin' || role === 'tenant_admin' || role === 'product_admin') : false;
  const effectiveMode = canAccessAdmin ? mode : 'tenant';
  const sections = getVisibleSections(effectiveMode);
  const activeProduct = admin?.products.find((item) => item.id === selectedProductId) ?? admin?.products[0] ?? null;
  const activeWorkspace = admin?.workspaces.find((item) => item.id === selectedWorkspaceId) ?? admin?.workspaces[0] ?? null;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const scopedProducts = filterRecords(admin?.products ?? [], normalizedSearch, (item) =>
    [item.name, item.slug, item.environment, item.status, item.id].join(' '),
  );
  const scopedWorkspaces = filterRecords(admin?.workspaces ?? [], normalizedSearch, (item) =>
    [item.name, item.slug, item.state, item.id].join(' '),
  );
  const scopedClients = filterRecords(applyScope(admin?.clients ?? [], effectiveMode, selectedProductId), normalizedSearch, (item) =>
    [item.clientId, item.productId, item.clientType, item.allowedRedirectUris?.join(' '), item.allowedScopes?.join(' ')].join(' '),
  );
  const scopedPolicies = filterRecords(applyScope(admin?.routePolicies ?? [], effectiveMode, selectedProductId), normalizedSearch, (item) =>
    [item.pathPattern, item.productId, item.upstreamUrl, item.methods.join(' '), item.requiredRoles.join(' '), item.state].join(' '),
  );
  const scopedAssignments = filterRecords(applyScope(admin?.assignments ?? [], effectiveMode, selectedWorkspaceId), normalizedSearch, (item) =>
    [item.userId, item.role, item.workspaceId ?? '', item.createdAt].join(' '),
  );
  const scopedSessions = filterRecords(applyScope(admin?.sessions ?? [], effectiveMode, selectedWorkspaceId), normalizedSearch, (item) =>
    [item.id, item.subjectId, item.workspaceId, item.expiresAt, item.revokedAt ?? ''].join(' '),
  );
  const scopedAuditEvents = filterRecords(applyScope(admin?.auditEvents ?? [], effectiveMode, selectedWorkspaceId), normalizedSearch, (item) =>
    [item.actor, item.action, item.entityType, item.entityId, item.description, item.outcome].join(' '),
  );
  const scopedSigningKeys = filterRecords(admin?.signingKeys ?? [], normalizedSearch, (item) =>
    [item.keyId, item.algorithm, item.status, item.createdAt].join(' '),
  );
  const principalRows = buildPrincipalRows(admin?.assignments ?? [], admin?.sessions ?? []);
  const scopedPrincipals = filterRecords(applyScope(principalRows, effectiveMode, selectedWorkspaceId), normalizedSearch, (item) =>
    [item.userId, item.workspaceId ?? '', item.roles.join(' '), item.sessionCount, item.lastSeen ?? ''].join(' '),
  );
  const recentAudit = scopedAuditEvents.slice(0, 6);
  const recentActivity = [...actionLog].slice(0, 6);
  const authSummary = auth
    ? `${auth.subjectId} · ${auth.workspaceId} · ${auth.roles.length > 0 ? auth.roles.join(', ') : 'no roles'}`
    : 'not signed in';
  const paletteActions = buildPaletteActions({
    setPaletteOpen,
    setDrawer,
    setMode,
    setSection,
    reload: loadBootstrap,
    mode: effectiveMode,
    openHelp: () => setHelpOpen(true),
  });
  const filteredPaletteActions = paletteActions.filter((item) =>
    [item.label, item.category, item.description].join(' ').toLowerCase().includes(paletteQuery.trim().toLowerCase()),
  );

  if (!auth) {
    return (
      <LoginScreen
        bootstrap={bootstrap}
        loading={loading}
        error={error}
        authBusy={authBusy}
        authError={authError}
        loginForm={loginForm}
        setLoginForm={setLoginForm}
        onOpenHelp={() => setHelpOpen(true)}
        onLogin={() =>
          void startLogin({
            bootstrap,
            loginForm,
            setAuthBusy,
            setAuthError,
          })
        }
        onLoginAsAdmin={() =>
          void startLogin({
            bootstrap,
            loginForm: {
              ...loginForm,
              profile: 'admin',
              username: 'admin@pubauth.local',
              password: 'ChangeMe-Admin!1',
            },
            setAuthBusy,
            setAuthError,
          })
        }
        onLoginAsTenant={() =>
          void startLogin({
            bootstrap,
            loginForm: {
              ...loginForm,
              profile: 'tenant',
              username: 'owner@atlas.local',
              password: 'ChangeMe-Tenant!1',
            },
            setAuthBusy,
            setAuthError,
          })
        }
        onLoginAsUser={() =>
          void startLogin({
            bootstrap,
            loginForm: {
              ...loginForm,
              profile: 'user',
              username: 'user@atlas.local',
              password: 'ChangeMe-User!1',
            },
            setAuthBusy,
            setAuthError,
          })
        }
      />
    );
  }

  if (mode === 'user') {
    return (
      <UserPortal
        auth={auth}
        authError={authError}
        authBusy={authBusy}
        overview={selfServiceOverview}
        onRefresh={() => void loadSelfServiceOverview(setSelfServiceOverview, setAuthError)}
        onSignOut={() =>
          void logout({
            setAuth,
            setAuthBusy,
            setAuthError,
            setMode,
            setSection,
          })
        }
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar panel">
        <div className="brand-block">
          <div className="brand-mark">P</div>
          <div>
            <p className="eyebrow">Identity control plane</p>
            <h1>PubAuth</h1>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="mode-toggle">
            <button
              className={effectiveMode === 'admin' ? 'mode-chip active' : 'mode-chip'}
              type="button"
              onClick={() => setMode('admin')}
              disabled={!canAccessAdmin}
            >
              Admin Console
            </button>
            <button className={effectiveMode === 'tenant' ? 'mode-chip active' : 'mode-chip'} type="button" onClick={() => setMode('tenant')}>
              Tenant Console
            </button>
          </div>
          <p className="sidebar-note">
            {canAccessAdmin && effectiveMode === 'admin'
              ? 'Platform operators manage the whole registry.'
              : 'Tenant teams only see their scoped product and workspace data.'}
          </p>
        </div>

        <div className="sidebar-section select-stack">
          <label>
            Product
            <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
              {admin?.products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Workspace
            <select value={selectedWorkspaceId} onChange={(event) => setSelectedWorkspaceId(event.target.value)}>
              {admin?.workspaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <nav className="nav-list" aria-label="Console sections">
          {sections.map((item) => (
            <button key={item.id} type="button" className={section === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setSection(item.id)}>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-section auth-summary">
          <p className="eyebrow">Signed in</p>
          <strong>{authSummary}</strong>
          <p className="sidebar-note">
            {auth?.oidcCompleted
              ? 'OIDC Authorization Code + PKCE completed.'
              : auth
                ? 'Trusted browser session restored from the server cookie.'
                : 'No active OIDC browser session.'}
          </p>
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              logout({
                setAuth,
                setAuthBusy,
                setAuthError,
                setMode,
                setSection,
              })
            }
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar panel">
          <div className="topbar-left">
            <div>
              <p className="eyebrow">Live bootstrap</p>
              <div className="topline">
                <StatusPill tone={loading ? 'muted' : error ? 'danger' : 'success'}>
                  {loading ? 'Syncing' : error ? 'Offline' : 'Live'}
                </StatusPill>
                <StatusPill tone="neutral">{bootstrap?.runtime.issuer ?? 'Issuer pending'}</StatusPill>
                <StatusPill tone="muted">{effectiveMode === 'admin' ? 'Admin mode' : 'Tenant mode'}</StatusPill>
                <StatusPill tone="neutral">{authSummary}</StatusPill>
              </div>
            </div>
          </div>

          <div className="topbar-center">
            <label className="search-bar">
              <span>Search</span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Find product, client, policy, user..."
              />
            </label>
          </div>

          <div className="topbar-actions">
            <button className="secondary-button" type="button" onClick={() => void loadBootstrap()}>
              Refresh
            </button>
            <button className="secondary-button" type="button" onClick={() => setPaletteOpen(true)}>
              Command palette
            </button>
            <button className="secondary-button" type="button" onClick={() => setHelpOpen(true)}>
              Help
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() =>
                logout({
                  setAuth,
                  setAuthBusy,
                  setAuthError,
                  setMode,
                  setSection,
                })
              }
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="content">
          <section className="hero panel">
            <div className="hero-copy">
              <p className="eyebrow">{effectiveMode === 'admin' ? 'Operator console' : 'Tenant console'}</p>
              <h2>{effectiveMode === 'admin' ? 'Operate identity, access, and policy from one control plane.' : 'Manage your product auth surface without platform noise.'}</h2>
              <p className="lede">
                PubAuth exposes one React control plane with role-scoped views. The API remains the source of truth for OIDC, RBAC, gateway
                policy, sessions, and signing state.
              </p>
              <div className="hero-actions">
                <button className="primary-button" type="button" onClick={() => setDrawer({ kind: 'create', type: 'client' })}>
                  New client
                </button>
                <button className="secondary-button" type="button" onClick={() => setDrawer({ kind: 'create', type: 'policy' })}>
                  New policy
                </button>
                <button className="ghost-button" type="button" onClick={() => setDrawer({ kind: 'detail', type: 'product', id: activeProduct?.id ?? '' })}>
                  Inspect active scope
                </button>
              </div>
            </div>

            <div className="hero-side">
              <Metric label="Products" value={String(admin?.counts.products ?? 0)} />
              <Metric label="Workspaces" value={String(admin?.counts.workspaces ?? 0)} />
              <Metric label="Clients" value={String(admin?.counts.clients ?? 0)} />
              <Metric label="Policies" value={String(admin?.counts.routePolicies ?? 0)} />
            </div>
          </section>

          {section === 'overview' ? (
            <div className="overview-grid">
              <section className="panel section-panel">
                <SectionHead
                  title="Operational snapshot"
                  subtitle="Health, trust, and identity surface"
                  actions={
                    <StatusRow>
                      <StatusPill tone="muted">{activeProduct ? `Product: ${activeProduct.name}` : 'No product'}</StatusPill>
                      <StatusPill tone="muted">{activeWorkspace ? `Workspace: ${activeWorkspace.name}` : 'No workspace'}</StatusPill>
                    </StatusRow>
                  }
                />
                <div className="stat-grid">
                  <StatCard label="JWKS keys" value={String(bootstrap?.jwks.keys.length ?? 0)} note="Public signing keys only" />
                  <StatCard label="Gateway rules" value={String(admin?.routePolicies.length ?? 0)} note="Deny-by-default routing" />
                  <StatCard label="Role assignments" value={String(admin?.assignments.length ?? 0)} note="Scoped membership" />
                  <StatCard label="Recent audits" value={String(admin?.auditEvents.length ?? 0)} note="Admin and auth activity" />
                </div>
                <div className="split-grid">
                  <Card title="Discovery" subtitle="OIDC endpoints">
                    <KeyValueList
                      items={[
                        ['Authorize', bootstrap?.discovery.authorization_endpoint ?? 'pending'],
                        ['Token', bootstrap?.discovery.token_endpoint ?? 'pending'],
                        ['JWKS', bootstrap?.discovery.jwks_uri ?? 'pending'],
                        ['UserInfo', bootstrap?.discovery.userinfo_endpoint ?? 'pending'],
                      ]}
                    />
                  </Card>
                  <Card title="Runtime" subtitle="Surface posture">
                    <ul className="feature-list compact">
                      <li>Authorization code + PKCE only.</li>
                      <li>RS256 tokens validated at the edge.</li>
                      <li>Trusted headers are injected after allow.</li>
                      <li>Audit events persist with the tenant data file.</li>
                    </ul>
                  </Card>
                </div>
              </section>

              <aside className="panel section-panel">
                <SectionHead title="Recent activity" subtitle="Bootstrap-linked activity and audit trail" />
                {recentAudit.length === 0 && recentActivity.length === 0 ? (
                  <EmptyState title="No activity yet" description="Provision a product, client, or policy to populate the timeline." />
                ) : (
                  <Timeline items={recentAudit.map((entry) => ({
                    title: entry.action,
                    subtitle: `${entry.entityType} · ${entry.outcome}`,
                    detail: entry.description,
                    tone: entry.outcome === 'success' ? 'success' : 'danger',
                    meta: formatTimestamp(entry.createdAt),
                  }))} />
                )}

                <SectionHead title="Recent responses" subtitle="Live request log" compact />
                {recentActivity.length === 0 ? (
                  <EmptyState title="No API actions yet" description="Use the quick actions to exercise the admin APIs." />
                ) : (
                  <ResponseList entries={recentActivity} />
                )}
              </aside>
            </div>
          ) : null}

          {section === 'products' ? (
          <SectionTable
              title="Products"
              subtitle="Product registry"
              actionLabel="New product"
              onAction={() => setDrawer({ kind: 'create', type: 'product' })}
              columns={['Name', 'Slug', 'Environment', 'Status', 'Created']}
              items={scopedProducts}
              renderRow={(item) => [item.name, item.slug, item.environment, item.status, formatTimestamp(item.createdAt)]}
              empty={<EmptyState title="No products match" description="Create a product or clear the search filter." />}
              onRowClick={(item) => setDrawer({ kind: 'detail', type: 'product', id: item.id })}
            />
          ) : null}

          {section === 'workspaces' ? (
          <SectionTable
              title="Workspaces"
              subtitle="Tenant scopes"
              actionLabel="New workspace"
              onAction={() => setDrawer({ kind: 'create', type: 'workspace' })}
              columns={['Name', 'Slug', 'State', 'Created']}
              items={scopedWorkspaces}
              renderRow={(item) => [item.name, item.slug, item.state, formatTimestamp(item.createdAt)]}
              empty={<EmptyState title="No workspaces match" description="Create a workspace or clear the search filter." />}
              onRowClick={(item) => setDrawer({ kind: 'detail', type: 'workspace', id: item.id })}
            />
          ) : null}

          {section === 'clients' ? (
          <SectionTable
              title="Clients"
              subtitle="OIDC client registry"
              actionLabel="New client"
              onAction={() => setDrawer({ kind: 'create', type: 'client' })}
              columns={['Client ID', 'Product', 'Type', 'Redirect URIs', 'Scopes']}
              items={scopedClients}
              renderRow={(item) => [item.clientId, item.productId, item.clientType, item.allowedRedirectUris.join(', '), item.allowedScopes.join(', ')]}
              empty={<EmptyState title="No clients match" description="Create an OIDC client or clear the search filter." />}
              onRowClick={(item) => setDrawer({ kind: 'detail', type: 'client', id: item.id })}
            />
          ) : null}

          {section === 'users' ? (
          <SectionTable
              title="Users & roles"
              subtitle="Derived principals"
              actionLabel="Assign role"
              onAction={() => setDrawer({ kind: 'create', type: 'assignment' })}
              columns={['User', 'Workspace', 'Roles', 'Sessions', 'Source']}
              items={scopedPrincipals}
              renderRow={(item) => [item.userId, item.workspaceId ?? 'global', item.roles.join(', '), String(item.sessionCount), item.source]}
              empty={<EmptyState title="No principals match" description="Assign a role or add a session to see users." />}
              onRowClick={(item) => setDrawer({ kind: 'detail', type: 'principal', id: `${item.userId}:${item.workspaceId ?? 'global'}` })}
            />
          ) : null}

          {section === 'policies' ? (
          <SectionTable
              title="Route policies"
              subtitle="Gateway authorization"
              actionLabel="New policy"
              onAction={() => setDrawer({ kind: 'create', type: 'policy' })}
              columns={['Path', 'Methods', 'Roles', 'Upstream', 'State']}
              items={scopedPolicies}
              renderRow={(item) => [item.pathPattern, item.methods.join(', '), item.requiredRoles.join(', '), item.upstreamUrl, item.state]}
              empty={<EmptyState title="No policies match" description="Create a route policy to protect an upstream app." />}
              onRowClick={(item) => setDrawer({ kind: 'detail', type: 'policy', id: item.id })}
            />
          ) : null}

          {section === 'sessions' ? (
          <SectionTable
              title="Sessions"
              subtitle="Active browser sessions"
              actionLabel="Refresh"
              onAction={() => void loadBootstrap()}
              columns={['Session', 'User', 'Workspace', 'Expires', 'State']}
              items={scopedSessions}
              renderRow={(item) => [item.id, item.subjectId, item.workspaceId, formatTimestamp(item.expiresAt), item.revokedAt ? 'revoked' : 'active']}
              empty={<EmptyState title="No sessions match" description="Sessions will appear as users authenticate." />}
              onRowClick={(item) => setDrawer({ kind: 'detail', type: 'session', id: item.id })}
            />
          ) : null}

          {section === 'audit' ? (
          <SectionTable
              title="Audit log"
              subtitle="Immutable operational history"
              actionLabel="Reload"
              onAction={() => void loadBootstrap()}
              columns={['Timestamp', 'Actor', 'Action', 'Entity', 'Outcome']}
              items={scopedAuditEvents}
              renderRow={(item) => [formatTimestamp(item.createdAt), item.actor, item.action, `${item.entityType}:${item.entityId}`, item.outcome]}
              empty={<EmptyState title="No audit events match" description="Provision something to generate operational history." />}
              onRowClick={(item) => setDrawer({ kind: 'detail', type: 'audit', id: item.id })}
            />
          ) : null}

          {section === 'settings' ? (
            <div className="settings-grid">
              <section className="panel section-panel">
                <SectionHead
                  title="Issuer and keys"
                  subtitle="Production security surface"
                  actions={
                    <button className="secondary-button" type="button" onClick={() => setDrawer({ kind: 'create', type: 'policy' })}>
                      Create policy
                    </button>
                  }
                />
                <div className="split-grid">
                  <Card title="Issuer" subtitle="Runtime configuration">
                    <KeyValueList
                      items={[
                        ['Issuer', bootstrap?.runtime.issuer ?? 'pending'],
                        ['API base', bootstrap?.runtime.apiBase ?? 'pending'],
                        ['Service', bootstrap?.api.service ?? 'pending'],
                        ['Status', bootstrap?.api.status ?? 'pending'],
                      ]}
                    />
                  </Card>
                  <Card title="Signing keys" subtitle="JWKS visibility">
                    <KeyValueList
                      items={[
                        ['JWKS keys', String(bootstrap?.jwks.keys.length ?? 0)],
                        ['Code flow', 'Authorization Code + PKCE'],
                        ['Token validation', 'RS256 signed'],
                        ['Secrets', 'Never exposed in JWKS'],
                      ]}
                    />
                  </Card>
                </div>
              </section>

              <section className="panel section-panel">
                <SectionHead title="Public signing keys" subtitle="No private material in UI" />
                <SectionTable
                  compact
                  title=""
                  subtitle=""
                  actionLabel="Refresh"
                  onAction={() => void loadBootstrap()}
                  columns={['Key ID', 'Algorithm', 'Status', 'Created']}
                  items={scopedSigningKeys}
                  renderRow={(item) => [item.keyId, item.algorithm, item.status, formatTimestamp(item.createdAt)]}
                  empty={<EmptyState title="No signing keys" description="The API will generate a default active key." />}
                  onRowClick={(item) => setDrawer({ kind: 'detail', type: 'signingKey', id: item.keyId })}
                />
              </section>
            </div>
          ) : null}
        </main>
      </div>

      {drawer ? (
        <DrawerPanel
          drawer={drawer}
          onClose={() => setDrawer(null)}
          bootstrap={bootstrap}
          formState={formState}
          updateField={updateField}
          submit={submit}
          busyAction={busyAction}
          activeProduct={activeProduct}
          activeWorkspace={activeWorkspace}
        />
      ) : null}

      {paletteOpen ? (
        <CommandPalette
          query={paletteQuery}
          setQuery={setPaletteQuery}
          actions={filteredPaletteActions}
          onClose={() => setPaletteOpen(false)}
        />
      ) : null}

      {helpOpen ? (
        <HelpModal
          onClose={() => setHelpOpen(false)}
          effectiveMode={effectiveMode}
          onJumpTo={(nextSection) => {
            setSection(nextSection);
            setHelpOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function DrawerPanel({
  drawer,
  onClose,
  bootstrap,
  formState,
  updateField,
  submit,
  busyAction,
  activeProduct,
  activeWorkspace,
}: {
  drawer: DrawerState;
  onClose: () => void;
  bootstrap: BootstrapPayload | null;
  formState: FormState;
  updateField: (name: keyof FormState, value: string) => void;
  submit: (endpoint: string, body: Record<string, unknown>, subtitle: string) => Promise<void>;
  busyAction: string | null;
  activeProduct: { id: string; name: string } | null;
  activeWorkspace: { id: string; name: string } | null;
}) {
  const admin = bootstrap?.admin;
  const content = renderDrawerContent(drawer, admin, formState, updateField, submit, busyAction, activeProduct, activeWorkspace);

  return (
    <>
      <button className="drawer-backdrop" type="button" aria-label="Close drawer" onClick={onClose} />
      <aside className="drawer panel" aria-label="Details drawer">
        <div className="drawer-head">
          <div>
            <p className="eyebrow">{drawer.kind === 'create' ? 'Create' : 'Details'}</p>
            <h3>{getDrawerTitle(drawer)}</h3>
          </div>
          <button className="ghost-button compact" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="drawer-body">{content}</div>
      </aside>
    </>
  );
}

function renderDrawerContent(
  drawer: DrawerState,
  admin: BootstrapPayload['admin'] | undefined,
  formState: FormState,
  updateField: (name: keyof FormState, value: string) => void,
  submit: (endpoint: string, body: Record<string, unknown>, subtitle: string) => Promise<void>,
  busyAction: string | null,
  activeProduct: { id: string; name: string } | null,
  activeWorkspace: { id: string; name: string } | null,
): ReactNode {
  if (!drawer || !admin) {
    return <EmptyState title="Nothing selected" description="Open a record or creation form from the console." />;
  }

  if (drawer.kind === 'create') {
    switch (drawer.type) {
      case 'product':
        return (
          <FormBlock
            fields={
              <>
                <label>
                  Name
                  <input value={formState.productName} onChange={(event) => updateField('productName', event.target.value)} />
                </label>
                <label>
                  Slug
                  <input value={formState.productSlug} onChange={(event) => updateField('productSlug', event.target.value)} />
                </label>
                <label>
                  Workspace
                  <select value={formState.productWorkspaceId} onChange={(event) => updateField('productWorkspaceId', event.target.value)}>
                    {admin.workspaces.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Environment
                  <select value="local" onChange={() => undefined}>
                    <option value="local">Local</option>
                    <option value="dev">Dev</option>
                    <option value="qa">QA</option>
                    <option value="prod">Prod</option>
                  </select>
                </label>
              </>
            }
            busy={busyAction}
            onSubmit={() =>
              submit(
                '/api/admin/products',
                {
                  workspaceId: formState.productWorkspaceId,
                  name: formState.productName,
                  slug: formState.productSlug,
                  environment: 'local',
                },
                'Create product',
              )
            }
          />
        );
      case 'workspace':
        return (
          <FormBlock
            fields={
              <>
                <label>
                  Name
                  <input value={formState.workspaceName} onChange={(event) => updateField('workspaceName', event.target.value)} />
                </label>
                <label>
                  Slug
                  <input value={formState.workspaceSlug} onChange={(event) => updateField('workspaceSlug', event.target.value)} />
                </label>
              </>
            }
            busy={busyAction}
            onSubmit={() =>
              submit(
                '/api/admin/workspaces',
                {
                  name: formState.workspaceName,
                  slug: formState.workspaceSlug,
                },
                'Create workspace',
              )
            }
          />
        );
      case 'client':
        return (
          <FormBlock
            fields={
              <>
                <label>
                  Product
                  <select value={formState.clientProductId} onChange={(event) => updateField('clientProductId', event.target.value)}>
                    {admin.products.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Type
                  <select value={formState.clientType} onChange={(event) => updateField('clientType', event.target.value)}>
                    <option value="public">Public</option>
                    <option value="confidential">Confidential</option>
                  </select>
                </label>
                <label className="wide">
                  Redirect URI
                  <input value={formState.clientRedirectUri} onChange={(event) => updateField('clientRedirectUri', event.target.value)} />
                </label>
                <label className="wide">
                  Scopes
                  <input value={formState.clientScopes} onChange={(event) => updateField('clientScopes', event.target.value)} />
                </label>
              </>
            }
            busy={busyAction}
            onSubmit={() =>
              submit(
                '/api/admin/clients',
                {
                  productId: formState.clientProductId,
                  clientType: formState.clientType,
                  redirectUris: [formState.clientRedirectUri],
                  scopes: formState.clientScopes.split(' ').map((value) => value.trim()).filter(Boolean),
                },
                'Create client',
              )
            }
          />
        );
      case 'policy':
        return (
          <FormBlock
            fields={
              <>
                <label>
                  Product
                  <select value={formState.policyProductId} onChange={(event) => updateField('policyProductId', event.target.value)}>
                    {admin.products.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  Upstream URL
                  <input value={formState.policyUpstreamUrl} onChange={(event) => updateField('policyUpstreamUrl', event.target.value)} />
                </label>
                <label className="wide">
                  Path pattern
                  <input value={formState.policyPathPattern} onChange={(event) => updateField('policyPathPattern', event.target.value)} />
                </label>
                <label>
                  Methods
                  <input value={formState.policyMethods} onChange={(event) => updateField('policyMethods', event.target.value)} />
                </label>
                <label>
                  Required roles
                  <input value={formState.policyRoles} onChange={(event) => updateField('policyRoles', event.target.value)} />
                </label>
              </>
            }
            busy={busyAction}
            onSubmit={() =>
              submit(
                '/api/admin/route-policies',
                {
                  productId: formState.policyProductId,
                  upstreamUrl: formState.policyUpstreamUrl,
                  pathPattern: formState.policyPathPattern,
                  methods: formState.policyMethods.split(',').map((value) => value.trim()).filter(Boolean),
                  requiredRoles: formState.policyRoles.split(',').map((value) => value.trim()).filter(Boolean),
                },
                'Create route policy',
              )
            }
          />
        );
      case 'role':
        return (
          <FormBlock
            fields={
              <label className="wide">
                Role name
                <input value={formState.roleName} onChange={(event) => updateField('roleName', event.target.value)} />
              </label>
            }
            busy={busyAction}
            onSubmit={() =>
              submit(
                '/api/admin/roles',
                {
                  name: formState.roleName,
                },
                'Create role',
              )
            }
          />
        );
      case 'assignment':
        return (
          <FormBlock
            fields={
              <>
                <label>
                  User ID
                  <input value={formState.assignmentUserId} onChange={(event) => updateField('assignmentUserId', event.target.value)} />
                </label>
                <label>
                  Role
                  <select value={formState.assignmentRole} onChange={(event) => updateField('assignmentRole', event.target.value)}>
                    {admin.roles.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  Workspace
                  <select value={formState.assignmentWorkspaceId} onChange={(event) => updateField('assignmentWorkspaceId', event.target.value)}>
                    {admin.workspaces.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            }
            busy={busyAction}
            onSubmit={() =>
              submit(
                '/api/admin/assignments',
                {
                  userId: formState.assignmentUserId,
                  role: formState.assignmentRole,
                  workspaceId: formState.assignmentWorkspaceId,
                },
                'Assign role',
              )
            }
          />
        );
      default:
        return <EmptyState title="Unsupported action" description="Open a different quick action." />;
    }
  }

  const entity = getEntityRecord(drawer, admin, activeProduct, activeWorkspace);
  if (!entity) {
    return <EmptyState title="Record not found" description="Refresh the runtime or choose a different item." />;
  }

  return (
    <>
      <KeyValueList items={entity.meta} />
      {entity.badges.length > 0 ? (
        <div className="badge-row">
          {entity.badges.map((badge) => (
            <Badge key={badge}>{badge}</Badge>
          ))}
        </div>
      ) : null}
      {entity.details.length > 0 ? (
        <div className="drawer-details">
          {entity.details.map((item) => (
            <div key={item.label} className="detail-row">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      <div className="drawer-note">
        <strong>Trust boundary</strong>
        <span>{entity.note}</span>
      </div>
      {entity.title === 'client' || entity.title === 'policy' ? (
        <button className="secondary-button full-width" type="button" onClick={() => undefined}>
          Editing is surfaced through the create flow for now
        </button>
      ) : null}
    </>
  );
}

function getEntityRecord(
  drawer: DrawerState,
  admin: BootstrapPayload['admin'],
  activeProduct: { id: string; name: string } | null,
  activeWorkspace: { id: string; name: string } | null,
): {
  title: string;
  meta: Array<[string, string]>;
  badges: string[];
  details: Array<{ label: string; value: string }>;
  note: string;
} | null {
  if (!drawer || drawer.kind !== 'detail') {
    return null;
  }

  switch (drawer.type) {
    case 'product': {
      const item = admin.products.find((entry) => entry.id === drawer.id);
      if (!item) {
        return null;
      }
      return {
        title: 'product',
        meta: [
          ['Name', item.name],
          ['Slug', item.slug],
          ['Environment', item.environment],
          ['State', item.status],
        ],
        badges: [item.environment, item.status],
        details: [
          { label: 'Created', value: formatTimestamp(item.createdAt) },
          { label: 'ID', value: item.id },
        ],
        note: 'Products define the tenant-facing registry. Clients and route policies hang off this root object.',
      };
    }
    case 'workspace': {
      const item = admin.workspaces.find((entry) => entry.id === drawer.id);
      if (!item) {
        return null;
      }
      return {
        title: 'workspace',
        meta: [
          ['Name', item.name],
          ['Slug', item.slug],
          ['State', item.state],
          ['Scope', activeProduct?.name ?? 'global'],
        ],
        badges: [item.state],
        details: [
          { label: 'Created', value: formatTimestamp(item.createdAt) },
          { label: 'ID', value: item.id },
        ],
        note: 'Workspaces are the tenant boundary used by role assignments and session scoping.',
      };
    }
    case 'client': {
      const item = admin.clients.find((entry) => entry.id === drawer.id);
      if (!item) {
        return null;
      }
      return {
        title: 'client',
        meta: [
          ['Client ID', item.clientId],
          ['Product', item.productId],
          ['Type', item.clientType],
          ['Active', String(item.isActive)],
        ],
        badges: [item.clientType, item.isActive ? 'active' : 'disabled'],
        details: [
          { label: 'Redirect URIs', value: item.allowedRedirectUris.join(', ') },
          { label: 'Scopes', value: item.allowedScopes.join(', ') },
          { label: 'Created', value: formatTimestamp(item.createdAt) },
        ],
        note: 'Clients are scoped to a product and should use exact redirect URI matching.',
      };
    }
    case 'policy': {
      const item = admin.routePolicies.find((entry) => entry.id === drawer.id);
      if (!item) {
        return null;
      }
      return {
        title: 'policy',
        meta: [
          ['Path', item.pathPattern],
          ['Methods', item.methods.join(', ')],
          ['Roles', item.requiredRoles.join(', ')],
          ['Upstream', item.upstreamUrl],
        ],
        badges: [item.state, `priority ${item.priority}`],
        details: [
          { label: 'Product', value: item.productId },
          { label: 'Created', value: formatTimestamp(item.createdAt) },
          { label: 'Policy ID', value: item.id },
        ],
        note: 'Gateway policies deny by default and only allow a route when the principal and method match.',
      };
    }
    case 'role': {
      const item = admin.roles.find((entry) => entry.id === drawer.id);
      if (!item) {
        return null;
      }
      return {
        title: 'role',
        meta: [
          ['Name', item.name],
          ['Product scope', activeProduct?.name ?? 'all products'],
        ],
        badges: [item.name],
        details: [{ label: 'Created', value: formatTimestamp(item.createdAt) }],
        note: 'Roles are assigned to users or principals and drive gateway policy decisions.',
      };
    }
    case 'assignment': {
      const item = admin.assignments.find((entry) => entry.id === drawer.id);
      if (!item) {
        return null;
      }
      return {
        title: 'assignment',
        meta: [
          ['User', item.userId],
          ['Role', item.role],
          ['Workspace', item.workspaceId ?? activeWorkspace?.name ?? 'global'],
        ],
        badges: [item.role, item.workspaceId ?? 'global'],
        details: [{ label: 'Created', value: formatTimestamp(item.createdAt) }],
        note: 'Assignments are the tenant membership layer used by gateway role checks.',
      };
    }
    case 'principal': {
      const principal = buildPrincipalRows(admin.assignments, admin.sessions).find(
        (entry) => `${entry.userId}:${entry.workspaceId ?? 'global'}` === drawer.id,
      );
      if (!principal) {
        return null;
      }
      return {
        title: 'principal',
        meta: [
          ['User', principal.userId],
          ['Workspace', principal.workspaceId ?? 'global'],
          ['Roles', principal.roles.join(', ') || 'none'],
          ['Sessions', String(principal.sessionCount)],
        ],
        badges: principal.roles.length > 0 ? principal.roles : ['unassigned'],
        details: [
          { label: 'Source', value: principal.source },
          { label: 'Last seen', value: principal.lastSeen ? formatTimestamp(principal.lastSeen) : 'unknown' },
        ],
        note: 'Principals are derived from assignments and sessions; the UI does not invent a separate user store.',
      };
    }
    case 'session': {
      const item = admin.sessions.find((entry) => entry.id === drawer.id);
      if (!item) {
        return null;
      }
      return {
        title: 'session',
        meta: [
          ['Session ID', item.id],
          ['User', item.subjectId],
          ['Workspace', item.workspaceId],
          ['State', item.revokedAt ? 'revoked' : 'active'],
        ],
        badges: [item.revokedAt ? 'revoked' : 'active'],
        details: [
          { label: 'Created', value: formatTimestamp(item.createdAt) },
          { label: 'Expires', value: formatTimestamp(item.expiresAt) },
          { label: 'Revoked', value: item.revokedAt ? formatTimestamp(item.revokedAt) : 'not revoked' },
        ],
        note: 'Gateway session validation reads the persisted session store and refuses expired or revoked sessions.',
      };
    }
    case 'signingKey': {
      const item = admin.signingKeys.find((entry) => entry.keyId === drawer.id);
      if (!item) {
        return null;
      }
      return {
        title: 'signing key',
        meta: [
          ['Key ID', item.keyId],
          ['Algorithm', item.algorithm],
          ['Status', item.status],
          ['Created', formatTimestamp(item.createdAt)],
        ],
        badges: [item.status, item.algorithm],
        details: [],
        note: 'Only public signing key material is visible here. Private key material stays on the API side.',
      };
    }
    case 'audit': {
      const item = admin.auditEvents.find((entry) => entry.id === drawer.id);
      if (!item) {
        return null;
      }
      return {
        title: 'audit',
        meta: [
          ['Action', item.action],
          ['Entity', `${item.entityType}:${item.entityId}`],
          ['Outcome', item.outcome],
          ['Actor', item.actor],
        ],
        badges: [item.outcome, item.entityType],
        details: [
          { label: 'Workspace', value: item.workspaceId ?? 'global' },
          { label: 'Description', value: item.description },
          { label: 'Created', value: formatTimestamp(item.createdAt) },
        ],
        note: 'Audit events are append-only operational records for product and platform changes.',
      };
    }
  }
}

function FormBlock({
  fields,
  onSubmit,
  busy,
}: {
  fields: ReactNode;
  onSubmit: () => Promise<void>;
  busy: string | null;
}) {
  return (
    <div className="drawer-form">
      <div className="form-grid drawer-grid">{fields}</div>
      <button className="primary-button full-width" type="button" onClick={() => void onSubmit()} disabled={Boolean(busy)}>
        {busy ?? 'Save'}
      </button>
    </div>
  );
}

function SectionTable<T>({
  title,
  subtitle,
  actionLabel,
  onAction,
  columns,
  items,
  renderRow,
  empty,
  onRowClick,
  compact = false,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
  columns: string[];
  items: T[];
  renderRow: (item: T) => string[];
  empty: ReactNode;
  onRowClick?: (row: T) => void;
  compact?: boolean;
}) {
  const rows = items.map((item) => ({ item, cells: renderRow(item) }));

  return (
    <section className={compact ? 'panel section-panel compact-section' : 'panel section-panel'}>
      {title ? <SectionHead title={title} subtitle={subtitle} actions={<button className="secondary-button" type="button" onClick={onAction}>{actionLabel}</button>} /> : null}
      {rows.length === 0 ? (
        empty
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((item) => (
                  <th key={item}>{item}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.cells.join('-')}-${index}`}
                  className={onRowClick ? 'clickable-row' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  onClick={onRowClick ? () => onRowClick(row.item) : undefined}
                  onKeyDown={onRowClick ? (event) => handleRowKeyDown(event, () => onRowClick(row.item)) : undefined}
                >
                  {row.cells.map((cell, cellIndex) => (
                    <td key={`${cell}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SectionHead({
  title,
  subtitle,
  actions,
  compact = false,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'section-head compact' : 'section-head'}>
      <div>
        <p className="eyebrow">{subtitle}</p>
        <h3>{title}</h3>
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <article className="mini-card panel">
      <p className="eyebrow">{subtitle}</p>
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: 'success' | 'danger' | 'muted' | 'neutral'; children: string }) {
  return <span className={`status-pill tone-${tone}`}>{children}</span>;
}

function StatusRow({ children }: { children: ReactNode }) {
  return <div className="status-row-inline">{children}</div>;
}

function Badge({ children }: { children: string }) {
  return <span className="badge">{children}</span>;
}

function KeyValueList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="key-value-list">
      {items.map(([label, value]) => (
        <div key={label} className="key-value-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function Timeline({ items }: { items: Array<{ title: string; subtitle: string; detail: string; meta: string; tone: 'success' | 'danger' | 'muted' }> }) {
  return (
    <div className="timeline">
      {items.map((item) => (
        <article key={`${item.title}-${item.meta}-${item.detail}`} className="timeline-item">
          <div className="timeline-head">
            <div>
              <p className="timeline-meta">{item.meta}</p>
              <strong>{item.title}</strong>
            </div>
            <StatusPill tone={item.tone}>{item.subtitle}</StatusPill>
          </div>
          <p>{item.detail}</p>
        </article>
      ))}
    </div>
  );
}

function ResponseList({ entries }: { entries: LogEntry[] }) {
  return (
    <div className="response-list">
      {entries.map((entry) => (
        <article key={`${entry.title}-${entry.subtitle}-${entry.status}`} className="response-item">
          <div className="response-head">
            <div>
              <p className="response-subtitle">{entry.subtitle}</p>
              <strong>{entry.title}</strong>
            </div>
            <StatusPill tone={entry.status < 300 ? 'success' : entry.status < 500 ? 'neutral' : 'danger'}>{String(entry.status)}</StatusPill>
          </div>
          <pre>{JSON.stringify(entry.body, null, 2)}</pre>
        </article>
      ))}
    </div>
  );
}

function CommandPalette({
  query,
  setQuery,
  actions,
  onClose,
}: {
  query: string;
  setQuery: (value: string) => void;
  actions: PaletteAction[];
  onClose: () => void;
}) {
  return (
    <>
      <button className="palette-backdrop" type="button" aria-label="Close command palette" onClick={onClose} />
      <div className="palette panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-head">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a command or section..." autoFocus />
          <button className="ghost-button compact" type="button" onClick={onClose}>
            Esc
          </button>
        </div>
        <div className="palette-list">
          {actions.length === 0 ? (
            <EmptyState title="No commands match" description="Try a broader search or close the palette." />
          ) : (
            actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="palette-item"
                onClick={() => {
                  action.run();
                  onClose();
                }}
              >
                <strong>{action.label}</strong>
                <span>{action.category}</span>
                <p>{action.description}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function HelpModal({
  effectiveMode,
  onClose,
  onJumpTo,
}: {
  effectiveMode: ConsoleMode;
  onClose: () => void;
  onJumpTo: (section: Exclude<SectionId, 'overview'> | 'overview') => void;
}) {
  return (
    <>
      <button className="palette-backdrop" type="button" aria-label="Close help" onClick={onClose} />
      <div className="help-modal panel" role="dialog" aria-modal="true" aria-label="PubAuth usage guide">
        <div className="help-modal-head">
          <div>
            <p className="eyebrow">Usage guide</p>
            <h3>How to use PubAuth</h3>
            <p className="help-lede">
              The UI is split into two paths. Admin operators manage the platform. Tenant owners manage a single product scope.
            </p>
          </div>
          <button className="ghost-button compact" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="help-modal-grid">
          <article className="help-card">
            <div className="help-card-head">
              <div>
                <p className="eyebrow">Admin operators</p>
                <h3>Platform setup</h3>
              </div>
              <Badge>Platform-wide</Badge>
            </div>
            <ol className="guide-steps compact">
              <li>Check `Overview` to confirm issuer, JWKS, and counts.</li>
              <li>Open `Products` and create the application you want to protect.</li>
              <li>Open `Clients` and register the exact redirect URI.</li>
              <li>Open `Users & Roles` and assign the role that should sign in.</li>
              <li>Open `Route Policies` and keep the rest denied by default.</li>
            </ol>
            <div className="guide-actions">
              <button className="secondary-button" type="button" onClick={() => onJumpTo('overview')}>
                Overview
              </button>
              <button className="secondary-button" type="button" onClick={() => onJumpTo('clients')}>
                Clients
              </button>
              <button className="ghost-button" type="button" onClick={() => onJumpTo('policies')}>
                Policies
              </button>
            </div>
          </article>

          <article className="help-card">
            <div className="help-card-head">
              <div>
                <p className="eyebrow">Tenant owners</p>
                <h3>Product-scoped setup</h3>
              </div>
              <Badge>{effectiveMode === 'admin' ? 'Available in tenant mode' : 'Current mode'}</Badge>
            </div>
            <ol className="guide-steps compact">
              <li>Select the right `Product` and `Workspace` first.</li>
              <li>Register the tenant app in `Clients`.</li>
              <li>Map people or groups in `Users & Roles`.</li>
              <li>Protect the app with `Route Policies`.</li>
              <li>Use `Sessions` and `Audit` to confirm behavior.</li>
            </ol>
            <div className="guide-actions">
              <button className="secondary-button" type="button" onClick={() => onJumpTo('clients')}>
                Clients
              </button>
              <button className="secondary-button" type="button" onClick={() => onJumpTo('users')}>
                Users
              </button>
              <button className="ghost-button" type="button" onClick={() => onJumpTo('sessions')}>
                Sessions
              </button>
            </div>
          </article>
        </div>

        <div className="help-modal-grid help-modal-grid-small">
          <article className="help-card">
            <p className="eyebrow">What to fill in</p>
            <dl className="guide-field-list">
              <div>
                <dt>Mode</dt>
                <dd>Admin operator, tenant owner, or end user.</dd>
              </div>
              <div>
                <dt>Username</dt>
                <dd>Use a local account such as `admin@pubauth.local` or a provider-backed identity later.</dd>
              </div>
              <div>
                <dt>Password</dt>
                <dd>Local accounts are persisted and hashed; seeded credentials are only for initial bootstrap.</dd>
              </div>
            </dl>
          </article>

          <article className="help-card">
            <p className="eyebrow">What happens next</p>
            <ol className="guide-steps compact">
              <li>The browser redirects to the issuer authorize endpoint.</li>
              <li>PubAuth returns the code through the web callback.</li>
              <li>The token endpoint issues signed RS256 tokens.</li>
              <li>The console opens in the correct admin, tenant, or self-service scope.</li>
            </ol>
          </article>
        </div>
      </div>
    </>
  );
}

function LoginScreen({
  bootstrap,
  loading,
  error,
  authBusy,
  authError,
  loginForm,
  setLoginForm,
  onOpenHelp,
  onLogin,
  onLoginAsAdmin,
  onLoginAsTenant,
  onLoginAsUser,
}: {
  bootstrap: BootstrapPayload | null;
  loading: boolean;
  error: string | null;
  authBusy: boolean;
  authError: string | null;
  loginForm: LoginFormState;
  setLoginForm: (updater: LoginFormState | ((current: LoginFormState) => LoginFormState)) => void;
  onOpenHelp: () => void;
  onLogin: () => void;
  onLoginAsAdmin: () => void;
  onLoginAsTenant: () => void;
  onLoginAsUser: () => void;
}) {
  return (
    <div className="auth-shell">
      <section className="auth-panel panel">
        <div className="brand-block">
          <div className="brand-mark">P</div>
          <div>
            <p className="eyebrow">OIDC login</p>
            <h1>Sign in to PubAuth</h1>
          </div>
        </div>

        <p className="lede">
          Admin operators, tenant owners, and end users sign in through the same Authorization Code + PKCE flow. PubAuth creates a real
          control-plane session first, then completes OIDC against the issuer.
        </p>

        <div className="login-inline-guide">
          <span>Admin: platform-wide auth, policy, keys, and audit.</span>
          <span>Tenant: product-scoped clients, routes, and memberships.</span>
          <span>User: profile, sessions, and recent activity.</span>
          <button className="ghost-button compact" type="button" onClick={onOpenHelp}>
            Open guide
          </button>
        </div>

        <div className="login-grid">
          <label>
            Mode
            <select
              value={loginForm.profile}
              onChange={(event) =>
                setLoginForm((current) => {
                  const profile =
                    event.target.value === 'admin' ? 'admin' : event.target.value === 'tenant' ? 'tenant' : 'user';
                  return {
                    ...current,
                    profile,
                    username:
                      profile === 'admin'
                        ? 'admin@pubauth.local'
                        : profile === 'tenant'
                          ? 'owner@atlas.local'
                          : 'user@atlas.local',
                    password:
                      profile === 'admin'
                        ? 'ChangeMe-Admin!1'
                        : profile === 'tenant'
                          ? 'ChangeMe-Tenant!1'
                          : 'ChangeMe-User!1',
                  };
                })
              }
            >
              <option value="admin">Admin operator</option>
              <option value="tenant">Tenant owner</option>
              <option value="user">End user</option>
            </select>
          </label>
          <label>
            Username
            <input
              value={loginForm.username}
              onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
              placeholder="admin@pubauth.local"
              autoComplete="username"
            />
          </label>
          <label className="wide">
            Password
            <input
              value={loginForm.password}
              onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="ChangeMe-Admin!1"
              type="password"
              autoComplete="current-password"
            />
          </label>
        </div>

        <details className="advanced-login">
          <summary>Bootstrap credentials</summary>
          <div className="advanced-login-body">
            <p className="help-text">
              Seeded local accounts exist for immediate setup. In production, replace them with rotated credentials or external providers.
            </p>
          </div>
        </details>

        <div className="login-actions">
          <button className="primary-button" type="button" onClick={onLogin} disabled={authBusy || loading || !bootstrap}>
            {authBusy ? 'Signing in and redirecting' : 'Sign in'}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={onLoginAsAdmin}
          >
            Admin demo
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={onLoginAsTenant}
          >
            Tenant demo
          </button>
          <button className="ghost-button" type="button" onClick={onLoginAsUser}>
            User demo
          </button>
        </div>

        <div className="login-meta">
          <KeyValueList
            items={[
              ['API issuer', bootstrap?.runtime.issuer ?? 'pending'],
              ['API base', bootstrap?.runtime.apiBase ?? 'pending'],
              ['Browser authorize', '/api/auth/authorize'],
              ['Browser token', '/api/auth/token'],
            ]}
          />
        </div>

        {authError || error ? (
          <div className="login-error">
            <strong>{authError ? 'Login failed' : 'Bootstrap error'}</strong>
            <span>{authError ?? error}</span>
          </div>
        ) : null}
      </section>

      <aside className="auth-panel panel">
        <div className="launch-card">
          <p className="eyebrow">Choose a path</p>
          <h3>One UI, three access patterns</h3>
          <p className="path-copy">
            Admin operators manage the platform, tenant owners manage one product scope, and end users get their own self-service surface.
          </p>
          <div className="launch-actions">
            <button className="secondary-button" type="button" onClick={onLoginAsAdmin}>
              Admin demo
            </button>
            <button className="ghost-button" type="button" onClick={onLoginAsTenant}>
              Tenant demo
            </button>
            <button className="ghost-button" type="button" onClick={onLoginAsUser}>
              User demo
            </button>
          </div>
          <div className="launch-divider" />
          <KeyValueList
            items={[
              ['Mode', 'Admin operator, tenant owner, or end user'],
              ['Auth path', 'Local account session plus OIDC code flow'],
              ['Surface', 'Control plane or self-service by role'],
            ]}
          />
          <button className="ghost-button full-width" type="button" onClick={onOpenHelp}>
            Open usage guide
          </button>
        </div>
      </aside>
    </div>
  );
}

function UserPortal({
  auth,
  authError,
  authBusy,
  overview,
  onRefresh,
  onSignOut,
}: {
  auth: AuthState;
  authError: string | null;
  authBusy: boolean;
  overview: SelfServiceOverview | null;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar panel">
        <div className="brand-block">
          <div className="brand-mark">P</div>
          <div>
            <p className="eyebrow">Self-service portal</p>
            <h1>PubAuth</h1>
          </div>
        </div>

        <div className="sidebar-section auth-summary">
          <p className="eyebrow">Signed in</p>
          <strong>{overview?.user.displayName ?? auth.subjectId}</strong>
          <p className="sidebar-note">{overview?.user.email ?? auth.subjectId}</p>
          <button className="ghost-button" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar panel">
          <div className="topbar-left">
            <div>
              <p className="eyebrow">End-user surface</p>
              <div className="topline">
                <StatusPill tone={overview ? 'success' : authBusy ? 'muted' : 'neutral'}>
                  {overview ? 'Live' : authBusy ? 'Loading' : 'Ready'}
                </StatusPill>
                <StatusPill tone="neutral">{auth.workspaceId}</StatusPill>
              </div>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button" type="button" onClick={onRefresh}>
              Refresh
            </button>
            <button className="ghost-button" type="button" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </header>

        <main className="content">
          <section className="hero panel">
            <div className="hero-copy">
              <p className="eyebrow">Your access</p>
              <h2>Profile, sessions, and recent activity in one place.</h2>
              <p className="lede">
                This surface is user-scoped. It does not expose control-plane administration and only shows your current identity state.
              </p>
            </div>
            <div className="hero-side">
              <KeyValueList
                items={[
                  ['Subject', overview?.user.subjectId ?? auth.subjectId],
                  ['Username', overview?.user.username ?? 'loading'],
                  ['Workspace', overview?.user.workspaceId ?? auth.workspaceId],
                  ['Roles', overview?.user.roles.join(', ') || 'none'],
                ]}
              />
            </div>
          </section>

          <section className="overview-grid">
            <div className="section-panel panel">
              <SectionHead title="Profile" subtitle="Identity record" />
              <KeyValueList
                items={[
                  ['Display name', overview?.user.displayName ?? 'loading'],
                  ['Email', overview?.user.email ?? 'loading'],
                  ['Auth mode', 'Local account + OIDC'],
                  ['Session count', String(overview?.sessions.length ?? 0)],
                ]}
              />
            </div>

            <div className="section-panel panel">
              <SectionTable
                title="Sessions"
                subtitle="Active browser sessions"
                actionLabel="Refresh"
                onAction={onRefresh}
                columns={['Session', 'Created', 'Expires', 'State']}
                items={overview?.sessions ?? []}
                renderRow={(item: SelfServiceOverview['sessions'][number]) => [
                  item.id,
                  formatTimestamp(item.createdAt),
                  formatTimestamp(item.expiresAt),
                  item.revokedAt ? 'revoked' : 'active',
                ]}
                empty={<EmptyState title="No sessions" description="New sessions appear after successful sign-in." />}
              />
            </div>
          </section>

          <section className="section-panel panel">
            <SectionTable
              title="Recent Activity"
              subtitle="Security-relevant events"
              actionLabel="Refresh"
              onAction={onRefresh}
              columns={['Event', 'Outcome', 'Description', 'Time']}
              items={overview?.recentAuditEvents ?? []}
              renderRow={(item: SelfServiceOverview['recentAuditEvents'][number]) => [
                item.action,
                item.outcome,
                item.description,
                formatTimestamp(item.createdAt),
              ]}
              empty={<EmptyState title="No recent activity" description="Login and security events will appear here." />}
            />
          </section>

          {authError ? (
            <section className="login-error">
              <strong>Portal error</strong>
              <span>{authError}</span>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function getDrawerTitle(drawer: DrawerState): string {
  if (!drawer) {
    return 'Details';
  }

  if (drawer.kind === 'create') {
    return `New ${drawer.type}`;
  }

  switch (drawer.type) {
    case 'product':
      return 'Product details';
    case 'workspace':
      return 'Workspace details';
    case 'client':
      return 'Client details';
    case 'policy':
      return 'Policy details';
    case 'role':
      return 'Role details';
    case 'assignment':
      return 'Assignment details';
    case 'principal':
      return 'Principal details';
    case 'session':
      return 'Session details';
    case 'signingKey':
      return 'Signing key details';
    case 'audit':
      return 'Audit event details';
  }
}

function getVisibleSections(mode: ConsoleMode) {
  if (mode === 'user') {
    return userSections;
  }

  return mode === 'admin' ? adminSections : tenantSections;
}

function buildPaletteActions({
  setPaletteOpen,
  setDrawer,
  setMode,
  setSection,
  reload,
  openHelp,
  mode,
}: {
  setPaletteOpen: (value: boolean) => void;
  setDrawer: (value: DrawerState) => void;
  setMode: (value: ConsoleMode) => void;
  setSection: (value: SectionId) => void;
  reload: () => Promise<void>;
  openHelp: () => void;
  mode: ConsoleMode;
}): PaletteAction[] {
  return [
    { id: 'refresh', label: 'Refresh runtime', category: 'Runtime', description: 'Reload bootstrap and live admin inventory.', run: () => void reload() },
    { id: 'admin', label: 'Switch to admin console', category: 'Mode', description: 'Show platform-wide inventory and controls.', run: () => setMode('admin') },
    { id: 'tenant', label: 'Switch to tenant console', category: 'Mode', description: 'Show the active product and workspace scope.', run: () => setMode('tenant') },
    { id: 'help', label: 'Open help guide', category: 'Help', description: 'Show the usage guide modal.', run: () => openHelp() },
    { id: 'overview', label: 'Open overview', category: 'Section', description: 'View health, counts, and recent activity.', run: () => setSection('overview') },
    { id: 'clients', label: 'Open clients', category: 'Section', description: 'Inspect OIDC client registrations.', run: () => setSection('clients') },
    { id: 'policies', label: 'Open policies', category: 'Section', description: 'Inspect gateway route rules.', run: () => setSection('policies') },
    { id: 'sessions', label: 'Open sessions', category: 'Section', description: 'Inspect active sessions and expiry state.', run: () => setSection('sessions') },
    { id: 'audit', label: 'Open audit log', category: 'Section', description: 'Inspect operational history.', run: () => setSection('audit') },
    { id: 'create-product', label: 'Create product', category: 'Provisioning', description: 'Open the product creation drawer.', run: () => setDrawer({ kind: 'create', type: 'product' }) },
    { id: 'create-client', label: 'Create client', category: 'Provisioning', description: 'Open the client creation drawer.', run: () => setDrawer({ kind: 'create', type: 'client' }) },
    { id: 'create-policy', label: 'Create policy', category: 'Provisioning', description: 'Open the route policy drawer.', run: () => setDrawer({ kind: 'create', type: 'policy' }) },
    { id: 'assign-role', label: 'Assign role', category: 'Provisioning', description: 'Open the role assignment drawer.', run: () => setDrawer({ kind: 'create', type: 'assignment' }) },
  ].filter((action) => (mode === 'tenant' ? !['create-product'].includes(action.id) : true));
}

function applyScope<T extends { productId?: string; workspaceId?: string }>(items: T[], mode: ConsoleMode, scopeId: string): T[] {
  if (mode !== 'tenant') {
    return items;
  }

  return items.filter((item) => {
    if ('productId' in item && item.productId) {
      return item.productId === scopeId;
    }
    if ('workspaceId' in item && item.workspaceId) {
      return item.workspaceId === scopeId;
    }
    return true;
  });
}

function filterRecords<T>(items: T[], query: string, projector: (item: T) => string): T[] {
  if (!query) {
    return items;
  }

  return items.filter((item) => projector(item).toLowerCase().includes(query));
}

function buildPrincipalRows(
  assignments: BootstrapPayload['admin']['assignments'],
  sessions: BootstrapPayload['admin']['sessions'],
) {
  const map = new Map<
    string,
    {
      userId: string;
      workspaceId?: string;
      roles: Set<string>;
      sessionCount: number;
      lastSeen: string | null;
      source: 'assignment' | 'session';
    }
  >();

  for (const assignment of assignments) {
    const key = `${assignment.userId}:${assignment.workspaceId ?? 'global'}`;
    const current = map.get(key) ?? {
      userId: assignment.userId,
      workspaceId: assignment.workspaceId,
      roles: new Set<string>(),
      sessionCount: 0,
      lastSeen: null,
      source: 'assignment' as const,
    };
    current.roles.add(assignment.role);
    map.set(key, current);
  }

  for (const session of sessions) {
    const key = `${session.subjectId}:${session.workspaceId}`;
    const current = map.get(key) ?? {
      userId: session.subjectId,
      workspaceId: session.workspaceId,
      roles: new Set<string>(),
      sessionCount: 0,
      lastSeen: null,
      source: 'session' as const,
    };
    current.sessionCount += 1;
    if (!current.lastSeen || new Date(session.createdAt).getTime() > new Date(current.lastSeen).getTime()) {
      current.lastSeen = session.createdAt;
    }
    map.set(key, current);
  }

  return [...map.values()]
    .map((item) => ({
      ...item,
      roles: [...item.roles],
    }))
    .sort((left, right) => left.userId.localeCompare(right.userId));
}

function formatTimestamp(value: string): string {
  try {
    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function handleRowKeyDown(event: ReactKeyboardEvent<HTMLTableRowElement>, handler: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handler();
  }
}

async function startLogin({
  bootstrap,
  loginForm,
  setAuthBusy,
  setAuthError,
}: {
  bootstrap: BootstrapPayload | null;
  loginForm: LoginFormState;
  setAuthBusy: (value: boolean) => void;
  setAuthError: (value: string | null) => void;
}) {
  if (!bootstrap) {
    setAuthError('bootstrap_not_ready');
    return;
  }

  setAuthBusy(true);
  setAuthError(null);

  try {
    const codeVerifier = createPkceVerifier();
    const codeChallenge = await createPkceChallenge(codeVerifier);
    const state = crypto.randomUUID();
    const clientId = bootstrap.admin.clients[0]?.clientId ?? 'pubauth-client';
    const redirectUri = `${window.location.origin}/auth/callback`;

    const sessionResponse = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        username: loginForm.username.trim(),
        password: loginForm.password,
      }),
    });
    const sessionPayload = (await sessionResponse.json()) as {
      ok?: boolean;
      error?: string;
    };
    if (!sessionResponse.ok || !sessionPayload.ok) {
      throw new Error(sessionPayload.error ?? `session_bootstrap_failed_${sessionResponse.status}`);
    }

    const intent: LoginIntent = {
      state,
      codeVerifier,
      clientId,
      redirectUri,
      mode: loginForm.profile,
    };

    saveLoginIntent(intent);

    const authorizeUrl = new URL('/api/auth/authorize', window.location.origin);
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'openid profile email groups');
    authorizeUrl.searchParams.set('code_challenge', codeChallenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    authorizeUrl.searchParams.set('state', state);

    window.location.assign(authorizeUrl.toString());
  } catch (caught) {
    setAuthBusy(false);
    setAuthError(caught instanceof Error ? caught.message : 'login_failed');
  }
}

async function completeLogin({
  bootstrap,
  code,
  state,
  setAuth,
  setAuthBusy,
  setAuthError,
  setMode,
  setSelectedWorkspaceId,
  setSection,
}: {
  bootstrap: BootstrapPayload;
  code: string;
  state: string | null;
  setAuth: (value: AuthState | null) => void;
  setAuthBusy: (value: boolean) => void;
  setAuthError: (value: string | null) => void;
  setMode: (value: ConsoleMode) => void;
  setSelectedWorkspaceId: (value: string) => void;
  setSection: (value: SectionId) => void;
}) {
  const intent = readLoginIntent();
  if (!intent) {
    setAuthError('login_intent_missing');
    return;
  }

  if (state && intent.state !== state) {
    setAuthError('login_state_mismatch');
    return;
  }

  setAuthBusy(true);
  setAuthError(null);

  try {
    const tokenResponse = await fetch('/api/auth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: intent.clientId,
        redirect_uri: intent.redirectUri,
        code,
        code_verifier: intent.codeVerifier,
      }),
    });

    const tokenPayload = (await tokenResponse.json()) as {
      accessToken?: string;
      idToken?: string;
      expiresIn?: number;
      error?: string;
    };

    if (!tokenResponse.ok || !tokenPayload.accessToken || !tokenPayload.expiresIn) {
      throw new Error(tokenPayload.error ?? `token_exchange_failed_${tokenResponse.status}`);
    }

    const userInfoResponse = await fetch('/api/auth/userinfo', {
      headers: {
        authorization: `Bearer ${tokenPayload.accessToken}`,
      },
    });

    const userInfoPayload = (await userInfoResponse.json()) as {
      sub?: string;
      workspace?: string;
      roles?: unknown;
      groups?: unknown;
      error?: string;
    };

    if (!userInfoResponse.ok || !userInfoPayload.sub) {
      throw new Error(userInfoPayload.error ?? `userinfo_failed_${userInfoResponse.status}`);
    }

    const roles = normalizeStringArray(userInfoPayload.roles);
    const groups = normalizeStringArray(userInfoPayload.groups);
    const workspaceId = userInfoPayload.workspace ?? '';
    const hasAdminRole = roles.some((role) => role === 'super_admin' || role === 'tenant_admin' || role === 'product_admin');
    const mode = intent.mode === 'admin' && hasAdminRole ? 'admin' : intent.mode === 'tenant' && hasAdminRole ? 'tenant' : 'user';
    const authState: AuthState = {
      subjectId: userInfoPayload.sub,
      workspaceId,
      roles,
      groups,
      mode,
      oidcCompleted: Boolean(tokenPayload.idToken),
    };

    setAuth(authState);
    setMode(mode);
    setSelectedWorkspaceId(workspaceId);
    setSection('overview');
    clearLoginIntent();
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (caught) {
    setAuth(null);
    setAuthError(caught instanceof Error ? caught.message : 'login_failed');
  } finally {
    setAuthBusy(false);
  }
}

async function loadSelfServiceOverview(
  setOverview: (value: SelfServiceOverview | null) => void,
  setAuthError: (value: string | null) => void,
) {
  try {
    const response = await fetch('/api/me/overview');
    const payload = (await response.json()) as SelfServiceOverview & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? `self_service_overview_failed_${response.status}`);
    }
    setOverview(payload);
  } catch (caught) {
    setAuthError(caught instanceof Error ? caught.message : 'self_service_overview_failed');
  }
}

async function restoreSessionAuth({
  setAuth,
  setMode,
  setSelectedWorkspaceId,
  setAuthError,
}: {
  setAuth: (value: AuthState | null) => void;
  setMode: (value: ConsoleMode) => void;
  setSelectedWorkspaceId: (value: string) => void;
  setAuthError: (value: string | null) => void;
}) {
  try {
    const response = await fetch('/api/auth/session');
    if (response.status === 401) {
      setAuth(null);
      return;
    }

    const payload = (await response.json()) as SelfServiceOverview & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? `session_restore_failed_${response.status}`);
    }

    const authState = buildAuthStateFromOverview(payload, false);
    setAuth(authState);
    setMode(authState.mode);
    setSelectedWorkspaceId(authState.workspaceId);
    setAuthError(null);
  } catch (caught) {
    setAuth(null);
    setAuthError(caught instanceof Error ? caught.message : 'session_restore_failed');
  }
}

function buildAuthStateFromOverview(overview: SelfServiceOverview, oidcCompleted: boolean): AuthState {
  const roles = [...overview.user.roles];
  const hasAdminRole = roles.some((role) => role === 'super_admin');
  const hasTenantRole = roles.some((role) => role === 'tenant_admin' || role === 'product_admin');

  return {
    subjectId: overview.user.subjectId,
    workspaceId: overview.user.workspaceId,
    roles,
    groups: [],
    mode: hasAdminRole ? 'admin' : hasTenantRole ? 'tenant' : 'user',
    oidcCompleted,
  };
}

async function logout({
  setAuth,
  setAuthBusy,
  setAuthError,
  setMode,
  setSection,
}: {
  setAuth: (value: AuthState | null) => void;
  setAuthBusy: (value: boolean) => void;
  setAuthError: (value: string | null) => void;
  setMode: (value: ConsoleMode) => void;
  setSection: (value: SectionId) => void;
}) {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Local state must still clear even if the session endpoint is unavailable.
  }

  clearAuthState();
  clearLoginIntent();
  setAuth(null);
  setAuthBusy(false);
  setAuthError(null);
  setMode('tenant');
  setSection('overview');
  window.history.replaceState({}, document.title, window.location.pathname);
}

function clearAuthState() {
  return;
}

function saveLoginIntent(value: {
  state: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  mode: ConsoleMode;
}) {
  window.sessionStorage.setItem(loginIntentStorageKey, JSON.stringify(value));
}

function readLoginIntent(): LoginIntent | null {
  const raw = window.sessionStorage.getItem(loginIntentStorageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as LoginIntent;
    if (
      !parsed ||
      typeof parsed.state !== 'string' ||
      typeof parsed.codeVerifier !== 'string' ||
      typeof parsed.clientId !== 'string' ||
      typeof parsed.redirectUri !== 'string' ||
      (parsed.mode !== 'admin' && parsed.mode !== 'tenant' && parsed.mode !== 'user')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearLoginIntent() {
  window.sessionStorage.removeItem(loginIntentStorageKey);
}

async function createPkceChallenge(verifier: string): Promise<string> {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function createPkceVerifier(): string {
  const bytes = new Uint8Array(64);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}
