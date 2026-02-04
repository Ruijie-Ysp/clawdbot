# Moltbot Docker 快速参考

## 快速启动

```bash
# 一键部署（自动备份、构建、启动）
./deploy-docker.sh
```

## 日常操作

### 查看状态
```bash
# 查看运行中的容器
docker ps | grep moltbot

# 查看服务状态
docker compose ps
```

### 日志管理
```bash
# 实时查看日志
docker compose logs -f moltbot-gateway

# 查看最近 100 行日志
docker compose logs --tail=100 moltbot-gateway

# 查看特定时间的日志
docker compose logs --since 1h moltbot-gateway
```

### 服务控制
```bash
# 启动服务
docker compose up -d moltbot-gateway

# 停止服务
docker compose stop moltbot-gateway

# 重启服务
docker compose restart moltbot-gateway

# 停止并删除容器
docker compose down
```

### 使用 CLI 工具
```bash
# 查看会话列表
docker compose run --rm moltbot-cli sessions list

# 查看状态
docker compose run --rm moltbot-cli status

# 查看配置
docker compose run --rm moltbot-cli config show

# 发送测试消息
docker compose run --rm moltbot-cli agent --message "测试消息"

# 重置会话
docker compose run --rm moltbot-cli sessions reset <session-id>

# 查看帮助
docker compose run --rm moltbot-cli --help
```

### 频道管理
```bash
# WhatsApp 登录（扫码）
docker compose run --rm moltbot-cli channels login

# Telegram 配置
docker compose run --rm moltbot-cli channels add --channel telegram --token "<your-bot-token>"

# Discord 配置
docker compose run --rm moltbot-cli channels add --channel discord --token "<your-bot-token>"

# 查看频道状态
docker compose run --rm moltbot-cli channels status
```

### 进入容器
```bash
# 进入运行中的容器
docker compose exec moltbot-gateway /bin/bash

# 或使用 sh
docker compose exec moltbot-gateway sh

# 以 root 身份进入（调试用）
docker compose exec -u root moltbot-gateway bash
```

### 检查挂载数据
```bash
# 检查配置目录
docker compose exec moltbot-gateway ls -la /home/node/.clawdbot

# 检查工作空间
docker compose exec moltbot-gateway ls -la /home/node/clawd

# 查看配置文件
docker compose exec moltbot-gateway cat /home/node/.clawdbot/moltbot.json

# 查看会话
docker compose exec moltbot-gateway ls -la /home/node/.clawdbot/sessions/
```

## 更新与维护

### 更新代码和镜像
```bash
# 拉取最新代码
git pull

# 重新构建镜像
docker build -t moltbot:local -f Dockerfile .

# 重启服务应用更新
docker compose up -d moltbot-gateway
```

### 清理和重建
```bash
# 完全重建（保留数据）
docker compose down
docker rmi moltbot:local
docker build -t moltbot:local -f Dockerfile .
docker compose up -d moltbot-gateway
```

### 数据备份
```bash
# 备份配置和会话
tar -czf moltbot-backup-$(date +%Y%m%d).tar.gz \
  ~/.moltbot \
  ~/clawd

# 或者备份到指定目录
cp -r ~/.moltbot ~/backups/moltbot-config-$(date +%Y%m%d)
cp -r ~/clawd ~/backups/moltbot-workspace-$(date +%Y%m%d)
```

## 故障排查

### 容器启动失败
```bash
# 查看详细日志
docker compose logs moltbot-gateway

# 查看容器退出代码
docker ps -a | grep moltbot

# 检查端口占用
lsof -i :18789
netstat -an | grep 18789
```

### 数据访问问题
```bash
# 检查权限
ls -la ~/.moltbot
ls -la ~/clawd

# 修复权限（如果需要）
chmod -R 755 ~/.moltbot
chmod -R 755 ~/clawd
```

### 重新生成配置
```bash
# 进入容器运行 onboard
docker compose run --rm moltbot-cli onboard --no-install-daemon
```

### 清理所有容器和镜像（危险操作）
```bash
# 停止所有容器
docker compose down

# 删除镜像
docker rmi moltbot:local

# 清理未使用的资源
docker system prune -a
```

## 性能优化

### 查看资源使用
```bash
# 查看容器资源使用
docker stats moltbot-gateway

# 查看容器进程
docker compose top moltbot-gateway
```

### 限制资源（修改 docker-compose.yml）
```yaml
services:
  moltbot-gateway:
    # ... 其他配置
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

## 网络配置

### 从其他设备访问
```bash
# 修改 .env 文件
echo "CLAWDBOT_GATEWAY_BIND=0.0.0.0" >> .env

# 重启服务
docker compose up -d moltbot-gateway
```

### 检查网络连接
```bash
# 测试健康检查
curl http://localhost:18789/health

# 从容器内测试
docker compose exec moltbot-gateway curl http://localhost:18789/health
```

## 多环境部署

### 开发环境
```bash
# 使用不同的配置目录
export CLAWDBOT_CONFIG_DIR=$HOME/.moltbot-dev
export CLAWDBOT_WORKSPACE_DIR=$HOME/clawd-dev
export CLAWDBOT_GATEWAY_PORT=18790

docker compose up -d moltbot-gateway
```

### 生产环境
```bash
# 使用生产配置
export CLAWDBOT_CONFIG_DIR=/opt/moltbot/config
export CLAWDBOT_WORKSPACE_DIR=/opt/moltbot/workspace
export CLAWDBOT_GATEWAY_BIND=0.0.0.0

docker compose up -d moltbot-gateway
```

## 安全建议

### 设置强密码
```bash
# 生成新 token
openssl rand -hex 32

# 更新 .env 文件
# CLAWDBOT_GATEWAY_TOKEN=<new-token>
```

### 仅本地访问
```bash
# 在 .env 中设置
CLAWDBOT_GATEWAY_BIND=loopback

# 重启服务
docker compose up -d moltbot-gateway
```

### 防火墙配置
```bash
# 仅允许本地访问（Linux）
sudo ufw allow from 127.0.0.1 to any port 18789
sudo ufw allow from 127.0.0.1 to any port 18790

# 或允许特定网段
sudo ufw allow from 192.168.1.0/24 to any port 18789
```

## 获取帮助

```bash
# 查看项目文档
cat DOCKER_DEPLOY.md

# 查看 Docker 文档
cat docs/install/docker.md

# 在线文档
open https://docs.molt.bot/install/docker

# 查看日志定位问题
docker compose logs -f moltbot-gateway 2>&1 | tee moltbot-debug.log
```

## 快速故障排查清单

1. **容器未运行**
   - `docker ps | grep moltbot` 检查状态
   - `docker compose logs moltbot-gateway` 查看日志

2. **无法访问 Web UI**
   - 检查端口: `lsof -i :18789`
   - 检查 bind 设置: `cat .env | grep BIND`
   - 测试连接: `curl http://localhost:18789/health`

3. **数据丢失或不可见**
   - 检查挂载: `docker compose exec moltbot-gateway ls -la /home/node/.clawdbot`
   - 验证路径: `cat .env | grep CONFIG_DIR`

4. **权限错误**
   - 检查宿主机权限: `ls -la ~/.moltbot`
   - 容器用户是 uid=1000 (node)
   - 修复: `chmod -R 755 ~/.moltbot ~/clawd`

5. **频道连接问题**
   - 重新登录: `docker compose run --rm moltbot-cli channels login`
   - 检查凭据: `docker compose exec moltbot-gateway ls -la /home/node/.clawdbot/credentials/`

6. **内存/CPU 使用过高**
   - 查看资源: `docker stats moltbot-gateway`
   - 重启清理: `docker compose restart moltbot-gateway`
   - 考虑添加资源限制
