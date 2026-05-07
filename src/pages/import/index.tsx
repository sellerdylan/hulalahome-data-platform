import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  FileSpreadsheet,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Package,
  ShoppingCart,
  Megaphone,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import type { Order, AdData } from '@/types'
import { importOrdersFile, importAdsFile, clearAllData } from '@/services/backendApi'

interface ImportPageProps {
  orders: Order[]
  adData: AdData[]
  onImportOrders?: (data: Order[]) => void
  onImportAdData?: (data: AdData[]) => void
  onClearOrders?: () => void
  onClearAdData?: () => void
}

// localStorage keys
const STORAGE_KEYS = {
  orders: 'hulalahome_orders',
  adData: 'hulalahome_ad_data',
}

// 从localStorage加载数据
export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

// 保存数据到localStorage
export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }
}

export function ImportPage({
  orders,
  adData,
  onImportOrders,
  onImportAdData,
  onClearOrders,
  onClearAdData,
}: ImportPageProps) {
  // 导入状态
  const [orderImportStatus, setOrderImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [adImportStatus, setAdImportStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // 解析Excel文件
  const parseExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          // cellDates: true 让 xlsx 自动将 Excel 日期转换为 JS Date 对象
          // cellDates: false 避免 xlsx 将日期序列号转 Date 对象时产生时区偏移
          // 详见：excelSerialToDate 使用纯 UTC 计算
          const workbook = XLSX.read(data, { type: 'array', cellDates: false })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet)
          resolve(jsonData)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  }

// 统一日期格式为 YYYY-MM-DD
const normalizeDate = (value: any): string => {
  if (!value) return ''
  
  // 如果是 JS Date 对象（cellDates: true 时 xlsx 会返回 Date）
  // 使用本地时间 getter 避免 toISOString() 的 UTC 时区偏移问题
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  
  // 如果是字符串
  if (typeof value === 'string') {
    // 已经是 YYYY-MM-DD 格式
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
    // 可能是 YYYY/M/D 格式（如 2026/4/14）
    if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(value)) {
      const [y, m, d] = value.split('/')
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    // 尝试解析为数字（Excel 序列号）
    const num = parseFloat(value)
    if (!isNaN(num)) return excelSerialToDate(num)
    return value
  }
  
  // 如果是数字（Excel 序列号）
  if (typeof value === 'number' && !isNaN(value)) {
    return excelSerialToDate(value)
  }
  
  return String(value)
}

// Excel 日期序列号转 YYYY-MM-DD
// 使用纯 UTC 计算避免本地时区偏移（1899年时区偏移与现在不同）
// 46113 -> 2026-04-01, 46114 -> 2026-04-02, ...
const excelSerialToDate = (serial: number): string => {
  // Date.UTC(1899, 11, 30) = Excel 序列号 0 的 UTC 基准
  // 序列号 1 = 1899-12-31 UTC（Excel 的 1900-01-01，因 Lotus 1-2-3 闰年 bug 有 1 天偏移）
  const utcDate = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
  const y = utcDate.getUTCFullYear()
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utcDate.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 解析订单数据
// 字段：日期、店铺、订单、SKU、SPU、销售等级、数量、销售额、成本、佣金、仓库
const parseOrdersFromExcel = (rows: any[]): Order[] => {
  if (rows.length > 0) {
    console.log('【订单Excel列名】:', Object.keys(rows[0]))
  }

  return rows.map((row, index) => {
    // 尝试多种可能的列名格式
      const dateValue = row['日期'] || row['date'] || row['Date'] || ''
      const date = normalizeDate(dateValue)
    const shop = row['店铺'] || row['shop'] || row['Shop'] || ''
      const orderId = row['订单号'] || row['订单'] || row['orderId'] || row['Order ID'] || ''
      const sku = row['SKU'] || row['sku'] || ''
      const spu = row['SPU'] || row['spu'] || sku
      const salesGrade = row['销售等级'] || row['salesGrade'] || row['Grade'] || ''
      const quantity = Number(row['数量'] || row['quantity'] || row['Quantity'] || 0)
      const sales = Number(row['销售额'] || row['salesAmount'] || row['Sales'] || row['销售额(USD)'] || 0)
      const cost = Number(row['成本'] || row['cost'] || row['Cost'] || 0)
      const commission = Number(row['佣金'] || row['commission'] || row['Commission'] || 0)
      const warehouse = row['仓库'] || row['warehouse'] || row['Warehouse'] || ''

      return {
        id: `${Date.now()}-${index}`,
        date,
        shop,
        orderId: String(orderId),
        sku: String(sku),
        spu: String(spu),
        salesGrade,
        quantity,
        sales,
        cost,
        commission,
        warehouse
      }
    }).filter(order => order.sku && (order.sales !== 0 || order.cost !== 0))
  }

  // 解析广告数据
  const parseAdFromExcel = (rows: any[]): AdData[] => {
    if (rows.length > 0) {
      console.log('【广告Excel列名】:', Object.keys(rows[0]))
    }

    return rows.map((row, index) => {
      const dateValue = row['日期'] || row['date'] || row['Date'] || ''
      const shop = row['店铺'] || row['shop'] || row['Shop'] || ''
      const spu = row['SPU'] || row['spu'] || row['Spu'] || ''
      const adSpend = Number(
        row['广告花费'] || row['adSpend'] || row['Ad Spend'] || 0
      )
      
      // 转换日期格式
      const date = normalizeDate(dateValue)

      return { id: `${Date.now()}-ad-${index}`, date, shop, spu, adSpend }
    }).filter(ad => ad.date && ad.spu && (ad.adSpend > 0 || ad.adSpend === 0))
  }

  const handleOrderImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      // 1. 先解析本地文件（用于更新本地 store）
      const rows = await parseExcelFile(file)
      const data = parseOrdersFromExcel(rows)

      console.log('【订单导入】共', data.length, '条')
      console.log('【第一条订单】', data[0])

      // 2. 上传到后端（实现数据共享）
      try {
        const result = await importOrdersFile(file)
        console.log('【后端导入结果】', result)
      } catch (apiError) {
        console.warn('【后端上传失败，但本地数据已保存】', apiError)
        alert('⚠️ 后端上传失败，数据仅保存在本地浏览器，刷新后会丢失！\n\n错误: ' + (apiError as Error).message)
      }

      // 3. 更新本地 store
      onImportOrders?.(data)

      setOrderImportStatus('success')
      setTimeout(() => setOrderImportStatus('idle'), 3000)
    } catch {
      setOrderImportStatus('error')
      setTimeout(() => setOrderImportStatus('idle'), 3000)
    }

    e.target.value = ''
  }

  const handleAdImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      // 1. 先解析本地文件（用于更新本地 store）
      const rows = await parseExcelFile(file)
      const data = parseAdFromExcel(rows)

      console.log('【广告导入】共', data.length, '条')
      console.log('【第一条广告】', data[0])

      // 2. 上传到后端（实现数据共享）
      try {
        const result = await importAdsFile(file)
        console.log('【后端导入结果】', result)
      } catch (apiError) {
        console.warn('【后端上传失败，但本地数据已保存】', apiError)
        alert('⚠️ 后端上传失败，数据仅保存在本地浏览器，刷新后会丢失！\n\n错误: ' + (apiError as Error).message)
      }

      // 3. 更新本地 store
      onImportAdData?.(data)

      setAdImportStatus('success')
      setTimeout(() => setAdImportStatus('idle'), 3000)
    } catch {
      setAdImportStatus('error')
      setTimeout(() => setAdImportStatus('idle'), 3000)
    }

    e.target.value = ''
  }

  const handleClearOrders = () => {
    saveToStorage(STORAGE_KEYS.orders, [])
    onClearOrders?.()
    clearAllData().catch(() => {})
  }

  const handleClearAdData = () => {
    saveToStorage(STORAGE_KEYS.adData, [])
    onClearAdData?.()
    clearAllData().catch(() => {})
  }

  const getStatusBadge = (status: 'idle' | 'success' | 'error') => {
    switch (status) {
      case 'success':
        return <Badge variant="success" className="ml-2"><CheckCircle2 className="w-3 h-3 mr-1" /> 导入成功</Badge>
      case 'error':
        return <Badge variant="destructive" className="ml-2"><AlertCircle className="w-3 h-3 mr-1" /> 导入失败</Badge>
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">数据导入</h1>
        <p className="text-gray-500 mt-1">导入每日订单数据和广告数据</p>
      </div>

      {/* 导入说明 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">导入模式说明：</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>增量导入：</strong>直接导入新数据，系统将自动叠加</li>
                <li><strong>全量替换：</strong>先点击「清空」按钮，再导入新数据</li>
              </ul>
              <p className="mt-2 text-blue-700">
                💡 基础数据（店铺费率、SKU运费、退款率、SKU信息）请在「系统设置」页面配置
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 每日订单导入 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              每日订单导入
              {getStatusBadge(orderImportStatus)}
            </CardTitle>
            <CardDescription>
              导入每日订单数据，用于计算销售额和毛利
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-500">
              当前数据：<span className="font-medium text-gray-900">{orders.length}</span> 条
            </div>

            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-2">点击选择文件</p>
              <Button variant="outline" size="sm" asChild>
                <label>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  选择Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleOrderImport}
                  />
                </label>
              </Button>
            </div>

            <Separator />

            <Button
              variant="outline"
              className="w-full border-red-200 text-red-600 hover:bg-red-50"
              onClick={handleClearOrders}
              disabled={orders.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              清空订单数据
            </Button>

            <div className="text-xs text-gray-400 pt-2 border-t">
              <p className="font-medium mb-1">字段说明：</p>
              <p>日期 / 店铺 / 订单号 / SKU / SPU / 销售等级 / 数量 / 销售额 / 成本 / 佣金 / 仓库</p>
            </div>
          </CardContent>
        </Card>

        {/* 每日广告导入 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-green-600" />
              每日广告导入
              {getStatusBadge(adImportStatus)}
            </CardTitle>
            <CardDescription>
              导入每日广告花费数据，用于计算ACoS和ROAS
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-500">
              当前数据：<span className="font-medium text-gray-900">{adData.length}</span> 条
            </div>

            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-2">点击选择文件</p>
              <Button variant="outline" size="sm" asChild>
                <label>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  选择Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleAdImport}
                  />
                </label>
              </Button>
            </div>

            <Separator />

            <Button
              variant="outline"
              className="w-full border-red-200 text-red-600 hover:bg-red-50"
              onClick={handleClearAdData}
              disabled={adData.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              清空广告数据
            </Button>

            <div className="text-xs text-gray-400 pt-2 border-t">
              <p className="font-medium mb-1">字段说明：</p>
              <p>日期 / 店铺 / SPU / 广告花费</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 三级毛利计算说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            三级毛利计算说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>三级毛利 = 销售额 - 成本 - 佣金 - 广告费 - 退货费 - 运费 - 仓储费 - DSP费 - 退货运费</strong></p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-500 mt-3">
              <div>• 销售额：订单表按SPU求和</div>
              <div>• 成本：订单表按SPU求和</div>
              <div>• 佣金：订单表按SPU求和</div>
              <div>• 广告费：广告表按SPU求和</div>
              <div>• 退货费：销售额 × SKU退款率</div>
              <div>• 运费：按仓库类型匹配 × 数量</div>
              <div>• 仓储费：销售额 × 仓储费率</div>
              <div>• DSP费：销售额 × DSP费率</div>
              <div>• 退货运费：销售额 × 退货运费率</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
