import React, { useMemo, useCallback, useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Percent, MousePointerClick } from 'lucide-react'
import { KPICard, DualKPICard } from '@/components/data/KPICard'
import { LineChart, MultiLineChart, PieChart } from '@/components/charts'
import { formatCurrency } from '@/lib/utils'
import { DashboardFilter } from '@/components/filters/DashboardFilter'
import { getDashboardSummary, getShopOptions, DashboardSummaryItem } from '@/services/backendApi'
import dayjs from 'dayjs'

interface DashboardPageProps {
  onHeaderSlotChange?: (slot: React.ReactNode) => void
}

export function DashboardPage({ onHeaderSlotChange }: DashboardPageProps) {
  // ========== 数据状态 ==========
  const [dashboardData, setDashboardData] = useState<DashboardSummaryItem[]>([])
  const [filterOptions, setFilterOptions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ========== 筛选状态（自管理）==========
  const [filterMonths, setFilterMonths] = useState<string[]>([dayjs().format('YYYY-MM')])
  const [filterShops, setFilterShops] = useState<string[]>([])

  // ========== 加载数据 ==========
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // 获取筛选选项
      const shops = await getShopOptions()
      setFilterOptions(shops)

      // 计算日期范围（当前选中月份）
      const month = filterMonths[0] || dayjs().format('YYYY-MM')
      const startDate = dayjs(month).startOf('month').format('YYYY-MM-DD')
      const endDate = dayjs(month).endOf('month').format('YYYY-MM-DD')

      // 从后端获取汇总数据
      const data = await getDashboardSummary({
        startDate,
        endDate,
        shop: filterShops.length > 0 ? filterShops[0] : undefined,
      })
      setDashboardData(data)
    } catch (e: any) {
      console.error('Failed to load dashboard data:', e)
      setError(e.message || '加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }, [filterMonths, filterShops])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 暴露插槽到 Header
  const handleFilterChange = useCallback((months: string[], shops: string[]) => {
    setFilterMonths(months)
    setFilterShops(shops)
    if (onHeaderSlotChange) {
      onHeaderSlotChange(
        <DashboardFilter
          shops={filterOptions}
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

  // ========== KPI 计算（从后端数据）==========
  const kpis = useMemo(() => {
    const totalSales = dashboardData.reduce((sum, d) => sum + d.totalSales, 0)
    const totalGrossProfit = dashboardData.reduce((sum, d) => sum + d.totalGrossProfit, 0)
    const totalAdSpend = dashboardData.reduce((sum, d) => sum + d.totalAdSpend, 0)
    const avgMargin = totalSales > 0 ? totalGrossProfit / totalSales : 0
    const avgAcos = totalSales > 0 ? totalAdSpend / totalSales : 0
    const avgRoas = totalAdSpend > 0 ? totalSales / totalAdSpend : 0

    return { totalSales, totalGrossProfit, totalAdSpend, avgMargin, avgAcos, avgRoas }
  }, [dashboardData])

  // 图表数据
  const chartData = useMemo(() => {
    const byDate = new Map<string, { sales: number; grossProfit: number; adSpend: number }>()
    dashboardData.forEach(d => {
      const existing = byDate.get(d.date) || { sales: 0, grossProfit: 0, adSpend: 0 }
      byDate.set(d.date, {
        sales: existing.sales + d.totalSales,
        grossProfit: existing.grossProfit + d.totalGrossProfit,
        adSpend: existing.adSpend + d.totalAdSpend,
      })
    })
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, values]) => ({ date, ...values }))
  }, [dashboardData])

  // 店铺分布
  const shopDistribution = useMemo(() => {
    const dist = new Map<string, number>()
    dashboardData.forEach(d => {
      dist.set(d.shop, (dist.get(d.shop) || 0) + d.totalSales)
    })
    return Array.from(dist.entries()).map(([name, value]) => ({ name, value }))
  }, [dashboardData])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <p className="font-medium">加载失败</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="总销售额 (USD)"
          current={kpis.totalSales}
          unit="currency"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <KPICard
          title="三级毛利额 (USD)"
          current={kpis.totalGrossProfit}
          unit="currency"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <DualKPICard
          title="毛利率 / ACoS"
          primary={{ label: '毛利率', value: kpis.avgMargin * 100, isPercent: true }}
          secondary={{ label: 'ACoS', value: kpis.avgAcos * 100, isPercent: true }}
          icon={<Percent className="w-5 h-5" />}
        />
        <KPICard
          title="广告费 ROAS"
          current={kpis.avgRoas}
          unit="number"
          icon={<MousePointerClick className="w-5 h-5" />}
        />
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 销售与毛利趋势 */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-4">销售与毛利趋势</h3>
          <MultiLineChart
            series={[
              { data: chartData.map(d => ({ name: d.date, value: d.sales })), name: '销售额', color: '#3b82f6' },
              { data: chartData.map(d => ({ name: d.date, value: d.grossProfit })), name: '毛利额', color: '#10b981' },
            ]}
          />
        </div>

        {/* 广告费趋势 */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-4">广告费趋势</h3>
          <LineChart 
            data={chartData.map(d => ({ name: d.date, value: d.adSpend }))} 
          />
        </div>

        {/* 店铺销售分布 */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-4">店铺销售分布</h3>
          <PieChart data={shopDistribution} />
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="font-semibold">每日数据明细</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">日期</th>
                <th className="px-4 py-2 text-left">店铺</th>
                <th className="px-4 py-2 text-right">销售额</th>
                <th className="px-4 py-2 text-right">毛利额</th>
                <th className="px-4 py-2 text-right">毛利率</th>
                <th className="px-4 py-2 text-right">广告费</th>
                <th className="px-4 py-2 text-right">ACoS</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{row.date}</td>
                  <td className="px-4 py-2">{row.shop}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(row.totalSales)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(row.totalGrossProfit)}</td>
                  <td className="px-4 py-2 text-right">
                    {row.grossMarginRate > 0 ? `${(row.grossMarginRate * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">{formatCurrency(row.totalAdSpend)}</td>
                  <td className="px-4 py-2 text-right">
                    {row.acos > 0 ? `${(row.acos * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {dashboardData.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            暂无数据，请先导入订单和广告数据
          </div>
        )}
      </div>
    </div>
  )
}
