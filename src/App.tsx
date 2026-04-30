import React, { useState, useEffect } from 'react'
import { Sidebar, Header } from '@/components/layout'
import { DashboardPage, SpuDetailPage, DailyAnalysisPage, SettingsPage, ImportPage, TargetsPage } from '@/pages'
import { useNavStore } from '@/store'
import dayjs from 'dayjs'

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  // SPU 页面的 Header 右侧插槽（由 SpuDetailPage 管理）
  const [spuHeaderSlot, setSpuHeaderSlot] = useState<React.ReactNode>(null)
  // Dashboard 页面的 Header 右侧插槽（由 DashboardPage 管理）
  const [dashboardHeaderSlot, setDashboardHeaderSlot] = useState<React.ReactNode>(null)
  const { currentPage, setCurrentPage } = useNavStore()

  // 初始化（简化版，不再需要预加载数据）
  useEffect(() => {
    setIsInitialized(true)
  }, [])

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
        return { title: '数据导入', subtitle: '导入订单、广告数据到服务器' }
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
          <p className="text-gray-600">正在加载...</p>
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
          {currentPage === 'dashboard' && (
            <DashboardPage onHeaderSlotChange={setDashboardHeaderSlot} />
          )}

          {currentPage === 'spu' && (
            <SpuDetailPage onHeaderSlotChange={setSpuHeaderSlot} />
          )}

          {currentPage === 'analysis' && <DailyAnalysisPage />}

          {currentPage === 'settings' && <SettingsPage />}

          {currentPage === 'targets' && <TargetsPage />}

          {currentPage === 'import' && <ImportPage />}
        </main>
      </div>
    </div>
  )
}

export default App
