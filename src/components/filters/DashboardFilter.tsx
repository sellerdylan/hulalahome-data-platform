import React from 'react'
import dayjs from 'dayjs'
import { MultiSelect } from '@/components/ui/multi-select'

interface DashboardFilterProps {
  shops: string[]
  filterMonths: string[]
  filterShops: string[]
  onMonthsChange: (v: string[]) => void
  onShopsChange: (v: string[]) => void
}

// 生成最近18个月的选项
function generateRecentMonths(): string[] {
  const months: string[] = []
  const today = dayjs()
  for (let i = 0; i < 18; i++) {
    months.push(today.subtract(i, 'month').format('YYYY-MM'))
  }
  return months
}

export function DashboardFilter({
  shops,
  filterMonths,
  filterShops,
  onMonthsChange,
  onShopsChange,
}: DashboardFilterProps) {
  const recentMonths = generateRecentMonths()

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <MultiSelect
        options={recentMonths}
        value={filterMonths}
        onChange={onMonthsChange}
        placeholder="选择月份"
        className="w-36"
      />
      <MultiSelect
        options={shops}
        value={filterShops}
        onChange={onShopsChange}
        placeholder="全部店铺"
        className="w-32"
      />
    </div>
  )
}
