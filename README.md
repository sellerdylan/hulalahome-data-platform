# HULALAHOME 数据运营中台

基于 React + TypeScript + Vite + Tailwind CSS + shadcn/ui 的网页版数据分析和看板系统。

## 项目结构

```
hulalahome-data-platform/
├── src/
│   ├── components/           # 公共组件
│   │   ├── ui/              # shadcn/ui 组件
│   │   ├── layout/           # 布局组件（侧边栏、头部等）
│   │   ├── charts/           # 图表组件
│   │   ├── filters/         # 筛选器组件
│   │   └── data/             # 数据展示组件
│   ├── pages/                # 页面
│   │   ├── dashboard/       # 数据看板
│   │   ├── spu/             # SPU维度分析
│   │   ├── analysis/        # 每日问题分析
│   │   └── settings/        # 设置页面
│   ├── hooks/                # 自定义 Hooks
│   ├── lib/                  # 工具函数
│   ├── types/                # TypeScript 类型定义
│   └── store/                # 状态管理
├── server/                   # Python FastAPI 后端
│   ├── main.py
│   ├── database.py
│   ├── models/
│   ├── routers/
│   └── services/
└── data/                     # 数据文件夹
    ├── orders/              # 每日订单数据
    ├── ads/                 # 广告数据
    └── base/                # 基础数据
```

## 功能模块

### 页面一：数据看板
- 月度目标进度（GMV + 三级毛利）
- S/A/B/C 销售等级分布
- 各运营 GMV 贡献排行
- GMV / 毛利达成率
- 三级毛利时间趋势
- 广告数据（ACoS / ROAS）
- 多维度筛选器

### 页面二：SPU维度详细分析
- SPU列表（可筛选 + 排序）
- 指标展示（GMV、毛利率、广告效率）
- KPI达标状态（红绿标注）
- 未达标原因分类
- 责任人归属
- 单SPU历史趋势

### 页面三：每日问题分析
- 今日数据摘要
- 异常指标预警
- 未达标SPU清单
- To-Do List 生成

### 全局参数配置
- 店铺维度参数管理
- KPI目标设置

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS + shadcn/ui
- **图表**: ECharts + Recharts
- **状态管理**: Zustand
- **后端**: Python FastAPI
- **数据库**: SQLite
- **图表库**: ECharts (echarts-for-react)

## 开发指南

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

## 数据结构

### 每日导入数据

**订单数据字段：**
- 日期、店铺、订单号、SKU、数量、销售额、成本、仓库

**广告数据字段：**
- 日期、店铺、SPU、广告花费

### 基础数据字段

**SKU基础信息：**
- 店铺、SKU、ASIN、SPU、生命周期、销售等级、品类、产品定级、运营、运营组、退款率、运费

**店铺全局参数：**
- 店铺、退款率、DSP费率、退货运费率、仓储费率

### 三级毛利计算

```
三级毛利额 = 销售额 - 佣金 - 广告费 - 退货费 - 运费 - 仓储费 - DSP费 - 退货运费
三级毛利率 = 三级毛利额 / 销售额
```

## 版本历史

- v0.1.0 (2026-04-15): 项目初始化
