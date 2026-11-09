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
};

const databaseName = 'pharmacy-pos-phase-7';
const databaseVersion = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('catalog')) database.createObjectStore('catalog', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('outbox')) database.createObjectStore('outbox', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB open failed'));
  });
}

export async function cacheProducts(products: PosProduct[]): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('catalog', 'readwrite');
    transaction.objectStore('catalog').clear();
    products.forEach((product) => transaction.objectStore('catalog').put(product));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error(transaction.error?.message ?? 'IndexedDB write failed'));
  });
  database.close();
}

export async function readCachedProducts(): Promise<PosProduct[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction('catalog').objectStore('catalog').getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result as PosProduct[]);
    };
    request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB read failed'));
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
