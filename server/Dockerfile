# Python 3.11 slim 镜像
FROM python:3.11-slim

WORKDIR /app

# Railway 设置了 Root Directory = server
# 所以 COPY 从项目根目录开始，server 目录的内容在 /
COPY . .

# 安装依赖
RUN pip install --no-cache-dir -r requirements.txt

# Railway 会自动设置 PORT 环境变量
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
