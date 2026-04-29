import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface KPICardProps {
  title: string
  current: number
  target?: number
  unit?: 'currency' | 'percent' | 'number'
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: number
  progress?: number // 0-100
  status?: 'success' | 'warning' | 'danger'
  className?: string
}

export function KPICard({
  title,
  current,
  target,
  unit = 'currency',
  icon,
  trend,
  trendValue,
  progress,
  status,
  className
}: KPICardProps) {
  
  const formatValue = (value: number) => {
    switch (unit) {
      case 'currency':
        return formatCurrency(value)
      case 'percent':
        return formatPercent(value)
      case 'number':
      default:
        return value.toLocaleString()
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'danger':
        return 'text-red-600'
      default:
        return 'text-gray-900'
    }
  }

  const getProgressColor = () => {
    if (!progress) return ''
    if (progress >= 100) return 'bg-green-500'
    if (progress >= 70) return 'bg-blue-500'
    if (progress >= 40) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4" />
      case 'down':
        return <TrendingDown className="w-4 h-4" />
      default:
        return <Minus className="w-4 h-4" />
    }
  }

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600 bg-green-50'
      case 'down':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <Card className={cn("p-4 hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">{title}</p>
          <p className={cn("text-2xl font-bold", getStatusColor())}>
            {formatValue(current)}
          </p>
          {target && (
            <p className="text-xs text-gray-400">
              目标: {formatValue(target)}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            {icon}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {progress !== undefined && (
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">达成率</span>
            <span className={cn(
              "font-medium",
              progress >= 100 ? 'text-green-600' : 
              progress >= 70 ? 'text-blue-600' : 
              progress >= 40 ? 'text-yellow-600' : 'text-red-600'
            )}>
              {progress.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={Math.min(progress, 100)} 
            className="h-2"
            indicatorClassName={getProgressColor()}
          />
        </div>
      )}

      {/* Trend */}
      {trend && trendValue !== undefined && (
        <div className={cn(
          "mt-3 flex items-center gap-1 text-xs px-2 py-1 rounded-full w-fit",
          getTrendColor()
        )}>
          {getTrendIcon()}
          <span>{trendValue > 0 ? '+' : ''}{trendValue.toFixed(1)}%</span>
        </div>
      )}
    </Card>
  )
}

// 双值KPI卡片（用于显示当前值和子标题值）
interface DualValueItem {
  label: string
  value: number
  isPercent?: boolean
}

interface DualKPICardProps {
  title: string
  primary: DualValueItem
  secondary: DualValueItem
  icon?: React.ReactNode
  status?: 'success' | 'warning' | 'danger'
  className?: string
}

export function DualKPICard({
  title,
  primary,
  secondary,
  icon,
  status,
  className
}: DualKPICardProps) {
  
  const formatValue = (v: number, isPercent?: boolean) => {
    if (isPercent) {
      return `${v.toFixed(2)}%`
    }
    return formatCurrency(v)
  }

  const getStatusColor = (v?: 'success' | 'warning' | 'danger') => {
    switch (v) {
      case 'success':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'danger':
        return 'text-red-600'
      default:
        return 'text-gray-900'
    }
  }

  return (
    <Card className={cn("p-4 hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <div className="mt-2 space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-gray-900">
                {formatValue(primary.value, primary.isPercent)}
              </span>
              <span className="text-sm text-gray-400">{primary.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-lg font-semibold", getStatusColor(status))}>
                {formatValue(secondary.value, secondary.isPercent)}
              </span>
              <span className="text-sm text-gray-400">{secondary.label}</span>
            </div>
          </div>
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
