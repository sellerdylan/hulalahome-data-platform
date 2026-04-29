import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency, gradeColors } from '@/lib/utils'
import type { SalesGrade } from '@/types'
import { ChevronDown, ChevronRight, Building2, Users, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface OperatorProgressProps {
  title: string
  data: {
    name: string
    current: number
    target: number
    grade?: SalesGrade
  }[]
}

export function OperatorProgress({ title, data }: OperatorProgressProps) {
  const sortedData = [...data].sort((a, b) => {
    const progressA = a.target > 0 ? a.current / a.target : 0
    const progressB = b.target > 0 ? b.current / b.target : 0
    return progressB - progressA
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedData.map((item, index) => {
          const progress = item.target > 0 ? (item.current / item.target) * 100 : 0
          const isOverTarget = progress >= 100
          const isNearTarget = progress >= 70 && progress < 100
          const isFarFromTarget = progress < 40

          return (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.grade && (
                    <Badge 
                      variant="outline"
                      className={cn("text-xs font-bold", 
                        item.grade === 'S' && "text-yellow-600 border-yellow-400",
                        item.grade === 'A' && "text-green-600 border-green-400",
                        item.grade === 'B' && "text-blue-600 border-blue-400",
                        item.grade === 'C' && "text-orange-600 border-orange-400"
                      )}
                    >
                      {item.grade}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">
                    {formatCurrency(item.current)} / {formatCurrency(item.target)}
                  </span>
                  <Badge variant={
                    isOverTarget ? 'success' : 
                    isFarFromTarget ? 'danger' : 
                    isNearTarget ? 'secondary' : 'outline'
                  }>
                    {progress.toFixed(0)}%
                  </Badge>
                </div>
              </div>
              <Progress 
                value={Math.min(progress, 100)} 
                className="h-2"
                indicatorClassName={cn(
                  isOverTarget && "bg-green-500",
                  isNearTarget && !isOverTarget && "bg-blue-500",
                  isFarFromTarget && "bg-red-500",
                  !isOverTarget && !isNearTarget && !isFarFromTarget && "bg-yellow-500"
                )}
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

interface GradeDistributionProps {
  data: {
    grade: SalesGrade
    count: number
    sales: number
  }[]
  total: number
}

export function GradeDistribution({ data, total }: GradeDistributionProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">S/A/B/C 分布</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((item) => {
            const percentage = total > 0 ? (item.count / total) * 100 : 0
            return (
              <div key={item.grade} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: gradeColors[item.grade] }}
                    />
                    <span className="text-sm font-medium">{item.grade}</span>
                    <span className="text-xs text-gray-400">({item.count} 个)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">{formatCurrency(item.sales)}</span>
                    <span className="text-gray-400">{percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div 
                    className="h-1.5 rounded-full transition-all"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: gradeColors[item.grade]
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// 层级节点数据类型
interface HierarchyNodeData {
  name: string
  icon: LucideIcon
  sales: number
  targetSales: number
  profit: number
  targetProfit: number
  adSpend: number
  marginRate: number
  acos: number
  children?: HierarchyNodeData[]
}

interface HierarchyViewProps {
  data: HierarchyNodeData
}

function HierarchyRow({ node, level = 0, defaultExpanded = true }: { node: HierarchyNodeData; level?: number; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const hasChildren = node.children && node.children.length > 0
  const salesProgress = node.targetSales > 0 ? (node.sales / node.targetSales) * 100 : 0
  const profitProgress = node.targetProfit > 0 ? (node.profit / node.targetProfit) * 100 : 0
  const Icon = node.icon

  const levelColors = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-gray-100 text-gray-800'
  ]
  const levelBg = levelColors[Math.min(level, levelColors.length - 1)]

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div 
        className={cn("flex items-center gap-2 p-3 hover:bg-gray-50 cursor-pointer", level === 0 && "bg-gray-50 font-semibold")}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
        ) : (
          <span className="w-4" />
        )}
        <Icon className={cn("w-4 h-4", level === 0 ? "text-blue-600" : level === 1 ? "text-green-600" : "text-gray-500")} />
        <span className={cn("flex-1 text-sm", level === 0 && "text-base")}>{node.name}</span>
        <div className="flex items-center gap-6 text-xs">
          <div className="text-right">
            <div className="font-mono">{formatCurrency(node.sales)}</div>
            <div className="text-gray-400">目标 {formatCurrency(node.targetSales)}</div>
          </div>
          <div className="w-20">
            <div className="flex justify-between text-xs mb-1">
              <span>GMV达成</span>
              <span className={salesProgress >= 100 ? "text-green-600" : salesProgress >= 70 ? "text-yellow-600" : "text-red-600"}>
                {salesProgress.toFixed(0)}%
              </span>
            </div>
            <Progress value={Math.min(salesProgress, 100)} className="h-1.5" />
          </div>
          <div className="text-right">
            <div className="font-mono text-green-600">{formatCurrency(node.profit)}</div>
            <div className="text-gray-400">毛利 {((node.marginRate) * 100).toFixed(1)}%</div>
          </div>
          <div className="w-20">
            <div className="flex justify-between text-xs mb-1">
              <span>毛利达成</span>
              <span className={profitProgress >= 100 ? "text-green-600" : profitProgress >= 70 ? "text-yellow-600" : "text-red-600"}>
                {profitProgress.toFixed(0)}%
              </span>
            </div>
            <Progress value={Math.min(profitProgress, 100)} className="h-1.5" />
          </div>
          <div className="text-right">
            <span className={cn("px-2 py-0.5 rounded text-xs font-medium", 
              node.acos <= 0.10 ? "bg-green-100 text-green-700" :
              node.acos <= 0.15 ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            )}>
              ACoAS {((node.acos) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child, idx) => (
            <HierarchyRow key={child.name + idx} node={child} level={level + 1} defaultExpanded={level < 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function HierarchyView({ data }: HierarchyViewProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b flex items-center gap-2 text-xs text-gray-500 font-medium">
        <span className="flex-1">层级</span>
        <div className="flex items-center gap-6">
          <span className="w-36 text-right">销售额 / 目标</span>
          <span className="w-20">GMV达成</span>
          <span className="w-28 text-right">毛利额 / 毛利率</span>
          <span className="w-20">毛利达成</span>
          <span className="w-20 text-center">ACoAS</span>
        </div>
      </div>
      <HierarchyRow node={data} level={0} defaultExpanded={true} />
    </div>
  )
}
