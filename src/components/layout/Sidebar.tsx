import React from 'react'
import { 
  LayoutDashboard, 
  Package, 
  AlertCircle, 
  Settings,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  Target
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  currentPage: string
  onNavigate: (page: 'dashboard' | 'spu' | 'analysis' | 'import' | 'targets' | 'settings') => void
  lastUpdate?: string | null
  onRefresh: () => void
}

const menuItems = [
  { id: 'dashboard', label: '数据看板', icon: LayoutDashboard },
  { id: 'spu', label: 'SPU分析', icon: Package },
  { id: 'analysis', label: '每日问题', icon: AlertCircle },
  { id: 'import', label: '数据导入', icon: FileSpreadsheet },
  { id: 'targets', label: '目标设置', icon: Target },
  { id: 'settings', label: '系统设置', icon: Settings },
]

export function Sidebar({ 
  collapsed, 
  onToggle, 
  currentPage, 
  onNavigate,
  lastUpdate,
  onRefresh
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-slate-900 text-white transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-slate-700">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center font-bold text-sm">
            H
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm whitespace-nowrap">HULALAHOME</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id as any)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer",
                    isActive 
                      ? "bg-blue-600 text-white" 
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Last Update & Refresh */}
      <div className="px-3 py-4 border-t border-slate-700">
        {lastUpdate && !collapsed && (
          <div className="mb-2 text-xs text-slate-400">
            最后更新: {lastUpdate}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className={cn(
            "w-full text-slate-400 hover:text-white",
            collapsed && "justify-center px-0"
          )}
        >
          <RefreshCw className="w-4 h-4" />
          {!collapsed && <span className="ml-2 text-sm">刷新数据</span>}
        </Button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center hover:bg-slate-600 transition-colors cursor-pointer"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  )
}
