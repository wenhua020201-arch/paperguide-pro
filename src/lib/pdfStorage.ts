// IndexedDB-based PDF blob storage (localStorage has 5MB limit, PDFs are often larger)

const DB_NAME = 'paper-guide-pdf';
const STORE_NAME = 'pdfs';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePdfBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPdfBlob(key: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePdfBlob(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Save PDF File to IndexedDB and return a blob URL for display */
export async function savePdfFile(file: File): Promise<string> {
  const blob = new Blob([await file.arrayBuffer()], { type: 'application/pdf' });
  await savePdfBlob('current_pdf', blob);
  return URL.createObjectURL(blob);
}

/** Get current PDF as a blob URL */
export async function getCurrentPdfUrl(): Promise<string | null> {
  const blob = await getPdfBlob('current_pdf');
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
