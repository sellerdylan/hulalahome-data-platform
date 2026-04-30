import React, { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Target,
  Upload,
  Trash2,
  Plus,
  Save,
  AlertCircle,
  Download,
  CheckCircle2,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useTargetStore, useSystemStore } from '@/store'
import { formatCurrency } from '@/lib/utils'
import dayjs from 'dayjs'
import type { DepartmentTarget, OperatorGroupTarget, OperatorTarget } from '@/types'
import { 
  importDepartmentTargetsFile, 
  importOperatorGroupTargetsFile, 
  importOperatorTargetsFile,
  saveDepartmentTargetToBackend,
  saveOperatorGroupTargetToBackend,
  saveOperatorTargetToBackend,
} from '@/services/backendApi'

const generateId = () => Math.random().toString(36).substring(2, 11)

// Excel解析工具
function parseExcelFile<T>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json<T>(firstSheet)
        resolve(jsonData)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

// 下载导入模板
function downloadTemplate(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '模板')
  XLSX.writeFile(wb, filename)
}

// ========== 整体目标 Tab ==========
function DepartmentTargetsTab() {
  const { departmentTargets, setDepartmentTargets } = useTargetStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setMessage(null)
    try {
      const rows = await parseExcelFile<Record<string, unknown>>(file)
      const valid: DepartmentTarget[] = []
      for (const row of rows) {
        const month = String(row['月份'] || row['month'] || row['Month'] || '').trim()
        const targetSales = Number(row['销售额目标'] || row['targetSales'] || row['销售额'] || 0)
        const targetGrossProfit = Number(row['毛利目标'] || row['targetGrossProfit'] || row['三级毛利目标'] || 0)
        if (month && !isNaN(targetSales)) {
          valid.push({ id: generateId(), month, targetSales, targetGrossProfit })
        }
      }
      // 增量导入：同月份去重，新的覆盖旧的
      const existingMap = new Map(departmentTargets.map(t => [t.month, t]))
      for (const t of valid) existingMap.set(t.month, t)
      const merged = [...existingMap.values()].sort((a, b) => a.month.localeCompare(b.month))
      setDepartmentTargets(merged)
      
      // 同步到后端（实现数据共享）
      try {
        await importDepartmentTargetsFile(file)
        console.log('【整体目标】已同步到后端')
      } catch (apiError) {
        console.warn('【整体目标】后端同步失败:', apiError)
      }
      
      setMessage({ type: 'success', text: `成功导入 ${valid.length} 条整体目标` })
    } catch {
      setMessage({ type: 'error', text: '文件解析失败，请检查格式' })
    }
    setImporting(false)
    e.target.value = ''
  }

  const handleDelete = (id: string | number) => {
    setDepartmentTargets(departmentTargets.filter(t => String(t.id) !== String(id)))
  }

  const handleClearAll = () => {
    setDepartmentTargets([])
  }

  const handleUpdateRow = (id: string | number, field: keyof DepartmentTarget, value: string | number) => {
    setDepartmentTargets(departmentTargets.map(t =>
      String(t.id) === String(id) ? { ...t, [field]: field === 'month' || field === 'shop' ? value : Number(value) } : t
    ))
  }

  const handleAddRow = () => {
    const nextMonth = departmentTargets.length > 0
      ? dayjs(departmentTargets[departmentTargets.length - 1].month).add(1, 'month').format('YYYY-MM')
      : dayjs().format('YYYY-MM')
    setDepartmentTargets([...departmentTargets, {
      id: generateId(), month: nextMonth, targetSales: 0, targetGrossProfit: 0,
    }])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">整体月度目标</h3>
          <p className="text-xs text-gray-500">按月份设置全部门店的销售额目标和三级毛利额目标</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadTemplate([
            { '月份': '2026-04', '销售额目标': 0, '毛利目标': 0 }
          ], '整体目标导入模板.xlsx')}>
            <Download className="w-4 h-4 mr-1" />下载模板
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" />{importing ? '导入中...' : '导入 Excel'}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          {departmentTargets.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4 mr-1" />清空
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* 表格 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">月份</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">销售额目标 (USD)</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">毛利目标 (USD)</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {departmentTargets.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-400">暂无数据，点击右上角按钮添加或导入</td>
              </tr>
            ) : departmentTargets.map(t => (
              <tr key={String(t.id)} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Input value={t.month} onChange={e => handleUpdateRow(String(t.id), 'month', e.target.value)}
                    className="h-8 text-sm" placeholder="YYYY-MM" />
                </td>
                <td className="px-4 py-2">
                  <Input type="number" value={t.targetSales} onChange={e => handleUpdateRow(String(t.id), 'targetSales', e.target.value)}
                    className="h-8 text-sm text-right" />
                </td>
                <td className="px-4 py-2">
                  <Input type="number" value={t.targetGrossProfit} onChange={e => handleUpdateRow(String(t.id), 'targetGrossProfit', e.target.value)}
                    className="h-8 text-sm text-right" />
                </td>
                <td className="px-4 py-2">
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(String(t.id))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {departmentTargets.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAddRow}>
            <Plus className="w-4 h-4 mr-1" />新增月份
          </Button>
        </div>
      )}
    </div>
  )
}

// ========== 运营组目标 Tab ==========
function OperatorGroupTargetsTab() {
  const { operatorGroupTargets, setOperatorGroupTargets } = useTargetStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setMessage(null)
    try {
      const rows = await parseExcelFile<Record<string, unknown>>(file)
      const valid: OperatorGroupTarget[] = []
      for (const row of rows) {
        const month = String(row['月份'] || row['month'] || '').trim()
        const operatorGroup = String(row['运营组'] || row['operatorGroup'] || '').trim()
        const targetSales = Number(row['销售额目标'] || row['targetSales'] || 0)
        const targetGrossProfit = Number(row['毛利目标'] || row['targetGrossProfit'] || 0)
        if (month && operatorGroup && !isNaN(targetSales)) {
          valid.push({ id: generateId(), month, operatorGroup, targetSales, targetGrossProfit })
        }
      }
      const existingMap = new Map(operatorGroupTargets.map(t => [`${t.month}_${t.operatorGroup}`, t]))
      for (const t of valid) existingMap.set(`${t.month}_${t.operatorGroup}`, t)
      const merged = [...existingMap.values()].sort((a, b) =>
        a.month.localeCompare(b.month) || a.operatorGroup.localeCompare(b.operatorGroup)
      )
      setOperatorGroupTargets(merged)
      
      // 同步到后端（实现数据共享）
      try {
        await importOperatorGroupTargetsFile(file)
        console.log('【运营组目标】已同步到后端')
      } catch (apiError) {
        console.warn('【运营组目标】后端同步失败:', apiError)
      }
      
      setMessage({ type: 'success', text: `成功导入 ${valid.length} 条运营组目标` })
    } catch {
      setMessage({ type: 'error', text: '文件解析失败，请检查格式' })
    }
    setImporting(false)
    e.target.value = ''
  }

  const handleDelete = (id: string | number) => {
    setOperatorGroupTargets(operatorGroupTargets.filter(t => String(t.id) !== String(id)))
  }

  const handleClearAll = () => setOperatorGroupTargets([])

  const handleAddRow = () => {
    const last = operatorGroupTargets[operatorGroupTargets.length - 1]
    setOperatorGroupTargets([...operatorGroupTargets, {
      id: generateId(),
      month: last ? dayjs(last.month).add(1, 'month').format('YYYY-MM') : dayjs().format('YYYY-MM'),
      operatorGroup: '',
      targetSales: 0,
      targetGrossProfit: 0,
    }])
  }

  const handleUpdateRow = (id: string | number, field: keyof OperatorGroupTarget, value: string | number) => {
    setOperatorGroupTargets(operatorGroupTargets.map(t =>
      String(t.id) === String(id) ? { ...t, [field]: field === 'month' || field === 'operatorGroup' ? value : Number(value) } : t
    ))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">运营组月度目标</h3>
          <p className="text-xs text-gray-500">按月份和运营组设置销售额目标和三级毛利额目标</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadTemplate([
            { '月份': '2026-04', '运营组': 'A组', '销售额目标': 0, '毛利目标': 0 }
          ], '运营组目标导入模板.xlsx')}>
            <Download className="w-4 h-4 mr-1" />下载模板
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" />{importing ? '导入中...' : '导入 Excel'}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          {operatorGroupTargets.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4 mr-1" />清空
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">月份</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">运营组</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">销售额目标</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">毛利目标</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {operatorGroupTargets.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">暂无数据</td>
              </tr>
            ) : operatorGroupTargets.map(t => (
              <tr key={String(t.id)} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Input value={t.month} onChange={e => handleUpdateRow(String(t.id), 'month', e.target.value)}
                    className="h-8 text-sm" placeholder="YYYY-MM" />
                </td>
                <td className="px-4 py-2">
                  <Input value={t.operatorGroup} onChange={e => handleUpdateRow(String(t.id), 'operatorGroup', e.target.value)}
                    className="h-8 text-sm" placeholder="运营组名称" />
                </td>
                <td className="px-4 py-2">
                  <Input type="number" value={t.targetSales} onChange={e => handleUpdateRow(String(t.id), 'targetSales', e.target.value)}
                    className="h-8 text-sm text-right" />
                </td>
                <td className="px-4 py-2">
                  <Input type="number" value={t.targetGrossProfit} onChange={e => handleUpdateRow(String(t.id), 'targetGrossProfit', e.target.value)}
                    className="h-8 text-sm text-right" />
                </td>
                <td className="px-4 py-2">
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(String(t.id))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {operatorGroupTargets.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAddRow}>
            <Plus className="w-4 h-4 mr-1" />新增记录
          </Button>
        </div>
      )}
    </div>
  )
}

// ========== 运营目标 Tab ==========
function OperatorTargetsTab() {
  const { operatorTargets, setOperatorTargets } = useTargetStore()
  const { skuBaseInfo } = useSystemStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 从SKU基础信息中提取所有运营和运营组
  const knownOperators = [...new Set(skuBaseInfo.map(s => s.operator).filter(Boolean))]

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setMessage(null)
    try {
      const rows = await parseExcelFile<Record<string, unknown>>(file)
      const valid: OperatorTarget[] = []
      for (const row of rows) {
        const month = String(row['月份'] || row['month'] || '').trim()
        const operator = String(row['运营'] || row['operator'] || '').trim()
        const operatorGroup = String(row['运营组'] || row['operatorGroup'] || '').trim()
        const targetSales = Number(row['销售额目标'] || row['targetSales'] || 0)
        const targetGrossProfit = Number(row['毛利目标'] || row['targetGrossProfit'] || 0)
        if (month && operator && !isNaN(targetSales)) {
          valid.push({ id: generateId(), month, operator, operatorGroup, targetSales, targetGrossProfit })
        }
      }
      const existingMap = new Map(operatorTargets.map(t => [`${t.month}_${t.operator}`, t]))
      for (const t of valid) existingMap.set(`${t.month}_${t.operator}`, t)
      const merged = [...existingMap.values()].sort((a, b) =>
        a.month.localeCompare(b.month) || a.operator.localeCompare(b.operator)
      )
      setOperatorTargets(merged)
      
      // 同步到后端（实现数据共享）
      try {
        await importOperatorTargetsFile(file)
        console.log('【运营目标】已同步到后端')
      } catch (apiError) {
        console.warn('【运营目标】后端同步失败:', apiError)
      }
      
      setMessage({ type: 'success', text: `成功导入 ${valid.length} 条运营目标` })
    } catch {
      setMessage({ type: 'error', text: '文件解析失败，请检查格式' })
    }
    setImporting(false)
    e.target.value = ''
  }

  const handleDelete = (id: string | number) => {
    setOperatorTargets(operatorTargets.filter(t => String(t.id) !== String(id)))
  }

  const handleClearAll = () => setOperatorTargets([])

  const handleAddRow = () => {
    const last = operatorTargets[operatorTargets.length - 1]
    setOperatorTargets([...operatorTargets, {
      id: generateId(),
      month: last ? dayjs(last.month).add(1, 'month').format('YYYY-MM') : dayjs().format('YYYY-MM'),
      operator: '',
      operatorGroup: '',
      targetSales: 0,
      targetGrossProfit: 0,
    }])
  }

  const handleUpdateRow = (id: string | number, field: keyof OperatorTarget, value: string | number) => {
    setOperatorTargets(operatorTargets.map(t =>
      String(t.id) === String(id) ? { ...t, [field]: value } : t
    ))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">运营月度目标</h3>
          <p className="text-xs text-gray-500">按月份和运营设置个人销售额目标和三级毛利额目标</p>
          {knownOperators.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">已知运营：{knownOperators.join('、')}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadTemplate([
            { '月份': '2026-04', '运营': '张三', '运营组': 'A组', '销售额目标': 0, '毛利目标': 0 }
          ], '运营目标导入模板.xlsx')}>
            <Download className="w-4 h-4 mr-1" />下载模板
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" />{importing ? '导入中...' : '导入 Excel'}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          {operatorTargets.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4 mr-1" />清空
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">月份</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">运营</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">运营组</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">销售额目标</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">毛利目标</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {operatorTargets.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">暂无数据</td>
              </tr>
            ) : operatorTargets.map(t => (
              <tr key={String(t.id)} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Input value={t.month} onChange={e => handleUpdateRow(String(t.id), 'month', e.target.value)}
                    className="h-8 text-sm" placeholder="YYYY-MM" />
                </td>
                <td className="px-4 py-2">
                  <Input value={t.operator} onChange={e => handleUpdateRow(String(t.id), 'operator', e.target.value)}
                    className="h-8 text-sm" placeholder="运营姓名" />
                </td>
                <td className="px-4 py-2">
                  <Input value={t.operatorGroup} onChange={e => handleUpdateRow(String(t.id), 'operatorGroup', e.target.value)}
                    className="h-8 text-sm" placeholder="运营组" />
                </td>
                <td className="px-4 py-2">
                  <Input type="number" value={t.targetSales} onChange={e => handleUpdateRow(String(t.id), 'targetSales', e.target.value)}
                    className="h-8 text-sm text-right" />
                </td>
                <td className="px-4 py-2">
                  <Input type="number" value={t.targetGrossProfit} onChange={e => handleUpdateRow(String(t.id), 'targetGrossProfit', e.target.value)}
                    className="h-8 text-sm text-right" />
                </td>
                <td className="px-4 py-2">
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(String(t.id))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {operatorTargets.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAddRow}>
            <Plus className="w-4 h-4 mr-1" />新增记录
          </Button>
        </div>
      )}
    </div>
  )
}

// ========== 主页面 ==========
export function TargetsPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Target className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">目标设置</h2>
            <p className="text-xs text-gray-500">设置整体 / 运营组 / 运营三级的月度销售目标和毛利目标，支持导入 Excel 或手动填写</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="department" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="department">整体目标</TabsTrigger>
          <TabsTrigger value="group">运营组目标</TabsTrigger>
          <TabsTrigger value="operator">运营目标</TabsTrigger>
        </TabsList>

        <TabsContent value="department" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <DepartmentTargetsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="group" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <OperatorGroupTargetsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operator" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <OperatorTargetsTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
