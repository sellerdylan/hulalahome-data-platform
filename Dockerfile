# Python 3.11 镜像
FROM python:3.11-slim

WORKDIR /app

# Railway 的 Root Directory = server
# 所以构建上下文是 server/ 目录
# Dockerfile 在根目录，但构建时从 server/ 开始

# 复制 requirements.txt（在 server/ 目录下）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . ./server/

# 切换到 server 目录运行
WORKDIR /app/server

# Railway 自动设置 PORT 环境变量
ENV PORT=8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
