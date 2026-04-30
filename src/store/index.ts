import { create } from 'zustand'
import { openDB, type IDBPDatabase } from 'idb'
import type { 
  FilterState, 
  ShopRate,
  SkuFreight,
  SkuRefundRate, 
  SkuBaseInfo,
  Order, 
  AdData,
  DepartmentTarget,
  OperatorGroupTarget,
  OperatorTarget,
} from '@/types'
import dayjs from 'dayjs'

// ============================================
// IndexedDB 配置
// ============================================
const DB_NAME = 'hulalahome_db_v3' // 新名称，避免旧版本干扰
const DB_VERSION = 1
const STORE_NAME = 'data_store'

let dbPromise: Promise<IDBPDatabase> | null = null

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

// ============================================
// 数据持久化工具（IndexedDB）
// ============================================

/** 异步保存到 IndexedDB */
const saveToIndexedDB = async <T,>(key: string, data: T): Promise<void> => {
  try {
    const db = await getDB()
    await db.put(STORE_NAME, data, key)
    console.log(`[Save] ${key}: ${Array.isArray(data) ? data.length : 'N/A'} items`)
  } catch (e) {
    console.error(`[Save] Failed to save ${key}:`, e)
  }
}

/** 从 IndexedDB 异步加载 */
const loadFromIndexedDB = async <T,>(key: string, defaultValue: T): Promise<T> => {
  try {
    const db = await getDB()
    const data = await db.get(STORE_NAME, key) as T | undefined
    if (data !== undefined) {
      console.log(`[Load] ${key}: ${Array.isArray(data) ? data.length : 'N/A'} items loaded from IndexedDB`)
      return data
    }
    console.log(`[Load] ${key}: not found in IndexedDB, using default`)
    return defaultValue
  } catch (e) {
    console.error(`[Load] Failed to load ${key}:`, e)
    return defaultValue
  }
}

// ============================================
// 内存缓存 + IndexedDB 持久化
// ============================================

const memoryCache: Record<string, unknown> = {}

/** 同步保存：更新内存 + 异步写 IndexedDB */
const persistData = <T,>(key: string, data: T): void => {
  memoryCache[key] = data
  saveToIndexedDB(key, data).catch(e => console.error('[Persist] Save error:', e))
}

/** 同步加载：只读内存（必须在 init 时预加载） */
const getCached = <T,>(key: string, defaultValue: T): T => {
  const cached = memoryCache[key]
  if (cached !== undefined) {
    return cached as T
  }
  return defaultValue
}

/** 预加载所有需要的 key 到内存 */
const preloadFromIndexedDB = async (): Promise<void> => {
  const keysToPreload = [
    'hulalahome_orders',
    'hulalahome_ad_data',
    'hulalahome_shop_rates',
    'hulalahome_sku_freights',
    'hulalahome_sku_refund_rates',
    'hulalahome_sku_base_info',
    'hulalahome_department_targets',
    'hulalahome_operator_group_targets',
    'hulalahome_operator_targets',
  ]

  console.log('[Init] Preloading', keysToPreload.length, 'keys from IndexedDB...')
  
  for (const key of keysToPreload) {
    const data = await loadFromIndexedDB<unknown[]>(key, [])
    memoryCache[key] = data
  }

  console.log('[Init] Preload complete')
  
  // 打印每个 key 的数量
  for (const key of keysToPreload) {
    const val = memoryCache[key]
    console.log(`[Init]   ${key}: ${Array.isArray(val) ? val.length : typeof val}`)
  }
}

// ============================================
// 筛选器 Store
// ============================================

const initialFilters: FilterState = {
  month: dayjs().format('YYYY-MM'),
  months: [dayjs().format('YYYY-MM')],
  dateRange: {
    start: dayjs().startOf('month').format('YYYY-MM-DD'),
    end: dayjs().format('YYYY-MM-DD'),
  },
  shops: [],
  operatorGroups: [],
  operators: [],
  categories: [],
  salesGrades: [],
  spus: [],
}

interface FilterStore {
  filters: FilterState
  setFilters: (filters: Partial<FilterState>) => void
  resetFilters: () => void
  init: () => Promise<void>
}

export const useFilterStore = create<FilterStore>((set) => ({
  filters: initialFilters,
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),
  resetFilters: () => set({ filters: initialFilters }),
  init: async () => {
    await preloadFromIndexedDB()
  },
}))

// ============================================
// 系统设置 Store
// ============================================

interface SystemSettingsStore {
  shopRates: ShopRate[]
  setShopRates: (data: ShopRate[]) => void
  clearShopRates: () => void
  skuFreights: SkuFreight[]
  setSkuFreights: (data: SkuFreight[]) => void
  clearSkuFreights: () => void
  skuRefundRates: SkuRefundRate[]
  setSkuRefundRates: (data: SkuRefundRate[]) => void
  clearSkuRefundRates: () => void
  skuBaseInfo: SkuBaseInfo[]
  setSkuBaseInfo: (data: SkuBaseInfo[]) => void
  clearSkuBaseInfo: () => void
  init: () => Promise<void>
}

export const useSystemStore = create<SystemSettingsStore>((set) => ({
  shopRates: [],
  setShopRates: (data) => {
    persistData('hulalahome_shop_rates', data)
    set({ shopRates: data })
  },
  clearShopRates: () => {
    persistData('hulalahome_shop_rates', [])
    set({ shopRates: [] })
  },
  
  skuFreights: [],
  setSkuFreights: (data) => {
    persistData('hulalahome_sku_freights', data)
    set({ skuFreights: data })
  },
  clearSkuFreights: () => {
    persistData('hulalahome_sku_freights', [])
    set({ skuFreights: [] })
  },
  
  skuRefundRates: [],
  setSkuRefundRates: (data) => {
    persistData('hulalahome_sku_refund_rates', data)
    set({ skuRefundRates: data })
  },
  clearSkuRefundRates: () => {
    persistData('hulalahome_sku_refund_rates', [])
    set({ skuRefundRates: [] })
  },
  
  skuBaseInfo: [],
  setSkuBaseInfo: (data) => {
    persistData('hulalahome_sku_base_info', data)
    set({ skuBaseInfo: data })
  },
  clearSkuBaseInfo: () => {
    persistData('hulalahome_sku_base_info', [])
    set({ skuBaseInfo: [] })
  },
  
  init: async () => {
    await preloadFromIndexedDB()
    set({
      shopRates: getCached<ShopRate[]>('hulalahome_shop_rates', []),
      skuFreights: getCached<SkuFreight[]>('hulalahome_sku_freights', []),
      skuRefundRates: getCached<SkuRefundRate[]>('hulalahome_sku_refund_rates', []),
      skuBaseInfo: getCached<SkuBaseInfo[]>('hulalahome_sku_base_info', []),
    })
  },
}))

// ============================================
// 业务数据 Store（订单 + 广告）
// ============================================

interface DataStore {
  orders: Order[]
  adData: AdData[]
  isLoading: boolean
  setOrders: (data: Order[]) => void
  setAdData: (data: AdData[]) => void
  clearOrders: () => void
  clearAdData: () => void
  setLoading: (isLoading: boolean) => void
  init: () => Promise<void>
}

export const useDataStore = create<DataStore>((set) => ({
  orders: [],
  adData: [],
  isLoading: false,
  
  setOrders: (data) => {
    persistData('hulalahome_orders', data)
    set({ orders: data })
  },
  setAdData: (data) => {
    persistData('hulalahome_ad_data', data)
    set({ adData: data })
  },
  clearOrders: () => {
    persistData('hulalahome_orders', [])
    set({ orders: [] })
  },
  clearAdData: () => {
    persistData('hulalahome_ad_data', [])
    set({ adData: [] })
  },
  setLoading: (isLoading) => set({ isLoading }),
  
  init: async () => {
    await preloadFromIndexedDB()
    set({
      orders: getCached<Order[]>('hulalahome_orders', []),
      adData: getCached<AdData[]>('hulalahome_ad_data', []),
    })
  },
}))

// ============================================
// 目标 Store
// ============================================

interface TargetStore {
  departmentTargets: DepartmentTarget[]
  operatorGroupTargets: OperatorGroupTarget[]
  operatorTargets: OperatorTarget[]
  setDepartmentTargets: (data: DepartmentTarget[]) => void
  setOperatorGroupTargets: (data: OperatorGroupTarget[]) => void
  setOperatorTargets: (data: OperatorTarget[]) => void
  clearDepartmentTargets: () => void
  clearOperatorGroupTargets: () => void
  clearOperatorTargets: () => void
  init: () => Promise<void>
}

export const useTargetStore = create<TargetStore>((set) => ({
  departmentTargets: [],
  operatorGroupTargets: [],
  operatorTargets: [],
  setDepartmentTargets: (data) => {
    persistData('hulalahome_department_targets', data)
    set({ departmentTargets: data })
  },
  setOperatorGroupTargets: (data) => {
    persistData('hulalahome_operator_group_targets', data)
    set({ operatorGroupTargets: data })
  },
  setOperatorTargets: (data) => {
    persistData('hulalahome_operator_targets', data)
    set({ operatorTargets: data })
  },
  clearDepartmentTargets: () => {
    persistData('hulalahome_department_targets', [])
    set({ departmentTargets: [] })
  },
  clearOperatorGroupTargets: () => {
    persistData('hulalahome_operator_group_targets', [])
    set({ operatorGroupTargets: [] })
  },
  clearOperatorTargets: () => {
    persistData('hulalahome_operator_targets', [])
    set({ operatorTargets: [] })
  },
  init: async () => {
    await preloadFromIndexedDB()
    set({
      departmentTargets: getCached<DepartmentTarget[]>('hulalahome_department_targets', []),
      operatorGroupTargets: getCached<OperatorGroupTarget[]>('hulalahome_operator_group_targets', []),
      operatorTargets: getCached<OperatorTarget[]>('hulalahome_operator_targets', []),
    })
  },
}))

// ============================================
// 导航 Store
// ============================================

interface NavStore {
  currentPage: 'dashboard' | 'spu' | 'analysis' | 'import' | 'settings' | 'targets'
  setCurrentPage: (page: 'dashboard' | 'spu' | 'analysis' | 'import' | 'settings' | 'targets') => void
}

export const useNavStore = create<NavStore>((set) => ({
  currentPage: 'dashboard',
  setCurrentPage: (currentPage) => set({ currentPage }),
}))
