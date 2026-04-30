import { create } from 'zustand'
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
// API 配置 - 从环境变量获取后端地址
// ============================================
const getBaseUrl = () => {
  return import.meta.env.VITE_API_URL || 'http://localhost:8000'
}

const apiGet = async <T,>(path: string): Promise<T> => {
  const res = await fetch(`${getBaseUrl()}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

const apiPost = async <T,>(path: string, data: unknown): Promise<T> => {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
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
    // 筛选器不需要初始化数据
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
  setShopRates: (data) => set({ shopRates: data }),
  clearShopRates: () => set({ shopRates: [] }),
  
  skuFreights: [],
  setSkuFreights: (data) => set({ skuFreights: data }),
  clearSkuFreights: () => set({ skuFreights: [] }),
  
  skuRefundRates: [],
  setSkuRefundRates: (data) => set({ skuRefundRates: data }),
  clearSkuRefundRates: () => set({ skuRefundRates: [] }),
  
  skuBaseInfo: [],
  setSkuBaseInfo: (data) => set({ skuBaseInfo: data }),
  clearSkuBaseInfo: () => set({ skuBaseInfo: [] }),
  
  init: async () => {
    // 从后端加载店铺数据
    try {
      const res = await apiGet<{ success: boolean; data: ShopRate[] }>('/api/shops')
      if (res.success) {
        set({ shopRates: res.data })
      }
    } catch (e) {
      console.error('[Init] Failed to load shops:', e)
    }
  },
}))

// ============================================
// 业务数据 Store（订单 + 广告）- 从后端加载
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
  
  setOrders: (data) => set({ orders: data }),
  setAdData: (data) => set({ adData: data }),
  clearOrders: () => set({ orders: [] }),
  clearAdData: () => set({ adData: [] }),
  setLoading: (isLoading) => set({ isLoading }),
  
  init: async () => {
    // 数据从后端加载，这里只需要初始化状态
    // 实际数据通过 API 页面调用获取
    set({ orders: [], adData: [] })
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
  setDepartmentTargets: (data) => set({ departmentTargets: data }),
  setOperatorGroupTargets: (data) => set({ operatorGroupTargets: data }),
  setOperatorTargets: (data) => set({ operatorTargets: data }),
  clearDepartmentTargets: () => set({ departmentTargets: [] }),
  clearOperatorGroupTargets: () => set({ operatorGroupTargets: [] }),
  clearOperatorTargets: () => set({ operatorTargets: [] }),
  init: async () => {
    // 从后端加载目标数据
    try {
      const [deptRes, groupRes, operatorRes] = await Promise.all([
        apiGet<{ success: boolean; data: DepartmentTarget[] }>('/api/department-targets'),
        apiGet<{ success: boolean; data: OperatorGroupTarget[] }>('/api/operator-group-targets'),
        apiGet<{ success: boolean; data: OperatorTarget[] }>('/api/operator-targets'),
      ])
      if (deptRes.success) set({ departmentTargets: deptRes.data })
      if (groupRes.success) set({ operatorGroupTargets: groupRes.data })
      if (operatorRes.success) set({ operatorTargets: operatorRes.data })
    } catch (e) {
      console.error('[Init] Failed to load targets:', e)
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
