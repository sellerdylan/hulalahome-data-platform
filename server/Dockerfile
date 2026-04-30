# Python 3.11 镜像
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# Railway 的 Root Directory 设置为 server
# 所以构建上下文是项目根目录
# 需要复制 server/ 目录下的内容到 /app

# 先复制 requirements.txt
COPY server/requirements.txt .

# 安装依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码（models, routers, services, main.py, database.py）
COPY server/ ./server/

# 切换到 server 目录运行（因为代码结构如此）
WORKDIR /app/server

# Railway 自动设置 PORT 环境变量
ENV PORT=8000

# 启动 uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
