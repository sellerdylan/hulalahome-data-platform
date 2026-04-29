/**
 * 通用多选下拉组件
 * 支持：多选、清空、搜索过滤
 */
import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MultiSelectProps {
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  className?: string
  maxDisplayCount?: number
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = '全部',
  className,
  maxDisplayCount = 2,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(o =>
    o.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (opt: string) => {
    onChange(
      value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]
    )
  }

  const displayText = () => {
    if (value.length === 0) return placeholder
    if (value.length <= maxDisplayCount) return value.join('、')
    return `已选 ${value.length} 项`
  }

  const hasValue = value.length > 0

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center justify-between gap-1.5 h-8 px-2.5 rounded-md border text-sm w-full transition-colors',
          'bg-white border-gray-200 hover:border-blue-400',
          open && 'border-blue-500 ring-1 ring-blue-200',
          hasValue && 'border-blue-400 bg-blue-50 text-blue-700'
        )}
      >
        <span className="truncate text-xs font-medium">{displayText()}</span>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {hasValue && (
            <span
              className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-blue-500 text-white text-[9px] font-bold hover:bg-red-500"
              onClick={e => { e.stopPropagation(); onChange([]) }}
            >
              {value.length}
            </span>
          )}
          <ChevronDown className={cn('w-3 h-3 text-gray-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 top-9 z-50 min-w-[160px] max-w-[220px] bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden">
          {/* 搜索 */}
          {options.length > 6 && (
            <div className="px-2 py-1.5 border-b">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索..."
                className="w-full text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </div>
          )}

          {/* 清空按钮 */}
          {value.length > 0 && (
            <button
              onClick={() => { onChange([]); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 border-b flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              清空选择
            </button>
          )}

          {/* 选项列表 */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">无匹配结果</div>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors',
                    value.includes(opt) && 'bg-blue-50 text-blue-700'
                  )}
                >
                  <div className={cn(
                    'w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center',
                    value.includes(opt) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  )}>
                    {value.includes(opt) && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <span className="truncate">{opt}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
