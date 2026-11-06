// Durable IndexedDB persistence of full world snapshots. Large worlds need more than localStorage quotas.
const DB_NAME = 'blockverse_mobile_worlds_v1';
const STORE = 'snapshots';
const GAME = 'active';
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
async function transaction(mode, operation) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
window.blockverseIsMobile = true;
window.blockverseMobileLook = { dx: 0, dy: 0 };
window.blockverseMobile = {
  async saveSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.entries) || !snapshot.entries.length) return { ok: false };
    await transaction('readwrite', store => store.put(snapshot, GAME));
    return { ok: true };
  },
  async loadSnapshot() {
    return (await transaction('readonly', store => store.get(GAME))) || null;
  }
};
// Mitigates eviction of local saves on Android WebView versions that support the API.
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
