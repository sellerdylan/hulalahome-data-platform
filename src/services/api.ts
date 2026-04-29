/**
 * API 服务层
 * 前后端分离模式 - 从 FastAPI 后端获取数据
 *
 * 使用方式：
 *   1. 开发环境：VITE_API_URL=http://localhost:8000
 *   2. 生产环境：VITE_API_URL=https://your-railway-app.railway.app
 */
import type {
  Order,
  AdData,
  ShopRate,
  SkuFreight,
  SkuBaseInfo,
  DepartmentTarget,
  OperatorGroupTarget,
  OperatorTarget,
} from '@/types'

// ==================== API 基础配置 ====================

const getBaseUrl = () => {
  return import.meta.env.VITE_API_URL || 'http://localhost:8000'
}

const getHeaders = () => ({
  'Content-Type': 'application/json',
})

// ==================== 工具函数 ====================

async function apiGet<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${getBaseUrl()}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, v)
    })
  }
  const res = await fetch(url.toString(), {
    headers: getHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ==================== 字段名转换（后端 snake_case → 前端 camelCase）====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamelCase)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
        toCamelCase(v),
      ])
    )
  }
  return obj
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toSnakeCase)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
        toSnakeCase(v),
      ])
    )
  }
  return obj
}

// ==================== 统计摘要 ====================

export interface StatsOverview {
  order_count: number
  ad_count: number
  sku_count: number
  shop_count: number
  date_range: { start: string | null; end: string | null }
  total_ad_spend: number
}

export async function fetchStatsOverview(): Promise<StatsOverview> {
  const res = await apiGet<{ success: boolean; data: unknown }>('/api/stats/overview')
  return toCamelCase(res.data)
}

// ==================== 筛选选项 ====================

export async function fetchShopOptions(): Promise<string[]> {
  const res = await apiGet<{ success: boolean; data: string[] }>('/api/options/shops')
  return res.data
}

export async function fetchOperatorOptions(): Promise<string[]> {
  const res = await apiGet<{ success: boolean; data: string[] }>('/api/options/operators')
  return res.data
}

export async function fetchOperatorGroupOptions(): Promise<string[]> {
  const res = await apiGet<{ success: boolean; data: string[] }>('/api/options/operator-groups')
  return res.data
}

export async function fetchCategoryOptions(): Promise<string[]> {
  const res = await apiGet<{ success: boolean; data: string[] }>('/api/options/categories')
  return res.data
}

// ==================== Dashboard 汇总数据 ====================

export interface DashboardSummaryItem {
  date: string
  shop: string
  operator_group: string
  operator: string
  category: string
  sales_grade: string
  totalSales: number
  totalGrossProfit: number
  grossMarginRate: number
  totalAdSpend: number
  acos: number
  roas: number
}

export async function fetchDashboardSummary(params: {
  start_date: string
  end_date: string
  shop?: string
  operator_group?: string
  operator?: string
  category?: string
}): Promise<DashboardSummaryItem[]> {
  const res = await apiGet<{ success: boolean; data: unknown[] }>(
    '/api/dashboard/summary',
    params
  )
  return toCamelCase(res.data)
}

// ==================== SPU 列表 ====================

export interface SpuListItem {
  spu: string
  shop: string
  category: string
  sales_grade: string
  operator: string
  operator_group: string
  refund_rate: number | null
  total_sales: number
  total_commission: number
  total_cost: number
  order_count: number
  total_ad_spend: number
  gross_profit: number
  gross_margin_rate: number
}

export async function fetchSpuList(params: {
  start_date?: string
  end_date?: string
  shop?: string
  operator_group?: string
  operator?: string
  sales_grade?: string
  category?: string
}): Promise<SpuListItem[]> {
  const res = await apiGet<{ success: boolean; data: unknown[] }>('/api/spu/list', params)
  return toCamelCase(res.data)
}

// ==================== SPU 每日明细 ====================

export interface SpuDailyItem {
  date: string
  shop: string
  spu: string
  operator: string
  operator_group: string
  category: string
  sales_grade: string
  total_sales: number
  total_commission: number
  total_cost: number
  order_count: number
  ad_spend: number
}

export async function fetchSpuDaily(params: {
  spu: string
  shop?: string
  start_date?: string
  end_date?: string
}): Promise<SpuDailyItem[]> {
  const res = await apiGet<{ success: boolean; data: unknown[] }>('/api/spu/daily', params)
  return toCamelCase(res.data)
}

// ==================== 店铺管理 ====================

export interface ShopInfo {
  id?: number
  name: string
  refund_rate: number
  dsp_rate: number
  return_freight_rate: number
  storage_rate: number
  target_margin_rate: number
}

export async function fetchShops(): Promise<ShopInfo[]> {
  const res = await apiGet<{ success: boolean; data: unknown[] }>('/api/shops')
  return toCamelCase(res.data)
}

export async function saveShop(shop: ShopInfo): Promise<void> {
  await apiPost('/api/shops', toSnakeCase(shop))
}

// ==================== 目标设置 ====================

// 整体目标（店铺维度）
export async function fetchDepartmentTargets(month?: string): Promise<DepartmentTarget[]> {
  const res = await apiGet<{ success: boolean; data: unknown[] }>(
    '/api/department-targets',
    month ? { month } : undefined
  )
  return toCamelCase(res.data)
}

export async function saveDepartmentTarget(target: Omit<DepartmentTarget, 'id'>): Promise<void> {
  await apiPost('/api/department-targets', toSnakeCase(target))
}

export async function deleteDepartmentTarget(id: number): Promise<void> {
  await apiDelete(`/api/department-targets/${id}`)
}

// 运营组目标
export async function fetchOperatorGroupTargets(month?: string): Promise<OperatorGroupTarget[]> {
  const res = await apiGet<{ success: boolean; data: unknown[] }>(
    '/api/operator-group-targets',
    month ? { month } : undefined
  )
  return toCamelCase(res.data)
}

export async function saveOperatorGroupTarget(target: Omit<OperatorGroupTarget, 'id'>): Promise<void> {
  await apiPost('/api/operator-group-targets', toSnakeCase(target))
}

export async function deleteOperatorGroupTarget(id: number): Promise<void> {
  await apiDelete(`/api/operator-group-targets/${id}`)
}

// 运营目标
export async function fetchOperatorTargets(month?: string): Promise<OperatorTarget[]> {
  const res = await apiGet<{ success: boolean; data: unknown[] }>(
    '/api/operator-targets',
    month ? { month } : undefined
  )
  return toCamelCase(res.data)
}

export async function saveOperatorTarget(target: Omit<OperatorTarget, 'id'>): Promise<void> {
  await apiPost('/api/operator-targets', toSnakeCase(target))
}

export async function deleteOperatorTarget(id: number): Promise<void> {
  await apiDelete(`/api/operator-targets/${id}`)
}

// ==================== 数据导入 ====================

export async function importOrders(file: File): Promise<{ count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${getBaseUrl()}/api/import/orders`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail)
  }
  return res.json()
}

export async function importAds(file: File): Promise<{ count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${getBaseUrl()}/api/import/ads`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail)
  }
  return res.json()
}

export async function importSkuBase(file: File): Promise<{ count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${getBaseUrl()}/api/import/sku-base`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail)
  }
  return res.json()
}

export async function importShops(file: File): Promise<{ count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${getBaseUrl()}/api/import/shops`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail)
  }
  return res.json()
}

export async function importWarehouseFreight(file: File): Promise<{ count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${getBaseUrl()}/api/import/warehouse-freight`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail)
  }
  return res.json()
}

// ==================== 健康检查 ====================

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}
