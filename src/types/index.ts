// ============================================
// HULALA 数据运营中台 - 类型定义
// ============================================

// 销售等级
export type SalesGrade = 'S' | 'A' | 'B' | 'C'

// ============================================
// 系统设置 - 四大模块
// ============================================

// 1. 店铺费率设置（店铺维度）
export interface ShopRate {
  id: string
  shop: string        // 店铺名称
  dspRate: number     // DSP费率 (%)
  refundFreightRate: number // 退货运费率 (%)
  storageRate: number // 仓储费率 (%)
}

// 2. SKU运费数据（SKU维度，三个独立导入）
export interface SkuFreight {
  id: string
  sku: string         // SKU编码
  cgFreight: number   // CG运费（单位：美元）
  plFreight: number   // 3PL运费（单位：美元）
  selfFreight: number // 自运费（单位：美元）
}

// 3. SKU退款率（店铺+SKU维度）
export interface SkuRefundRate {
  id: string
  shop: string        // 店铺名称
  sku: string         // SKU编码
  refundRate: number  // 退款率 (%)
}

// 4. SKU基础信息（店铺+SKU维度）
export interface SkuBaseInfo {
  id: string
  shop: string        // 店铺名称
  sku: string         // SKU编码
  spu: string          // SPU编码
  lifecycle: string    // 生命周期
  productLevel: string // 产品定级
  operator: string     // 运营
  operatorGroup: string // 运营组
}

// ============================================
// 目标设置
// ============================================

// 部门月度目标（整体维度）
export interface DepartmentTarget {
  id: number | string
  shop?: string
  month: string       // YYYY-MM
  targetSales: number // 销售额目标
  targetGrossProfit: number // 三级毛利额目标
  targetMarginRate?: number // 毛利率目标
}

// 运营组月度目标（运营组维度）
export interface OperatorGroupTarget {
  id: number | string
  month: string        // YYYY-MM
  operatorGroup: string // 运营组
  targetSales: number  // 销售额目标
  targetGrossProfit: number // 三级毛利额目标
}

// 运营月度目标（运营维度）
export interface OperatorTarget {
  id: number | string
  month: string        // YYYY-MM
  operator: string      // 运营
  operatorGroup: string // 所属运营组
  targetSales: number  // 销售额目标
  targetGrossProfit: number // 三级毛利额目标
}

// ============================================
// 业务数据
// ============================================

// 订单数据
export interface Order {
  id: string
  date: string        // 日期
  shop: string        // 店铺
  orderId: string     // 订单号
  sku: string         // SKU
  spu: string         // SPU
  quantity: number     // 数量
  sales: number        // 销售额 (USD)
  cost: number        // 成本 (USD)
  commission: number   // 佣金 (USD)
  warehouse: string    // 仓库 (CG/3PL/自运费)
  // 以下字段从SKU基础信息关联获取
  operator?: string
  operatorGroup?: string
}

// 广告数据
export interface AdData {
  id: string
  date: string
  shop: string
  spu: string
  adSpend: number     // 广告花费
}

// ============================================
// 计算结果
// ============================================

// 每日店铺维度汇总
export interface DailyShopSummary {
  date: string
  shop: string
  spu?: string
  operator: string
  operatorGroup: string
  warehouse?: string      // 仓库类型 (CG/3PL/自运费)
  sales: number           // 销售额
  cost: number            // 成本
  commission: number      // 佣金
  adSpend: number         // 广告费
  refund: number          // 退货费
  freight: number         // 运费
  storage: number         // 仓储费
  dsp: number             // DSP费
  returnFreight: number   // 退货运费
  grossProfit: number     // 三级毛利额
  quantity: number        // 销售数量
  orderCount: number      // 订单数量
}

// SPU汇总
export interface SpuSummary {
  spu: string
  shop: string
  lifecycle: string
  productLevel: string
  salesGrade: string
  operator: string
  operatorGroup: string
  
  // 核心数据
  totalSales: number
  totalCost: number
  totalQuantity: number
  orderCount: number
  
  // 成本项
  totalCommission: number
  totalAdSpend: number
  totalRefund: number
  totalFreight: number
  totalStorage: number
  totalDsp: number
  totalReturnFreight: number
  
  // 成本项比率
  costRate: number
  commissionRate: number
  adSpendRate: number
  refundRate: number
  freightRate: number
  storageRate_field: number
  dspRate_field: number
  returnFreightRate_field: number
  
  // 毛利
  grossProfit: number
  grossMarginRate: number
  
  // 目标
  isOnTarget: boolean
  targetMarginRate: number
}

// ============================================
// 筛选器
// ============================================

// 品类
export type Category = '软包家具' | '板式家具'

export interface FilterState {
  month: string        // YYYY-MM 格式（兼容旧代码）
  months: string[]     // 多选月份（Dashboard/SPU 用）YYYY-MM 格式
  dateRange: {
    start: string
    end: string
  }
  shops: string[]
  operatorGroups: string[]
  operators: string[]
  categories: Category[]
  salesGrades: (SalesGrade | string)[]
  spus: string[]
}

// ============================================
// 辅助类型
// ============================================

// 预警
export interface Alert {
  type: 'danger' | 'warning' | 'info'
  title: string
  description: string
  shop?: string
  spu?: string
}

// 未达标SPU
export interface UnTargetSpu {
  spu: string
  shop: string
  operator: string
  currentMargin: number
  targetMargin: number
  gap: number
  reason: string
}

// 待办事项
export interface TodoItem {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  assignee?: string
  relatedSpu?: string
  status: 'pending' | 'done'
}

// 仓库运费类型映射
export const WAREHOUSE_FREIGHT_TYPE: Record<string, 'cg' | 'pl' | 'self'> = {
  'CG': 'cg',
  'cg': 'cg',
  'CastleGate': 'cg',
  'castlegate': 'cg',
  'KH-US-CastleGate': 'cg',
  '3PL': 'pl',
  '3pl': 'pl',
  'FBA': 'pl',
  'fba': 'pl',
  '自运费': 'self',
  '自运': 'self',
  'Self': 'self',
  'self': 'self',
}
