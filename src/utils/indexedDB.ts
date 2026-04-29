// IndexedDB 封装 - 用于存储大量数据
const DB_NAME = 'hulalahome_db'
const DB_VERSION = 2
const STORE_NAME = 'data_store'

let dbInstance: IDBDatabase | null = null
let dbOpening: Promise<IDBDatabase> | null = null

// 关闭数据库连接
const closeDB = () => {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
  dbOpening = null
}

// 打开数据库
const openDB = (): Promise<IDBDatabase> => {
  if (dbInstance && dbInstance.objectStoreNames.contains(STORE_NAME)) {
    return Promise.resolve(dbInstance)
  }

  if (dbOpening) {
    return dbOpening
  }

  // 先关闭可能存在的旧连接
  closeDB()

  dbOpening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('Failed to open IndexedDB')
      dbOpening = null
      reject(new Error('Failed to open IndexedDB'))
    }

    request.onsuccess = () => {
      dbInstance = request.result
      dbOpening = null

      // 监听连接关闭
      dbInstance.onclose = () => {
        console.log('IndexedDB connection closed')
        dbInstance = null
      }

      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
  })

  return dbOpening
}

// 保存数据到 IndexedDB（带重试）
export const saveToIndexedDB = async <T>(key: string, data: T, retries = 3): Promise<void> => {
  for (let i = 0; i < retries; i++) {
    try {
      // 确保每次都重新打开连接
      closeDB()
      const db = await openDB()

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)

        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(new Error('Transaction failed'))
        transaction.onabort = () => reject(new Error('Transaction aborted'))

        const request = store.put({ key, data, timestamp: Date.now() })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(new Error('Failed to save to IndexedDB'))
      })
    } catch (e) {
      console.warn(`IndexedDB save attempt ${i + 1} failed:`, e)
      if (i === retries - 1) {
        throw e
      }
      // 等待后重试
      await new Promise(r => setTimeout(r, 100))
    }
  }
}

// 从 IndexedDB 读取数据
export const loadFromIndexedDB = async <T>(key: string): Promise<T | null> => {
  try {
    // 确保连接是新的
    closeDB()
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.data : null)
      }
      request.onerror = () => reject(new Error('Failed to load from IndexedDB'))
    })
  } catch (e) {
    console.error('IndexedDB load error:', e)
    return null
  }
}

// 清除 IndexedDB 数据
export const clearFromIndexedDB = async (key: string): Promise<void> => {
  try {
    closeDB()
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to clear from IndexedDB'))
    })
  } catch (e) {
    console.error('IndexedDB clear error:', e)
  }
}

// 清除所有 IndexedDB 数据
export const clearAllIndexedDB = async (): Promise<void> => {
  try {
    closeDB()
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to clear IndexedDB'))
    })
  } catch (e) {
    console.error('IndexedDB clear all error:', e)
  }
}

// 检查是否支持 IndexedDB
export const isIndexedDBSupported = (): boolean => {
  return typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function'
}
