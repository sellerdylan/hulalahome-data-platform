import React, { useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, toDateString } from '@/lib/utils'
import dayjs from 'dayjs'
import weekOfYear from 'dayjs/plugin/weekOfYear'

dayjs.extend(weekOfYear)
import type { SpuSummary, Order, AdData } from '@/types'
import { WAREHOUSE_FREIGHT_TYPE } from '@/types'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts'
import type { SpuDateFilterValue } from '@/components/filters/SpuDateFilter'

interface SpuDetailDrawerProps {
  spu: SpuSummary | null
  open: boolean
  onClose: () => void
  orders: Order[]
  adData: AdData[]
  shopRateMap: Map<string, { storageRate: number; dspRate: number; refundFreightRate: number; refundRate?: number }>
  skuFreightMap: Map<string, { cgFreight: number; plFreight: number; selfFreight: number }>
  skuRefundMap: Map<string, { refundRate: number }>
  // 日期筛选器，用于与表格保持口径一致
  dateFilter: SpuDateFilterValue
}

interface DailyMetric {
  date: string
  sales: number
  grossProfit: number
  marginRate: number
  adSpend: number
  orderCount: number
  cost: number
  commission: number
  freight: number
  refund: number
  storage: number
  dsp: number
  returnFreight: number
}

const MetricCard = ({
  label,
  value,
  sub,
  color = 'text-gray-900',
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) => (
  <div className="bg-gray-50 rounded-lg p-3">
    <div className="text-xs text-gray-500 mb-1">{label}</div>
    <div className={`text-base font-bold font-mono ${color}`}>{value}</div>
    {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
  </div>
)

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-medium text-gray-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span style={{ color: p.color }}>●</span>
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-mono font-medium">
            {p.dataKey === 'marginRate'
              ? `${(p.value * 100).toFixed(1)}%`
              : `$${p.value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          </span>
        </div>
      ))}
    </div>
  )
}

// 判断日期是否在筛选范围内（与 SpuDetailPage 复用相同逻辑）
function dateMatchesFilter(dateStr: string, filter: SpuDateFilterValue): boolean {
  if (filter.mode === 'months') {
    if (filter.selectedMonths.length === 0) return true
    return filter.selectedMonths.some(m => dateStr.startsWith(m))
  } else {
    const { startDate, endDate } = filter
    if (!startDate && !endDate) return true
    if (startDate && dateStr < startDate) return false
    if (endDate && dateStr > endDate) return false
    return true
  }
}

export function SpuDetailDrawer({
  spu,
  open,
  onClose,
  orders,
  adData,
  shopRateMap,
  skuFreightMap,
  skuRefundMap,
  dateFilter,
}: SpuDetailDrawerProps) {
  // 计算每日趋势数据（仅包含日期筛选范围内的数据，与表格口径一致）
  const dailyData = useMemo((): DailyMetric[] => {
    if (!spu) return []

    // 过滤该 SPU 的订单，并应用日期筛选
    const spuOrders = orders.filter(
      (o) => o.spu === spu.spu && o.shop === spu.shop
        && dateMatchesFilter(toDateString(o.date), dateFilter)
    )

    // 过滤该 SPU 的广告数据，并应用日期筛选
    const spuAds = adData.filter(
      (a) => a.spu === spu.spu && a.shop === spu.shop
        && dateMatchesFilter(toDateString(a.date), dateFilter)
    )

    // 按日期汇总订单
    const dayMap = new Map<string, DailyMetric>()

    spuOrders.forEach((order) => {
      const date = toDateString(order.date)
      if (!dayMap.has(date)) {
        dayMap.set(date, {
          date,
          sales: 0,
          grossProfit: 0,
          marginRate: 0,
          adSpend: 0,
          orderCount: 0,
          cost: 0,
          commission: 0,
          freight: 0,
          refund: 0,
          storage: 0,
          dsp: 0,
          returnFreight: 0,
        })
      }
      const day = dayMap.get(date)!
      day.sales += order.sales || 0
      day.cost += order.cost || 0
      day.commission += order.commission || 0
      day.orderCount += 1

      // 运费
      const freightType = WAREHOUSE_FREIGHT_TYPE[order.warehouse] || 'cg'
      const skuFreight = skuFreightMap.get(order.sku)
      if (skuFreight) {
        const freight =
          freightType === 'cg'
            ? skuFreight.cgFreight
            : freightType === 'pl'
            ? skuFreight.plFreight
            : skuFreight.selfFreight
        day.freight += freight * (order.quantity || 1)
      }
    })

    // 叠加广告费
    spuAds.forEach((ad) => {
      const date = toDateString(ad.date)
      if (!dayMap.has(date)) {
        dayMap.set(date, {
          date,
          sales: 0,
          grossProfit: 0,
          marginRate: 0,
          adSpend: 0,
          orderCount: 0,
          cost: 0,
          commission: 0,
          freight: 0,
          refund: 0,
          storage: 0,
          dsp: 0,
          returnFreight: 0,
        })
      }
      dayMap.get(date)!.adSpend += ad.adSpend || 0
    })

    // 计算各费用和毛利
    const shopRate = shopRateMap.get(spu.shop)

    dayMap.forEach((day) => {
      // 退款率：每日退款 = 该日该SPU下各SKU销售额 × 对应退款率
      // 遍历当日所有订单，按 SKU 查退款率后加权
      let totalRefundRate = 0
      let totalDaySales = day.sales
      if (totalDaySales > 0) {
        const dayOrders = spuOrders.filter(o => toDateString(o.date) === day.date)
        dayOrders.forEach(o => {
          const rk = `${o.shop}-${o.sku}`
          const skuRef = skuRefundMap.get(rk)
          const rate = skuRef?.refundRate ?? 0
          totalRefundRate += (o.sales || 0) * (rate / 100)
        })
        day.refund = totalRefundRate
      }
      day.storage = day.sales * ((shopRate?.storageRate || 0) / 100)
      day.dsp = day.sales * ((shopRate?.dspRate || 0) / 100)
      day.returnFreight =
        day.sales * ((shopRate?.refundFreightRate || 0) / 100)

      day.grossProfit =
        day.sales -
        day.cost -
        day.commission -
        day.adSpend -
        day.refund -
        day.freight -
        day.storage -
        day.dsp -
        day.returnFreight

      day.marginRate = day.sales > 0 ? day.grossProfit / day.sales : 0
    })

    return Array.from(dayMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    )
  }, [spu, orders, adData, shopRateMap, skuFreightMap, skuRefundMap, dateFilter])

  // 汇总统计（用于详情卡片）
  const totals = useMemo(() => {
    return dailyData.reduce(
      (acc, d) => ({
        sales: acc.sales + d.sales,
        grossProfit: acc.grossProfit + d.grossProfit,
        adSpend: acc.adSpend + d.adSpend,
        orderCount: acc.orderCount + d.orderCount,
        cost: acc.cost + d.cost,
        commission: acc.commission + d.commission,
        freight: acc.freight + d.freight,
        refund: acc.refund + d.refund,
        storage: acc.storage + d.storage,
        dsp: acc.dsp + d.dsp,
        returnFreight: acc.returnFreight + d.returnFreight,
      }),
      {
        sales: 0,
        grossProfit: 0,
        adSpend: 0,
        orderCount: 0,
        cost: 0,
        commission: 0,
        freight: 0,
        refund: 0,
        storage: 0,
        dsp: 0,
        returnFreight: 0,
      }
    )
  }, [dailyData])

  // 每周数据汇总（带环比）
  const weeklyData = useMemo(() => {
    if (dailyData.length === 0) return []

    // 按周分组
    const weekMap = new Map<string, {
      weekLabel: string
      weekStart: string
      sales: number
      grossProfit: number
      marginRate: number
      adSpend: number
      orderCount: number
      cost: number
      commission: number
      freight: number
      refund: number
      storage: number
      dsp: number
      returnFreight: number
    }>()

    dailyData.forEach(day => {
      const d = dayjs(day.date)
      const weekNum = d.week()
      const year = d.year()
      const weekKey = `${year}-W${weekNum}`
      const weekStart = d.startOf('week').format('YYYY-MM-DD')

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          weekLabel: `${d.startOf('week').format('MM/DD')}-${d.endOf('week').format('MM/DD')}`,
          weekStart,
          sales: 0,
          grossProfit: 0,
          marginRate: 0,
          adSpend: 0,
          orderCount: 0,
          cost: 0,
          commission: 0,
          freight: 0,
          refund: 0,
          storage: 0,
          dsp: 0,
          returnFreight: 0,
        })
      }

      const week = weekMap.get(weekKey)!
      week.sales += day.sales
      week.grossProfit += day.grossProfit
      week.adSpend += day.adSpend
      week.orderCount += day.orderCount
      week.cost += day.cost
      week.commission += day.commission
      week.freight += day.freight
      week.refund += day.refund
      week.storage += day.storage
      week.dsp += day.dsp
      week.returnFreight += day.returnFreight
    })

    // 计算毛利率和环比
    const sortedWeeks = Array.from(weekMap.values())
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    // 先算毛利率
    sortedWeeks.forEach(w => {
      w.marginRate = w.sales > 0 ? w.grossProfit / w.sales : 0
    })
    // 再计算环比
    const weeks = sortedWeeks.map((week, idx) => {
      const prevWeek = idx > 0 ? sortedWeeks[idx - 1] : null
      let salesChange = null
      let profitChange = null
      let marginChange = null

      if (prevWeek) {
        salesChange = prevWeek.sales > 0 ? ((week.sales - prevWeek.sales) / prevWeek.sales) * 100 : null
        profitChange = prevWeek.grossProfit > 0 ? ((week.grossProfit - prevWeek.grossProfit) / Math.abs(prevWeek.grossProfit)) * 100 : null
        marginChange = (week.marginRate - prevWeek.marginRate) * 100
      }

      return {
        ...week,
        salesChange,
        profitChange,
        marginChange,
        isCurrentWeek: idx === sortedWeeks.length - 1,
      }
    })

    return weeks
  }, [dailyData])

  const marginRate =
    totals.sales > 0 ? totals.grossProfit / totals.sales : 0

  if (!spu) return null

  const formatDateShort = (d: string) => {
    // 取 MM/DD
    const parts = d.split('-')
    return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl overflow-y-auto p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b bg-gray-50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-lg font-bold">{spu.spu}</SheetTitle>
            <Badge
              variant={spu.isOnTarget ? 'success' : 'danger'}
              className="text-xs"
            >
              {spu.isOnTarget ? '达标' : '未达标'}
            </Badge>
            {spu.salesGrade && (
              <Badge variant="outline" className="text-xs">
                {spu.salesGrade} 级
              </Badge>
            )}
          </div>
          <div className="text-sm text-gray-500 flex gap-4 mt-1">
            <span>店铺：{spu.shop}</span>
            <span>运营：{spu.operator}</span>
            <span>运营组：{spu.operatorGroup}</span>
          </div>
        </SheetHeader>

        <div className="px-6 py-4 space-y-6">
          {/* 核心指标卡片 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">核心指标</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                label="销售额"
                value={formatCurrency(totals.sales)}
                color="text-blue-700"
              />
              <MetricCard
                label="三级毛利额"
                value={formatCurrency(totals.grossProfit)}
                color={totals.grossProfit >= 0 ? 'text-green-700' : 'text-red-600'}
              />
              <MetricCard
                label="毛利率"
                value={`${(marginRate * 100).toFixed(2)}%`}
                color={
                  marginRate >= 0.2
                    ? 'text-green-700'
                    : marginRate >= 0.15
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }
              />
              <MetricCard
                label="订单数"
                value={String(totals.orderCount)}
              />
            </div>
          </div>

          {/* 每日毛利趋势图 */}
          {dailyData.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                每日三级毛利趋势
              </h3>
              <div className="bg-white border rounded-lg p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={dailyData}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateShort}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      iconSize={10}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="sales"
                      name="销售额"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="grossProfit"
                      name="三级毛利额"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="marginRate"
                      name="毛利率"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 广告费趋势 */}
          {dailyData.some((d) => d.adSpend > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                每日销售额 vs 广告费
              </h3>
              <div className="bg-white border rounded-lg p-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={dailyData}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateShort}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      iconSize={10}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    <Bar dataKey="sales" name="销售额" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="adSpend" name="广告费" fill="#a855f7" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 成本结构明细 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">成本结构明细</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                label="成本"
                value={formatCurrency(totals.cost)}
                sub={`${(totals.cost / Math.max(totals.sales, 1) * 100).toFixed(1)}%`}
                color="text-red-600"
              />
              <MetricCard
                label="佣金"
                value={formatCurrency(totals.commission)}
                sub={`${(totals.commission / Math.max(totals.sales, 1) * 100).toFixed(1)}%`}
                color="text-orange-600"
              />
              <MetricCard
                label="广告费"
                value={formatCurrency(totals.adSpend)}
                sub={`${(totals.adSpend / Math.max(totals.sales, 1) * 100).toFixed(1)}%`}
                color="text-purple-600"
              />
              <MetricCard
                label="退款费"
                value={formatCurrency(totals.refund)}
                sub={`${(totals.refund / Math.max(totals.sales, 1) * 100).toFixed(1)}%`}
                color="text-yellow-600"
              />
              <MetricCard
                label="运费"
                value={formatCurrency(totals.freight)}
                sub={`${(totals.freight / Math.max(totals.sales, 1) * 100).toFixed(1)}%`}
                color="text-cyan-600"
              />
              <MetricCard
                label="仓储费"
                value={formatCurrency(totals.storage)}
                sub={`${(totals.storage / Math.max(totals.sales, 1) * 100).toFixed(1)}%`}
                color="text-indigo-600"
              />
              <MetricCard
                label="DSP费"
                value={formatCurrency(totals.dsp)}
                sub={`${(totals.dsp / Math.max(totals.sales, 1) * 100).toFixed(1)}%`}
                color="text-pink-600"
              />
              <MetricCard
                label="退货运费"
                value={formatCurrency(totals.returnFreight)}
                sub={`${(totals.returnFreight / Math.max(totals.sales, 1) * 100).toFixed(1)}%`}
                color="text-amber-600"
              />
            </div>
          </div>

          {/* 每日明细表格 */}
          {dailyData.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                每日数据明细
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-3 py-2 font-medium text-gray-600">日期</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">销售额</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">广告费</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">三级毛利</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">毛利率</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">订单数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyData.map((day, idx) => (
                        <tr
                          key={day.date}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                        >
                          <td className="px-3 py-1.5 text-gray-700">{day.date}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-blue-700">
                            {formatCurrency(day.sales)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-purple-600">
                            {formatCurrency(day.adSpend)}
                          </td>
                          <td className={`px-3 py-1.5 text-right font-mono font-medium ${
                            day.grossProfit >= 0 ? 'text-green-700' : 'text-red-600'
                          }`}>
                            {formatCurrency(day.grossProfit)}
                          </td>
                          <td className={`px-3 py-1.5 text-right font-mono font-medium ${
                            day.marginRate >= 0.2 ? 'text-green-700' :
                            day.marginRate >= 0.15 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {(day.marginRate * 100).toFixed(1)}%
                          </td>
                          <td className="px-3 py-1.5 text-right text-gray-600">
                            {day.orderCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 border-t font-medium">
                        <td className="px-3 py-2 text-gray-700">合计</td>
                        <td className="px-3 py-2 text-right font-mono text-blue-700">
                          {formatCurrency(totals.sales)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-purple-600">
                          {formatCurrency(totals.adSpend)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono font-medium ${
                          totals.grossProfit >= 0 ? 'text-green-700' : 'text-red-600'
                        }`}>
                          {formatCurrency(totals.grossProfit)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono font-medium ${
                          marginRate >= 0.2 ? 'text-green-700' :
                          marginRate >= 0.15 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {(marginRate * 100).toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {totals.orderCount}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 每周数据明细（带环比分析） */}
          {weeklyData.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                每周数据明细
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-3 py-2 font-medium text-gray-600">周期</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">销售额</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">销售额环比</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">广告费</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">三级毛利</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">毛利环比</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">毛利率</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">毛利率环比</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyData.map((week, idx) => (
                        <tr
                          key={week.weekLabel}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                        >
                          <td className="px-3 py-2">
                            <div className="text-gray-700">{week.weekLabel}</div>
                            {week.isCurrentWeek && (
                              <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">本周</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-blue-700">
                            {formatCurrency(week.sales)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {week.salesChange !== null ? (
                              <span className={week.salesChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {week.salesChange >= 0 ? '+' : ''}{week.salesChange.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-purple-600">
                            {formatCurrency(week.adSpend)}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-medium ${
                            week.grossProfit >= 0 ? 'text-green-700' : 'text-red-600'
                          }`}>
                            {formatCurrency(week.grossProfit)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {week.profitChange !== null ? (
                              <span className={week.profitChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {week.profitChange >= 0 ? '+' : ''}{week.profitChange.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-medium ${
                            week.marginRate >= 0.2 ? 'text-green-700' :
                            week.marginRate >= 0.15 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {(week.marginRate * 100).toFixed(1)}%
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {week.marginChange !== null ? (
                              <span className={week.marginChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {week.marginChange >= 0 ? '+' : ''}{week.marginChange.toFixed(2)}pp
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">环比：与上周相比的变化（+表示增长，-表示下降）</p>
            </div>
          )}

          {dailyData.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              暂无该 SPU 的历史数据
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
