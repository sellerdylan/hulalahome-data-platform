/**
 * SPU 分析页面 - Header 右侧日期筛选器
 * 支持：月份多选 + 自定义日期范围，允许清空
 */
import React, { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'

// 生成最近 18 个月
const generateMonthOptions = () => {
  const months: string[] = []
  const today = dayjs()
  for (let i = 0; i < 18; i++) {
    months.push(today.subtract(i, 'month').format('YYYY-MM'))
  }
  return months
}

export interface SpuDateFilterValue {
  mode: 'months' | 'range'
  selectedMonths: string[]    // mode=months 时生效
  startDate: string           // mode=range 时生效
  endDate: string             // mode=range 时生效
}

interface SpuDateFilterProps {
  value: SpuDateFilterValue
  onChange: (v: SpuDateFilterValue) => void
}

export function SpuDateFilter({ value, onChange }: SpuDateFilterProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'months' | 'range'>(value.mode)
  const [localMonths, setLocalMonths] = useState<string[]>(value.selectedMonths)
  const [localStart, setLocalStart] = useState(value.startDate)
  const [localEnd, setLocalEnd] = useState(value.endDate)
  const ref = useRef<HTMLDivElement>(null)

  const monthOptions = generateMonthOptions()

  // 点外关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleMonth = (m: string) => {
    setLocalMonths(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    )
  }

  const handleApply = () => {
    if (activeTab === 'months') {
      onChange({ mode: 'months', selectedMonths: localMonths, startDate: '', endDate: '' })
    } else {
      onChange({ mode: 'range', selectedMonths: [], startDate: localStart, endDate: localEnd })
    }
    setOpen(false)
  }

  const handleClear = () => {
    const currentMonth = dayjs().format('YYYY-MM')
    setLocalMonths([currentMonth])
    setLocalStart(dayjs().startOf('month').format('YYYY-MM-DD'))
    setLocalEnd(dayjs().format('YYYY-MM-DD'))
    onChange({
      mode: 'months',
      selectedMonths: [currentMonth],
      startDate: '',
      endDate: '',
    })
    setOpen(false)
  }

  // 生成按钮显示文字
  const displayText = () => {
    if (value.mode === 'months') {
      if (value.selectedMonths.length === 0) return '选择日期'
      if (value.selectedMonths.length === 1) return value.selectedMonths[0]
      return `${value.selectedMonths.length} 个月份`
    } else {
      if (!value.startDate && !value.endDate) return '选择日期'
      return `${value.startDate} ~ ${value.endDate}`
    }
  }

  const hasFilter =
    value.mode === 'months'
      ? value.selectedMonths.length > 0
      : Boolean(value.startDate || value.endDate)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 h-9 px-3 rounded-md border text-sm transition-colors',
          'bg-gray-50 border-gray-200 hover:border-blue-400 hover:bg-blue-50',
          open && 'border-blue-500 bg-blue-50',
          hasFilter && 'border-blue-400 bg-blue-50 text-blue-700'
        )}
      >
        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="max-w-[160px] truncate">{displayText()}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-3">
          {/* Tab 切换 */}
          <div className="flex rounded-lg bg-gray-100 p-0.5 mb-3">
            <button
              onClick={() => setActiveTab('months')}
              className={cn(
                'flex-1 text-xs py-1 rounded-md transition-colors font-medium',
                activeTab === 'months' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              )}
            >
              按月份
            </button>
            <button
              onClick={() => setActiveTab('range')}
              className={cn(
                'flex-1 text-xs py-1 rounded-md transition-colors font-medium',
                activeTab === 'range' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              )}
            >
              自定义范围
            </button>
          </div>

          {activeTab === 'months' && (
            <div>
              <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto pr-1">
                {monthOptions.map(m => (
                  <button
                    key={m}
                    onClick={() => toggleMonth(m)}
                    className={cn(
                      'text-xs py-1.5 px-2 rounded-md border transition-colors text-center',
                      localMonths.includes(m)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300'
                    )}
                  >
                    {m.slice(5)}&nbsp;月
                    <div className="text-[10px] opacity-70">{m.slice(0, 4)}</div>
                  </button>
                ))}
              </div>
              {localMonths.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {localMonths.sort().map(m => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-0.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                    >
                      {m}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => toggleMonth(m)} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'range' && (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">开始日期</label>
                <input
                  type="date"
                  value={localStart}
                  onChange={e => setLocalStart(e.target.value)}
                  className="w-full h-8 px-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">结束日期</label>
                <input
                  type="date"
                  value={localEnd}
                  onChange={e => setLocalEnd(e.target.value)}
                  className="w-full h-8 px-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2 mt-3 pt-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-7 text-xs text-gray-500"
              onClick={handleClear}
            >
              <X className="w-3 h-3 mr-1" />
              重置
            </Button>
            <Button
              size="sm"
              className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleApply}
            >
              确认
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
