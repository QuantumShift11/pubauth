import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { ActionResult, BootstrapPayload } from './types.js';

type ConsoleMode = 'admin' | 'tenant';
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

const defaultFormState: FormState = {
  productName: 'Nebula',
  productSlug: 'nebula',
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
  policyRoles: 'admin,editor',
  roleName: 'auditor',
  assignmentUserId: 'user-1',
  assignmentRole: 'admin',
  assignmentWorkspaceId: 'workspace-core-platform',
};

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

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<LogEntry[]>([]);
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [mode, setMode] = useState<ConsoleMode>('admin');
  const [section, setSection] = useState<SectionId>('overview');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    void loadBootstrap();
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
  }, [bootstrap]);

  useEffect(() => {
    const visibleSections = getVisibleSections(mode);
    if (!visibleSections.some((item) => item.id === section)) {
      setSection('overview');
    }
  }, [mode, section]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const isMetaK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isMetaK) {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }

      if (event.key === 'Escape') {
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
  }, [paletteOpen, drawer]);

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
  const sections = getVisibleSections(mode);
  const activeProduct = admin?.products.find((item) => item.id === selectedProductId) ?? admin?.products[0] ?? null;
  const activeWorkspace = admin?.workspaces.find((item) => item.id === selectedWorkspaceId) ?? admin?.workspaces[0] ?? null;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const scopedProducts = filterRecords(admin?.products ?? [], normalizedSearch, (item) =>
    [item.name, item.slug, item.environment, item.status, item.id].join(' '),
  );
  const scopedWorkspaces = filterRecords(admin?.workspaces ?? [], normalizedSearch, (item) =>
    [item.name, item.slug, item.state, item.id].join(' '),
  );
  const scopedClients = filterRecords(applyScope(admin?.clients ?? [], mode, selectedProductId), normalizedSearch, (item) =>
    [item.clientId, item.productId, item.clientType, item.allowedRedirectUris?.join(' '), item.allowedScopes?.join(' ')].join(' '),
  );
  const scopedPolicies = filterRecords(applyScope(admin?.routePolicies ?? [], mode, selectedProductId), normalizedSearch, (item) =>
    [item.pathPattern, item.productId, item.upstreamUrl, item.methods.join(' '), item.requiredRoles.join(' '), item.state].join(' '),
  );
  const scopedAssignments = filterRecords(applyScope(admin?.assignments ?? [], mode, selectedWorkspaceId), normalizedSearch, (item) =>
    [item.userId, item.role, item.workspaceId ?? '', item.createdAt].join(' '),
  );
  const scopedSessions = filterRecords(applyScope(admin?.sessions ?? [], mode, selectedWorkspaceId), normalizedSearch, (item) =>
    [item.id, item.subjectId, item.workspaceId, item.expiresAt, item.revokedAt ?? ''].join(' '),
  );
  const scopedAuditEvents = filterRecords(applyScope(admin?.auditEvents ?? [], mode, selectedWorkspaceId), normalizedSearch, (item) =>
    [item.actor, item.action, item.entityType, item.entityId, item.description, item.outcome].join(' '),
  );
  const scopedSigningKeys = filterRecords(admin?.signingKeys ?? [], normalizedSearch, (item) =>
    [item.keyId, item.algorithm, item.status, item.createdAt].join(' '),
  );
  const principalRows = buildPrincipalRows(admin?.assignments ?? [], admin?.sessions ?? []);
  const scopedPrincipals = filterRecords(applyScope(principalRows, mode, selectedWorkspaceId), normalizedSearch, (item) =>
    [item.userId, item.workspaceId ?? '', item.roles.join(' '), item.sessionCount, item.lastSeen ?? ''].join(' '),
  );
  const recentAudit = scopedAuditEvents.slice(0, 6);
  const recentActivity = [...actionLog].slice(0, 6);
  const paletteActions = buildPaletteActions({
    setPaletteOpen,
    setDrawer,
    setMode,
    setSection,
    reload: loadBootstrap,
    mode,
  });
  const filteredPaletteActions = paletteActions.filter((item) =>
    [item.label, item.category, item.description].join(' ').toLowerCase().includes(paletteQuery.trim().toLowerCase()),
  );

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
            <button className={mode === 'admin' ? 'mode-chip active' : 'mode-chip'} type="button" onClick={() => setMode('admin')}>
              Admin Console
            </button>
            <button className={mode === 'tenant' ? 'mode-chip active' : 'mode-chip'} type="button" onClick={() => setMode('tenant')}>
              Tenant Console
            </button>
          </div>
          <p className="sidebar-note">
            {mode === 'admin'
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

        <div className="sidebar-section">
          <div className="quick-actions-title">
            <p className="eyebrow">Quick actions</p>
            <button className="ghost-button compact" type="button" onClick={() => setPaletteOpen(true)}>
              ⌘K
            </button>
          </div>
          <div className="quick-action-grid">
            <button className="ghost-button compact" type="button" onClick={() => setDrawer({ kind: 'create', type: 'product' })}>
              New product
            </button>
            <button className="ghost-button compact" type="button" onClick={() => setDrawer({ kind: 'create', type: 'client' })}>
              New client
            </button>
            <button className="ghost-button compact" type="button" onClick={() => setDrawer({ kind: 'create', type: 'policy' })}>
              New policy
            </button>
            <button className="ghost-button compact" type="button" onClick={() => setDrawer({ kind: 'create', type: 'assignment' })}>
              Assign role
            </button>
          </div>
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
                <StatusPill tone="muted">{mode === 'admin' ? 'Admin mode' : 'Tenant mode'}</StatusPill>
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
          </div>
        </header>

        <main className="content">
          <section className="hero panel">
            <div className="hero-copy">
              <p className="eyebrow">{mode === 'admin' ? 'Operator console' : 'Tenant console'}</p>
              <h2>{mode === 'admin' ? 'Operate PubAuth for products, policies, and tenants.' : 'Manage the active product and its tenant-facing auth surface.'}</h2>
              <p className="lede">
                PubAuth exposes a single React control plane with role-scoped views. The UI stays thin: the API remains the source of truth for
                OIDC, RBAC, gateway policy, sessions, and signing state.
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
              <Metric label="Sessions" value={String(admin?.counts.sessions ?? 0)} />
              <Metric label="Audit events" value={String(admin?.counts.auditEvents ?? 0)} />
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
  return mode === 'admin' ? adminSections : tenantSections;
}

function buildPaletteActions({
  setPaletteOpen,
  setDrawer,
  setMode,
  setSection,
  reload,
  mode,
}: {
  setPaletteOpen: (value: boolean) => void;
  setDrawer: (value: DrawerState) => void;
  setMode: (value: ConsoleMode) => void;
  setSection: (value: SectionId) => void;
  reload: () => Promise<void>;
  mode: ConsoleMode;
}): PaletteAction[] {
  return [
    { id: 'refresh', label: 'Refresh runtime', category: 'Runtime', description: 'Reload bootstrap and live admin inventory.', run: () => void reload() },
    { id: 'admin', label: 'Switch to admin console', category: 'Mode', description: 'Show platform-wide inventory and controls.', run: () => setMode('admin') },
    { id: 'tenant', label: 'Switch to tenant console', category: 'Mode', description: 'Show the active product and workspace scope.', run: () => setMode('tenant') },
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
