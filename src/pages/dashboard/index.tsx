import React, { useMemo, useCallback, useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Percent, MousePointerClick } from 'lucide-react'
import { KPICard, DualKPICard } from '@/components/data/KPICard'
import { LineChart, MultiLineChart, BarChart, PieChart } from '@/components/charts'
import { formatCurrency, toDateString, cn } from '@/lib/utils'
import { useDataStore, useSystemStore, useTargetStore } from '@/store'
import { WAREHOUSE_FREIGHT_TYPE } from '@/types'
import type { Order, AdData, ShopRate, SkuFreight, SkuRefundRate, SkuBaseInfo, DailyShopSummary } from '@/types'
import { DashboardFilter } from '@/components/filters/DashboardFilter'
import dayjs from 'dayjs'

// 预创建查找Map
function createLookupMaps(
  shopRates: ShopRate[],
  skuFreights: SkuFreight[],
  skuRefundRates: SkuRefundRate[],
  skuBaseInfo: SkuBaseInfo[]
) {
  const shopRateMap = new Map<string, ShopRate>()
  shopRates.forEach(r => shopRateMap.set(r.shop, r))

  const skuFreightMap = new Map<string, SkuFreight>()
  skuFreights.forEach(f => skuFreightMap.set(f.sku, f))

  const skuRefundRateMap = new Map<string, SkuRefundRate>()
  skuRefundRates.forEach(r => skuRefundRateMap.set(`${r.shop}-${r.sku}`, r))

  const skuBaseInfoMap = new Map<string, SkuBaseInfo>()
  skuBaseInfo.forEach(i => skuBaseInfoMap.set(`${i.shop}-${i.sku}`, i))

  const spuShopInfoMap = new Map<string, SkuBaseInfo>()
  skuBaseInfo.forEach(i => spuShopInfoMap.set(`${i.spu}-${i.shop}`, i))

  return { shopRateMap, skuFreightMap, skuRefundRateMap, skuBaseInfoMap, spuShopInfoMap }
}

interface DashboardPageProps {
  onHeaderSlotChange?: (slot: React.ReactNode) => void
}

export function DashboardPage({ onHeaderSlotChange }: DashboardPageProps) {
  const { orders, adData } = useDataStore()
  const { shopRates, skuFreights, skuRefundRates, skuBaseInfo } = useSystemStore()
  const { departmentTargets } = useTargetStore()

  // ========== 筛选状态（自管理）==========
  const [filterMonths, setFilterMonths] = useState<string[]>([dayjs().format('YYYY-MM')])
  const [filterShops, setFilterShops] = useState<string[]>([])
  const [filterGroups, setFilterGroups] = useState<string[]>([])
  const [filterOperators, setFilterOperators] = useState<string[]>([])

  // ========== 筛选器选项 ==========
  const filterOptions = useMemo(() => {
    const shops = [...new Set([
      ...orders.map(o => o.shop).filter(Boolean),
      ...skuBaseInfo.map(s => s.shop).filter(Boolean),
    ])].sort()
    return { shops }
  }, [orders, skuBaseInfo])

  // 暴露插槽到 Header
  const handleFilterChange = useCallback((months: string[], shops: string[]) => {
    setFilterMonths(months)
    setFilterShops(shops)
    if (onHeaderSlotChange) {
      onHeaderSlotChange(
        <DashboardFilter
          shops={filterOptions.shops}
          filterMonths={months}
          filterShops={shops}
          onMonthsChange={v => handleFilterChange(v, shops)}
          onShopsChange={v => handleFilterChange(months, v)}
        />
      )
    }
  }, [onHeaderSlotChange, filterOptions])

  // 初始化时暴露插槽
  useEffect(() => {
    if (onHeaderSlotChange) {
      handleFilterChange(filterMonths, filterShops)
    }
    return () => {
      if (onHeaderSlotChange) onHeaderSlotChange(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ========== 预创建查找Map ==========
  const maps = useMemo(() =>
    createLookupMaps(shopRates, skuFreights, skuRefundRates, skuBaseInfo),
    [shopRates, skuFreights, skuRefundRates, skuBaseInfo]
  )
  const { shopRateMap, skuFreightMap, skuRefundRateMap, skuBaseInfoMap, spuShopInfoMap } = maps

  // ========== 按筛选条件过滤数据 ==========
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const dateStr = toDateString(o.date)
      // 月份筛选：日期前缀匹配任一选中月份
      if (filterMonths.length > 0 && !filterMonths.some(m => dateStr.startsWith(m))) return false
      // 店铺筛选
      if (filterShops.length > 0 && !filterShops.includes(o.shop)) return false
      // 运营组/运营筛选：从 SKU 基础信息查
      const skuInfo = skuBaseInfoMap.get(`${o.shop}-${o.sku}`)
      if (filterGroups.length > 0 && skuInfo && !filterGroups.includes(skuInfo.operatorGroup)) return false
      if (filterOperators.length > 0 && skuInfo && !filterOperators.includes(skuInfo.operator)) return false
      return true
    })
  }, [orders, filterMonths, filterShops, filterGroups, filterOperators, skuBaseInfoMap])

  const filteredAdData = useMemo(() => {
    return adData.filter(a => {
      const dateStr = toDateString(a.date)
      if (filterMonths.length > 0 && !filterMonths.some(m => dateStr.startsWith(m))) return false
      if (filterShops.length > 0 && !filterShops.includes(a.shop)) return false
      return true
    })
  }, [adData, filterMonths, filterShops])

  // ========== 步骤1：按 每日+店铺+SPU 汇总订单 ==========
  const orderByDateShopSpu = useMemo(() => {
    const map = new Map<string, {
      date: string
      shop: string
      spu: string
      sku: string
      operator: string
      operatorGroup: string
      warehouse: string
      sales: number
      cost: number
      commission: number
      quantity: number
      orderCount: number
    }>()

    filteredOrders.forEach(order => {
      const date = toDateString(order.date) || 'unknown'
      const shop = order.shop || 'unknown'
      const spu = order.spu || 'unknown'
      const sku = order.sku || ''
      const warehouse = order.warehouse || ''
      const key = `${date}-${shop}-${spu}`

      const skuInfo = skuBaseInfoMap.get(`${shop}-${sku}`)

      if (!map.has(key)) {
        map.set(key, {
          date, shop, spu, sku, warehouse,
          operator: skuInfo?.operator || '未知运营',
          operatorGroup: skuInfo?.operatorGroup || '默认组',
          sales: 0, cost: 0, commission: 0, quantity: 0, orderCount: 0,
        })
      }

      const item = map.get(key)!
      item.sales += order.sales || 0
      item.cost += order.cost || 0
      item.commission += order.commission || 0
      item.quantity += order.quantity || 1
      item.orderCount += 1
      // 如果之前的 warehouse 为空，尝试用当前订单的
      if (!item.warehouse && warehouse) {
        item.warehouse = warehouse
      }
    })

    return map
  }, [filteredOrders, skuBaseInfoMap])

  // ========== 步骤2：汇总广告数据 ==========
  const adByDateShopSpu = useMemo(() => {
    const map = new Map<string, number>()

    filteredAdData.forEach(ad => {
      const date = toDateString(ad.date) || 'unknown'
      const shop = ad.shop || 'unknown'
      const spu = ad.spu || 'unknown'
      const key = `${date}-${shop}-${spu}`

      map.set(key, (map.get(key) || 0) + (ad.adSpend || 0))
    })

    return map
  }, [filteredAdData])

  // ========== 步骤3：计算每日每店铺每SPU的三级毛利 ==========
  const dailyShopSpuData = useMemo((): DailyShopSummary[] => {
    const results: DailyShopSummary[] = []

    orderByDateShopSpu.forEach((orderItem, key) => {
      const { date, shop, spu, sku, operator, operatorGroup, sales, cost, commission, quantity } = orderItem

      const shopRate = shopRateMap.get(shop)
      const storageRate = (shopRate?.storageRate || 0) / 100
      const dspRate = (shopRate?.dspRate || 0) / 100
      const returnFreightRate = (shopRate?.refundFreightRate || 0) / 100

      const skuRefund = skuRefundRateMap.get(`${shop}-${sku}`)
      const refundRate = (skuRefund?.refundRate || 0) / 100

      const skuFreight = skuFreightMap.get(sku)
      const adSpend = adByDateShopSpu.get(key) || 0

      const refund = sales * refundRate
      const storage = sales * storageRate
      const dsp = sales * dspRate
      const returnFreight = sales * returnFreightRate

      // 运费计算：根据订单仓库类型匹配对应运费
      let freight = 0
      if (skuFreight && orderItem.warehouse) {
        const freightType = WAREHOUSE_FREIGHT_TYPE[orderItem.warehouse] || 'cg'
        if (freightType === 'cg') {
          freight = (skuFreight.cgFreight || 0) * quantity
        } else if (freightType === 'pl') {
          freight = (skuFreight.plFreight || 0) * quantity
        } else if (freightType === 'self') {
          freight = (skuFreight.selfFreight || 0) * quantity
        }
      }

      const grossProfit = sales - cost - commission - adSpend - refund - freight - storage - dsp - returnFreight

      results.push({
        date, shop, spu, operator, operatorGroup,
        sales, cost, commission, adSpend, refund, freight, storage, dsp, returnFreight,
        grossProfit, quantity, orderCount: orderItem.orderCount,
      })
    })

    // 处理只有广告费没有订单的情况
    adByDateShopSpu.forEach((adSpend, key) => {
      if (!orderByDateShopSpu.has(key)) {
        const date = key.slice(0, 10)
        const remaining = key.slice(11)
        const lastDashIndex = remaining.lastIndexOf('-')
        const shop = remaining.slice(0, lastDashIndex)
        const spu = remaining.slice(lastDashIndex + 1)
        const skuInfo = spuShopInfoMap.get(`${spu}-${shop}`)

        results.push({
          date, shop, spu,
          operator: skuInfo?.operator || '未知运营',
          operatorGroup: skuInfo?.operatorGroup || '默认组',
          sales: 0, cost: 0, commission: 0, adSpend, refund: 0, freight: 0, storage: 0, dsp: 0, returnFreight: 0,
          grossProfit: 0 - adSpend, quantity: 0, orderCount: 0,
        })
      }
    })

    return results
  }, [orderByDateShopSpu, adByDateShopSpu, shopRateMap, skuFreightMap, skuRefundRateMap, spuShopInfoMap])

  // ========== 步骤4：按日期汇总 ==========
  const byDate = useMemo(() => {
    const map = new Map<string, {
      date: string
      sales: number
      grossProfit: number
      adSpend: number
      cost: number
      commission: number
      refund: number
      freight: number
      storage: number
      dsp: number
      returnFreight: number
    }>()

    dailyShopSpuData.forEach(item => {
      const existing = map.get(item.date)
      if (existing) {
        existing.sales += item.sales
        existing.grossProfit += item.grossProfit
        existing.adSpend += item.adSpend
        existing.cost += item.cost
        existing.commission += item.commission
        existing.refund += item.refund
        existing.freight += item.freight
        existing.storage += item.storage
        existing.dsp += item.dsp
        existing.returnFreight += item.returnFreight
      } else {
        map.set(item.date, {
          date: item.date,
          sales: item.sales, grossProfit: item.grossProfit, adSpend: item.adSpend,
          cost: item.cost, commission: item.commission, refund: item.refund,
          freight: item.freight, storage: item.storage, dsp: item.dsp, returnFreight: item.returnFreight,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [dailyShopSpuData])

  // ========== 步骤5：按店铺汇总 ==========
  const byShop = useMemo(() => {
    const map = new Map<string, {
      shop: string
      sales: number
      grossProfit: number
      adSpend: number
    }>()

    dailyShopSpuData.forEach(item => {
      const existing = map.get(item.shop)
      if (existing) {
        existing.sales += item.sales
        existing.grossProfit += item.grossProfit
        existing.adSpend += item.adSpend
      } else {
        map.set(item.shop, {
          shop: item.shop,
          sales: item.sales, grossProfit: item.grossProfit, adSpend: item.adSpend,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.sales - a.sales)
  }, [dailyShopSpuData])

  // ========== 步骤6：按运营组汇总 ==========
  const byOperatorGroup = useMemo(() => {
    const map = new Map<string, {
      operatorGroup: string
      sales: number
      grossProfit: number
      adSpend: number
      orderCount: number
    }>()

    dailyShopSpuData.forEach(item => {
      const group = item.operatorGroup || '默认组'
      const existing = map.get(group)
      if (existing) {
        existing.sales += item.sales
        existing.grossProfit += item.grossProfit
        existing.adSpend += item.adSpend
        existing.orderCount += item.orderCount
      } else {
        map.set(group, {
          operatorGroup: group,
          sales: item.sales,
          grossProfit: item.grossProfit,
          adSpend: item.adSpend,
          orderCount: item.orderCount,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.sales - a.sales)
  }, [dailyShopSpuData])

  // ========== 步骤7：按运营汇总 ==========
  const byOperator = useMemo(() => {
    const map = new Map<string, {
      operator: string
      operatorGroup: string
      sales: number
      grossProfit: number
      adSpend: number
      orderCount: number
    }>()

    dailyShopSpuData.forEach(item => {
      const operator = item.operator || '未知运营'
      const existing = map.get(operator)
      if (existing) {
        existing.sales += item.sales
        existing.grossProfit += item.grossProfit
        existing.adSpend += item.adSpend
        existing.orderCount += item.orderCount
      } else {
        map.set(operator, {
          operator,
          operatorGroup: item.operatorGroup || '默认组',
          sales: item.sales,
          grossProfit: item.grossProfit,
          adSpend: item.adSpend,
          orderCount: item.orderCount,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.sales - a.sales)
  }, [dailyShopSpuData])

  // ========== 本月目标查找 ==========
  const currentMonth = filterMonths[0] || dayjs().format('YYYY-MM')
  const monthTarget = departmentTargets.find(t => t.month === currentMonth)
  const targetSales = monthTarget?.targetSales || 0
  const targetGrossProfit = monthTarget?.targetGrossProfit || 0

  // ========== 汇总计算 ==========
  const totalSales = byDate.reduce((sum, d) => sum + d.sales, 0)
  const totalCost = byDate.reduce((sum, d) => sum + d.cost, 0)
  const totalCommission = byDate.reduce((sum, d) => sum + d.commission, 0)
  const totalAdSpend = byDate.reduce((sum, d) => sum + d.adSpend, 0)
  const totalRefund = byDate.reduce((sum, d) => sum + d.refund, 0)
  const totalFreight = byDate.reduce((sum, d) => sum + d.freight, 0)
  const totalStorage = byDate.reduce((sum, d) => sum + d.storage, 0)
  const totalDsp = byDate.reduce((sum, d) => sum + d.dsp, 0)
  const totalReturnFreight = byDate.reduce((sum, d) => sum + d.returnFreight, 0)
  const totalGrossProfit = totalSales - totalCost - totalCommission - totalAdSpend - totalRefund - totalFreight - totalStorage - totalDsp - totalReturnFreight
  const avgMarginRate = totalSales > 0 ? totalGrossProfit / totalSales : 0
  const avgAcoas = totalSales > 0 ? totalAdSpend / totalSales : 0

  // ========== 目标达成计算 ==========
  const salesAchievement = targetSales > 0 ? (totalSales / targetSales) * 100 : 0
  const profitAchievement = targetGrossProfit > 0 ? (totalGrossProfit / targetGrossProfit) * 100 : 0

  const { operatorGroupTargets, operatorTargets } = useTargetStore()
  const groupTargetMap = new Map(
    operatorGroupTargets.filter(t => t.month === currentMonth).map(t => [t.operatorGroup, t])
  )
  const opTargetMap = new Map(
    operatorTargets.filter(t => t.month === currentMonth).map(t => [t.operator, t])
  )

  const achievementBadge = (pct: number) => pct >= 100 ? 'bg-green-100 text-green-700'
    : pct >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'

  // ========== 调试 ==========
  React.useEffect(() => {
    console.group('=== Dashboard 数据诊断 ===')
    console.log('原始订单数:', orders.length)
    console.log('筛选后订单数:', filteredOrders.length)
    console.log('月份筛选:', filterMonths)
    console.log('总销售额:', totalSales)
    console.log('总成本:', totalCost)
    console.log('总佣金:', totalCommission)
    console.log('日期范围:', [...new Set(filteredOrders.map(o => toDateString(o.date)))])
    console.groupEnd()
  }, [orders, filteredOrders, filterMonths, totalSales, totalCost, totalCommission])

  // ========== 早期返回 ==========
  if (dailyShopSpuData.length === 0 && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-gray-500 text-lg">暂无数据</div>
        <div className="text-gray-400">请先在"数据导入"页面导入订单数据</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ========== KPI 卡片行 ========== */}
      {/* 顺序：销售额 → 三级毛利 → 毛利率（无目标）→ 广告数据 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. 本月销售额（含目标达成） */}
        <div className="bg-white rounded-lg border p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-100 rounded-md">
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">本月销售额</span>
          </div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(totalSales)}</div>
          {/* 目标达成进度条 */}
          {targetSales > 0 ? (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>目标 {formatCurrency(targetSales)}</span>
                <span className={cn(
                  salesAchievement >= 100 ? 'text-green-600 font-semibold' :
                  salesAchievement >= 70 ? 'text-yellow-600 font-semibold' :
                  'text-red-500 font-semibold'
                )}>
                  {salesAchievement.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all',
                    salesAchievement >= 100 ? 'bg-green-500' :
                    salesAchievement >= 70 ? 'bg-yellow-400' :
                    'bg-red-400'
                  )}
                  style={{ width: `${Math.min(salesAchievement, 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-gray-400">暂无目标配置</div>
          )}
        </div>
        {/* 2. 三级毛利（含毛利目标达成） */}
        <div className="bg-white rounded-lg border p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-green-100 rounded-md">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs text-gray-500">三级毛利</span>
          </div>
          <div className="text-xl font-bold text-green-600">{formatCurrency(totalGrossProfit)}</div>
          {/* 毛利目标达成进度条 */}
          {targetGrossProfit > 0 ? (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>目标 {formatCurrency(targetGrossProfit)}</span>
                <span className={cn(
                  profitAchievement >= 100 ? 'text-green-600 font-semibold' :
                  profitAchievement >= 70 ? 'text-yellow-600 font-semibold' :
                  'text-red-500 font-semibold'
                )}>
                  {profitAchievement.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all',
                    profitAchievement >= 100 ? 'bg-green-500' :
                    profitAchievement >= 70 ? 'bg-yellow-400' :
                    'bg-red-400'
                  )}
                  style={{ width: `${Math.min(profitAchievement, 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-gray-400">暂无毛利目标配置</div>
          )}
        </div>
        {/* 3. 毛利率（无目标，纯展示） */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-orange-100 rounded-md">
              <Percent className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-xs text-gray-500">毛利率</span>
          </div>
          <div className="text-xl font-bold text-orange-600">{(avgMarginRate * 100).toFixed(1)}%</div>
        </div>
        {/* 4. 广告数据 */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-purple-100 rounded-md">
              <MousePointerClick className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-xs text-gray-500">广告数据</span>
          </div>
          <div className="text-xl font-bold text-purple-600">{formatCurrency(totalAdSpend)}</div>
          <div className="text-xs text-gray-400 mt-0.5">ACoAS {(avgAcoas * 100).toFixed(2)}%</div>
        </div>
      </div>

      {/* ========== 成本结构分解：饼图 + 数据卡片 1:1 ========== */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-4">成本结构分解</h3>
        <div className="grid grid-cols-2 gap-6">
          {/* 左侧：饼图（标签显示百分比，hover显示金额） */}
          <div>
            <PieChart
              height={360}
              tooltipFormatter="{b}: ${c.toFixed(2)} ({d}%)"
              data={[
                { name: '成本', value: totalCost },
                { name: '佣金', value: totalCommission },
                { name: '广告', value: totalAdSpend },
                { name: '退款', value: totalRefund },
                { name: '运费', value: totalFreight },
                { name: '仓储', value: totalStorage },
                { name: 'DSP', value: totalDsp },
                { name: '退货运', value: totalReturnFreight },
                { name: '三级毛利', value: totalGrossProfit },
              ]}
              colors={['#EF4444', '#F97316', '#8B5CF6', '#3B82F6', '#22C55E', '#06B6D4', '#6366F1', '#EC4899', '#10B981']}
            />
          </div>
          {/* 右侧：成本数据卡片 2列（金额 + 百分比） */}
          <div className="grid grid-cols-2 gap-2 content-start">
            {[
              { label: '成本', value: totalCost, color: 'text-red-600', bg: 'bg-red-50' },
              { label: '佣金', value: totalCommission, color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: '广告费', value: totalAdSpend, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: '退款费', value: totalRefund, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: '运费', value: totalFreight, color: 'text-green-600', bg: 'bg-green-50' },
              { label: '仓储费', value: totalStorage, color: 'text-cyan-600', bg: 'bg-cyan-50' },
              { label: 'DSP费', value: totalDsp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: '退货运费', value: totalReturnFreight, color: 'text-pink-600', bg: 'bg-pink-50' },
              { label: '三级毛利', value: totalGrossProfit, color: 'text-emerald-600', bg: 'bg-emerald-50', border: true },
            ].map((item) => (
              <div key={item.label} className={`p-2 rounded-lg ${item.bg} ${item.border ? 'border-2 border-emerald-200' : ''}`}>
                <div className="text-xs text-gray-500">{item.label}</div>
                <div className={`text-sm font-bold ${item.color}`}>{formatCurrency(item.value)}</div>
                <div className="text-xs text-gray-400">{totalSales > 0 ? (item.value / totalSales * 100).toFixed(2) : '0.00'}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========== 销售额趋势（折线图 + 数字标注） ========== */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-3">销售额趋势</h3>
        <LineChart
          data={byDate.map(d => ({ name: d.date, value: d.sales }))}
          color="#3B82F6"
          showValue
          showArea
        />
      </div>

      {/* ========== 毛利额 & 毛利率趋势（均改为折线图） ========== */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-3">毛利额 & 毛利率趋势</h3>
        <MultiLineChart
          series={[
            {
              name: '毛利额',
              data: byDate.map(d => ({ name: d.date, value: d.grossProfit })),
              color: '#22C55E',
              yAxisIndex: 0,
              type: 'line'
            },
            {
              name: '毛利率',
              data: byDate.map(d => ({ name: d.date, value: d.sales > 0 ? d.grossProfit / d.sales * 100 : 0 })),
              color: '#F59E0B',
              yAxisIndex: 1,
              type: 'line'
            },
          ]}
        />
      </div>

      {/* ========== 运营组数据看板（图表 + 小格子卡片） ========== */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-blue-500 rounded"></div>
          <h3 className="text-lg font-semibold">运营组数据看板</h3>
          <span className="text-sm text-gray-500 ml-2">({byOperatorGroup.length} 个运营组)</span>
        </div>

        {/* 趋势图表：三个独立柱状图（销售额、毛利额、毛利率） */}
        {byOperatorGroup.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-500 mb-1 font-medium">销售额</div>
              <BarChart
                data={byOperatorGroup.map(g => ({ name: g.operatorGroup, value: g.sales }))}
                formatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}`}
                color="#3B82F6"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1 font-medium">毛利额</div>
              <BarChart
                data={byOperatorGroup.map(g => ({ name: g.operatorGroup, value: g.grossProfit }))}
                formatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}`}
                color="#10B981"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1 font-medium">毛利率</div>
              <BarChart
                data={byOperatorGroup.map(g => ({ 
                  name: g.operatorGroup, 
                  value: g.sales > 0 ? parseFloat((g.grossProfit / g.sales * 100).toFixed(2)) : 0 
                }))}
                formatter={(v) => `${v.toFixed(1)}%`}
                color="#F59E0B"
              />
            </div>
          </div>
        )}

        {/* 小格子卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {byOperatorGroup.map((group, index) => {
            const marginRate = group.sales > 0 ? group.grossProfit / group.sales * 100 : 0
            const acos = group.sales > 0 ? group.adSpend / group.sales * 100 : 0
            const tgt = groupTargetMap.get(group.operatorGroup)
            const tgtSales = tgt?.targetSales || 0
            const tgtProfit = tgt?.targetGrossProfit || 0
            const salesAch = tgtSales > 0 ? (group.sales / tgtSales) * 100 : 0
            const profitAch = tgtProfit > 0 ? (group.grossProfit / tgtProfit) * 100 : 0
            return (
              <div key={group.operatorGroup} className="border rounded-xl p-3 bg-slate-50/60 hover:bg-blue-50/30 transition-colors">
                {/* 头部：排名+名称 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-100 text-gray-600' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-200 text-slate-500'
                  }`}>{index + 1}</span>
                  <span className="font-semibold text-sm text-gray-900 truncate">{group.operatorGroup}</span>
                </div>
                {/* 指标网格：2列 */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div>
                    <div className="text-xs text-gray-400">销售额</div>
                    <div className="text-sm font-bold text-gray-900">{formatCurrency(group.sales)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">销售目标</div>
                    <div className="text-sm font-medium text-gray-600">{tgtSales > 0 ? formatCurrency(tgtSales) : '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">销售达成</div>
                    <div className="text-sm font-semibold">
                      {tgtSales > 0
                        ? <span className={`text-xs px-1.5 py-0.5 rounded ${achievementBadge(salesAch)}`}>{salesAch.toFixed(1)}%</span>
                        : <span className="text-xs text-gray-400">N/A</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">毛利额</div>
                    <div className="text-sm font-bold text-green-600">{formatCurrency(group.grossProfit)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">毛利目标</div>
                    <div className="text-sm font-medium text-gray-600">{tgtProfit > 0 ? formatCurrency(tgtProfit) : '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">毛利达成</div>
                    <div className="text-sm font-semibold">
                      {tgtProfit > 0
                        ? <span className={`text-xs px-1.5 py-0.5 rounded ${achievementBadge(profitAch)}`}>{profitAch.toFixed(1)}%</span>
                        : <span className="text-xs text-gray-400">N/A</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">毛利率</div>
                    <div className="text-sm font-bold text-orange-500">{marginRate.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">ACoAS</div>
                    <div className="text-sm font-medium text-purple-600">{acos.toFixed(2)}%</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="text-xs text-gray-400 mt-3">* 目标数据需在目标设置中配置后展示</div>
      </div>

      {/* ========== 运营数据看板（图表 + 小格子卡片） ========== */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-green-500 rounded"></div>
          <h3 className="text-lg font-semibold">运营数据看板</h3>
          <span className="text-sm text-gray-500 ml-2">({byOperator.length} 位运营)</span>
        </div>

        {/* 趋势图表：三个独立柱状图（销售额、毛利额、毛利率） */}
        {byOperator.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-500 mb-1 font-medium">销售额</div>
              <BarChart
                data={byOperator.map(g => ({ name: g.operator, value: g.sales }))}
                formatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}`}
                color="#3B82F6"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1 font-medium">毛利额</div>
              <BarChart
                data={byOperator.map(g => ({ name: g.operator, value: g.grossProfit }))}
                formatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}`}
                color="#10B981"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1 font-medium">毛利率</div>
              <BarChart
                data={byOperator.map(g => ({ 
                  name: g.operator, 
                  value: g.sales > 0 ? parseFloat((g.grossProfit / g.sales * 100).toFixed(2)) : 0 
                }))}
                formatter={(v) => `${v.toFixed(1)}%`}
                color="#F59E0B"
              />
            </div>
          </div>
        )}

        {/* 小格子卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {byOperator.map((op, index) => {
            const acos = op.sales > 0 ? op.adSpend / op.sales * 100 : 0
            const marginRate = op.sales > 0 ? op.grossProfit / op.sales * 100 : 0
            const tgt = opTargetMap.get(op.operator)
            const tgtSales = tgt?.targetSales || 0
            const tgtProfit = tgt?.targetGrossProfit || 0
            const salesAch = tgtSales > 0 ? (op.sales / tgtSales) * 100 : 0
            const profitAch = tgtProfit > 0 ? (op.grossProfit / tgtProfit) * 100 : 0
            return (
              <div key={op.operator} className="border rounded-xl p-3 bg-slate-50/60 hover:bg-green-50/30 transition-colors">
                {/* 头部：排名+名称+组 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-100 text-gray-600' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-200 text-slate-500'
                  }`}>{index + 1}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{op.operator}</div>
                    <div className="text-xs text-gray-400 truncate">{op.operatorGroup}</div>
                  </div>
                </div>
                {/* 指标网格：2列 */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div>
                    <div className="text-xs text-gray-400">销售额</div>
                    <div className="text-sm font-bold text-gray-900">{formatCurrency(op.sales)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">销售目标</div>
                    <div className="text-sm font-medium text-gray-600">{tgtSales > 0 ? formatCurrency(tgtSales) : '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">销售达成</div>
                    <div className="text-sm font-semibold">
                      {tgtSales > 0
                        ? <span className={`text-xs px-1.5 py-0.5 rounded ${achievementBadge(salesAch)}`}>{salesAch.toFixed(1)}%</span>
                        : <span className="text-xs text-gray-400">N/A</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">毛利额</div>
                    <div className="text-sm font-bold text-green-600">{formatCurrency(op.grossProfit)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">毛利目标</div>
                    <div className="text-sm font-medium text-gray-600">{tgtProfit > 0 ? formatCurrency(tgtProfit) : '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">毛利达成</div>
                    <div className="text-sm font-semibold">
                      {tgtProfit > 0
                        ? <span className={`text-xs px-1.5 py-0.5 rounded ${achievementBadge(profitAch)}`}>{profitAch.toFixed(1)}%</span>
                        : <span className="text-xs text-gray-400">N/A</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">毛利率</div>
                    <div className="text-sm font-bold text-orange-500">{marginRate.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">ACoAS</div>
                    <div className="text-sm font-medium text-purple-600">{acos.toFixed(2)}%</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="text-xs text-gray-400 mt-3">* 目标数据需在目标设置中配置后展示</div>
      </div>
    </div>
  )
}
