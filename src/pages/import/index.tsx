import React, { useState, useEffect } from 'react'
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
  RefreshCw,
} from 'lucide-react'
import { importOrdersFile, importAdsFile, getStatsOverview } from '@/services/backendApi'

interface ImportPageProps {
  onDataChange?: () => void
}

interface Stats {
  orderCount: number
  adCount: number
}

export function ImportPage({ onDataChange }: ImportPageProps) {
  const [stats, setStats] = useState<Stats>({ orderCount: 0, adCount: 0 })
  const [orderImportStatus, setOrderImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [adImportStatus, setAdImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // 加载统计数据
  const loadStats = async () => {
    try {
      const data = await getStatsOverview()
      setStats({ orderCount: data.order_count, adCount: data.ad_count })
    } catch (e) {
      console.error('Failed to load stats:', e)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  // 解析Excel文件
  const parseExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          // 动态导入 xlsx
          import('xlsx').then(XLSX => {
            const workbook = XLSX.read(data, { type: 'array', cellDates: true })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet)
            resolve(jsonData)
          }).catch(reject)
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
    
    // 如果是 JS Date 对象（xlsx 用 cellDates: true 时会返回 Date）
    if (value instanceof Date) {
      return value.toISOString().split('T')[0]
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
  const excelSerialToDate = (serial: number): string => {
    const msPerDay = 24 * 60 * 60 * 1000
    const excelEpoch = new Date(1899, 11, 31).getTime()
    const d = new Date(excelEpoch + serial * msPerDay)
    return d.toISOString().split('T')[0]
  }

  const handleOrderImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setOrderImportStatus('loading')
    setErrorMessage('')

    try {
      // 直接上传文件到后端
      const result = await importOrdersFile(file)
      console.log('【订单导入】', result.message)
      
      setOrderImportStatus('success')
      await loadStats()
      onDataChange?.()
      
      setTimeout(() => setOrderImportStatus('idle'), 3000)
    } catch (err: any) {
      console.error('Order import failed:', err)
      setErrorMessage(err.message || '导入失败')
      setOrderImportStatus('error')
      setTimeout(() => setOrderImportStatus('idle'), 5000)
    }

    e.target.value = ''
  }

  const handleAdImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAdImportStatus('loading')
    setErrorMessage('')

    try {
      // 直接上传文件到后端
      const result = await importAdsFile(file)
      console.log('【广告导入】', result.message)
      
      setAdImportStatus('success')
      await loadStats()
      onDataChange?.()
      
      setTimeout(() => setAdImportStatus('idle'), 3000)
    } catch (err: any) {
      console.error('Ad import failed:', err)
      setErrorMessage(err.message || '导入失败')
      setAdImportStatus('error')
      setTimeout(() => setAdImportStatus('idle'), 5000)
    }

    e.target.value = ''
  }

  const getStatusBadge = (status: 'idle' | 'loading' | 'success' | 'error') => {
    switch (status) {
      case 'loading':
        return <Badge variant="outline" className="ml-2"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> 上传中...</Badge>
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
        <p className="text-gray-500 mt-1">导入每日订单数据和广告数据到服务器</p>
      </div>

      {/* 导入说明 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">重要说明：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>数据将直接上传到服务器，<strong>所有人共享同一份数据</strong></li>
                <li>系统采用增量导入，自动去重合并</li>
                <li>基础数据（店铺费率、SKU运费、退款率、SKU信息）请在「系统设置」页面配置</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {errorMessage && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3 text-red-800">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <p className="text-sm">{errorMessage}</p>
            </div>
          </CardContent>
        </Card>
      )}

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
              当前数据：<span className="font-medium text-gray-900">{stats.orderCount}</span> 条
            </div>

            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-2">点击选择文件</p>
              <Button variant="outline" size="sm" asChild disabled={orderImportStatus === 'loading'}>
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
              当前数据：<span className="font-medium text-gray-900">{stats.adCount}</span> 条
            </div>

            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-2">点击选择文件</p>
              <Button variant="outline" size="sm" asChild disabled={adImportStatus === 'loading'}>
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
