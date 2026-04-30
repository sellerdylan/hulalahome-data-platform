# Python 3.11 镜像
FROM python:3.11-slim

WORKDIR /app

# Railway 的 Root Directory 设置为 server
# 但 Dockerfile 在根目录，需要复制 server 目录的内容
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY server/ ./server/

# 切换到 server 目录运行
WORKDIR /app/server

# Railway 自动设置 PORT 环境变量
ENV PORT=8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
