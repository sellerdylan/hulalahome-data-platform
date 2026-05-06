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
import { getOrders, getAdData, getSkuBaseInfo, getShopsData, getAllTargets } from '@/services/backendApi'

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
  skuFreights: SkuFreight[]
  skuRefundRates: SkuRefundRate[]
  skuBaseInfo: SkuBaseInfo[]
  isLoading: boolean
  setShopRates: (data: ShopRate[]) => void
  clearShopRates: () => void
  setSkuFreights: (data: SkuFreight[]) => void
  clearSkuFreights: () => void
  setSkuRefundRates: (data: SkuRefundRate[]) => void
  clearSkuRefundRates: () => void
  setSkuBaseInfo: (data: SkuBaseInfo[]) => void
  clearSkuBaseInfo: () => void
  setLoading: (loading: boolean) => void
  init: () => Promise<void>
}

export const useSystemStore = create<SystemSettingsStore>((set) => ({
  shopRates: [],
  skuFreights: [],
  skuRefundRates: [],
  skuBaseInfo: [],
  isLoading: false,
  setShopRates: (data) => {
    persistData('hulalahome_shop_rates', data)
    set({ shopRates: data })
  },
  clearShopRates: () => {
    persistData('hulalahome_shop_rates', [])
    set({ shopRates: [] })
  },
  
  setSkuFreights: (data) => {
    persistData('hulalahome_sku_freights', data)
    set({ skuFreights: data })
  },
  clearSkuFreights: () => {
    persistData('hulalahome_sku_freights', [])
    set({ skuFreights: [] })
  },
  
  setSkuRefundRates: (data) => {
    persistData('hulalahome_sku_refund_rates', data)
    set({ skuRefundRates: data })
  },
  clearSkuRefundRates: () => {
    persistData('hulalahome_sku_refund_rates', [])
    set({ skuRefundRates: [] })
  },
  
  setSkuBaseInfo: (data) => {
    persistData('hulalahome_sku_base_info', data)
    set({ skuBaseInfo: data })
  },
  clearSkuBaseInfo: () => {
    persistData('hulalahome_sku_base_info', [])
    set({ skuBaseInfo: [] })
  },
  setLoading: (isLoading) => set({ isLoading }),
  
  init: async () => {
    set({ isLoading: true })
    
    // 先从 IndexedDB 预加载（保底）
    await preloadFromIndexedDB()
    const cachedSkuBaseInfo = getCached<SkuBaseInfo[]>('hulalahome_sku_base_info', [])
    const cachedShopRates = getCached<ShopRate[]>('hulalahome_shop_rates', [])
    const cachedSkuFreights = getCached<SkuFreight[]>('hulalahome_sku_freights', [])
    const cachedSkuRefundRates = getCached<SkuRefundRate[]>('hulalahome_sku_refund_rates', [])

    try {
      // 优先从后端 API 加载数据（实现数据共享）
      const [shopRatesRaw, skuBaseInfoRaw, targets] = await Promise.all([
        getShopsData(),
        getSkuBaseInfo(),
        getAllTargets(),
      ])
      console.log('[SystemStore] Loaded from backend:', shopRatesRaw.length, 'shops,', skuBaseInfoRaw.length, 'SKU info')

      // 转换店铺数据格式（兼容后端返回的数据）
      const convertedShopRates: ShopRate[] = (shopRatesRaw as any[]).map((shop: any) => ({
        id: String(shop.id || shop.shopId || Math.random().toString(36).substring(2, 11)),
        shop: shop.shop || shop.name || '',
        dspRate: shop.dspRate || shop.dsp_rate || 0,
        refundFreightRate: shop.refundFreightRate || shop.return_freight_rate || 0,
        storageRate: shop.storageRate || shop.storage_rate || 0,
      }))

      // 分离 SKU 运费（从 sku_base_info 中提取）
      const backendSkuFreights: SkuFreight[] = skuBaseInfoRaw.map((info: any) => ({
        id: `${info.shop}-${info.sku}`,
        shop: info.shop,
        sku: info.sku,
        cgFreight: info.cgFreight || info.cg_freight || 0,
        plFreight: info.plFreight || info.pl_freight || 0,
        selfFreight: info.selfFreight || info.fedexFreight || info.fedex_freight || 0,
      }))

      const backendSkuRefundRates: SkuRefundRate[] = (skuBaseInfoRaw as any[])
        .filter(info => {
          const rate = info.refundRate ?? info.refund_rate
          return rate !== undefined && rate !== null && rate !== '' && rate !== 0
        })
        .map(info => ({
          id: `${info.shop}-${info.sku}`,
          shop: info.shop,
          sku: info.sku,
          refundRate: info.refundRate ?? info.refund_rate ?? 0,
        }))

      // 如果后端返回空，使用 IndexedDB 缓存（避免空数据覆盖已有数据）
      const finalShopRates = convertedShopRates.length > 0 ? convertedShopRates : cachedShopRates
      const finalSkuBaseInfo = skuBaseInfoRaw.length > 0 ? skuBaseInfoRaw : cachedSkuBaseInfo
      const finalSkuFreights = backendSkuFreights.length > 0 ? backendSkuFreights : cachedSkuFreights
      const finalSkuRefundRates = backendSkuRefundRates.length > 0 ? backendSkuRefundRates : cachedSkuRefundRates

      set({
        shopRates: finalShopRates,
        skuFreights: finalSkuFreights,
        skuRefundRates: finalSkuRefundRates,
        skuBaseInfo: finalSkuBaseInfo,
        isLoading: false,
      })

      // 同时更新 TargetStore
      const { setDepartmentTargets, setOperatorGroupTargets, setOperatorTargets } = useTargetStore.getState()
      setDepartmentTargets(targets.departmentTargets)
      setOperatorGroupTargets(targets.operatorGroupTargets)
      setOperatorTargets(targets.operatorTargets)
    } catch (e) {
      console.warn('[SystemStore] Failed to load from backend, falling back to IndexedDB:', e)
      // 降级：使用 IndexedDB 缓存
      set({
        shopRates: cachedShopRates,
        skuFreights: cachedSkuFreights,
        skuRefundRates: cachedSkuRefundRates,
        skuBaseInfo: cachedSkuBaseInfo,
        isLoading: false,
      })
    }
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
    set({ isLoading: true })
    
    // 先从 IndexedDB 预加载（保底）
    await preloadFromIndexedDB()
    const cachedOrders = getCached<Order[]>('hulalahome_orders', [])
    const cachedAdData = getCached<AdData[]>('hulalahome_ad_data', [])

    try {
      // 优先从后端 API 加载数据（实现数据共享）
      const [backendOrders, backendAdData] = await Promise.all([
        getOrders(),
        getAdData(),
      ])
      console.log('[DataStore] Loaded from backend:', backendOrders.length, 'orders,', backendAdData.length, 'ad data')
      
      // 如果后端返回空，回退到 IndexedDB 数据（避免空数据覆盖）
      const finalOrders = backendOrders.length > 0 ? backendOrders : cachedOrders
      const finalAdData = backendAdData.length > 0 ? backendAdData : cachedAdData
      set({ orders: finalOrders, adData: finalAdData, isLoading: false })
    } catch (e) {
      console.warn('[DataStore] Failed to load from backend, falling back to IndexedDB:', e)
      set({
        orders: cachedOrders,
        adData: cachedAdData,
        isLoading: false,
      })
    }
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
    try {
      // 优先从后端 API 加载数据（实现数据共享）
      const targets = await getAllTargets()
      console.log('[TargetStore] Loaded from backend:', targets.departmentTargets.length, 'dept targets')
      set({
        departmentTargets: targets.departmentTargets,
        operatorGroupTargets: targets.operatorGroupTargets,
        operatorTargets: targets.operatorTargets,
      })
    } catch (e) {
      console.warn('[TargetStore] Failed to load from backend, falling back to IndexedDB:', e)
      // 降级：从 IndexedDB 加载
      await preloadFromIndexedDB()
      set({
        departmentTargets: getCached<DepartmentTarget[]>('hulalahome_department_targets', []),
        operatorGroupTargets: getCached<OperatorGroupTarget[]>('hulalahome_operator_group_targets', []),
        operatorTargets: getCached<OperatorTarget[]>('hulalahome_operator_targets', []),
      })
    }
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
