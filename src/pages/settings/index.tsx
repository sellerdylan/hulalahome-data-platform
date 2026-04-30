import React, { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { 
  Building2,      // 店铺费率
  Truck,          // 运费
  Percent,        // 退款率
  Package,        // SKU信息
  Upload,
  Trash2,
  Plus,
  Save,
  AlertCircle,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useSystemStore } from '@/store'
import type { ShopRate, SkuFreight, SkuRefundRate, SkuBaseInfo } from '@/types'
import { importShopsFile, importSkuBaseFile, importWarehouseFreightFile } from '@/services/backendApi'

// 生成唯一ID
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
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

export function SettingsPage() {
  const {
    shopRates, setShopRates, clearShopRates,
    skuFreights, setSkuFreights, clearSkuFreights,
    skuRefundRates, setSkuRefundRates, clearSkuRefundRates,
    skuBaseInfo, setSkuBaseInfo, clearSkuBaseInfo,
  } = useSystemStore()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">系统设置</h1>
      </div>

      <Tabs defaultValue="shop-rates" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="shop-rates" title="店铺费率">
            <Building2 className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="freight" title="SKU运费">
            <Truck className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="refund-rate" title="SKU退款率">
            <Percent className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="sku-info" title="SKU信息">
            <Package className="w-4 h-4" />
          </TabsTrigger>
        </TabsList>

        {/* ========== 1. 店铺费率设置 ========== */}
        <TabsContent value="shop-rates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                店铺费率设置
              </CardTitle>
              <CardDescription>
                设置各店铺的DSP费率、退货运费率、仓储费率（均为百分比）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 操作按钮 */}
              <div className="flex gap-2">
                <ImportShopRatesButton onImport={setShopRates} />
                <Button variant="outline" onClick={() => {
                  const newRate: ShopRate = {
                    id: generateId(),
                    shop: '',
                    dspRate: 0,
                    refundFreightRate: 0,
                    storageRate: 0,
                  }
                  setShopRates([...shopRates, newRate])
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加店铺
                </Button>
                {shopRates.length > 0 && (
                  <Button variant="destructive" onClick={clearShopRates}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    清除全部
                  </Button>
                )}
              </div>

              {/* 数据表格 */}
              {shopRates.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">店铺</th>
                        <th className="px-4 py-3 text-left font-medium">DSP费率 (%)</th>
                        <th className="px-4 py-3 text-left font-medium">退货运费率 (%)</th>
                        <th className="px-4 py-3 text-left font-medium">仓储费率 (%)</th>
                        <th className="px-4 py-3 text-right font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {shopRates.map((rate) => (
                        <tr key={rate.id}>
                          <td className="px-4 py-2">
                            <Input
                              value={rate.shop}
                              onChange={(e) => {
                                const updated = shopRates.map(r => 
                                  r.id === rate.id ? { ...r, shop: e.target.value } : r
                                )
                                setShopRates(updated)
                              }}
                              placeholder="店铺名称"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              value={rate.dspRate}
                              onChange={(e) => {
                                const updated = shopRates.map(r => 
                                  r.id === rate.id ? { ...r, dspRate: parseFloat(e.target.value) || 0 } : r
                                )
                                setShopRates(updated)
                              }}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              value={rate.refundFreightRate}
                              onChange={(e) => {
                                const updated = shopRates.map(r => 
                                  r.id === rate.id ? { ...r, refundFreightRate: parseFloat(e.target.value) || 0 } : r
                                )
                                setShopRates(updated)
                              }}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              value={rate.storageRate}
                              onChange={(e) => {
                                const updated = shopRates.map(r => 
                                  r.id === rate.id ? { ...r, storageRate: parseFloat(e.target.value) || 0 } : r
                                )
                                setShopRates(updated)
                              }}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShopRates(shopRates.filter(r => r.id !== rate.id))}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>暂无数据</p>
                  <p className="text-sm text-gray-400 mt-1">请导入或添加店铺费率数据</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== 2. SKU运费设置 ========== */}
        <TabsContent value="freight" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                SKU运费设置
              </CardTitle>
              <CardDescription>
                设置各SKU的CG运费、3PL运费、自运费（均为单个单位运费）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 操作按钮 */}
              <div className="flex gap-2">
                <ImportSkuFreightButton onImport={setSkuFreights} />
                <Button variant="outline" onClick={() => {
                  const newFreight: SkuFreight = {
                    id: generateId(),
                    sku: '',
                    cgFreight: 0,
                    plFreight: 0,
                    selfFreight: 0,
                  }
                  setSkuFreights([...skuFreights, newFreight])
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加SKU
                </Button>
                {skuFreights.length > 0 && (
                  <Button variant="destructive" onClick={clearSkuFreights}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    清除全部
                  </Button>
                )}
              </div>

              {/* 数据统计 */}
              <div className="flex gap-4 text-sm text-gray-500">
                <span>共 {skuFreights.length} 条SKU运费数据</span>
              </div>

              {/* 数据表格 */}
              {skuFreights.length > 0 ? (
                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">SKU</th>
                        <th className="px-4 py-3 text-left font-medium">CG运费 ($)</th>
                        <th className="px-4 py-3 text-left font-medium">3PL运费 ($)</th>
                        <th className="px-4 py-3 text-left font-medium">自运费 ($)</th>
                        <th className="px-4 py-3 text-right font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {skuFreights.map((freight) => (
                        <tr key={freight.id}>
                          <td className="px-4 py-2">
                            <Input
                              value={freight.sku}
                              onChange={(e) => {
                                const updated = skuFreights.map(f => 
                                  f.id === freight.id ? { ...f, sku: e.target.value } : f
                                )
                                setSkuFreights(updated)
                              }}
                              placeholder="SKU编码"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              value={freight.cgFreight}
                              onChange={(e) => {
                                const updated = skuFreights.map(f => 
                                  f.id === freight.id ? { ...f, cgFreight: parseFloat(e.target.value) || 0 } : f
                                )
                                setSkuFreights(updated)
                              }}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              value={freight.plFreight}
                              onChange={(e) => {
                                const updated = skuFreights.map(f => 
                                  f.id === freight.id ? { ...f, plFreight: parseFloat(e.target.value) || 0 } : f
                                )
                                setSkuFreights(updated)
                              }}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              value={freight.selfFreight}
                              onChange={(e) => {
                                const updated = skuFreights.map(f => 
                                  f.id === freight.id ? { ...f, selfFreight: parseFloat(e.target.value) || 0 } : f
                                )
                                setSkuFreights(updated)
                              }}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSkuFreights(skuFreights.filter(f => f.id !== freight.id))}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>暂无数据</p>
                  <p className="text-sm text-gray-400 mt-1">请导入SKU运费数据</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== 3. SKU退款率设置 ========== */}
        <TabsContent value="refund-rate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="w-5 h-5" />
                SKU退款率设置
              </CardTitle>
              <CardDescription>
                设置各店铺下各SKU的退款率（分店铺导入）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 操作按钮 */}
              <div className="flex gap-2">
                <ImportSkuRefundRateButton onImport={setSkuRefundRates} />
                <Button variant="outline" onClick={() => {
                  const newRate: SkuRefundRate = {
                    id: generateId(),
                    shop: '',
                    sku: '',
                    refundRate: 0,
                  }
                  setSkuRefundRates([...skuRefundRates, newRate])
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加
                </Button>
                {skuRefundRates.length > 0 && (
                  <Button variant="destructive" onClick={clearSkuRefundRates}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    清除全部
                  </Button>
                )}
              </div>

              {/* 数据统计 */}
              <div className="flex gap-4 text-sm text-gray-500">
                <span>共 {skuRefundRates.length} 条退款率数据</span>
              </div>

              {/* 数据表格 */}
              {skuRefundRates.length > 0 ? (
                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">店铺</th>
                        <th className="px-4 py-3 text-left font-medium">SKU</th>
                        <th className="px-4 py-3 text-left font-medium">退款率 (%)</th>
                        <th className="px-4 py-3 text-right font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {skuRefundRates.map((rate) => (
                        <tr key={rate.id}>
                          <td className="px-4 py-2">
                            <Input
                              value={rate.shop}
                              onChange={(e) => {
                                const updated = skuRefundRates.map(r => 
                                  r.id === rate.id ? { ...r, shop: e.target.value } : r
                                )
                                setSkuRefundRates(updated)
                              }}
                              placeholder="店铺名称"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={rate.sku}
                              onChange={(e) => {
                                const updated = skuRefundRates.map(r => 
                                  r.id === rate.id ? { ...r, sku: e.target.value } : r
                                )
                                setSkuRefundRates(updated)
                              }}
                              placeholder="SKU编码"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              value={rate.refundRate}
                              onChange={(e) => {
                                const updated = skuRefundRates.map(r => 
                                  r.id === rate.id ? { ...r, refundRate: parseFloat(e.target.value) || 0 } : r
                                )
                                setSkuRefundRates(updated)
                              }}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSkuRefundRates(skuRefundRates.filter(r => r.id !== rate.id))}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>暂无数据</p>
                  <p className="text-sm text-gray-400 mt-1">请导入SKU退款率数据</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== 4. SKU基础信息设置 ========== */}
        <TabsContent value="sku-info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                SKU基础信息设置
              </CardTitle>
              <CardDescription>
                设置各店铺下各SKU的基础信息（分店铺导入）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 操作按钮 */}
              <div className="flex gap-2">
                <ImportSkuBaseInfoButton onImport={setSkuBaseInfo} />
                <Button variant="outline" onClick={() => {
                  const newInfo: SkuBaseInfo = {
                    id: generateId(),
                    shop: '',
                    sku: '',
                    spu: '',
                    lifecycle: '',
                    productLevel: '',
                    operator: '',
                    operatorGroup: '',
                  }
                  setSkuBaseInfo([...skuBaseInfo, newInfo])
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加
                </Button>
                {skuBaseInfo.length > 0 && (
                  <Button variant="destructive" onClick={clearSkuBaseInfo}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    清除全部
                  </Button>
                )}
              </div>

              {/* 数据统计 */}
              <div className="flex gap-4 text-sm text-gray-500">
                <span>共 {skuBaseInfo.length} 条SKU基础信息</span>
              </div>

              {/* 数据表格 */}
              {skuBaseInfo.length > 0 ? (
                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">店铺</th>
                        <th className="px-4 py-3 text-left font-medium">SKU</th>
                        <th className="px-4 py-3 text-left font-medium">SPU</th>
                        <th className="px-4 py-3 text-left font-medium">生命周期</th>
                        <th className="px-4 py-3 text-left font-medium">产品定级</th>
                        <th className="px-4 py-3 text-left font-medium">运营</th>
                        <th className="px-4 py-3 text-left font-medium">运营组</th>
                        <th className="px-4 py-3 text-right font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {skuBaseInfo.map((info) => (
                        <tr key={info.id}>
                          <td className="px-4 py-2">
                            <Input
                              value={info.shop}
                              onChange={(e) => {
                                const updated = skuBaseInfo.map(i => 
                                  i.id === info.id ? { ...i, shop: e.target.value } : i
                                )
                                setSkuBaseInfo(updated)
                              }}
                              placeholder="店铺"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={info.sku}
                              onChange={(e) => {
                                const updated = skuBaseInfo.map(i => 
                                  i.id === info.id ? { ...i, sku: e.target.value } : i
                                )
                                setSkuBaseInfo(updated)
                              }}
                              placeholder="SKU"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={info.spu}
                              onChange={(e) => {
                                const updated = skuBaseInfo.map(i => 
                                  i.id === info.id ? { ...i, spu: e.target.value } : i
                                )
                                setSkuBaseInfo(updated)
                              }}
                              placeholder="SPU"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={info.lifecycle}
                              onChange={(e) => {
                                const updated = skuBaseInfo.map(i => 
                                  i.id === info.id ? { ...i, lifecycle: e.target.value } : i
                                )
                                setSkuBaseInfo(updated)
                              }}
                              placeholder="生命周期"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={info.productLevel}
                              onChange={(e) => {
                                const updated = skuBaseInfo.map(i => 
                                  i.id === info.id ? { ...i, productLevel: e.target.value } : i
                                )
                                setSkuBaseInfo(updated)
                              }}
                              placeholder="产品定级"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={info.operator}
                              onChange={(e) => {
                                const updated = skuBaseInfo.map(i => 
                                  i.id === info.id ? { ...i, operator: e.target.value } : i
                                )
                                setSkuBaseInfo(updated)
                              }}
                              placeholder="运营"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={info.operatorGroup}
                              onChange={(e) => {
                                const updated = skuBaseInfo.map(i => 
                                  i.id === info.id ? { ...i, operatorGroup: e.target.value } : i
                                )
                                setSkuBaseInfo(updated)
                              }}
                              placeholder="运营组"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSkuBaseInfo(skuBaseInfo.filter(i => i.id !== info.id))}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>暂无数据</p>
                  <p className="text-sm text-gray-400 mt-1">请导入SKU基础信息数据</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================
// 导入按钮组件
// ============================================

// 店铺费率导入按钮（增量导入 + 去重合并 + 同步到后端）
function ImportShopRatesButton({ onImport }: { onImport: (data: ShopRate[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const rawData = await parseExcelFile<Record<string, unknown>>(file)
      const imported: ShopRate[] = rawData.map((row: Record<string, unknown>) => ({
        id: generateId(),
        shop: String(row['店铺'] || row['shop'] || ''),
        dspRate: parseFloat(String(row['DSP费率'] || row['dspRate'] || 0)) || 0,
        refundFreightRate: parseFloat(String(row['退货运费率'] || row['refundFreightRate'] || 0)) || 0,
        storageRate: parseFloat(String(row['仓储费率'] || row['storageRate'] || 0)) || 0,
      })).filter(r => r.shop)
      
      // 增量导入：使用 getState() 获取最新数据，避免闭包问题
      const { shopRates } = useSystemStore.getState()
      const existingMap = new Map<string, ShopRate>()
      shopRates.forEach(item => existingMap.set(item.shop, item))
      imported.forEach(item => existingMap.set(item.shop, item))
      const merged = Array.from(existingMap.values())
      
      onImport(merged)
      
      // 同步到后端（实现数据共享）
      try {
        await importShopsFile(file)
        console.log('【店铺费率】已同步到后端')
      } catch (apiError) {
        console.warn('【店铺费率】后端同步失败:', apiError)
      }
      
      alert(`成功导入 ${imported.length} 条店铺费率数据（共 ${merged.length} 条）`)
    } catch (err) {
      alert('导入失败：' + (err as Error).message)
    }
    
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        <Upload className="w-4 h-4 mr-2" />
        导入Excel
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImport}
      />
    </>
  )
}

// SKU运费导入按钮（增量导入 + 去重合并 + 同步到后端）
function ImportSkuFreightButton({ onImport }: { onImport: (data: SkuFreight[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const rawData = await parseExcelFile<Record<string, unknown>>(file)
      const imported: SkuFreight[] = rawData.map((row: Record<string, unknown>) => ({
        id: generateId(),
        sku: String(row['SKU'] || row['sku'] || ''),
        cgFreight: parseFloat(String(row['CG运费'] || row['cgFreight'] || row['运费'] || 0)) || 0,
        plFreight: parseFloat(String(row['3PL运费'] || row['plFreight'] || 0)) || 0,
        selfFreight: parseFloat(String(row['自运费'] || row['selfFreight'] || 0)) || 0,
      })).filter(r => r.sku)
      
      // 增量导入：使用 getState() 获取最新数据，避免闭包问题
      const { skuFreights } = useSystemStore.getState()
      const existingMap = new Map<string, SkuFreight>()
      skuFreights.forEach(item => existingMap.set(item.sku, item))
      imported.forEach(item => existingMap.set(item.sku, item))
      const merged = Array.from(existingMap.values())
      
      onImport(merged)
      
      // 同步到后端（实现数据共享）
      try {
        await importWarehouseFreightFile(file)
        console.log('【SKU运费】已同步到后端')
      } catch (apiError) {
        console.warn('【SKU运费】后端同步失败:', apiError)
      }
      
      alert(`成功导入 ${imported.length} 条SKU运费数据（共 ${merged.length} 条）`)
    } catch (err) {
      alert('导入失败：' + (err as Error).message)
    }
    
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        <Upload className="w-4 h-4 mr-2" />
        导入Excel
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImport}
      />
    </>
  )
}

// SKU退款率导入按钮（增量导入 + 去重合并 + 同步到后端）
// 注意：SKU退款率存储在 sku_base_info 表的 refund_rate 字段中
function ImportSkuRefundRateButton({ onImport }: { onImport: (data: SkuRefundRate[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const rawData = await parseExcelFile<Record<string, unknown>>(file)
      const imported: SkuRefundRate[] = rawData.map((row: Record<string, unknown>) => ({
        id: generateId(),
        shop: String(row['店铺'] || row['shop'] || ''),
        sku: String(row['SKU'] || row['sku'] || ''),
        refundRate: parseFloat(String(row['退款率'] || row['refundRate'] || 0)) || 0,
      })).filter(r => r.sku)
      
      // 增量导入：使用 getState() 获取最新数据，避免闭包问题
      const { skuRefundRates } = useSystemStore.getState()
      const existingMap = new Map<string, SkuRefundRate>()
      skuRefundRates.forEach(item => existingMap.set(`${item.shop}|${item.sku}`, item))
      imported.forEach(item => existingMap.set(`${item.shop}|${item.sku}`, item))
      const merged = Array.from(existingMap.values())
      
      onImport(merged)
      
      // SKU退款率需要通过 SKU 基础信息导入接口同步到后端
      // 因为后端 sku_base_info 表的 refund_rate 字段存储了退款率
      try {
        await importSkuBaseFile(file)
        console.log('【SKU退款率】已同步到后端（通过SKU基础信息接口）')
      } catch (apiError) {
        console.warn('【SKU退款率】后端同步失败:', apiError)
      }
      
      alert(`成功导入 ${imported.length} 条SKU退款率数据（共 ${merged.length} 条）`)
    } catch (err) {
      alert('导入失败：' + (err as Error).message)
    }
    
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        <Upload className="w-4 h-4 mr-2" />
        导入Excel
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImport}
      />
    </>
  )
}

// SKU基础信息导入按钮（增量导入 + 去重合并 + 同步到后端）
function ImportSkuBaseInfoButton({ onImport }: { onImport: (data: SkuBaseInfo[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const rawData = await parseExcelFile<Record<string, unknown>>(file)
      const imported: SkuBaseInfo[] = rawData.map((row: Record<string, unknown>) => ({
        id: generateId(),
        shop: String(row['店铺'] || row['shop'] || ''),
        sku: String(row['SKU'] || row['sku'] || ''),
        spu: String(row['SPU'] || row['spu'] || ''),
        lifecycle: String(row['生命周期'] || row['lifecycle'] || ''),
        productLevel: String(row['产品定级'] || row['productLevel'] || ''),
        operator: String(row['运营'] || row['operator'] || ''),
        operatorGroup: String(row['运营组'] || row['operatorGroup'] || ''),
      })).filter(r => r.sku)
      
      // 增量导入：使用 getState() 获取最新数据，避免闭包问题
      const { skuBaseInfo } = useSystemStore.getState()
      const existingMap = new Map<string, SkuBaseInfo>()
      skuBaseInfo.forEach(item => {
        existingMap.set(`${item.shop}|${item.sku}`, item)
      })
      imported.forEach(item => {
        existingMap.set(`${item.shop}|${item.sku}`, item)
      })
      const merged = Array.from(existingMap.values())
      
      onImport(merged)
      
      // 同步到后端（实现数据共享）
      try {
        await importSkuBaseFile(file)
        console.log('【SKU基础信息】已同步到后端')
      } catch (apiError) {
        console.warn('【SKU基础信息】后端同步失败:', apiError)
      }
      
      alert(`成功导入 ${imported.length} 条SKU基础信息（共 ${merged.length} 条，去重后）`)
    } catch (err) {
      alert('导入失败：' + (err as Error).message)
    }
    
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        <Upload className="w-4 h-4 mr-2" />
        导入Excel
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImport}
      />
    </>
  )
}
