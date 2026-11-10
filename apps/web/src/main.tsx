import { StrictMode, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchProducts, getToken, login, paySale, syncSale } from './api';
import {
  cacheProducts,
  enqueueSale,
  listQueuedSales,
  readCachedProducts,
  removeQueuedSale,
  type PosProduct,
  type QueuedSale,
} from './offline';
import './styles.css';
import { isSafeScannerValue, normalizeScannerValue } from './barcode';
import { browserHardware } from './hardware';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const demoProducts: PosProduct[] = [
  { id: 'demo-para', name: 'Paracetamol 500 mg', sku: 'PARA-500-TAB', sellingPrice: 2 },
  { id: 'demo-omep', name: 'Omeprazole 20 mg', sku: 'OMEP-20-CAP', sellingPrice: 8 },
  { id: 'demo-vit', name: 'Vitamin C 500 mg', sku: 'VIT-C-500', sellingPrice: 12 },
  { id: 'demo-saline', name: 'Oral Saline', sku: 'ORS-001', sellingPrice: 5 },
];

type CartLine = PosProduct & { quantity: number; discountAmount: number };

function App(): ReactElement {
  const [products, setProducts] = useState<PosProduct[]>(demoProducts);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [email, setEmail] = useState('owner@demo.local');
  const [password, setPassword] = useState('ChangeMe123!');
  const [tenantSlug, setTenantSlug] = useState('demo-pharmacy');
  const [loginMessage, setLoginMessage] = useState('Local-first mode');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState<QueuedSale[]>([]);
  const [notice, setNotice] = useState('Ready for a new sale');
  const [customerId, setCustomerId] = useState('');
  const [isInstallable, setIsInstallable] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const refreshQueue = async () => setQueued(await listQueuedSales());

  useEffect(() => {
    void readCachedProducts().then((cached) => {
      if (cached.length > 0) setProducts(cached);
    });
    void refreshQueue();
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    const installPrompt = (event: Event) => {
      event.preventDefault();
      setIsInstallable(true);
      window.__posInstallPrompt = event as InstallPromptEvent;
    };
    window.addEventListener('beforeinstallprompt', installPrompt);
    void navigator.serviceWorker?.register('/sw.js').catch(() => undefined);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('beforeinstallprompt', installPrompt);
    };
  }, []);

  const visibleProducts = products.filter((product) =>
    `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase()),
  );
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.sellingPrice, 0);
  const discount = cart.reduce((sum, line) => sum + line.discountAmount, 0);
  const total = subtotal - discount;

  function addProduct(product: PosProduct) {
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) return current.map((line) => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { ...product, quantity: 1, discountAmount: 0 }];
    });
    setNotice(`${product.name} added`);
  }

  function handleScannerInput() {
    const value = normalizeScannerValue(search);
    const exactProduct = isSafeScannerValue(value) ? products.find((product) => product.sku.toLowerCase() === value.toLowerCase()) : undefined;
    if (exactProduct) {
      addProduct(exactProduct);
      setSearch('');
      return;
    }
    if (visibleProducts[0]) addProduct(visibleProducts[0]);
  }

  function updateQuantity(id: string, quantity: number) {
    setCart((current) => current.flatMap((line) => line.id === id ? (quantity > 0 ? [{ ...line, quantity }] : []) : [line]));
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    try {
      const user = await login(email, password, tenantSlug);
      if (!user.branchIds.includes(branchId) && user.branchIds[0]) setBranchId(user.branchIds[0]);
      const remote = await fetchProducts();
      setProducts(remote);
      await cacheProducts(remote);
      setLoginMessage('Connected and catalog cached');
      setNotice('Online catalog synchronized');
    } catch {
      setLoginMessage('Login failed; local mode remains available');
    }
  }

  async function syncOutbox() {
    if (!isOnline || !getToken()) return;
    for (const item of queued) {
      try {
        const sale = await syncSale(item.payload) as { id?: string };
        const paymentAmount = item.payload.clientPaymentAmount;
        if (sale.id && item.payload.status === 'COMPLETED' && typeof paymentAmount === 'number') {
          await paySale(sale.id, paymentAmount);
        }
        await removeQueuedSale(item.id);
      } catch (error) {
          const attempts = item.attempts + 1;
          await enqueueSale({ ...item, attempts, status: attempts >= 5 ? 'FAILED' : 'QUEUED', lastError: String(error) });
      }
    }
    await refreshQueue();
  }

  async function checkout(status: 'COMPLETED' | 'SUSPENDED') {
    if (!branchId) {
      setNotice('Enter the active branch ID before checkout');
      return;
    }
    if (cart.length === 0) return;
    const saleNumber = `POS-${Date.now()}`;
    const payload = {
      branchId,
      saleNumber,
      idempotencyKey: `client-${saleNumber}`,
      channel: isOnline && getToken() ? 'ONLINE' : 'OFFLINE',
      status,
      paymentMethod: status === 'COMPLETED' ? 'cash' : undefined,
      lines: cart.map((line) => ({ productId: line.id, quantity: line.quantity, discountAmount: line.discountAmount })),
      clientPaymentAmount: total,
      ...(customerId ? { customerId } : {}),
    };
    if (status === 'SUSPENDED' || !isOnline || !getToken()) {
      await enqueueSale({ id: payload.idempotencyKey, payload, createdAt: new Date().toISOString(), attempts: 0 });
      await refreshQueue();
      setNotice(status === 'SUSPENDED' ? 'Sale suspended locally' : 'Sale queued for synchronization');
    } else {
      try {
        const sale = await syncSale(payload) as { id?: string };
        if (sale.id && status === 'COMPLETED') await paySale(sale.id, total);
        setNotice('Sale completed and receipt recorded');
      } catch {
        await enqueueSale({ id: payload.idempotencyKey, payload, createdAt: new Date().toISOString(), attempts: 0 });
        await refreshQueue();
        setNotice('Server unavailable; sale queued safely');
      }
    }
    setCart([]);
    setCustomerId('');
  }

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'F4') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === 'F2' && cart.length > 0) {
        event.preventDefault();
        void checkout('COMPLETED');
      }
      if (event.key === 'Escape') {
        setSearch('');
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [cart.length]);

  async function installApp() {
    const prompt = window.__posInstallPrompt;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    window.__posInstallPrompt = undefined;
    setIsInstallable(false);
  }

  return (
    <main className="pos-shell">
      <header className="topbar">
        <div>
            <p className="kicker">PHARMACY POS / PHASE 13</p>
          <h1>Counter desk</h1>
        </div>
        <div className="connection" role="status">
          <span className={`connection-dot ${isOnline ? 'is-online' : ''}`} />
          {isOnline ? 'Online' : 'Offline'} <strong>{queued.length} queued</strong>
        </div>
      </header>

      <section className="workspace">
        <div className="catalog-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">Catalog</p>
              <h2>Find a medicine</h2>
            </div>
            <span className="count-badge">{products.length} cached</span>
          </div>
          <input
            ref={searchInputRef}
            className="search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleScannerInput();
            }}
            placeholder="Scan barcode or search SKU / name"
            aria-label="Search product catalog"
            autoFocus
          />
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <button className="product-card" key={product.id} onClick={() => addProduct(product)}>
                <span className="product-code">{product.sku}</span>
                <strong>{product.name}</strong>
                <span className="product-price">৳ {product.sellingPrice.toFixed(2)}</span>
              </button>
            ))}
          </div>
           <p className="keyboard-note"><kbd>Enter</kbd> scans/adds <kbd>F2</kbd> completes <kbd>F4</kbd> focuses search</p>
        </div>

        <aside className="cart-panel">
          <div className="panel-heading cart-heading">
            <div><p className="section-label">Current ticket</p><h2>{cart.length ? `${cart.length} items` : 'Empty cart'}</h2></div>
            <span className="ticket-mark">SALE</span>
          </div>
          <div className="cart-lines">
            {cart.length === 0 && <div className="empty-cart">Scan or select a product to begin.</div>}
            {cart.map((line) => (
              <div className="cart-line" key={line.id}>
                <div><strong>{line.name}</strong><span>{line.sku}</span></div>
                <div className="line-controls"><button onClick={() => updateQuantity(line.id, line.quantity - 1)} aria-label={`Remove ${line.name}`}>−</button><b>{line.quantity}</b><button onClick={() => updateQuantity(line.id, line.quantity + 1)} aria-label={`Add ${line.name}`}>+</button></div>
                <strong>৳ {(line.quantity * line.sellingPrice).toFixed(2)}</strong>
              </div>
            ))}
          </div>
          <label className="compact-label">Customer ID (optional)<input value={customerId} onChange={(event) => setCustomerId(event.target.value)} placeholder="Select from customer records" /></label>
          <div className="totals"><span>Subtotal <b>৳ {subtotal.toFixed(2)}</b></span><span>Discount <b>− ৳ {discount.toFixed(2)}</b></span><span className="grand-total">Total <b>৳ {total.toFixed(2)}</b></span></div>
           <div className="checkout-actions"><button className="secondary-action" onClick={() => void checkout('SUSPENDED')} disabled={!cart.length}>Suspend</button><button className="primary-action" onClick={() => void checkout('COMPLETED')} disabled={!cart.length}>Complete sale <span>F2</span></button></div>
           <button className="receipt-action" onClick={() => void browserHardware.printReceipt(`Pharmacy POS\nTotal: ${total.toFixed(2)}`)} disabled={!cart.length}>Preview receipt</button>
          <p className="notice" role="status">{notice}</p>
        </aside>
      </section>

      <section className="utility-row">
        <form className="login-card" onSubmit={(event) => void handleLogin(event)}>
          <div><p className="section-label">Secure connection</p><strong>{loginMessage}</strong></div>
          <input value={email} onChange={(event) => setEmail(event.target.value)} aria-label="Email" placeholder="Email" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} aria-label="Password" placeholder="Password" type="password" />
          <input value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} aria-label="Tenant slug" placeholder="Tenant slug" />
          <input value={branchId} onChange={(event) => setBranchId(event.target.value)} aria-label="Branch ID" placeholder="Branch ID" />
          <button className="connect-button">Connect</button>
        </form>
         <div className="sync-card"><div><p className="section-label">Outbox</p><strong>{queued.length ? `${queued.length} sale${queued.length === 1 ? '' : 's'} waiting` : 'All synchronized'}</strong></div><button onClick={() => void syncOutbox()} disabled={!queued.length || !isOnline || !getToken()}>Sync now</button>{isInstallable && <button onClick={() => void installApp()}>Install app</button>}</div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
