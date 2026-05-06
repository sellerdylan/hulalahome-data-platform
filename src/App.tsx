import React, { useState, useEffect } from 'react'
import { Sidebar, Header } from '@/components/layout'
import { FilterPanel } from '@/components/filters'
import { DashboardPage, SpuDetailPage, DailyAnalysisPage, SettingsPage, ImportPage, TargetsPage } from '@/pages'
import { useFilterStore, useDataStore, useNavStore, useSystemStore, useTargetStore } from '@/store'
import type { Order, AdData } from '@/types'
import dayjs from 'dayjs'

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  // SPU 页面的 Header 右侧插槽（由 SpuDetailPage 管理）
  const [spuHeaderSlot, setSpuHeaderSlot] = useState<React.ReactNode>(null)
  // Dashboard 页面的 Header 右侧插槽（由 DashboardPage 管理）
  const [dashboardHeaderSlot, setDashboardHeaderSlot] = useState<React.ReactNode>(null)
  const { filters, setFilters } = useFilterStore()
  const { currentPage, setCurrentPage } = useNavStore()
  const { orders, adData, setOrders, setAdData, init: initDataStore } = useDataStore()
  const { skuBaseInfo, init: initSystemStore } = useSystemStore()
  const { init: initFilterStore } = useFilterStore()
  const { init: initTargetStore } = useTargetStore()

  // 初始化数据
  useEffect(() => {
    const init = async () => {
      try {
        console.log('[App] Initializing data from IndexedDB...')
        await initDataStore()
        const { orders, adData } = useDataStore.getState()
        console.log('[App] dataStore loaded - orders:', orders.length, ', adData:', adData.length)
        await initSystemStore()
        const { skuBaseInfo, shopRates } = useSystemStore.getState()
        console.log('[App] systemStore loaded - skuBaseInfo:', skuBaseInfo.length, ', shopRates:', shopRates.length)
        await initFilterStore()
        await initTargetStore()
        const { departmentTargets, operatorGroupTargets, operatorTargets } = useTargetStore.getState()
        console.log('[App] targetStore loaded - dept:', departmentTargets.length, ', group:', operatorGroupTargets.length, ', operator:', operatorTargets.length)
        console.log('[App] Data initialization complete')
        setIsInitialized(true)
      } catch (error) {
        console.error('[App] Initialization error:', error)
        // 即使出错也允许进入页面，避免一直卡在加载状态
        setIsInitialized(true)
      }
    }
    init()
  }, [])

  // 动态获取筛选选项（仅供其他页面的 FilterPanel 使用）
  const shops = [...new Set([
    ...orders.map(o => o.shop).filter((s): s is string => Boolean(s)),
    ...skuBaseInfo.map(s => s.shop).filter((s): s is string => Boolean(s))
  ])]
  
  const operatorGroups = [...new Set(
    skuBaseInfo.map(s => s.operatorGroup).filter((s): s is string => Boolean(s))
  )]
  
  const operators = [...new Set(
    skuBaseInfo.map(s => s.operator).filter((s): s is string => Boolean(s))
  )]

  const handleImportOrders = (data: Order[]) => {
    const currentOrders = useDataStore.getState().orders
    setOrders([...currentOrders, ...data])
  }

  const handleImportAdData = (data: AdData[]) => {
    const currentAdData = useDataStore.getState().adData
    const mergedData = [...currentAdData, ...data]
    setAdData(mergedData)
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard':
        return { title: '数据看板', subtitle: 'HULALAHOME 运营数据总览' }
      case 'spu':
        return { title: 'SPU 分析', subtitle: '按 SPU 维度查看详细数据' }
      case 'analysis':
        return { title: '每日问题分析', subtitle: `${dayjs().format('YYYY-MM-DD')} 数据分析与待办事项` }
      case 'import':
        return { title: '数据导入', subtitle: '导入订单、广告数据' }
      case 'targets':
        return { title: '目标设置', subtitle: '设置整体 / 运营组 / 运营三级月度目标' }
      case 'settings':
        return { title: '系统设置', subtitle: '配置店铺费率、运费、退款率、SKU信息' }
      default:
        return { title: '', subtitle: '' }
    }
  }

  const pageInfo = getPageTitle()

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载数据...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={sidebarCollapsed ? 'ml-16' : 'ml-56'}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        lastUpdate={dayjs().format('YYYY-MM-DD HH:mm')}
        onRefresh={handleRefresh}
      />

      <div className="min-h-screen bg-gray-50">
        <Header
          title={pageInfo?.title || ''}
          subtitle={pageInfo?.subtitle || ''}
          rightSlot={
            currentPage === 'spu' ? spuHeaderSlot
            : currentPage === 'dashboard' ? dashboardHeaderSlot
            : undefined
          }
        />

        <main className="p-6">
          {/* SPU 和 Dashboard 页面自己管理筛选，不渲染全局 FilterPanel */}
          {currentPage !== 'settings' && currentPage !== 'import' && currentPage !== 'targets' && currentPage !== 'spu' && currentPage !== 'dashboard' && (
            <div className="mb-6">
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                shops={shops}
                operatorGroups={operatorGroups}
                operators={operators}
              />
            </div>
          )}

          {currentPage === 'dashboard' && (
            <DashboardPage onHeaderSlotChange={setDashboardHeaderSlot} />
          )}

          {currentPage === 'spu' && (
            <SpuDetailPage onHeaderSlotChange={setSpuHeaderSlot} />
          )}

          {currentPage === 'analysis' && <DailyAnalysisPage />}

          {currentPage === 'settings' && <SettingsPage />}

          {currentPage === 'targets' && <TargetsPage />}

          {currentPage === 'import' && (
            <ImportPage
              orders={orders}
              adData={adData}
              onImportOrders={handleImportOrders}
              onImportAdData={handleImportAdData}
              onClearOrders={() => useDataStore.getState().clearOrders()}
              onClearAdData={() => useDataStore.getState().clearAdData()}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
