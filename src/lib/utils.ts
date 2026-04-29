import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Excel 日期序列号转 YYYY-MM-DD 字符串
 * Excel 序列号 1 = 1900-01-01，JS epoch = 1899-12-31
 * 注意：不做闰年修正，Excel 的序列号本身已包含 1900 闰年错误
 * 46113 -> 2026-04-01, 46114 -> 2026-04-02
 */
export function toDateString(date: string | number | Date | undefined): string {
  if (!date) return ''
  if (typeof date === 'string') {
    // 已经是 YYYY-MM-DD 或 YYYY-MM-DDTHH:MM:SS 格式
    if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10)
    return date
  }
  if (typeof date === 'number') {
    const msPerDay = 24 * 60 * 60 * 1000
    const excelEpoch = new Date(1899, 11, 31).getTime()
    const d = new Date(excelEpoch + date * msPerDay)
    return d.toISOString().split('T')[0]
  }
  if (date instanceof Date) return date.toISOString().split('T')[0]
  return ''
}

// 格式化货币
export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// 格式化百分比
export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

// 格式化大数字
export function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toFixed(2)
}

// 计算达成率
export function calculateProgress(current: number, target: number): number {
  if (target === 0) return 0
  return current / target
}

// 判断是否达标
export function isOnTrack(current: number, target: number, currentDate: Date, totalDays: number): boolean {
  const expectedProgress = currentDate.getDate() / totalDays
  const actualProgress = calculateProgress(current, target)
  return actualProgress >= expectedProgress * 0.9 // 允许10%的容差
}

// 颜色映射
export const gradeColors = {
  S: '#FFD700', // 金色
  A: '#22C55E', // 绿色
  B: '#3B82F6', // 蓝色
  C: '#F59E0B', // 橙色
} as const

export const statusColors = {
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
} as const
