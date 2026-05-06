import React, { useState, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { SpuTable } from '@/components/data/SpuTable'
import { SpuDetailDrawer } from '@/components/data/SpuDetailDrawer'
import { SpuDateFilter, type SpuDateFilterValue } from '@/components/filters/SpuDateFilter'
import { useDataStore, useSystemStore, useFilterStore } from '@/store'
import type { SpuSummary } from '@/types'
import { WAREHOUSE_FREIGHT_TYPE } from '@/types'
import { formatCurrency, toDateString } from '@/lib/utils'
import dayjs from 'dayjs'

// 判断某日期字符串是否在筛选范围内
function dateMatchesFilter(dateStr: string, filter: SpuDateFilterValue): boolean {
  if (filter.mode === 'months') {
    if (filter.selectedMonths.length === 0) return true
    // dateStr 形如 2026-04-01，取前7字符判断月份
    return filter.selectedMonths.some(m => dateStr.startsWith(m))
  } else {
    // mode === 'range'
    const { startDate, endDate } = filter
    if (!startDate && !endDate) return true
    if (startDate && dateStr < startDate) return false
    if (endDate && dateStr > endDate) return false
    return true
  }
}

interface SpuDetailPageProps {
  // 用于将 Header 右侧插槽内容回传给 App.tsx
  onHeaderSlotChange?: (slot: React.ReactNode) => void
}

export function SpuDetailPage({ onHeaderSlotChange }: SpuDetailPageProps) {
  const { orders, adData } = useDataStore()
  const { shopRates, skuFreights, skuRefundRates, skuBaseInfo } = useSystemStore()
  const { spuDateFilter: initialFilter, setSpuDateFilter } = useFilterStore()

  // ---- 日期筛选器状态（从 store 恢复）----
  const [dateFilter, setDateFilter] = useState<SpuDateFilterValue>(initialFilter)

  // ---- SPU表格内筛选状态 ----
  const [filterShops, setFilterShops] = useState<string[]>([])
  const [filterGroups, setFilterGroups] = useState<string[]>([])
  const [filterOperators, setFilterOperators] = useState<string[]>([])
  const [filterCategories, setFilterCategories] = useState<string[]>([])

  // ---- 选中SPU详情 ----
  const [selectedSpu, setSelectedSpu] = useState<SpuSummary | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ---- 当日期筛选变化时，通知父组件更新 Header 插槽并持久化----
  const handleDateFilterChange = useCallback((v: SpuDateFilterValue) => {
    setDateFilter(v)
    // 持久化到 store（会保存到 localStorage）
    setSpuDateFilter(v)
    if (onHeaderSlotChange) {
      onHeaderSlotChange(
        <SpuDateFilter value={v} onChange={handleDateFilterChange} />
      )
    }
  }, [onHeaderSlotChange, setSpuDateFilter])

  // 初次挂载时暴露插槽
  React.useEffect(() => {
    if (onHeaderSlotChange) {
      onHeaderSlotChange(
        <SpuDateFilter value={dateFilter} onChange={handleDateFilterChange} />
      )
    }
    // 卸载时清空插槽
    return () => {
      if (onHeaderSlotChange) onHeaderSlotChange(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- 预创建查找Map ----
  const maps = useMemo(() => {
    const shopRateMap = new Map<string, typeof shopRates[0]>()
    shopRates.forEach(r => shopRateMap.set(r.shop, r))

    const skuFreightMap = new Map<string, typeof skuFreights[0]>()
    skuFreights.forEach(f => skuFreightMap.set(f.sku, f))

    const skuRefundMap = new Map<string, typeof skuRefundRates[0]>()
    skuRefundRates.forEach(r => skuRefundMap.set(`${r.shop}-${r.sku}`, r))

    const skuInfoMap = new Map<string, typeof skuBaseInfo[0]>()
    skuBaseInfo.forEach(i => skuInfoMap.set(`${i.shop}-${i.sku}`, i))

    return { shopRateMap, skuFreightMap, skuRefundMap, skuInfoMap }
  }, [shopRates, skuFreights, skuRefundRates, skuBaseInfo])

  // ---- 按日期范围筛选订单 ----
  const filteredOrders = useMemo(() => {
    return orders.filter(o => dateMatchesFilter(toDateString(o.date), dateFilter))
  }, [orders, dateFilter])

  // ---- 筛选器选项（动态从数据中提取）----
  const filterOptions = useMemo(() => {
    const shops = [...new Set([
      ...filteredOrders.map(o => o.shop).filter(Boolean),
      ...skuBaseInfo.map(s => s.shop).filter(Boolean),
    ])].sort()
    const groups = [...new Set(skuBaseInfo.map(s => s.operatorGroup).filter(Boolean))].sort()
    const operators = [...new Set(skuBaseInfo.map(s => s.operator).filter(Boolean))].sort()
    const categories = ['软包家具', '板式家具']
    return { shops, groups, operators, categories }
  }, [filteredOrders, skuBaseInfo])

  // ---- 按SPU汇总 ----
  const spuData = useMemo((): SpuSummary[] => {
    const map = new Map<string, SpuSummary>()

    filteredOrders.forEach(order => {
      const shop = order.shop
      const sku = order.sku
      const spu = order.spu || sku
      const key = `${shop}-${spu}`
      const skuInfo = maps.skuInfoMap.get(`${shop}-${sku}`)

      if (!map.has(key)) {
        map.set(key, {
          spu, shop,
          lifecycle: skuInfo?.lifecycle || '',
          productLevel: skuInfo?.productLevel || '',
          salesGrade: '',
          operator: skuInfo?.operator || '未知',
          operatorGroup: skuInfo?.operatorGroup || '默认组',
          totalSales: 0, totalCost: 0, totalQuantity: 0, orderCount: 0,
          totalCommission: 0, totalAdSpend: 0, totalRefund: 0,
          totalFreight: 0, totalStorage: 0, totalDsp: 0, totalReturnFreight: 0,
          costRate: 0, commissionRate: 0, adSpendRate: 0, refundRate: 0,
          freightRate: 0, storageRate_field: 0, dspRate_field: 0, returnFreightRate_field: 0,
          grossProfit: 0, grossMarginRate: 0, isOnTarget: false, targetMarginRate: 0,
        })
      }

      const item = map.get(key)!
      item.totalSales += order.sales || 0
      item.totalCost += order.cost || 0
      item.totalQuantity += order.quantity || 0
      item.orderCount += 1
      item.totalCommission += order.commission || 0

      // 匹配运费
      const freightType = WAREHOUSE_FREIGHT_TYPE[order.warehouse] || 'cg'
      const skuFreight = maps.skuFreightMap.get(sku)
      if (skuFreight) {
        const freight = freightType === 'cg' ? skuFreight.cgFreight
          : freightType === 'pl' ? skuFreight.plFreight
          : skuFreight.selfFreight
        item.totalFreight += freight * (order.quantity || 1)
      }
    })

    // 广告费汇总（按日期筛选）
    const adSpendMap = new Map<string, number>()
    adData
      .filter(ad => dateMatchesFilter(toDateString(ad.date), dateFilter))
      .forEach(ad => {
        const key = `${ad.shop}-${ad.spu}`
        adSpendMap.set(key, (adSpendMap.get(key) || 0) + (ad.adSpend || 0))
      })

    // 计算毛利
    map.forEach(item => {
      const key = `${item.shop}-${item.spu}`
      const shopRate = maps.shopRateMap.get(item.shop)
      const skuRefund = maps.skuRefundMap.get(`${item.shop}-${item.spu}`)
      const refundRate = skuRefund?.refundRate
        || skuRefundRates.find(r => r.shop === item.shop)?.refundRate
        || 0

      item.totalAdSpend = adSpendMap.get(key) || 0
      item.totalRefund = item.totalSales * (refundRate / 100)
      item.totalStorage = item.totalSales * ((shopRate?.storageRate || 0) / 100)
      item.totalDsp = item.totalSales * ((shopRate?.dspRate || 0) / 100)
      item.totalReturnFreight = item.totalSales * ((shopRate?.refundFreightRate || 0) / 100)

      item.grossProfit = item.totalSales - item.totalCost - item.totalCommission
        - item.totalAdSpend - item.totalRefund - item.totalFreight
        - item.totalStorage - item.totalDsp - item.totalReturnFreight
      item.grossMarginRate = item.totalSales > 0 ? item.grossProfit / item.totalSales : 0
      item.isOnTarget = item.grossMarginRate >= 0.15
    })

    return Array.from(map.values()).sort((a, b) => b.totalSales - a.totalSales)
  }, [filteredOrders, adData, maps, shopRates, skuRefundRates, dateFilter])

  // ---- 筛选器联动过滤 ----
  const displayData = useMemo(() => {
    return spuData.filter(item => {
      if (filterShops.length > 0 && !filterShops.includes(item.shop)) return false
      if (filterGroups.length > 0 && !filterGroups.includes(item.operatorGroup)) return false
      if (filterOperators.length > 0 && !filterOperators.includes(item.operator)) return false
      if (filterCategories.length > 0) {
        // 从 skuBaseInfo 中查找该 SPU 的品类
        // 取该 SPU 对应的任意一条 SKU 的品类
        const skuInfo = skuBaseInfo.find(s => s.spu === item.spu && s.shop === item.shop)
        const category = (skuInfo as any)?.category || ''
        if (!filterCategories.includes(category)) return false
      }
      return true
    })
  }, [spuData, filterShops, filterGroups, filterOperators, filterCategories, skuBaseInfo])

  const handleRowClick = (spu: SpuSummary) => {
    setSelectedSpu(spu)
    setDrawerOpen(true)
  }

  if (spuData.length === 0 && filteredOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-gray-500 text-lg">暂无SPU数据</div>
        <div className="text-gray-400">请先导入订单数据</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{displayData.length}</div>
            <div className="text-sm text-gray-500">SPU数量</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {formatCurrency(displayData.reduce((s, d) => s + d.totalSales, 0))}
            </div>
            <div className="text-sm text-gray-500">总销售额</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(displayData.reduce((s, d) => s + d.grossProfit, 0))}
            </div>
            <div className="text-sm text-gray-500">总毛利</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {((displayData.reduce((s, d) => s + d.grossProfit, 0) /
                Math.max(displayData.reduce((s, d) => s + d.totalSales, 0), 1)) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500">平均毛利率</div>
          </CardContent>
        </Card>
      </div>

      {/* SPU 表格（含标3筛选器） */}
      <SpuTable
        data={displayData}
        onRowClick={handleRowClick}
        filterOptions={filterOptions}
        filterShops={filterShops}
        filterGroups={filterGroups}
        filterOperators={filterOperators}
        filterCategories={filterCategories}
        onFilterShopsChange={setFilterShops}
        onFilterGroupsChange={setFilterGroups}
        onFilterOperatorsChange={setFilterOperators}
        onFilterCategoriesChange={setFilterCategories}
      />

      {/* SPU 详情抽屉 */}
      <SpuDetailDrawer
        spu={selectedSpu}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        orders={filteredOrders}
        adData={adData.filter(ad => dateMatchesFilter(toDateString(ad.date), dateFilter))}
        shopRateMap={maps.shopRateMap as any}
        skuFreightMap={maps.skuFreightMap as any}
        skuRefundMap={maps.skuRefundMap as any}
        dateFilter={dateFilter}
      />
    </div>
  )
}
