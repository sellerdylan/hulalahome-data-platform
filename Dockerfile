# Python 3.11 镜像
FROM python:3.11-slim

WORKDIR /app

# Railway Root Directory 为空，构建上下文是整个项目
# 复制后端代码和依赖
COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ ./server/

# 切换到 server 目录运行
WORKDIR /app/server

# Railway 自动设置 PORT 环境变量
ENV PORT=8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
