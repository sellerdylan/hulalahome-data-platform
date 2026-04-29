import React from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

interface BarChartProps {
  data: {
    name: string
    value: number
  }[]
  title?: string
  horizontal?: boolean
  showValue?: boolean
  formatter?: (value: number) => string
  color?: string
}

// 柱状图组件
export function BarChart({ 
  data, 
  title: _title, 
  horizontal = false, 
  showValue = false,
  formatter = (v) => v.toLocaleString(),
  color = '#3B82F6'
}: BarChartProps) {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = params[0]
        return `${p.name}: ${formatter(p.value)}`
      }
    },
    grid: {
      left: horizontal ? '3%' : 50,
      right: 20,
      bottom: 30,
      top: 10
    },
    xAxis: horizontal ? {
      type: 'value',
      axisLabel: { formatter, fontSize: 11 }
    } : {
      type: 'category',
      data: data.map(d => d.name),
      axisLabel: { rotate: 30, fontSize: 11 }
    },
    yAxis: horizontal ? {
      type: 'category',
      data: data.map(d => d.name),
      axisLabel: { fontSize: 11 }
    } : {
      type: 'value',
      axisLabel: { formatter, fontSize: 11 }
    },
    series: [{
      type: 'bar',
      data: data.map(d => ({
        value: d.value,
        itemStyle: { color }
      })),
      label: showValue ? {
        show: true,
        position: horizontal ? 'right' : 'top',
        formatter: (params: any) => formatter(params.value)
      } : undefined,
      barWidth: '60%',
      itemStyle: {
        borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]
      }
    }],
    animation: true,
    animationDuration: 500
  }

  return <ReactECharts option={option} style={{ height: 300 }} />
}

interface PieChartProps {
  data: {
    name: string
    value: number
  }[]
  title?: string
  colors?: string[]
  height?: number
  tooltipFormatter?: string
}

// 饼图组件
export function PieChart({ data, title: _title, colors, height = 220, tooltipFormatter }: PieChartProps) {
  const defaultColors = ['#FFD700', '#22C55E', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6']
  const chartColors = colors || defaultColors

  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: tooltipFormatter || '{b}: ${c} ({d}%)'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '72%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      label: {
        show: true,
        formatter: (p: any) => `${p.name}\n${p.percent.toFixed(2)}%`,
        fontSize: 10,
        lineHeight: 14,
        overflow: 'truncate',
        width: 90
      },
      labelLine: { show: true, length: 5, length2: 5 },
      data: data.map((d, i) => ({
        name: d.name,
        value: d.value,
        itemStyle: { color: chartColors[i % chartColors.length] }
      }))
    }],
    animation: true,
    animationDuration: 500
  }

  return <ReactECharts option={option} style={{ height }} />
}

interface LineChartProps {
  data: {
    name: string
    value: number
  }[]
  title?: string
  yAxisLabel?: string
  color?: string
  showArea?: boolean
  showValue?: boolean
}

// 折线图组件
export function LineChart({ 
  data, 
  title: _title, 
  yAxisLabel = '',
  color = '#3B82F6',
  showArea = false,
  showValue = false
}: LineChartProps) {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0]
        return `${p.name}: $${Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
    },
    grid: { top: 10, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(d => d.name),
      axisLabel: { fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      name: yAxisLabel,
      axisLabel: {
        fontSize: 11,
        formatter: (value: number) => {
          if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
          if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
          return `$${value.toFixed(0)}`
        }
      }
    },
    series: [{
      type: 'line',
      data: data.map(d => d.value),
      smooth: true,
      lineStyle: { color, width: 2 },
      itemStyle: { color },
      areaStyle: showArea ? {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: color + '40' },
            { offset: 1, color: color + '10' }
          ]
        }
      } : undefined,
      symbol: 'circle',
      symbolSize: 6,
      label: showValue ? {
        show: true,
        position: 'top',
        fontSize: 10,
        formatter: (params: any) => {
          const v = params.value
          if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
          if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
          return `$${v.toFixed(0)}`
        }
      } : undefined
    }],
    animation: true,
    animationDuration: 500
  }

  return <ReactECharts option={option} style={{ height: 300 }} />
}

interface MultiLineChartProps {
  series: {
    name: string
    data: { name: string; value: number }[]
    color: string
    yAxisIndex?: number  // 0=主轴, 1=次轴
    yAxisName?: string
    type?: 'line' | 'bar'  // 图表类型
  }[]
  title?: string
  yAxisLabel?: string
  yAxisLabel2?: string
  xAxisBoundaryGap?: boolean  // x轴是否留白
  horizontal?: boolean  // 横向模式
}

// 多线折线图（支持双轴、混合柱状+折线）
// 当有双轴时会自动分栏显示，彻底避免轴标签截断
export function MultiLineChart({ 
  series, 
  title: _title, 
  yAxisLabel = '',
  yAxisLabel2 = '',
  xAxisBoundaryGap = false,
  horizontal = false
}: MultiLineChartProps) {
  const hasSecondAxis = series.some(s => s.yAxisIndex === 1)

  // 横向模式下，x/y轴交换，标签显示在y轴，避免标签拥挤
  if (horizontal) {
    const names = series[0]?.data.map((d: any) => d.name) || []
    return (
      <div className="w-full">
        <ReactECharts
          style={{ height: Math.max(300, names.length * 40), width: '100%' }}
          option={{
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                let result = `${params[0].name}<br/>`
                params.forEach((p: any) => {
                  const val = Number(p.value)
                  result += `${p.marker} ${p.seriesName}: $${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>`
                })
                return result
              }
            },
            grid: { top: 8, right: 30, bottom: 8, left: 8, containLabel: true },
            xAxis: {
              type: 'value',
              axisLabel: {
                fontSize: 10,
                formatter: (value: number) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
                  return `$${value.toFixed(0)}`
                }
              }
            },
            yAxis: {
              type: 'category',
              data: names,
              axisLabel: { fontSize: 10 },
              inverse: true  // 最重要的在上面
            },
            series: series.map((s: any) => ({
              name: s.name,
              type: s.type || 'bar',
              data: s.data.map((d: any) => d.value),
              smooth: s.type !== 'bar',
              lineStyle: { color: s.color, width: 2 },
              itemStyle: { 
                color: s.color,
                ...(s.type === 'bar' && { borderRadius: [0, 4, 4, 0] })
              },
              symbol: 'circle',
              symbolSize: 4,
              barWidth: '50%',
              label: {
                show: true,
                position: 'right',
                fontSize: 10,
                formatter: (params: any) => {
                  const v = params.value
                  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
                  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
                  return `$${v.toFixed(0)}`
                }
              }
            })),
            animation: true
          }}
        />
      </div>
    )
  }

  // 双轴时拆成左右两个独立图表，彻底解决截断问题
  if (hasSecondAxis) {
    const leftSeries = series.filter(s => s.yAxisIndex !== 1)
    const rightSeries = series.filter(s => s.yAxisIndex === 1)

    return (
      <div className="flex gap-4 w-full">
        {/* 左侧：主指标（柱状图 + 美元格式化） */}
        <div className="flex-1 min-w-0 w-full">
          {yAxisLabel && (
            <div className="text-xs text-gray-500 mb-1 font-medium text-center">{yAxisLabel}</div>
          )}
          <ReactECharts
            style={{ height: 280, width: '100%' }}
            option={{
              tooltip: {
                trigger: 'axis',
                formatter: (params: any) => {
                  let result = `${params[0].name}<br/>`
                  params.forEach((p: any) => {
                    const val = Number(p.value)
                    result += `${p.marker} ${p.seriesName}: $${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>`
                  })
                  return result
                }
              },
              grid: { top: 8, right: 15, bottom: 28, left: 55 },
              xAxis: {
                type: 'category',
                boundaryGap: xAxisBoundaryGap,
                data: leftSeries[0]?.data.map((d: any) => d.name) || [],
                axisLabel: { fontSize: 10 }
              },
              yAxis: {
                type: 'value',
                axisLabel: {
                  fontSize: 10,
                  formatter: (value: number) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
                    return `$${value.toFixed(0)}`
                  }
                }
              },
              series: leftSeries.map((s: any) => ({
                name: s.name,
                type: s.type || 'bar',
                data: s.data.map((d: any) => d.value),
                smooth: s.type !== 'bar',
                lineStyle: { color: s.color, width: 2 },
                itemStyle: { 
                  color: s.color,
                  ...(s.type === 'bar' && { borderRadius: [4, 4, 0, 0] })
                },
                symbol: 'circle',
                symbolSize: 4,
                barWidth: '60%'
              })),
              animation: true
            }}
          />
        </div>

        {/* 右侧：次指标（折线 + 百分比格式化） */}
        <div className="flex-1 min-w-0 w-full">
          {yAxisLabel2 && (
            <div className="text-xs text-gray-500 mb-1 font-medium text-center">{yAxisLabel2}</div>
          )}
          <ReactECharts
            style={{ height: 280, width: '100%' }}
            option={{
              tooltip: {
                trigger: 'axis',
                formatter: (params: any) => {
                  let result = `${params[0].name}<br/>`
                  params.forEach((p: any) => {
                    const val = Number(p.value)
                    result += `${p.marker} ${p.seriesName}: ${val.toFixed(2)}%<br/>`
                  })
                  return result
                }
              },
              grid: { top: 8, right: 15, bottom: 28, left: 55 },
              xAxis: {
                type: 'category',
                boundaryGap: xAxisBoundaryGap,
                data: rightSeries[0]?.data.map((d: any) => d.name) || [],
                axisLabel: { fontSize: 10 }
              },
              yAxis: {
                type: 'value',
                axisLabel: {
                  fontSize: 10,
                  formatter: (value: number) => `${value.toFixed(0)}%`
                },
                min: 0
              },
              series: rightSeries.map((s: any) => ({
                name: s.name,
                type: 'line',
                data: s.data.map((d: any) => d.value),
                smooth: true,
                lineStyle: { color: s.color, width: 2 },
                itemStyle: { color: s.color },
                symbol: 'circle',
                symbolSize: 4
              })),
              animation: true
            }}
          />
        </div>
      </div>
    )
  }

  // 单轴模式：保持原有逻辑
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = `${params[0].name}<br/>`
        params.forEach((p: any) => {
          const val = Number(p.value)
          if (p.seriesName.includes('%') || p.seriesName.includes('率')) {
            result += `${p.marker} ${p.seriesName}: ${val.toFixed(2)}%<br/>`
          } else {
            result += `${p.marker} ${p.seriesName}: $${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>`
          }
        })
        return result
      }
    },
    legend: { bottom: 0 },
    grid: { top: 10, right: 20, bottom: 35, left: 50 },
    xAxis: {
      type: 'category',
      boundaryGap: xAxisBoundaryGap,
      data: series[0]?.data.map(d => d.name) || [],
      axisLabel: { fontSize: 11 }
    },
    yAxis: [{
      type: 'value',
      axisLabel: {
        fontSize: 11,
        formatter: (value: number) => {
          if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
          if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
          return `$${value.toFixed(0)}`
        }
      }
    }],
    series: series.map(s => ({
      name: s.name,
      type: s.type || 'line' as const,
      data: s.data.map(d => d.value),
      smooth: s.type !== 'bar',
      lineStyle: { color: s.color, width: 2 },
      itemStyle: { 
        color: s.type === 'bar' ? s.color : s.color,
        ...(s.type === 'bar' && { borderRadius: [4, 4, 0, 0] })
      },
      symbol: 'circle',
      symbolSize: 4,
      barWidth: '50%'
    })),
    animation: true,
    animationDuration: 500
  }

  return <ReactECharts option={option} style={{ height: 300 }} />
}
