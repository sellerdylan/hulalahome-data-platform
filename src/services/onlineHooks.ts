/**
 * 在线数据获取 Hook
 * 当 VITE_API_URL 设置时，从后端 API 获取数据
 * 未设置时返回 null，由本地 IndexedDB 处理
 */
import { useState, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import {
  fetchDashboardSummary,
  fetchSpuList,
  fetchSpuDaily,
  fetchShopOptions,
  fetchOperatorOptions,
  fetchOperatorGroupOptions,
  fetchCategoryOptions,
  fetchDepartmentTargets,
  fetchOperatorGroupTargets,
  fetchOperatorTargets,
  fetchStatsOverview,
  type DashboardSummaryItem,
  type SpuListItem,
  type SpuDailyItem,
  type StatsOverview,
} from './api'
import type {
  DepartmentTarget,
  OperatorGroupTarget,
  OperatorTarget,
} from '@/types'

const isOnlineMode = () => {
  // 生产环境或非 localhost 时，认为是在线模式
  if (import.meta.env.PROD || window.location.hostname !== 'localhost') {
    return true
  }
  // 本地开发环境，检查是否配置了 API URL
  return import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== ''
}

// ==================== Dashboard 数据 ====================

export function useOnlineDashboard(startDate: string, endDate: string, filters?: {
  shop?: string
  operatorGroup?: string
  operator?: string
  category?: string
}) {
  const [data, setData] = useState<DashboardSummaryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOnlineMode()) return

    setLoading(true)
    setError(null)
    fetchDashboardSummary({
      start_date: startDate,
      end_date: endDate,
      ...filters,
    })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [startDate, endDate, filters?.shop, filters?.operatorGroup, filters?.operator, filters?.category])

  return { data, loading, error, isOnline: isOnlineMode() }
}

// ==================== SPU 列表 ====================

export function useOnlineSpuList(params: {
  startDate?: string
  endDate?: string
  shop?: string
  operatorGroup?: string
  operator?: string
  salesGrade?: string
  category?: string
}) {
  const [data, setData] = useState<SpuListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOnlineMode()) return

    setLoading(true)
    setError(null)
    fetchSpuList({
      start_date: params.startDate,
      end_date: params.endDate,
      shop: params.shop,
      operator_group: params.operatorGroup,
      operator: params.operator,
      sales_grade: params.salesGrade,
      category: params.category,
    })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.startDate, params.endDate, params.shop, params.operatorGroup,
      params.operator, params.salesGrade, params.category])

  return { data, loading, error, isOnline: isOnlineMode() }
}

// ==================== SPU 每日明细 ====================

export function useOnlineSpuDaily(spu: string, shop?: string, startDate?: string, endDate?: string) {
  const [data, setData] = useState<SpuDailyItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOnlineMode() || !spu) return

    setLoading(true)
    setError(null)
    fetchSpuDaily({ spu, shop, start_date: startDate, end_date: endDate })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [spu, shop, startDate, endDate])

  return { data, loading, error, isOnline: isOnlineMode() }
}

// ==================== 筛选选项 ====================

export function useOnlineOptions() {
  const [shops, setShops] = useState<string[]>([])
  const [operators, setOperators] = useState<string[]>([])
  const [operatorGroups, setOperatorGroups] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!isOnlineMode()) return

    setLoading(true)
    try {
      const [s, o, og, c] = await Promise.all([
        fetchShopOptions(),
        fetchOperatorOptions(),
        fetchOperatorGroupOptions(),
        fetchCategoryOptions(),
      ])
      setShops(s)
      setOperators(o)
      setOperatorGroups(og)
      setCategories(c)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { shops, operators, operatorGroups, categories, loading, reload: load, isOnline: isOnlineMode() }
}

// ==================== 目标数据 ====================

export function useOnlineTargets(month?: string) {
  const [department, setDepartment] = useState<DepartmentTarget[]>([])
  const [operatorGroup, setOperatorGroup] = useState<OperatorGroupTarget[]>([])
  const [operator, setOperator] = useState<OperatorTarget[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!isOnlineMode()) return

    setLoading(true)
    try {
      const [d, og, o] = await Promise.all([
        fetchDepartmentTargets(month),
        fetchOperatorGroupTargets(month),
        fetchOperatorTargets(month),
      ])
      setDepartment(d)
      setOperatorGroup(og)
      setOperator(o)
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  return {
    departmentTargets: department,
    operatorGroupTargets: operatorGroup,
    operatorTargets: operator,
    loading,
    reload: load,
    isOnline: isOnlineMode(),
  }
}

// ==================== 系统状态 ====================

export function useOnlineStatus() {
  return isOnlineMode()
}
