import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDataStore, useFilterStore, useSystemStore } from '@/store'
import { formatCurrency, toDateString } from '@/lib/utils'
import dayjs from 'dayjs'

export function DailyAnalysisPage() {
  const { orders, adData } = useDataStore()
  const { filters } = useFilterStore()
  const { shopRates, skuRefundRates, skuBaseInfo } = useSystemStore()
  const { month } = filters

  const today = dayjs().format('YYYY-MM-DD')

  // 当月订单
  const monthOrders = useMemo(() => 
    orders.filter(o => toDateString(o.date).startsWith(month)), 
    [orders, month]
  )

  // 预创建Map
  const maps = useMemo(() => {
    const shopRateMap = new Map<string, typeof shopRates[0]>()
    shopRates.forEach(r => shopRateMap.set(r.shop, r))
    
    const skuRefundMap = new Map<string, typeof skuRefundRates[0]>()
    skuRefundRates.forEach(r => skuRefundMap.set(`${r.shop}-${r.sku}`, r))
    
    const skuInfoMap = new Map<string, typeof skuBaseInfo[0]>()
    skuBaseInfo.forEach(i => skuInfoMap.set(`${i.shop}-${i.sku}`, i))
    
    return { shopRateMap, skuRefundMap, skuInfoMap }
  }, [shopRates, skuRefundRates, skuBaseInfo])

  // 计算汇总
  const summary = useMemo(() => {
    let totalSales = 0, totalCost = 0, totalCommission = 0, totalRefund = 0
    
    monthOrders.forEach(order => {
      totalSales += order.sales || 0
      totalCost += order.cost || 0
      totalCommission += order.commission || 0
      
      const refundRate = maps.skuRefundMap.get(`${order.shop}-${order.sku}`)?.refundRate || 0
      totalRefund += (order.sales || 0) * (refundRate / 100)
    })
    
    const grossProfit = totalSales - totalCost - totalCommission - totalRefund
    
    return {
      totalSales,
      totalCost,
      totalCommission,
      totalRefund,
      grossProfit,
      marginRate: totalSales > 0 ? grossProfit / totalSales : 0,
      orderCount: monthOrders.length,
    }
  }, [monthOrders, maps])

  // 未达标SPU
  const unTargetSpus = useMemo(() => {
    const map = new Map<string, { 
      spu: string, 
      shop: string, 
      operator: string,
      sales: number, 
      cost: number,
      commission: number,
      grossProfit: number 
    }>()
    
    monthOrders.forEach(order => {
      const key = `${order.shop}-${order.spu}`
      const skuInfo = maps.skuInfoMap.get(`${order.shop}-${order.sku}`)
      if (!map.has(key)) {
        map.set(key, {
          spu: order.spu,
          shop: order.shop,
          operator: skuInfo?.operator || '未知',
          sales: 0,
          cost: 0,
          commission: 0,
          grossProfit: 0
        })
      }
      const item = map.get(key)!
      item.sales += order.sales || 0
      item.cost += order.cost || 0
      item.commission += order.commission || 0
    })
    
    // 计算毛利
    map.forEach(item => {
      const refundRate = maps.skuRefundMap.get(`${item.shop}-${item.spu}`)?.refundRate || 0
      const shopRate = maps.shopRateMap.get(item.shop)
      
      const refund = item.sales * (refundRate / 100)
      const storage = item.sales * ((shopRate?.storageRate || 0) / 100)
      const dsp = item.sales * ((shopRate?.dspRate || 0) / 100)
      const returnFreight = item.sales * ((shopRate?.refundFreightRate || 0) / 100)
      
      // 估算广告费（按销售额比例均摊，这里简化处理）
      const adSpend = 0 // 需要按实际广告数据计算
      
      item.grossProfit = item.sales - item.cost - item.commission - refund - storage - dsp - returnFreight - adSpend
    })
    
    return Array.from(map.values())
      .filter(s => s.sales > 0 && s.grossProfit / s.sales < 0.15)
      .sort((a, b) => (a.grossProfit / a.sales) - (b.grossProfit / b.sales))
      .slice(0, 10)
  }, [monthOrders, maps])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-50">
          <CardContent className="pt-4">
            <div className="text-xs text-gray-500 mb-1">今日日期</div>
            <div className="text-lg font-bold text-gray-900">{today}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-gray-500 mb-1">当月销售额</div>
            <div className="text-lg font-bold text-blue-600">{formatCurrency(summary.totalSales)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-gray-500 mb-1">三级毛利</div>
            <div className="text-lg font-bold text-green-600">{formatCurrency(summary.grossProfit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-gray-500 mb-1">毛利率</div>
            <div className={`text-lg font-bold ${summary.marginRate >= 0.15 ? 'text-green-600' : 'text-red-600'}`}>
              {(summary.marginRate * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">成本结构</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="text-sm text-gray-500">成本</div>
              <div className="text-lg font-bold text-red-600">{formatCurrency(summary.totalCost)}</div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="text-sm text-gray-500">佣金</div>
              <div className="text-lg font-bold text-orange-600">{formatCurrency(summary.totalCommission)}</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-500">退款</div>
              <div className="text-lg font-bold text-blue-600">{formatCurrency(summary.totalRefund)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">订单数</div>
              <div className="text-lg font-bold">{summary.orderCount}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {unTargetSpus.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="destructive">预警</Badge>
              毛利率低于15%的SPU
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unTargetSpus.map((spu, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                  <div>
                    <div className="font-medium text-sm">{spu.spu}</div>
                    <div className="text-xs text-gray-400">{spu.shop} · {spu.operator}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-sm">{formatCurrency(spu.sales)}</div>
                    <div className="text-xs text-red-500">
                      毛利: {formatCurrency(spu.grossProfit)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {unTargetSpus.length === 0 && monthOrders.length > 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <div className="text-green-600 font-medium mb-1">✓ 所有SPU毛利率达标</div>
            <div className="text-sm text-gray-400">暂无预警信息</div>
          </CardContent>
        </Card>
      )}

      {monthOrders.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <div className="text-gray-500 font-medium mb-1">暂无数据</div>
            <div className="text-sm text-gray-400">请先导入当月订单数据</div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
