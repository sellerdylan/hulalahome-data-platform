/**
 * API 服务层 - 后端数据交互
 * 所有前后端数据交互都通过这里
 */
import type {
  Order,
  AdData,
  ShopRate,
  SkuFreight,
  SkuRefundRate,
  SkuBaseInfo,
  DepartmentTarget,
  OperatorGroupTarget,
  OperatorTarget,
} from '@/types'

// ============================================
// API 配置
// ============================================
const getBaseUrl = () => {
  // 优先使用环境变量（Vercel 部署时在环境变量中配置）
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // 本地开发环境
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:8000'
  }
  // 阿里云服务器部署：后端在容器中运行在 8000 端口
  return 'http://8.136.191.90:8000'
}

const getHeaders = () => ({
  'Content-Type': 'application/json',
})

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: getHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function apiPost<T>(path: string, data?: unknown): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: data ? JSON.stringify(data) : undefined,
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

// ============================================
// 统计概览
// ============================================
export interface StatsOverview {
  order_count: number
  ad_count: number
  sku_count: number
  shop_count: number
  date_range: { start: string | null; end: string | null }
  total_ad_spend: number
}

export async function getStatsOverview(): Promise<StatsOverview> {
  const res = await apiGet<{ success: boolean; data: StatsOverview }>('/api/stats/overview')
  return res.data
}

// ============================================
// 筛选选项
// ============================================
export async function getShopOptions(): Promise<string[]> {
  const res = await apiGet<{ success: boolean; data: string[] }>('/api/options/shops')
  return res.data
}

export async function getOperatorOptions(): Promise<string[]> {
  const res = await apiGet<{ success: boolean; data: string[] }>('/api/options/operators')
  return res.data
}

export async function getOperatorGroupOptions(): Promise<string[]> {
  const res = await apiGet<{ success: boolean; data: string[] }>('/api/options/operator-groups')
  return res.data
}

export async function getCategoryOptions(): Promise<string[]> {
  const res = await apiGet<{ success: boolean; data: string[] }>('/api/options/categories')
  return res.data
}

// ============================================
// Dashboard 数据
// ============================================
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

export async function getDashboardSummary(params: {
  startDate: string
  endDate: string
  shop?: string
  operatorGroup?: string
  operator?: string
  category?: string
}): Promise<DashboardSummaryItem[]> {
  const query = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
  })
  if (params.shop) query.set('shop', params.shop)
  if (params.operatorGroup) query.set('operator_group', params.operatorGroup)
  if (params.operator) query.set('operator', params.operator)
  if (params.category) query.set('category', params.category)

  const res = await apiGet<{ success: boolean; data: DashboardSummaryItem[] }>(
    `/api/dashboard/summary?${query.toString()}`
  )
  return res.data
}

// ============================================
// SPU 数据
// ============================================
export interface SpuListItem {
  spu: string
  shop: string
  category: string
  sales_grade: string
  operator: string
  operator_group: string
  refund_rate: number
  cg_freight: number
  pl_freight: number
  fedex_freight: number
  total_sales: number
  total_commission: number
  total_cost: number
  order_count: number
  total_ad_spend: number
  gross_profit: number
  gross_margin_rate: number
}

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

export async function getSpuList(params: {
  startDate?: string
  endDate?: string
  shop?: string
  operatorGroup?: string
  operator?: string
  salesGrade?: string
  category?: string
}): Promise<SpuListItem[]> {
  const query = new URLSearchParams()
  if (params.startDate) query.set('start_date', params.startDate)
  if (params.endDate) query.set('end_date', params.endDate)
  if (params.shop) query.set('shop', params.shop)
  if (params.operatorGroup) query.set('operator_group', params.operatorGroup)
  if (params.operator) query.set('operator', params.operator)
  if (params.salesGrade) query.set('sales_grade', params.salesGrade)
  if (params.category) query.set('category', params.category)

  const res = await apiGet<{ success: boolean; data: SpuListItem[] }>(
    `/api/spu/list?${query.toString()}`
  )
  return res.data
}

export async function getSpuDaily(params: {
  spu: string
  shop?: string
  startDate?: string
  endDate?: string
}): Promise<SpuDailyItem[]> {
  const query = new URLSearchParams({ spu: params.spu })
  if (params.shop) query.set('shop', params.shop)
  if (params.startDate) query.set('start_date', params.startDate)
  if (params.endDate) query.set('end_date', params.endDate)

  const res = await apiGet<{ success: boolean; data: SpuDailyItem[] }>(
    `/api/spu/daily?${query.toString()}`
  )
  return res.data
}

// ============================================
// 店铺管理
// ============================================
export async function getShops(): Promise<ShopRate[]> {
  const res = await apiGet<{ success: boolean; data: ShopRate[] }>('/api/shops')
  return res.data
}

export async function saveShop(shop: ShopRate): Promise<void> {
  await apiPost('/api/shops', shop)
}

export async function deleteShop(shopName: string): Promise<void> {
  await apiDelete(`/api/shops/${encodeURIComponent(shopName)}`)
}

// ============================================
// 目标管理
// ============================================
export async function getDepartmentTargets(month?: string): Promise<DepartmentTarget[]> {
  const query = month ? `?month=${month}` : ''
  const res = await apiGet<{ success: boolean; data: DepartmentTarget[] }>(
    `/api/department-targets${query}`
  )
  return res.data
}

export async function saveDepartmentTarget(target: DepartmentTarget): Promise<void> {
  await apiPost('/api/department-targets', target)
}

export async function deleteDepartmentTarget(targetId: number): Promise<void> {
  await apiDelete(`/api/department-targets/${targetId}`)
}

export async function getOperatorGroupTargets(month?: string): Promise<OperatorGroupTarget[]> {
  const query = month ? `?month=${month}` : ''
  const res = await apiGet<{ success: boolean; data: OperatorGroupTarget[] }>(
    `/api/operator-group-targets${query}`
  )
  return res.data
}

export async function saveOperatorGroupTarget(target: OperatorGroupTarget): Promise<void> {
  await apiPost('/api/operator-group-targets', target)
}

export async function deleteOperatorGroupTarget(targetId: number): Promise<void> {
  await apiDelete(`/api/operator-group-targets/${targetId}`)
}

export async function getOperatorTargets(month?: string): Promise<OperatorTarget[]> {
  const query = month ? `?month=${month}` : ''
  const res = await apiGet<{ success: boolean; data: OperatorTarget[] }>(
    `/api/operator-targets${query}`
  )
  return res.data
}

export async function saveOperatorTarget(target: OperatorTarget): Promise<void> {
  await apiPost('/api/operator-targets', target)
}

export async function deleteOperatorTarget(targetId: number): Promise<void> {
  await apiDelete(`/api/operator-targets/${targetId}`)
}

// ============================================
// 文件上传导入
// ============================================
export async function importOrdersFile(file: File): Promise<{ message: string; count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await fetch(`${getBaseUrl()}/api/import/orders`, {
    method: 'POST',
    body: formData,
  })
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  
  return res.json()
}

export async function importAdsFile(file: File): Promise<{ message: string; count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await fetch(`${getBaseUrl()}/api/import/ads`, {
    method: 'POST',
    body: formData,
  })
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  
  return res.json()
}

export async function importSkuBaseFile(file: File): Promise<{ message: string; count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await fetch(`${getBaseUrl()}/api/import/sku-base`, {
    method: 'POST',
    body: formData,
  })
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  
  return res.json()
}

export async function importWarehouseFreightFile(file: File): Promise<{ message: string; count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await fetch(`${getBaseUrl()}/api/import/warehouse-freight`, {
    method: 'POST',
    body: formData,
  })
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  
  return res.json()
}

export async function importShopsFile(file: File): Promise<{ message: string; count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await fetch(`${getBaseUrl()}/api/import/shops`, {
    method: 'POST',
    body: formData,
  })
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  
  return res.json()
}

export async function importDepartmentTargetsFile(file: File): Promise<{ message: string; count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await fetch(`${getBaseUrl()}/api/import/department-targets`, {
    method: 'POST',
    body: formData,
  })
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  
  return res.json()
}

export async function importOperatorGroupTargetsFile(file: File): Promise<{ message: string; count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await fetch(`${getBaseUrl()}/api/import/operator-group-targets`, {
    method: 'POST',
    body: formData,
  })
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  
  return res.json()
}

export async function importOperatorTargetsFile(file: File): Promise<{ message: string; count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await fetch(`${getBaseUrl()}/api/import/operator-targets`, {
    method: 'POST',
    body: formData,
  })
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  
  return res.json()
}

// 保存单条目标到后端
export async function saveDepartmentTargetToBackend(target: DepartmentTarget): Promise<void> {
  await apiPost('/api/department-targets', {
    shop: (target as any).shop || '',
    target_sales: target.targetSales,
    target_gross_profit: target.targetGrossProfit,
    target_margin_rate: (target as any).targetMarginRate || 0.2,
    month: target.month,
  })
}

export async function saveOperatorGroupTargetToBackend(target: OperatorGroupTarget): Promise<void> {
  await apiPost('/api/operator-group-targets', {
    operator_group: target.operatorGroup,
    target_sales: target.targetSales,
    target_gross_profit: target.targetGrossProfit,
    month: target.month,
  })
}

export async function saveOperatorTargetToBackend(target: OperatorTarget): Promise<void> {
  await apiPost('/api/operator-targets', {
    operator: target.operator,
    operator_group: target.operatorGroup,
    target_sales: target.targetSales,
    target_gross_profit: target.targetGrossProfit,
    month: target.month,
  })
}

// ============================================
// 获取原始数据（用于前端从后端加载）
// ============================================
export async function getOrders(): Promise<Order[]> {
  const res = await apiGet<{ success: boolean; data: Order[] }>('/api/data/orders')
  return res.data || []
}

export async function getAdData(): Promise<AdData[]> {
  const res = await apiGet<{ success: boolean; data: AdData[] }>('/api/data/ad-data')
  return res.data || []
}

export async function getSkuBaseInfo(): Promise<SkuBaseInfo[]> {
  const res = await apiGet<{ success: boolean; data: SkuBaseInfo[] }>('/api/data/sku-base-info')
  return res.data || []
}

export async function getShopsData(): Promise<ShopRate[]> {
  const res = await apiGet<{ success: boolean; data: ShopRate[] }>('/api/data/shops')
  return res.data || []
}

export interface AllTargets {
  departmentTargets: DepartmentTarget[]
  operatorGroupTargets: OperatorGroupTarget[]
  operatorTargets: OperatorTarget[]
}

export async function getAllTargets(): Promise<AllTargets> {
  const res = await apiGet<{ success: boolean; data: AllTargets }>('/api/data/targets')
  return res.data || {
    departmentTargets: [],
    operatorGroupTargets: [],
    operatorTargets: []
  }
}

// ============================================
// 数据清空
// ============================================
export async function clearAllData(): Promise<{ message: string }> {
  const res = await apiDelete<{ success: boolean; message: string }>('/api/data/clear-all')
  return res
}
