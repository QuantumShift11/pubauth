import { useEffect, useState, type ReactNode } from 'react';
import type { ActionResult, BootstrapPayload } from './types.js';

interface LogEntry {
  title: string;
  subtitle: string;
  status: number;
  body: unknown;
}

const defaultFormState = {
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
};

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<LogEntry[]>([]);
  const [formState, setFormState] = useState(defaultFormState);

  useEffect(() => {
    void loadBootstrap();
  }, []);

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

  function updateField(name: keyof typeof defaultFormState, value: string) {
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function submit(endpoint: string, body: Record<string, unknown>, subtitle: string) {
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
      ...current.slice(0, 4),
    ]);
  }

  const keyCount = bootstrap?.jwks.keys.length ?? 0;
  const productCount = bootstrap?.admin.counts.products ?? 0;
  const workspaceCount = bootstrap?.admin.counts.workspaces ?? 0;
  const clientCount = bootstrap?.admin.counts.clients ?? 0;
  const policyCount = bootstrap?.admin.counts.routePolicies ?? 0;

  return (
    <div className="shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">P</div>
          <div>
            <div className="eyebrow">Control plane</div>
            <h1>PubAuth</h1>
          </div>
        </div>

        <div className="status-row">
          <StatusPill tone={loading ? 'muted' : error ? 'danger' : 'success'}>
            {loading ? 'Syncing' : error ? 'Offline' : 'Live'}
          </StatusPill>
          <StatusPill tone="neutral">{bootstrap?.runtime.issuer ?? 'Issuer pending'}</StatusPill>
        </div>
      </header>

      <main className="layout">
        <section className="hero panel">
          <div className="hero-copy">
            <p className="eyebrow">Identity gateway + OIDC provider</p>
            <h2>One control surface for login, gateway policy, and tenant administration.</h2>
            <p className="lede">
              The UI is wired to the API over same-origin proxy endpoints, so the browser stays thin and the backend stays authoritative.
            </p>

            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => void loadBootstrap()}>
                Refresh runtime
              </button>
              <button className="ghost-button" type="button" onClick={() => setActionLog([])}>
                Clear activity
              </button>
            </div>
          </div>

          <div className="hero-metrics">
            <Metric label="API status" value={bootstrap?.api.status ?? 'loading'} />
            <Metric label="Issuer" value={bootstrap?.runtime.issuer ?? 'pending'} />
            <Metric label="JWKS keys" value={String(keyCount)} />
            <Metric label="Actions" value={String(actionLog.length)} />
            <Metric label="Products" value={String(productCount)} />
            <Metric label="Workspaces" value={String(workspaceCount)} />
            <Metric label="Clients" value={String(clientCount)} />
            <Metric label="Policies" value={String(policyCount)} />
          </div>
        </section>

        <section className="cards-grid">
          <InfoCard
            title="OIDC Discovery"
            subtitle="Backend contract"
            body={
              bootstrap ? (
                <dl className="definition-list">
                  <Entry label="Authorize" value={bootstrap.discovery.authorization_endpoint} />
                  <Entry label="Token" value={bootstrap.discovery.token_endpoint} />
                  <Entry label="JWKS" value={bootstrap.discovery.jwks_uri} />
                  <Entry label="UserInfo" value={bootstrap.discovery.userinfo_endpoint} />
                </dl>
              ) : (
                <SkeletonBlock />
              )
            }
          />

          <InfoCard
            title="Trust Boundary"
            subtitle="Gateway behavior"
            body={
              <ul className="feature-list">
                <li>Strip inbound `x-pubauth-*` headers before forwarding.</li>
                <li>Validate bearer or session credentials at the edge.</li>
                <li>Inject trusted headers only after policy allow.</li>
                <li>Deny unknown routes by default.</li>
              </ul>
            }
          />

          <InfoCard
            title="Production posture"
            subtitle="Current status"
            body={
              <ul className="feature-list">
                <li>OIDC code + PKCE flow is signed with RS256.</li>
                <li>JWKS only exposes public keys.</li>
                <li>Admin state is persisted to the API data directory.</li>
                <li>UI is wired to live API and admin overview data.</li>
              </ul>
            }
          />

          <InfoCard
            title="Managed inventory"
            subtitle="Live objects"
            body={
              bootstrap ? (
                <div className="inventory-stack">
                  <CompactGroup label="Products" items={bootstrap.admin.products.map((item) => `${item.name} (${item.slug})`)} />
                  <CompactGroup label="Workspaces" items={bootstrap.admin.workspaces.map((item) => `${item.name} (${item.slug})`)} />
                  <CompactGroup label="Clients" items={bootstrap.admin.clients.map((item) => `${item.clientId} / ${item.productId}`)} />
                  <CompactGroup label="Policies" items={bootstrap.admin.routePolicies.map((item) => `${item.pathPattern} [${item.methods.join(', ')}]`)} />
                </div>
              ) : (
                <SkeletonBlock />
              )
            }
          />
        </section>

        <section className="workspace">
          <div className="panel form-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Admin surface</p>
                <h3>Provisioning console</h3>
              </div>
              <button className="secondary-button" type="button" onClick={() => void loadBootstrap()}>
                Re-sync
              </button>
            </div>

            {error ? <div className="error-banner">{error}</div> : null}

            <div className="form-grid">
              <label>
                Product name
                <input value={formState.productName} onChange={(event) => updateField('productName', event.target.value)} />
              </label>
              <label>
                Product slug
                <input value={formState.productSlug} onChange={(event) => updateField('productSlug', event.target.value)} />
              </label>
              <label>
                Workspace name
                <input value={formState.workspaceName} onChange={(event) => updateField('workspaceName', event.target.value)} />
              </label>
              <label>
                Workspace slug
                <input value={formState.workspaceSlug} onChange={(event) => updateField('workspaceSlug', event.target.value)} />
              </label>
              <label>
                Client product id
                <input value={formState.clientProductId} onChange={(event) => updateField('clientProductId', event.target.value)} />
              </label>
              <label>
                Client type
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
              <label>
                Policy product id
                <input value={formState.policyProductId} onChange={(event) => updateField('policyProductId', event.target.value)} />
              </label>
              <label className="wide">
                Upstream URL
                <input value={formState.policyUpstreamUrl} onChange={(event) => updateField('policyUpstreamUrl', event.target.value)} />
              </label>
              <label>
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
            </div>

            <div className="button-grid">
              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  void submit(
                    '/api/admin/products',
                    {
                      name: formState.productName,
                      slug: formState.productSlug,
                      environment: 'local',
                    },
                    'Create product',
                  )
                }
              >
                Create product
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  void submit(
                    '/api/admin/workspaces',
                    {
                      name: formState.workspaceName,
                      slug: formState.workspaceSlug,
                    },
                    'Create workspace',
                  )
                }
              >
                Create workspace
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  void submit(
                    '/api/admin/clients',
                    {
                      productId: formState.clientProductId,
                      clientType: formState.clientType,
                      redirectUris: [formState.clientRedirectUri],
                      scopes: formState.clientScopes.split(' ').filter(Boolean),
                    },
                    'Create client',
                  )
                }
              >
                Create client
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  void submit(
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
              >
                Create route policy
              </button>
            </div>
          </div>

          <aside className="panel side-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Activity</p>
                <h3>Latest responses</h3>
              </div>
            </div>

            <div className="activity-list">
              {actionLog.length === 0 ? (
                <div className="empty-state">
                  <strong>No actions yet.</strong>
                  <span>Use the forms to exercise the API wiring.</span>
                </div>
              ) : (
                actionLog.map((entry) => <ActivityItem key={`${entry.title}-${entry.subtitle}-${entry.status}-${entry.body ? 'b' : 'n'}`} entry={entry} />)
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: 'success' | 'danger' | 'muted' | 'neutral'; children: string }) {
  return <span className={`status-pill tone-${tone}`}>{children}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoCard({ title, subtitle, body }: { title: string; subtitle: string; body: ReactNode }) {
  return (
    <article className="panel info-card">
      <p className="eyebrow">{subtitle}</p>
      <h3>{title}</h3>
      <div>{body}</div>
    </article>
  );
}

function Entry({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function SkeletonBlock() {
  return (
    <div className="skeleton-stack">
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
      <div className="skeleton-line" />
    </div>
  );
}

function ActivityItem({ entry }: { entry: LogEntry }) {
  return (
    <article className="activity-item">
      <div className="activity-head">
        <span className="activity-title">{entry.subtitle}</span>
        <span className="status-pill tone-neutral">{entry.status}</span>
      </div>
      <strong>{entry.title}</strong>
      <pre>{JSON.stringify(entry.body, null, 2)}</pre>
    </article>
  );
}

function CompactGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="compact-group">
      <strong>{label}</strong>
      {items.length > 0 ? (
        <ul>
          {items.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <span>None yet</span>
      )}
    </div>
  );
}
