import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { apiRequest } from './api';

type ViewKey = 'catalog' | 'customers' | 'inventory' | 'sales' | 'purchasing' | 'finance' | 'reports' | 'prescriptions' | 'operations' | 'subscription' | 'settings' | 'branches';
type RecordValue = Record<string, unknown>;

const managerViews: Array<{ key: ViewKey; label: string; path: string; permission: string }> = [
  { key: 'catalog', label: 'Catalog', path: '/catalog/products?pageSize=100', permission: 'catalog.read' },
  { key: 'customers', label: 'Customers', path: '/sales/customers', permission: 'sales.read' },
  { key: 'inventory', label: 'Inventory', path: '/inventory/batches', permission: 'inventory.read' },
  { key: 'sales', label: 'Sales', path: '/sales', permission: 'sales.read' },
  { key: 'purchasing', label: 'Purchasing', path: '/purchasing/orders', permission: 'purchasing.read' },
  { key: 'finance', label: 'Cash & payments', path: '/cash/registers', permission: 'payments.read' },
  { key: 'reports', label: 'Reports', path: '/reports?type=SALES', permission: 'reports.read' },
  { key: 'prescriptions', label: 'Prescriptions', path: '/prescriptions', permission: 'prescription.read' },
  { key: 'operations', label: 'Jobs & alerts', path: '/jobs/failed', permission: 'jobs.read' },
  { key: 'subscription', label: 'Subscription', path: '/subscriptions/current', permission: 'subscription.read' },
  { key: 'settings', label: 'Settings', path: '/settings', permission: 'settings.read' },
  { key: 'branches', label: 'Branches', path: '/branches', permission: 'branch.read' },
];

function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function text(value: unknown): string { if (value === null || value === undefined) return ''; if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value); return JSON.stringify(value); }

function JsonTable({ value }: { value: unknown }): ReactElement {
  const rows = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.entries(value as RecordValue).map(([key, entry]) => ({ key, value: entry })) : [{ value }];
  if (!rows.length) return <p className="empty-state">No records found.</p>;
  return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>#</th><th>Record</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td>{index + 1}</td><td><pre>{JSON.stringify(row, null, 2)}</pre></td></tr>)}</tbody></table></div>;
}

function ApiActionConsole(): ReactElement {
  const [method, setMethod] = useState('POST');
  const [path, setPath] = useState('/catalog/products');
  const [body, setBody] = useState('{}');
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState('Use this for workflow actions such as approve, receive, close, pay, review, or export.');

  async function execute(event: FormEvent) {
    event.preventDefault();
    try {
      const parsed: unknown = body.trim() ? JSON.parse(body) : undefined;
      setResult(await apiRequest(path, { method, ...(parsed ? { body: JSON.stringify(parsed) } : {}) }));
      setMessage('Request completed');
    } catch (error) { setMessage(errorText(error)); }
  }

  return <section className="manager-card api-console"><div className="card-heading"><div><p className="section-label">Workflow action</p><h3>API action console</h3></div><span className="count-badge">authenticated</span></div><form onSubmit={(event) => void execute(event)} className="action-form"><select value={method} onChange={(event) => setMethod(event.target.value)} aria-label="HTTP method"><option>POST</option><option>PATCH</option><option>GET</option><option>DELETE</option></select><input value={path} onChange={(event) => setPath(event.target.value)} aria-label="API path" placeholder="/endpoint" /><button className="primary-action">Run request</button><textarea value={body} onChange={(event) => setBody(event.target.value)} aria-label="JSON body" rows={5} /></form><p className="notice">{message}</p>{result !== null && <JsonTable value={result} />}</section>;
}

function CatalogView(): ReactElement {
  const [kind, setKind] = useState<'products' | 'companies' | 'groups' | 'suppliers'>('products');
  const [items, setItems] = useState<RecordValue[]>([]);
  const [form, setForm] = useState({ name: '', sku: '', purchasePrice: '', sellingPrice: '', minimumStock: '0', companyId: '', groupId: '', phone: '', email: '' });
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');

  async function load() {
    try {
      const path = kind === 'products' ? '/catalog/products?pageSize=100' : `/catalog/${kind}`;
      const data = await apiRequest<{ items?: RecordValue[] } | RecordValue[]>(path);
      setItems(Array.isArray(data) ? data : data.items ?? []);
    } catch (error) { setMessage(errorText(error)); }
  }
  useEffect(() => { void load(); }, [kind]);

  function update(field: string, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const editingProduct = kind === 'products' && Boolean(selectedId);
      const path = editingProduct ? `/catalog/products/${selectedId}` : kind === 'products' ? '/catalog/products' : `/catalog/${kind}`;
      const body = kind === 'products' ? { name: form.name, sku: form.sku, purchasePrice: Number(form.purchasePrice), sellingPrice: Number(form.sellingPrice), minimumStock: Number(form.minimumStock), ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.groupId ? { groupId: form.groupId } : {}) } : kind === 'suppliers' ? { name: form.name, phone: form.phone || undefined, email: form.email || undefined } : { name: form.name };
      await apiRequest(path, { method: editingProduct ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      setMessage(editingProduct ? 'Updated successfully' : 'Created successfully');
      setSelectedId('');
      setForm({ name: '', sku: '', purchasePrice: '', sellingPrice: '', minimumStock: '0', companyId: '', groupId: '', phone: '', email: '' });
      await load();
    } catch (error) { setMessage(errorText(error)); }
  }

  function selectItem(item: RecordValue) { setSelectedId(text(item.id)); setForm((current) => ({ ...current, name: text(item.name), sku: text(item.sku), purchasePrice: text(item.purchasePrice), sellingPrice: text(item.sellingPrice), minimumStock: text(item.minimumStock || 0), companyId: text(item.companyId), groupId: text(item.groupId), phone: text(item.phone), email: text(item.email) })); }
  return <div className="manager-content"><div className="subnav">{(['products', 'companies', 'groups', 'suppliers'] as const).map((value) => <button className={kind === value ? 'subnav-button active' : 'subnav-button'} key={value} onClick={() => { setKind(value); setSelectedId(''); }}>{value}</button>)}</div><div className="manager-grid"><section className="manager-card"><div className="card-heading"><div><p className="section-label">Master data</p><h3>{kind}</h3></div><span className="count-badge">{items.length} records</span></div><div className="record-list">{items.map((item) => <button className="record-row" key={text(item.id)} onClick={() => selectItem(item)}><strong>{text(item.name || item.sku || item.id)}</strong><span>{text(item.sku || item.email || item.phone)}</span></button>)}</div></section><section className="manager-card"><p className="section-label">{selectedId && kind === 'products' ? 'Edit product' : 'New record'}</p><h3>{selectedId && kind === 'products' ? 'Update selected product' : `Add ${kind.slice(0, -1)}`}</h3><form className="form-stack" onSubmit={(event) => void submit(event)}><input required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Name" aria-label="Name" />{kind === 'products' && <><input required value={form.sku} onChange={(event) => update('sku', event.target.value)} placeholder="SKU" aria-label="SKU" /><div className="form-columns"><input required type="number" step="0.01" value={form.purchasePrice} onChange={(event) => update('purchasePrice', event.target.value)} placeholder="Purchase price" aria-label="Purchase price" /><input required type="number" step="0.01" value={form.sellingPrice} onChange={(event) => update('sellingPrice', event.target.value)} placeholder="Selling price" aria-label="Selling price" /></div><input type="number" value={form.minimumStock} onChange={(event) => update('minimumStock', event.target.value)} placeholder="Minimum stock" aria-label="Minimum stock" /><div className="form-columns"><input value={form.companyId} onChange={(event) => update('companyId', event.target.value)} placeholder="Company ID" aria-label="Company ID" /><input value={form.groupId} onChange={(event) => update('groupId', event.target.value)} placeholder="Group ID" aria-label="Group ID" /></div></>}{kind === 'suppliers' && <><input value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Phone" aria-label="Phone" /><input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="Email" aria-label="Email" /></>}<button className="primary-action">{selectedId && kind === 'products' ? 'Update' : 'Create'}</button></form><p className="notice">{message}</p></section></div><ApiActionConsole /></div>;
}

function CustomersView(): ReactElement {
  const [customers, setCustomers] = useState<RecordValue[]>([]);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [message, setMessage] = useState('');
  async function load() { try { setCustomers(await apiRequest<RecordValue[]>('/sales/customers')); } catch (error) { setMessage(errorText(error)); } }
  useEffect(() => { void load(); }, []);
  async function submit(event: FormEvent) { event.preventDefault(); try { await apiRequest('/sales/customers', { method: 'POST', body: JSON.stringify(form) }); setForm({ firstName: '', lastName: '', phone: '', email: '' }); setMessage('Customer created'); await load(); } catch (error) { setMessage(errorText(error)); } }
  return <div className="manager-content"><div className="manager-grid"><section className="manager-card"><div className="card-heading"><div><p className="section-label">Customer records</p><h3>Customers</h3></div><span className="count-badge">{customers.length}</span></div><div className="record-list">{customers.map((customer) => <div className="record-row static" key={text(customer.id)}><strong>{text(customer.firstName)} {text(customer.lastName)}</strong><span>{text(customer.phone || customer.email || customer.id)}</span></div>)}</div></section><section className="manager-card"><p className="section-label">Customer management</p><h3>Add customer</h3><form className="form-stack" onSubmit={(event) => void submit(event)}>{(['firstName', 'lastName', 'phone', 'email'] as const).map((field) => <input key={field} required={field === 'firstName'} type={field === 'email' ? 'email' : 'text'} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} placeholder={field} aria-label={field} />)}<button className="primary-action">Add customer</button></form><p className="notice">{message}</p><p className="helper-text">Customer update/delete endpoints are not available yet. Use the API action console only for endpoints exposed by the backend.</p></section></div><ApiActionConsole /></div>;
}

function EndpointView({ view }: { view: typeof managerViews[number] }): ReactElement {
  const [data, setData] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  useEffect(() => { void apiRequest(view.path).then(setData).catch((error) => setMessage(errorText(error))); }, [view.path]);
  return <div className="manager-content"><section className="manager-card"><div className="card-heading"><div><p className="section-label">Manager workspace</p><h3>{view.label}</h3></div><button className="secondary-action" onClick={() => void apiRequest(view.path).then(setData).catch((error) => setMessage(errorText(error)))}>Refresh</button></div>{message && <p className="notice">{message}</p>}<JsonTable value={data} /></section><ApiActionConsole /></div>;
}

export function ManagerView({ permissions, onBack, onLogout }: { permissions: string[]; onBack: () => void; onLogout: () => void }): ReactElement {
  const [viewKey, setViewKey] = useState<ViewKey>('catalog');
  const isAdmin = permissions.some((permission) => ['catalog.manage', 'sales.manage', 'inventory.adjust', 'purchasing.manage', 'reports.read', 'settings.manage', 'subscription.read', 'branch.manage', 'jobs.read'].includes(permission));
  if (!isAdmin) return <main className="login-screen"><section className="login-panel"><p className="kicker">ADMIN ACCESS</p><h1>Access denied</h1><p className="manager-intro">Your account does not have an administration permission.</p><button className="secondary-action" onClick={onBack}>Back to POS</button><button className="connect-button" onClick={onLogout}>Sign out</button></section></main>;
  const availableViews = managerViews.filter((item) => permissions.includes(item.permission));
  if (!availableViews.length) return <main className="login-screen"><section className="login-panel"><p className="kicker">ADMIN ACCESS</p><h1>No sections available</h1><p className="manager-intro">Your permissions do not include any readable administration section.</p><button className="secondary-action" onClick={onBack}>Back to POS</button></section></main>;
  const view = availableViews.find((item) => item.key === viewKey) ?? availableViews[0]!;
  return <main className="manager-shell"><header className="manager-header"><div><p className="kicker">PHARMACY POS / ADMIN LAYER</p><h1>Operations desk</h1><p className="manager-intro">Authenticated administration workspace. Every action is checked by the API permission guards.</p></div><div className="manager-header-actions"><button className="secondary-action" onClick={onBack}>Back to POS</button><button className="connect-button" onClick={onLogout}>Sign out</button></div></header><nav className="manager-nav" aria-label="Manager sections">{availableViews.map((item) => <button key={item.key} className={item.key === view.key ? 'manager-nav-button active' : 'manager-nav-button'} onClick={() => setViewKey(item.key)}>{item.label}</button>)}</nav>{view.key === 'catalog' ? <CatalogView /> : view.key === 'customers' ? <CustomersView /> : <EndpointView view={view} />}</main>;
}
