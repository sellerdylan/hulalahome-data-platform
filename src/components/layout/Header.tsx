import React from 'react'
import { User } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  rightSlot?: React.ReactNode
}

export function Header({ title, subtitle, rightSlot }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* 右侧插槽（各页面自定义内容） */}
        {rightSlot}

        {/* User */}
        <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="text-sm">
            <div className="font-medium text-gray-900">Dylan</div>
            <div className="text-gray-500 text-xs">运营经理</div>
          </div>
        </div>
      </div>
    </header>
  )
}
