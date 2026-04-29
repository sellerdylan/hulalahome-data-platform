import React from 'react'
import { Calendar, Filter, X } from 'lucide-react'
import dayjs from 'dayjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FilterState, Category, SalesGrade } from '@/types'

interface FilterPanelProps {
  filters: FilterState
  onChange: (filters: Partial<FilterState>) => void
  shops: string[]
  operatorGroups: string[]
  operators: string[]
  categories?: Category[]
  salesGrades?: SalesGrade[]
}

// 生成最近12个月的选项
const generateMonthOptions = () => {
  const months = []
  const today = dayjs()
  for (let i = 0; i < 12; i++) {
    months.push(today.subtract(i, 'month').format('YYYY-MM'))
  }
  return months
}

export function FilterPanel({
  filters,
  onChange,
  shops,
  operatorGroups,
  operators,
  categories = ['软包家具', '板式家具'],
  salesGrades = ['S', 'A', 'B', 'C']
}: FilterPanelProps) {
  
  const activeFiltersCount = 
    (filters.shops.length > 0 ? 1 : 0) +
    (filters.operatorGroups.length > 0 ? 1 : 0) +
    (filters.operators.length > 0 ? 1 : 0) +
    (filters.categories.length > 0 ? 1 : 0) +
    (filters.salesGrades.length > 0 ? 1 : 0) +
    (filters.spus.length > 0 ? 1 : 0)

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    onChange({
      dateRange: {
        ...filters.dateRange,
        [field]: value
      }
    })
  }

  const handleMultiSelect = (field: keyof FilterState, value: string) => {
    const current = filters[field] as string[]
    const newValues = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    onChange({ [field]: newValues })
  }

  const clearAllFilters = () => {
    onChange({
      shops: [],
      operatorGroups: [],
      operators: [],
      categories: [],
      salesGrades: [],
      spus: []
    })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-700">筛选条件</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFiltersCount} 个筛选器
            </Badge>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearAllFilters}
            className="text-gray-500 hover:text-red-500"
          >
            <X className="w-4 h-4 mr-1" />
            清除全部
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {/* 月份筛选 */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            月份
          </label>
          <Select
            value={filters.month || dayjs().format('YYYY-MM')}
            onValueChange={(v) => onChange({ month: v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="选择月份" />
            </SelectTrigger>
            <SelectContent>
              {generateMonthOptions().map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 店铺 */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-500">店铺</label>
          <Select
            value={filters.shops[0] || ''}
            onValueChange={(v) => handleMultiSelect('shops', v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="全部店铺" />
            </SelectTrigger>
            <SelectContent>
              {shops.map(shop => (
                <SelectItem key={shop} value={shop}>{shop}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 运营组 */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-500">运营组</label>
          <Select
            value={filters.operatorGroups[0] || ''}
            onValueChange={(v) => handleMultiSelect('operatorGroups', v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="全部运营组" />
            </SelectTrigger>
            <SelectContent>
              {operatorGroups.map(group => (
                <SelectItem key={group} value={group}>{group}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 运营 */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-500">运营</label>
          <Select
            value={filters.operators[0] || ''}
            onValueChange={(v) => handleMultiSelect('operators', v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="全部运营" />
            </SelectTrigger>
            <SelectContent>
              {operators.map(op => (
                <SelectItem key={op} value={op}>{op}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 品类 */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-500">品类</label>
          <Select
            value={filters.categories[0] || ''}
            onValueChange={(v) => handleMultiSelect('categories', v as Category)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="全部品类" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 销售等级快捷筛选 */}
      <Separator className="my-4" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">销售等级:</span>
        <div className="flex gap-1">
          {salesGrades.map(grade => {
            const isActive = filters.salesGrades.includes(grade)
            const colors = {
              S: 'bg-yellow-100 text-yellow-800 border-yellow-300',
              A: 'bg-green-100 text-green-800 border-green-300',
              B: 'bg-blue-100 text-blue-800 border-blue-300',
              C: 'bg-orange-100 text-orange-800 border-orange-300'
            }
            return (
              <Button
                key={grade}
                variant="outline"
                size="sm"
                onClick={() => handleMultiSelect('salesGrades', grade)}
                className={`h-7 px-2 text-xs ${
                  isActive 
                    ? colors[grade] + ' border-2' 
                    : 'bg-gray-50 text-gray-600'
                }`}
              >
                {grade}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
