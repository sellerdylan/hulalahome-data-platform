# Python 3.11 slim 镜像
FROM python:3.11-slim

WORKDIR /app

# 复制 requirements 并安装依赖（利用 Docker 缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# Railway 会自动设置 PORT 环境变量
# Railway 的 PORT 通常是 8000，但如果有冲突会自动调整
# 使用环境变量 PORT，确保 Railway 能正确路由流量
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
