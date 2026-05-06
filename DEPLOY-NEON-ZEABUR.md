# HULALAHOME 数据运营中台 - Zeabur + Neon 部署指南

## 部署架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   用户浏览器    │────▶│   Zeabur 前端   │────▶│   Zeabur 后端   │
│                 │     │   (Vercel 类)   │     │   (FastAPI)     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────┐
                                              │  Neon PostgreSQL│
                                              │    (3GB 免费)   │
                                              └─────────────────┘
```

## 第一步：创建 Neon PostgreSQL 数据库

### 1.1 注册 Neon 账号
访问：https://console.neon.tech/signup

### 1.2 创建项目
1. 点击 "New Project"
2. 项目名称：`hulalahome-data`
3. 区域：选择离用户最近的区域（如 `US East`）
4. 创建后会获得连接字符串

### 1.3 获取连接字符串
格式：`postgresql://用户名:密码@ep-xxx-xxx-xxx.xxx.xxx.aws.neon.tech/neondb?sslmode=require`

## 第二步：部署 Zeabur 后端

### 2.1 注册 Zeabur
访问：https://zeabur.com

### 2.2 连接 GitHub
1. 登录 Zeabur
2. 进入 "Templates" 或 "Deploy from GitHub"
3. 授权 GitHub 访问

### 2.3 部署后端服务
1. 点击 "New Service" → "Deploy from GitHub"
2. 选择 `hulalahome-data-platform` 仓库
3. 选择 `server` 目录
4. 添加环境变量：
   - `DATABASE_URL`: 你的 Neon 连接字符串
   - `PORT`: `8000`
5. 部署

### 2.4 获取后端 URL
部署成功后，Zeabur 会分配一个 URL，如：`https://hulalahome-backend.zeabur.app`

## 第三步：配置前端环境变量

在 `src/services/backendApi.ts` 或 Vercel/Zeabur 前端配置中设置：

```typescript
// 生产环境 API 地址
const API_BASE_URL = 'https://hulalahome-backend.zeabur.app'
```

## 第四步：部署前端

### 方案 A：Zeabur 前端（推荐）
1. 在 Zeabur 添加新服务
2. 选择 `src` 目录（或整个项目）
3. 构建命令：`npm install && npm run build`
4. 输出目录：`dist`

### 方案 B：Vercel（保持现有）
1. 确保 `vercel.json` 配置正确
2. 在 Vercel 环境变量中设置：
   - `VITE_API_URL`: `https://hulalahome-backend.zeabur.app`

## 环境变量汇总

### 后端 (Zeabur Backend)
| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `postgresql://...` | Neon 连接字符串 |
| `PORT` | `8000` | 服务端口 |

### 前端
| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_API_URL` | `https://hulalahome-backend.zeabur.app` | 后端 API 地址 |

## 本地测试

### 本地连接 Neon
```bash
# 设置环境变量
export DATABASE_URL="postgresql://neondb_owner:xxx@ep-xxx-xxx-xxx.xxx.xxx.aws.neon.tech/neondb?sslmode=require"

# 启动后端
cd server
python3 main.py
```

### 本地测试前端
```bash
# 设置环境变量
export VITE_API_URL="http://localhost:8000"

# 启动前端
npm run dev
```

## 团队协作

Neon 免费版支持：
- ✅ 无限团队成员
- ✅ 数据库分支（Branching）
- ✅ 自动扩展

### 添加团队成员
1. 在 Neon Dashboard → Settings → Team
2. 邀请成员（邮箱或 GitHub）

### 数据安全
- ✅ SSL 连接（`sslmode=require`）
- ✅ SOC2 合规

## 故障排查

### 连接失败
1. 检查 Neon 连接字符串是否正确
2. 确认 SSL 模式为 `require`
3. 检查 Neon Dashboard 的使用量

### 部署失败
1. 检查 Zeabur 日志
2. 确认 `requirements.txt` 包含所有依赖
3. 确认 `main.py` 路径正确

## 在线地址（部署后填写）

| 服务 | URL |
|------|-----|
| 前端 | 待填写 |
| 后端 | 待填写 |
| API 文档 | 待填写/api/docs |

## 回退方法

如需回退到本地确认版本：
```bash
cd /Users/dylan/WorkBuddy/20260415095223
rm -rf hulalahome-data-platform
cp -r backups/hulalahome-data-platform-FINAL-BACKUP hulalahome-data-platform
```
