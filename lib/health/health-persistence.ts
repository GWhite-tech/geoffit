/**
 * Large-safe persistence for HealthStore.
 * localStorage (~5MB) cannot hold Apple Health imports (~tens of MB).
 * IndexedDB is the source of truth; localStorage kept as a tiny mirror for count/debug.
 */

const IDB_NAME = "geoffit-health"
const IDB_VERSION = 1
const IDB_STORE = "health"
const IDB_KEY = "records-v1"
const LOCAL_META_KEY = "geoffit.health-store.meta.v1"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION)
    request.onerror = () => reject(request.error ?? new Error("IDB open failed"))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
  })
}

export async function idbSaveRecords(records: unknown[]): Promise<void> {
  if (typeof indexedDB === "undefined") return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("IDB write failed"))
    tx.objectStore(IDB_STORE).put(
      {
        version: 1,
        updatedAt: new Date().toISOString(),
        records,
      },
      IDB_KEY
    )
  })
  db.close()

  try {
    localStorage.setItem(
      LOCAL_META_KEY,
      JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        recordCount: records.length,
        backend: "indexeddb",
      })
    )
  } catch {
    // meta mirror is optional
  }
}

export async function idbLoadRecords<T>(): Promise<T[] | null> {
  if (typeof indexedDB === "undefined") return null
  const db = await openDb()
  const result = await new Promise<T[] | null>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly")
    tx.onerror = () => reject(tx.error ?? new Error("IDB read failed"))
    const request = tx.objectStore(IDB_STORE).get(IDB_KEY)
    request.onsuccess = () => {
      const value = request.result as { records?: T[] } | undefined
      resolve(Array.isArray(value?.records) ? value.records : null)
    }
  })
  db.close()
  return result
}
