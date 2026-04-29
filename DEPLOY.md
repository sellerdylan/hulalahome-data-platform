# HULALAHOME 数据运营中台 - 在线部署指南

> 本系统使用 **Vercel（前端）** + **Railway（后端）** 免费部署方案，运营人员通过浏览器实时查看数据。

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    运营人员浏览器                              │
│          https://hulalahome.vercel.app                       │
│                   （只读查看）                                 │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────────────┐
│                    Railway                                   │
│            FastAPI 后端 (端口 8000)                          │
│            + SQLite 数据库（持久化）                          │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ 管理员   │  │ Excel    │  │  销售    │                   │
│  │ (导入)   │→ │ 上传     │→ │  数据    │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 第一步：部署后端（Railway）

### 1.1 创建 Railway 账号

1. 访问 [railway.app](https://railway.app)
2. 使用 GitHub 账号登录
3. 进入 Dashboard

### 1.2 部署后端服务

1. 点击 **New Project** → **Deploy from GitHub repo**
2. 选择你的仓库（需要先把代码推送到 GitHub）
3. Railway 会自动检测到 Python/FastAPI
4. 等待部署完成

### 1.3 配置环境变量

在 Railway 项目设置中添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `PORT` | `8000` | Railway 会自动设置 |

### 1.4 获取后端地址

部署成功后，在 **Deployments** 页面找到你的服务地址，格式类似：

```
https://hulalahome-api.up.railway.app
```

**记录这个地址，后面会用到。**

### 1.5 初始化数据库

部署后首次访问以下地址初始化数据库表：

```
https://hulalahome-api.up.railway.app/
```

返回 `{"message": "HULALAHOME 数据运营中台 API", ...}` 即表示成功。

---

## 第二步：部署前端（Vercel）

### 2.1 创建 Vercel 账号

1. 访问 [vercel.com](https://vercel.com)
2. 使用 GitHub 账号登录

### 2.2 部署前端

1. 点击 **New Project** → **Import Git Repository**
2. 选择你的仓库
3. 在 **Environment Variables** 中添加：

| 变量名 | 值（示例） |
|--------|-----------|
| `VITE_API_URL` | `https://hulalahome-api.up.railway.app` |

> ⚠️ 把 `hulalahome-api.up.railcel.app` 替换成你实际的 Railway 后端地址

4. 点击 **Deploy**

### 2.3 访问系统

部署成功后，Vercel 会给你一个地址，例如：

```
https://hulalahome.vercel.app
```

这就是运营人员访问的地址。

---

## 第三步：数据导入（管理员）

### 3.1 登录管理

在浏览器打开前端地址，进入 **数据导入** 页面。

### 3.2 导入顺序

按以下顺序导入数据（数据有依赖关系）：

```
1. 店铺信息（店铺名称、退款率、DSP费率等）
      ↓
2. SKU基础信息（SKU、SPU、运营、运营组、品类、退款率、运费等）
      ↓
3. 仓库运费配置（可选，有运费档位才需要）
      ↓
4. 订单数据（日期、订单号、SKU、销售额、成本、佣金等）
      ↓
5. 广告数据（日期、SPU、广告花费等）
      ↓
6. 目标设置（整体目标 / 运营组目标 / 运营目标）
```

### 3.3 Excel 模板

各数据导入按钮旁边有 **下载模板** 选项，点击获取标准 Excel 模板。

---

## 第四步：让运营人员访问

### 4.1 分享地址

直接分享 Vercel 给你的前端地址：

```
https://hulalahome.vercel.app
```

### 4.2 权限说明

- **运营人员**：只读访问看板、SPU分析、每日问题分析页面
- **管理员**：可以访问数据导入页面进行数据更新

> 当前版本所有访问者权限相同。如需区分管理员/运营者权限，后续可添加登录认证功能。

---

## 第五步：自定义域名（可选）

### 5.1 Vercel 自定义域名

1. 在 Vercel 项目 → **Settings** → **Domains**
2. 添加你的域名（如 `data.hulalahome.com`）
3. 按提示添加 DNS 记录

### 5.2 更新前端 API 地址

如果前端 API 地址变了，更新 Railway 后端的 CORS 配置，然后重新部署前端。

---

## 维护指南

### 更新数据

管理员登录后，进入 **数据导入** 页面重新上传 Excel 文件即可。

**增量导入**：系统会自动去重合并，不需要删除旧数据。

### 更新代码

1. 修改代码并推送到 GitHub
2. Railway/Vercel 会自动检测并重新部署

### 数据备份

Railway 免费版数据库在重启后会清空。建议：

1. **重要**：定期在本地保存 Excel 原始文件
2. 或者升级到 Railway Pro（$5/月，有持久化存储）

---

## 常见问题

### Q: 部署后数据丢失？

Railway 免费版实例在闲置后会休眠，数据可能丢失。建议：
- 保持 Railway 实例活跃（定期访问 API）
- 或升级到付费版

### Q: 运营人员能看到我的原始数据吗？

能看到的是加工后的分析数据（销售额、毛利等），不是原始 Excel 文件。

### Q: 能支持多少人同时访问？

免费版 Vercel 支持 100 人并发，Railway 支持 512MB 内存。正常运营使用完全够用。

---

## GitHub 仓库准备

如果还没有把代码放到 GitHub：

```bash
cd /Users/dylan/WorkBuddy/20260415095223/hulalahome-data-platform

# 初始化 Git（如果还没有）
git init
git add .
git commit -m "Initial commit: HULALAHOME data platform"

# 创建 GitHub 仓库后
git remote add origin https://github.com/YOUR_USERNAME/hulalahome-data-platform.git
git push -u origin main
```

---

## 快速检查清单

- [ ] 代码推送到 GitHub
- [ ] Railway 部署后端成功
- [ ] Railway 后端地址已获取
- [ ] Vercel 部署前端，VITE_API_URL 设置正确
- [ ] 数据导入完成
- [ ] 分享前端地址给运营人员
