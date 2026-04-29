import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import { ArrowUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, formatCurrency, formatPercent, gradeColors } from '@/lib/utils'
import type { SpuSummary, SalesGrade } from '@/types'

interface FilterOptions {
  shops: string[]
  groups: string[]
  operators: string[]
  categories: string[]
}

interface SpuTableProps {
  data: SpuSummary[]
  onRowClick?: (spu: SpuSummary) => void
  // 标3 筛选器
  filterOptions?: FilterOptions
  filterShops?: string[]
  filterGroups?: string[]
  filterOperators?: string[]
  filterCategories?: string[]
  onFilterShopsChange?: (v: string[]) => void
  onFilterGroupsChange?: (v: string[]) => void
  onFilterOperatorsChange?: (v: string[]) => void
  onFilterCategoriesChange?: (v: string[]) => void
}

type SortField = keyof SpuSummary
type SortDirection = 'asc' | 'desc'

const PAGE_SIZE = 20

export function SpuTable({
  data,
  onRowClick,
  filterOptions,
  filterShops = [],
  filterGroups = [],
  filterOperators = [],
  filterCategories = [],
  onFilterShopsChange,
  onFilterGroupsChange,
  onFilterOperatorsChange,
  onFilterCategoriesChange,
}: SpuTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('totalSales')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
    setCurrentPage(1)
  }

  const filteredData = data
    .filter(item => {
      if (searchTerm && !item.spu.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      if (filterGrade !== 'all' && item.salesGrade !== filterGrade) {
        return false
      }
      if (filterStatus === 'on-target' && !item.isOnTarget) {
        return false
      }
      if (filterStatus === 'off-target' && item.isOnTarget) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal)
        return sortDirection === 'asc' ? cmp : -cmp
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      
      return 0
    })

  // 分页计算
  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE
  const pageEnd = pageStart + PAGE_SIZE
  const pagedData = filteredData.slice(pageStart, pageEnd)

  // 筛选条件变化时重置页码
  const handleFilterChange = (setter: (v: string) => void) => (val: string) => {
    setter(val)
    setCurrentPage(1)
  }

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="-ml-3 h-8 text-xs font-medium"
    >
      {children}
      <ArrowUpDown className={cn(
        "ml-1 h-3 w-3",
        sortField === field ? "text-blue-600" : "text-gray-400"
      )} />
    </Button>
  )

  return (
    <div className="space-y-3">
      {/* 工具栏：SPU搜索 + 标3多选筛选器 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜索 SPU..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            className="pl-9 h-8 text-sm"
          />
        </div>

        {/* 标3：多选筛选器 */}
        {filterOptions && (
          <>
            <div className="h-5 w-px bg-gray-200 mx-1" />
            {filterOptions.shops.length > 0 && (
              <MultiSelect
                options={filterOptions.shops}
                value={filterShops}
                onChange={v => { onFilterShopsChange?.(v); setCurrentPage(1) }}
                placeholder="全部店铺"
                className="w-28"
              />
            )}
            {filterOptions.groups.length > 0 && (
              <MultiSelect
                options={filterOptions.groups}
                value={filterGroups}
                onChange={v => { onFilterGroupsChange?.(v); setCurrentPage(1) }}
                placeholder="全部运营组"
                className="w-28"
              />
            )}
            {filterOptions.operators.length > 0 && (
              <MultiSelect
                options={filterOptions.operators}
                value={filterOperators}
                onChange={v => { onFilterOperatorsChange?.(v); setCurrentPage(1) }}
                placeholder="全部运营"
                className="w-24"
              />
            )}
            <MultiSelect
              options={filterOptions.categories}
              value={filterCategories}
              onChange={v => { onFilterCategoriesChange?.(v); setCurrentPage(1) }}
              placeholder="全部品类"
              className="w-24"
            />
          </>
        )}

        <div className="ml-auto text-sm text-gray-500">
          共 {filteredData.length} 条结果
        </div>
      </div>

      {/* 表格容器：固定高度，内部独立滚动 */}
      <div className="border rounded-lg flex flex-col" style={{ height: 'calc(100vh - 380px)', minHeight: 400 }}>
        {/* 表头固定 */}
        <div className="overflow-x-auto flex-shrink-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[130px] sticky left-0 bg-gray-50 z-10">
                  <SortHeader field="spu">SPU</SortHeader>
                </TableHead>
                <TableHead className="w-[130px]">店铺</TableHead>
                <TableHead className="w-[80px]">运营</TableHead>
                <TableHead className="text-right">
                  <SortHeader field="totalSales">销售额</SortHeader>
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader field="totalCost">成本</SortHeader>
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader field="totalCommission">佣金</SortHeader>
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader field="totalAdSpend">广告费</SortHeader>
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader field="totalRefund">退款费</SortHeader>
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader field="totalFreight">运费</SortHeader>
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader field="totalStorage">仓储费</SortHeader>
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader field="totalDsp">DSP费</SortHeader>
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader field="totalReturnFreight">退货运费</SortHeader>
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader field="grossMarginRate">毛利率</SortHeader>
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader field="orderCount">订单</SortHeader>
                </TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        {/* 表体：独立滚动区域 */}
        <div className="overflow-auto flex-1">
          <Table>
            <TableBody>
              {pagedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8 text-gray-500">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                pagedData.map((item, index) => (
                  <TableRow 
                    key={`${item.spu}-${item.shop}-${index}`}
                    className="group cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => onRowClick?.(item)}
                  >
                    <TableCell className="font-medium w-[130px] sticky left-0 bg-white group-hover:bg-blue-50">
                      <span className="text-blue-600 hover:underline">{item.spu}</span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 w-[130px]">{item.shop}</TableCell>
                    <TableCell className="text-sm w-[80px]">
                      <div className="text-gray-800 font-medium leading-tight">{item.operator || '—'}</div>
                      {item.operatorGroup && (
                        <div className="text-xs text-gray-400 leading-tight">{item.operatorGroup}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${item.totalSales.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono text-red-600">${item.totalCost.toFixed(0)}</div>
                      <div className="text-xs text-gray-400">{(item.totalCost / Math.max(item.totalSales, 1) * 100).toFixed(1)}%</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono text-orange-600">${item.totalCommission.toFixed(0)}</div>
                      <div className="text-xs text-gray-400">{(item.totalCommission / Math.max(item.totalSales, 1) * 100).toFixed(1)}%</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={cn("font-mono", item.totalAdSpend > 0 ? "text-purple-600" : "text-gray-400")}>${item.totalAdSpend.toFixed(2)}</div>
                      <div className="text-xs text-gray-400">{(item.totalAdSpend / Math.max(item.totalSales, 1) * 100).toFixed(1)}%</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono text-yellow-600">${item.totalRefund.toFixed(0)}</div>
                      <div className="text-xs text-gray-400">{(item.totalRefund / Math.max(item.totalSales, 1) * 100).toFixed(1)}%</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono text-cyan-600">${item.totalFreight.toFixed(0)}</div>
                      <div className="text-xs text-gray-400">{(item.totalFreight / Math.max(item.totalSales, 1) * 100).toFixed(1)}%</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono text-indigo-600">${item.totalStorage.toFixed(0)}</div>
                      <div className="text-xs text-gray-400">{(item.totalStorage / Math.max(item.totalSales, 1) * 100).toFixed(1)}%</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono text-pink-600">${item.totalDsp.toFixed(0)}</div>
                      <div className="text-xs text-gray-400">{(item.totalDsp / Math.max(item.totalSales, 1) * 100).toFixed(1)}%</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono text-amber-600">${item.totalReturnFreight.toFixed(0)}</div>
                      <div className="text-xs text-gray-400">{(item.totalReturnFreight / Math.max(item.totalSales, 1) * 100).toFixed(1)}%</div>
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-mono font-medium",
                      item.grossMarginRate >= 0.2 ? "text-green-600" :
                      item.grossMarginRate >= 0.15 ? "text-yellow-600" :
                      "text-red-600"
                    )}>
                      {(item.grossMarginRate * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">{item.orderCount}</TableCell>
                    <TableCell>
                      <Badge variant={item.isOnTarget ? "success" : "danger"}>
                        {item.isOnTarget ? '✓' : '✗'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页控制器 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t bg-gray-50 flex-shrink-0">
          <div className="text-xs text-gray-500">
            第 {filteredData.length === 0 ? 0 : pageStart + 1} – {Math.min(pageEnd, filteredData.length)} 条，共 {filteredData.length} 条
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
            >
              «
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            {/* 页码按钮 */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={safeCurrentPage === p ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 min-w-[28px] px-1.5 text-xs"
                    onClick={() => setCurrentPage(p as number)}
                  >
                    {p}
                  </Button>
                )
              )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
            >
              »
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
