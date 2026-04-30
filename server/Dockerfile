# Python 3.11 slim 镜像
FROM python:3.11-slim

WORKDIR /app

# 先复制 requirements 并安装依赖（利用缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# Railway 需要监听 PORT 环境变量
ENV PORT=8000
ENV HOST=0.0.0.0

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
