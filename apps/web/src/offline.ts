export type PosProduct = {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  prescriptionRequired?: boolean;
  controlledDrug?: boolean;
};

export type QueuedSale = {
  id: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string;
  status?: 'QUEUED' | 'FAILED';
};

const databaseName = 'pharmacy-pos-phase-7';
const databaseVersion = 2;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('catalog')) database.createObjectStore('catalog', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('outbox')) database.createObjectStore('outbox', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('metadata')) database.createObjectStore('metadata', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB open failed'));
  });
}

export async function cacheProducts(products: PosProduct[]): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(['catalog', 'metadata'], 'readwrite');
    transaction.objectStore('catalog').clear();
    products.forEach((product) => transaction.objectStore('catalog').put(product));
    transaction.objectStore('metadata').put({ key: 'catalog.cachedAt', value: Date.now() });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error(transaction.error?.message ?? 'IndexedDB write failed'));
  });
  database.close();
}

export async function readCachedProducts(maxAgeMs = 24 * 60 * 60 * 1000): Promise<PosProduct[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['catalog', 'metadata']);
    const metadataRequest = transaction.objectStore('metadata').get('catalog.cachedAt');
    const productsRequest = transaction.objectStore('catalog').getAll();
    transaction.oncomplete = () => {
      const cachedAt = (metadataRequest.result as { value?: number } | undefined)?.value;
      database.close();
      if (!cachedAt || !isCacheFresh(cachedAt, Date.now(), maxAgeMs)) {
        resolve([]);
        return;
      }
      resolve(productsRequest.result as PosProduct[]);
    };
    transaction.onerror = () => reject(new Error(transaction.error?.message ?? 'IndexedDB read failed'));
  });
}

export async function enqueueSale(sale: QueuedSale): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('outbox', 'readwrite');
    transaction.objectStore('outbox').put(sale);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error(transaction.error?.message ?? 'IndexedDB write failed'));
  });
  database.close();
}

export function isCacheFresh(cachedAt: number, now = Date.now(), maxAgeMs = 24 * 60 * 60 * 1000): boolean {
  return cachedAt > 0 && now >= cachedAt && now - cachedAt <= maxAgeMs;
}

export async function listQueuedSales(): Promise<QueuedSale[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction('outbox').objectStore('outbox').getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result as QueuedSale[]);
    };
    request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB read failed'));
  });
}

export async function removeQueuedSale(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('outbox', 'readwrite');
    transaction.objectStore('outbox').delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error(transaction.error?.message ?? 'IndexedDB delete failed'));
  });
  database.close();
}
